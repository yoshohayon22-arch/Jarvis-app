import * as THREE from 'three';
import { buildBody, attach, type Prim, type Body } from './sdf';
import { quadJoints, animateBiped, animateQuad, type QuadSpec, type Action, type Emotion } from './rig';
import { makeSkin, makeEye, addFur, type SkinOptions } from './skin';
import { armorMaterial, garment, vertexInfo, zones, pauldron, skirt, mantle, updateCloth, type VInfo } from './armor';

// Les peuples vaëls et les meutes, modelés d'après les images de référence (docs/concepts).
// Chaque design correspond à un peuple ou à un territoire.

type V3 = [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cone = (bone: string, a: V3, b: V3, r1: number, r2: number, k = 0.03, mask = 0.5, stiff = 1): Prim => ({ kind: 'cone', bone, a, b, r1, r2, k, mask, stiff });
const ell = (bone: string, a: V3, rad: V3, k = 0.03, mask = 0.5, stiff = 1): Prim => ({ kind: 'ell', bone, a, rad, r1: 0, k, mask, stiff });
const hole = (bone: string, a: V3, rad: V3, k = 0.012): Prim => ({ kind: 'ell', bone, a, rad, r1: 0, k, sub: true });

export const EMO_COLORS: Record<Emotion, THREE.Color> = {
  calme: new THREE.Color(0.2, 0.7, 1.8),
  colere: new THREE.Color(2.2, 0.18, 0.08),
  joie: new THREE.Color(2.0, 1.25, 0.2),
  tristesse: new THREE.Color(0.85, 0.3, 1.8),
  respect: new THREE.Color(1.6, 1.7, 1.8),
  menace: new THREE.Color(2.2, 0.25, 0.05),
};

export interface Creature {
  group: THREE.Group;
  body: Body;
  skin: THREE.MeshPhysicalMaterial;
  kind: 'biped' | 'quad';
  update: (dt: number, t: number, action: Action, emotion: Emotion) => void;
}

export interface Design { id: string; letter: string; name: string; people: string; text: string; concept: string; kind: 'vael' | 'meute'; build: () => Creature | Promise<Creature> }

// ---------- matériaux des parures ----------
const M = {
  wood: () => new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.85 }),
  vine: () => new THREE.MeshStandardMaterial({ color: 0x3a4a26, roughness: 0.75 }),
  leaf: () => new THREE.MeshStandardMaterial({ color: 0x4b5a2a, roughness: 0.7, side: THREE.DoubleSide }),
  leather: () => new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8 }),
  bone: () => new THREE.MeshStandardMaterial({ color: 0xd9cdb4, roughness: 0.55 }),
  flint: () => new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.3, metalness: 0.1 }),
  shell: () => new THREE.MeshPhysicalMaterial({ color: 0xead9c4, roughness: 0.3, iridescence: 0.6, clearcoat: 1 }),
  cord: () => new THREE.MeshStandardMaterial({ color: 0x6b5a42, roughness: 0.9 }),
  crystal: () => new THREE.MeshPhysicalMaterial({ color: 0xb8f0ff, roughness: 0.06, transmission: 0.55, thickness: 0.04, transparent: true, opacity: 0.85, emissive: new THREE.Color(0.1, 0.45, 0.7), emissiveIntensity: 0.9 }),
};
function tube(points: V3[], r: number, mat: THREE.Material, closed = false, r2?: number) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed);
  const g = new THREE.TubeGeometry(curve, Math.max(24, points.length * 10), r, 8, closed);
  if (r2 !== undefined) { // effilé
    const pos = g.attributes.position, n = 9, segs = pos.count / n;
    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1), c = curve.getPointAt(Math.min(1, t)), f = THREE.MathUtils.lerp(1, r2 / r, t);
      for (let j = 0; j < n; j++) { const k = i * n + j; pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * f, c.y + (pos.getY(k) - c.y) * f, c.z + (pos.getZ(k) - c.z) * f); }
    }
    g.computeVertexNormals();
  }
  return new THREE.Mesh(g, mat);
}
function ring(c: V3, rx: number, rz: number, wob: number, n = 14): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push([c[0] + Math.sin(a) * rx, c[1] + Math.sin(a * 3) * wob - (Math.cos(a) > 0 ? 0.03 : 0), c[2] + Math.cos(a) * rz]); }
  return out;
}
function leafGeo(w: number, h: number) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(w, h * 0.35, 0, h); s.quadraticCurveTo(-w, h * 0.35, 0, 0);
  const g = new THREE.ShapeGeometry(s, 6); g.rotateX(Math.PI); return g;
}
function glowMat(c: THREE.ColorRepresentation, k = 1) { return new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) }); }

