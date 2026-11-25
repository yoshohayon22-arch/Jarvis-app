import * as THREE from 'three';
import { buildBody, attach, type Prim, type Body } from './sdf';
import { bipedJoints, quadJoints, animateBiped, animateQuad, type BipedSpec, type QuadSpec, type Action, type Emotion } from './rig';
import { makeSkin, makeEye, type SkinOptions } from './skin';

// Les propositions de l'atelier : quatre Vaëls (avec les variantes des trois clans) et trois meutes.

type V3 = [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cone = (bone: string, a: V3, b: V3, r1: number, r2: number, k = 0.03, mask = 0.5, stiff = 1): Prim => ({ kind: 'cone', bone, a, b, r1, r2, k, mask, stiff });
const ell = (bone: string, a: V3, rad: V3, k = 0.03, mask = 0.5, stiff = 1): Prim => ({ kind: 'ell', bone, a, rad, r1: 0, k, mask, stiff });
const hole = (bone: string, a: V3, rad: V3, k = 0.012): Prim => ({ kind: 'ell', bone, a, rad, r1: 0, k, sub: true });

export type Clan = 'racines' | 'hauteurs' | 'eaux';
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
  eyes: THREE.Group[];
  kind: 'biped' | 'quad';
  digi: boolean;
  setClan?: (c: Clan) => void;
  extraGlow: THREE.Material[];
  update: (dt: number, t: number, action: Action, emotion: Emotion) => void;
}

export interface Design { id: string; letter: string; name: string; text: string; kind: 'vael' | 'meute'; build: () => Creature }

// ---------- Vaëls ----------
interface VaelLook {
  spec: BipedSpec; girth: number; skin: SkinOptions;
  head: (H: V3, P: Record<string, V3>) => { prims: Prim[]; eyes: { p: V3; r: number }[]; extra?: (b: Body, H: V3) => THREE.Material[] };
  fingers: number;
}

