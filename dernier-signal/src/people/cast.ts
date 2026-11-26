import * as THREE from 'three';
import { animateBiped, type Action, type Emotion } from '../species/rig';
import { EMO_COLORS } from '../species/designs';
import { loadPeople, makeFigure, setShape, updateFace, boneIndex, restPositions, type Figure, type Face, type PeopleAsset } from './asset';
import { metalMaterial, prepGeo, CLANS, type ClanId, type MetalOptions } from './metal';
import { buildHair, hairMaterial, type HairStyle } from './hair';

// Les personnages de l'atelier : humains en acier, Vaëls en cuivre, souvenirs en or.

type V3 = THREE.Vector3;
export interface Person {
  id: string; letter: string; name: string; sub: string; text: string; kind: 'humain' | 'vael' | 'souvenir';
  group: THREE.Group; fig: Figure; body: Figure['body'];
  mats: THREE.MeshPhysicalMaterial[];
  age?: number; setAge?: (a: number) => void;
  expr: Face | null; setTalk: (on: boolean) => void;
  replay?: (v?: number) => void;
  eyeWorld: (out: V3) => V3;
  update: (dt: number, t: number, action: Action, emotion: Emotion) => void;
}

// ---------- outils ----------
function boneW(a: PeopleAsset) {
  const idx = Object.fromEntries(a.meta.bones.map((b, i) => [b.name, i]));
  return (i: number, names: string[]) => {
    let w = 0;
    for (let k = 0; k < 4; k++) { const bi = a.skin.idx[i * 4 + k]; for (const n of names) if (idx[n] === bi) w += a.skin.w[i * 4 + k] / 255; }
    return w;
  };
}
const J = (a: PeopleAsset, n: string) => new THREE.Vector3(...a.meta.joints[boneIndex(a, n)]);
/** Position du point sur le segment a→b (0 au début, 1 à la fin). */
function along(p: V3, a: V3, b: V3) { const d = b.clone().sub(a); return p.clone().sub(a).dot(d) / d.lengthSq(); }

interface Outfit { scalp?: number; recede?: number; sleeve: number; shirtLow: number; trousers: boolean; cuff: number; boots: number; beard?: boolean; brows?: boolean; sash?: boolean; wrap?: boolean; suit?: boolean }

/** Vêtements sculptés : épaisseur (mm) et finition pour chaque sommet du corps de base. */
function outfit(a: PeopleAsset, o: Outfit) {
  const n = a.meta.verts, P = a.base, out = new Float32Array(n * 2), W = boneW(a);
  const hips = J(a, 'hips'), neck = J(a, 'neck'), head = J(a, 'head');
  const eyes = a.meta.eyes.map((e) => new THREE.Vector3(...e));
  const eyeY = (eyes[0].y + eyes[1].y) / 2, s = a.height / 1.74;
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromArray(P, i * 3);
    let th = 0, id = 0;
    const side = p.x >= 0 ? 'L' : 'R';
    const torso = W(i, ['hips', 'spine', 'chest', 'clavL', 'clavR']);
    const arm = W(i, ['arm' + side]), fore = W(i, ['fore' + side]), hand = W(i, ['hand' + side]);
    const legs = W(i, ['thigh' + side, 'shin' + side]), foot = W(i, ['foot' + side, 'toe' + side]);
    const shin = J(a, 'shin' + side), ankle = J(a, 'foot' + side);
    // haut : buste et manches
    const tF = along(p, J(a, 'fore' + side), J(a, 'hand' + side));
    if (o.suit || o.sleeve >= 0) {
      if (torso > 0.45 && p.y < neck.y + 0.012 * s && p.y > hips.y - o.shirtLow * s) { th = 9; id = 0; }
      if (arm > 0.4) { th = 8; id = 0; }
      if ((fore > 0.4 || hand > 0.3) && tF < o.sleeve) { th = tF > o.sleeve - 0.07 ? 13 : 7 + tF * 4; id = 0; } // revers de manche
    }
    // bas : pantalon et bottes
    if (o.trousers && p.y < hips.y + 0.07 * s && (legs > 0.4 || torso > 0.4) && p.y > ankle.y + o.cuff * s) {
      if (!(th > 0 && p.y > hips.y - o.shirtLow * s + 0.03 * s)) { th = 8; id = 1; }
    }
    if (o.boots > 0 && (foot > 0.3 || legs > 0.3) && p.y < ankle.y + o.boots * s) { th = 7; id = 2; }
    if (o.boots > 0 && p.y < ankle.y + o.boots * s && p.y > ankle.y + o.boots * s - 0.012 * s && (foot > 0.3 || legs > 0.3)) th = 10;
    // pagne et écharpe (Vaëls)
    if (o.wrap && (legs > 0.3 || torso > 0.4) && p.y < hips.y + 0.05 * s && p.y > THREE.MathUtils.lerp(shin.y, hips.y, 0.5)) { th = 9; id = 1; }
    if (o.sash && torso > 0.5 && p.y > hips.y + 0.1 * s && Math.abs(p.x * 0.8 + (p.y - (hips.y + 0.33 * s))) < 0.045 * s) { th = 6; id = 0; }
    // sourcils et barbe sculptés
    const hw = W(i, ['head']);
    if (hw > 0.7) {
      for (const e of eyes) {
        const dx = (p.x - e.x) * Math.sign(e.x), dy = p.y - e.y;
        const mid = 0.019 * s + dx * 0.15 - dx * dx * 9;
        if (p.z > head.z && o.brows === true && Math.abs(dx) < 0.026 * s && Math.abs(dy - mid) < 0.0055 * s && p.z > e.z - 0.004) { th = 2.2; id = 3; }
      }
      if (o.scalp) { // cuir chevelu sculpté sous les fils
        const f = (p.z - head.z) / (0.1 * s);
        const line = f > -0.3 ? eyeY + (0.03 + Math.max(0, f) * 0.035 + (o.recede ?? 0) * 0.04) * s : eyeY - 0.04 * s;
        const sideOk = Math.abs(p.x) < 0.06 * s || p.y > eyeY + 0.02 * s || f < -0.3;
        if (p.y > line && sideOk) { th = o.scalp; id = 3; }
      }
      if (o.beard) {
        const mouthY = eyeY - 0.072 * s;
        const lips = Math.abs(p.x) < 0.03 * s && p.y > mouthY - 0.014 * s && p.y < mouthY + 0.017 * s;
        const cheek = p.y < eyeY - 0.038 * s - Math.max(0, 0.03 - Math.abs(p.x)) * 0.6;
        if (cheek && !lips && p.z > head.z + 0.01 * s && p.y > neck.y) { th = 6; id = 3; }
      }
    }
    out[i * 2] = th; out[i * 2 + 1] = id;
  }
  // bords adoucis : l'épaisseur s'amincit vers le bord au lieu de former une marche
  const tri = a.geo.index!.array as ArrayLike<number>;
  for (let it = 0; it < 3; it++) {
    const sum = new Float32Array(n), cnt = new Float32Array(n), best = new Float32Array(n), bid = new Float32Array(n);
    for (let k = 0; k < tri.length; k += 3) for (let e = 0; e < 3; e++) {
      const u = tri[k + e], v = tri[k + (e + 1) % 3];
      for (const [x, y] of [[u, v], [v, u]]) { sum[x] += out[y * 2]; cnt[x]++; if (out[y * 2] > best[x]) { best[x] = out[y * 2]; bid[x] = out[y * 2 + 1]; } }
    }
    for (let i = 0; i < n; i++) {
      const was = out[i * 2];
      out[i * 2] = (was * 2 + sum[i]) / (2 + cnt[i]);
      if (was === 0 && out[i * 2] > 0) out[i * 2 + 1] = bid[i];
    }
  }
  return out;
}

