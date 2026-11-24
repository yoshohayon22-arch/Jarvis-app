import * as THREE from 'three';
import { Builder, rbox, bcyl, cable, vent, lathe, type V3 } from '../robots/parts';
import * as M from '../robots/materials';
import { pbr } from '../core/textures';
import type { Physics, Collider, Surface } from './physics';
import type { LightPool } from './lights';

// Kit de construction de la station : matériaux, pièces modulaires, portes, accessoires.

export type Side = 'n' | 's' | 'e' | 'w';
export interface Opening { side: Side; c: number; w: number; h: number; y?: number; door?: string; frame?: boolean; }

export class Kit {
  res: '1k' | '2k';
  m: Record<string, THREE.Material> = {};
  strips = new Map<string, THREE.MeshBasicMaterial>();
  constructor(res: '1k' | '2k') {
    this.res = res;
    const tex = (id: string, o: { color?: number; map?: boolean; normal?: number; metal?: number; rough?: number; uv?: number; env?: number }) => {
      const s = pbr(id, res, 1, o.map !== false);
      const m = new THREE.MeshStandardMaterial({
        color: o.color ?? 0xffffff, map: o.map === false ? null : s.map, normalMap: s.normalMap,
        normalScale: new THREE.Vector2(o.normal ?? 1, o.normal ?? 1), roughnessMap: s.arm, metalnessMap: s.arm, aoMap: null,
        roughness: o.rough ?? 1, metalness: o.metal ?? 1, envMapIntensity: o.env ?? 1,
      });
      m.userData.uvScale = o.uv ?? 0.5;
      return m;
    };
    this.m.wall = M.addWear(tex('blue_metal_plate', { color: 0xc8d4e0, uv: 0.42 }), { wear: 0, scratches: 0.15, dirt: 0.35, roughVar: 0.25, scale: 0.6 });
    this.m.floor = tex('metal_plate', { color: 0x6f757d, map: false, uv: 0.6, normal: 0.9 });
    this.m.grate = tex('metal_grate_rusty', { color: 0x4d535b, map: false, uv: 0.9 });
    this.m.ceiling = tex('corrugated_iron_02', { color: 0x7d8792, uv: 0.5 });
    this.m.wallWhite = M.addWear(tex('painted_metal_shutter', { color: 0xdfe4ea, uv: 0.55, normal: 0.6 }), { wear: 0, scratches: 0.1, dirt: 0.25, roughVar: 0.2, scale: 0.6 });
    this.m.wallWreck = M.addWear(tex('rusty_painted_metal', { color: 0x8a7a70, uv: 0.35 }), { wear: 0, scratches: 0.2, dirt: 0.55, roughVar: 0.25, scale: 0.6 });
    this.m.concrete = tex('concrete_floor_worn_001', { color: 0x9aa0a8, metal: 0, uv: 0.22 });
    this.m.shutter = tex('painted_metal_shutter', { color: 0xaeb6c0, uv: 0.8 });
    this.m.container = tex('container_side', { color: 0xffffff, uv: 0.4 });
    this.m.containerB = tex('container_side', { color: 0x8fb4ff, uv: 0.4 });
    this.m.trim = M.paint(0xa9b2bc, { wear: 0.8, scratches: 0.3, dirt: 0.45, rough: 0.5, clearcoat: 0.1, scale: 1.2 });
    this.m.white = M.paint(0xd9dcdf, { wear: 0.6, scratches: 0.2, dirt: 0.35, rough: 0.45, clearcoat: 0.2 });
    this.m.orange = M.paint(0xd2571c, { wear: 0.9, scratches: 0.35, dirt: 0.4, rough: 0.5 });
    this.m.dark = M.steel(0x2c3036, { rough: 0.5, wear: 0.3, scratches: 0.15, dirt: 0.35 });
    this.m.steel = M.steel(0x8a9098, { rough: 0.32, wear: 0.15 });
    this.m.rubber = M.rubber(0x15171a);
    this.m.black = M.glossyBlack();
    this.m.slot = M.rubber(0x050505);
    this.m.hazard = M.decal(M.textTexture([], 512, 128, true));
    this.m.redLamp = M.glow(0xff2a10, 3);
    this.m.glassWin = new THREE.MeshPhysicalMaterial({ color: 0x99b6cc, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, clearcoat: 1, depthWrite: false, envMapIntensity: 1.5 });
    this.m.cloth = new THREE.MeshStandardMaterial({ color: 0x39414c, roughness: 0.95 });
    this.m.mattress = new THREE.MeshStandardMaterial({ color: 0x8b939c, roughness: 0.9 });
  }