function vaelBody(L: VaelLook) {
  const { joints, P } = bipedJoints(L.spec);
  const g = L.girth, s = L.spec;
  const prims: Prim[] = [];
  const mid = (a: string, b: string, t: number) => lerp3(P[a], P[b], t);
  // tronc
  prims.push(ell('hips', add(P.hips, [0, 0.02, 0.0]), [s.hipW * 1.18 * Math.min(g, 1), 0.08, 0.08 * g], 0.08, 0.2, 1.2));
  prims.push(cone('spine', add(P.hips, [0, 0.04, 0.005]), P.chest, 0.08 * g, 0.1 * g, 0.1, 0.25));
  prims.push(ell('chest', add(mid('chest', 'neck', 0.25), [0, 0, 0.008]), [s.shW * 0.8 * g, 0.15, 0.118 * g], 0.07, 0.45, 1.3));
  prims.push(ell('chest', add(mid('chest', 'neck', 0.72), [0, 0, -0.005]), [s.shW * 0.92 * g, 0.06, 0.085 * g], 0.06, 0.5, 1.1)); // trapèzes
  prims.push(ell('chest', add(mid('chest', 'neck', 0.1), [0, 0, 0.05]), [s.shW * 0.55 * g, 0.07, 0.05 * g], 0.05, 0.2)); // poitrine
  prims.push(ell('spine', add(mid('spine', 'chest', 0.4), [0, 0, -0.045]), [0.075 * g, 0.11, 0.05], 0.05, 0.9)); // dos (motifs)
  prims.push(cone('neck', P.neck, P.head, 0.056 * g, 0.044, 0.05, 0.8));
  // bras et mains
  for (const n of ['L', 'R']) {
    const x = n === 'L' ? 1 : -1;
    prims.push(cone('clav' + n, P['clav' + n], P['arm' + n], 0.045 * g, 0.05 * g, 0.05, 0.5));
    prims.push(cone('arm' + n, P['arm' + n], P['fore' + n], 0.042 * g, 0.032 * g, 0.03, 0.8));
    prims.push(ell('arm' + n, add(P['arm' + n], [x * 0.012, -0.03, 0]), [0.052 * g, 0.07, 0.055 * g], 0.04, 0.6)); // deltoïde
    prims.push(ell('arm' + n, mid('arm' + n, 'fore' + n, 0.45), [0.04 * g, 0.08, 0.044 * g], 0.03, 0.6)); // biceps
    prims.push(ell('fore' + n, mid('fore' + n, 'hand' + n, 0.3), [0.036 * g, 0.075, 0.034 * g], 0.03, 0.7)); // avant-bras
    prims.push(cone('fore' + n, P['fore' + n], P['hand' + n], 0.033 * g, 0.022, 0.025, 0.9));
    const hand = P['hand' + n];
    const palm = add(hand, [x * 0.008, -0.045, 0.006]);
    prims.push(ell('hand' + n, palm, [0.016, 0.042, 0.03], 0.02, 0.4, 1.4));
    for (let f = 0; f < L.fingers; f++) {
      const zf = (f - (L.fingers - 1) / 2) * 0.02;
      const base = add(palm, [x * 0.002, -0.035, zf]);
      const len = 0.08 + (f === Math.floor(L.fingers / 2) ? 0.02 : 0);
      prims.push(cone('hand' + n, base, add(base, [x * 0.012, -len, zf * 0.6]), 0.013, 0.009, 0.012, 0.3, 1.5));
    }
    prims.push(cone('hand' + n, add(palm, [x * 0.008, -0.01, 0.03]), add(palm, [x * 0.02, -0.06, 0.06]), 0.013, 0.009, 0.012, 0.3, 1.5)); // pouce
    // jambes
    prims.push(cone('thigh' + n, P['thigh' + n], P['shin' + n], 0.078 * g, 0.048 * g, 0.05, 0.6));
    prims.push(ell('thigh' + n, add(mid('thigh' + n, 'shin' + n, 0.42), [0, 0, 0.018]), [0.062 * g, 0.12, 0.062 * g], 0.05, 0.5)); // cuisse
    prims.push(cone('shin' + n, P['shin' + n], P['foot' + n], 0.046 * g, 0.03, 0.03, 0.8));
    prims.push(ell('shin' + n, add(mid('shin' + n, 'foot' + n, 0.3), [0, 0, s.legs === 'plante' ? -0.03 : 0.02]), [0.045 * g, 0.09, 0.045 * g], 0.04, 0.6)); // mollet
    prims.push(cone('foot' + n, P['foot' + n], P['toe' + n], 0.03, 0.026, 0.025, 0.4));
    const toe = P['toe' + n];
    for (let f = -1; f <= 1; f++) prims.push(cone('toe' + n, toe, add(toe, [x * 0.005 + f * 0.03, -0.012, 0.1 - Math.abs(f) * 0.02]), 0.02, 0.012, 0.02, 0.2, 1.4));
  }
  const head = L.head(P.head, P);
  prims.push(...head.prims);
  const skin = makeSkin(L.skin);
  const body = buildBody(joints, prims, skin, 0.0105);
  const eyes = head.eyes.map(({ p, r }) => attach(body, 'head', makeEye(r, 0xffffff, 0.35), p) as THREE.Group);
  const extra = head.extra?.(body, P.head) ?? [];
  return { body, skin, eyes, P, extra, digi: s.legs === 'digitigrade' };
}

// ---------- parures des clans ----------
const M = {
  wood: () => new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.85 }),
  vine: () => new THREE.MeshStandardMaterial({ color: 0x31452a, roughness: 0.8 }),
  leaf: () => new THREE.MeshStandardMaterial({ color: 0x2f5a35, roughness: 0.6, side: THREE.DoubleSide, emissive: new THREE.Color(0x0a3020), emissiveIntensity: 0.6 }),
  bone: () => new THREE.MeshStandardMaterial({ color: 0xd9cdb4, roughness: 0.55 }),
  flint: () => new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.3, metalness: 0.1 }),
  feather: () => new THREE.MeshStandardMaterial({ color: 0xb2522c, roughness: 0.7, side: THREE.DoubleSide }),
  shell: () => new THREE.MeshPhysicalMaterial({ color: 0xe7e2f0, roughness: 0.25, iridescence: 1, iridescenceIOR: 1.6, clearcoat: 1 }),
  net: () => new THREE.MeshStandardMaterial({ color: 0x6b6a52, roughness: 0.9 }),
  seed: () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 0.9) }),
};
function tube(points: V3[], r: number, mat: THREE.Material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, points.length * 10), r, 8, closed), mat);
}
function ring(c: V3, rx: number, rz: number, wob: number, n = 14): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push([c[0] + Math.sin(a) * rx, c[1] + Math.sin(a * 3) * wob - (Math.cos(a) > 0 ? 0.03 : 0), c[2] + Math.cos(a) * rz]); }
  return out;
}
function leafGeo(w: number, h: number) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(w, h * 0.4, 0, h); s.quadraticCurveTo(-w, h * 0.4, 0, 0);
  const g = new THREE.ShapeGeometry(s, 6); g.rotateX(Math.PI); return g;
}