/** Yeux sculptés dans le métal : iris gravé, pupille creusée. */
function eyeGeo(r: number) {
  const g = new THREE.SphereGeometry(r, 28, 18); g.rotateX(Math.PI / 2);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const th = Math.acos(THREE.MathUtils.clamp(v.z / r, -1, 1)), ph = Math.atan2(v.y, v.x);
    let k = 1;
    if (th < 0.55) k -= 0.05 * (1 - th / 0.55) - Math.sin(ph * 22) * 0.006 * (th > 0.2 ? 1 : 0);
    if (th < 0.2) k -= 0.12 * (1 - th / 0.2);
    if (th > 0.53 && th < 0.6) k -= 0.02;
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  g.computeVertexNormals();
  return prepGeo(g);
}

function addEyes(fig: Figure, mat: THREE.Material, extra?: { glow?: THREE.Material; four?: boolean }) {
  const a = fig.asset, r = a.meta.eyeR * 0.96, head = fig.body.bones.head;
  const geo = eyeGeo(r);
  const objs: THREE.Object3D[] = [];
  const place = () => {
    const hj = fig.joints[boneIndex(a, 'head')];
    objs.forEach((o, i) => {
      const e = fig.eyes[i % 2], sideX = Math.sign(e.x);
      const four = i >= 2;
      o.position.set(e.x - hj.x + (four ? sideX * r * 0.55 : 0), e.y - hj.y + (four ? r * 2.1 : 0), e.z - hj.z - (four ? r * 0.35 : 0));
      if (four) o.scale.setScalar(0.62);
    });
  };
  const n = extra?.four ? 4 : 2;
  for (let i = 0; i < n; i++) {
    const o = new THREE.Group();
    const ball = new THREE.Mesh(geo, mat); ball.castShadow = true; o.add(ball);
    if (extra?.glow) { const d = new THREE.Mesh(new THREE.CircleGeometry(r * 0.2, 16), extra.glow); d.position.z = r * 0.86; o.add(d); }
    head.add(o); objs.push(o);
  }
  fig.eyeObjs = objs;
  place(); fig.onShape.push(place);
  return objs;
}

function animateEyes(fig: Figure, t: number, look?: V3) {
  const head = fig.body.bones.head;
  fig.eyeObjs.forEach((o, i) => {
    if (look) {
      const wp = o.getWorldPosition(new THREE.Vector3());
      const d = head.worldToLocal(look.clone()).sub(o.position).normalize();
      o.rotation.set(THREE.MathUtils.clamp(-Math.asin(d.y), -0.35, 0.35), THREE.MathUtils.clamp(Math.atan2(d.x, d.z), -0.45, 0.45), 0);
      void wp;
    } else {
      const s = Math.floor(t * 0.7 + i * 0.0);
      const rx = Math.sin(s * 12.9898) * 0.12, ry = Math.sin(s * 78.233) * 0.22;
      o.rotation.x += (rx - o.rotation.x) * 0.2; o.rotation.y += (ry - o.rotation.y) * 0.2;
    }
  });
}