  /** Matériau des bandeaux lumineux d'une pièce (couleur pilotée par l'énergie). */
  strip(room: string) {
    let m = this.strips.get(room);
    if (!m) { m = new THREE.MeshBasicMaterial({ color: 0x000000 }); this.strips.set(room, m); }
    return m;
  }

  sign(text: string, sub = '', w = 1024, h = 256, color = '#d6e4ef') {
    const t = M.textTexture([{ text, size: 120, y: sub ? 105 : 128, color }, ...(sub ? [{ text: sub, size: 44, y: 205, font: '600', color: 'rgba(214,228,239,0.7)' }] : [])], w, h);
    return M.decal(t, { rough: 0.7 });
  }
}

export interface RoomSpec {
  id: string;
  x0: number; z0: number; x1: number; z1: number; y: number; h: number;
  openings: Opening[];
  holes?: { x0: number; z0: number; x1: number; z1: number }[];
  floor?: 'tread' | 'concrete' | 'grate';
  noCeiling?: boolean;
  lightColor?: number;
  stripEvery?: number;
  /** Habillage des murs. */
  wall?: 'blue' | 'white';
  /** Côtés sans mur (fournis par la pièce voisine). */
  skip?: Side[];
  /** Parois magnétiques (bottes). */
  mag?: boolean;
  /** Teinte des néons et ambiance (épave : rouge / ambre). */
  wreck?: boolean;
}

export interface Room {
  spec: RoomSpec;
  group: THREE.Group;
  builder: Builder;
  lights: ReturnType<LightPool['add']>[];
  center: THREE.Vector3;
}

const T = 0.3; // épaisseur des murs