function clanSets(b: Body, P: Record<string, V3>, shW: number) {
  const sets: Record<Clan, THREE.Object3D[]> = { racines: [], hauteurs: [], eaux: [] };
  const neckC = add(P.neck, [0, 0.0, 0.01]), hand = P.handR;
  // Racines : collier de lianes, pagne de feuilles, bâton noueux avec une graine lumineuse
  {
    const necklace = tube(ring([0, 0, 0], 0.07, 0.065, 0.006), 0.007, M.vine(), true);
    sets.racines.push(attach(b, 'chest', necklace, add(neckC, [0, -0.01, 0])));
    const skirt = new THREE.Group(), lg = leafGeo(0.05, 0.24), lm = M.leaf();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const l = new THREE.Mesh(lg, lm); l.position.set(Math.sin(a) * 0.12, 0.03, Math.cos(a) * 0.1); l.rotation.set(0.15 * Math.cos(a), a, 0.15 * Math.sin(a)); skirt.add(l);
    }
    sets.racines.push(attach(b, 'hips', skirt, P.hips));
    const staff = new THREE.Group();
    staff.add(tube([[0, 0.35, 0], [0.01, 0.1, 0.01], [-0.01, -0.3, 0], [0.01, -0.7, 0.01], [0, -1.15, 0]], 0.016, M.wood()));
    const seed = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), M.seed()); seed.position.y = 0.38; staff.add(seed);
    sets.racines.push(attach(b, 'handR', staff, add(hand, [-0.01, -0.06, 0.04])));
  }
  // Hauteurs : épaulière d'os, lance à pointe de silex, bandeau de plumes
  {
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.bone());
    pad.scale.set(1, 0.6, 1.1);
    sets.hauteurs.push(attach(b, 'armL', pad, add(P.armL, [0.01, 0.025, 0])));
    const spear = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 2.1, 10), M.wood()); spear.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 4), M.flint()); tip.position.y = 1.14; tip.scale.z = 0.35; spear.add(tip);
    sets.hauteurs.push(attach(b, 'handR', spear, add(hand, [-0.01, -0.06, 0.04])));
    const band = new THREE.Group();
    band.add(tube(ring([0, 0, 0], 0.07, 0.08, 0.002), 0.006, M.bone(), true));
    const fm = M.feather();
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(leafGeo(0.025, 0.2), fm); f.position.set(0.05 - i * 0.012, 0.01, -0.06); f.rotation.set(-2.5 + i * 0.12, 0.4, 0); band.add(f); }
    sets.hauteurs.push(attach(b, 'head', band, add(P.head, [0, 0.11, -0.005])));
  }
  // Eaux : collier de coquillages irisés, filet porté en écharpe, harpon à trois pointes
  {
    const shells = new THREE.Group(), sg = new THREE.SphereGeometry(0.016, 12, 8), sm = M.shell();
    ring([0, 0, 0], 0.075, 0.07, 0.004, 16).forEach((p) => { const s = new THREE.Mesh(sg, sm); s.position.set(...p); s.scale.set(1, 0.6, 1.3); shells.add(s); });
    shells.add(tube(ring([0, 0, 0], 0.075, 0.07, 0.004, 16), 0.003, M.net(), true));
    sets.eaux.push(attach(b, 'chest', shells, add(neckC, [0, -0.01, 0])));
    const sash = tube([[shW * 0.9, 0.06, 0.07], [0, -0.06, 0.11], [-shW * 0.8, -0.2, 0.09], [-shW * 0.9, -0.24, -0.02], [-0.02, -0.08, -0.11], [shW * 0.85, 0.07, -0.06]], 0.012, M.net(), true);
    sets.eaux.push(attach(b, 'chest', sash, P.chest));
    const harp = new THREE.Group();
    harp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 1.7, 10), M.wood()));
    for (let i = -1; i <= 1; i++) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.16, 6), M.bone()); p.position.set(i * 0.025, 0.92, 0); p.rotation.z = -i * 0.12; harp.add(p); }
    sets.eaux.push(attach(b, 'handR', harp, add(hand, [-0.01, -0.06, 0.04])));
  }
  return sets;
}

