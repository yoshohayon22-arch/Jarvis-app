import * as THREE from 'three';
import { pbr } from '../core/textures';
import type { Body } from './sdf';

// Armures et vêtements des Vaëls.
// Chaque pièce est découpée dans la peau elle-même (zone choisie par os et par hauteur),
// gonflée de quelques millimètres et animée par le même squelette : elle épouse le corps.
// Matières Poly Haven (CC0) appliquées en projection sur trois axes, avec plaques optionnelles.

type V3 = [number, number, number];
export interface VInfo { p: THREE.Vector3; w: Record<string, number> }
export type Region = (v: VInfo) => number; // 0 = hors pièce, 1 = dans la pièce

export interface ArmorMat {
  tex: string;               // texture Poly Haven
  tint?: THREE.ColorRepresentation;
  scale?: number;            // répétitions par mètre
  rough?: number;
  metal?: number;
  plates?: number;           // rangées de plaques par mètre (0 = matière continue)
  seam?: THREE.ColorRepresentation;
  sheen?: number;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function armorMaterial(o: ArmorMat) {
  const key = JSON.stringify(o);
  let m = matCache.get(key);
  if (m) return m;
  const set = pbr(o.tex, '1k', 1);
  for (const t of [set.map, set.normalMap, set.arm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  m = new THREE.MeshPhysicalMaterial({ color: o.tint ?? 0xffffff, roughness: o.rough ?? 1, metalness: o.metal ?? 0, sheen: o.sheen ?? 0, sheenColor: new THREE.Color(0x8a7a66), sheenRoughness: 0.6 });
  const u = {
    aMap: { value: set.map }, aNor: { value: set.normalMap }, aArm: { value: set.arm },
    aScale: { value: o.scale ?? 3 }, aPlates: { value: o.plates ?? 0 }, aSeam: { value: new THREE.Color(o.seam ?? 0x000000) },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aEdge;\nvarying vec3 vRP; varying vec3 vRN; varying float vEdge;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRP = position; vRN = normal; vEdge = aEdge;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D aMap, aNor, aArm; uniform float aScale, aPlates; uniform vec3 aSeam;
varying vec3 vRP; varying vec3 vRN; varying float vEdge;
vec3 triW(vec3 n){ vec3 w = pow(abs(n), vec3(4.0)); return w / (w.x + w.y + w.z); }
float ah(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float plateRow = 0.0; float plateEdge = 1.0; float plateId = 0.0;`)
      .replace('#include <map_fragment>', `
vec3 tw = triW(vRN);
vec3 tp = vRP * aScale;
if (aPlates > 0.0) {
  // plaques qui se chevauchent : rangées horizontales, décalées une sur deux, bord arrondi en bas
  float r = vRP.y * aPlates;
  float row = floor(r); float fr = fract(r);
  float ang = atan(vRP.x, vRP.z) / 6.2831 * aPlates * 3.0 + row * 0.5;
  float col = floor(ang); float fc = fract(ang) - 0.5;
  float bottom = 0.18 + 0.25 * fc * fc;
  plateEdge = smoothstep(bottom - 0.05, bottom + 0.04, fr) * smoothstep(0.5, 0.42, abs(fc));
  plateId = ah(vec3(row, col, 3.0));
  tp += vec3(plateId * 7.0, row * 3.1, col * 1.7);
}
vec4 texelColor = texture2D(aMap, tp.zy) * tw.x + texture2D(aMap, tp.xz) * tw.y + texture2D(aMap, tp.xy) * tw.z;
diffuseColor *= texelColor;
diffuseColor.rgb *= 0.85 + 0.3 * plateId * step(0.001, aPlates);
diffuseColor.rgb = mix(aSeam, diffuseColor.rgb, 0.35 + 0.65 * plateEdge);
diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 0.35, vEdge)); // bords usés et salis`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness;
vec4 armT = texture2D(aArm, tp.zy) * tw.x + texture2D(aArm, tp.xz) * tw.y + texture2D(aArm, tp.xy) * tw.z;
roughnessFactor *= armT.g;`)
      .replace('#include <metalnessmap_fragment>', `float metalnessFactor = metalness * armT.b;`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
reflectedLight.indirectDiffuse *= mix(1.0, armT.r, 0.8);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  // relief de la texture : normales des trois projections mêlées, reportées sur la normale animée
  vec3 nx = texture2D(aNor, tp.zy).xyz * 2.0 - 1.0, ny = texture2D(aNor, tp.xz).xyz * 2.0 - 1.0, nz = texture2D(aNor, tp.xy).xyz * 2.0 - 1.0;
  vec3 rn = normalize(vRN);
  vec3 bx = vec3(0.0, nx.y, nx.x), by = vec3(ny.x, 0.0, ny.y), bz = vec3(nz.x, nz.y, 0.0);
  vec3 dN = bx * tw.x + by * tw.y + bz * tw.z;
  if (aPlates > 0.0) dN.y += (1.0 - plateEdge) * 1.6;
  normal = normalize(normal + mat3(viewMatrix) * dN * 0.9);
}`);
  };
  m.customProgramCacheKey = () => 'armor';
  matCache.set(key, m);
  return m;
}

/** Infos par sommet de la peau : position de repos et poids par os (noms). */
export function vertexInfo(body: Body): VInfo[] {
  const g = body.mesh.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const names = body.mesh.skeleton.bones.map((b) => b.name);
  const out: VInfo[] = [];
  for (let i = 0; i < pos.count; i++) {
    const w: Record<string, number> = {};
    for (let k = 0; k < 4; k++) { const wt = sw.getComponent(i, k); if (wt > 0) { const n = names[si.getComponent(i, k)]; w[n] = (w[n] ?? 0) + wt; } }
    out.push({ p: new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)), w });
  }
  return out;
}