// ---------- Vaëls ----------
// ---------- corps issus de MakeHuman (tools/build_vaels.py) ----------
async function loadMH(id: string, material: THREE.Material) {
  const base = import.meta.env.BASE_URL + 'assets/species/';
  const meta = await (await fetch(base + id + '.json')).json() as { verts: number; tris: number; joints: { name: string; parent: string | null; p: V3 }[]; eyes: V3[]; eyeR: number; scale: number; data: string };
  const bin = atob(meta.data), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const buf = bytes.buffer;
  const n = meta.verts, t = meta.tris;
  let off = 0;
  const pos = new Float32Array(buf, off, n * 3); off += n * 12;
  const idx = new Uint16Array(buf, off, t * 3); off += t * 6;
  const si = new Uint8Array(buf, off, n * 4); off += n * 4;
  const sw = new Uint8Array(buf, off, n * 4); off += n * 4;
  const gl = new Uint8Array(buf, off, n);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from(si), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from(sw, (v) => v / 255), 4));
  g.setAttribute('aGlow', new THREE.BufferAttribute(Float32Array.from(gl, (v) => v / 255), 1));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(idx), 1));
  g.computeVertexNormals();
  const bones: Record<string, THREE.Bone> = {}, rest: Record<string, THREE.Vector3> = {}, P: Record<string, V3> = {};
  const order: THREE.Bone[] = [];
  let root: THREE.Bone | null = null;
  for (const j of meta.joints) { const b = new THREE.Bone(); b.name = j.name; bones[j.name] = b; rest[j.name] = new THREE.Vector3(...j.p); P[j.name] = j.p; order.push(b); }
  for (const j of meta.joints) { const b = bones[j.name]; if (j.parent) { bones[j.parent].add(b); b.position.copy(rest[j.name]).sub(rest[j.parent]); } else { root = b; b.position.copy(rest[j.name]); } }
  const mesh = new THREE.SkinnedMesh(g, material);
  mesh.add(root!); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.bind(new THREE.Skeleton(order));
  const body: Body = { mesh, bones, root: root!, rest };
  return { body, P, eyes: meta.eyes, eyeR: meta.eyeR, k: meta.scale };
}

interface VaelMHLook {
  id: string; digi: boolean; skin: SkinOptions;
  eye: { r: number; sx?: number; sy?: number; rz?: number; iris?: number; extra?: (e: V3, side: number) => { p: V3; r: number }[] };
  extra?: (b: Body, P: Record<string, V3>, eyes: V3[], glow: THREE.Material[]) => void;
  armor?: (b: Body, P: Record<string, V3>, eyes: V3[], info: VInfo[]) => void;
  gear: (b: Body, P: Record<string, V3>, glow: THREE.Material[]) => void;
}
async function makeVaelMH(L: VaelMHLook): Promise<Creature> {
  const skin = makeSkin(L.skin);
  const { body, P, eyes, eyeR } = await loadMH(L.id, skin);
  const glow: THREE.Material[] = [];
  eyes.forEach((e, i) => {
    const side = i === 0 ? 1 : -1;
    const list = [{ p: e, r: eyeR * L.eye.r }, ...(L.eye.extra?.(e, side) ?? [])];
    list.forEach((it, k) => {
      const eye = makeEye(it.r, L.eye.iris ?? 0x0a0a0a, 0.3);
      if (k === 0) { eye.scale.set(L.eye.sx ?? 1, L.eye.sy ?? 1, 1); eye.rotation.z = (L.eye.rz ?? 0) * side; }
      attach(body, 'head', eye, k === 0 ? add(it.p, [0, 0, it.r * 0.12]) : it.p);
    });
  });
  L.armor?.(body, P, eyes, vertexInfo(body));
  L.extra?.(body, P, eyes, glow);
  L.gear(body, P, glow);
  const group = new THREE.Group(); group.add(body.mesh);
  return {
    group, body, skin, kind: 'biped',
    update(dt, t, action, emotion) {
      animateBiped(body, action, emotion, dt, L.digi);
      const an = body.mesh.userData.anim as { walk: number; run: number; phase: number };
      updateCloth(body, t, an.walk * 0.5 + an.run * 0.5, Math.sin(an.phase) * an.walk);
      const u = skin.userData.skin;
      u.uTime.value = t;
      u.uGlowCol.value.lerp(EMO_COLORS[emotion], 1 - Math.exp(-dt * 3));
      u.uGlow.value = emotion === 'colere' ? 1.35 + Math.sin(t * 9) * 0.25 : emotion === 'tristesse' ? 0.55 : 1;
      for (const m of glow) {
        if ((m as THREE.MeshPhysicalMaterial).emissive) (m as THREE.MeshPhysicalMaterial).emissive.copy(u.uGlowCol.value).multiplyScalar(0.4);
        else (m as THREE.MeshBasicMaterial).color.copy(u.uGlowCol.value).multiplyScalar(0.9);
      }
    },
  };
}

// nageoire translucide (Sylphe)
function fin(len: number, h: number, mat: THREE.Material) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(-len * 0.3, h, -len * 0.75, h * 0.9, -len, h * 0.25); s.bezierCurveTo(-len * 0.6, h * 0.15, -len * 0.3, -h * 0.05, 0, 0);
  const g = new THREE.ShapeGeometry(s, 12); g.rotateY(Math.PI / 2);
  return new THREE.Mesh(g, mat);
}

