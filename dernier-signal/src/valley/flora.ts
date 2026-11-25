// Végétation et minéraux de la vallée, générés par le code puis instanciés :
// arbres géants aux troncs torsadés, racines aériennes, feuillages translucides,
// fougères, champignons et fleurs bioluminescents, rochers, cailloux, branches mortes.
import * as THREE from 'three';
import { rng, fbm, smooth } from './noise';
import { U } from './atmosphere';
import { Terrain, SIZE, BEACON, SPAWN, inHQZone } from './terrain';
import { pbr } from '../core/textures';
import type { Physics } from '../world/physics';

type R = () => number;

/** Fusion de géométries indexées (position, normale, uv). */
function mergeGeometries(gs: THREE.BufferGeometry[]) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], ind: number[] = [];
  let off = 0;
  for (const g0 of gs) {
    const g = g0.index ? g0 : g0.toNonIndexed();
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0); uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); }
    if (g.index) for (let i = 0; i < g.index.count; i++) ind.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) ind.push(i + off);
    off += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(ind);
  return out;
}

// ---------- géométries de base ----------
/** Tube à section lobée qui suit une courbe ; rayon et lobes varient le long du tube. */
function tube(curve: THREE.Curve<THREE.Vector3>, rings: number, radial: number, radius: (v: number) => number, lobes = 0, lobeAmp = 0, twist = 0, uvScale = 1) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], ind: number[] = [];
  const frames = curve.computeFrenetFrames(rings, false);
  for (let i = 0; i <= rings; i++) {
    const v = i / rings, c = curve.getPointAt(v), N = frames.normals[i], B = frames.binormals[i], r = radius(v);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const lr = r * (1 + lobeAmp * (1 - v * 0.6) * Math.sin(lobes * a + twist * v * Math.PI * 2));
      const dx = Math.cos(a), dy = Math.sin(a);
      const n = new THREE.Vector3().addScaledVector(N, dx).addScaledVector(B, dy).normalize();
      pos.push(c.x + n.x * lr, c.y + n.y * lr, c.z + n.z * lr); nor.push(n.x, n.y, n.z);
      uv.push((j / radial) * uvScale, v * curve.getLength() / (Math.PI * 2 * Math.max(0.2, r)) * uvScale * 0.5);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; ind.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ind);
  return g;
}
/** Paquet de cartes de feuillage autour de centres ; normales « gonflées » pour un volume doux. */
function leafCards(centers: { c: THREE.Vector3; r: number; n: number }[], size: number, R: R, droop = 0.5) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], ind: number[] = [];
  let base = 0;
  for (const cl of centers) for (let k = 0; k < cl.n; k++) {
    const d = new THREE.Vector3().randomDirection(); d.y = Math.abs(d.y) * 0.5 - 0.15;
    const p = cl.c.clone().addScaledVector(d.normalize(), cl.r * Math.cbrt(R()));
    const s = size * (0.7 + R() * 0.6);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 1.2 - droop, R() * Math.PI * 2, (R() - 0.5) * 0.8));
    const out = p.clone().sub(cl.c).normalize(); out.y = out.y * 0.5 + 0.5; out.normalize();
    // carte légèrement pliée (3 sommets par côté)
    const verts = [[-0.5, 0, 0], [0.5, 0, 0], [-0.5, 0.5, 0.12], [0.5, 0.5, 0.12], [-0.5, 1, 0], [0.5, 1, 0]];
    for (const [x, y, z] of verts) { const v = new THREE.Vector3(x * s, (y - 0.85) * s, z * s).applyQuaternion(q).add(p); pos.push(v.x, v.y, v.z); nor.push(out.x, out.y, out.z); }
    uv.push(0, 0, 1, 0, 0, 0.5, 1, 0.5, 0, 1, 1, 1);
    ind.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4, base + 3, base + 5, base + 4);
    base += 6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ind);
  return g;
}