/** Une pièce d'armure découpée dans la peau. */
export function garment(body: Body, info: VInfo[], region: Region, thick: number, mat: THREE.Material, smooth = 6) {
  const g = body.mesh.geometry, idx = g.index!, pos = g.attributes.position, nor = g.attributes.normal;
  const inside = info.map(region);
  const keep: number[] = [];
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    if (inside[a] > 0.5 && inside[b] > 0.5 && inside[c] > 0.5) keep.push(a, b, c);
  }
  if (!keep.length) return null;
  const map = new Map<number, number>(), order: number[] = [];
  for (const v of keep) if (!map.has(v)) { map.set(v, order.length); order.push(v); }
  // bords de la pièce : arêtes qui n'appartiennent qu'à un triangle
  const edgeCount = new Map<string, number>();
  for (let t = 0; t < keep.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = keep[t + e], b = keep[t + (e + 1) % 3], k = a < b ? a + '_' + b : b + '_' + a;
    edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
  }
  const border = new Set<number>();
  for (const [k, c] of edgeCount) if (c === 1) { const [a, b] = k.split('_').map(Number); border.add(a); border.add(b); }
  // distance au bord (en sauts) pour épaissir le milieu et rentrer les bords dans la peau
  const nb = new Map<number, number[]>();
  for (let t = 0; t < keep.length; t += 3) for (let e = 0; e < 3; e++) { const a = keep[t + e], b = keep[t + (e + 1) % 3]; (nb.get(a) ?? nb.set(a, []).get(a)!).push(b); }
  const dist = new Map<number, number>();
  let front = [...border]; for (const v of front) dist.set(v, 0);
  for (let d = 1; d <= 4 && front.length; d++) { const nf: number[] = []; for (const v of front) for (const u of nb.get(v) ?? []) if (!dist.has(u)) { dist.set(u, d); nf.push(u); } front = nf; }
  const n = order.length;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), E = new Float32Array(n);
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  order.forEach((v, i) => {
    const e = Math.min(1, (dist.get(v) ?? 4) / 3);
    const off = thick * (0.25 + 0.75 * e);
    P[i * 3] = pos.getX(v) + nor.getX(v) * off; P[i * 3 + 1] = pos.getY(v) + nor.getY(v) * off; P[i * 3 + 2] = pos.getZ(v) + nor.getZ(v) * off;
    N[i * 3] = nor.getX(v); N[i * 3 + 1] = nor.getY(v); N[i * 3 + 2] = nor.getZ(v);
    E[i] = e;
    for (let k = 0; k < 4; k++) { SI[i * 4 + k] = si.getComponent(v, k); SW[i * 4 + k] = sw.getComponent(v, k); }
  });
  // lissage : la pièce prend sa propre forme (cuirasse rigide, tissu tendu) au lieu de suivre chaque muscle,
  // puis on la repousse hors de la peau là où elle s'y enfoncerait
  const loc = new Map<number, number>(); order.forEach((v, i) => loc.set(v, i));
  const nbl: number[][] = order.map((v) => [...new Set((nb.get(v) ?? []).map((u) => loc.get(u)!))]);
  const T = new Float32Array(P.length);
  for (let it = 0; it < smooth; it++) {
    for (let i = 0; i < n; i++) {
      const L = nbl[i];
      if (!L.length || border.has(order[i])) { T[i * 3] = P[i * 3]; T[i * 3 + 1] = P[i * 3 + 1]; T[i * 3 + 2] = P[i * 3 + 2]; continue; }
      let x = 0, y = 0, z = 0; for (const j of L) { x += P[j * 3]; y += P[j * 3 + 1]; z += P[j * 3 + 2]; }
      x /= L.length; y /= L.length; z /= L.length;
      T[i * 3] = P[i * 3] + (x - P[i * 3]) * 0.6; T[i * 3 + 1] = P[i * 3 + 1] + (y - P[i * 3 + 1]) * 0.6; T[i * 3 + 2] = P[i * 3 + 2] + (z - P[i * 3 + 2]) * 0.6;
    }
    P.set(T);
    // jamais à l'intérieur de la peau : distance minimale le long de la normale
    for (let i = 0; i < n; i++) {
      const v = order[i], e = Math.min(1, (dist.get(v) ?? 4) / 3), minOff = thick * (0.2 + 0.6 * e);
      const nx = nor.getX(v), ny = nor.getY(v), nz = nor.getZ(v);
      const d = (P[i * 3] - pos.getX(v)) * nx + (P[i * 3 + 1] - pos.getY(v)) * ny + (P[i * 3 + 2] - pos.getZ(v)) * nz;
      if (d < minOff) { const k = minOff - d; P[i * 3] += nx * k; P[i * 3 + 1] += ny * k; P[i * 3 + 2] += nz * k; }
    }
  }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(P, 3));
  gg.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  gg.setAttribute('aEdge', new THREE.BufferAttribute(E, 1));
  gg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  gg.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  gg.setIndex(keep.map((v) => map.get(v)!));
  if (smooth > 0) { const restN = N.slice(); gg.computeVertexNormals(); gg.setAttribute('normal', new THREE.BufferAttribute((gg.attributes.normal.array as Float32Array), 3)); void restN; }
  const m = new THREE.SkinnedMesh(gg, mat);
  m.bind(body.mesh.skeleton, body.mesh.bindMatrix);
  m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
  body.mesh.add(m);
  return m;
}