export const DESIGNS: Design[] = [
  {
    id: 'cervide', letter: 'D', kind: 'vael', name: 'Le Cervidé', people: 'Clan des Racines · forêt lumineuse', concept: 'v_d.jpg',
    text: 'Guérisseurs et cultivateurs de la forêt. Fines écailles, visage de cervidé, bois de cristal qui brillent avec l’émotion : ils vénèrent la balise. Pagne de feuilles, bâton noueux.',
    build: () => makeVaelMH({
      id: 'cervide', digi: false,
      armor: (b, P, _e, info) => {
        const bark = armorMaterial({ tex: 'pine_bark', tint: 0xb8a088, scale: 3.2, plates: 20, seam: 0x1a120c });
        const leather = armorMaterial({ tex: 'brown_leather', tint: 0x9a7a5a, scale: 4, sheen: 0.3 });
        const linen = armorMaterial({ tex: 'rough_linen', tint: 0x8a7650, scale: 5, sheen: 0.5 });
        garment(b, info, zones.torso(P, 0.12, 0.9), 0.018, bark, 14);
        garment(b, info, zones.hips(P, 0.3, 0.12), 0.014, linen, 8);
        garment(b, info, zones.forearm(P, 0.12, 0.88), 0.007, leather);
        garment(b, info, zones.shin(P, 0.1, 0.85), 0.014, bark, 8);
        pauldron(b, P, 'L', bark, 0.085, 2); pauldron(b, P, 'R', bark, 0.085, 2);
        skirt(b, P, armorMaterial({ tex: 'rough_linen', tint: 0x6a5c40, scale: 5, sheen: 0.5, cloth: true }), { top: 0.14, hem: 0.19, length: 0.3, folds: 7 });
        garment(b, info, zones.helmet(_e, P, 0.03, 0.085), 0.012, bark, 6); // couronne d'écorce
      },
      skin: { color: 0x6a5238, color2: 0x2c2118, sheen: 0xc0a080, pattern: 'spirales', scale: 1.1, bump: 0.4, detail: 'cervide', detailScale: 7, detailAmt: 1 },
      eye: { r: 1.05, sx: 1.15, iris: 0x2a1a0c },
      extra: (b, _P, eyes, glow) => {
        const eM = lerp3(eyes[0], eyes[1], 0.5);
        const earMat = new THREE.MeshPhysicalMaterial({ color: 0x6a5238, roughness: 0.6, sheen: 1, sheenColor: new THREE.Color(0xc09070), side: THREE.DoubleSide });
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), new THREE.MeshPhysicalMaterial({ color: 0x141010, roughness: 0.3, clearcoat: 1 }));
        nose.scale.set(1.3, 0.8, 0.8); attach(b, 'head', nose, add(eM, [0, -0.058, 0.092]));
        for (const sx of [1, -1]) {
          const ear = new THREE.Mesh(leafGeo(0.03, 0.1), earMat); ear.rotation.set(Math.PI, 0, sx * 1.3); attach(b, 'head', ear, add(eM, [sx * 0.07, 0.025, -0.07]));
          const an = antler(sx); glow.push(an.mat); attach(b, 'head', an.g, add(eM, [sx * 0.03, 0.075, -0.045]));
        }
      },
      gear: (b, P, glow) => {
        const skirt = new THREE.Group(), lm = M.leaf();
        for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; const l = new THREE.Mesh(leafGeo(0.045, 0.27 + (i % 3) * 0.03), lm); l.position.set(Math.sin(a) * 0.13, 0.0, Math.cos(a) * 0.1); l.rotation.set(0.18 * Math.cos(a), a, 0.18 * Math.sin(a)); skirt.add(l); }
        skirt.add(tube(ring([0, 0.0, 0], 0.13, 0.1, 0.004), 0.008, M.vine(), true));
        attach(b, 'hips', skirt, add(P.hips, [0, 0.02, 0.01]));
        const staff = new THREE.Group();
        staff.add(tube([[0, 0.38, 0], [0.012, 0.1, 0.01], [-0.01, -0.3, 0], [0.012, -0.7, 0.01], [0, -1.08, 0]], 0.016, M.wood()));
        const seed = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), glowMat(0x60ffb0, 1.4)); seed.position.y = 0.41; staff.add(seed); glow.push(seed.material as THREE.Material);
        attach(b, 'handR', staff, add(P.handR, [0.0, -0.08, 0.03]));
      },
    }),
  },
  {
    id: 'veilleur', letter: 'B', kind: 'vael', name: 'Le Veilleur', people: 'Clan des Hauteurs · falaises et canyons', concept: 'v_b.jpg',
    text: 'Chasseurs et guerriers des falaises, fiers et musclés. Crâne en goutte, quatre yeux : deux grands pour voir, deux petits qui captent la lumière. Taches lumineuses en constellations. Ceinture de cuir, lance à pointe de silex.',
    build: () => makeVaelMH({
      id: 'veilleur', digi: false,
      armor: (b, P, _e, info) => {
        const cuir = armorMaterial({ tex: 'fabric_leather_02', tint: 0x8a6a4c, scale: 3, sheen: 0.3 });
        const dark = armorMaterial({ tex: 'brown_leather', tint: 0x6a4c34, scale: 4, sheen: 0.3 });
        const bone = armorMaterial({ tex: 'brown_leather', tint: 0xf0e4c8, scale: 2, plates: 28, seam: 0x3a3020, rough: 0.8 });
        garment(b, info, zones.torso(P, 0.05, 0.94, true), 0.02, cuir, 16);
        garment(b, info, zones.hips(P, 0.45, 0.1), 0.016, dark, 10);
        garment(b, info, zones.forearm(P, 0.1, 0.9), 0.008, dark);
        garment(b, info, zones.shin(P, 0.08, 0.9), 0.013, dark, 8);
        pauldron(b, P, 'L', bone, 0.11, 3); pauldron(b, P, 'R', bone, 0.11, 3);
        skirt(b, P, armorMaterial({ tex: 'brown_leather', tint: 0x5a3c26, scale: 4, plates: 14, seam: 0x1a0e06, sheen: 0.3, cloth: true }), { top: 0.15, hem: 0.21, length: 0.36, folds: 12 });
        mantle(b, P, armorMaterial({ tex: 'hessian_230', tint: 0x3a3430, scale: 5, sheen: 0.8, cloth: true }), { neck: 0.075, spread: 0.17, length: 0.16, back: 0.25 });
        garment(b, info, zones.helmet(_e, P, 0.062), 0.014, bone, 10); // casque d'os au-dessus des quatre yeux
        boneCrest(b, _e);
      },
      skin: { color: 0x5e5868, color2: 0x2a2433, sheen: 0x9a88b8, pattern: 'taches', scale: 1, bump: 0.5, detail: 'veilleur', detailScale: 6, detailAmt: 1 },
      eye: { r: 1.05, sx: 1.35, sy: 0.85, rz: 0.22, extra: (e, side) => [{ p: add(e, [-side * 0.008, 0.045, -0.01]), r: 0.0075 }] },
      gear: (b, P) => {
        const belt = new THREE.Group();
        belt.add(tube(ring([0, 0, 0], 0.15, 0.11, 0.0), 0.016, M.leather(), true));
        attach(b, 'hips', belt, add(P.hips, [0, 0.0, 0.01]));
        const spear = new THREE.Group();
        spear.add(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 2.1, 10), M.wood()));
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 4), M.flint()); tip.position.y = 1.14; tip.scale.z = 0.35; spear.add(tip);
        spear.add(tube([[0, 1.02, 0.016], [0.016, 1.0, 0], [0, 0.98, -0.016], [-0.016, 0.96, 0]], 0.004, M.cord(), true));
        attach(b, 'handR', spear, add(P.handR, [0.0, -0.08, 0.03]));
      },
    }),
  },
  {
    id: 'echassier', letter: 'C', kind: 'vael', name: 'L’Échassier', people: 'Clan des Eaux · marais et lac', concept: 'v_c.jpg',
    text: 'Pêcheurs et commerçants des marais. Penchés en avant, très longs bras, peau d’amphibien humide et côtelée, couronne de frondes dont les pointes s’allument. Collier de coquillages, harpon.',
    build: () => makeVaelMH({
      id: 'echassier', digi: true,
      armor: (b, P, _e, info) => {
        const shell = armorMaterial({ tex: 'shell_floor_01', tint: 0xe8e0d0, scale: 3.5, rough: 0.7 });
        const jute = armorMaterial({ tex: 'hessian_230', tint: 0x9a8a6a, scale: 5, sheen: 0.6, cloth: true });
        const linen = armorMaterial({ tex: 'rough_linen', tint: 0x6a7a6a, scale: 5, sheen: 0.5 });
        garment(b, info, zones.torso(P, 0.22, 0.88), 0.018, shell, 14);
        garment(b, info, zones.hips(P, 0.42, 0.18), 0.016, jute, 10);
        garment(b, info, zones.forearm(P, 0.05, 0.95), 0.006, linen);
        garment(b, info, zones.shin(P, 0.05, 0.6), 0.007, linen);
        pauldron(b, P, 'L', shell, 0.08, 2); pauldron(b, P, 'R', shell, 0.08, 2);
        skirt(b, P, jute, { top: 0.12, hem: 0.19, length: 0.34, folds: 14 });
        garment(b, info, zones.mask(_e, P, false, 0.02), 0.01, armorMaterial({ tex: 'shell_floor_01', tint: 0xf2ecdc, scale: 6, rough: 0.6 }), 6); // masque de coquillages
      },
      skin: { color: 0x3d5a3e, color2: 0x182a1f, sheen: 0x8fd0b0, wet: 0.55, pattern: 'rayures', scale: 1, bump: 0.4, detail: 'echassier', detailScale: 5, detailAmt: 0.9 },
      eye: { r: 1.05, iris: 0x1a2410 },
      extra: (b, _P, eyes, glow) => {
        const eM = lerp3(eyes[0], eyes[1], 0.5);
        const crown = new THREE.Group();
        const fm = new THREE.MeshPhysicalMaterial({ color: 0x6f8a48, roughness: 0.5, clearcoat: 0.6 });
        const tipm = glowMat(0x7ff0ff, 1.6); glow.push(tipm);
        for (let i = 0; i < 22; i++) {
          const a = (i / 21 - 0.5) * 2.8, r = 0.03 + (i % 3) * 0.008;
          const base: V3 = [Math.sin(a) * r, 0, Math.cos(a) * r * 0.7 - 0.02];
          const len = 0.17 + ((i * 7) % 5) * 0.025;
          const pts: V3[] = [base, add(base, [Math.sin(a) * 0.04, len * 0.45, -0.03]), add(base, [Math.sin(a) * 0.1, len * 0.8, -0.1]), add(base, [Math.sin(a) * 0.15, len * 0.9, -0.17 - (i % 2) * 0.03])];
          crown.add(tube(pts, 0.011, fm, false, 0.004));
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), tipm); tip.position.set(...pts[3]); crown.add(tip);
        }
        attach(b, 'head', crown, add(eM, [0, 0.07, -0.05]));
      },
      gear: (b, P) => {
        const shells = new THREE.Group(), sm = M.shell();
        shells.add(tube(ring([0, 0, 0], 0.065, 0.06, 0.0, 16), 0.0035, M.cord(), true));
        for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.3; const sh = new THREE.Mesh(new THREE.SphereGeometry(0.014 + (i === 3 ? 0.01 : 0), 12, 8), sm); sh.position.set(Math.sin(a) * 0.065, -0.02 - Math.cos(a) * 0.01, Math.cos(a) * 0.062); sh.scale.set(1, 0.6, 0.6); shells.add(sh); }
        attach(b, 'neck', shells, add(P.neck, [0, 0.0, 0.015]));
        const harp = new THREE.Group();
        harp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 1.7, 10), M.wood()));
        for (let i = -1; i <= 1; i++) { const pr = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.16, 6), M.bone()); pr.position.set(i * 0.025, 0.92, 0); pr.rotation.z = -i * 0.12; harp.add(pr); }
        attach(b, 'handR', harp, add(P.handR, [0.0, -0.09, 0.03]));
      },
    }),
  },
  {
    id: 'sylphe', letter: 'A', kind: 'vael', name: 'Le Sylphe', people: 'Les Nomades de la plaine · balise', concept: 'v_a.jpg',
    text: 'Un quatrième peuple, nomade, qui erre dans la plaine de la balise. Très élancés, ils marchent sur la pointe des pieds. Grands yeux noirs en amande, nageoires translucides derrière le crâne, veines de lumière. Collier de lianes.',
    build: () => makeVaelMH({
      id: 'sylphe', digi: true,
      armor: (b, P, eyes, info) => {
        const robe = armorMaterial({ tex: 'rough_linen', tint: 0x55647a, scale: 4, sheen: 0.7, cloth: true });
        const jute = armorMaterial({ tex: 'hessian_230', tint: 0x6a6460, scale: 5, sheen: 0.6, cloth: true });
        garment(b, info, zones.torso(P, 0.0, 1.0, true), 0.022, robe, 12);
        garment(b, info, zones.upperArm(), 0.016, robe, 6);
        garment(b, info, zones.hips(P, 0.25, 0.1), 0.022, robe, 10);
        garment(b, info, zones.thighs(P), 0.02, robe, 8);
        garment(b, info, zones.shin(P, 0.05, 0.75), 0.007, jute);
        garment(b, info, zones.forearm(P, 0.3, 0.95), 0.006, jute);
        garment(b, info, zones.hood(eyes, P), 0.028, jute, 10);
        skirt(b, P, robe, { top: 0.13, hem: 0.3, length: 0.78, folds: 10, depth: 0.85 });
        mantle(b, P, jute, { neck: 0.06, spread: 0.16, length: 0.2, back: 0.6 });
        garment(b, info, zones.mask(eyes, P, true), 0.012, jute, 6); // voile sous les yeux
      },
      skin: { color: 0x1d2638, color2: 0x0a0f18, sheen: 0x5f86b0, wet: 0.25, pattern: 'veines', scale: 1.1, bump: 0.5, detail: 'veilleur', detailScale: 8, detailAmt: 0.6 },
      eye: { r: 1.05, sx: 1.45, sy: 0.85, rz: 0.32 },
      extra: (b, _P, eyes, glow) => {
        const eM = lerp3(eyes[0], eyes[1], 0.5);
        const fm = new THREE.MeshPhysicalMaterial({ color: 0x5a78c8, roughness: 0.25, transparent: true, opacity: 0.55, side: THREE.DoubleSide, emissive: new THREE.Color(0.1, 0.3, 0.8), emissiveIntensity: 0.6, depthWrite: false });
        glow.push(fm);
        for (const [dy, len, h, tilt] of [[0.08, 0.26, 0.075, 0.35], [0.05, 0.2, 0.05, 0.1]] as const) {
          const f = fin(len, h, fm); f.rotation.x = tilt; attach(b, 'head', f, add(eM, [0, dy, -0.1]));
        }
      },
      gear: (b, P, glow) => {
        const nk = new THREE.Group();
        nk.add(tube(ring([0, 0, 0], 0.055, 0.052, 0.008, 18), 0.006, M.vine(), true));
        const lm = M.leaf();
        for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const l = new THREE.Mesh(leafGeo(0.008, 0.025), lm); l.position.set(Math.sin(a) * 0.057, -0.005, Math.cos(a) * 0.054); l.rotation.y = a; nk.add(l); }
        const pend = new THREE.Mesh(new THREE.OctahedronGeometry(0.014), M.crystal()); pend.position.set(0, -0.045, 0.058); pend.scale.y = 1.6; nk.add(pend); glow.push(pend.material as THREE.Material);
        attach(b, 'neck', nk, add(P.neck, [0, 0.0, 0.015]));
      },
    }),
  },
  // ---------- meutes ----------
  {
    id: 'lame', letter: 'A', kind: 'meute', name: 'La Lame', people: 'Meute de la plaine · herbes hautes', concept: 'm_a.jpg',
    text: 'Chasse en meute dans les herbes hautes de la plaine. Svelte comme un lévrier, très haute sur pattes, quatre yeux ambre, une ligne de lumière le long de l’échine. Pelage court gris-bleu.',
    build: () => makeQuad({ L: 1.0, hip: 0.7, sh: 0.72, w: 0.085, neck: 0.3, neckRise: 0.17, tail: 0.6 }, 0.82,
      { color: 0x3a3d44, color2: 0x16181c, sheen: 0x8aa0b8, pattern: 'rayures', scale: 1.3, bump: 0.6 },
      (H) => ({
        prims: [
          cone('head', add(H, [0, 0.04, -0.05]), add(H, [0, -0.005, 0.22]), 0.058, 0.018, 0.04, 0.3),
          cone('head', add(H, [0, -0.025, -0.02]), add(H, [0, -0.03, 0.19]), 0.03, 0.013, 0.04, 0.1),
          cone('head', add(H, [0.032, 0.07, -0.05]), add(H, [0.05, 0.2, -0.07]), 0.026, 0.006, 0.02, 0.0, 1.5),
          cone('head', add(H, [-0.032, 0.07, -0.05]), add(H, [-0.05, 0.2, -0.07]), 0.026, 0.006, 0.02, 0.0, 1.5),
          ell('head', add(H, [0, -0.0, 0.215]), [0.014, 0.012, 0.012], 0.01, 0),
        ],
        eyes: [{ p: add(H, [0.031, 0.048, 0.048]), r: 0.012 }, { p: add(H, [-0.031, 0.048, 0.048]), r: 0.012 }, { p: add(H, [0.027, 0.036, 0.09]), r: 0.009 }, { p: add(H, [-0.027, 0.036, 0.09]), r: 0.009 }],
        eyeCol: 0xffa030,
      }), 'spine', { layers: 14, length: 0.014, density: 420, color: 0x50545c, tip: 0x8a9099, detail: 'lame', detailScale: 5 }, 'lame'),
  },
  {
    id: 'rodeur', letter: 'B', kind: 'meute', name: 'Le Rôdeur', people: 'Meute des falaises · canyons', concept: 'm_b.jpg',
    text: 'Rôde dans les canyons des falaises. Trapu comme une hyène, épaules hautes, mâchoire large, pelage brun tacheté. Une crinière de filaments lumineux se dresse sur la nuque quand il menace.',
    build: () => makeQuad({ L: 0.9, hip: 0.56, sh: 0.78, w: 0.13, neck: 0.24, neckRise: 0.03, tail: 0.32, tailDrop: 0.22 }, 1.18,
      { color: 0x4a3828, color2: 0x1c140e, sheen: 0xa08c70, pattern: 'taches', scale: 1, bump: 0.7 },
      (H) => ({
        prims: [
          ell('head', add(H, [0, 0.03, 0.02]), [0.08, 0.075, 0.095], 0.04, 0.2),
          cone('head', add(H, [0, 0.0, 0.05]), add(H, [0, -0.015, 0.2]), 0.065, 0.036, 0.04, 0.1),
          cone('head', add(H, [0, -0.05, 0.02]), add(H, [0, -0.045, 0.17]), 0.048, 0.03, 0.04, 0.05),
          ell('head', add(H, [0, -0.005, 0.205]), [0.024, 0.018, 0.014], 0.012, 0),
          ell('head', add(H, [0.06, 0.1, -0.03]), [0.034, 0.04, 0.012], 0.02, 0.0), ell('head', add(H, [-0.06, 0.1, -0.03]), [0.034, 0.04, 0.012], 0.02, 0.0),
        ],
        eyes: [{ p: add(H, [0.043, 0.045, 0.088]), r: 0.014 }, { p: add(H, [-0.043, 0.045, 0.088]), r: 0.014 }],
        eyeCol: 0xc08030,
      }), 'mane', { layers: 16, length: 0.03, density: 260, color: 0x5a4430, tip: 0x9a8060, detail: 'rodeur', detailScale: 4 }, 'rodeur'),
  },
  {
    id: 'faucheur', letter: 'C', kind: 'meute', name: 'Le Faucheur', people: 'Meute des marais · berges', concept: 'm_c.png',
    text: 'Se glisse dans les roseaux des marais. Bas et allongé comme un grand lézard, pattes écartées, longue queue qui balaie, écailles humides vert-gris, crête de plaques dorsales qui s’illuminent.',
    build: () => makeQuad({ L: 1.25, hip: 0.42, sh: 0.42, w: 0.17, neck: 0.3, neckRise: 0.03, tail: 1.05, tailDrop: 0.1 }, 0.92,
      { color: 0x3c4a34, color2: 0x151b12, sheen: 0x7a9a70, wet: 0.45, pattern: 'veines', scale: 1.2, bump: 0.3, detail: 'cervide', detailScale: 10, detailAmt: 1 },
      (H) => ({
        prims: [
          cone('head', add(H, [0, 0.02, -0.04]), add(H, [0, -0.0, 0.24]), 0.075, 0.03, 0.04, 0.2),
          cone('head', add(H, [0, -0.035, 0.0]), add(H, [0, -0.03, 0.22]), 0.045, 0.022, 0.03, 0.05),
          hole('head', add(H, [0.05, 0.04, 0.06]), [0.016, 0.012, 0.018]), hole('head', add(H, [-0.05, 0.04, 0.06]), [0.016, 0.012, 0.018]),
        ],
        eyes: [{ p: add(H, [0.05, 0.04, 0.055]), r: 0.014 }, { p: add(H, [-0.05, 0.04, 0.055]), r: 0.014 }],
        eyeCol: 0xd0c040,
      }), 'plates', null, 'faucheur'),
  },
];

