import * as THREE from 'three';
import { boneIndex, restPositions, type Figure } from './asset';

// Cheveux en fils de métal : mèches générées sur le crâne, plaquées puis tombantes,
// regroupées en boucles sculptées, qui bougent légèrement.

export interface HairStyle {
  count: number;          // nombre de fils
  len: [number, number];  // longueur (m)
  flow: 'arriere' | 'bas' | 'raie' | 'epis';
  lift?: number;          // volume au-dessus du crâne (m)
  curl?: number;          // ondulation (m)
  thick?: number;         // rayon du fil (m)
  clump?: number;         // force des mèches (0..1)
  recede?: number;        // front dégarni (0..1)
  sparse?: number;        // cheveux clairsemés (0..1)
  fringe?: boolean;       // frange
  tie?: boolean;          // attachés en queue
}

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function hairMaterial(color: THREE.ColorRepresentation, rough = 0.32) {
  const m = new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: Math.max(0.38, rough + 0.14), anisotropy: 0.6, envMapIntensity: 0.6 });
  const u = { uTime: { value: 0 }, uSway: { value: 1 } };
  m.userData.hair = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aT; attribute float aSeed; uniform float uTime, uSway;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
float sw = aT * aT * uSway;
transformed.x += sin(uTime * 1.7 + aSeed * 6.0) * 0.004 * sw;
transformed.z += sin(uTime * 1.3 + aSeed * 4.0 + 1.0) * 0.003 * sw;`);
  };
  m.customProgramCacheKey = () => 'hair-v1';
  return m;
}

/** Fabrique la chevelure pour la forme actuelle de la figure, fixée à l'os de la tête. */
export function buildHair(fig: Figure, style: HairStyle, mat: THREE.Material, seed = 1) {
  const R = rng(seed);
  const { asset } = fig, n = asset.meta.verts;
  const P = restPositions(fig);
  const hi = boneIndex(asset, 'head');
  const tri = asset.geo.index!.array as Uint16Array;
  const sk = asset.skin;
  const headW = (i: number) => { let w = 0; for (let k = 0; k < 4; k++) if (sk.idx[i * 4 + k] === hi) w += sk.w[i * 4 + k] / 255; return w; };
  // repère du crâne
  const box = new THREE.Box3();
  const isHead = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (headW(i) > 0.85) { isHead[i] = 1; box.expandByPoint(new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2])); }
  const eyeY = (fig.eyes[0].y + fig.eyes[1].y) / 2;
  const size = box.getSize(new THREE.Vector3());
  const C = new THREE.Vector3((box.min.x + box.max.x) / 2, eyeY + size.y * 0.08, (box.min.z + box.max.z) / 2 - size.z * 0.05);
  const s = size.y / 0.25; // échelle de la tête (adulte ≈ 1)
  const Rx = size.x / 2, Rz = size.z / 2;
  const scalp = (x: number, y: number, z: number) => {
    const f = THREE.MathUtils.clamp((z - C.z) / Rz, -1, 1);
    const side = Math.abs(x - C.x) / Rx;
    let line = eyeY + THREE.MathUtils.lerp(0.025, 0.06 + (style.recede ?? 0) * 0.045, Math.max(0, f)) * s;
    if (side > 0.72 && f > -0.35) line = Math.max(line, eyeY + 0.012 * s + (style.recede ?? 0) * 0.02 * s);
    if (f < -0.3) line = eyeY - (0.035 + 0.05 * (-f - 0.3)) * s;
    if ((style.recede ?? 0) > 0.6 && f > -0.1 && side < 0.55 && y > eyeY + 0.09 * s) return false; // sommet dégarni
    return y > line;
  };
  // triangles du cuir chevelu, tirés au sort selon leur aire
  const tris: number[] = [], areas: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let total = 0;
  for (let i = 0; i < tri.length; i += 3) {
    const i0 = tri[i], i1 = tri[i + 1], i2 = tri[i + 2];
    if (!isHead[i0] || !isHead[i1] || !isHead[i2]) continue;
    a.fromArray(P, i0 * 3); b.fromArray(P, i1 * 3); c.fromArray(P, i2 * 3);
    const m = a.clone().add(b).add(c).divideScalar(3);
    if (!scalp(m.x, m.y, m.z)) continue;
    const ar = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
    tris.push(i); total += ar; areas.push(total);
  }
  if (!tris.length) return null;
  const pick = () => {
    const r = R() * total; let lo = 0, hi2 = areas.length - 1;
    while (lo < hi2) { const mid = (lo + hi2) >> 1; if (areas[mid] < r) lo = mid + 1; else hi2 = mid; }
    const t = tris[lo]; let u = R(), v = R(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    a.fromArray(P, tri[t] * 3); b.fromArray(P, tri[t + 1] * 3); c.fromArray(P, tri[t + 2] * 3);
    return a.clone().multiplyScalar(1 - u - v).add(b.clone().multiplyScalar(u)).add(c.clone().multiplyScalar(v));
  };
  const K = 9, lift = (style.lift ?? 0.004) * 2.2 * s + 0.004;
  const flowAt = (p: THREE.Vector3) => {
    const x = p.x - C.x, f = (p.z - C.z) / Rz;
    switch (style.flow) {
      case 'arriere': return new THREE.Vector3(x * 0.6, -0.25, -1);
      case 'raie': return new THREE.Vector3(Math.sign(x - 0.015 * s || 1) * 1, -0.7, -0.15 - Math.max(0, -f) * 0.6);
      case 'epis': return new THREE.Vector3(x * 2 + Math.sin(p.z * 80) * 0.5, -0.3, 0.3 + f * 0.6);
      default: return f > 0.3 ? new THREE.Vector3(Math.sign(x || 1) * 0.9, -0.6, style.fringe ? 0.15 : -0.3) : new THREE.Vector3(x * 1.2, -1, -0.25);
    }
  };
  const Rmax = Math.max(Rx, Rz, size.y / 2);
  const path = (root: THREE.Vector3, len: number, ph: number) => {
    const pts: THREE.Vector3[] = [root.clone()];
    const R0 = root.distanceTo(C);
    const p = root.clone(), seg = len / (K - 1);
    const gravity = new THREE.Vector3(0, -1, 0);
    let d = new THREE.Vector3();
    for (let k = 1; k < K; k++) {
      const t = k / (K - 1);
      const nrm = p.clone().sub(C).normalize();
      const onHead = p.y > C.y - size.y * 0.22;
      const fl = flowAt(p).normalize();
      if (style.tie && p.y < C.y + size.y * 0.15) fl.set((C.x - p.x) * 6, -0.2, -1).normalize(); // vers la nuque
      d = fl.sub(nrm.clone().multiplyScalar(fl.dot(nrm))).normalize();
      if (!onHead) d.lerp(gravity, 0.6).normalize();
      if (style.curl) { const side = new THREE.Vector3().crossVectors(d, nrm).normalize(); d.addScaledVector(side, Math.sin(t * 9 + ph) * style.curl * 40).normalize(); }
      p.addScaledVector(d, seg);
      const r = p.distanceTo(C), want = (onHead ? R0 : Math.max(R0, Rmax * 0.95)) + lift * (0.4 + t);
      // jamais devant le visage : les mèches avant sont repoussées sur le côté
      const faceZ = C.z + Rz * 0.4;
      if (p.z > faceZ && p.y < eyeY + 0.035 * s && Math.abs(p.x - C.x) < Rx * 0.95) { p.z = faceZ; p.x = C.x + Math.sign(p.x - C.x || 1) * Rx * 0.95; }
      if (onHead || r < want) { const dir = p.clone().sub(C).normalize(); p.copy(C).addScaledVector(dir, want); }
      pts.push(p.clone());
    }
    return pts;
  };
  // mèches meneuses, puis fils qui les suivent
  const leaders: { root: THREE.Vector3; pts: THREE.Vector3[] }[] = [];
  const nLead = Math.max(12, Math.round(style.count / 14));
  for (let i = 0; i < nLead; i++) { const r = pick(); leaders.push({ root: r, pts: path(r, THREE.MathUtils.lerp(style.len[0], style.len[1], R()) * s, R() * 6) }); }
  const strands: THREE.Vector3[][] = [];
  const clump = style.clump ?? 0.6;
  for (let i = 0; i < style.count; i++) {
    if (style.sparse && R() < style.sparse) continue;
    const r = pick();
    let best = leaders[0], bd = 1e9;
    for (const L of leaders) { const dd = L.root.distanceToSquared(r); if (dd < bd) { bd = dd; best = L; } }
    if (Math.sqrt(bd) > 0.05 * s) { strands.push(path(r, THREE.MathUtils.lerp(style.len[0], style.len[1], R()) * s, R() * 6)); continue; }
    const off = r.clone().sub(best.root);
    const lenK = 0.75 + R() * 0.3;
    strands.push(best.pts.map((q, k) => {
      const t = k / (K - 1);
      return q.clone().add(off.clone().multiplyScalar(1 - clump * t * 0.85)).addScaledVector(q.clone().sub(C).normalize(), (R() - 0.3) * 0.0015 * t);
    }).slice(0, Math.max(3, Math.round(K * lenK))));
  }
  // tubes à trois faces
  const SIDES = 3, th = (style.thick ?? 0.0011) * Math.min(1, s);
  let nv = 0; for (const st of strands) nv += st.length * SIDES;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), tan = new Float32Array(nv * 4), at = new Float32Array(nv), sd = new Float32Array(nv);
  const idx: number[] = [];
  let v = 0;
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), tmp = new THREE.Vector3();
  const head = fig.joints[hi];
  strands.forEach((st, si) => {
    const seedV = R();
    for (let k = 0; k < st.length; k++) {
      const t = k / (st.length - 1);
      T.copy(st[Math.min(k + 1, st.length - 1)]).sub(st[Math.max(k - 1, 0)]).normalize();
      tmp.copy(st[k]).sub(C).normalize();
      B.crossVectors(T, tmp).normalize(); N.crossVectors(B, T).normalize();
      const r = th * (1 - t * 0.75);
      for (let j = 0; j < SIDES; j++) {
        const ang = (j / SIDES) * Math.PI * 2;
        const dx = Math.cos(ang), dy = Math.sin(ang);
        const nx = N.x * dx + B.x * dy, ny = N.y * dx + B.y * dy, nz = N.z * dx + B.z * dy;
        pos[v * 3] = st[k].x - head.x + nx * r; pos[v * 3 + 1] = st[k].y - head.y + ny * r; pos[v * 3 + 2] = st[k].z - head.z + nz * r;
        nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz;
        tan[v * 4] = T.x; tan[v * 4 + 1] = T.y; tan[v * 4 + 2] = T.z; tan[v * 4 + 3] = 1;
        at[v] = t; sd[v] = seedV;
        if (k < st.length - 1) {
          const a0 = v, a1 = v - j + (j + 1) % SIDES;
          idx.push(a0, a0 + SIDES, a1, a1, a0 + SIDES, a1 + SIDES);
        }
        v++;
      }
    }
    void si;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('tangent', new THREE.BufferAttribute(tan, 4));
  g.setAttribute('aT', new THREE.BufferAttribute(at, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  g.setAttribute('aCurv', new THREE.BufferAttribute(new Float32Array(nv), 1));
  g.setAttribute('aCloth', new THREE.BufferAttribute(new Float32Array(nv * 2), 2));
  g.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = true; mesh.name = 'hair';
  return mesh;
}