// ---------- zones utiles ----------
const W = (v: VInfo, ...bones: string[]) => bones.reduce((s, b) => s + (v.w[b] ?? 0), 0);
const sm = (x: number, a: number, b: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const zones = {
  /** Torse, de la taille (fraction entre hanches et cou) jusqu'aux épaules. */
  torso: (P: Record<string, V3>, from = 0.15, to = 0.98, arms = false) => (v: VInfo) => {
    const y0 = P.hips[1] + (P.neck[1] - P.hips[1]) * from, y1 = P.hips[1] + (P.neck[1] - P.hips[1]) * to;
    const t = W(v, 'hips', 'spine', 'chest', 'neck') + (arms ? W(v, 'clavL', 'clavR') : W(v, 'clavL', 'clavR') * 0.5);
    return t > 0.55 && v.p.y > y0 && v.p.y < y1 ? 1 : 0;
  },
  /** Bassin et haut des cuisses (pagne, jupe courte, pantalon). */
  hips: (P: Record<string, V3>, down = 0.35, up = 0.12) => (v: VInfo) => {
    const legLen = P.hips[1] - P.shinL[1];
    const y0 = P.hips[1] - legLen * down, y1 = P.hips[1] + (P.neck[1] - P.hips[1]) * up;
    return W(v, 'hips', 'spine', 'thighL', 'thighR') > 0.5 && v.p.y > y0 && v.p.y < y1 ? 1 : 0;
  },
  /** Avant-bras (canons), de `a` à `b` (fraction coude → poignet). */
  forearm: (P: Record<string, V3>, a = 0.15, b = 0.9) => (v: VInfo) => {
    for (const s of ['L', 'R']) {
      if (W(v, 'fore' + s) < 0.6) continue;
      const e = new THREE.Vector3(...P['fore' + s]), w = new THREE.Vector3(...P['hand' + s]);
      const t = v.p.clone().sub(e).dot(w.clone().sub(e)) / e.distanceToSquared(w);
      if (t > a && t < b) return 1;
    }
    return 0;
  },
  /** Tibias (jambières), du genou à la cheville. */
  shin: (P: Record<string, V3>, a = 0.12, b = 0.92) => (v: VInfo) => {
    for (const s of ['L', 'R']) {
      if (W(v, 'shin' + s) < 0.6) continue;
      const k = new THREE.Vector3(...P['shin' + s]), f = new THREE.Vector3(...P['foot' + s]);
      const t = v.p.clone().sub(k).dot(f.clone().sub(k)) / k.distanceToSquared(f);
      if (t > a && t < b) return 1;
    }
    return 0;
  },
  /** Cuisses entières (pantalon). */
  thighs: (P: Record<string, V3>) => (v: VInfo) => (W(v, 'thighL', 'thighR') > 0.5 && v.p.y < P.hips[1] - 0.04 ? 1 : 0),
  /** Haut des bras. */
  upperArm: () => (v: VInfo) => (W(v, 'armL', 'armR') > 0.6 ? 1 : 0),
  /** Capuche : arrière et dessus du crâne, sans le visage. */
  hood: (eyes: V3[], P: Record<string, V3>) => (v: VInfo) => {
    const ez = (eyes[0][2] + eyes[1][2]) / 2, ey = (eyes[0][1] + eyes[1][1]) / 2;
    const h = W(v, 'head', 'neck');
    if (h < 0.5) return 0;
    if (v.p.y < P.neck[1]) return 0;
    const face = v.p.z > ez - 0.035 && v.p.y < ey + 0.06;
    return face ? 0 : 1;
  },
  sm,
};

/** Épaulière rigide accrochée à l'os du bras. */
export function pauldron(body: Body, P: Record<string, V3>, side: 'L' | 'R', mat: THREE.Material, size = 0.1, layers = 3) {
  const g = new THREE.Group();
  for (let i = 0; i < layers; i++) {
    const r = size * (1 - i * 0.12);
    const geo = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42);
    geo.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(1), 1));
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(1, 0.5, 1.1); m.position.set((side === 'L' ? 1 : -1) * i * size * 0.18, -i * size * 0.3, 0); m.rotation.z = (side === 'L' ? -1 : 1) * (0.35 + i * 0.18);
    m.castShadow = true; g.add(m);
  }
  const s = side === 'L' ? 1 : -1;
  const at = P['arm' + side];
  g.position.set(s * 0.025, 0.035, -0.005);
  const r = body.rest['arm' + side];
  g.position.add(new THREE.Vector3(at[0] - r.x, at[1] - r.y, at[2] - r.z));
  body.bones['arm' + side].add(g);
  return g;
}
export { sm };