function makeVael(L: VaelLook, clanSkin: Record<Clan, Partial<SkinOptions> & { tint?: number }>): Creature {
  const { body, skin, eyes, P, extra, digi } = vaelBody(L);
  const group = new THREE.Group(); group.add(body.mesh);
  const sets = clanSets(body, P, L.spec.shW);
  const base = new THREE.Color(L.skin.color);
  const setClan = (c: Clan) => {
    for (const [k, list] of Object.entries(sets)) for (const o of list) o.visible = k === c;
    const cs = clanSkin[c];
    skin.color.copy(base).lerp(new THREE.Color(cs.tint ?? L.skin.color), 0.35);
    skin.clearcoat = cs.wet ?? L.skin.wet ?? 0;
  };
  setClan('racines');
  return {
    group, body, skin, eyes, kind: 'biped', digi, setClan, extraGlow: extra,
    update(dt, t, action, emotion) {
      animateBiped(body, action, emotion, dt, digi);
      const u = skin.userData.skin;
      u.uTime.value = t;
      u.uGlowCol.value.lerp(EMO_COLORS[emotion], 1 - Math.exp(-dt * 3));
      u.uGlow.value = emotion === 'colere' ? 1.35 + Math.sin(t * 9) * 0.25 : emotion === 'tristesse' ? 0.55 : 1;
      for (const m of extra) (m as THREE.MeshPhysicalMaterial).emissive.copy(u.uGlowCol.value).multiplyScalar(0.35);
      // clignement des yeux
      const blink = (t % 4.3) < 0.12 ? 0.1 : 1;
      for (const e of eyes) e.scale.y += (blink - e.scale.y) * 0.5;
    },
  };
}

const CLAN_SKIN: Record<Clan, { tint: number; wet?: number }> = {
  racines: { tint: 0x2e4a3a }, hauteurs: { tint: 0x5a4636 }, eaux: { tint: 0x23465a, wet: 0.65 },
};

function crystalAntler(side: number) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x9fe8ff, roughness: 0.08, transmission: 0.6, thickness: 0.05, transparent: true, opacity: 0.9, emissive: new THREE.Color(0.1, 0.45, 0.7), emissiveIntensity: 0.8 });
  const seg = (a: V3, b: V3, r: number) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r, d.length(), 6), mat);
    m.position.copy(va).add(vb).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(m);
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.9), mat); tip.position.copy(vb); g.add(tip);
  };
  const s = side;
  seg([0, 0, 0], [s * 0.06, 0.12, -0.04], 0.018);
  seg([s * 0.06, 0.12, -0.04], [s * 0.1, 0.26, -0.1], 0.014);
  seg([s * 0.06, 0.12, -0.04], [s * 0.15, 0.17, 0.02], 0.01);
  seg([s * 0.1, 0.26, -0.1], [s * 0.18, 0.33, -0.08], 0.009);
  seg([s * 0.1, 0.26, -0.1], [s * 0.07, 0.38, -0.17], 0.009);
  return { g, mat };
}