// ---------- textures générées ----------
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4;
  return t;
}
/** Feuilles extraterrestres : longues palmes tombantes, nervures claires (et lumineuses la nuit). */
function leafTextures(seed: number, hue: number) {
  const R = rng(seed);
  const fronds: { x: number; y: number; a: number; l: number; w: number }[] = [];
  for (let i = 0; i < 9; i++) fronds.push({ x: 256 + (R() - 0.5) * 120, y: 40 + R() * 40, a: Math.PI / 2 + (R() - 0.5) * 1.6, l: 300 + R() * 160, w: 26 + R() * 22 });
  const frond = (g: CanvasRenderingContext2D, f: typeof fronds[0], vein: boolean) => {
    g.save(); g.translate(f.x, f.y); g.rotate(f.a - Math.PI / 2);
    g.beginPath(); g.moveTo(0, 0);
    g.bezierCurveTo(f.w, f.l * 0.3, f.w * 0.9, f.l * 0.7, 0, f.l); g.bezierCurveTo(-f.w * 0.9, f.l * 0.7, -f.w, f.l * 0.3, 0, 0);
    if (!vein) {
      const gr = g.createLinearGradient(0, 0, 0, f.l);
      gr.addColorStop(0, `hsl(${hue},40%,9%)`); gr.addColorStop(0.6, `hsl(${hue + 12},50%,15%)`); gr.addColorStop(1, `hsl(${hue + 50},48%,22%)`);
      g.fillStyle = gr; g.fill();
      g.globalAlpha = 0.25; g.strokeStyle = `hsl(${hue + 20},55%,30%)`; g.lineWidth = 2; g.stroke(); g.globalAlpha = 1;
    } else { g.fillStyle = '#000'; g.fill(); }
    // nervure centrale et secondaires
    g.strokeStyle = vein ? '#bffff0' : `hsl(${hue + 25},50%,32%)`; g.lineWidth = vein ? 2 : 2.5;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(2, f.l * 0.5, 0, f.l * 0.97); g.stroke();
    g.lineWidth = vein ? 0.7 : 1;
    for (let k = 1; k < 9; k++) { const y = (k / 9) * f.l * 0.9; const s = Math.sin((k / 9) * Math.PI) * f.w * 0.9; g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + 18); g.moveTo(0, y); g.lineTo(-s, y + 18); g.stroke(); }
    g.restore();
  };
  const map = canvasTex(512, 512, (g) => { g.clearRect(0, 0, 512, 512); for (const f of fronds) frond(g, f, false); });
  const glow = canvasTex(512, 512, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512); for (const f of fronds) frond(g, f, true); });
  return { map, glow };
}
function fernTex() {
  const draw = (g: CanvasRenderingContext2D, glow: boolean) => {
    g.clearRect(0, 0, 256, 512);
    if (glow) { g.fillStyle = '#000'; g.fillRect(0, 0, 256, 512); }
    g.strokeStyle = glow ? '#8fffe0' : '#2b4a3c'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(128, 512); g.quadraticCurveTo(120, 260, 128, 10); g.stroke();
    for (let i = 0; i < 26; i++) {
      const y = 500 - i * 19, l = Math.sin((i / 26) * Math.PI) * 110 + 8;
      for (const s of [-1, 1]) {
        g.fillStyle = glow ? (i > 20 ? '#a0fff0' : '#000') : `hsl(${155 + i * 2},${40 + i}%,${18 + i * 0.7}%)`;
        g.beginPath(); g.ellipse(128 + s * l * 0.5, y - 6, l * 0.5, 7, s * -0.35, 0, Math.PI * 2); g.fill();
      }
    }
  };
  return { map: canvasTex(256, 512, (g) => draw(g, false)), glow: canvasTex(256, 512, (g) => draw(g, true)) };
}

// ---------- matériaux ----------
const glowMats: THREE.Material[] = [];
function foliageMat(map: THREE.Texture, glow: THREE.Texture, glowCol: number) {
  const m = new THREE.MeshStandardMaterial({ map, emissiveMap: glow, emissive: new THREE.Color(glowCol), emissiveIntensity: 0, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.62, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform vec2 uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
      #else
        vec3 ip = vec3(0.0);
      #endif
      float sw = (sin(uTime * 1.1 + ip.x * 0.2 + position.y * 0.3) + sin(uTime * 2.3 + ip.z * 0.3 + position.x)) * 0.5;
      transformed.xz += uWind * sw * 0.05 * max(position.y, 0.0) * 0.12;
      transformed.y += sin(uTime * 3.0 + position.x * 2.0 + position.z) * 0.04;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSunCol; uniform float uDay;')
      .replace('#include <opaque_fragment>', `
      #ifdef USE_FOG
        float trans = pow(max(dot(normalize(vFogWorld - cameraPosition), uSunDir), 0.0), 3.0);
        outgoingLight += diffuseColor.rgb * uSunCol * (trans * 0.9 + 0.02) * uDay;
      #endif
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'foliage';
  glowMats.push(m);
  return m;
}
function barkMat(res: '1k' | '2k') {
  const b = pbr('bark_willow_02', res);
  const m = new THREE.MeshStandardMaterial({ map: b.map, normalMap: b.normalMap, roughnessMap: b.arm, aoMap: b.arm, color: 0x9a8ca8, roughness: 1, metalness: 0, emissive: new THREE.Color(0x40ffd8), emissiveIntensity: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #ifdef USE_MAP
        float vein = smoothstep(0.985, 1.0, sin(vMapUv.x * 37.7 + vMapUv.y * 4.0 + sin(vMapUv.y * 2.0) * 3.0));
        totalEmissiveRadiance += vec3(0.25, 1.0, 0.85) * vein * uNight * 1.6;
      #endif`);
  };
  m.customProgramCacheKey = () => 'bark';
  return m;
}
function glowMat(col: number, base: number) {
  const m = new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.5, emissive: new THREE.Color(col), emissiveIntensity: base });
  m.userData.glowBase = base; glowMats.push(m);
  return m;
}