/** Construit une pièce : sol, plafond, murs avec ouvertures, colliders, bandeaux lumineux. */
export function buildRoom(kit: Kit, ph: Physics, pool: LightPool, s: RoomSpec): Room {
  const group = new THREE.Group();
  group.name = 'room-' + s.id;
  const B = new Builder();
  const lights: Room['lights'] = [];
  const { x0, z0, x1, z1, y, h } = s;
  const surface: Surface = s.floor === 'concrete' ? 'concrete' : s.floor === 'grate' ? 'grate' : 'metal';

  // --- sol (avec trous éventuels) ---
  const floorRects = subtract({ x0: x0 - T, z0: z0 - T, x1: x1 + T, z1: z1 + T }, s.holes ?? []);
  for (const r of floorRects) {
    ph.add([r.x0, y - 0.4, r.z0], [r.x1, y, r.z1], { surface, tag: s.mag ? 'mag' : undefined });
    const mat = s.floor === 'concrete' ? kit.m.concrete : kit.m.floor;
    B.add(group, mat, new THREE.BoxGeometry(r.x1 - r.x0, 0.4, r.z1 - r.z0), [(r.x0 + r.x1) / 2, y - 0.2, (r.z0 + r.z1) / 2]);
  }
  // bande de caillebotis centrale (couloirs) ou bordure
  if (s.floor !== 'concrete') {
    const long = x1 - x0 < z1 - z0;
    if (long) B.add(group, kit.m.grate, new THREE.BoxGeometry(1.0, 0.02, z1 - z0 - 0.6), [(x0 + x1) / 2, y + 0.005, (z0 + z1) / 2]);
    else B.add(group, kit.m.grate, new THREE.BoxGeometry(x1 - x0 - 0.6, 0.02, 1.0), [(x0 + x1) / 2, y + 0.005, (z0 + z1) / 2]);
  }
  for (const hole of s.holes ?? []) {
    // bordure de sécurité jaune/noir autour du trou
    const cx = (hole.x0 + hole.x1) / 2, cz = (hole.z0 + hole.z1) / 2, w = hole.x1 - hole.x0, d = hole.z1 - hole.z0;
    for (const [px, pz, sw, sd] of [[cx, hole.z0 - 0.1, w + 0.4, 0.2], [cx, hole.z1 + 0.1, w + 0.4, 0.2], [hole.x0 - 0.1, cz, 0.2, d], [hole.x1 + 0.1, cz, 0.2, d]] as const) {
      B.add(group, kit.m.orange, rbox(sw, 0.06, sd, 0.01, 1), [px, y + 0.03, pz]);
    }
    B.add(group, kit.m.dark, new THREE.BoxGeometry(w, 6, 0.1), [cx, y - 3, hole.z0 + 0.05]);
    B.add(group, kit.m.dark, new THREE.BoxGeometry(w, 6, 0.1), [cx, y - 3, hole.z1 - 0.05]);
    B.add(group, kit.m.dark, new THREE.BoxGeometry(0.1, 6, d), [hole.x0 + 0.05, y - 3, cz]);
    B.add(group, kit.m.dark, new THREE.BoxGeometry(0.1, 6, d), [hole.x1 - 0.05, y - 3, cz]);
  }

  // --- plafond ---
  if (!s.noCeiling) {
    ph.add([x0 - T, y + h, z0 - T], [x1 + T, y + h + 0.4, z1 + T], { tag: s.mag ? 'mag' : undefined });
    B.add(group, kit.m.ceiling, new THREE.BoxGeometry(x1 - x0 + 2 * T, 0.3, z1 - z0 + 2 * T), [(x0 + x1) / 2, y + h + 0.15, (z0 + z1) / 2]);
    const alongX = x1 - x0 > z1 - z0;
    const len = alongX ? x1 - x0 : z1 - z0;
    const n = Math.max(2, Math.round(len / 2.5));
    for (let i = 0; i <= n; i++) {
      const tpos = (alongX ? x0 : z0) + (len * i) / n;
      if (alongX) B.add(group, kit.m.dark, rbox(0.25, 0.3, z1 - z0, 0.03), [tpos, y + h - 0.15, (z0 + z1) / 2]);
      else B.add(group, kit.m.dark, rbox(x1 - x0, 0.3, 0.25, 0.03), [(x0 + x1) / 2, y + h - 0.15, tpos]);
    }
    // conduites au plafond
    for (const off of [0.6, 0.85]) {
      const g = new THREE.CylinderGeometry(0.08, 0.08, len, 12);
      if (alongX) { g.rotateZ(Math.PI / 2); B.add(group, kit.m.steel, g, [(x0 + x1) / 2, y + h - 0.45, z0 + off]); }
      else { g.rotateX(Math.PI / 2); B.add(group, kit.m.steel, g, [x0 + off, y + h - 0.45, (z0 + z1) / 2]); }
    }
  }

  // --- murs ---
  const sides: Side[] = ['n', 's', 'w', 'e'];
  const stripMat = kit.strip(s.id);
  const lightCol = s.lightColor ?? 0xbfe6ff;
  for (const side of sides) {
    if (s.skip?.includes(side)) continue;
    const alongX = side === 'n' || side === 's';
    const a0 = alongX ? x0 - T : z0 - T, a1 = alongX ? x1 + T : z1 + T;
    const fixed = side === 'n' ? z0 - T / 2 : side === 's' ? z1 + T / 2 : side === 'w' ? x0 - T / 2 : x1 + T / 2;
    const inward = side === 'n' || side === 'w' ? 1 : -1;
    const ops = s.openings.filter((o) => o.side === side).sort((a, b) => a.c - b.c);
    // segments pleins
    let cur = a0;
    const solid: [number, number][] = [];
    for (const o of ops) { solid.push([cur, o.c - o.w / 2]); cur = o.c + o.w / 2; }
    solid.push([cur, a1]);
    const box = (a: number, b: number, yb: number, yt: number, mat: THREE.Material | null, depth = T, off = 0) => {
      if (b - a < 0.01 || yt - yb < 0.01) return;
      const c = (a + b) / 2, w = b - a;
      const pos: V3 = alongX ? [c, (yb + yt) / 2, fixed + off * inward] : [fixed + off * inward, (yb + yt) / 2, c];
      const size: V3 = alongX ? [w, yt - yb, depth] : [depth, yt - yb, w];
      if (mat) B.add(group, mat, new THREE.BoxGeometry(...size), pos);
      return { pos, size };
    };
    const coll = (a: number, b: number, yb: number, yt: number) => {
      const r = box(a, b, yb, yt, null);
      if (r) ph.addCentered(r.pos, r.size, { tag: s.mag ? 'mag' : undefined });
    };
    for (const [a, b] of solid) {
      box(a, b, y, y + h, s.wreck ? kit.m.wallWreck : s.wall === 'white' ? kit.m.wallWhite : kit.m.wall); coll(a, b, y, y + h);
      // plinthe
      box(a, b, y, y + 0.14, kit.m.dark, 0.08, T / 2 + 0.04);
      // détails intérieurs : pilastres tous les ~2 m, bandeau lumineux
      const inA = Math.max(a, alongX ? x0 : z0), inB = Math.min(b, alongX ? x1 : z1);
      if (inB - inA > 0.5) {
        const n = Math.max(1, Math.round((inB - inA) / 2.1));
        for (let i = 0; i <= n; i++) {
          const p = inA + ((inB - inA) * i) / n;
          const c: V3 = alongX ? [p, y + h / 2, fixed + (T / 2 + 0.07) * inward] : [fixed + (T / 2 + 0.07) * inward, y + h / 2, p];
          const geo = alongX ? rbox(0.22, h, 0.14, 0.03) : rbox(0.14, h, 0.22, 0.03);
          B.add(group, kit.m.trim, geo, c);
          const dark: V3 = alongX ? [p, y + h / 2, fixed + (T / 2 + 0.145) * inward] : [fixed + (T / 2 + 0.145) * inward, y + h / 2, p];
          B.add(group, kit.m.dark, alongX ? new THREE.BoxGeometry(0.06, h * 0.7, 0.01) : new THREE.BoxGeometry(0.01, h * 0.7, 0.06), dark);
          // vis aux pilastres
          const sp: V3 = alongX ? [p, y + 0.5, fixed + (T / 2 + 0.141) * inward] : [fixed + (T / 2 + 0.141) * inward, y + 0.5, p];
          const rot: V3 = alongX ? [0, inward > 0 ? 0 : Math.PI, 0] : [0, inward > 0 ? Math.PI / 2 : -Math.PI / 2, 0];
          B.screws(group, kit.m.steel, kit.m.slot, [{ p: sp, r: rot }, { p: [sp[0], y + h - 0.6, sp[2]], r: rot }]);
        }
        // bandeau lumineux haut
        const sy = y + h - 0.32;
        box(inA + 0.15, inB - 0.15, sy - 0.06, sy + 0.06, kit.m.dark, 0.14, T / 2 + 0.07);
        box(inA + 0.25, inB - 0.25, sy - 0.035, sy + 0.035, stripMat, 0.02, T / 2 + 0.145);
        const every = s.stripEvery ?? 4.2;
        const nl = Math.max(1, Math.round((inB - inA) / every));
        for (let i = 0; i < nl; i++) {
          const p = inA + ((inB - inA) * (i + 0.5)) / nl;
          const lp = alongX ? new THREE.Vector3(p, sy - 0.2, fixed + (T / 2 + 0.6) * inward) : new THREE.Vector3(fixed + (T / 2 + 0.6) * inward, sy - 0.2, p);
          lights.push(pool.add(lp, lightCol, 6, 5, s.id, 'neon', 0));
        }
        // conduite murale
        if (h > 3.5) {
          const g = new THREE.CylinderGeometry(0.06, 0.06, inB - inA, 10);
          if (alongX) g.rotateZ(Math.PI / 2); else g.rotateX(Math.PI / 2);
          const cp: V3 = alongX ? [(inA + inB) / 2, y + 1.15, fixed + (T / 2 + 0.2) * inward] : [fixed + (T / 2 + 0.2) * inward, y + 1.15, (inA + inB) / 2];
          B.add(group, kit.m.steel, g, cp);
        }
      }
    }
    // ouvertures : linteaux, allèges, cadres
    for (const o of ops) {
      const oy = y + (o.y ?? 0);
      const a = o.c - o.w / 2, b = o.c + o.w / 2;
      const wm = s.wreck ? kit.m.wallWreck : s.wall === 'white' ? kit.m.wallWhite : kit.m.wall;
      box(a, b, oy + o.h, y + h, wm); coll(a, b, oy + o.h, y + h);
      if (oy > y) { box(a, b, y, oy, wm); coll(a, b, y, oy); }
      if (o.frame !== false) {
        const fd = T + 0.16;
        box(a - 0.18, a, oy, oy + o.h + 0.18, kit.m.trim, fd);
        box(b, b + 0.18, oy, oy + o.h + 0.18, kit.m.trim, fd);
        box(a - 0.18, b + 0.18, oy + o.h, oy + o.h + 0.2, kit.m.trim, fd);
        // bandes de danger
        for (const sgn of [1, -1]) {
          const off = (fd / 2 + 0.003) * sgn;
          const dp: V3 = alongX ? [o.c, oy + o.h + 0.1, fixed + off] : [fixed + off, oy + o.h + 0.1, o.c];
          const rot: V3 = alongX ? [0, sgn > 0 ? 0 : Math.PI, 0] : [0, sgn > 0 ? Math.PI / 2 : -Math.PI / 2, 0];
          B.add(group, kit.m.hazard, new THREE.PlaneGeometry(o.w + 0.2, 0.14), dp, rot);
        }
      }
    }
  }
  return { spec: s, group, builder: B, lights, center: new THREE.Vector3((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2) };
}

function subtract(r: { x0: number; z0: number; x1: number; z1: number }, holes: { x0: number; z0: number; x1: number; z1: number }[]) {
  let rects = [r];
  for (const h of holes) {
    const next: typeof rects = [];
    for (const q of rects) {
      if (h.x1 <= q.x0 || h.x0 >= q.x1 || h.z1 <= q.z0 || h.z0 >= q.z1) { next.push(q); continue; }
      if (h.z0 > q.z0) next.push({ x0: q.x0, z0: q.z0, x1: q.x1, z1: h.z0 });
      if (h.z1 < q.z1) next.push({ x0: q.x0, z0: h.z1, x1: q.x1, z1: q.z1 });
      const mz0 = Math.max(q.z0, h.z0), mz1 = Math.min(q.z1, h.z1);
      if (h.x0 > q.x0) next.push({ x0: q.x0, z0: mz0, x1: h.x0, z1: mz1 });
      if (h.x1 < q.x1) next.push({ x0: h.x1, z0: mz0, x1: q.x1, z1: mz1 });
    }
    rects = next;
  }
  return rects;
}

// ---------- portes ----------

export type DoorState = 'locked' | 'closed' | 'open' | 'jammed';

export class Door {
  group = new THREE.Group();
  state: DoorState;
  open = 0;            // 0 fermé → 1 ouvert
  target = 0;
  private panels: THREE.Mesh[] = [];
  private colls: Collider[] = [];
  private lamp: THREE.MeshBasicMaterial;
  readonly pos: THREE.Vector3;
  readonly alongX: boolean;
  readonly w: number; readonly h: number;
  auto = true;
  room: string;
  onOpen?: () => void;
  private wasMoving = false;

  constructor(kit: Kit, ph: Physics, pos: THREE.Vector3, alongX: boolean, w: number, h: number, state: DoorState, room: string) {
    this.pos = pos.clone(); this.alongX = alongX; this.w = w; this.h = h; this.state = state; this.room = room;
    this.group.position.copy(pos);
    if (!alongX) this.group.rotation.y = Math.PI / 2;
    const half = w / 2;
    for (const sgn of [-1, 1]) {
      const g = new THREE.Group();
      const m = new THREE.Mesh(rbox(half + 0.04, h, 0.14, 0.02), kit.m.shutter);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.16), kit.m.dark);
      edge.position.x = -sgn * (half / 2 + 0.0); edge.castShadow = true;
      g.add(edge);
      for (const zs of [1, -1]) {
        const hz = new THREE.Mesh(new THREE.PlaneGeometry(half * 0.9, 0.16), kit.m.hazard);
        hz.position.set(0, h * 0.18, 0.072 * zs); if (zs < 0) hz.rotation.y = Math.PI;
        g.add(hz);
      }
      g.position.set(sgn * half / 2, h / 2, 0);
      g.userData.sgn = sgn;
      this.group.add(g);
      this.panels.push(g as unknown as THREE.Mesh);
      const c = ph.add([0, 0, 0], [0, 0, 0], { tag: 'door' });
      this.colls.push(c);
    }
    this.lamp = new THREE.MeshBasicMaterial({ color: 0xff2000 });
    const lampMesh = new THREE.Mesh(rbox(0.3, 0.07, 0.26, 0.02, 1), this.lamp);
    lampMesh.position.set(0, h + 0.32, 0);
    this.group.add(lampMesh);
    this.updateColliders();
  }

  setState(s: DoorState) { this.state = s; }

  private updateColliders() {
    const half = this.w / 2;
    this.panels.forEach((p, i) => {
      const sgn = (p as unknown as THREE.Group).userData.sgn as number;
      const slide = this.open * half * 0.98;
      const cx = sgn * (half / 2 + slide);
      const local = new THREE.Vector3(cx, 0, 0);
      if (!this.alongX) local.set(0, 0, -cx);
      const c = this.pos.clone().add(local);
      const hw = half / 2 + 0.02, hd = 0.12;
      const sx = this.alongX ? hw : hd, sz = this.alongX ? hd : hw;
      this.colls[i].box.min.set(c.x - sx, this.pos.y, c.z - sz);
      this.colls[i].box.max.set(c.x + sx, this.pos.y + this.h, c.z + sz);
    });
  }

  update(dt: number, player: THREE.Vector3, sound: (open: boolean) => void) {
    const d = player.distanceTo(this.pos);
    if (this.auto && (this.state === 'closed' || this.state === 'open')) {
      this.target = d < 2.6 ? 1 : 0;
      this.state = this.target ? 'open' : 'closed';
    }
    if (this.state === 'locked') this.target = 0;
    const prev = this.open;
    const sp = this.state === 'jammed' ? 0.5 : 1.6;
    this.open += Math.sign(this.target - this.open) * Math.min(Math.abs(this.target - this.open), dt * sp);
    const moving = Math.abs(this.open - prev) > 1e-4;
    if (moving && !this.wasMoving) sound(this.target > prev);
    if (!moving && this.wasMoving && this.open > 0.95) this.onOpen?.();
    this.wasMoving = moving;
    const half = this.w / 2;
    for (const p of this.panels) {
      const g = p as unknown as THREE.Group;
      g.position.x = g.userData.sgn * (half / 2 + this.open * half * 0.98);
    }
    this.updateColliders();
    const c = this.state === 'locked' ? [3, 0.15, 0.05] : this.state === 'jammed' ? [3, 1.4, 0.1] : [0.2, 3, 0.8];
    this.lamp.color.setRGB(c[0], c[1], c[2]);
  }
}