export const DESIGNS: Design[] = [
  {
    id: 'sylphe', letter: 'A', kind: 'vael', name: 'Le Sylphe',
    text: 'Très élancé, jambes d’échassier qui marchent sur la pointe des pieds. Crâne allongé sans nez, grands yeux noirs, deux nageoires de peau lumineuse derrière la tête. Veines de lumière fines comme des racines.',
    build: () => makeVael({
      spec: { H: 2.05, legs: 'digitigrade', hipW: 0.085, shW: 0.17, arm: 0.43, neck: 0.2 }, girth: 0.9, fingers: 3,
      skin: { color: 0x1d2a3a, color2: 0x0b1019, sheen: 0x5f86b0, pattern: 'veines', scale: 1.1, bump: 0.8 },
      head: (H) => ({
        prims: [
          cone('head', add(H, [0, 0.11, -0.05]), add(H, [0, 0.06, 0.12]), 0.068, 0.034, 0.05, 0.4),
          cone('head', add(H, [0, 0.025, 0.0]), add(H, [0, 0.02, 0.1]), 0.04, 0.02, 0.04, 0.1),
          ell('head', add(H, [0, 0.12, -0.02]), [0.06, 0.06, 0.08], 0.05, 0.4),
          hole('head', add(H, [0.043, 0.078, 0.078]), [0.024, 0.02, 0.022]), hole('head', add(H, [-0.043, 0.078, 0.078]), [0.024, 0.02, 0.022]),
          hole('head', add(H, [0, 0.03, 0.115]), [0.022, 0.003, 0.02], 0.006),
          ell('head', add(H, [0.06, 0.11, -0.09]), [0.008, 0.04, 0.1], 0.025, 1), ell('head', add(H, [-0.06, 0.11, -0.09]), [0.008, 0.04, 0.1], 0.025, 1),
        ],
        eyes: [{ p: add(H, [0.04, 0.078, 0.072]), r: 0.02 }, { p: add(H, [-0.04, 0.078, 0.072]), r: 0.02 }],
      }),
    }, CLAN_SKIN),
  },
  {
    id: 'veilleur', letter: 'B', kind: 'vael', name: 'Le Veilleur',
    text: 'Le plus proche d’une silhouette humaine : larges épaules, pieds à plat, crâne en goutte avec une arcade marquée. Quatre yeux : deux grands pour voir, deux petits au-dessus qui captent la lumière. Taches lumineuses en constellations.',
    build: () => makeVael({
      spec: { H: 1.92, legs: 'plante', hipW: 0.1, shW: 0.2, arm: 0.42, neck: 0.13 }, girth: 1.12, fingers: 4,
      skin: { color: 0x4a4458, color2: 0x241f2d, sheen: 0x9a88b8, pattern: 'taches', scale: 1, bump: 1.1 },
      head: (H) => ({
        prims: [
          ell('head', add(H, [0, 0.1, 0.0]), [0.078, 0.1, 0.088], 0.05, 0.4),
          cone('head', add(H, [-0.06, 0.112, 0.07]), add(H, [0.06, 0.112, 0.07]), 0.021, 0.021, 0.03, 0.2),
          ell('head', add(H, [0, 0.045, 0.065]), [0.05, 0.04, 0.05], 0.04, 0.05),
          ell('head', add(H, [0, 0.02, 0.04]), [0.045, 0.03, 0.05], 0.04, 0.05),
          hole('head', add(H, [0.04, 0.087, 0.082]), [0.025, 0.02, 0.022]), hole('head', add(H, [-0.04, 0.087, 0.082]), [0.025, 0.02, 0.022]),
          hole('head', add(H, [0.055, 0.135, 0.065]), [0.013, 0.011, 0.013]), hole('head', add(H, [-0.055, 0.135, 0.065]), [0.013, 0.011, 0.013]),
          hole('head', add(H, [0, 0.035, 0.11]), [0.026, 0.004, 0.02], 0.006),
        ],
        eyes: [{ p: add(H, [0.04, 0.086, 0.076]), r: 0.02 }, { p: add(H, [-0.04, 0.086, 0.076]), r: 0.02 }, { p: add(H, [0.054, 0.135, 0.06]), r: 0.011 }, { p: add(H, [-0.054, 0.135, 0.06]), r: 0.011 }],
      }),
    }, CLAN_SKIN),
  },
  {
    id: 'echassier', letter: 'C', kind: 'vael', name: 'L’Échassier',
    text: 'Grand et penché vers l’avant, longs bras qui descendent jusqu’aux genoux, peau d’amphibien légèrement humide. Une couronne de frondes souples sur la tête, dont les pointes s’allument. Bandes lumineuses ondulantes.',
    build: () => makeVael({
      spec: { H: 2.12, legs: 'digitigrade', hipW: 0.085, shW: 0.18, arm: 0.52, neck: 0.16, lean: 0.07 }, girth: 0.95, fingers: 3,
      skin: { color: 0x2f4a44, color2: 0x15221f, sheen: 0x6fb0a0, wet: 0.35, pattern: 'rayures', scale: 1, bump: 0.7 },
      head: (H) => {
        const prims: Prim[] = [
          cone('head', add(H, [0, 0.07, -0.04]), add(H, [0, 0.045, 0.17]), 0.062, 0.024, 0.05, 0.3),
          cone('head', add(H, [0, 0.02, 0.0]), add(H, [0, 0.025, 0.14]), 0.036, 0.016, 0.04, 0.1),
          hole('head', add(H, [0.04, 0.072, 0.07]), [0.021, 0.018, 0.02]), hole('head', add(H, [-0.04, 0.072, 0.07]), [0.021, 0.018, 0.02]),
        ];
        for (let i = 0; i < 7; i++) {
          const a = (i / 6 - 0.5) * 2.2, base = add(H, [Math.sin(a) * 0.045, 0.11, -0.02 + Math.cos(a) * 0.02]);
          prims.push(cone('head', base, add(base, [Math.sin(a) * 0.1, 0.16 - Math.abs(a) * 0.04, -0.12]), 0.016, 0.008, 0.02, 1, 1.5));
        }
        return { prims, eyes: [{ p: add(H, [0.038, 0.072, 0.064]), r: 0.018 }, { p: add(H, [-0.038, 0.072, 0.064]), r: 0.018 }] };
      },
    }, CLAN_SKIN),
  },
  {
    id: 'cervide', letter: 'D', kind: 'vael', name: 'Le Cervidé',
    text: 'Visage plat et calme, peau fine couverte de minuscules écailles, deux bois de cristal translucides qui poussent du crâne et brillent avec l’émotion. Motifs en spirales, comme les fresques de la balise.',
    build: () => makeVael({
      spec: { H: 1.98, legs: 'plante', hipW: 0.095, shW: 0.185, arm: 0.43, neck: 0.16 }, girth: 1.0, fingers: 3,
      skin: { color: 0x3b302a, color2: 0x1d1714, sheen: 0xb09070, pattern: 'spirales', scale: 1.1, bump: 0.6, scales: 0.8 },
      head: (H) => ({
        prims: [
          ell('head', add(H, [0, 0.09, 0.01]), [0.07, 0.09, 0.078], 0.05, 0.4),
          ell('head', add(H, [0, 0.04, 0.07]), [0.046, 0.035, 0.038], 0.04, 0.1),
          cone('head', add(H, [0.055, 0.075, 0.05]), add(H, [-0.055, 0.075, 0.05]), 0.016, 0.016, 0.03, 0.2),
          hole('head', add(H, [0.044, 0.088, 0.072]), [0.021, 0.017, 0.02]), hole('head', add(H, [-0.044, 0.088, 0.072]), [0.021, 0.017, 0.02]),
          hole('head', add(H, [0, 0.025, 0.1]), [0.02, 0.003, 0.02], 0.006),
        ],
        eyes: [{ p: add(H, [0.042, 0.088, 0.066]), r: 0.017 }, { p: add(H, [-0.042, 0.088, 0.066]), r: 0.017 }],
        extra: (b, Hd) => {
          const mats: THREE.Material[] = [];
          for (const s of [1, -1]) { const a = crystalAntler(s); attach(b, 'head', a.g, add(Hd, [s * 0.04, 0.16, -0.02])); mats.push(a.mat); }
          return mats;
        },
      }),
    }, CLAN_SKIN),
  },
  // ---------- meutes ----------
  {
    id: 'lame', letter: 'A', kind: 'meute', name: 'La Lame',
    text: 'Svelte comme un lévrier, très haute sur pattes, long museau et grandes oreilles. Quatre yeux en deux paires, une ligne de lumière le long de l’échine qu’on voit filer dans la nuit.',
    build: () => makeQuad({ L: 0.95, hip: 0.66, sh: 0.66, w: 0.1, neck: 0.3, neckRise: 0.16, tail: 0.62 }, 0.85,
      { color: 0x2c3138, color2: 0x12151a, sheen: 0x8aa0b8, pattern: 'rayures', scale: 1.3, bump: 1.2 },
      (H) => ({
        prims: [
          cone('head', add(H, [0, 0.04, -0.06]), add(H, [0, -0.0, 0.2]), 0.065, 0.022, 0.04, 0.3),
          cone('head', add(H, [0, -0.025, -0.02]), add(H, [0, -0.03, 0.17]), 0.035, 0.016, 0.04, 0.1),
          cone('head', add(H, [0.035, 0.07, -0.05]), add(H, [0.06, 0.2, -0.08]), 0.03, 0.006, 0.02, 0.8, 1.5),
          cone('head', add(H, [-0.035, 0.07, -0.05]), add(H, [-0.06, 0.2, -0.08]), 0.03, 0.006, 0.02, 0.8, 1.5),
          hole('head', add(H, [0.035, 0.045, 0.05]), [0.016, 0.012, 0.016]), hole('head', add(H, [-0.035, 0.045, 0.05]), [0.016, 0.012, 0.016]),
          hole('head', add(H, [0.03, 0.035, 0.1]), [0.011, 0.009, 0.011]), hole('head', add(H, [-0.03, 0.035, 0.1]), [0.011, 0.009, 0.011]),
        ],
        eyes: [{ p: add(H, [0.034, 0.045, 0.045]), r: 0.014 }, { p: add(H, [-0.034, 0.045, 0.045]), r: 0.014 }, { p: add(H, [0.029, 0.035, 0.095]), r: 0.009 }, { p: add(H, [-0.029, 0.035, 0.095]), r: 0.009 }],
      }), 'spine'),
  },
  {
    id: 'rodeur', letter: 'B', kind: 'meute', name: 'Le Rôdeur',
    text: 'Trapu comme une hyène, épaules hautes et dos qui descend vers l’arrière, mâchoire large. Une crinière de filaments lumineux se dresse sur la nuque quand il menace. Taches claires sur un pelage sombre.',
    build: () => makeQuad({ L: 0.88, hip: 0.52, sh: 0.74, w: 0.14, neck: 0.24, neckRise: 0.04, tail: 0.34, tailDrop: 0.2 }, 1.2,
      { color: 0x3a3229, color2: 0x17130f, sheen: 0xa08c70, pattern: 'taches', scale: 1, bump: 1.4 },
      (H) => ({
        prims: [
          ell('head', add(H, [0, 0.03, 0.02]), [0.085, 0.08, 0.1], 0.04, 0.2),
          cone('head', add(H, [0, 0.01, 0.05]), add(H, [0, -0.01, 0.19]), 0.07, 0.04, 0.04, 0.1),
          cone('head', add(H, [0, -0.045, 0.02]), add(H, [0, -0.045, 0.16]), 0.05, 0.03, 0.04, 0.05),
          ell('head', add(H, [0.065, 0.09, -0.03]), [0.03, 0.04, 0.012], 0.02, 0.4), ell('head', add(H, [-0.065, 0.09, -0.03]), [0.03, 0.04, 0.012], 0.02, 0.4),
          hole('head', add(H, [0.045, 0.05, 0.09]), [0.017, 0.013, 0.016]), hole('head', add(H, [-0.045, 0.05, 0.09]), [0.017, 0.013, 0.016]),
        ],
        eyes: [{ p: add(H, [0.043, 0.05, 0.085]), r: 0.015 }, { p: add(H, [-0.043, 0.05, 0.085]), r: 0.015 }],
      }), 'mane'),
  },
  {
    id: 'faucheur', letter: 'C', kind: 'meute', name: 'Le Faucheur',
    text: 'Bas et allongé comme un grand lézard, pattes écartées, longue queue qui balaie. Écailles fines et humides, crête de plaques dorsales qui s’illuminent. Il se fond dans les herbes hautes.',
    build: () => makeQuad({ L: 1.25, hip: 0.4, sh: 0.4, w: 0.17, neck: 0.3, neckRise: 0.02, tail: 1.05, tailDrop: 0.3 }, 1.05,
      { color: 0x2f3a2c, color2: 0x141a12, sheen: 0x7a9a70, wet: 0.35, pattern: 'veines', scale: 1.2, bump: 0.6, scales: 1 },
      (H) => ({
        prims: [
          cone('head', add(H, [0, 0.02, -0.04]), add(H, [0, -0.0, 0.24]), 0.075, 0.03, 0.04, 0.2),
          cone('head', add(H, [0, -0.035, 0.0]), add(H, [0, -0.03, 0.22]), 0.045, 0.022, 0.03, 0.05),
          hole('head', add(H, [0.05, 0.04, 0.06]), [0.016, 0.012, 0.018]), hole('head', add(H, [-0.05, 0.04, 0.06]), [0.016, 0.012, 0.018]),
        ],
        eyes: [{ p: add(H, [0.05, 0.04, 0.055]), r: 0.014 }, { p: add(H, [-0.05, 0.04, 0.055]), r: 0.014 }],
      }), 'plates'),
  },
];