// ---------- arbres ----------
interface TreeKind { trunk: THREE.BufferGeometry; leaves: THREE.BufferGeometry; height: number; radius: number }
function makeTree(seed: number, height: number, baseR: number, giant: boolean): TreeKind {
  const R = rng(seed);
  const lean = new THREE.Vector3((R() - 0.5) * 0.25, 0, (R() - 0.5) * 0.25);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) { const v = i / 6; pts.push(new THREE.Vector3(Math.sin(v * 4 + seed) * baseR * 0.6 + lean.x * v * height, v * height, Math.cos(v * 3.3 + seed) * baseR * 0.6 + lean.z * v * height)); }
  const trunkCurve = new THREE.CatmullRomCurve3(pts);
  const parts: THREE.BufferGeometry[] = [];
  const radius = (v: number) => baseR * (1 - 0.78 * v) + baseR * 1.5 * Math.exp(-v * 12);
  parts.push(tube(trunkCurve, giant ? 26 : 16, giant ? 16 : 10, radius, giant ? 5 : 4, giant ? 0.22 : 0.14, 1.4 + R(), 2));
  const clusters: { c: THREE.Vector3; r: number; n: number }[] = [];
  const top = trunkCurve.getPointAt(1);
  clusters.push({ c: top.clone().add(new THREE.Vector3(0, 1, 0)), r: height * 0.14, n: giant ? 70 : 36 });
  // branches qui partent vers l'extérieur puis remontent
  const nb = giant ? 6 : 4;
  for (let b = 0; b < nb; b++) {
    const v = 0.5 + 0.42 * (b / nb) + R() * 0.05;
    const o = trunkCurve.getPointAt(v);
    const a = (b / nb) * Math.PI * 2 + R() * 0.8;
    const L = height * (0.22 + R() * 0.14) * (1.2 - v * 0.5);
    const dir = new THREE.Vector3(Math.cos(a), 0.35 + R() * 0.3, Math.sin(a)).normalize();
    const end = o.clone().addScaledVector(dir, L).add(new THREE.Vector3(0, L * 0.25, 0));
    const mid = o.clone().addScaledVector(dir, L * 0.55).add(new THREE.Vector3(0, -L * 0.05, 0));
    const bc = new THREE.QuadraticBezierCurve3(o, mid, end);
    const br = radius(v) * 0.42;
    parts.push(tube(bc, 8, giant ? 8 : 6, (t) => br * (1 - t * 0.75), 3, 0.1, 1, 1));
    clusters.push({ c: end, r: height * 0.11, n: giant ? 46 : 24 });
    if (giant) clusters.push({ c: mid.clone().add(new THREE.Vector3(0, L * 0.1, 0)), r: height * 0.07, n: 16 });
  }
  // racines aériennes
  if (giant) for (let k = 0; k < 9; k++) {
    const v = 0.08 + R() * 0.2, o = trunkCurve.getPointAt(v), a = R() * Math.PI * 2;
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const s = o.clone().addScaledVector(out, radius(v) * 0.9);
    const e = o.clone().addScaledVector(out, 3 + R() * 5); e.y = -0.4;
    const m = s.clone().lerp(e, 0.4).add(new THREE.Vector3(0, 1.2 + R(), 0)).addScaledVector(out, 1);
    parts.push(tube(new THREE.QuadraticBezierCurve3(s, m, e), 10, 6, (t) => (0.18 + R() * 0.04) * (1 - t * 0.5) * baseR, 2, 0.15, 2, 1));
  }
  const trunk = mergeGeometries(parts)!;
  const leaves = leafCards(clusters, giant ? 4.2 : 3.2, R);
  return { trunk, leaves, height, radius: baseR };
}