// ---------- accessoires ----------

export const Props = {
  crate(kit: Kit, B: Builder, g: THREE.Object3D, ph: Physics | null, p: V3, size: V3 = [1, 1, 1], ry = 0, mat?: THREE.Material) {
    B.add(g, mat ?? kit.m.white, rbox(size[0], size[1], size[2], 0.04), [p[0], p[1] + size[1] / 2, p[2]], [0, ry, 0]);
    for (const sy of [0.12, size[1] - 0.12]) B.add(g, kit.m.dark, rbox(size[0] + 0.02, 0.07, size[2] + 0.02, 0.02), [p[0], p[1] + sy, p[2]], [0, ry, 0]);
    if (ph) {
      const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
      const hx = (size[0] * c + size[2] * s) / 2, hz = (size[0] * s + size[2] * c) / 2;
      ph.add([p[0] - hx, p[1], p[2] - hz], [p[0] + hx, p[1] + size[1], p[2] + hz]);
    }
  },
  barrel(kit: Kit, B: Builder, g: THREE.Object3D, ph: Physics | null, p: V3, mat?: THREE.Material) {
    B.add(g, mat ?? kit.m.orange, bcyl(0.3, 0.9, 0.03, 24), [p[0], p[1] + 0.45, p[2]]);
    for (const y of [0.2, 0.7]) B.add(g, kit.m.dark, new THREE.TorusGeometry(0.305, 0.02, 6, 24), [p[0], p[1] + y, p[2]], [Math.PI / 2, 0, 0]);
    if (ph) ph.add([p[0] - 0.3, p[1], p[2] - 0.3], [p[0] + 0.3, p[1] + 0.9, p[2] + 0.3], { camera: false });
  },
  console(kit: Kit, B: Builder, g: THREE.Object3D, ph: Physics | null, p: V3, ry = 0, screen?: THREE.Material) {
    const rot: V3 = [0, ry, 0];
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
    const at = (x: number, y: number, z: number): V3 => { const v = new THREE.Vector3(x, y, z).applyQuaternion(q); return [p[0] + v.x, p[1] + v.y, p[2] + v.z]; };
    B.add(g, kit.m.trim, rbox(1.4, 0.9, 0.6, 0.04), at(0, 0.45, 0), rot);
    B.add(g, kit.m.dark, rbox(1.45, 0.08, 0.75, 0.02), at(0, 0.94, 0.06), [-0.25, ry, 0]);
    B.add(g, kit.m.dark, rbox(1.3, 0.62, 0.08, 0.02), at(0, 1.35, -0.24), [0.18, ry, 0]);
    B.add(g, kit.m.black, rbox(1.2, 0.52, 0.02, 0.01), at(0, 1.36, -0.195), [0.18, ry, 0]);
    if (screen) B.add(g, screen, new THREE.PlaneGeometry(1.14, 0.48), at(0, 1.362, -0.181), [0.18, ry, 0]);
    for (let i = 0; i < 6; i++) B.add(g, i % 2 ? kit.m.steel : kit.m.rubber, rbox(0.12, 0.03, 0.1, 0.01, 1), at(-0.45 + i * 0.18, 0.99, 0.15), [-0.25, ry, 0]);
    if (ph) { const c = at(0, 0, 0); ph.add([c[0] - 0.75, p[1], c[2] - 0.45], [c[0] + 0.75, p[1] + 1.0, c[2] + 0.45]); }
  },
  locker(kit: Kit, B: Builder, g: THREE.Object3D, ph: Physics | null, p: V3, ry = 0, n = 3) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(-((n - 1) * 0.55) / 2 + i * 0.55, 0, 0).applyQuaternion(q);
      const c: V3 = [p[0] + v.x, p[1] + 1.0, p[2] + v.z];
      B.add(g, kit.m.trim, rbox(0.52, 2.0, 0.5, 0.02), c, [0, ry, 0]);
      const f = new THREE.Vector3(0, 0, 0.255).applyQuaternion(q);
      B.add(g, kit.m.dark, vent(0.3, 0.2, 4, 0.01), [c[0] + f.x, c[1] + 0.6, c[2] + f.z], [0, ry, 0]);
      B.add(g, kit.m.steel, rbox(0.03, 0.18, 0.03, 0.008, 1), [c[0] + f.x * 1.06 + 0.18 * Math.cos(ry), c[1], c[2] + f.z * 1.06 - 0.18 * Math.sin(ry)], [0, ry, 0]);
    }
    if (ph) { const w = n * 0.55; const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)); ph.add([p[0] - (w * c + 0.5 * s) / 2, p[1], p[2] - (w * s + 0.5 * c) / 2], [p[0] + (w * c + 0.5 * s) / 2, p[1] + 2, p[2] + (w * s + 0.5 * c) / 2]); }
  },
  bunk(kit: Kit, B: Builder, g: THREE.Object3D, ph: Physics | null, p: V3, ry = 0) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
    const at = (x: number, y: number, z: number): V3 => { const v = new THREE.Vector3(x, y, z).applyQuaternion(q); return [p[0] + v.x, p[1] + y, p[2] + v.z]; };
    for (const y of [0.45, 1.5]) {
      B.add(g, kit.m.trim, rbox(2.1, 0.12, 0.95, 0.02), at(0, y, 0), [0, ry, 0]);
      B.add(g, kit.m.mattress, rbox(1.95, 0.14, 0.85, 0.06), at(0, y + 0.13, 0), [0, ry, 0]);
      B.add(g, kit.m.cloth, rbox(1.1, 0.06, 0.88, 0.03), at(0.35, y + 0.22, 0), [0, ry + 0.04, 0]);
    }
    for (const x of [-1.02, 1.02]) for (const z of [-0.44, 0.44]) B.add(g, kit.m.dark, rbox(0.06, 2.0, 0.06, 0.01, 1), at(x, 1.0, z), [0, ry, 0]);
    if (ph) { const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)); const hx = (2.1 * c + 0.95 * s) / 2, hz = (2.1 * s + 0.95 * c) / 2; ph.add([p[0] - hx, p[1], p[2] - hz], [p[0] + hx, p[1] + 0.62, p[2] + hz], { camera: false }); }
  },
  table(kit: Kit, B: Builder, g: THREE.Object3D, ph: Physics | null, p: V3, w = 1.4, d = 0.8, ry = 0) {
    B.add(g, kit.m.white, rbox(w, 0.06, d, 0.02), [p[0], p[1] + 0.78, p[2]], [0, ry, 0]);
    B.add(g, kit.m.dark, rbox(0.12, 0.75, 0.12, 0.02), [p[0], p[1] + 0.38, p[2]], [0, ry, 0]);
    B.add(g, kit.m.dark, rbox(w * 0.6, 0.04, d * 0.6, 0.01), [p[0], p[1] + 0.02, p[2]], [0, ry, 0]);
    if (ph) ph.add([p[0] - w / 2, p[1] + 0.6, p[2] - d / 2], [p[0] + w / 2, p[1] + 0.81, p[2] + d / 2], { camera: false });
  },
  pipeV(kit: Kit, B: Builder, g: THREE.Object3D, p: V3, h: number, r = 0.1) {
    B.add(g, kit.m.steel, new THREE.CylinderGeometry(r, r, h, 14), [p[0], p[1] + h / 2, p[2]]);
    for (let y = 0.4; y < h; y += 1.2) B.add(g, kit.m.dark, new THREE.CylinderGeometry(r * 1.35, r * 1.35, 0.08, 14), [p[0], p[1] + y, p[2]]);
  },
  cables(kit: Kit, B: Builder, g: THREE.Object3D, pts: V3[], r = 0.03) {
    B.add(g, kit.m.rubber, cable(pts, r, 40));
  },
  valve(kit: Kit, B: Builder, g: THREE.Object3D, p: V3, ry = 0) {
    B.add(g, kit.m.orange, new THREE.TorusGeometry(0.16, 0.025, 8, 24), p, [0, ry, 0]);
    B.add(g, kit.m.dark, lathe([[0.05, 0], [0.06, 0.1], [0.0, 0.12]], 12), p, [Math.PI / 2, ry, 0]);
  },
};