const FACE_OF: Record<Emotion, Partial<Record<Face, number>>> = {
  calme: {}, colere: { colere: 0.85 }, joie: { sourire: 0.9 }, tristesse: { tristesse: 0.85 }, respect: { reflexion: 0.4, sourire: 0.15 }, menace: { colere: 1 },
};

// ---------- base commune ----------
async function person(opts: {
  id: string; letter: string; name: string; sub: string; text: string; kind: Person['kind'];
  asset: string; shape: Record<string, number>; age?: number; gender?: Record<string, number>;
  metal: MetalOptions; outfit: Outfit; hair?: { style: HairStyle; mat: THREE.Material; seed: number };
  eyeMat?: THREE.Material; eyeGlow?: THREE.Material; extras?: (p: Person) => void;
}) {
  const a = await loadPeople(opts.asset);
  const mat = metalMaterial({ height: a.height, ...opts.metal });
  const fig = makeFigure(a, mat, outfit(a, opts.outfit));
  const group = new THREE.Group(); group.add(fig.mesh);
  const mats: THREE.MeshPhysicalMaterial[] = [mat];
  if (opts.eyeMat) mats.push(opts.eyeMat as THREE.MeshPhysicalMaterial);
  let hair: THREE.Mesh | null = null;
  const rebuildHair = () => {
    if (!opts.hair) return;
    if (hair) { hair.removeFromParent(); hair.geometry.dispose(); }
    hair = buildHair(fig, opts.hair.style, opts.hair.mat, opts.hair.seed);
    if (hair) fig.body.bones.head.add(hair);
  };
  if (opts.hair && !mats.includes(opts.hair.mat as THREE.MeshPhysicalMaterial)) mats.push(opts.hair.mat as THREE.MeshPhysicalMaterial);
  const gender = opts.gender ?? {};
  const shapeFor = (age: number) => {
    const enfant = THREE.MathUtils.clamp((0.36 - age) / 0.33, 0, 1), ancien = THREE.MathUtils.clamp((age - 0.45) / 0.5, 0, 1);
    const s: Record<string, number> = { enfant, ancien };
    for (const [k, v] of Object.entries(gender)) s[k] = v * (1 - enfant * 0.85);
    return s;
  };
  setShape(fig, opts.age !== undefined ? shapeFor(opts.age) : opts.shape);
  rebuildHair();
  let hairTimer = 0;
  const p: Person = {
    id: opts.id, letter: opts.letter, name: opts.name, sub: opts.sub, text: opts.text, kind: opts.kind,
    group, fig, body: fig.body, mats, age: opts.age, expr: null,
    setTalk: (on) => { fig.talk.on = on; },
    eyeWorld: (out) => {
      const hj = fig.joints[boneIndex(a, 'head')];
      const m = fig.eyes[0].clone().add(fig.eyes[1]).multiplyScalar(0.5).sub(hj);
      return fig.body.bones.head.localToWorld(out.copy(m));
    },
    update: () => {},
  };
  if (opts.age !== undefined) p.setAge = (age: number) => {
    p.age = age; setShape(fig, shapeFor(age));
    clearTimeout(hairTimer); hairTimer = window.setTimeout(rebuildHair, 120);
  };
  addEyes(fig, opts.eyeMat ?? mat, { glow: opts.eyeGlow, four: !!a.meta.fourEyes });
  opts.extras?.(p);
  return p;
}

function baseUpdate(p: Person, look: () => V3 | undefined) {
  return (dt: number, t: number, action: Action, emotion: Emotion) => {
    const fig = p.fig;
    animateBiped(fig.body, action, emotion, dt, false);
    const old = fig.shape.ancien ?? 0;
    if (old > 0) { fig.body.bones.spine.rotation.x += 0.1 * old; fig.body.bones.neck.rotation.x += 0.08 * old; fig.body.bones.head.rotation.x -= 0.05 * old; }
    fig.face = { ...(p.expr && p.expr !== 'neutre' ? { [p.expr]: 1 } : p.expr === 'neutre' ? {} : FACE_OF[emotion]) };
    updateFace(fig, dt);
    animateEyes(fig, t, look());
    for (const m of p.mats) { const u = m.userData.metal ?? m.userData.hair; if (u) u.uTime.value = t; }
  };
}