// ---------- rochers ----------
function makeRock(seed: number) {
  const g = new THREE.IcosahedronGeometry(1, 4);
  const p = g.attributes.position, R = rng(seed), sx = 1 + R() * 0.8, sz = 0.8 + R() * 0.6;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const n = fbm(v.x * 1.3 + seed, v.y * 1.3 + v.z * 0.7, 4) * 0.35 + fbm(v.x * 4 + seed, v.z * 4, 2) * 0.08;
    v.multiplyScalar(1 + n); v.x *= sx; v.z *= sz; v.y *= 0.62; if (v.y < -0.25) v.y = -0.25 + (v.y + 0.25) * 0.3;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export interface FloraStats { trees: number; ferns: number; glow: number; rocks: number }

export class Flora {
  group = new THREE.Group();
  glowMaterials = glowMats;
  stats: FloraStats = { trees: 0, ferns: 0, glow: 0, rocks: 0 };
  /** positions des troncs (pour les lucioles, les rayons de lumière) */
  trunks: THREE.Vector3[] = [];

  constructor(t: Terrain, ph: Physics, res: '1k' | '2k', density: number, shadows: boolean) {
    const R = rng(7);
    const occupied: { x: number; z: number; r: number }[] = [];
    const free = (x: number, z: number, r: number) => occupied.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r);
    const inWater = (x: number, z: number) => { const ri = t.riverInfo(x, z); return ri.d < ri.width / 2 + 2; };
    const nearSpawn = (x: number, z: number, r: number) => Math.hypot(x - SPAWN.x, z - SPAWN.y) < r || Math.hypot(x - BEACON.x, z - BEACON.y) < 14 || inHQZone(x, z, r > 10 ? 4 : 0);
    const slope = (x: number, z: number) => 1 - t.normalAt(x, z).y;
    const bark = barkMat(res);
    const leafA = leafTextures(3, 168), leafB = leafTextures(11, 200), leafC = leafTextures(23, 280);
    const fmA = foliageMat(leafA.map, leafA.glow, 0x3dffd0), fmB = foliageMat(leafB.map, leafB.glow, 0x6fd8ff), fmC = foliageMat(leafC.map, leafC.glow, 0xc07bff);
    const kinds: { k: TreeKind; mat: THREE.Material; giant: boolean }[] = [
      { k: makeTree(1, 30, 1.25, true), mat: fmA, giant: true }, { k: makeTree(2, 36, 1.45, true), mat: fmB, giant: true }, { k: makeTree(3, 26, 1.1, true), mat: fmA, giant: true },
      { k: makeTree(4, 14, 0.45, false), mat: fmC, giant: false }, { k: makeTree(5, 11, 0.38, false), mat: fmB, giant: false }, { k: makeTree(6, 17, 0.5, false), mat: fmA, giant: false },
    ];
    const placements: { kind: number; m: THREE.Matrix4 }[] = [];
    const place = (kind: number, x: number, z: number, scale: number) => {
      const y = t.heightAt(x, z) - 0.3;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * Math.PI * 2, 0)), new THREE.Vector3(scale, scale, scale));
      placements.push({ kind, m });
      const rr = kinds[kind].k.radius * scale;
      occupied.push({ x, z, r: kinds[kind].giant ? 7 * scale : 3 * scale });
      ph.add([x - rr * 1.1, y, z - rr * 1.1], [x + rr * 1.1, y + kinds[kind].k.height * scale * 0.8, z + rr * 1.1], { camera: false });
      this.trunks.push(new THREE.Vector3(x, y, z));
    };
    // géants dans la forêt, arbres moyens à l'orée et quelques solitaires dans la plaine
    for (let i = 0; i < 2600; i++) {
      const x = (R() - 0.5) * (SIZE - 16), z = (R() - 0.5) * (SIZE - 16);
      const f = t.sample(t.f.forest, x, z);
      if (inWater(x, z) || nearSpawn(x, z, 16) || slope(x, z) > 0.35) continue;
      if (f > 0.65 && R() < 0.5 * density && free(x, z, 6)) place(R() * 3 | 0, x, z, 0.85 + R() * 0.45);
      else if (f > 0.25 && f <= 0.75 && R() < 0.35 * density && free(x, z, 3)) place(3 + (R() * 3 | 0), x, z, 0.8 + R() * 0.5);
      else if (f <= 0.25 && R() < 0.012 * density && free(x, z, 8)) place(3 + (R() * 3 | 0), x, z, 0.9 + R() * 0.4);
    }
    kinds.forEach((kd, ki) => {
      const ms = placements.filter((p) => p.kind === ki);
      if (!ms.length) return;
      const tr = new THREE.InstancedMesh(kd.k.trunk, bark, ms.length);
      const lv = new THREE.InstancedMesh(kd.k.leaves, kd.mat, ms.length);
      ms.forEach((p, i) => { tr.setMatrixAt(i, p.m); lv.setMatrixAt(i, p.m); });
      tr.castShadow = shadows; tr.receiveShadow = true; lv.castShadow = shadows; lv.receiveShadow = true;
      tr.computeBoundingSphere(); lv.computeBoundingSphere();
      this.group.add(tr, lv);
    });
    this.stats.trees = placements.length;

    // fougères (cartes pliées en rosette)
    const ft = fernTex();
    const fernM = foliageMat(ft.map, ft.glow, 0x5effc8);
    const fernG = (() => {
      const parts: THREE.BufferGeometry[] = [];
      for (let k = 0; k < 7; k++) {
        const g = new THREE.PlaneGeometry(0.55, 1.3, 1, 4); g.translate(0, 0.65, 0);
        const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, y * y * 0.35); }
        g.rotateX(-0.6); g.rotateY((k / 7) * Math.PI * 2);
        g.computeVertexNormals(); parts.push(g);
      }
      return mergeGeometries(parts)!;
    })();
    const fernM4: THREE.Matrix4[] = [];
    for (let i = 0; i < 9000 && fernM4.length < 900 * density; i++) {
      const x = (R() - 0.5) * SIZE * 0.96, z = (R() - 0.5) * SIZE * 0.96, f = t.sample(t.f.forest, x, z);
      if (inWater(x, z) || nearSpawn(x, z, 5) || R() > f * 0.9 + 0.05) continue;
      const s = 0.7 + R() * 1.1;
      fernM4.push(new THREE.Matrix4().compose(new THREE.Vector3(x, t.heightAt(x, z) - 0.05, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6.3, 0)), new THREE.Vector3(s, s, s)));
    }
    const ferns = new THREE.InstancedMesh(fernG, fernM, fernM4.length); fernM4.forEach((m, i) => ferns.setMatrixAt(i, m));
    ferns.receiveShadow = true; ferns.castShadow = false; this.group.add(ferns); this.stats.ferns = fernM4.length;

    // champignons lumineux (pied + chapeau) et fleurs-lanternes
    const shroomG = mergeGeometries([new THREE.CylinderGeometry(0.035, 0.05, 0.3, 6).translate(0, 0.15, 0), new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1).translate(0, 0.29, 0)])!;
    const flowerG = mergeGeometries([new THREE.CylinderGeometry(0.012, 0.018, 0.6, 4).translate(0, 0.3, 0), new THREE.SphereGeometry(0.07, 8, 6).scale(1, 1.4, 1).translate(0, 0.64, 0)])!;
    const sets: { g: THREE.BufferGeometry; col: number; n: number; where: (f: number, x: number, z: number) => boolean; s: [number, number] }[] = [
      { g: shroomG, col: 0x3fe6ff, n: 700, where: (f) => f > 0.4, s: [0.6, 1.8] },
      { g: shroomG, col: 0xb06bff, n: 400, where: (f) => f > 0.55, s: [0.8, 2.4] },
      { g: flowerG, col: 0x7dffb0, n: 700, where: (f, x, z) => f < 0.5 && t.sample(t.f.grass, x, z) > 0.3, s: [0.7, 1.4] },
      { g: flowerG, col: 0xffb85a, n: 300, where: (f, x, z) => f < 0.35 && t.sample(t.f.grass, x, z) > 0.4, s: [0.8, 1.5] },
    ];
    for (const st of sets) {
      const mats: THREE.Matrix4[] = [];
      for (let i = 0; i < st.n * 12 && mats.length < st.n * density; i++) {
        // en grappes
        const cx = (R() - 0.5) * SIZE * 0.95, cz = (R() - 0.5) * SIZE * 0.95;
        const f = t.sample(t.f.forest, cx, cz);
        if (!st.where(f, cx, cz) || inWater(cx, cz) || nearSpawn(cx, cz, 3)) continue;
        const n = 3 + (R() * 6 | 0);
        for (let k = 0; k < n; k++) {
          const x = cx + (R() - 0.5) * 2.5, z = cz + (R() - 0.5) * 2.5, s = st.s[0] + R() * (st.s[1] - st.s[0]);
          mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, t.heightAt(x, z) - 0.03, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.3, R() * 6, (R() - 0.5) * 0.3)), new THREE.Vector3(s, s, s)));
        }
      }
      const im = new THREE.InstancedMesh(st.g, glowMat(st.col, 0.15), mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m));
      this.group.add(im); this.stats.glow += mats.length;
    }

    // rochers
    const rp = pbr('mossy_rock', res);
    const rockMat = new THREE.MeshStandardMaterial({ map: rp.map, normalMap: rp.normalMap, roughnessMap: rp.arm, aoMap: rp.arm, color: 0xa4a0ac, roughness: 1 });
    const rockGs = [0, 1, 2, 3].map((s) => makeRock(s * 7 + 3));
    const rockSets: THREE.Matrix4[][] = [[], [], [], []];
    for (let i = 0; i < 1400; i++) {
      const x = (R() - 0.5) * SIZE * 0.96, z = (R() - 0.5) * SIZE * 0.96;
      const ri = t.riverInfo(x, z), sl = slope(x, z), f = t.sample(t.f.forest, x, z);
      const want = ri.d < ri.width / 2 + 6 ? 0.25 : sl > 0.3 ? 0.18 : f > 0.5 ? 0.05 : 0.025;
      if (R() > want || nearSpawn(x, z, 6)) continue;
      const big = R() < 0.22;
      const s = big ? 1.4 + R() * 2.6 : 0.3 + R() * 0.8;
      if (big && !free(x, z, s)) continue;
      const y = t.heightAt(x, z) - s * 0.25;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.3, R() * 6.3, (R() - 0.5) * 0.3)), new THREE.Vector3(s, s, s));
      rockSets[i % 4].push(m);
      if (big) { ph.add([x - s * 0.9, y - s, z - s * 0.7], [x + s * 0.9, y + s * 0.55, z + s * 0.7], { camera: false }); occupied.push({ x, z, r: s }); }
    }
    rockSets.forEach((ms, k) => {
      if (!ms.length) return;
      const im = new THREE.InstancedMesh(rockGs[k], rockMat, ms.length); ms.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = shadows; im.receiveShadow = true; this.group.add(im); this.stats.rocks += ms.length;
    });
    // cailloux et branches mortes
    const pebG = new THREE.DodecahedronGeometry(0.08, 0);
    const pebM: THREE.Matrix4[] = [];
    for (let i = 0; i < 2400 * density; i++) {
      const x = (R() - 0.5) * SIZE * 0.96, z = (R() - 0.5) * SIZE * 0.96, s = 0.5 + R() * 1.6;
      pebM.push(new THREE.Matrix4().compose(new THREE.Vector3(x, t.heightAt(x, z) - 0.02, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3)), new THREE.Vector3(s, s * 0.6, s)));
    }
    const peb = new THREE.InstancedMesh(pebG, rockMat, pebM.length); pebM.forEach((m, i) => peb.setMatrixAt(i, m)); peb.receiveShadow = true; this.group.add(peb);
    const twig = tube(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1, 0.05, 0), new THREE.Vector3(0, 0.18, 0.2), new THREE.Vector3(1.2, 0.04, -0.1)), 6, 5, (v) => 0.06 * (1 - v * 0.6));
    const twM: THREE.Matrix4[] = [];
    for (let i = 0; i < 3000 && twM.length < 260 * density; i++) {
      const x = (R() - 0.5) * SIZE * 0.96, z = (R() - 0.5) * SIZE * 0.96;
      if (R() > t.sample(t.f.forest, x, z)) continue;
      const s = 0.6 + R() * 1.4;
      twM.push(new THREE.Matrix4().compose(new THREE.Vector3(x, t.heightAt(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6.3, 0)), new THREE.Vector3(s, s, s)));
    }
    const tw = new THREE.InstancedMesh(twig, bark, twM.length); twM.forEach((m, i) => tw.setMatrixAt(i, m)); tw.castShadow = shadows; tw.receiveShadow = true; this.group.add(tw);
    void smooth;
  }

  /** La nuit : bioluminescence. */
  update(night: number) {
    for (const m of this.glowMaterials) {
      const s = m as THREE.MeshStandardMaterial;
      if (s.userData.glowBase !== undefined) s.emissiveIntensity = s.userData.glowBase + night * 4.5;
      else s.emissiveIntensity = night * 1.1;
    }
  }
}
