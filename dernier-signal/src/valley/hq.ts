// Quartier général de R-12 : la capsule de descente lourde de l'Asterion, écrasée dans la plaine.
// Extérieur (coque brûlée, tranchée, débris, parachute, fumée, phare cyan) et intérieur visitable
// (poste de commandement avec projecteur holographique, sas, soute encombrée, alcôve de recharge).
// Repère local : x vers l'est (nez à l'ouest, x < 0), y vers le haut, z vers le sud (porte au sud).
import * as THREE from 'three';
import { HQ, Terrain } from './terrain';
import { U } from './atmosphere';
import { fbm, rng } from './noise';
import { pbr } from '../core/textures';
import type { Physics } from '../world/physics';

const LEN = HQ.half;          // demi-longueur (9 m)
const RO = 3.2, RI = 2.95;    // rayons extérieur et intérieur
const AX = 1.75;              // hauteur de l'axe au-dessus du sol de la plate-forme
export const FLOOR = 0.35;    // plancher (au-dessus du sol)
const DOOR = { x0: -0.6, x1: 1.4, a0: 1.19, a1: 2.02 };
const PORTS = [{ x: -3.0, a: 1.25 }, { x: 3.2, a: 1.3 }, { x: 6.1, a: 1.3 }, { x: -3.0, a: -1.25 }, { x: 3.2, a: -1.3 }, { x: 6.1, a: -1.3 }];


/** Rayon de la coque selon x (nez arrondi, poupe légèrement rétrécie). */
function rOuter(x: number) {
  if (x < -5.6) { const t = (x + LEN) / 3.4; return Math.max(0.06, RO * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)))); }
  if (x > 7.4) return RO - ((x - 7.4) / 1.6) * 0.35;
  return RO;
}
const rInner = (x: number) => Math.max(0.05, rOuter(x) - 0.25);

function inDoor(x: number, a: number) { return x > DOOR.x0 && x < DOOR.x1 && a > DOOR.a0 && a < DOOR.a1; }
function inPort(x: number, a: number, r: number) { return PORTS.some((p) => Math.hypot(x - p.x, (a - p.a) * r) < 0.42); }
function inShield(x: number, a: number) { return x > -8.55 && x < -6.15 && Math.abs(a) < 0.95 && Math.abs(a) > 0.05; }
function inTear(x: number, a: number) { const j = Math.sin(x * 7.3) * 0.08 + Math.sin(x * 13.1) * 0.05; return x > 4.3 && x < 6.0 && a > -0.45 + j && a < 0.12 - j * 0.6; }
const isOpening = (x: number, a: number, r: number) => inDoor(x, a) || inPort(x, a, r) || inShield(x, a) || inTear(x, a);

/** Grille de coque : on garde les quadrilatères où `keep` est vrai. */
function shell(rf: (x: number) => number, keep: (x: number, a: number, r: number) => boolean, inward = false, uvf?: (x: number, a: number) => [number, number], nx = 150, na = 112) {
  const pos: number[] = [], uv: number[] = [], ind: number[] = [];
  const vid = new Map<number, number>();
  const vert = (i: number, j: number) => {
    const key = i * (na + 1) + j;
    let id = vid.get(key);
    if (id !== undefined) return id;
    const x = -LEN + (i / nx) * LEN * 2, a = (j / na) * Math.PI * 2 - Math.PI, r = rf(x);
    pos.push(x, AX + r * Math.cos(a), r * Math.sin(a));
    const [u, v] = uvf ? uvf(x, a) : [x / 3, (a * r) / 3];
    uv.push(u, v);
    id = pos.length / 3 - 1; vid.set(key, id);
    return id;
  };
  for (let i = 0; i < nx; i++) for (let j = 0; j < na; j++) {
    const xc = -LEN + ((i + 0.5) / nx) * LEN * 2, ac = ((j + 0.5) / na) * Math.PI * 2 - Math.PI;
    if (!keep(xc, ac, rf(xc))) continue;
    const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
    if (inward) ind.push(a, b, c, b, d, c); else ind.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ind); g.computeVertexNormals();
  return g;
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; return t;
}

/** Petit système de particules (fumée, étincelles) calculé sur le processeur. */
class Puffs extends THREE.Points {
  p: { pos: THREE.Vector3; vel: THREE.Vector3; life: number; max: number }[] = [];
  constructor(private max: number, color: THREE.Color, size: number, additive: boolean) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(max), 1));
    super(g, new THREE.ShaderMaterial({
      uniforms: { uCol: { value: color }, uSize: { value: size } },
      vertexShader: 'attribute float aA; uniform float uSize; varying float vA; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * (0.6 + (1.0 - aA) * 1.6) * 300.0 / -mv.z; }',
      fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uCol, a); }',
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.frustumCulled = false;
  }
  emit(pos: THREE.Vector3, vel: THREE.Vector3, life: number) { if (this.p.length < this.max) this.p.push({ pos: pos.clone(), vel: vel.clone(), life, max: life }); }
  update(dt: number, grav: number, drag: number) {
    const P = this.geometry.attributes.position as THREE.BufferAttribute, A = this.geometry.attributes.aA as THREE.BufferAttribute;
    this.p = this.p.filter((q) => (q.life -= dt) > 0);
    this.p.forEach((q, i) => { q.vel.y += grav * dt; q.vel.multiplyScalar(Math.exp(-drag * dt)); q.pos.addScaledVector(q.vel, dt); P.setXYZ(i, q.pos.x, q.pos.y, q.pos.z); A.setX(i, q.life / q.max); });
    for (let i = this.p.length; i < this.max; i++) A.setX(i, 0);
    P.needsUpdate = true; A.needsUpdate = true;
  }
}