// ---------- humains ----------
export interface Proposal { id: string; name: string; text: string }
export const HUMAN_PROPS: Proposal[] = [
  { id: 'h1', name: 'Acier brossé', text: 'Acier gris clair aux micro-rayures verticales, reflets étirés le long des membres. Vêtements en acier bruni, mat et plus sombre. Cheveux en fins fils d’acier.' },
  { id: 'h2', name: 'Acier forgé', text: 'Acier plus sombre, légèrement martelé, arêtes polies par l’usure et oxyde bleuté dans les creux. Vêtements en fer noirci. Mèches plus épaisses.' },
  { id: 'h3', name: 'Acier poli', text: 'Acier presque miroir, très clair, qui reflète le décor. Vêtements en acier satiné aux plis nets. Coiffures courtes et précises.' },
];
const HUMAN_LOOK = [
  { skin: { color: 0xb9bdc3, rough: 0.3, aniso: 0.8, wear: 0.6, patina: 0x2a2e35, patinaAmt: 0.25 }, cloth: [{ color: 0x5f636a, rough: 0.55 }, { color: 0x45484e, rough: 0.6 }, { color: 0x2b2c30, rough: 0.32 }, { color: 0x8d9198, rough: 0.42 }], hair: 0x6f747b, hairRough: 0.28, thick: 0.0014, fold: 1 },
  { skin: { color: 0x8d9097, rough: 0.4, aniso: 0.55, wear: 0.9, hammer: 0.9, patina: 0x1c2a38, patinaAmt: 0.55 }, cloth: [{ color: 0x303237, rough: 0.68 }, { color: 0x3a3632, rough: 0.66 }, { color: 0x1b1b1d, rough: 0.4 }, { color: 0x55585e, rough: 0.5 }], hair: 0x3f4246, hairRough: 0.36, thick: 0.0019, fold: 1.3 },
  { skin: { color: 0xd5d8dd, rough: 0.11, aniso: 0.25, wear: 0.3, patina: 0x333333, patinaAmt: 0 }, cloth: [{ color: 0x9da3ab, rough: 0.28 }, { color: 0x7f848c, rough: 0.3 }, { color: 0x4b4e53, rough: 0.14 }, { color: 0xb5b9bf, rough: 0.2 }], hair: 0x9ea3aa, hairRough: 0.16, thick: 0.0012, fold: 0.8 },
];
// nuances de métal propres à chaque personne
const TINT = [new THREE.Color(1, 1, 1), new THREE.Color(1.03, 0.99, 0.95), new THREE.Color(0.97, 1, 1.04), new THREE.Color(1.02, 1.0, 0.98)];

const HUMANS = [
  { id: 'homme', letter: 'H', name: 'Homme', sub: 'Adulte', gender: { homme: 1 }, age: 0.4,
    hair: [{ count: 1300, len: [0.035, 0.06], flow: 'arriere', lift: 0.004, clump: 0.7 }, { count: 1500, len: [0.07, 0.11], flow: 'raie', lift: 0.006, clump: 0.8, curl: 0.0004 }, { count: 1400, len: [0.018, 0.03], flow: 'epis', lift: 0.002, clump: 0.5 }],
    outfit: [{ sleeve: 0.45, shirtLow: 0.04, trousers: true, cuff: 0.05, boots: 0.13 }, { sleeve: 0, shirtLow: 0.08, trousers: true, cuff: 0.03, boots: 0.16, beard: true }, { sleeve: 0.92, shirtLow: 0.02, trousers: true, cuff: 0.03, boots: 0.09 }] },
  { id: 'femme', letter: 'F', name: 'Femme', sub: 'Adulte', gender: { femme: 1 }, age: 0.38,
    hair: [{ count: 1700, len: [0.1, 0.15], flow: 'bas', lift: 0.007, clump: 0.75, fringe: true }, { count: 1700, len: [0.13, 0.19], flow: 'arriere', lift: 0.004, clump: 0.85, tie: true }, { count: 1500, len: [0.04, 0.07], flow: 'raie', lift: 0.004, clump: 0.6 }],
    outfit: [{ sleeve: 0.9, shirtLow: 0.1, trousers: true, cuff: 0.04, boots: 0.2 }, { sleeve: 0.3, shirtLow: 0.05, trousers: true, cuff: 0.05, boots: 0.12 }, { sleeve: 0.92, shirtLow: 0.12, trousers: true, cuff: 0.02, boots: 0.09 }] },
  { id: 'enfant', letter: 'E', name: 'Enfant', sub: 'Huit ans', gender: { homme: 0.4, femme: 0.2 }, age: 0.07,
    hair: [{ count: 1300, len: [0.04, 0.07], flow: 'epis', lift: 0.006, clump: 0.6, curl: 0.0006 }, { count: 1400, len: [0.06, 0.09], flow: 'bas', lift: 0.006, clump: 0.7, fringe: true }, { count: 1200, len: [0.03, 0.05], flow: 'arriere', lift: 0.004, clump: 0.6 }],
    outfit: [{ sleeve: 0, shirtLow: 0.06, trousers: true, cuff: 0.2, boots: 0.07 }, { sleeve: 0.92, shirtLow: 0.08, trousers: true, cuff: 0.03, boots: 0.1 }, { sleeve: 0.3, shirtLow: 0.04, trousers: true, cuff: 0.12, boots: 0.08 }] },
  { id: 'ancien', letter: 'A', name: 'Ancien', sub: 'Soixante-quinze ans', gender: { homme: 0.85 }, age: 0.95,
    hair: [{ count: 1100, len: [0.03, 0.05], flow: 'arriere', lift: 0.003, clump: 0.6, recede: 0.55 }, { count: 1000, len: [0.05, 0.08], flow: 'arriere', lift: 0.004, clump: 0.7, recede: 0.85, sparse: 0.35 }, { count: 900, len: [0.025, 0.04], flow: 'raie', lift: 0.002, clump: 0.5, recede: 0.4, sparse: 0.2 }],
    outfit: [{ sleeve: 0.92, shirtLow: 0.14, trousers: true, cuff: 0.02, boots: 0.1, beard: true }, { sleeve: 0.92, shirtLow: 0.1, trousers: true, cuff: 0.03, boots: 0.15, beard: true }, { sleeve: 0.6, shirtLow: 0.08, trousers: true, cuff: 0.02, boots: 0.09 }] },
] as const;

