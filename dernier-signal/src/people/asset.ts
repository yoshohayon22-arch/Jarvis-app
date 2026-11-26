import * as THREE from 'three';
import type { Body } from '../species/sdf';

// Chargement des corps fabriqués par tools/build_people.py : géométrie, squelette du jeu,
// formes (âge, sexe, carrure) et expressions du visage en morph targets.

type V3 = [number, number, number];
interface MorphMeta { name: string; n: number; scale: number; joints: V3[]; eyes: V3[]; data: string }
interface Meta {
  name: string; verts: number; tris: number; eyeR: number; bones: { name: string; parent: string | null }[];
  joints: V3[]; eyes: V3[]; data: string; morphs: MorphMeta[]; tail?: [number, number]; ears?: boolean; fourEyes?: boolean;
}

export interface PeopleAsset {
  meta: Meta;
  geo: THREE.BufferGeometry;          // géométrie partagée par toutes les figures de ce corps
  index: Record<string, number>;       // nom de forme → numéro
  base: Float32Array;                  // positions de repos
  skin: { idx: Uint8Array; w: Uint8Array };
  height: number;
}

const cache = new Map<string, Promise<PeopleAsset>>();
function bytesOf(b64: string) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }

export function loadPeople(id: string) {
  if (!cache.has(id)) cache.set(id, load(id));
  return cache.get(id)!;
}

async function load(id: string): Promise<PeopleAsset> {
  const meta = await (await fetch(import.meta.env.BASE_URL + 'assets/people/' + id + '.json')).json() as Meta;
  const buf = bytesOf(meta.data), n = meta.verts, t = meta.tris;
  let off = 0;
  const pos = new Float32Array(buf.slice(off, off + n * 12)); off += n * 12;
  const tri = new Uint16Array(buf.slice(off, off + t * 6)); off += t * 6;
  const si = new Uint8Array(buf, off, n * 4); off += n * 4;
  const sw = new Uint8Array(buf, off, n * 4);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(tri, 1));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from(si), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from(sw, (v) => v / 255), 4));
  g.computeVertexNormals();
  const baseN = (g.attributes.normal.array as Float32Array);
  // formes : écarts de position et de normale
  const mp: THREE.BufferAttribute[] = [], mn: THREE.BufferAttribute[] = [];
  const tmp = new THREE.BufferGeometry(); tmp.setIndex(g.index);
  const index: Record<string, number> = {};
  meta.morphs.forEach((m, k) => {
    const b = bytesOf(m.data);
    const sel = new Uint16Array(b, 0, m.n), q = new Int16Array(b, m.n * 2, m.n * 3);
    const d = new Float32Array(n * 3);
    for (let i = 0; i < m.n; i++) { const v = sel[i] * 3; d[v] = q[i * 3] * m.scale; d[v + 1] = q[i * 3 + 1] * m.scale; d[v + 2] = q[i * 3 + 2] * m.scale; }
    const p2 = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) p2[i] = pos[i] + d[i];
    tmp.setAttribute('position', new THREE.BufferAttribute(p2, 3)); tmp.deleteAttribute('normal'); tmp.computeVertexNormals();
    const n2 = tmp.attributes.normal.array as Float32Array, dn = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) dn[i] = n2[i] - baseN[i];
    mp.push(new THREE.BufferAttribute(d, 3)); mn.push(new THREE.BufferAttribute(dn, 3));
    index[m.name] = k;
  });
  g.morphAttributes.position = mp; g.morphAttributes.normal = mn; g.morphTargetsRelative = true;
  // courbure (arêtes convexes / creux) et sens du brossage (le long des membres)
  g.setAttribute('aCurv', new THREE.BufferAttribute(curvature(pos, baseN, tri, n), 1));
  g.setAttribute('tangent', new THREE.BufferAttribute(brushDir(meta, pos, baseN, si, n), 4));
  let h = 0; for (let i = 1; i < n * 3; i += 3) h = Math.max(h, pos[i]);
  return { meta, geo: g, index, base: pos, skin: { idx: si, w: sw }, height: h };
}