function withEdge(g: THREE.BufferGeometry, f: (y: number) => number) {
  const p = g.attributes.position, e = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) e[i] = f(p.getY(i));
  g.setAttribute('aEdge', new THREE.BufferAttribute(e, 1));
  return g;
}

/** Jupe ou robe évasée, accrochée au bassin : elle cache la forme des hanches et des cuisses. */
export function skirt(body: Body, P: Record<string, V3>, mat: THREE.Material, o: { top: number; hem: number; length: number; depth?: number; y?: number; folds?: number }) {
  const pts: THREE.Vector2[] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N, r = o.top + (o.hem - o.top) * Math.pow(t, 0.8);
    pts.push(new THREE.Vector2(r, -t * o.length));
  }
  const g = new THREE.LatheGeometry(pts, 48);
  // plis : ondulation qui grandit vers le bas
  const pos = g.attributes.position, folds = o.folds ?? 9;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), a = Math.atan2(x, z), t = -y / o.length;
    const k = 1 + Math.sin(a * folds) * 0.06 * t;
    pos.setXYZ(i, x * k, y, z * k * (o.depth ?? 0.8));
  }
  g.computeVertexNormals();
  withEdge(g, (y) => 0.35 + 0.65 * Math.min(1, (-y) / (o.length * 0.15)) * Math.min(1, (o.length + y) / (o.length * 0.12) + 0.2));
  const m = new THREE.Mesh(g, mat);
  (mat as THREE.Material).side = THREE.DoubleSide;
  m.castShadow = true; m.receiveShadow = true;
  const r = body.rest.hips;
  m.position.set(P.hips[0] - r.x, P.hips[1] - r.y + (o.y ?? 0.06), P.hips[2] - r.z);
  body.bones.hips.add(m);
  return m;
}

/** Mantelet sur les épaules (cape courte), accroché au torse. */
export function mantle(body: Body, P: Record<string, V3>, mat: THREE.Material, o: { neck: number; spread: number; length: number; back?: number }) {
  const pts: THREE.Vector2[] = [];
  const N = 10;
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector2(o.neck + (o.spread - o.neck) * Math.sin(t * Math.PI / 2), -t * o.length)); }
  const g = new THREE.LatheGeometry(pts, 48);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    pos.setXYZ(i, x * 1.45, y - (z < 0 ? (o.back ?? 0) * (-y / o.length) : 0), z * 0.85 + 0.0);
  }
  g.computeVertexNormals();
  withEdge(g, (y) => 0.4 + 0.6 * Math.min(1, (o.length + y) / (o.length * 0.25) + 0.1));
  (mat as THREE.Material).side = THREE.DoubleSide;
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  const r = body.rest.chest;
  m.position.set(P.neck[0] - r.x, P.neck[1] - r.y + 0.035, P.neck[2] - r.z - 0.005);
  body.bones.chest.add(m);
  return m;
}