export async function buildHuman(prop: number, who: number, look: () => V3 | undefined): Promise<Person> {
  const L = HUMAN_LOOK[prop], H = HUMANS[who];
  const col = new THREE.Color(L.skin.color).multiply(TINT[who]);
  const hm = hairMaterial(new THREE.Color(L.hair).multiply(TINT[who]), L.hairRough);
  const eyeMat = metalMaterial({ color: col, rough: Math.max(0.08, L.skin.rough - 0.12), wear: 0.2 });
  const p = await person({
    id: H.id, letter: H.letter, name: H.name, sub: H.sub, kind: 'humain', asset: 'human', shape: {}, age: H.age, gender: H.gender,
    text: HUMAN_PROPS[prop].text,
    metal: { ...L.skin, color: col, cloth: L.cloth, fold: L.fold },
    outfit: { ...(H.outfit[prop] as Outfit), scalp: 3, recede: (H.hair[prop] as HairStyle).recede },
    hair: { style: { ...(H.hair[prop] as HairStyle), thick: L.thick }, mat: hm, seed: prop * 10 + who + 1 },
    eyeMat,
  });
  p.update = baseUpdate(p, look);
  return p;
}

// ---------- Vaëls ----------
export const VAEL_PROPS: Proposal[] = [
  { id: 'vael-1', name: 'La Lyre', text: 'Très grande et fine (2,20 m), long cou, crâne étiré en crête vers l’arrière, grands yeux, marche sur la pointe des pieds, longue queue souple.' },
  { id: 'vael-2', name: 'Le Faune', text: 'Puissant et félin (1,95 m), museau court, grandes oreilles couchées, jambes à talon relevé, queue courte et épaisse.' },
  { id: 'vael-3', name: 'L’Oracle', text: 'Grand crâne en dôme, deux paires d’yeux, bras très longs aux mains fines, posture légèrement voûtée, pieds à plat.' },
];
const CLAN_ORDER: ClanId[] = ['racines', 'hauteurs', 'eaux', 'nomades'];
const CLAN_TEXT: Record<ClanId, string> = {
  racines: 'Cuivre couvert de vert-de-gris dans les creux. Gravures en racines ramifiées. Collier tressé de fils de cuivre et bracelets en spirale.',
  hauteurs: 'Cuivre rouge sombre. Marques de chasse gravées en chevrons. Collier facetté, pendentif en pointe et protections d’épaule anguleuses.',
  eaux: 'Cuivre poli aux reflets bleutés, sous vernis. Gravures en vagues. Collier lisse, pendentif en coquillage de métal.',
  nomades: 'Bronze sombre, la patine du voyage. Gravures en spirales. Bracelets superposés et anneaux de cou.',
};

function neckRadius(fig: Figure, bone: string, y: number, band = 0.02) {
  const a = fig.asset, P = restPositions(fig), W = boneW(a);
  let r = 0, c = 0, cx = 0, cz = 0;
  const pts: [number, number][] = [];
  for (let i = 0; i < a.meta.verts; i++) if (W(i, [bone]) > 0.5 && Math.abs(P[i * 3 + 1] - y) < band) { pts.push([P[i * 3], P[i * 3 + 2]]); cx += P[i * 3]; cz += P[i * 3 + 2]; }
  if (!pts.length) return { r: 0.05, cx: 0, cz: 0 };
  cx /= pts.length; cz /= pts.length;
  for (const [x, z] of pts) { r += Math.hypot(x - cx, z - cz); c++; }
  return { r: r / c, cx, cz };
}