function curvature(pos: Float32Array, nrm: Float32Array, tri: Uint16Array, n: number) {
  const sum = new Float32Array(n * 3), cnt = new Float32Array(n), el = new Float32Array(n);
  for (let i = 0; i < tri.length; i += 3) for (let e = 0; e < 3; e++) {
    const a = tri[i + e], b = tri[i + (e + 1) % 3];
    for (const [x, y] of [[a, b], [b, a]]) { for (let c = 0; c < 3; c++) sum[x * 3 + c] += pos[y * 3 + c]; cnt[x]++; el[x] += Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2]); }
  }
  let k = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!cnt[i]) continue;
    const dx = pos[i * 3] - sum[i * 3] / cnt[i], dy = pos[i * 3 + 1] - sum[i * 3 + 1] / cnt[i], dz = pos[i * 3 + 2] - sum[i * 3 + 2] / cnt[i];
    k[i] = (dx * nrm[i * 3] + dy * nrm[i * 3 + 1] + dz * nrm[i * 3 + 2]) / (el[i] / cnt[i] + 1e-6);
  }
  // lissage puis normalisation
  for (let it = 0; it < 2; it++) {
    const s2 = new Float32Array(n), c2 = new Float32Array(n);
    for (let i = 0; i < tri.length; i += 3) for (let e = 0; e < 3; e++) { const a = tri[i + e], b = tri[i + (e + 1) % 3]; s2[a] += k[b]; c2[a]++; s2[b] += k[a]; c2[b]++; }
    const k2 = new Float32Array(n); for (let i = 0; i < n; i++) k2[i] = (k[i] + s2[i]) / (1 + c2[i]);
    k = k2;
  }
  for (let i = 0; i < n; i++) k[i] = Math.tanh(k[i] * 6);
  return k;
}

function brushDir(meta: Meta, pos: Float32Array, nrm: Float32Array, si: Uint8Array, n: number) {
  const names = meta.bones.map((b) => b.name);
  const child: Record<string, string> = {};
  meta.bones.forEach((b) => { if (b.parent && !child[b.parent]) child[b.parent] = b.name; });
  child.chest = 'neck';
  const dirs = names.map((nm, i) => {
    const c = child[nm];
    const a = meta.joints[i];
    if (!c) return new THREE.Vector3(0, 1, 0);
    const b = meta.joints[names.indexOf(c)];
    return new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  });
  const t = new Float32Array(n * 4), v = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.set(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]);
    d.copy(dirs[si[i * 4]]);
    d.sub(v.clone().multiplyScalar(d.dot(v)));
    if (d.lengthSq() < 1e-6) d.set(1, 0, 0);
    d.normalize();
    t[i * 4] = d.x; t[i * 4 + 1] = d.y; t[i * 4 + 2] = d.z; t[i * 4 + 3] = 1;
  }
  void pos;
  return t;
}

// ---------- une figure ----------
export const BODY_MORPHS = ['homme', 'femme', 'enfant', 'ancien', 'muscle', 'corpulent', 'mince'];
export const FACES = ['sourire', 'colere', 'tristesse', 'peur', 'surprise', 'degout', 'reflexion'] as const;
export type Face = 'neutre' | typeof FACES[number];

export interface Figure {
  asset: PeopleAsset;
  mesh: THREE.SkinnedMesh;
  body: Body;
  shape: Record<string, number>;
  joints: THREE.Vector3[];        // articulations de repos pour la forme actuelle
  eyes: THREE.Vector3[];
  eyeObjs: THREE.Object3D[];
  face: Record<string, number>;   // poids visés des expressions
  faceNow: Record<string, number>;
  blink: { t: number; v: number };
  talk: { on: boolean; t: number; target: string; w: number };
  onShape: (() => void)[];
}

export function makeFigure(asset: PeopleAsset, material: THREE.Material, cloth?: Float32Array): Figure {
  const src = asset.geo, g = new THREE.BufferGeometry();
  for (const k of Object.keys(src.attributes)) g.setAttribute(k, src.attributes[k]);
  g.setIndex(src.index); g.morphAttributes = src.morphAttributes; g.morphTargetsRelative = true;
  g.setAttribute('aCloth', new THREE.BufferAttribute(cloth ?? new Float32Array(asset.meta.verts * 2), 2));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, asset.height / 2, 0), asset.height);
  const meta = asset.meta;
  const bones: Record<string, THREE.Bone> = {}, rest: Record<string, THREE.Vector3> = {}, order: THREE.Bone[] = [];
  let root: THREE.Bone | null = null;
  meta.bones.forEach((b) => { const bo = new THREE.Bone(); bo.name = b.name; bones[b.name] = bo; order.push(bo); });
  meta.bones.forEach((b) => { if (b.parent) bones[b.parent].add(bones[b.name]); else root = bones[b.name]; });
  const mesh = new THREE.SkinnedMesh(g, material);
  mesh.add(root!); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.skeleton = new THREE.Skeleton(order);
  const body: Body = { mesh, bones, root: root!, rest };
  const fig: Figure = {
    asset, mesh, body, shape: {}, joints: meta.joints.map((j) => new THREE.Vector3(...j)), eyes: meta.eyes.map((e) => new THREE.Vector3(...e)), eyeObjs: [],
    face: {}, faceNow: {}, blink: { t: 2, v: 0 }, talk: { on: false, t: 0, target: 'v_a', w: 0 }, onShape: [],
  };
  setShape(fig, {});
  return fig;
}