export class HQBase {
  group = new THREE.Group();
  /** point de vue sur l'hologramme et position du projecteur (monde) */
  holoAnchor = new THREE.Vector3();
  consolePos = new THREE.Vector3();
  inside = false;
  private glass: THREE.MeshPhysicalMaterial;
  private portGlow: THREE.MeshStandardMaterial;
  private emerg: THREE.PointLight;
  private emergMat: THREE.MeshStandardMaterial;
  private cockpitLight: THREE.PointLight;
  private holdLight: THREE.PointLight;
  private beaconRot = new THREE.Group();
  private beaconLight: THREE.PointLight;
  private beaconMat: THREE.MeshStandardMaterial;
  private blink: THREE.MeshStandardMaterial[] = [];
  private screens: { tex: THREE.CanvasTexture; draw: (g: CanvasRenderingContext2D, t: number) => void }[] = [];
  private smoke: Puffs; private sparks: Puffs;
  private sparkT = 2;
  /** Appelé à chaque gerbe d'étincelles (bruitage). */
  onSpark?: (p: THREE.Vector3) => void;
  ground: number;

  constructor(t: Terrain, ph: Physics, res: '1k' | '2k', shadows: boolean) {
    const g0 = t.hqGround;
    this.ground = g0;
    const G = this.group;
    G.position.set(HQ.x, g0, HQ.z);
    G.rotation.x = 0.022; // légère gîte, sans gêner la marche
    const R = rng(404);

    // ---------- matériaux ----------
    const mp = pbr('rust_coarse_01', res), sh = pbr('painted_metal_shutter', res), gr = pbr('metal_grate_rusty', res), rp = pbr('mossy_rock', res);
    const hull = new THREE.MeshStandardMaterial({ roughnessMap: mp.arm, normalMap: mp.normalMap, normalScale: new THREE.Vector2(0.25, 0.25), color: 0xd9d6cf, roughness: 0.75, metalness: 0.35 });
    hull.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vLP;
float hh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float hn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hh(i), hh(i+vec3(1,0,0)), f.x), mix(hh(i+vec3(0,1,0)), hh(i+vec3(1,1,0)), f.x), f.y), mix(mix(hh(i+vec3(0,0,1)), hh(i+vec3(1,0,1)), f.x), mix(hh(i+vec3(0,1,1)), hh(i+vec3(1,1,1)), f.x), f.y), f.z); }
float gScorch;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
// brûlure de rentrée : le dessous et le nez sont les plus touchés, avec des coulures vers l'arrière
float streak = hn(vec3(vLP.x * 0.35, vLP.y * 6.0, vLP.z * 6.0)) * 0.6 + hn(vLP * 2.3) * 0.4;
float heat = smoothstep(0.4, -2.2, vLP.y - ${AX.toFixed(2)}) * 0.95 + smoothstep(-4.5, -8.6, vLP.x) * 0.8 + smoothstep(5.5, 9.0, vLP.x) * 0.45;
// coulures noires vers l'arrière depuis le nez
heat += smoothstep(0.6, 0.9, hn(vec3(vLP.x * 0.06, vLP.y * 3.5, vLP.z * 3.5))) * smoothstep(4.0, -6.0, vLP.x) * 0.35;
gScorch = clamp(heat + (streak - 0.5) * 0.7 * heat + (streak - 0.6) * 0.35, 0.0, 1.0);
vec3 temper = mix(vec3(0.55, 0.42, 0.25), vec3(0.22, 0.25, 0.42), smoothstep(0.35, 0.6, gScorch));
diffuseColor.rgb = mix(diffuseColor.rgb, temper * diffuseColor.rgb, smoothstep(0.25, 0.5, gScorch) * 0.7);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.025, 0.022, 0.02), smoothstep(0.5, 0.85, gScorch));
// rayures et plaques
float plate = step(0.97, fract(vLP.x / 1.5)) + step(0.975, fract(atan(vLP.z, vLP.y - ${AX.toFixed(2)}) * 3.0));
diffuseColor.rgb *= 1.0 - clamp(plate, 0.0, 1.0) * 0.45;`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.95, smoothstep(0.4, 0.8, gScorch));')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.25, smoothstep(0.5, 0.9, gScorch));');
    };
    hull.customProgramCacheKey = () => 'hqhull';
    hull.shadowSide = THREE.BackSide; // évite les damiers d'ombre sur la coque courbe
    const lining = new THREE.MeshStandardMaterial({ map: sh.map, normalMap: sh.normalMap, roughnessMap: sh.arm, color: 0xe2e8ec, roughness: 1, metalness: 0.4, side: THREE.FrontSide });
    const dark = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.55, metalness: 0.7 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x6b7076, roughness: 0.4, metalness: 0.85 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xc8571e, roughness: 0.6, metalness: 0.2 });
    const grate = new THREE.MeshStandardMaterial({ map: gr.map, normalMap: gr.normalMap, roughnessMap: gr.arm, color: 0x9aa0a6, roughness: 1, metalness: 0.8 });
    const tile = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9, metalness: 0.1 });
    const rock = new THREE.MeshStandardMaterial({ map: rp.map, normalMap: rp.normalMap, roughnessMap: rp.arm, color: 0x9c9890, roughness: 1 });
    const crackTex = canvasTex(512, 512, (c) => {
      c.clearRect(0, 0, 512, 512); c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1.4;
      const rr = rng(77);
      for (let k = 0; k < 3; k++) { const cx = 120 + rr() * 280, cy = 120 + rr() * 280; for (let i = 0; i < 14; i++) { let x = cx, y = cy, a = rr() * Math.PI * 2; c.beginPath(); c.moveTo(x, y); for (let s = 0; s < 8; s++) { a += (rr() - 0.5) * 0.6; x += Math.cos(a) * (10 + rr() * 26); y += Math.sin(a) * (10 + rr() * 26); c.lineTo(x, y); } c.stroke(); } }
    });
    this.glass = new THREE.MeshPhysicalMaterial({ color: 0x0d1a22, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.38, clearcoat: 1, clearcoatRoughness: 0.05, emissive: new THREE.Color(0xffd9a0), emissiveIntensity: 0, side: THREE.DoubleSide, depthWrite: false });
    const crackMat = new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    this.portGlow = new THREE.MeshStandardMaterial({ color: 0x0a0d10, emissive: new THREE.Color(0xffc890), emissiveIntensity: 0, roughness: 0.2 });
    const add = <T extends THREE.Object3D>(o: T, cast = true) => { o.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.castShadow = cast && shadows; m.receiveShadow = true; } }); G.add(o); return o; };
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return add(m); };

    // ---------- coque ----------
    add(new THREE.Mesh(shell(rOuter, (x, a, r) => !isOpening(x, a, r)), hull));
    add(new THREE.Mesh(shell(rInner, (x, a, r) => !isOpening(x, a, r + 0.25) && x > -8.75, true), lining), false);
    // pare-brise et hublots (verre fêlé)
    add(new THREE.Mesh(shell((x) => rOuter(x) - 0.1, (x, a) => inShield(x, a), false), this.glass), false);
    add(new THREE.Mesh(shell((x) => rOuter(x) - 0.08, (x, a) => inShield(x, a) && a > 0, false, (x, a) => [(x + 8.6) / 2.6, (a + 1) / 2]), crackMat), false);
    for (const p of PORTS) {
      const r = rOuter(p.x), n = new THREE.Vector3(0, Math.cos(p.a), Math.sin(p.a));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.06, 8, 24), steel);
      ring.position.set(p.x, AX + n.y * (r + 0.02), n.z * (r + 0.02)); ring.lookAt(ring.position.clone().add(n).add(G.position)); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      add(ring);
      const gl = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), this.glass); gl.position.copy(ring.position).addScaledVector(n, -0.1); gl.quaternion.copy(ring.quaternion); add(gl, false);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), this.portGlow); glow.position.copy(ring.position).addScaledVector(n, -0.22); glow.quaternion.copy(ring.quaternion); add(glow, false);
    }
    // cadre de la porte et sas ouvert
    const dy0 = FLOOR, dy1 = AX + RO * Math.cos(DOOR.a0);
    box(0.18, dy1 - dy0, 0.4, steel, DOOR.x0 - 0.05, (dy0 + dy1) / 2, 2.85); box(0.18, dy1 - dy0, 0.4, steel, DOOR.x1 + 0.05, (dy0 + dy1) / 2, 2.85);
    box(DOOR.x1 - DOOR.x0 + 0.4, 0.18, 0.4, steel, (DOOR.x0 + DOOR.x1) / 2, dy1, 2.85);
    const hatch = box(DOOR.x1 - DOOR.x0, dy1 - dy0, 0.12, hull, DOOR.x1 + 0.9, (dy0 + dy1) / 2, 3.35, 0, 0.2, 0); hatch.name = 'hatch';
    box(DOOR.x1 - DOOR.x0 + 0.2, 0.17, 1.4, grate, (DOOR.x0 + DOOR.x1) / 2, 0.09, 3.3);
    // bouclier thermique arrière et tuyères
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(rOuter(LEN) + 0.1, rOuter(LEN) + 0.25, 0.5, 48), tile); shield.rotation.z = Math.PI / 2; shield.position.set(LEN + 0.15, AX, 0); add(shield);
    for (const [y, z] of [[0.9, 0.9], [0.9, -0.9], [-0.7, 0]]) { const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.65, 1.1, 20, 1, true), dark); bell.rotation.z = -Math.PI / 2; bell.position.set(LEN + 0.9, AX + y, z); add(bell); }
    // plaques arrachées et nervures visibles par la déchirure
    for (let k = 0; k < 4; k++) { const a = -0.2 + k * 0.08, x = 4.5 + k * 0.4; const rib = new THREE.Mesh(new THREE.TorusGeometry(RO - 0.12, 0.05, 6, 20, 0.7), steel); rib.rotation.set(0, Math.PI / 2, -Math.PI / 2 - a - 0.35); rib.position.set(x, AX, 0); add(rib); }
    const bent = box(1.6, 0.05, 1.3, hull, 5.2, AX + RO + 0.45, -0.9, 0.9, 0.3, 0.5);
    void bent;
    // marquages de l'Asterion à moitié effacés
    const markTex = canvasTex(1024, 256, (c) => {
      c.clearRect(0, 0, 1024, 256);
      c.fillStyle = 'rgba(200,80,30,0.95)'; c.fillRect(0, 26, 1024, 16); c.fillRect(0, 214, 1024, 8);
      c.fillStyle = 'rgba(25,30,36,0.92)'; c.font = '700 96px "Barlow Condensed", sans-serif'; c.fillText('ASTERION', 40, 150);
      c.font = '600 34px "Barlow Condensed", sans-serif'; c.fillText('CAPSULE DE SAUVETAGE  ·  CS-3  ·  12 PLACES', 44, 196);
      c.font = '700 70px "Barlow Condensed", sans-serif'; c.fillText('03', 900, 150);
      // effacement : brûlures et rayures
      c.globalCompositeOperation = 'destination-out'; const rr = rng(9);
      for (let i = 0; i < 260; i++) { c.globalAlpha = 0.3 + rr() * 0.7; c.beginPath(); c.ellipse(rr() * 1024, rr() * 256, 8 + rr() * 60, 3 + rr() * 22, rr() * 3, 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    });
    const markMat = new THREE.MeshStandardMaterial({ map: markTex, transparent: true, roughness: 0.8, metalness: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const side of [1, -1]) add(new THREE.Mesh(shell((x) => rOuter(x) + 0.006, (x, a) => x > -4.6 && x < 2.4 && a * side > 0.62 && a * side < 1.12, false, (x, a) => [side > 0 ? (x + 4.6) / 7 : 1 - (x + 4.6) / 7, side > 0 ? 1 - (a - 0.62) / 0.5 : 1 - (-a - 0.62) / 0.5], 90, 160), markMat), false);

    // ---------- intérieur ----------
    const fl = box(LEN * 2 - 0.9, 0.12, 5.1, grate, 0.1, FLOOR - 0.06, 0); fl.castShadow = false;
    // cloisons : cockpit | sas | soute
    const bulk = (x: number) => {
      const s = new THREE.Shape(); s.absarc(0, 0, RI - 0.02, 0, Math.PI * 2, false);
      const hole = new THREE.Path(); const hw = 0.75, b = FLOOR - AX, top = b + 2.3; hole.moveTo(-hw, b); hole.lineTo(hw, b); hole.lineTo(hw, top - 0.3); hole.lineTo(hw - 0.3, top); hole.lineTo(-hw + 0.3, top); hole.lineTo(-hw, top - 0.3); hole.closePath();
      s.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false, curveSegments: 32 });
      const m = new THREE.Mesh(geo, lining); m.rotation.y = Math.PI / 2; m.position.set(x, AX, 0);
      // la partie sous le plancher est cachée
      add(m);
      ph.add([HQ.x + x - 0.1, g0 + FLOOR, HQ.z - 3], [HQ.x + x + 0.1, g0 + AX + RI, HQ.z - 0.8]);
      ph.add([HQ.x + x - 0.1, g0 + FLOOR, HQ.z + 0.8], [HQ.x + x + 0.1, g0 + AX + RI, HQ.z + 3]);
      ph.add([HQ.x + x - 0.1, g0 + FLOOR + 2.3, HQ.z - 0.8], [HQ.x + x + 0.1, g0 + AX + RI, HQ.z + 0.8]);
    };
    bulk(-4.5); bulk(2.1);
    // couples (nervures) et chemins de câbles
    for (let x = -4; x < 8.6; x += 1.5) { const rib = new THREE.Mesh(new THREE.TorusGeometry(RI - 0.04, 0.045, 6, 40, Math.PI * 1.45), dark); rib.rotation.set(0, Math.PI / 2, Math.PI / 2 - Math.PI * 0.725 + Math.PI); rib.position.set(x, AX, 0); add(rib, false); }
    box(LEN * 2 - 3, 0.08, 0.5, dark, 0.8, AX + RI - 0.35, 0);
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6 });
    for (let k = 0; k < 7; k++) {
      const x0 = -3.6 + k * 1.7, z0 = (R() - 0.5) * 1.6;
      const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x0, AX + RI - 0.4, z0), new THREE.Vector3(x0 + 0.6, AX + RI - 1.1 - R() * 0.6, z0 + 0.3), new THREE.Vector3(x0 + 1.3, AX + RI - 0.4, z0 + 0.1)]);
      add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.025 + R() * 0.02, 5), cableMat), false);
    }
    // cockpit : sièges face au pare-brise, consoles et écrans
    for (const z of [-0.95, 0.95]) {
      const seat = new THREE.Group();
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.6), orange); b1.position.y = 0.55;
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.85, 0.6), orange); b2.position.set(0.3, 1.0, 0); b2.rotation.z = -0.15;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.5, 8), steel); st.position.y = 0.25;
      seat.add(b1, b2, st); seat.position.set(-7.3, FLOOR, z); seat.rotation.y = z > 0 ? 0.15 : -0.15; add(seat);
      ph.add([HQ.x - 7.65, g0 + FLOOR, HQ.z + z - 0.35], [HQ.x - 6.95, g0 + FLOOR + 1.3, HQ.z + z + 0.35], { camera: false });
    }
    const dash = box(0.9, 0.9, 4.2, dark, -8.05, FLOOR + 0.45, 0); dash.rotation.z = 0.25;
    ph.add([HQ.x - 8.6, g0 + FLOOR, HQ.z - 2.2], [HQ.x - 7.6, g0 + FLOOR + 1.0, HQ.z + 2.2], { camera: false });
    const mkScreen = (_w: number, _h: number, draw: (g: CanvasRenderingContext2D, t: number) => void) => {
      const tex = canvasTex(256, 160, (g) => draw(g, 0));
      this.screens.push({ tex, draw });
      return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.4, roughness: 0.3 });
    };
    const scrA = mkScreen(1, 1, (g, t) => { g.fillStyle = '#021014'; g.fillRect(0, 0, 256, 160); g.strokeStyle = '#3fd8ff'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x < 256; x += 4) g.lineTo(x, 80 + Math.sin(x * 0.06 + t * 2) * 30 * Math.sin(t * 0.3 + x * 0.01)); g.stroke(); g.fillStyle = '#3fd8ff'; g.font = '16px monospace'; g.fillText('SIGNAL · BALISE', 10, 20); g.fillText((47.2 + Math.sin(t) * 0.4).toFixed(2) + ' kHz', 10, 150); });
    const scrB = mkScreen(1, 1, (g, t) => { g.fillStyle = '#140302'; g.fillRect(0, 0, 256, 160); g.fillStyle = Math.sin(t * 4) > 0 ? '#ff4a30' : '#702010'; g.font = 'bold 22px monospace'; g.fillText('AVARIE COQUE', 30, 60); g.font = '15px monospace'; g.fillStyle = '#ff9a70'; g.fillText('INTÉGRITÉ  41 %', 40, 100); g.fillText('ÉNERGIE    SECOURS', 40, 125); });
    for (const [z, m] of [[-1.3, scrA], [1.3, scrB]] as const) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), m); s.position.set(-7.65, FLOOR + 1.05, z); s.rotation.set(0, Math.PI / 2, 0); s.rotateX(-0.6); add(s, false); }
    // projecteur holographique au centre du cockpit
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.6, 0.95, 24), dark); ped.position.set(-6.0, FLOOR + 0.475, 0); add(ped);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 32), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x4fe6ff, emissiveIntensity: 3 })); lens.position.set(-6.0, FLOOR + 0.97, 0); add(lens, false);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.025, 6, 40), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x4fe6ff, emissiveIntensity: 2 })); ring.rotation.x = Math.PI / 2; ring.position.set(-6.0, FLOOR + 0.92, 0); add(ring, false);
    ph.add([HQ.x - 6.5, g0 + FLOOR, HQ.z - 0.55], [HQ.x - 5.5, g0 + FLOOR + 0.95, HQ.z + 0.55], { camera: false });
    this.consolePos.set(HQ.x - 5.05, g0 + FLOOR, HQ.z);
    this.holoAnchor.set(HQ.x - 6.0, g0 + FLOOR + 1.95, HQ.z);
    // sas : casiers, lumière de secours
    for (let k = 0; k < 4; k++) box(0.5, 1.9, 0.45, k % 2 ? steel : dark, -3.6 + k * 0.55, FLOOR + 0.95, -2.2);
    ph.add([HQ.x - 3.9, g0 + FLOOR, HQ.z - 2.6], [HQ.x - 1.5, g0 + FLOOR + 1.9, HQ.z - 1.95], { camera: false });
    this.emergMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2a10, emissiveIntensity: 3 });
    for (const x of [-2.5, 4.8]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.14), this.emergMat); l.position.set(x, AX + RI - 0.28, 1.1); add(l, false); }
    // alcôve de recharge (fonctionnelle à l'étape suivante)
    const sock = box(0.8, 2.0, 0.3, dark, 0.3, FLOOR + 1.0, -2.45);
    void sock;
    const plug = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 20), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb040, emissiveIntensity: 1.2 })); plug.position.set(0.3, FLOOR + 1.3, -2.28); add(plug, false);
    // soute encombrée (future salle des Forgés)
    const crateM = new THREE.MeshStandardMaterial({ color: 0x5a5e52, roughness: 0.8, metalness: 0.3 });
    for (let k = 0; k < 9; k++) { const s = 0.5 + R() * 0.6; const x = 3 + R() * 4.8, z = (R() - 0.5) * 3.4; box(s, s, s, k % 3 ? crateM : orange, x, FLOOR + s / 2 + (k > 6 ? s : 0), z, 0, R() * 1.5, 0); ph.add([HQ.x + x - s / 2, g0 + FLOOR, HQ.z + z - s / 2], [HQ.x + x + s / 2, g0 + FLOOR + s, HQ.z + z + s / 2], { camera: false }); }
    const bench = box(2.2, 0.12, 1.0, steel, 6.6, FLOOR + 0.9, -1.6); void bench;
    box(0.1, 0.9, 0.9, dark, 5.6, FLOOR + 0.45, -1.6); box(0.1, 0.9, 0.9, dark, 7.6, FLOOR + 0.45, -1.6);
    ph.add([HQ.x + 5.5, g0 + FLOOR, HQ.z - 2.1], [HQ.x + 7.7, g0 + FLOOR + 0.96, HQ.z - 1.1], { camera: false });
    const arm = new THREE.Group(); const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.2, 10), orange); a1.position.y = 0.6; a1.rotation.z = 0.5;
    const a2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.0, 10), orange); a2.position.set(-0.55, 1.2, 0); a2.rotation.z = 1.9; arm.add(a1, a2); arm.position.set(7.9, FLOOR + 0.96, -1.6); add(arm);

    // lumières intérieures
    this.emerg = new THREE.PointLight(0xff3018, 6, 9, 1.8); this.emerg.position.set(-1.0, AX + 1.2, 0.6); G.add(this.emerg);
    this.cockpitLight = new THREE.PointLight(0x58e6ff, 9, 9, 1.5); this.cockpitLight.position.set(-6.0, FLOOR + 1.8, 0); G.add(this.cockpitLight);
    this.holdLight = new THREE.PointLight(0xffb070, 4, 8, 1.8); this.holdLight.position.set(5.5, AX + 1.0, 0); G.add(this.holdLight);

    // phare de signalisation tournant + feux de bord
    const bh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.3, 16), dark); bh.position.set(-1.0, AX + RO + 0.12, 0); add(bh);
    this.beaconMat = new THREE.MeshStandardMaterial({ color: 0x0a2a30, emissive: 0x40f0ff, emissiveIntensity: 3, transparent: true, opacity: 0.9 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.beaconMat); dome.position.set(-1.0, AX + RO + 0.27, 0); add(dome, false);
    this.beaconRot.position.set(-1.0, AX + RO + 0.36, 0); G.add(this.beaconRot);
    const coneMat = new THREE.ShaderMaterial({ uniforms: { ...U }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'uniform float uDay; varying vec2 vUv; void main(){ float a = (1.0 - vUv.y) * smoothstep(0.0, 0.15, vUv.y); gl_FragColor = vec4(vec3(0.25, 0.9, 1.0) * a * (0.12 + (1.0 - uDay) * 0.5), 1.0); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 24, 1, true), coneMat); cone.rotation.z = Math.PI / 2; cone.position.x = 4.5; this.beaconRot.add(cone);
    this.beaconLight = new THREE.PointLight(0x40f0ff, 8, 30, 1.6); this.beaconLight.position.set(1.2, 0.2, 0); this.beaconRot.add(this.beaconLight);
    for (const [x, y, z, c] of [[-8.6, AX + 0.4, 1.2, 0xff2a20], [-8.6, AX + 0.4, -1.2, 0x30ff70], [LEN, AX + RO - 0.2, 0, 0xffffff]] as const) {
      const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: 4 }); this.blink.push(m);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), m); b.position.set(x, y, z); add(b, false);
    }

    // ---------- abords : tranchée, débris, rochers, parachute ----------
    const world = (lx: number, lz: number) => new THREE.Vector3(HQ.x + lx, t.heightAt(HQ.x + lx, HQ.z + lz), HQ.z + lz);
    const outside = new THREE.Group(); this.outside = outside;
    const rockGeo = (seed: number) => { const g = new THREE.IcosahedronGeometry(1, 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(1 + fbm(v.x * 1.4 + seed, v.y * 1.4 + v.z, 4) * 0.4); v.y *= 0.7; p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; };
    const rgs = [rockGeo(1), rockGeo(5), rockGeo(9)];
    for (let k = 0; k < 26; k++) {
      const lx = LEN + 2 + R() * 40, side = R() < 0.5 ? -1 : 1, lz = side * (3.5 + R() * 6) * (1 - (lx - LEN) / 60);
      const s = 0.25 + R() * (k < 6 ? 1.3 : 0.6);
      const p = world(lx, lz); const m = new THREE.Mesh(rgs[k % 3], rock); m.position.copy(p).add(new THREE.Vector3(0, -s * 0.2, 0)); m.scale.setScalar(s); m.rotation.set(R() * 3, R() * 3, R() * 3);
      m.castShadow = shadows; m.receiveShadow = true; outside.add(m);
      if (s > 0.9) ph.add([p.x - s, p.y - s, p.z - s], [p.x + s, p.y + s * 0.6, p.z + s], { camera: false });
    }
    // tuiles du bouclier thermique arrachées, le long de la tranchée
    for (let k = 0; k < 34; k++) {
      const lx = LEN + R() * 44, lz = (R() - 0.5) * 6 * (1 + lx / 40);
      const p = world(lx, lz); const m = new THREE.Mesh(new THREE.BoxGeometry(0.5 + R() * 0.5, 0.06, 0.4 + R() * 0.4), k % 4 ? tile : hull);
      m.position.copy(p).add(new THREE.Vector3(0, 0.03, 0)); m.rotation.set((R() - 0.5) * 0.8, R() * 3, (R() - 0.5) * 0.8); m.castShadow = shadows; m.receiveShadow = true; outside.add(m);
    }
    const plateBig = new THREE.Mesh(new THREE.CylinderGeometry(RO, RO, 2.2, 20, 1, true, 0, 1.1), hull); plateBig.material = hull;
    const pp = world(LEN + 14, 4.8); plateBig.position.copy(pp).add(new THREE.Vector3(0, 0.2, 0)); plateBig.rotation.set(0.3, 0.8, 1.9); plateBig.castShadow = shadows; outside.add(plateBig);
    // parachute déchiré, accroché au rocher et à la poupe
    const chuteTex = canvasTex(512, 512, (c) => {
      c.clearRect(0, 0, 512, 512);
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#e8e2d6' : '#d2582a'; c.beginPath(); c.moveTo(256, 256); c.arc(256, 256, 250, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2); c.closePath(); c.fill(); }
      c.globalCompositeOperation = 'destination-out'; const rr = rng(31);
      for (let i = 0; i < 40; i++) { c.beginPath(); const a = rr() * Math.PI * 2, r = 60 + rr() * 200; c.ellipse(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 6 + rr() * 30, 3 + rr() * 12, a, 0, Math.PI * 2); c.fill(); }
      c.globalCompositeOperation = 'source-over'; c.fillStyle = 'rgba(20,16,12,0.35)'; for (let i = 0; i < 30; i++) { c.beginPath(); c.arc(rr() * 512, rr() * 512, 10 + rr() * 40, 0, Math.PI * 2); c.fill(); }
    });
    const chuteG = new THREE.PlaneGeometry(9, 9, 36, 36); chuteG.rotateX(-Math.PI / 2);
    const cp = chuteG.attributes.position; const chuteC = world(LEN + 7, -6.5);
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i), z = cp.getZ(i);
      const gy = t.heightAt(chuteC.x + x, chuteC.z + z) - chuteC.y;
      const lump = 1.2 * Math.exp(-((x - 1) ** 2 + (z + 0.5) ** 2) / 3) + 0.35 * Math.exp(-((x + 2.5) ** 2 + (z - 1.5) ** 2) / 2) + fbm(x * 0.5, z * 0.5, 3) * 0.25;
      cp.setY(i, Math.max(gy + 0.04, gy + lump));
    }
    chuteG.computeVertexNormals();
    const chute = new THREE.Mesh(chuteG, new THREE.MeshStandardMaterial({ map: chuteTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 }));
    chute.position.copy(chuteC); chute.rotation.y = 0.6; chute.castShadow = shadows; chute.receiveShadow = true; outside.add(chute);
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.8 });
    for (let k = 0; k < 5; k++) {
      const a = new THREE.Vector3(HQ.x + LEN + 0.4, g0 + AX + 0.3 + k * 0.2, HQ.z - 1.0 + k * 0.3), b = chuteC.clone().add(new THREE.Vector3(-3 + k * 0.6, 0.3, 2.5 - k * 0.4));
      const m = a.clone().lerp(b, 0.5); m.y = Math.min(a.y, b.y) - 0.1;
      outside.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, b), 16, 0.012, 4), lineMat));
    }

    // fumée et étincelles
    this.smoke = new Puffs(140, new THREE.Color(0.32, 0.3, 0.28), 1.6, false);
    this.sparks = new Puffs(80, new THREE.Color(3, 1.6, 0.6), 0.12, true);
    outside.add(this.smoke, this.sparks);
    void steel;
  }
  outside!: THREE.Group;
  private smokeAcc = 0;

  /** Colliders de la coque (murs extérieurs, toit, extrémités) et marche devant le sas. */
  addColliders(ph: Physics) {
    const g = this.ground, X = HQ.x, Z = HQ.z;
    const top = g + AX + RO;
    ph.add([X - LEN, g - 1, Z + 2.55], [X + DOOR.x0 - 0.1, top, Z + 3.3]);
    ph.add([X + DOOR.x1 + 0.1, g - 1, Z + 2.55], [X + LEN, top, Z + 3.3]);
    ph.add([X + DOOR.x0 - 0.1, g + FLOOR + 2.5, Z + 2.55], [X + DOOR.x1 + 0.1, top, Z + 3.3]);
    ph.add([X - LEN, g - 1, Z - 3.3], [X + LEN, top, Z - 2.55]);
    ph.add([X - LEN, g + AX + RI - 0.05, Z - 3.3], [X + LEN, top, Z + 3.3]);
    ph.add([X - LEN - 0.8, g - 1, Z - 3.3], [X - 8.4, top, Z + 3.3]);
    ph.add([X + LEN - 0.4, g - 1, Z - 3.3], [X + LEN + 1.4, top, Z + 3.3]);
    ph.add([X - LEN, g - 1, Z - 2.6], [X + LEN, g + FLOOR, Z + 2.6], { surface: 'grate' });
    ph.add([X + DOOR.x0, g - 1, Z + 2.5], [X + DOOR.x1, g + 0.17, Z + 4.0], { surface: 'grate', camera: false });
  }

  /** Le joueur est-il dans la capsule ? */
  contains(p: THREE.Vector3) { const lx = p.x - HQ.x, lz = p.z - HQ.z; return lx > -8.6 && lx < LEN - 0.3 && Math.abs(lz) < 2.6 && p.y < this.ground + AX + RI; }

  update(dt: number, t: number, night: number, cam: THREE.Camera) {
    this.inside = this.contains(cam.position);
    // lumières de secours qui pulsent, néons qui grésillent dans la soute
    const pulse = 0.55 + 0.45 * Math.sin(t * 2.2);
    this.emerg.intensity = 8 * pulse; this.emergMat.emissiveIntensity = 1 + 3 * pulse;
    this.holdLight.intensity = (Math.sin(t * 23) > 0.6 || Math.sin(t * 3.1) > -0.7 ? 7 : 0.8);
    this.cockpitLight.intensity = 8 + Math.sin(t * 1.3) * 1;
    // nuit : lumière qui filtre par les hublots
    this.portGlow.emissiveIntensity = 0.3 + night * 2.4;
    this.glass.emissiveIntensity = night * 0.25;
    this.beaconRot.rotation.y = t * 0.9;
    this.beaconLight.intensity = 3 + night * 22;
    this.beaconMat.emissiveIntensity = 2 + night * 4;
    this.blink.forEach((m, i) => (m.emissiveIntensity = (Math.sin(t * 2.5 + i * 2.1) > 0.85 ? 8 : 0.2)));
    // écrans
    if (Math.floor(t * 8) !== Math.floor((t - dt) * 8)) for (const s of this.screens) { const g = s.tex.image.getContext('2d') as CanvasRenderingContext2D; s.draw(g, t); s.tex.needsUpdate = true; }
    // fumée depuis la poupe et la déchirure, étincelles par moments
    this.smokeAcc += dt;
    while (this.smokeAcc > 0.09) {
      this.smokeAcc -= 0.09;
      const src = Math.random() < 0.6 ? new THREE.Vector3(HQ.x + LEN + 0.8, this.ground + AX + 0.4, HQ.z) : new THREE.Vector3(HQ.x + 5.1, this.ground + AX + RO, HQ.z - 0.4);
      this.smoke.emit(src.add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6)), new THREE.Vector3(0.25 + U.uWind.value.x * 0.4, 0.7 + Math.random() * 0.4, U.uWind.value.y * 0.4), 5 + Math.random() * 3);
    }
    this.sparkT -= dt;
    if (this.sparkT < 0) {
      this.sparkT = 1.5 + Math.random() * 4;
      const o = new THREE.Vector3(HQ.x + 5.0, this.ground + AX + RO - 0.1, HQ.z - 0.3);
      for (let i = 0; i < 18; i++) this.sparks.emit(o, new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3), 0.5 + Math.random() * 0.6);
      this.onSpark?.(o);
    }
    this.smoke.update(dt, 0.05, 0.25); this.sparks.update(dt, -9, 0.5);
  }
}