function ornaments(p: Person, clan: ClanId, mat: THREE.Material) {
  const fig = p.fig, B = fig.body.bones;
  const hj = (n: string) => fig.joints[boneIndex(fig.asset, n)];
  const put = (bone: string, obj: THREE.Object3D, world: V3) => { obj.position.copy(world).sub(hj(bone)); obj.traverse((o) => { (o as THREE.Mesh).castShadow = true; }); B[bone].add(obj); return obj; };
  const mesh = (g: THREE.BufferGeometry) => new THREE.Mesh(prepGeo(g), mat);
  const neckY = THREE.MathUtils.lerp(hj('neck').y, hj('head').y, 0.25);
  const nk = neckRadius(fig, 'neck', neckY);
  const collar = new THREE.Group();
  if (clan === 'racines') {
    for (let s = 0; s < 3; s++) { // collier tressé
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2; const rr = nk.r * 1.32 + Math.cos(a * 9 + s * 2.1) * 0.004; pts.push(new THREE.Vector3(Math.sin(a) * rr, Math.sin(a * 9 + s * 2.1) * 0.004 - (Math.cos(a) > 0 ? 0.012 : 0), Math.cos(a) * rr)); }
      collar.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 192, 0.0028, 5, true)));
    }
  } else if (clan === 'hauteurs') {
    const t = mesh(new THREE.TorusGeometry(nk.r * 1.35, 0.008, 3, 10)); t.rotation.x = Math.PI / 2; collar.add(t);
    const pend = mesh(new THREE.ConeGeometry(0.018, 0.07, 3)); pend.rotation.x = Math.PI; pend.position.set(0, -0.05, nk.r * 1.4); collar.add(pend);
  } else if (clan === 'eaux') {
    const t = mesh(new THREE.TorusGeometry(nk.r * 1.3, 0.005, 10, 48)); t.rotation.x = Math.PI / 2; collar.add(t);
    const sh = mesh(new THREE.SphereGeometry(0.026, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)); sh.scale.set(1, 0.35, 1); sh.rotation.x = Math.PI / 2; sh.position.set(0, -0.045, nk.r * 1.38); collar.add(sh);
    for (let i = -3; i <= 3; i++) { const r = mesh(new THREE.TorusGeometry(0.026 - Math.abs(i) * 0.0, 0.0012, 4, 16, Math.PI)); r.position.set(0, -0.045 + 0, nk.r * 1.38 + 0.009); r.rotation.z = i * 0.18; r.scale.setScalar(0.5 + (3 - Math.abs(i)) * 0.15); collar.add(r); }
  } else {
    for (let k = 0; k < 3; k++) { const t = mesh(new THREE.TorusGeometry(nk.r * (1.15 + k * 0.08), 0.0045, 8, 40)); t.rotation.x = Math.PI / 2; t.position.y = -k * 0.012; collar.add(t); }
  }
  put('neck', collar, new THREE.Vector3(nk.cx, neckY - 0.01, nk.cz));
  // bracelets
  for (const s of ['L', 'R']) {
    const a = hj('fore' + s), b = hj('hand' + s);
    const at = a.clone().lerp(b, 0.72);
    const fr = neckRadius(fig, 'fore' + s, at.y, 0.012);
    const g = new THREE.Group();
    const n = clan === 'nomades' ? 4 : clan === 'racines' ? 1 : 2;
    for (let k = 0; k < n; k++) {
      let m: THREE.Mesh;
      if (clan === 'racines') { // spirale
        const pts: THREE.Vector3[] = []; for (let i = 0; i <= 80; i++) { const an = i / 80 * Math.PI * 6; pts.push(new THREE.Vector3(Math.cos(an) * fr.r * 1.18, i / 80 * 0.05 - 0.025, Math.sin(an) * fr.r * 1.18)); }
        m = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.0022, 5));
      } else { m = mesh(new THREE.TorusGeometry(fr.r * 1.2, clan === 'hauteurs' ? 0.006 : 0.004, clan === 'hauteurs' ? 3 : 8, 32)); m.rotation.x = Math.PI / 2; m.position.y = (k - (n - 1) / 2) * 0.014; }
      g.add(m);
    }
    const dir = b.clone().sub(a).normalize(); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    put('fore' + s, g, new THREE.Vector3(fr.cx, at.y, fr.cz));
  }
  // protections d'épaule (Hauteurs)
  if (clan === 'hauteurs') for (const s of ['L', 'R']) {
    const sh = hj('arm' + s), sg = s === 'L' ? 1 : -1;
    const g = mesh(new THREE.SphereGeometry(0.075, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.45));
    g.scale.set(1, 0.7, 1.1); g.rotation.z = -sg * 0.5;
    put('arm' + s, g, sh.clone().add(new THREE.Vector3(sg * 0.01, 0.025, 0)));
  }
}

function tailAndEars(p: Person, mat: THREE.Material) {
  const fig = p.fig, meta = fig.asset.meta, B = fig.body.bones;
  const hj = (n: string) => fig.joints[boneIndex(fig.asset, n)];
  const tails: THREE.Object3D[] = [];
  if (meta.tail) {
    const [len, r0] = meta.tail, N = 6, seg = len / N;
    let parent: THREE.Object3D = B.hips;
    const hp = hj('hips');
    const back = neckRadius(fig, 'hips', hp.y - 0.04, 0.03);
    for (let i = 0; i < N; i++) {
      const ra = r0 * (1 - i / N * 0.8), rb = r0 * (1 - (i + 1) / N * 0.8);
      const g = new THREE.CylinderGeometry(rb, ra, seg * 1.08, 14, 2); g.translate(0, seg / 2, 0); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(prepGeo(g), mat); m.castShadow = true;
      const j = new THREE.Group(); j.add(m);
      if (i === 0) { j.position.set(0, -0.04, back.cz - back.r * 0.9 - hp.z); }
      else j.position.set(0, 0, -seg);
      j.rotation.x = i === 0 ? -0.95 : 0.14;
      parent.add(j); parent = j; tails.push(j);
    }
  }
  if (meta.ears) {
    const head = hj('head'), e = fig.eyes[0];
    for (const sg of [1, -1]) {
      const g = new THREE.ConeGeometry(0.032, 0.17, 12, 3); g.scale(0.45, 1, 1);
      const m = new THREE.Mesh(prepGeo(g), mat); m.castShadow = true;
      m.position.set(sg * Math.abs(e.x) * 1.95 - 0, e.y - head.y + 0.035, e.z - head.z - 0.07);
      m.rotation.set(-1.05, 0, -sg * 0.75);
      B.head.add(m);
    }
  }
  return tails;
}