function boneCrest(b: Body, eyes: V3[]) {
  const eM = lerp3(eyes[0], eyes[1], 0.5);
  const bone = new THREE.MeshPhysicalMaterial({ color: 0xe6dac0, roughness: 0.55, clearcoat: 0.2 });
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const t = i / 5, c = new THREE.Mesh(new THREE.ConeGeometry(0.011 - t * 0.003, 0.055 - Math.abs(t - 0.35) * 0.04, 8), bone);
    c.position.set(0, 0.12 - t * t * 0.07, 0.02 - t * 0.16); c.rotation.x = -0.4 - t * 0.9; c.castShadow = true; g.add(c);
  }
  const nasal = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.06, 0.008), bone); nasal.position.set(0, 0.035, 0.07); nasal.rotation.x = 0.15; g.add(nasal);
  attach(b, 'head', g, add(eM, [0, -0.02, -0.04]));
}

/** Protections naturelles des meutes : épines, cornes, plaques d'os, écailles osseuses. */
function natural(kind: string, b: Body, P: Record<string, V3>) {
  const horn = new THREE.MeshPhysicalMaterial({ color: 0x2a2520, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.4 });
  const bone = new THREE.MeshPhysicalMaterial({ color: 0xd8cab0, roughness: 0.6, clearcoat: 0.15 });
  const spike = (bone_: string, at: V3, len: number, r: number, tilt: number, mat: THREE.Material, side = 0) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(r, len, 8), mat);
    c.geometry.translate(0, len / 2, 0); c.rotation.set(-tilt, 0, side); c.castShadow = true;
    attach(b, bone_, c, at);
  };
  const plate = (bone_: string, at: V3, rad: V3, rx: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    m.scale.set(...rad); m.rotation.x = rx; m.castShadow = true; attach(b, bone_, m, at);
  };
  if (kind === 'lame') {
    for (let i = 0; i < 9; i++) { const t = i / 8, at = lerp3(add(P.neck, [0, 0.07, -0.02]), add(P.pelvis, [0, 0.08, 0]), t); spike(t < 0.2 ? 'neck' : t < 0.7 ? 'spine' : 'pelvis', at, 0.05 - Math.abs(t - 0.4) * 0.04, 0.008, 0.9, horn); }
    for (const sd of [1, -1]) spike('head', add(P.head, [sd * 0.035, 0.08, -0.07]), 0.13, 0.012, 1.25, horn, sd * 0.25);
  }
  if (kind === 'rodeur') {
    for (let i = 0; i < 7; i++) { const t = i / 6, at = lerp3(add(P.head, [0, 0.03, -0.1]), add(P.chest, [0, 0.12, -0.06]), t); plate(t < 0.45 ? 'neck' : 'chest', at, [0.11 - Math.abs(t - 0.5) * 0.06, 0.035, 0.06], -0.25, bone); }
    plate('head', add(P.head, [0, 0.09, 0.03]), [0.06, 0.02, 0.07], 0.1, bone);
    for (const sd of [1, -1]) spike('head', add(P.head, [sd * 0.06, 0.07, -0.02]), 0.09, 0.014, 1.1, bone, sd * 0.5);
  }
  if (kind === 'faucheur') {
    for (let i = 0; i < 16; i++) { const t = i / 15, bn = t < 0.15 ? 'neck' : t < 0.55 ? 'spine' : t < 0.75 ? 'pelvis' : 'tail1'; const at = lerp3(add(P.neck, [0, 0.06, 0]), add(P.tail2, [0, 0.04, 0]), t); for (const sd of [1, -1]) spike(bn, add(at, [sd * 0.055, -0.005, 0]), 0.055, 0.017, 0.35, horn, sd * 0.45); }
    for (let i = 1; i <= 4; i++) spike('tail' + i, add(P['tail' + i], [0, 0.035 - i * 0.004, 0]), 0.075 - i * 0.01, 0.018 - i * 0.002, 0.9, horn);
    for (const sd of [1, -1]) spike('head', add(P.head, [sd * 0.05, 0.05, -0.06]), 0.13, 0.02, 1.4, horn, sd * 0.3);
  }
}

