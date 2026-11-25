import * as THREE from 'three';

// Fabrication des corps de créatures : la forme est décrite par des volumes simples
// (cônes arrondis, ellipsoïdes) fondus les uns dans les autres, comme de l'argile.
// On en tire une surface continue (« surface nets »), lissée, puis attachée au squelette :
// chaque point de peau suit les os des volumes les plus proches (poids doux aux jointures).

type V3 = [number, number, number];

export interface Prim {
  kind: 'cone' | 'ell';
  bone: string;          // os qui porte ce volume
  a: V3; b?: V3;         // cône : extrémités ; ellipsoïde : centre en a
  r1: number; r2?: number; // cône : rayons ; ellipsoïde : r = rayons xyz dans rad
  rad?: V3;
  k?: number;            // douceur de la fusion avec le reste (m)
  sub?: boolean;         // creuse au lieu d'ajouter (orbites, narines…)
  mask?: number;         // intensité des motifs lumineux sur ce volume (0-1)
  stiff?: number;        // influence de l'os (plus grand = attache plus fermement)
}

export interface Joint { name: string; parent: string | null; p: V3 }

function sdRoundCone(px: number, py: number, pz: number, a: V3, b: V3, r1: number, r2: number) {
  // Inigo Quilez, cône arrondi entre deux points
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y;
  const x2 = xx * xx + xy * xy + xz * xz;
  const y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
function sdEll(px: number, py: number, pz: number, c: V3, r: V3) {
  const x = (px - c[0]) / r[0], y = (py - c[1]) / r[1], z = (pz - c[2]) / r[2];
  const k0 = Math.sqrt(x * x + y * y + z * z);
  const x1 = x / r[0], y1 = y / r[1], z1 = z / r[2];
  const k1 = Math.sqrt(x1 * x1 + y1 * y1 + z1 * z1);
  return k0 * (k0 - 1) / Math.max(k1, 1e-6);
}
export function primDist(p: Prim, x: number, y: number, z: number) {
  return p.kind === 'cone' ? sdRoundCone(x, y, z, p.a, p.b!, p.r1, p.r2 ?? p.r1) : sdEll(x, y, z, p.a, p.rad!);
}
function smin(a: number, b: number, k: number) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
function smax(a: number, b: number, k: number) { return -smin(-a, -b, k); }

function primBox(p: Prim): [V3, V3] {
  const m = (p.k ?? 0.03) + 0.02;
  if (p.kind === 'ell') {
    const r = p.rad!;
    return [[p.a[0] - r[0] - m, p.a[1] - r[1] - m, p.a[2] - r[2] - m], [p.a[0] + r[0] + m, p.a[1] + r[1] + m, p.a[2] + r[2] + m]];
  }
  const R = Math.max(p.r1, p.r2 ?? p.r1) + m;
  return [
    [Math.min(p.a[0], p.b![0]) - R, Math.min(p.a[1], p.b![1]) - R, Math.min(p.a[2], p.b![2]) - R],
    [Math.max(p.a[0], p.b![0]) + R, Math.max(p.a[1], p.b![1]) + R, Math.max(p.a[2], p.b![2]) + R],
  ];
}

/** Surface nets sur une grille régulière ; renvoie positions et triangles. */
function mesh(prims: Prim[], h: number) {
  const adds = prims.filter((p) => !p.sub), subs = prims.filter((p) => p.sub);
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of adds) { const [a, b] = primBox(p); for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], a[i]); hi[i] = Math.max(hi[i], b[i]); } }
  for (let i = 0; i < 3; i++) { lo[i] -= 2 * h; hi[i] += 2 * h; }
  const nx = Math.ceil((hi[0] - lo[0]) / h) + 1, ny = Math.ceil((hi[1] - lo[1]) / h) + 1, nz = Math.ceil((hi[2] - lo[2]) / h) + 1;
  const F = new Float32Array(nx * ny * nz).fill(1);
  const idx = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  const range = (p: Prim) => {
    const [a, b] = primBox(p);
    return [Math.max(0, Math.floor((a[0] - lo[0]) / h)), Math.min(nx - 1, Math.ceil((b[0] - lo[0]) / h)),
      Math.max(0, Math.floor((a[1] - lo[1]) / h)), Math.min(ny - 1, Math.ceil((b[1] - lo[1]) / h)),
      Math.max(0, Math.floor((a[2] - lo[2]) / h)), Math.min(nz - 1, Math.ceil((b[2] - lo[2]) / h))];
  };
  for (const p of adds) {
    const [i0, i1, j0, j1, k0, k1] = range(p), kk = p.k ?? 0.03;
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d = primDist(p, lo[0] + i * h, lo[1] + j * h, lo[2] + k * h);
      const n = idx(i, j, k);
      F[n] = smin(F[n], d, kk);
    }
  }
  for (const p of subs) {
    const [i0, i1, j0, j1, k0, k1] = range(p), kk = p.k ?? 0.01;
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const n = idx(i, j, k);
      F[n] = smax(F[n], -primDist(p, lo[0] + i * h, lo[1] + j * h, lo[2] + k * h), kk);
    }
  }
  // un sommet par cellule traversée par la surface
  const cell = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cidx = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos: number[] = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const o = corners[c]; v[c] = F[idx(i + o[0], j + o[1], k + o[2])]; if (v[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [e0, e1] of edges) {
      if ((v[e0] < 0) === (v[e1] < 0)) continue;
      const t = v[e0] / (v[e0] - v[e1]);
      const a = corners[e0], b = corners[e1];
      sx += a[0] + (b[0] - a[0]) * t; sy += a[1] + (b[1] - a[1]) * t; sz += a[2] + (b[2] - a[2]) * t; cnt++;
    }
    cell[cidx(i, j, k)] = pos.length / 3;
    pos.push(lo[0] + (i + sx / cnt) * h, lo[1] + (j + sy / cnt) * h, lo[2] + (k + sz / cnt) * h);
  }
  // un quadrilatère par arête de grille traversée
  const tri: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) tri.push(a, b, c, a, c, d); else tri.push(a, c, b, a, d, c);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s0 = F[idx(i, j, k)] < 0;
    if (s0 !== (F[idx(i + 1, j, k)] < 0)) quad(cell[cidx(i, j - 1, k - 1)], cell[cidx(i, j, k - 1)], cell[cidx(i, j, k)], cell[cidx(i, j - 1, k)], s0);
    if (s0 !== (F[idx(i, j + 1, k)] < 0)) quad(cell[cidx(i - 1, j, k - 1)], cell[cidx(i - 1, j, k)], cell[cidx(i, j, k)], cell[cidx(i, j, k - 1)], s0);
    if (s0 !== (F[idx(i, j, k + 1)] < 0)) quad(cell[cidx(i - 1, j - 1, k)], cell[cidx(i, j - 1, k)], cell[cidx(i, j, k)], cell[cidx(i - 1, j, k)], s0);
  }
  return { pos: new Float32Array(pos), index: tri };
}