export async function buildVael(prop: number, clanI: number, look: () => V3 | undefined): Promise<Person> {
  const clan = CLAN_ORDER[clanI], C = CLANS[clan];
  const glowM = new THREE.MeshBasicMaterial({ color: 0x55c8ff });
  const eyeMat = metalMaterial({ color: new THREE.Color(C.color).multiplyScalar(1.08), rough: 0.15, wear: 0.2 });
  const orn = metalMaterial({ color: new THREE.Color(C.color).multiplyScalar(clan === 'eaux' ? 1.1 : 1.15), rough: Math.max(0.12, C.rough - 0.12), wear: 0.7, patina: C.patina, patinaAmt: C.patinaAmt * 0.6, clearcoat: clan === 'eaux' ? 0.6 : 0 });
  let tails: THREE.Object3D[] = [];
  const p = await person({
    id: clan, letter: C.name[0], name: CLANS[clan].name, sub: VAEL_PROPS[prop].name, kind: 'vael', asset: VAEL_PROPS[prop].id, shape: {},
    text: VAEL_PROPS[prop].text + ' — ' + CLAN_TEXT[clan],
    metal: {
      color: C.color, rough: C.rough, aniso: clan === 'eaux' ? 0.15 : 0.35, wear: 0.65, patina: C.patina, patinaAmt: C.patinaAmt, patinaScale: clan === 'racines' ? 6 : 4,
      hammer: clan === 'hauteurs' ? 0.5 : 0, engrave: C.glow, engraveScale: 2.0, clearcoat: clan === 'eaux' ? 0.7 : 0,
      cloth: [{ color: new THREE.Color(C.color).multiplyScalar(0.5), rough: 0.6 }, { color: new THREE.Color(C.color).multiplyScalar(0.42), rough: 0.66 }, { color: 0x3a2a1c, rough: 0.5 }, { color: C.color, rough: 0.4 }],
    },
    outfit: { sleeve: -1, shirtLow: 0, trousers: false, cuff: 0, boots: 0, wrap: true, sash: clan !== 'eaux', brows: false },
    eyeMat, eyeGlow: glowM,
    extras: (pp) => { ornaments(pp, clan, orn); tails = tailAndEars(pp, pp.mats[0]); },
  });
  p.mats.push(orn);
  const upd = baseUpdate(p, look);
  const skinU = p.mats[0].userData.metal;
  p.update = (dt, t, action, emotion) => {
    upd(dt, t, action, emotion);
    skinU.uGlowCol.value.lerp(EMO_COLORS[emotion], 1 - Math.exp(-dt * 3));
    skinU.uGlow.value = emotion === 'colere' ? 1.4 + Math.sin(t * 9) * 0.3 : emotion === 'tristesse' ? 0.55 : emotion === 'joie' ? 1.25 : 1;
    skinU.uGlowSpeed.value = emotion === 'colere' ? 2.5 : emotion === 'tristesse' ? 0.4 : emotion === 'joie' ? 1.6 : 1;
    glowM.color.copy(skinU.uGlowCol.value).multiplyScalar(0.8);
    const an = p.body.mesh.userData.anim as { walk: number; phase: number };
    tails.forEach((j, i) => { j.rotation.y = Math.sin(t * 1.3 - i * 0.6) * (0.12 + an.walk * 0.1); if (i) j.rotation.x = 0.14 + Math.sin(t * 0.9 - i * 0.5) * 0.04; });
  };
  return p;
}

// ---------- souvenirs ----------
export const MEMORY_PROPS: Proposal[] = [
  { id: 'or-massif', name: 'Or massif', text: 'Statue d’or pleine et lumineuse, contour brillant. Elle se forme des pieds à la tête dans une pluie d’étincelles, et de fines particules s’en échappent.' },
  { id: 'or-filigrane', name: 'Or filigrane', text: 'Or translucide traversé de fines lignes lumineuses, plus dense sur les contours : une image qui hésite, comme un souvenir qui se reconstitue.' },
  { id: 'or-poussiere', name: 'Poussière d’or', text: 'Une nuée de grains d’or qui se rassemble en silhouette sans jamais tenir tout à fait : la surface scintille et se défait sans cesse.' },
];
const CREW = [
  { id: 'ilse', name: 'Ilse', gender: { femme: 1 }, age: 0.42, hair: { count: 1500, len: [0.1, 0.15], flow: 'arriere', lift: 0.004, clump: 0.8, tie: true } },
  { id: 'tomas', name: 'Tomás', gender: { homme: 1, muscle: 0.4 }, age: 0.45, hair: { count: 1300, len: [0.03, 0.05], flow: 'arriere', lift: 0.004, clump: 0.7 } },
  { id: 'naomi', name: 'Naomi', gender: { femme: 1, mince: 0.4 }, age: 0.33, hair: { count: 1600, len: [0.06, 0.1], flow: 'bas', lift: 0.007, clump: 0.7, fringe: true, curl: 0.0006 } },
  { id: 'kenji', name: 'Kenji', gender: { homme: 1, mince: 0.3 }, age: 0.38, hair: { count: 1400, len: [0.04, 0.06], flow: 'raie', lift: 0.005, clump: 0.65 } },
] as const;