function makeQuad(s: QuadSpec, girth: number, skinOpt: SkinOptions,
  head: (H: V3) => { prims: Prim[]; eyes: { p: V3; r: number }[] }, crest: 'spine' | 'mane' | 'plates'): Creature {
  const { joints, P } = quadJoints(s);
  const g = girth, prims: Prim[] = [];
  const mid = (a: string, b: string, t: number) => lerp3(P[a], P[b], t);
  prims.push(ell('pelvis', add(P.pelvis, [0, 0, 0.02]), [s.w * 1.05 * g, Math.min(0.1, s.hip * 0.2) * g, 0.13], 0.06, 0.4, 1.2));
  prims.push(cone('spine', P.pelvis, P.chest, 0.08 * g, 0.11 * g, 0.08, 0.5));
  prims.push(ell('chest', add(P.chest, [0, -Math.min(0.06, s.sh * 0.12), -0.02]), [s.w * 1.15 * g, Math.min(0.16, s.sh * 0.26) * g, 0.17 * g], 0.07, 0.4, 1.3));
  prims.push(cone('neck', P.neck, P.head, 0.07 * g, 0.05 * g, 0.06, 0.6));
  // queue
  let prev = 'pelvis';
  for (let i = 1; i <= 4; i++) { const n = 'tail' + i; const next = i < 4 ? P['tail' + (i + 1)] : add(P[n], [0, -0.03, -s.tail / 4]); prims.push(cone(n, P[n], next, 0.05 * g * (1 - (i - 1) * 0.2), 0.05 * g * (1 - i * 0.2) + 0.008, 0.03, 0.7)); prev = n; }
  void prev;
  for (const n of ['L', 'R']) {
    prims.push(ell('sh' + n, mid('sh' + n, 'elb' + n, 0.3), [0.06 * g, 0.14, 0.085 * g], 0.07, 0.5));
    prims.push(ell('elb' + n, mid('elb' + n, 'wri' + n, 0.25), [0.035 * g, 0.08, 0.04 * g], 0.04, 0.6));
    prims.push(cone('sh' + n, P['sh' + n], P['elb' + n], 0.055 * g, 0.04 * g, 0.05, 0.5));
    prims.push(cone('elb' + n, P['elb' + n], P['wri' + n], 0.035 * g, 0.024 * g, 0.03, 0.6));
    prims.push(cone('wri' + n, P['wri' + n], P['paw' + n], 0.024 * g, 0.026 * g, 0.02, 0.3));
    prims.push(ell('paw' + n, add(P['paw' + n], [0, 0.01, 0.025]), [0.034 * g, 0.02, 0.045 * g], 0.02, 0.1, 1.5));
    prims.push(ell('hip' + n, mid('hip' + n, 'knee' + n, 0.35), [0.07 * g, 0.15, 0.11 * g], 0.08, 0.5));
    prims.push(ell('knee' + n, mid('knee' + n, 'hock' + n, 0.3), [0.035 * g, 0.07, 0.045 * g], 0.04, 0.6));
    prims.push(cone('hip' + n, P['hip' + n], P['knee' + n], 0.065 * g, 0.042 * g, 0.05, 0.5));
    prims.push(cone('knee' + n, P['knee' + n], P['hock' + n], 0.038 * g, 0.022 * g, 0.03, 0.6));
    prims.push(cone('hock' + n, P['hock' + n], P['hpaw' + n], 0.022 * g, 0.024 * g, 0.02, 0.3));
    prims.push(ell('hpaw' + n, add(P['hpaw' + n], [0, 0.01, 0.03]), [0.032 * g, 0.02, 0.048 * g], 0.02, 0.1, 1.5));
  }
  const hd = head(P.head);
  prims.push(...hd.prims);
  // crête / crinière / plaques : appendices lumineux le long du dos
  if (crest === 'mane') for (let i = 0; i < 12; i++) { const b = lerp3(add(P.head, [0, 0.07, -0.06]), add(P.chest, [0, 0.12, -0.12]), i / 11); prims.push(cone(i < 6 ? 'neck' : 'chest', b, add(b, [(i % 2 ? 0.02 : -0.02), 0.15 - i * 0.006, -0.08]), 0.02, 0.006, 0.02, 1, 1.4)); }
  if (crest === 'plates') for (let i = 0; i < 10; i++) { const b = lerp3(add(P.neck, [0, 0.05, 0]), add(P.tail2, [0, 0.03, 0]), i / 9); prims.push(ell(i < 2 ? 'neck' : i < 6 ? 'spine' : 'pelvis', add(b, [0, 0.035, 0]), [0.008, 0.035 - Math.abs(i - 4) * 0.003, 0.03], 0.02, 1, 1.3)); }
  if (crest === 'spine') prims.push(cone('spine', add(P.pelvis, [0, 0.1, 0]), add(P.chest, [0, 0.12, -0.05]), 0.02, 0.02, 0.05, 1));
  const skin = makeSkin(skinOpt);
  const body = buildBody(joints, prims, skin, 0.0115);
  const eyes = hd.eyes.map(({ p, r }) => attach(body, 'head', makeEye(r, 0x7ff0ff, 1.6), p) as THREE.Group);
  const group = new THREE.Group(); group.add(body.mesh);
  return {
    group, body, skin, eyes, kind: 'quad', digi: true, extraGlow: [],
    update(dt, t, action, emotion) {
      const e = emotion === 'menace' ? 'menace' : 'calme';
      animateQuad(body, action, e, dt);
      const u = skin.userData.skin;
      u.uTime.value = t;
      u.uGlowCol.value.lerp(e === 'menace' ? EMO_COLORS.menace : new THREE.Color(0.25, 0.9, 1.6), 1 - Math.exp(-dt * 3));
      u.uGlow.value = e === 'menace' ? 1.5 + Math.sin(t * 7) * 0.3 : 0.8;
      for (const ey of eyes) (ey.userData.iris as THREE.MeshBasicMaterial).color.copy(u.uGlowCol.value).multiplyScalar(1.1);
    },
  };
}