/** Lissage (Taubin : sans rétrécir le volume). */
function smooth(pos: Float32Array, index: number[], iters: number) {
  const n = pos.length / 3;
  const nb: number[][] = Array.from({ length: n }, () => []);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    nb[a].push(b, c); nb[b].push(a, c); nb[c].push(a, b);
  }
  const tmp = new Float32Array(pos.length);
  const pass = (f: number) => {
    for (let i = 0; i < n; i++) {
      const L = nb[i]; if (!L.length) { tmp[i * 3] = pos[i * 3]; tmp[i * 3 + 1] = pos[i * 3 + 1]; tmp[i * 3 + 2] = pos[i * 3 + 2]; continue; }
      let x = 0, y = 0, z = 0;
      for (const j of L) { x += pos[j * 3]; y += pos[j * 3 + 1]; z += pos[j * 3 + 2]; }
      x /= L.length; y /= L.length; z /= L.length;
      tmp[i * 3] = pos[i * 3] + (x - pos[i * 3]) * f; tmp[i * 3 + 1] = pos[i * 3 + 1] + (y - pos[i * 3 + 1]) * f; tmp[i * 3 + 2] = pos[i * 3 + 2] + (z - pos[i * 3 + 2]) * f;
    }
    pos.set(tmp);
  };
  for (let k = 0; k < iters; k++) { pass(0.5); pass(-0.53); }
}

export interface Body { mesh: THREE.SkinnedMesh; bones: Record<string, THREE.Bone>; root: THREE.Bone; rest: Record<string, THREE.Vector3> }

/** Construit le corps animable à partir des articulations et des volumes. */
export function buildBody(joints: Joint[], prims: Prim[], material: THREE.Material, h = 0.016): Body {
  const { pos, index } = mesh(prims, h);
  smooth(pos, index, 3);
  // os
  const bones: Record<string, THREE.Bone> = {}, rest: Record<string, THREE.Vector3> = {};
  const order: THREE.Bone[] = [];
  for (const j of joints) {
    const b = new THREE.Bone(); b.name = j.name; bones[j.name] = b; order.push(b);
    rest[j.name] = new THREE.Vector3(...j.p);
  }
  let root: THREE.Bone | null = null;
  for (const j of joints) {
    const b = bones[j.name];
    if (j.parent) { bones[j.parent].add(b); b.position.copy(rest[j.name]).sub(rest[j.parent]); }
    else { root = b; b.position.copy(rest[j.name]); }
  }
  const boneIndex = new Map(order.map((b, i) => [b.name, i]));
  // poids : influence douce des volumes proches
  const n = pos.length / 3;
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4), glow = new Float32Array(n);
  const adds = prims.filter((p) => !p.sub);
  const acc = new Float32Array(order.length);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    acc.fill(0);
    let dmin = Infinity;
    const ds = adds.map((p) => { const d = primDist(p, x, y, z); if (d < dmin) dmin = d; return d; });
    let msum = 0, wsum = 0;
    adds.forEach((p, k) => {
      const w = Math.exp(-(ds[k] - dmin) / (0.018 * (p.stiff ?? 1))) * (p.stiff ?? 1);
      acc[boneIndex.get(p.bone)!] += w; msum += w * (p.mask ?? 0); wsum += w;
    });
    glow[i] = msum / wsum;
    const best = [...acc.keys()].sort((a, b) => acc[b] - acc[a]).slice(0, 4);
    let t = 0; for (const b of best) t += acc[b];
    best.forEach((b, s) => { skinIndex[i * 4 + s] = b; skinWeight[i * 4 + s] = acc[b] / t; });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const m = new THREE.SkinnedMesh(g, material);
  m.add(root!);
  m.castShadow = true; m.receiveShadow = true;
  m.bind(new THREE.Skeleton(order));
  m.frustumCulled = false;
  return { mesh: m, bones, root: root!, rest };
}

/** Accroche un objet rigide à un os, à sa position de repos (coordonnées du modèle). */
export function attach(body: Body, bone: string, obj: THREE.Object3D, world: V3) {
  const r = body.rest[bone];
  obj.position.set(world[0] - r.x, world[1] - r.y, world[2] - r.z);
  obj.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
  body.bones[bone].add(obj);
  return obj;
}