export async function buildMemory(prop: number, who: number, look: () => V3 | undefined): Promise<Person> {
  const c = CREW[who];
  const goldC = new THREE.Color(0xffc45a);
  const hairGold = metalMaterial({ color: goldC, rough: 0.25, aniso: 0.6, gold: prop as 0 | 1 | 2 });
  const p = await person({
    id: c.id, letter: c.name[0], name: c.name, sub: 'Souvenir de l’équipage', kind: 'souvenir', asset: 'human', shape: {}, age: c.age, gender: c.gender,
    text: MEMORY_PROPS[prop].text,
    metal: { color: goldC, rough: 0.22, aniso: 0.3, wear: 0.4, gold: prop as 0 | 1 | 2, cloth: [{ color: 0xe7a940, rough: 0.35 }, { color: 0xd39a3a, rough: 0.38 }, { color: 0xb8842e, rough: 0.3 }, { color: 0xffc45a, rough: 0.3 }] },
    outfit: { sleeve: 0.95, shirtLow: 0, trousers: true, cuff: 0, boots: 0.17, suit: true, scalp: 3 },
    hair: { style: { ...(c.hair as HairStyle), thick: 0.001 }, mat: hairGold, seed: who + 40 },
  });
  const gold = p.mats[0];
  gold.depthWrite = prop !== 1; hairGold.depthWrite = prop !== 1;
  // particules d'or
  const parts = particles(p, prop);
  p.group.add(parts.points);
  const appear = { v: 0, t: 0 };
  p.replay = (v = 0) => { appear.v = v; appear.t = v * 4.2; };
  const upd = baseUpdate(p, look);
  const hj = () => p.fig.joints[boneIndex(p.fig.asset, 'head')];
  p.update = (dt, t, action, emotion) => {
    upd(dt, t, action, emotion);
    appear.t += dt; appear.v = Math.min(1, appear.t / 4.2);
    const e = 1 - Math.pow(1 - appear.v, 2);
    for (const m of [gold, hairGold]) m.userData.metal.uAppear.value = e;
    hairGold.userData.metal.uAppear.value = e - hj().y / p.fig.asset.height * 0.85 + 0.05; // les cheveux suivent la tête
    parts.update(t, e);
  };
  return p;
}

function particles(p: Person, prop: number) {
  const P = restPositions(p.fig), n = p.fig.asset.meta.verts, N = prop === 2 ? 5200 : 2600, H = p.fig.asset.height;
  const tgt = new Float32Array(N * 3), from = new Float32Array(N * 3), rnd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const v = Math.floor(Math.random() * n);
    tgt[i * 3] = P[v * 3]; tgt[i * 3 + 1] = P[v * 3 + 1]; tgt[i * 3 + 2] = P[v * 3 + 2];
    const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 1.1;
    from[i * 3] = Math.cos(a) * r; from[i * 3 + 1] = Math.random() * H * 1.3; from[i * 3 + 2] = Math.sin(a) * r;
    rnd[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(tgt, 3));
  g.setAttribute('aFrom', new THREE.BufferAttribute(from, 3));
  g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
  const u = { uT: { value: 0 }, uAppear: { value: 0 }, uH: { value: H }, uKeep: { value: prop === 2 ? 0.55 : 0.12 }, uSize: { value: prop === 2 ? 11 : 8 } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aFrom; attribute float aRnd; uniform float uT, uAppear, uH, uKeep, uSize; varying float vA;
      void main() {
        float th = position.y / uH * 0.85 + aRnd * 0.15;
        float k = clamp((uAppear * 1.2 - th + 0.3) / 0.35, 0.0, 1.0);
        float e = k * k * (3.0 - 2.0 * k);
        vec3 sw = vec3(sin(uT * 0.8 + aRnd * 30.0), 0.0, cos(uT * 0.7 + aRnd * 20.0)) * 0.15 * (1.0 - e);
        vec3 p = mix(aFrom + sw, position, e);
        // fines particules qui s'échappent
        float life = fract(uT * (0.12 + aRnd * 0.1) + aRnd);
        float esc = step(0.999, k) * step(1.0 - uKeep, aRnd);
        p += vec3(sin(aRnd * 50.0) * 0.05, life * 0.35, cos(aRnd * 40.0) * 0.05) * esc;
        vA = mix(e * (1.0 - e) * 4.0 + (1.0 - k) * 0.25, (1.0 - life) * 0.9, esc) * step(0.001, k + 0.2);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (0.5 + aRnd) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() { vec2 c = gl_PointCoord - 0.5; float d = dot(c, c); if (d > 0.25) discard; gl_FragColor = vec4(vec3(1.0, 0.72, 0.3) * 1.6, vA * (1.0 - d * 4.0)); }`,
  });
  const points = new THREE.Points(g, m); points.frustumCulled = false;
  return { points, update: (t: number, a: number) => { u.uT.value = t; u.uAppear.value = a; } };
}

export const KIND_PROPS = { humain: HUMAN_PROPS, vael: VAEL_PROPS, souvenir: MEMORY_PROPS };
export function buildPerson(kind: 'humain' | 'vael' | 'souvenir', prop: number, i: number, look: () => V3 | undefined) {
  return kind === 'humain' ? buildHuman(prop, i, look) : kind === 'vael' ? buildVael(prop, i, look) : buildMemory(prop, i, look);
}