function antler(side: number) {
  const g = new THREE.Group(), mat = M.crystal();
  const seg = (a: V3, b: V3, r: number) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, d.length(), 7), mat);
    m.position.copy(va).add(vb).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(m);
    const j = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 8, 6), mat); j.position.copy(vb); g.add(j);
  };
  const s = side;
  const P: Record<string, V3> = { a: [0, 0, 0], b: [s * 0.07, 0.12, -0.03], c: [s * 0.14, 0.24, -0.06], d: [s * 0.2, 0.33, -0.05], e: [s * 0.13, 0.36, -0.12] };
  seg(P.a, P.b, 0.017); seg(P.b, P.c, 0.013); seg(P.c, P.d, 0.009); seg(P.c, P.e, 0.009);
  seg(P.b, [s * 0.16, 0.14, 0.04], 0.009); seg([s * 0.16, 0.14, 0.04], [s * 0.21, 0.2, 0.06], 0.007);
  seg(P.c, [s * 0.22, 0.25, 0.01], 0.008); seg(P.d, [s * 0.26, 0.37, -0.02], 0.006); seg(P.e, [s * 0.12, 0.44, -0.15], 0.006);
  return { g, mat };
}

function makeQuad(s: QuadSpec, girth: number, skinOpt: SkinOptions,
  head: (H: V3) => { prims: Prim[]; eyes: { p: V3; r: number }[]; eyeCol: number }, crest: 'spine' | 'mane' | 'plates',
  fur: { layers: number; length: number; density: number; color: number; tip: number; detail: string; detailScale: number } | null, id: string): Creature {
  const { joints, P } = quadJoints(s);
  const g = girth, prims: Prim[] = [];
  const mid = (a: string, b: string, t: number) => lerp3(P[a], P[b], t);
  const slim = id === 'lame';
  prims.push(ell('pelvis', add(P.pelvis, [0, 0, 0.02]), [s.w * 1.05 * g, Math.min(0.1, s.hip * 0.2) * g, 0.13], 0.06, 0.4, 1.2));
  prims.push(cone('spine', P.pelvis, P.chest, (slim ? 0.058 : 0.08) * g, 0.11 * g, 0.08, 0.5));
  prims.push(ell('chest', add(P.chest, [0, -Math.min(0.06, s.sh * 0.12) - (slim ? 0.04 : 0), -0.02]), [s.w * 1.15 * g, Math.min(slim ? 0.2 : 0.16, s.sh * 0.27) * g, 0.17 * g], 0.07, 0.4, 1.3));
  prims.push(cone('neck', P.neck, P.head, 0.07 * g, 0.05 * g, 0.06, 0.6));
  for (let i = 1; i <= 4; i++) { const n = 'tail' + i; const next = i < 4 ? P['tail' + (i + 1)] : add(P[n], [0, -0.03, -s.tail / 4]); prims.push(cone(n, P[n], next, 0.05 * g * (1 - (i - 1) * 0.2), 0.05 * g * (1 - i * 0.2) + 0.008, 0.03, 0.7)); }
  for (const n of ['L', 'R']) {
    prims.push(ell('sh' + n, mid('sh' + n, 'elb' + n, 0.3), [0.06 * g, 0.14, 0.085 * g], 0.07, 0.5));
    prims.push(ell('elb' + n, mid('elb' + n, 'wri' + n, 0.25), [0.035 * g, 0.08, 0.04 * g], 0.04, 0.6));
    prims.push(cone('sh' + n, P['sh' + n], P['elb' + n], 0.055 * g, 0.04 * g, 0.05, 0.5));
    prims.push(cone('elb' + n, P['elb' + n], P['wri' + n], 0.035 * g, 0.022 * g, 0.03, 0.6));
    prims.push(cone('wri' + n, P['wri' + n], P['paw' + n], 0.022 * g, 0.024 * g, 0.02, 0.3));
    prims.push(ell('paw' + n, add(P['paw' + n], [0, 0.01, 0.025]), [0.032 * g, 0.02, 0.045 * g], 0.02, 0.1, 1.5));
    prims.push(ell('hip' + n, mid('hip' + n, 'knee' + n, 0.35), [0.07 * g, 0.15, 0.11 * g], 0.08, 0.5));
    prims.push(ell('knee' + n, mid('knee' + n, 'hock' + n, 0.3), [0.035 * g, 0.07, 0.045 * g], 0.04, 0.6));
    prims.push(cone('hip' + n, P['hip' + n], P['knee' + n], 0.065 * g, 0.042 * g, 0.05, 0.5));
    prims.push(cone('knee' + n, P['knee' + n], P['hock' + n], 0.036 * g, 0.021 * g, 0.03, 0.6));
    prims.push(cone('hock' + n, P['hock' + n], P['hpaw' + n], 0.021 * g, 0.023 * g, 0.02, 0.3));
    prims.push(ell('hpaw' + n, add(P['hpaw' + n], [0, 0.01, 0.03]), [0.03 * g, 0.02, 0.046 * g], 0.02, 0.1, 1.5));
  }
  const hd = head(P.head);
  prims.push(...hd.prims);
  if (crest === 'plates') for (let i = 0; i < 12; i++) { const b = lerp3(add(P.neck, [0, 0.05, 0]), add(P.tail2, [0, 0.03, 0]), i / 11); prims.push(ell(i < 2 ? 'neck' : i < 7 ? 'spine' : 'pelvis', add(b, [0, 0.035, 0]), [0.008, 0.035 - Math.abs(i - 5) * 0.003, 0.03], 0.02, 1, 1.3)); }
  if (crest === 'spine') prims.push(cone('spine', add(P.pelvis, [0, 0.09, 0]), add(P.chest, [0, 0.1, -0.05]), 0.016, 0.016, 0.05, 1));
  const skin = makeSkin(skinOpt);
  const body = buildBody(joints, prims, skin, 0.01);
  const glow: THREE.Material[] = [];
  const irises: THREE.MeshBasicMaterial[] = [];
  for (const e of hd.eyes) { const ey = makeEye(e.r, hd.eyeCol, 1.4); irises.push(ey.userData.iris); attach(body, 'head', ey, e.p); }
  let furU: { uWind: { value: number } } | null = null;
  if (fur) furU = addFur(body.mesh, fur);
  natural(id, body, P);
  // crinière de filaments lumineux (Rôdeur)
  const mane: THREE.Object3D[] = [];
  if (crest === 'mane') {
    const fm = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.8 });
    const tipm = glowMat(0x80e8ff, 1.5); glow.push(tipm);
    for (let i = 0; i < 46; i++) {
      const t = i / 45, side = ((i * 37) % 7) / 7 - 0.5;
      const bone = t < 0.5 ? 'neck' : 'chest';
      const base = lerp3(add(P.head, [0, 0.07, -0.08]), add(P.chest, [0, 0.13, -0.18]), t);
      const len = 0.13 + ((i * 13) % 5) * 0.02;
      const f = tube([[0, 0, 0], [side * 0.03, len * 0.6, -0.04], [side * 0.06, len, -0.1]], 0.003, fm, false, 0.001);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 4), tipm); tip.position.set(side * 0.06, len, -0.1); f.add(tip);
      const holder = new THREE.Group(); holder.add(f); holder.position.x = side * 0.05;
      attach(body, bone, holder, add(base, [side * 0.05, 0, 0])); mane.push(holder);
    }
  }
  const group = new THREE.Group(); group.add(body.mesh);
  const calm = new THREE.Color(0.25, 0.9, 1.6);
  return {
    group, body, skin, kind: 'quad',
    update(dt, t, action, emotion) {
      const e = emotion === 'menace' ? 'menace' : 'calme';
      animateQuad(body, action, e, dt);
      const u = skin.userData.skin;
      u.uTime.value = t;
      u.uGlowCol.value.lerp(e === 'menace' ? EMO_COLORS.menace : calm, 1 - Math.exp(-dt * 3));
      u.uGlow.value = e === 'menace' ? 1.5 + Math.sin(t * 7) * 0.3 : 0.8;
      for (const m of glow) (m as THREE.MeshBasicMaterial).color.copy(u.uGlowCol.value).multiplyScalar(0.9);
      for (const ir of irises) ir.color.set(e === 'menace' ? 0xff3010 : hd.eyeCol).multiplyScalar(1.4);
      if (furU) furU.uWind.value = t * 2;
      // la crinière se dresse quand il menace
      const up = e === 'menace' ? 1 : 0;
      for (const h of mane) { h.rotation.x += ((up ? -0.5 : 0.35) - h.rotation.x) * Math.min(1, dt * 4); h.scale.setScalar(h.scale.x + ((up ? 1.25 : 0.85) - h.scale.x) * Math.min(1, dt * 4)); }
    },
  };
}
