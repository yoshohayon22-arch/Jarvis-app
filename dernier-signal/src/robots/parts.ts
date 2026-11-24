import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Boîte à outils de « kitbashing » procédural : formes biseautées, vis, câbles, joints.

export type V3 = [number, number, number];

export function rbox(w: number, h: number, d: number, r = 0.015, seg = 3) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
}

/** Cylindre aux bords biseautés arrondis (profil tourné). Axe Y. */
export function bcyl(r: number, h: number, bevel = 0.008, seg = 32, rTop = r) {
  const pts: THREE.Vector2[] = [];
  const b = Math.min(bevel, r * 0.4, h * 0.4);
  const arc = (cx: number, cy: number, a0: number, a1: number, rad: number) => {
    for (let i = 0; i <= 4; i++) {
      const a = a0 + (a1 - a0) * (i / 4);
      pts.push(new THREE.Vector2(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad));
    }
  };
  pts.push(new THREE.Vector2(0, -h / 2));
  arc(r - b, -h / 2 + b, -Math.PI / 2, 0, b);
  arc(rTop - b, h / 2 - b, 0, Math.PI / 2, b);
  pts.push(new THREE.Vector2(0, h / 2));
  const g = new THREE.LatheGeometry(pts, seg);
  return g;
}

/** Profil tourné libre (points [rayon, hauteur]). */
export function lathe(profile: [number, number][], seg = 40) {
  return new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), seg);
}

/** Tête de vis cruciforme, orientée selon +Z. */
let screwGeo: THREE.BufferGeometry | null = null;
export function screw(): THREE.BufferGeometry {
  if (screwGeo) return screwGeo;
  const head = lathe([[0, 0], [0.0062, 0], [0.0062, 0.0012], [0.0045, 0.0026], [0, 0.003]], 12);
  head.rotateX(Math.PI / 2);
  screwGeo = head;
  return head;
}
let slotGeo: THREE.BufferGeometry | null = null;
export function screwSlot(): THREE.BufferGeometry {
  if (slotGeo) return slotGeo;
  const a = new THREE.BoxGeometry(0.0085, 0.0014, 0.0012);
  const b = new THREE.BoxGeometry(0.0014, 0.0085, 0.0012);
  slotGeo = mergeGeometries([a, b])!;
  slotGeo.translate(0, 0, 0.0027);
  return slotGeo;
}

export function cable(points: V3[], radius = 0.008, seg = 32) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, seg, radius, 8, false);
}

/** Gaine annelée (soufflet) le long de Y. */
export function bellows(r: number, h: number, rings = 6) {
  const prof: [number, number][] = [];
  for (let i = 0; i <= rings * 4; i++) {
    const t = i / (rings * 4);
    const rr = r * (0.86 + 0.14 * Math.abs(Math.sin(t * rings * Math.PI)));
    prof.push([rr, -h / 2 + t * h]);
  }
  return lathe(prof, 24);
}

/** Grille d'aération : lamelles. */
export function vent(w: number, h: number, n = 5, depth = 0.006) {
  const gs: THREE.BufferGeometry[] = [];
  const step = h / n;
  for (let i = 0; i < n; i++) {
    const g = rbox(w, step * 0.45, depth, 0.002, 1);
    g.translate(0, -h / 2 + step * (i + 0.5), 0);
    gs.push(g);
  }
  return mergeGeometries(gs)!;
}

/**
 * Regroupe toutes les pièces statiques par (articulation, matériau) puis les fusionne :
 * des centaines de pièces → quelques appels de dessin.
 */
export class Builder {
  private buckets = new Map<THREE.Object3D, Map<THREE.Material, THREE.BufferGeometry[]>>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();

  add(joint: THREE.Object3D, mat: THREE.Material, geo: THREE.BufferGeometry, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    this.e.set(rot[0], rot[1], rot[2]);
    this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(...pos), this.q, new THREE.Vector3(...scale));
    g.applyMatrix4(this.m);
    let jm = this.buckets.get(joint);
    if (!jm) { jm = new Map(); this.buckets.set(joint, jm); }
    let arr = jm.get(mat);
    if (!arr) { arr = []; jm.set(mat, arr); }
    arr.push(g);
    return this;
  }

  /** Ajoute une rangée de vis (positions locales, orientation par rotation). */
  screws(joint: THREE.Object3D, head: THREE.Material, slot: THREE.Material, list: { p: V3; r?: V3 }[]) {
    for (const s of list) {
      this.add(joint, head, screw(), s.p, s.r ?? [0, 0, 0]);
      this.add(joint, slot, screwSlot(), s.p, s.r ?? [0, 0, 0]);
    }
    return this;
  }

  build(castShadow = true) {
    for (const [joint, mats] of this.buckets) {
      for (const [mat, geos] of mats) {
        let merged = mergeGeometries(geos, false)!;
        const uvs = (mat.userData as { uvScale?: number }).uvScale;
        if (uvs) worldUV(merged, uvs);
        merged = mergeVertices(merged, 1e-5);
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = castShadow && !(mat as THREE.MeshBasicMaterial).isMeshBasicMaterial && !mat.transparent;
        mesh.receiveShadow = true;
        joint.add(mesh);
      }
    }
    this.buckets.clear();
  }
}

/** UV « planaires » en coordonnées monde selon l'orientation de chaque face (textures à l'échelle réelle). */
export function worldUV(g: THREE.BufferGeometry, scale: number) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u: number, v: number;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i) * Math.sign(n.getX(i)); v = p.getY(i); }
    else { u = -p.getX(i) * Math.sign(n.getZ(i)); v = p.getY(i); }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Petite fonction de bruit lisse 1D (pour les regards, vacillements). */
export function smoothNoise(t: number, seed = 0) {
  const s = (x: number) => {
    const i = Math.floor(x), f = x - i;
    const h = (n: number) => { const v = Math.sin((n + seed * 17.13) * 127.1) * 43758.5453; return v - Math.floor(v); };
    const u = f * f * (3 - 2 * f);
    return h(i) * (1 - u) + h(i + 1) * u;
  };
  return s(t) * 2 - 1;
}