/** Change la silhouette (âge, sexe, carrure) : formes + articulations replacées. */
export function setShape(fig: Figure, shape: Record<string, number>) {
  const { asset, mesh, body } = fig, meta = asset.meta;
  fig.shape = { ...shape };
  const inf = mesh.morphTargetInfluences!;
  for (const nm of BODY_MORPHS) { const k = asset.index[nm]; if (k !== undefined) inf[k] = shape[nm] ?? 0; }
  fig.joints = meta.joints.map((j, i) => {
    const v = new THREE.Vector3(...j);
    for (const nm of BODY_MORPHS) { const w = shape[nm]; const k = asset.index[nm]; if (w && k !== undefined) { const d = meta.morphs[k].joints[i]; v.x += d[0] * w; v.y += d[1] * w; v.z += d[2] * w; } }
    return v;
  });
  fig.eyes = meta.eyes.map((e, i) => {
    const v = new THREE.Vector3(...e);
    for (const nm of BODY_MORPHS) { const w = shape[nm]; const k = asset.index[nm]; if (w && k !== undefined) { const d = meta.morphs[k].eyes[i]; v.x += d[0] * w; v.y += d[1] * w; v.z += d[2] * w; } }
    return v;
  });
  // repose des os : rotations à zéro, nouvelles positions, nouveau liage
  const saved = mesh.skeleton.bones.map((b) => b.quaternion.clone());
  meta.bones.forEach((b, i) => {
    const bo = body.bones[b.name];
    bo.quaternion.identity();
    const p = fig.joints[i];
    if (b.parent) bo.position.copy(p).sub(fig.joints[meta.bones.findIndex((x) => x.name === b.parent)]);
    else bo.position.copy(p);
    body.rest[b.name] = p.clone();
  });
  mesh.updateMatrixWorld(true);
  mesh.skeleton.calculateInverses();
  mesh.bind(mesh.skeleton, mesh.matrixWorld);
  mesh.skeleton.bones.forEach((b, i) => b.quaternion.copy(saved[i]));
  for (const f of fig.onShape) f();
}

/** Position de repos d'un sommet pour la forme actuelle (pour les cheveux et les particules). */
export function restPositions(fig: Figure) {
  const { asset } = fig, n = asset.meta.verts, out = new Float32Array(asset.base);
  for (const nm of BODY_MORPHS) {
    const w = fig.shape[nm], k = asset.index[nm];
    if (!w || k === undefined) continue;
    const d = asset.geo.morphAttributes.position![k].array as Float32Array;
    for (let i = 0; i < n * 3; i++) out[i] += d[i] * w;
  }
  return out;
}

export function boneIndex(asset: PeopleAsset, name: string) { return asset.meta.bones.findIndex((b) => b.name === name); }

/** Expressions : mélange doux, clignements, parole. */
export function updateFace(fig: Figure, dt: number) {
  const { asset, mesh } = fig, inf = mesh.morphTargetInfluences!;
  const k = 1 - Math.exp(-dt * 7);
  for (const nm of FACES) {
    const want = fig.face[nm] ?? 0;
    const cur = (fig.faceNow[nm] ?? 0) + (want - (fig.faceNow[nm] ?? 0)) * k;
    fig.faceNow[nm] = cur;
    const i = asset.index[nm]; if (i !== undefined) inf[i] = cur;
  }
  // clignement
  const b = fig.blink; b.t -= dt;
  if (b.t < 0) { b.v = 1; b.t = 2.2 + Math.random() * 3.5; }
  b.v = Math.max(0, b.v - dt * 7);
  const blink = b.v > 0.5 ? (1 - b.v) * 2 : b.v * 2;
  for (const s of ['cligne_g', 'cligne_d']) { const i = asset.index[s]; if (i !== undefined) inf[i] = blink * (1 - (fig.faceNow.surprise ?? 0) * 0.6); }
  // parole : formes de bouche enchaînées
  const tk = fig.talk;
  tk.w += ((tk.on ? 1 : 0) - tk.w) * k;
  tk.t -= dt;
  if (tk.t < 0) { tk.t = 0.07 + Math.random() * 0.12; const v = ['v_a', 'v_o', 'v_e', 'v_m', 'v_a', 'v_e']; tk.target = v[Math.floor(Math.random() * v.length)]; }
  for (const s of ['v_a', 'v_o', 'v_e', 'v_m']) {
    const i = asset.index[s]; if (i === undefined) continue;
    inf[i] += ((s === tk.target ? 0.85 * tk.w : 0) - inf[i]) * (1 - Math.exp(-dt * 18));
  }
}
