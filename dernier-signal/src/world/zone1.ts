import * as THREE from 'three';
import { Builder, rbox, bcyl, lathe, vent, cable, type V3 } from '../robots/parts';
import * as M from '../robots/materials';
import { Kit, buildRoom, Door, Props, type Room, type RoomSpec } from './kit';
import { Physics } from './physics';
import { LightPool, type LightSource } from './lights';
import { Particles } from '../fx/particles';
import { LightCone } from '../fx/volumetric';
import { Hologram, Arc, Footprints, SteamJet, Shutter, Valve, buildShuttle, buildStationExterior } from './elements';
import type { AudioEngine } from '../audio/audio';
import type { Quality } from '../core/quality';
import type { ObjectiveKey as OK } from '../story/index';

// Zone 1 · Station Halcyon — missions 0 à 9 (voir MISSIONS.md).
//
//            G Serre ──── H Salle effondrée ──── I Atelier ──── K Brèche
//            │                                                  │
//            F Labo ── E Baie d'observation                     L Hangar
//                      │
//    C Technique ───── J Carrefour ───── D Quartiers (6 cabines) ── R Réfectoire
//                      │
//                      B Coursive
//                      │
//                      A Maintenance (réveil)

export type ObjectiveKey = OK;

export interface Shot { pos: V3; look: V3; to?: V3; lookTo?: V3; dur: number; fov?: number; shake?: number; }

export interface GameApi {
  flags: Record<string, boolean>;
  playLog(id: string): void;
  playHolo(id: string, holo: Hologram, onDone?: () => void): void;
  setObjective(k: ObjectiveKey): void;
  completeMission(k: ObjectiveKey, next: ObjectiveKey): void;
  checkpoint(id: string): void;
  kill(reason: string): void;
  toast(msg: string, sub?: string): void;
  enterRoom(id: string): void;
  clue(id: string): void;
  unlock(what: 'lamp' | 'scan' | 'jetpack' | 'notebook' | 'boots'): void;
  rumble?(strong: number, weak: number, ms: number): void;
  openKeypad(onCode: (code: string) => boolean): void;
  cinematic(shots: Shot[], onDone?: () => void): void;
  endOfZone(): void;
  saveNow(): void;
  /** Bandeau d'alerte (tempête…) ; null pour l'effacer. */
  alert(text: string | null): void;
  /** Exposition aux radiations 0-1 (effet visuel). */
  radiation(v: number): void;
}

export interface Interactable { id: string; pos: THREE.Vector3; r: number; label: string; verb: string; enabled: () => boolean; act: () => void; }
export interface Scannable { id: string; pos: THREE.Vector3; label: string; clue?: string; onScan?: () => void; }
export interface Checkpoint { id: string; pos: THREE.Vector3; yaw: number; room: string; }

export const CP_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'K', 'L'];

export class Zone1 {
  kit: Kit;
  ph = new Physics();
  pool: LightPool;
  root = new THREE.Group();
  rooms: Record<string, Room> = {};
  adj: Record<string, string[]> = {
    A: ['B'], B: ['A', 'J'], J: ['B', 'C', 'D', 'E'], C: ['J'], D: ['J', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'R'],
    D1: ['D'], D2: ['D'], D3: ['D'], D4: ['D'], D5: ['D'], D6: ['D'], R: ['D'],
    E: ['J', 'F'], F: ['E', 'G'], G: ['F', 'H'], H: ['G', 'I'], I: ['H', 'K'], K: ['I', 'L'], L: ['K'],
  };
  doors: Record<string, Door> = {};
  interact: Interactable[] = [];
  scannables: Scannable[] = [];
  checkpoints: Record<string, Checkpoint> = {};
  objectivePos: Partial<Record<ObjectiveKey, THREE.Vector3>> = {};
  current = 'A';
  powered = false;
  external = new THREE.Vector3();          // force appliquée au joueur (aspiration de la brèche)
  holos: Record<string, Hologram> = {};
  footprints: Footprints[] = [];
  exterior: THREE.Group;
  shuttle: ReturnType<typeof buildShuttle>;
  private api: GameApi;
  private audio: AudioEngine;
  private q: Quality;
  private steam: Particles; private sparks: Particles; private papers: Particles;
  private steamVents: { pos: THREE.Vector3; dir: THREE.Vector3; room: string; rate: number; acc: number; burst: number }[] = [];
  private arcs: { arc: Arc; box: THREE.Box3; light: LightSource; phase: number; room: string; src: THREE.Vector3 }[] = [];
  private jets: { jet: SteamJet; room: string }[] = [];
  private beacons: { mesh: THREE.Object3D; mat: THREE.MeshBasicMaterial; room: string }[] = [];
  private emergency: LightSource[] = [];
  private screens: { tex: THREE.CanvasTexture; draw: (g: CanvasRenderingContext2D, t: number, p: boolean) => void; room: string; mat: THREE.MeshBasicMaterial }[] = [];
  private cones: LightCone[] = [];
  private sockets: { lamp: THREE.MeshBasicMaterial; plug: THREE.Object3D; done: boolean }[] = [];
  private relayMat!: THREE.MeshBasicMaterial;
  private neonChain: { t: number; running: boolean } = { t: -1, running: false };
  private powerT = -1;
  shutter!: Shutter;
  private bayGlass!: THREE.Mesh;
  private breach = { active: true, center: new THREE.Vector3(28, 1.8, -70.4), bulkhead: null as THREE.Mesh | null, close: 0, closing: false };
  private anchors: THREE.Vector3[] = [];
  private valves: Valve[] = [];
  private hangarDoors: THREE.Mesh[] = [];
  hangarOpen = 0;
  private plantMat!: THREE.MeshBasicMaterial;
  private cradleGlass!: THREE.Mesh;
  eyeReflection!: THREE.Group;
  private glassColl!: ReturnType<Physics['add']>;

  constructor(scene: THREE.Scene, q: Quality, api: GameApi, audio: AudioEngine) {
    this.q = q; this.api = api; this.audio = audio;
    this.kit = new Kit(q.textureRes);
    this.pool = new LightPool(scene, q.id === 'econome' ? 4 : q.id === 'equilibre' ? 5 : 6);
    scene.add(this.root);
    this.steam = new Particles({ max: Math.round(600 * q.particles + 120), additive: false, gravity: -0.25, drag: 1.2, soft: true, grow: 3.5 });
    this.sparks = new Particles({ max: 400, additive: true, gravity: 9.8, drag: 0.4, bounceY: 0, bounce: 0.35, soft: false });
    this.papers = new Particles({ max: 160, additive: false, gravity: 0, drag: 0.2, soft: false });
    scene.add(this.steam, this.sparks, this.papers);
    this.exterior = buildStationExterior(this.kit);
    scene.add(this.exterior);
    this.shuttle = buildShuttle(this.kit);
    this.build();
  }

  // ---------- outils ----------
  private room(s: RoomSpec) {
    const r = buildRoom(this.kit, this.ph, this.pool, s);
    this.rooms[s.id] = r;
    this.root.add(r.group);
    return r;
  }
  private door(id: string, room: string, pos: V3, alongX: boolean, state: Door['state'], w = 2.4, h = 2.8) {
    const d = new Door(this.kit, this.ph, new THREE.Vector3(...pos), alongX, w, h, state, room);
    this.rooms[room].group.add(d.group);
    this.doors[id] = d;
    return d;
  }
  private screen(room: string, draw: (g: CanvasRenderingContext2D, t: number, p: boolean) => void) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 1.6, 1.6) });
    this.screens.push({ tex, draw, room, mat });
    return mat;
  }
  private beacon(room: string, p: THREE.Vector3) {
    const r = this.rooms[room];
    r.builder.add(r.group, this.kit.m.dark, bcyl(0.12, 0.08, 0.02, 16), [p.x, p.y + 0.18, p.z]);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.05) });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.18, 16), mat);
    m.position.copy(p).add(new THREE.Vector3(0, 0.05, 0));
    r.group.add(m);
    this.beacons.push({ mesh: m, mat, room });
    this.emergency.push(this.pool.add(p.clone().add(new THREE.Vector3(0, -0.3, 0)), 0xff2a10, 3.2, 5.5, room, 'emergency', 1));
  }
  private examine(id: string, room: string, pos: THREE.Vector3, label: string, clue: string, r = 1.6) {
    this.interact.push({ id, pos, r, label, verb: 'Examiner', enabled: () => !this.api.flags['clue_' + clue], act: () => { this.api.flags['clue_' + clue] = true; this.api.clue(clue); } });
    this.scannables.push({ id: 's_' + id, pos, label, clue });
    void room;
  }
  private cp(id: string, room: string, pos: V3, yaw: number) { this.checkpoints[id] = { id, room, pos: new THREE.Vector3(...pos), yaw }; }
  private holoAt(id: string, room: string, pos: V3, crew: { id: string; x: number; z: number; yaw: number }[], opts: { reflectZ?: number; robot?: V3 } = {}) {
    const h = new Hologram(this.kit, pos, crew, opts);
    this.rooms[room].group.add(h.group);
    if (h.mirror) this.rooms[room].group.add(h.mirror);
    this.holos[id] = h;
    return h;
  }

  private build() {
    const K = this.kit, F = this.api.flags;

    // ================= A · Baie de maintenance (prologue) =================
    const A = this.room({ id: 'A', x0: -5, z0: 0.3, x1: 5, z1: 10.3, y: 0, h: 4.5, openings: [{ side: 'n', c: 0, w: 2.4, h: 2.8 }], lightColor: 0xcfe8ff });
    const BA = A.builder, gA = A.group;
    BA.add(gA, K.m.dark, rbox(1.6, 0.16, 1.4, 0.04), [0, 0.08, 8.6]);
    BA.add(gA, K.m.orange, rbox(1.66, 0.04, 1.46, 0.02), [0, 0.17, 8.6]);
    this.ph.add([-0.8, 0, 7.9], [0.8, 0.18, 9.3], { camera: false });
    BA.add(gA, K.m.trim, rbox(1.4, 2.6, 0.3, 0.05), [0, 1.3, 9.6]);
    BA.add(gA, K.m.dark, rbox(1.1, 1.9, 0.06, 0.02), [0, 1.35, 9.43]);
    for (const x of [-0.75, 0.75]) BA.add(gA, K.m.steel, bcyl(0.06, 2.7, 0.01, 14), [x, 1.35, 9.4]);
    BA.add(gA, K.m.dark, rbox(0.5, 0.2, 0.5, 0.04), [0, 2.5, 9.15]);
    BA.add(gA, K.sign('R-12', 'POSTE DE RECHARGE'), new THREE.PlaneGeometry(0.9, 0.22), [0, 2.35, 9.44]);
    this.ph.add([-0.7, 0, 9.4], [0.7, 2.6, 9.8]);
    // cadre + vitre du poste (les yeux de R-12 s'y reflètent au réveil)
    for (const x of [-0.85, 0.85]) BA.add(gA, K.m.trim, rbox(0.12, 2.6, 0.18, 0.03), [x, 1.3, 7.75]);
    BA.add(gA, K.m.trim, rbox(1.82, 0.14, 0.18, 0.03), [0, 2.62, 7.75]);
    this.cradleGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4), new THREE.MeshPhysicalMaterial({ color: 0x9fb8cc, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.18, depthWrite: false, envMapIntensity: 2 }));
    this.cradleGlass.position.set(0, 1.3, 7.72); this.cradleGlass.rotation.y = Math.PI; gA.add(this.cradleGlass);
    this.glassColl = this.ph.add([-0.8, 0, 7.6], [0.8, 2.6, 7.8]);
    this.eyeReflection = new THREE.Group();
    const eyeRefl = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.7, 2.8), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const eyeShape = new THREE.Shape(); { const w = 0.075, h = 0.105, r = 0.03; eyeShape.moveTo(-w / 2 + r, -h / 2); eyeShape.lineTo(w / 2 - r, -h / 2); eyeShape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); eyeShape.lineTo(w / 2, h / 2 - r); eyeShape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); eyeShape.lineTo(-w / 2 + r, h / 2); eyeShape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); eyeShape.lineTo(-w / 2, -h / 2 + r); eyeShape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); }
    for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.ShapeGeometry(eyeShape, 8), eyeRefl); e.position.set(s * 0.085, 0, 0); this.eyeReflection.add(e); }
    this.eyeReflection.scale.setScalar(0.55);
    this.eyeReflection.position.set(0, 1.085, 7.1);
    this.eyeReflection.userData.mat = eyeRefl;
    gA.add(this.eyeReflection);
    // établi
    BA.add(gA, K.m.trim, rbox(3.6, 0.08, 1.0, 0.02), [-4.0, 0.95, 5.0], [0, Math.PI / 2, 0]);
    BA.add(gA, K.m.dark, rbox(3.4, 0.9, 0.9, 0.03), [-4.05, 0.45, 5.0], [0, Math.PI / 2, 0]);
    this.ph.add([-5, 0, 3.2], [-3.5, 0.99, 6.8], { camera: false });
    BA.add(gA, K.m.white, rbox(0.42, 0.26, 0.28, 0.06), [-4.1, 1.12, 3.9], [0, 0.6, 0]);
    BA.add(gA, K.m.black, rbox(0.34, 0.19, 0.03, 0.04), [-3.98, 1.12, 4.0], [0, 0.6 + Math.PI / 2, 0]);
    BA.add(gA, K.m.dark, bcyl(0.05, 0.5, 0.01, 12), [-4.3, 1.0, 5.6], [0, 0, Math.PI / 2]);
    Props.locker(K, BA, gA, this.ph, [4.4, 0, 6.5], -Math.PI / 2, 3);
    Props.crate(K, BA, gA, this.ph, [3.6, 0, 2.2], [1.0, 0.8, 1.0], 0.2);
    Props.barrel(K, BA, gA, this.ph, [-4.2, 0, 1.3]);
    Props.pipeV(K, BA, gA, [4.6, 0, 0.8], 4.5, 0.12);
    BA.add(gA, K.sign('BAIE DE MAINTENANCE', 'MODULE M-2 · HALCYON'), new THREE.PlaneGeometry(2.4, 0.6), [0, 3.55, 0.31]);
    this.beacon('A', new THREE.Vector3(-4.6, 3.6, 9.8)); this.beacon('A', new THREE.Vector3(4.6, 3.6, 0.8));
    this.steamVents.push({ pos: new THREE.Vector3(4.6, 2.2, 0.8), dir: new THREE.Vector3(-1, 0.2, 0.3), room: 'A', rate: 12, acc: 0, burst: 0 });
    const dA = this.door('dA', 'A', [0, 0, 0.15], true, 'jammed');
    dA.auto = false;
    this.interact.push({
      id: 'forceA', pos: new THREE.Vector3(0, 1.2, 0.6), r: 1.8, label: 'Porte bloquée', verb: 'Forcer l\'ouverture',
      enabled: () => !F.doorA,
      act: () => { F.doorA = true; dA.target = 0.42; this.sparkBurst(new THREE.Vector3(0.2, 2.4, 0.4), 40); this.audio.spark(new THREE.Vector3(0, 2.4, 0.4)); this.api.checkpoint('B'); },
    });
    this.cp('A', 'A', [0, 0.2, 8.5], Math.PI);
    this.objectivePos.init = new THREE.Vector3(0, 1.4, 0.2);

    // ================= B · Coursive (mission 1) =================
    const Bm = this.room({ id: 'B', x0: -1.5, z0: -20, x1: 1.5, z1: 0, y: 0, h: 3.2, openings: [], skip: ['n', 's'], stripEvery: 2.6 });
    const BB = Bm.builder, gB = Bm.group;
    BB.add(gB, K.m.ceiling, rbox(1.2, 0.06, 2.4, 0.01), [0.7, 0.13, -10.6], [0.1, 0.3, 0.12]);
    this.ph.add([0.1, 0, -11.8], [1.4, 0.2, -9.4], { camera: false });
    Props.cables(K, BB, gB, [[-0.6, 3.15, -7.2], [-0.4, 2.6, -7.6], [-0.25, 2.2, -8.0]], 0.035);
    BB.add(gB, K.sign('COURSIVE B', 'MAINTENANCE ⟷ CARREFOUR'), new THREE.PlaneGeometry(1.8, 0.45), [1.33, 2.4, -2.5], [0, -Math.PI / 2, 0]);
    this.steamVents.push({ pos: new THREE.Vector3(-1.35, 0.6, -4.2), dir: new THREE.Vector3(1, 0.4, 0), room: 'B', rate: 16, acc: 0, burst: 0 });
    BB.add(gB, K.m.dark, vent(0.5, 0.4, 5, 0.02), [-1.34, 0.6, -4.2], [0, Math.PI / 2, 0]);
    this.beacon('B', new THREE.Vector3(1.3, 2.9, -14.5));
    // armoire de recharge (récompense : la lampe frontale)
    BB.add(gB, K.m.trim, rbox(0.5, 1.8, 1.0, 0.04), [-1.25, 0.9, -17.5]);
    BB.add(gB, K.m.black, rbox(0.04, 0.5, 0.7, 0.02), [-0.99, 1.3, -17.5]);
    const cabScr = this.screen('B', (g, t) => { g.fillStyle = '#02070b'; g.fillRect(0, 0, 512, 256); g.fillStyle = F.lamp ? '#7dffb2' : (Math.sin(t * 4) > 0 ? '#ffb020' : '#5a3a08'); g.font = '600 40px "Barlow Condensed", sans-serif'; g.fillText(F.lamp ? 'R-12 · LAMPE : OK' : 'RECHARGE R-SÉRIE', 30, 110); g.font = '28px "Barlow Condensed", sans-serif'; g.fillStyle = '#7fb8cc'; g.fillText(F.lamp ? 'Batterie de secours 100 %' : 'Connecteur disponible', 30, 170); });
    BB.add(gB, cabScr, new THREE.PlaneGeometry(0.66, 0.46), [-0.965, 1.3, -17.5], [0, Math.PI / 2, 0]);
    this.ph.add([-1.5, 0, -18], [-1.0, 1.8, -17]);
    this.interact.push({ id: 'cabinet', pos: new THREE.Vector3(-0.9, 1.1, -17.5), r: 1.8, label: 'Armoire de recharge', verb: 'Se brancher', enabled: () => !F.lamp, act: () => this.api.unlock('lamp') });
    this.cp('B', 'B', [0, 0.1, -1.2], Math.PI);
    this.objectivePos.m1 = new THREE.Vector3(-0.9, 1.4, -17.5);
    this.ph.trigger([-1.5, 0, -5], [1.5, 3, -2], { onEnter: () => this.startNeonChain() });

    // ================= J · Carrefour =================
    const J = this.room({ id: 'J', x0: -6, z0: -32.3, x1: 6, z1: -20.3, y: 0, h: 4.5, skip: ['n'], openings: [{ side: 's', c: 0, w: 2.4, h: 2.8 }, { side: 'w', c: -26.3, w: 2.4, h: 2.8 }, { side: 'e', c: -26.3, w: 2.4, h: 2.8 }] });
    const BJ = J.builder, gJ = J.group;
    BJ.add(gJ, K.m.dark, bcyl(1.4, 0.3, 0.05, 40), [0, 0.15, -26.3]);
    BJ.add(gJ, K.m.trim, bcyl(0.25, 4.2, 0.03, 24), [0, 2.4, -26.3]);
    this.ph.add([-0.3, 0, -26.6], [0.3, 4.5, -26]);
    BJ.add(gJ, K.sign('CARREFOUR', '← TECHNIQUE · BAIE ↑ · QUARTIERS →'), new THREE.PlaneGeometry(2.8, 0.7), [0, 3.6, -20.62], [0, Math.PI, 0]);
    Props.crate(K, BJ, gJ, this.ph, [4.6, 0, -21.6], [0.9, 0.9, 0.9], 0.3);
    this.beacon('J', new THREE.Vector3(-5.7, 4.2, -21));
    this.door('dJC', 'J', [-6.15, 0, -26.3], false, 'closed');
    this.door('dJD', 'J', [6.15, 0, -26.3], false, 'locked');
    // panneau secret de Samir (révélé par le scanner)
    BJ.add(gJ, K.m.trim, rbox(0.8, 0.8, 0.06, 0.02), [-4.5, 1.2, -32.0]);
    for (const [dx, dy] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) BJ.screws(gJ, K.m.steel, K.m.slot, [{ p: [-4.5 + dx, 1.2 + dy, -31.965] }]);
    this.scannables.push({ id: 'panelSamir', pos: new THREE.Vector3(-4.5, 1.2, -31.9), label: 'Panneau dévissé', onScan: () => { F.panelSeen = true; } });
    this.interact.push({ id: 'samir1', pos: new THREE.Vector3(-4.5, 1.2, -31.7), r: 1.6, label: 'Panneau dévissé', verb: 'Ouvrir et écouter', enabled: () => !!F.panelSeen, act: () => this.api.playLog('samir1') });

    // ================= C · Salle technique (mission 2) =================
    const C = this.room({ id: 'C', x0: -18.3, z0: -32.3, x1: -6.3, z1: -20.3, y: 0, h: 5, skip: ['e'], openings: [], lightColor: 0xcde9ff });
    const BC = C.builder, gC = C.group;
    this.relayMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    BC.add(gC, K.m.dark, bcyl(1.0, 0.4, 0.04, 40), [-12.3, 0.2, -26.3]);
    BC.add(gC, K.m.trim, bcyl(0.65, 4.6, 0.04, 40), [-12.3, 2.6, -26.3]);
    for (let i = 0; i < 6; i++) BC.add(gC, this.relayMat, new THREE.TorusGeometry(0.67, 0.03, 8, 48), [-12.3, 0.8 + i * 0.65, -26.3], [Math.PI / 2, 0, 0]);
    this.ph.add([-13.1, 0, -27.1], [-11.5, 5, -25.5]);
    const scrSig = this.screen('C', (g, t, p) => this.drawSignal(g, t, p));
    Props.console(K, BC, gC, this.ph, [-15, 0, -31.4], 0, scrSig);
    BC.add(gC, K.sign('SALLE TECHNIQUE', 'DISTRIBUTION · SECOURS'), new THREE.PlaneGeometry(2.6, 0.65), [-12.3, 4.1, -32.29]);
    // enregistreur (journal d'Ilse)
    const rec = M.glow(0x40ff9a, 3);
    BC.add(gC, K.m.dark, rbox(0.22, 0.05, 0.14, 0.015), [-14.4, 1.0, -31.15]);
    BC.add(gC, rec, rbox(0.03, 0.012, 0.03, 0.005, 1), [-14.32, 1.03, -31.1]);
    this.interact.push({ id: 'ilse1', pos: new THREE.Vector3(-14.4, 1.05, -31.0), r: 1.7, label: 'Enregistreur d\'Ilse', verb: 'Écouter', enabled: () => true, act: () => this.api.playLog('ilse1') });
    // trois prises à rebrancher
    const sockets: { p: V3; ry: number; cable: V3[] }[] = [
      { p: [-18.1, 1.2, -23.0], ry: Math.PI / 2, cable: [[-16.5, 0.03, -23.8], [-17.3, 0.05, -23.3], [-17.8, 0.4, -23.1]] },
      { p: [-9.0, 1.2, -32.1], ry: 0, cable: [[-9.6, 0.03, -30.4], [-9.2, 0.05, -31.3], [-9.05, 0.5, -31.9]] },
      { p: [-17.0, 1.2, -20.5], ry: Math.PI, cable: [[-15.6, 0.03, -21.8], [-16.4, 0.05, -21.0], [-16.9, 0.5, -20.7]] },
    ];
    sockets.forEach((s, i) => {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s.ry, 0));
      const at = (x: number, y: number, z: number) => { const v = new THREE.Vector3(x, y, z).applyQuaternion(q); return [s.p[0] + v.x, s.p[1] + v.y, s.p[2] + v.z] as V3; };
      BC.add(gC, K.m.trim, rbox(0.7, 0.9, 0.2, 0.04), at(0, 0, 0.05), [0, s.ry, 0]);
      BC.add(gC, K.m.hazard, new THREE.PlaneGeometry(0.66, 0.1), at(0, -0.36, 0.156), [0, s.ry, 0]);
      BC.add(gC, K.m.rubber, cable(s.cable, 0.03, 20));
      const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.05) });
      const lm = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), lamp); lm.position.set(...at(0, 0.25, 0.156)); lm.rotation.y = s.ry; gC.add(lm);
      const plug = new THREE.Mesh(rbox(0.16, 0.16, 0.22, 0.03), K.m.orange as THREE.Material);
      plug.position.set(...s.cable[0]); plug.position.y = 0.08; gC.add(plug);
      plug.userData.target = new THREE.Vector3(...at(0, -0.05, 0.25));
      this.sockets.push({ lamp, plug, done: false });
      const sp = new THREE.Vector3(...s.p);
      this.steamVents.push({ pos: new THREE.Vector3(...s.cable[0]).setY(0.15), dir: new THREE.Vector3(0, 0.3, 0), room: 'C', rate: 0, acc: 0, burst: 0 });
      this.interact.push({
        id: 'socket' + i, pos: sp.clone().add(new THREE.Vector3(0, 0, 0)).lerp(new THREE.Vector3(...s.cable[0]), 0.4), r: 2.0, label: `Câble ${i + 1} sur 3`, verb: 'Rebrancher',
        enabled: () => !this.sockets[i].done && !this.powered,
        act: () => this.plugSocket(i),
      });
    });
    // arcs électriques (danger)
    const arcMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 6, 12) });
    const arcSpots: [V3, V3, number][] = [[[-15.5, 4.9, -24.2], [-15.5, 0.1, -24.2], 0], [[-9.5, 4.9, -28.8], [-9.5, 0.1, -28.8], 1.3], [[-12.3, 4.9, -22.2], [-12.3, 0.1, -22.2], 2.1]];
    for (const [a, b, ph] of arcSpots) {
      BC.add(gC, K.m.rubber, cable([[a[0] + 0.3, 5, a[2]], [a[0] + 0.1, 4.8, a[2]], [a[0], 4.6, a[2]]], 0.04, 10));
      const arc = new Arc(new THREE.Vector3(a[0], 4.6, a[2]), new THREE.Vector3(...b), gC, arcMat);
      const light = this.pool.add(new THREE.Vector3(a[0], 1.6, a[2]), 0x8fc8ff, 8, 5, 'C', 'spark', 0);
      this.arcs.push({ arc, light, phase: ph, room: 'C', src: new THREE.Vector3(a[0], 4.6, a[2]), box: new THREE.Box3(new THREE.Vector3(b[0] - 0.9, 0, b[2] - 0.9), new THREE.Vector3(b[0] + 0.9, 5, b[2] + 0.9)) });
      BC.add(gC, K.m.hazard, new THREE.PlaneGeometry(1.8, 1.8), [b[0], 0.012, b[2]], [-Math.PI / 2, 0, 0]);
    }
    this.beacon('C', new THREE.Vector3(-17.9, 4.4, -31.8));
    this.cp('C', 'C', [-7.6, 0.1, -26.3], Math.PI / 2);
    this.objectivePos.m2 = new THREE.Vector3(-12.3, 1.6, -26.3);

    // ================= D · Quartiers + 6 cabines + réfectoire (mission 3) =================
    const cabX: [number, number][] = [[7.6, 15], [15.3, 22.7], [23, 30.3]];
    const cabC = cabX.map(([a, b]) => (a + b) / 2);
    const D = this.room({ id: 'D', x0: 6.3, z0: -28.3, x1: 30.3, z1: -24.3, y: 0, h: 3.4, skip: ['w', 'e'], lightColor: 0xffd7aa,
      openings: [...cabC.map((c) => ({ side: 'n' as const, c, w: 1.4, h: 2.4 })), ...cabC.map((c) => ({ side: 's' as const, c, w: 1.4, h: 2.4 }))] });
    const BD = D.builder, gD = D.group;
    BD.add(gD, K.sign('QUARTIERS', 'ÉQUIPAGE · HALCYON'), new THREE.PlaneGeometry(1.8, 0.45), [7.0, 2.7, -24.32], [0, Math.PI, 0]);
    const names = ['ILSE VARGA', 'TOMÁS REYES', 'NAOMI ACHEBE', 'KENJI MORI', 'LÉA FONTAINE', 'SAMIR HADDAD'];
    for (let i = 0; i < 6; i++) {
      const north = i < 3; const [x0, x1] = cabX[i % 3]; const c = cabC[i % 3];
      const id = 'D' + (i + 1);
      const spec: RoomSpec = north
        ? { id, x0, z0: -34.3, x1, z1: -28.6, y: 0, h: 3.0, openings: [], skip: i % 3 ? ['s', 'w'] : ['s'], lightColor: 0xffd2a0, wall: 'white', stripEvery: 3.5 }
        : { id, x0, z0: -24.0, x1, z1: -18.3, y: 0, h: 3.0, openings: [], skip: i % 3 ? ['n', 'w'] : ['n'], lightColor: 0xffd2a0, wall: 'white', stripEvery: 3.5 };
      const R = this.room(spec);
      const zDoor = north ? -28.45 : -24.15;
      this.door('dCab' + (i + 1), 'D', [c, 0, zDoor], true, 'closed', 1.4, 2.4).room = 'D';
      // plaque nominative
      BD.add(gD, K.sign(names[i], '', 1024, 160), new THREE.PlaneGeometry(1.2, 0.19), [c, 2.65, north ? -28.28 : -24.32], [0, north ? 0 : Math.PI, 0]);
      // mobilier de cabine
      const zf = north ? -33.2 : -19.4, zm = north ? -31.5 : -21.2, ry = north ? 0 : Math.PI;
      Props.bunk(K, R.builder, R.group, this.ph, [x0 + 1.2, 0, zm], Math.PI / 2);
      Props.table(K, R.builder, R.group, this.ph, [x1 - 1.6, 0, zf + (north ? 0.5 : -0.5)], 1.6, 0.7, 0);
      Props.locker(K, R.builder, R.group, this.ph, [x1 - 0.4, 0, zm], -Math.PI / 2, 1);
      void ry;
    }
    // indices des cabines
    const cab = (i: number) => this.rooms['D' + (i + 1)].builder;
    const cg = (i: number) => this.rooms['D' + (i + 1)].group;
    // Ilse : tasse renversée sur un rapport
    cab(0).add(cg(0), K.m.white, lathe([[0, 0], [0.045, 0], [0.048, 0.1], [0, 0.1]], 16), [13.2, 0.83, -32.6], [Math.PI / 2, 0, 0.4]);
    cab(0).add(cg(0), new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.15 }), new THREE.CircleGeometry(0.18, 20), [13.35, 0.815, -32.55], [-Math.PI / 2, 0, 0]);
    this.examine('tasse', 'D1', new THREE.Vector3(13.3, 0.85, -32.6), 'Tasse renversée', 'tasse');
    // Tomás : plan de R-12
    const plan = M.textTexture([{ text: 'R-12', size: 90, y: 70, color: '#cfe8ff' }, { text: 'genou gauche — à revoir', size: 36, y: 200, color: '#ffcf6a', font: 'italic 600' }], 512, 256);
    cab(1).add(cg(1), new THREE.MeshStandardMaterial({ map: plan, color: 0x6688aa, roughness: 0.6 }), new THREE.PlaneGeometry(0.7, 0.35), [20.6, 0.815, -32.7], [-Math.PI / 2, 0, 0]);
    this.examine('plan', 'D2', new THREE.Vector3(20.6, 0.85, -32.7), 'Plan sur le bureau', 'plan');
    // Naomi : dessin de la planète
    const dessin = this.drawingTexture();
    cab(2).add(cg(2), new THREE.MeshStandardMaterial({ map: dessin, roughness: 0.7 }), new THREE.PlaneGeometry(0.6, 0.42), [26.65, 1.6, -34.28]);
    this.examine('dessin', 'D3', new THREE.Vector3(26.65, 1.6, -34.1), 'Dessin au mur', 'dessin');
    // Kenji : lit défait
    cab(3).add(cg(3), K.m.cloth, rbox(1.2, 0.2, 0.7, 0.1), [8.9, 0.75, -21.4], [0.2, 0.4, 0.1]);
    cab(3).add(cg(3), K.m.cloth, rbox(1.0, 0.05, 0.8, 0.02), [9.6, 0.03, -22.6], [0, 0.6, 0]);
    this.examine('lit', 'D4', new THREE.Vector3(8.8, 0.8, -21.2), 'Lit défait', 'lit');
    // Léa : journal (texte) + photo d'équipage
    const tab = this.screen('D5', (g) => { g.fillStyle = '#0a1016'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#cfe6f2'; g.font = '600 30px "Barlow Condensed", sans-serif'; g.fillText('L. FONTAINE — JOURNAL', 24, 46); g.fillStyle = '#6f8fa0'; g.font = '22px "Barlow", sans-serif'; ['Jour 220', 'On ne mange plus ensemble.', 'Samir dort à côté de ses écrans…'].forEach((l, i) => g.fillText(l, 24, 92 + i * 36)); });
    cab(4).add(cg(4), K.m.dark, rbox(0.3, 0.02, 0.22, 0.01), [21.1, 0.82, -19.8], [0, 0.3, 0]);
    cab(4).add(cg(4), tab, new THREE.PlaneGeometry(0.26, 0.18), [21.1, 0.832, -19.8], [-Math.PI / 2, 0, 0.3]);
    this.interact.push({ id: 'lea1', pos: new THREE.Vector3(21.1, 0.9, -19.8), r: 1.7, label: 'Journal de Léa', verb: 'Lire', enabled: () => true, act: () => { this.api.playLog('lea1'); if (!F.notebook) { this.api.unlock('notebook'); this.api.completeMission('m3', 'm4'); } } });
    const photo = this.photoTexture();
    cab(4).add(cg(4), K.m.dark, rbox(0.62, 0.45, 0.03, 0.01), [19.0, 1.7, -18.32]);
    cab(4).add(cg(4), new THREE.MeshStandardMaterial({ map: photo, roughness: 0.4 }), new THREE.PlaneGeometry(0.56, 0.39), [19.0, 1.7, -18.3], [0, Math.PI, 0]);
    this.examine('photo', 'D5', new THREE.Vector3(19.0, 1.7, -18.5), 'Photo au mur', 'photo');
    // Samir : casque branché
    cab(5).add(cg(5), K.m.dark, new THREE.TorusGeometry(0.1, 0.018, 8, 20, Math.PI), [28.5, 0.92, -19.8], [0, 0.4, 0]);
    cab(5).add(cg(5), K.m.rubber, cable([[28.5, 0.82, -19.8], [28.2, 0.84, -19.6], [27.9, 0.83, -19.7]], 0.006, 10));
    this.examine('casque', 'D6', new THREE.Vector3(28.4, 0.9, -19.8), 'Casque audio', 'casque');
    this.cp('D', 'D', [7.4, 0.1, -26.3], -Math.PI / 2);
    this.objectivePos.m3 = new THREE.Vector3(19.0, 1.4, -24.15);

    const Rr = this.room({ id: 'R', x0: 30.6, z0: -32.3, x1: 40.6, z1: -20.3, y: 0, h: 4, lightColor: 0xffe0b8, openings: [{ side: 'w', c: -26.3, w: 2.4, h: 2.8 }] });
    this.door('dDR', 'R', [30.45, 0, -26.3], false, 'closed');
    for (const z of [-23, -29.5]) { Props.table(K, Rr.builder, Rr.group, this.ph, [35.6, 0, z], 3.0, 1.0); }
    Rr.builder.add(Rr.group, K.sign('RÉFECTOIRE', ''), new THREE.PlaneGeometry(1.8, 0.45), [40.58, 2.6, -26.3], [0, -Math.PI / 2, 0]);
    this.holoAt('anniv', 'R', [35.6, 0, -26.3], [
      { id: 'reyes', x: -0.6, z: 0.5, yaw: 2.6 }, { id: 'fontaine', x: 0.3, z: -0.6, yaw: 0.2 }, { id: 'haddad', x: 0.9, z: 0.3, yaw: -2.2 }, { id: 'achebe', x: -0.4, z: -0.5, yaw: 0.8 },
    ]);
    this.ph.add([34.9, 0, -27], [36.3, 0.12, -25.6], { camera: false });
    this.interact.push({ id: 'anniv', pos: new THREE.Vector3(35.6, 0.8, -26.3), r: 2.0, label: 'Projecteur poussiéreux', verb: 'Lire l\'enregistrement', enabled: () => this.powered, act: () => this.api.playHolo('anniv', this.holos.anniv) });

    // ================= E · Baie d'observation (mission 4) =================
    const E = this.room({ id: 'E', x0: -7, z0: -46.6, x1: 7, z1: -32.6, y: 0, h: 7, lightColor: 0xb8dcff, wall: 'white',
      openings: [{ side: 's', c: 0, w: 2.4, h: 2.8 }, { side: 'w', c: -40.6, w: 2.4, h: 2.8 }, { side: 'n', c: 0, w: 12, h: 5, y: 1, frame: false }] });
    const BE = E.builder, gE = E.group;
    this.door('dJE', 'E', [0, 0, -32.45], true, 'locked');
    this.door('dEF', 'E', [-7.15, 0, -40.6], false, 'locked');
    this.bayGlass = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), K.m.glassWin);
    this.bayGlass.position.set(0, 3.5, -46.75); gE.add(this.bayGlass);
    this.ph.add([-6, 1, -47], [6, 6, -46.6]);
    for (let i = 0; i <= 6; i++) BE.add(gE, K.m.trim, rbox(0.22, 5.1, 0.4, 0.04), [-6 + i * 2, 3.5, -46.75]);
    BE.add(gE, K.m.trim, rbox(12.3, 0.25, 0.45, 0.04), [0, 6.05, -46.75]);
    BE.add(gE, K.m.trim, rbox(12.3, 0.25, 0.45, 0.04), [0, 0.95, -46.75]);
    this.shutter = new Shutter(K, new THREE.Vector3(0, 3.5, -46.35), 12.1, 5.1, 9);
    gE.add(this.shutter.group);
    for (const x of [-3.2, 3.2]) { BE.add(gE, K.m.white, rbox(2.4, 0.12, 0.7, 0.04), [x, 0.45, -41.5]); BE.add(gE, K.m.dark, rbox(2.0, 0.42, 0.4, 0.03), [x, 0.21, -41.5]); this.ph.add([x - 1.2, 0, -41.85], [x + 1.2, 0.51, -41.15], { camera: false }); }
    // console du volet (clavier) + console avec le code griffonné dessous
    const shScr = this.screen('E', (g, t) => { g.fillStyle = '#02070b'; g.fillRect(0, 0, 512, 256); g.font = '600 36px "Barlow Condensed", sans-serif'; g.fillStyle = F.shutter ? '#7dffb2' : (Math.sin(t * 3) > 0 ? '#ffb020' : '#6a4808'); g.fillText(F.shutter ? 'VOLET : OUVERT' : 'VOLET : VERROUILLÉ', 24, 70); g.font = '26px "Barlow Condensed", sans-serif'; g.fillStyle = '#7fb8cc'; g.fillText(F.shutter ? 'Vue extérieure dégagée' : 'Code d\'accès requis — 4 chiffres', 24, 120); });
    Props.console(K, BE, gE, this.ph, [0, 0, -44.6], 0, shScr);
    this.interact.push({ id: 'keypad', pos: new THREE.Vector3(0, 1.1, -43.9), r: 1.8, label: 'Commande du volet', verb: 'Saisir le code', enabled: () => this.powered && !F.shutter,
      act: () => this.api.openKeypad((code) => { if (code !== '2147') return false; this.openShutter(); return true; }) });
    const scrB = this.screen('E', (g, t, p) => this.drawSignal(g, t, p));
    Props.console(K, BE, gE, this.ph, [-5.2, 0, -36.2], Math.PI / 2, scrB);
    this.interact.push({ id: 'code', pos: new THREE.Vector3(-4.6, 0.6, -36.2), r: 1.6, label: 'Console de communication', verb: 'Examiner le dessous', enabled: () => !F.clue_code, act: () => { F.clue_code = true; this.api.clue('code'); } });
    this.holoAt('fete', 'E', [0, 0, -40.6], [
      { id: 'haddad', x: 0, z: -0.3, yaw: 0 }, { id: 'reyes', x: -1.0, z: 0.4, yaw: 0.7 }, { id: 'achebe', x: 1.0, z: 0.5, yaw: -0.6 },
      { id: 'varga', x: -0.6, z: 1.3, yaw: 2.9 }, { id: 'fontaine', x: 0.7, z: 1.4, yaw: -2.8 }, { id: 'mori', x: -1.7, z: -0.6, yaw: 1.0 },
    ], { reflectZ: -46.75 });
    BE.add(gE, K.sign('BAIE D\'OBSERVATION', ''), new THREE.PlaneGeometry(2.4, 0.6), [6.98, 4.5, -36.0], [0, -Math.PI / 2, 0]);
    for (const x of [-4, 4]) this.pool.add(new THREE.Vector3(x, 4.5, -46.2), 0x6f9fe0, 7, 9, 'E', 'screen', 0);
    this.cp('E', 'E', [0, 0.1, -33.9], Math.PI);
    this.objectivePos.m4 = new THREE.Vector3(0, 1.5, -44.2);

    // ================= F · Laboratoire de Naomi (mission 5) =================
    const Fl = this.room({ id: 'F', x0: -21.3, z0: -46.6, x1: -7.3, z1: -34.6, y: 0, h: 4, skip: ['e', 'n'], lightColor: 0xd8f0ff, wall: 'white', openings: [] });
    const BF = Fl.builder, gF = Fl.group;
    for (const z of [-38.5, -42.5]) { BF.add(gF, K.m.white, rbox(7, 0.1, 1.2, 0.03), [-14.5, 0.95, z]); BF.add(gF, K.m.dark, rbox(6.8, 0.9, 1.0, 0.03), [-14.5, 0.45, z]); this.ph.add([-18, 0, z - 0.6], [-11, 1.0, z + 0.6]); }
    // échantillons figés : cylindres givrés
    const frost = new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, roughness: 0.25, transparent: true, opacity: 0.55, depthWrite: false });
    const sample = M.glow(0x4fe0b0, 1.3);
    for (let i = 0; i < 8; i++) {
      const x = -17.5 + i * 0.85, z = i % 2 ? -38.5 : -42.5;
      BF.add(gF, sample, bcyl(0.05, 0.25, 0.01, 10), [x, 1.13, z]);
      BF.add(gF, frost, bcyl(0.09, 0.36, 0.02, 14), [x, 1.18, z]);
    }
    // plantes mortes en pots
    const deadPlant = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.95 });
    for (let i = 0; i < 6; i++) { const x = -20.6, z = -36 - i * 1.6; BF.add(gF, K.m.trim, bcyl(0.25, 0.4, 0.03, 16), [x, 0.2, z]); for (let k = 0; k < 4; k++) BF.add(gF, deadPlant, bcyl(0.012, 0.6, 0.004, 5), [x + (k - 1.5) * 0.06, 0.65, z], [0.3 * (k - 1.5), 0, 0.2]); }
    // module de scan
    const scanMod = new THREE.Group(); scanMod.position.set(-12, 1.0, -42.5); gF.add(scanMod);
    const smB = new Builder(); smB.add(scanMod, K.m.orange, rbox(0.3, 0.18, 0.22, 0.04), [0, 0.09, 0]); smB.add(scanMod, M.glow(0x5fe6ff, 4), new THREE.TorusGeometry(0.08, 0.012, 8, 24), [0, 0.2, 0], [Math.PI / 2, 0, 0]); smB.build();
    scanMod.name = 'scanmod';
    this.interact.push({ id: 'scanmod', pos: new THREE.Vector3(-12, 1.1, -42.5), r: 1.8, label: 'Module de scan', verb: 'Installer', enabled: () => !F.scan, act: () => { this.api.unlock('scan'); scanMod.visible = false; } });
    const labScr = this.screen('F', (g) => { g.fillStyle = '#04100c'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#7dffc8'; g.font = '600 30px "Barlow Condensed", sans-serif'; g.fillText('N. ACHEBE — RELEVÉS SURFACE', 20, 44); for (let i = 0; i < 40; i++) { const h = 30 + Math.abs(Math.sin(i * 0.7)) * 120; g.fillStyle = `rgba(80,255,170,${0.3 + (i % 3) * 0.2})`; g.fillRect(20 + i * 12, 230 - h, 8, h); } });
    Props.console(K, BF, gF, this.ph, [-8.4, 0, -45.6], -Math.PI / 4, labScr);
    this.interact.push({ id: 'naomi1', pos: new THREE.Vector3(-8.9, 1.1, -45.0), r: 1.8, label: 'Terminal de Naomi', verb: 'Écouter', enabled: () => true, act: () => this.api.playLog('naomi1') });
    BF.add(gF, K.sign('LABORATOIRE', 'BIOLOGIE · N. ACHEBE'), new THREE.PlaneGeometry(2.2, 0.55), [-14.3, 3.2, -34.62], [0, Math.PI, 0]);
    // empreintes de Naomi : du labo vers la porte de la serre
    const fpLab = new Footprints([[-9.5, 0, -37.5], [-10.3, 0, -40.5], [-10.3, 0, -44.5], [-10.3, 0, -46.4]], new THREE.Color(0.3, 1.6, 1.0));
    gF.add(fpLab.mesh); this.footprints.push(fpLab);
    this.cp('F', 'F', [-8.4, 0.1, -40.6], -Math.PI / 2);
    this.objectivePos.m5 = new THREE.Vector3(-12, 1.4, -42.5);

    // ================= G · Serre hydroponique (mission 6) =================
    const G = this.room({ id: 'G', x0: -24, z0: -70, x1: -6, z1: -46.9, y: 0, h: 8, lightColor: 0xb8ffd8, stripEvery: 5, openings: [{ side: 's', c: -10.3, w: 2.4, h: 2.8 }, { side: 'e', c: -63, w: 2.4, h: 2.8 }] });
    const BG = G.builder, gG = G.group;
    this.door('dFG', 'G', [-10.3, 0, -46.75], true, 'locked');
    // rangées de bacs hydroponiques avec plantes séchées
    const dry = new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 0.95 });
    const water = new THREE.MeshStandardMaterial({ color: 0x050a0a, roughness: 0.04, metalness: 0.0, envMapIntensity: 1.6 });
    for (const x of [-21, -17, -13]) {
      BG.add(gG, K.m.trim, rbox(1.6, 0.8, 16, 0.04), [x, 0.4, -59]);
      BG.add(gG, water, new THREE.PlaneGeometry(1.4, 15.8), [x, 0.81, -59], [-Math.PI / 2, 0, 0]);
      this.ph.add([x - 0.8, 0, -67], [x + 0.8, 0.82, -51]);
      for (let k = 0; k < 18; k++) BG.add(gG, dry, bcyl(0.015, 0.5 + (k % 3) * 0.15, 0.004, 5), [x + (k % 2 ? 0.35 : -0.35), 1.1, -66.5 + k * 0.85], [0.3 * Math.sin(k), 0, 0.4 * Math.cos(k * 1.7)]);
    }
    // flaques d'eau stagnante
    for (const [x, z, r] of [[-9, -52, 1.6], [-15, -68, 1.3], [-8.5, -66, 1.2]] as const) BG.add(gG, water, new THREE.CircleGeometry(r, 32), [x, 0.012, z], [-Math.PI / 2, 0, 0]);
    // conduits au plafond + rayons de lumière dans la vapeur
    for (const z of [-52, -59, -66]) {
      BG.add(gG, K.m.steel, bcyl(0.6, 0.5, 0.05, 20), [-15, 7.7, z]);
      if (this.q.volumetric) { const cone = new LightCone(new THREE.Vector3(-15, 7.6, z), new THREE.Vector3(-14, 0, z + 1), 2.2, 0xc8ffe8, 0.06); gG.add(cone); this.cones.push(cone); }
      this.pool.add(new THREE.Vector3(-15, 5, z), 0xc8ffe0, 5, 8, 'G', 'neon', 0);
    }
    // jets de vapeur brûlante sur le chemin (danger)
    const jetSpots: [number, number, number][] = [[-10.3, -50.5, 0], [-8.6, -55, 1.4], [-10.8, -58.5, 2.6], [-8.4, -62.2, 0.8]];
    for (const [x, z, ph] of jetSpots) {
      const jet = new SteamJet(new THREE.Vector3(x, 0, z), 4.5, 4.0, 1.4, ph, 0.6);
      gG.add(jet.group);
      BG.add(gG, K.m.dark, bcyl(0.45, 0.1, 0.02, 16), [x, 0.05, z]);
      BG.add(gG, K.m.hazard, new THREE.RingGeometry(0.5, 0.75, 24), [x, 0.012, z], [-Math.PI / 2, 0, 0]);
      this.jets.push({ jet, room: 'G' });
      this.steamVents.push({ pos: new THREE.Vector3(x, 0.15, z), dir: new THREE.Vector3(0, 1.2, 0), room: 'G', rate: 8, acc: 0, burst: 0 });
    }
    for (let i = 0; i < 5; i++) this.steamVents.push({ pos: new THREE.Vector3(-23.7, 0.5, -50 - i * 4.5), dir: new THREE.Vector3(1, 0.3, 0), room: 'G', rate: 18, acc: 0, burst: 0 });
    // la dernière plante vivante, tournée vers la planète
    this.plantMat = M.glow(0x5fffb0, 2.5);
    BG.add(gG, K.m.trim, bcyl(0.3, 0.45, 0.03, 20), [-22.6, 0.22, -68.6]);
    const stem = new THREE.Mesh(lathe([[0.02, 0], [0.015, 0.6], [0.008, 1.1], [0, 1.15]], 8), new THREE.MeshStandardMaterial({ color: 0x2f8a4a, roughness: 0.6 }));
    stem.position.set(-22.6, 0.45, -68.6); stem.rotation.set(-0.5, 0, 0.3); gG.add(stem);
    for (let k = 0; k < 4; k++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 6), this.plantMat); leaf.scale.set(1, 0.3, 1.8); leaf.position.set(-22.6 + 0.05 * k, 0.75 + k * 0.18, -68.75 - k * 0.12); gG.add(leaf); }
    this.pool.add(new THREE.Vector3(-22.6, 1.2, -68.4), 0x5fffb0, 2.5, 3, 'G', 'screen', 1);
    this.examine('plante', 'G', new THREE.Vector3(-22.6, 1.0, -68.4), 'Plante vivante', 'plante', 1.8);
    // grille d'aération avec la photo de Kenji (secret, révélé au scanner)
    BG.add(gG, K.m.dark, vent(0.6, 0.4, 5, 0.03), [-23.85, 0.45, -55.0], [0, Math.PI / 2, 0]);
    this.scannables.push({ id: 'grille', pos: new THREE.Vector3(-23.8, 0.45, -55), label: 'Quelque chose dans la grille', onScan: () => { F.grilleSeen = true; } });
    this.interact.push({ id: 'famille', pos: new THREE.Vector3(-23.4, 0.5, -55), r: 1.6, label: 'Grille d\'aération', verb: 'Récupérer', enabled: () => !!F.grilleSeen && !F.clue_famille, act: () => { F.clue_famille = true; this.api.clue('famille'); } });
    BG.add(gG, K.sign('SERRE HYDROPONIQUE', 'BAIE H-3'), new THREE.PlaneGeometry(3.2, 0.8), [-15, 6.2, -46.92], [0, Math.PI, 0]);
    this.cp('G', 'G', [-10.3, 0.1, -48.3], Math.PI);
    this.objectivePos.m6 = new THREE.Vector3(-6.15, 1.4, -63);

    // ================= H · Salle effondrée (mission 7) =================
    const holes = [
      { x0: -4.5, z0: -68.8, x1: 8.5, z1: -57.2 },   // effondrement principal
      { x0: 1.2, z0: -70, x1: 2.8, z1: -68.8 },     // brèche dans la corniche nord (à sauter)
      { x0: -1, z0: -57.2, x1: 5, z1: -56 },        // corniche sud effondrée (impasse)
    ];
    const H = this.room({ id: 'H', x0: -5.7, z0: -70, x1: 9.7, z1: -56, y: 0, h: 6, skip: ['w'], holes, openings: [{ side: 'e', c: -63, w: 2.4, h: 2.8 }] });
    const BH = H.builder, gH = H.group;
    this.door('dGH', 'G', [-5.85, 0, -63], false, 'closed');
    // poutres tordues, gravats suspendus
    BH.add(gH, K.m.dark, rbox(10, 0.3, 0.3, 0.04), [2, -0.6, -63], [0, 0.2, 0.15]);
    BH.add(gH, K.m.dark, rbox(0.3, 0.3, 9, 0.04), [3.5, -1.5, -62], [0.25, 0, 0]);
    for (let i = 0; i < 8; i++) BH.add(gH, K.m.floor, rbox(1.2 + (i % 3) * 0.4, 0.15, 0.9, 0.03), [-2 + i * 1.4, -2 - (i % 4) * 1.2, -64 + (i % 3)], [0.4 * (i % 2 ? 1 : -1), i, 0.3]);
    this.ph.trigger([-6, -30, -70], [10, -2.5, -56], { onEnter: () => this.api.kill('Chute dans le vide') });
    this.pool.add(new THREE.Vector3(2, -3, -63), 0xff6a30, 4, 7, 'H', 'emergency', 1);
    for (const [x, z] of [[-4.6, -66], [4, -69.3], [9.0, -65]] as const) this.pool.add(new THREE.Vector3(x, 3.5, z), 0x9fc8ff, 5, 6, 'H', 'screen', 1);
    // bords des corniches : bandes jaunes et noires bien visibles
    const edge = (x0: number, z0: number, x1: number, z1: number) => { const w = Math.max(0.08, x1 - x0), d = Math.max(0.08, z1 - z0); BH.add(gH, K.m.hazard, new THREE.PlaneGeometry(w, d), [(x0 + x1) / 2, 0.013, (z0 + z1) / 2], [-Math.PI / 2, 0, 0]); };
    edge(-4.5, -68.8, -4.2, -57.2); edge(8.2, -68.8, 8.5, -57.2); edge(-4.5, -68.8, 1.2, -68.5); edge(2.8, -68.8, 8.5, -68.5); edge(1.2, -69.95, 1.45, -68.8); edge(2.55, -69.95, 2.8, -68.8);
    const fpH = new Footprints([[-4.9, 0, -63], [-4.9, 0, -69.2], [0.8, 0, -69.4], [3.4, 0, -69.4], [9.0, 0, -69.2], [9.0, 0, -63]], new THREE.Color(1.6, 1.2, 0.4));
    gH.add(fpH.mesh); this.footprints.push(fpH);
    this.scannables.push({ id: 'traces', pos: new THREE.Vector3(-4.9, 0.3, -66), label: 'Traces de Tomás', clue: 'traces' });
    this.cp('H', 'H', [-4.95, 0.1, -63], Math.PI);
    this.objectivePos.m7 = new THREE.Vector3(9.85, 1.4, -63);

    // ================= I · Atelier de Tomás =================
    const I = this.room({ id: 'I', x0: 10, z0: -70, x1: 22, z1: -58, y: 0, h: 5, skip: ['w'], lightColor: 0xffe2c0, openings: [{ side: 'e', c: -64, w: 2.4, h: 2.8 }] });
    const BI = I.builder, gI = I.group;
    this.door('dHI', 'H', [9.85, 0, -63], false, 'closed');
    BI.add(gI, K.m.trim, rbox(4, 0.1, 1.4, 0.03), [16, 0.95, -69]); BI.add(gI, K.m.dark, rbox(3.8, 0.9, 1.2, 0.03), [16, 0.45, -69]);
    this.ph.add([14, 0, -69.7], [18, 1.0, -68.3]);
    Props.locker(K, BI, gI, this.ph, [21.5, 0, -62], -Math.PI / 2, 3);
    Props.crate(K, BI, gI, this.ph, [11.3, 0, -59.3], [1.0, 1.0, 1.0], 0.2, K.m.orange);
    for (let i = 0; i < 5; i++) BI.add(gI, K.m.steel, rbox(0.06, 0.4 + i * 0.06, 0.02, 0.01), [14.4 + i * 0.25, 2.1, -69.92]);
    BI.add(gI, K.sign('ATELIER', 'T. REYES — NE PAS TOUCHER'), new THREE.PlaneGeometry(2.2, 0.55), [16, 3.6, -69.98]);
    this.holoAt('tomas', 'I', [16, 0, -67.2], [{ id: 'reyes', x: 0, z: -0.6, yaw: 0 }], { robot: [0.6, 0.95, -1.7] });
    this.interact.push({ id: 'tomas', pos: new THREE.Vector3(16, 0.8, -67.2), r: 2.0, label: 'Projecteur de l\'atelier', verb: 'Lire l\'enregistrement', enabled: () => true, act: () => this.api.playHolo('tomas', this.holos.tomas, () => { if (!F.tomasSeen) { F.tomasSeen = true; this.api.saveNow(); } }) });
    // module jetpack sur l'établi
    const jetMod = new THREE.Group(); jetMod.position.set(17.4, 1.0, -69); jetMod.name = 'jetmod'; gI.add(jetMod);
    const jb = new Builder(); jb.add(jetMod, K.m.orange, rbox(0.34, 0.28, 0.14, 0.04), [0, 0.15, 0]); for (const x of [-0.09, 0.09]) jb.add(jetMod, K.m.steel, lathe([[0.022, 0], [0.026, -0.01], [0.04, -0.05], [0.0, -0.05]], 20), [x, 0.01, 0]); jb.build();
    this.interact.push({ id: 'jetpack', pos: new THREE.Vector3(17.4, 1.1, -68.8), r: 1.8, label: 'Module de propulsion', verb: 'Installer', enabled: () => !F.jetpack, act: () => { this.api.unlock('jetpack'); jetMod.visible = false; this.doors.dIK.setState('closed'); this.api.completeMission('m7', 'm8'); } });
    this.door('dIK', 'I', [22.15, 0, -64], false, 'locked');

    // ================= K · Compartiment de la brèche (mission 8) =================
    const Kr = this.room({ id: 'K', x0: 22.3, z0: -70, x1: 34, z1: -58, y: 0, h: 6, skip: ['w', 's'], holes: [{ x0: 25.5, z0: -65.2, x1: 29, z1: -62.3 }],
      openings: [{ side: 'n', c: 28, w: 4, h: 3.5, y: 0.8, frame: false }] });
    const BK = Kr.builder, gK = Kr.group;
    // bords déchirés de la brèche
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; BK.add(gK, K.m.dark, rbox(0.5 + (i % 3) * 0.3, 0.12, 0.4, 0.02), [28 + Math.cos(a) * 2.1, 2.55 + Math.sin(a) * 1.85, -70.2], [0, 0, a + 0.5]); }
    this.breach.bulkhead = new THREE.Mesh(rbox(4.6, 4.1, 0.25, 0.05), K.m.shutter);
    this.breach.bulkhead.position.set(28, 2.55 + 4.2, -69.8); gK.add(this.breach.bulkhead);
    // prises (poignées jaunes) où le robot s'accroche
    const grip = M.glow(0xffc040, 2.2);
    for (const [x, z] of [[24.2, -66.5], [25.0, -61.2], [30.0, -61.0], [32.5, -64.8]]) {
      BK.add(gK, K.m.dark, bcyl(0.2, 3.2, 0.03, 12), [x, 1.6, z]);
      BK.add(gK, grip, new THREE.TorusGeometry(0.28, 0.035, 8, 24), [x, 1.0, z], [Math.PI / 2, 0, 0]);
      this.ph.add([x - 0.2, 0, z - 0.2], [x + 0.2, 3.2, z + 0.2]);
      this.anchors.push(new THREE.Vector3(x, 0, z));
    }
    this.ph.trigger([25.5, -30, -65.2], [29, -2, -62.3], { onEnter: () => this.api.kill('Aspiré vers le vide') });
    this.ph.trigger([25.8, 0, -72], [30.2, 5, -69.35], { onEnter: () => { if (this.breach.active) this.api.kill('Aspiré dans l\'espace'); } });
    // levier de la cloison d'urgence
    BK.add(gK, K.m.trim, rbox(0.3, 1.4, 0.8, 0.04), [33.8, 0.7, -66.5]);
    BK.add(gK, K.m.hazard, new THREE.PlaneGeometry(0.76, 0.12), [33.64, 1.2, -66.5], [0, -Math.PI / 2, 0]);
    const lever = new THREE.Mesh(rbox(0.08, 0.6, 0.08, 0.02), K.m.orange as THREE.Material); lever.position.set(33.55, 1.2, -66.5); lever.rotation.z = 0.6; lever.name = 'lever'; gK.add(lever);
    this.interact.push({ id: 'bulkhead', pos: new THREE.Vector3(33.4, 1.0, -66.5), r: 1.6, label: 'Cloison d\'urgence', verb: 'Abaisser le levier', enabled: () => this.breach.active, act: () => { lever.rotation.z = -0.6; this.closeBreach(); } });
    this.beacon('K', new THREE.Vector3(22.7, 5.5, -58.5)); this.beacon('K', new THREE.Vector3(33.6, 5.5, -69.5));
    this.cp('K', 'K', [22.6, 0.1, -64], -Math.PI / 2);
    this.objectivePos.m8 = new THREE.Vector3(33.4, 1.4, -66.5);
    this.ph.trigger([22.3, 0, -70], [34, 6, -58], { onEnter: () => { if (this.breach.active) this.audio.loop('alarm', 'alarm', new THREE.Vector3(28, 4, -64), 0.4); }, onExit: () => this.audio.setLoop('alarm', 0) });

    // ================= L · Hangar (mission 9) =================
    const L = this.room({ id: 'L', x0: 22, z0: -57.7, x1: 50, z1: -36, y: 0, h: 10, floor: 'concrete', lightColor: 0xd4e6ff, stripEvery: 6,
      openings: [{ side: 'n', c: 31, w: 2.4, h: 2.8 }, { side: 'e', c: -47, w: 13, h: 8, frame: false }] });
    const BL = L.builder, gL = L.group;
    this.door('dKL', 'L', [31, 0, -57.85], true, 'locked');
    // portes du hangar (deux battants verticaux)
    for (const s of [1, -1]) {
      const d = new THREE.Mesh(rbox(0.4, 4.05, 13.2, 0.05), K.m.shutter);
      d.position.set(50.15, 2 + (s > 0 ? 4 : 0), -47); d.userData.y0 = d.position.y; d.userData.s = s;
      gL.add(d); this.hangarDoors.push(d);
    }
    this.hangarColl = this.ph.add([50, 0, -53.5], [50.3, 8, -40.5]);
    // navette sur son berceau
    BL.add(gL, K.m.dark, rbox(9, 0.3, 5, 0.06), [38, 0.15, -47]);
    BL.add(gL, K.m.hazard, new THREE.PlaneGeometry(9, 0.3), [38, 0.31, -44.4], [-Math.PI / 2, 0, 0]);
    this.shuttle.group.position.set(38, 0.3, -47); this.shuttle.group.rotation.y = Math.PI / 2;
    gL.add(this.shuttle.group);
    this.ph.add([33.6, 0, -48.6], [42.4, 3.2, -45.4]);
    // plateforme haute (3e vanne : jetpack nécessaire)
    BL.add(gL, K.m.floor, rbox(6, 0.25, 3, 0.04), [26, 3.1, -55.9]);
    BL.add(gL, K.m.orange, rbox(6, 0.06, 0.06, 0.02), [26, 4.1, -54.45]);
    for (const x of [23.2, 28.8]) BL.add(gL, K.m.dark, rbox(0.2, 3.0, 0.2, 0.03), [x, 1.5, -54.6]);
    this.ph.add([23, 2.95, -57.4], [29, 3.22, -54.4]);
    const vPos: [V3, number][] = [[[24, 0, -40], Math.PI], [[47.5, 0, -39], Math.PI], [[26, 3.22, -56.8], 0]];
    vPos.forEach(([p, ry], i) => {
      const v = new Valve(K, new THREE.Vector3(...p), ry);
      gL.add(v.group); this.valves.push(v);
      this.ph.add([p[0] - 0.3, p[1], p[2] - 0.3], [p[0] + 0.3, p[1] + 1.2, p[2] + 0.3], { camera: false });
      const front = new THREE.Vector3(0, 1.0, 0.7).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(new THREE.Vector3(...p));
      this.interact.push({ id: 'valve' + i, pos: front, r: 1.6, label: `Vanne de carburant ${i + 1} sur 3`, verb: 'Ouvrir', enabled: () => !v.open, act: () => this.openValve(i) });
      Props.cables(K, BL, gL, [[p[0], p[1] + 1.05, p[2]], [p[0] + (38 - p[0]) * 0.3, p[1] * 0.5 + 0.1, p[2] + (-47 - p[2]) * 0.3], [38, 0.35, -47]], 0.06);
    });
    // poste de contrôle (ouverture des portes) + enregistrement de la dispute
    const ctlScr = this.screen('L', (g, t) => { const n = this.valves.filter((v) => v.open).length; g.fillStyle = '#02070b'; g.fillRect(0, 0, 512, 256); g.font = '600 34px "Barlow Condensed", sans-serif'; g.fillStyle = n === 3 ? '#7dffb2' : '#ffb020'; g.fillText(`CARBURANT : ${n} / 3 VANNES`, 24, 64); g.fillStyle = this.hangarOpen > 0.5 ? '#7dffb2' : (Math.sin(t * 3) > 0 ? '#ff6a40' : '#5a2010'); g.fillText(this.hangarOpen > 0.5 ? 'PORTES : OUVERTES' : 'PORTES : FERMÉES', 24, 120); });
    Props.console(K, BL, gL, this.ph, [24.5, 0, -47], Math.PI / 2, ctlScr);
    this.interact.push({ id: 'hangarDoors', pos: new THREE.Vector3(25.2, 1.1, -47), r: 1.8, label: 'Commande des portes', verb: 'Ouvrir le hangar', enabled: () => this.valves.every((v) => v.open) && this.hangarOpen === 0 && !F.hangarOpen, act: () => this.openHangar() });
    this.interact.push({ id: 'dispute', pos: new THREE.Vector3(36.4, 1.4, -44.6), r: 1.8, label: 'Enregistreur de bord', verb: 'Écouter', enabled: () => true, act: () => this.api.playLog('dispute') });
    this.interact.push({ id: 'launch', pos: new THREE.Vector3(38, 1.2, -44.5), r: 1.6, label: 'Navette H-1', verb: 'Embarquer et décoller', enabled: () => !!F.hangarOpen, act: () => this.launch() });
    BL.add(gL, K.sign('HANGAR', 'NAVETTE H-1'), new THREE.PlaneGeometry(3.2, 0.8), [22.02, 6, -47], [0, Math.PI / 2, 0]);
    for (const x of [28, 36, 44]) for (const z of [-41, -52]) {
      BL.add(gL, K.m.dark, lathe([[0.0, 0.3], [0.2, 0.28], [0.55, 0.0], [0.5, -0.02], [0.0, 0.2]], 24), [x, 9.6, z]);
      BL.add(gL, K.strip('L'), new THREE.CircleGeometry(0.48, 24), [x, 9.595, z], [Math.PI / 2, 0, 0]);
      this.rooms.L.lights.push(this.pool.add(new THREE.Vector3(x, 9, z), 0xd8e8ff, 32, 12, 'L', 'neon', 0));
    }
    this.cp('L', 'L', [31, 0.1, -56.4], Math.PI);
    this.objectivePos.m9 = new THREE.Vector3(38, 2, -44.5);

    // triggers d'entrée de pièce
    for (const [id, r] of Object.entries(this.rooms)) {
      const s = r.spec;
      this.ph.trigger([s.x0, s.y - 3, s.z0], [s.x1, s.y + s.h, s.z1], { onEnter: () => { this.current = id; this.api.enterRoom(id); } });
    }
    // points de contrôle au début de chaque mission
    const cpTrig = (id: string, min: V3, max: V3) => this.ph.trigger(min, max, { onEnter: () => this.api.checkpoint(id) });
    cpTrig('C', [-9, 0, -28], [-6.3, 3, -24.6]);
    cpTrig('D', [6.3, 0, -28.3], [9, 3, -24.3]);
    cpTrig('E', [-2, 0, -35], [2, 3, -32.6]);
    cpTrig('F', [-9.5, 0, -42], [-7.3, 3, -39]);
    cpTrig('G', [-12, 0, -50], [-8.5, 3, -46.9]);
    cpTrig('H', [-5.7, 0, -64.5], [-4.4, 3, -61.5]);
    cpTrig('K', [22.3, 0, -65.5], [23.6, 3, -62.5]);
    cpTrig('L', [29, 0, -57.7], [33, 3, -54.5]);
    // missions déclenchées par l'entrée dans une zone
    this.ph.trigger([-9, 0, -28], [-6.3, 3, -24.6], { onEnter: () => { if (F.lamp && !this.powered) this.api.setObjective('m2'); } });
    this.ph.trigger([6.3, 0, -28.3], [9, 3, -24.3], { onEnter: () => { if (this.powered && !F.notebook) this.api.setObjective('m3'); } });
    this.ph.trigger([-24, 0, -70], [-6, 4, -60], { onEnter: () => { if (F.scan && !F.m6done) { F.m6done = true; this.api.completeMission('m6', 'm7'); } } });
    this.ph.trigger([10, 0, -70], [22, 4, -58], { onEnter: () => { if (!F.m7reached) { F.m7reached = true; this.api.toast('Atelier atteint', 'Le projecteur de Tomás est encore branché.'); } } });

    // fusion de toute la géométrie
    for (const r of Object.values(this.rooms)) r.builder.build();
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !m.castShadow) { const mat = m.material as THREE.Material; if (!mat.transparent && !(mat as THREE.MeshBasicMaterial).isMeshBasicMaterial && !(mat as THREE.ShaderMaterial).isShaderMaterial) m.castShadow = true; } });
    this.setRoomLight('L', 0.7);
  }
  private hangarColl!: ReturnType<Physics['add']>;

  // ---------- logique des missions ----------
  startNeonChain() {
    if (this.neonChain.running || this.powered || this.api.flags.lamp) return;
    this.neonChain = { t: 0, running: true };
    this.audio.beep('question');
  }

  plugSocket(i: number) {
    const s = this.sockets[i];
    s.done = true;
    s.plug.position.copy(s.plug.userData.target as THREE.Vector3);
    this.sparkBurst(s.plug.position.clone(), 30);
    this.audio.spark(s.plug.position.clone(), 1.2);
    this.audio.land(s.plug.position.clone(), 0.8);
    const n = this.sockets.filter((x) => x.done).length;
    this.api.toast(`Câble ${n} sur 3 rebranché`, n < 3 ? 'Encore ' + (3 - n) + ' à trouver.' : 'Circuit de secours fermé.');
    if (n === 3) { this.api.flags.power = true; this.restorePower(true); this.api.completeMission('m2', 'm3'); }
    this.api.saveNow();
  }

  setRoomLight(id: string, lvl: number) {
    const r = this.rooms[id]; if (!r) return;
    for (const l of r.lights) l.level = lvl;
    this.kit.strip(id).color.copy(new THREE.Color(r.spec.lightColor ?? 0xbfe6ff)).multiplyScalar(lvl * 3.2);
  }

  restorePower(animated: boolean) {
    if (this.powered) return;
    this.powered = true;
    for (const s of this.sockets) { s.done = true; s.plug.position.copy(s.plug.userData.target as THREE.Vector3); }
    this.doors.dJD.setState('closed'); this.doors.dJE.setState('closed');
    if (animated) { this.powerT = 0; this.audio.powerUp(); }
    else for (const id of this.poweredRooms()) this.setRoomLight(id, this.roomLevel(id));
  }
  private poweredRooms() { return ['C', 'J', 'B', 'A', 'D', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'R', 'E', 'F', 'G', 'H', 'I', 'K']; }
  private roomLevel(id: string) { return id.startsWith('D') || id === 'R' ? 0.85 : id === 'G' ? 0.45 : id === 'H' ? 0.3 : id === 'K' ? 0.5 : 1; }

  openShutter() {
    const F = this.api.flags;
    F.shutter = true;
    this.shutter.target = 1;
    this.audio.door(new THREE.Vector3(0, 3.5, -46), true);
    this.audio.discovery();
    this.doors.dEF.setState('closed');
    // 1) le volet se lève sur la planète ; 2) l'hologramme de la fête, reflété dans la vitre
    this.api.cinematic([
      { pos: [0, 1.6, -43.2], look: [0, 3.2, -47], to: [0, 2.2, -44.8], lookTo: [0, 3.6, -60], dur: 9, fov: 55 },
    ], () => {
      this.api.playHolo('fete', this.holos.fete, () => { if (!F.m4done) { F.m4done = true; this.api.completeMission('m4', 'm5'); } });
      this.api.cinematic([{ pos: [2.2, 1.5, -35.5], look: [0, 1.6, -41], to: [-1.2, 1.9, -37], lookTo: [0, 2.4, -47], dur: 16, fov: 48 }]);
    });
  }

  closeBreach() {
    this.breach.closing = true;
    this.audio.door(this.breach.center.clone(), false);
    this.api.toast('Cloison d\'urgence abaissée', 'La pression se stabilise.');
  }

  openValve(i: number) {
    const v = this.valves[i];
    v.open = true; v.spin = 1.2;
    this.audio.loop('valve' + i, 'steam', v.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0.3);
    setTimeout(() => this.audio.stopLoop('valve' + i), 1300);
    const n = this.valves.filter((x) => x.open).length;
    this.api.toast(`Vanne ${n} sur 3 ouverte`, n < 3 ? 'Le carburant circule partiellement.' : 'Réservoirs de la navette pleins. Ouvre les portes du hangar.');
    this.api.flags['valve' + i] = true;
    this.api.saveNow();
  }

  openHangar() {
    this.api.flags.hangarOpen = true;
    this.hangarTarget = 1;
    this.audio.door(new THREE.Vector3(49, 4, -47), true);
    this.api.toast('Portes du hangar ouvertes', 'La navette peut décoller.');
    this.api.saveNow();
  }
  private hangarTarget = 0;

  launch() {
    this.api.flags.launched = true;
    this.launchT = 0;
    this.audio.powerUp();
    this.api.cinematic([
      { pos: [30, 2.5, -40], look: [38, 1.8, -47], to: [33, 3, -39], lookTo: [44, 2, -47], dur: 4, fov: 50 },
      { pos: [75, 10, -25], look: [52, 3, -47], to: [90, 16, -20], lookTo: [70, 4, -47], dur: 6, fov: 45 },
      { pos: [130, 30, 30], look: [60, 2, -40], to: [170, 45, 60], lookTo: [10, 0, -30], dur: 7, fov: 40 },
    ], () => this.api.endOfZone());
  }
  launchT = -1;

  sparkBurst(p: THREE.Vector3, n: number) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3);
      this.sparks.emit(p, v, 0.6 + Math.random() * 0.8, 0.012 + Math.random() * 0.012, new THREE.Color(3, 1.8, 0.7));
    }
  }

  /** Restaure l'état du monde depuis la sauvegarde. */
  applyFlags() {
    const F = this.api.flags;
    if (F.doorA) { this.doors.dA.target = 0.42; this.doors.dA.open = 0.42; this.openCradle(true); }
    if (F.power) this.restorePower(false);
    if (F.shutter) { this.shutter.target = 1; this.shutter.open = 1; this.doors.dEF.setState('closed'); }
    if (F.scan) { const m = this.root.getObjectByName('scanmod'); if (m) m.visible = false; this.doors.dFG.setState('closed'); }
    if (F.jetpack) { const m = this.root.getObjectByName('jetmod'); if (m) m.visible = false; this.doors.dIK.setState('closed'); }
    if (F.breachClosed) { this.breach.active = false; this.breach.close = 1; this.doors.dKL.setState('closed'); const l = this.root.getObjectByName('lever'); if (l) l.rotation.z = -0.6; }
    this.valves.forEach((v, i) => { if (F['valve' + i]) v.open = true; });
    if (F.hangarOpen) { this.hangarTarget = 1; this.hangarOpen = 1; }
  }

  /** La vitre du poste de recharge s'ouvre (fin du prologue). */
  openCradle(instant = false) {
    this.glassColl.enabled = false;
    this.cradleOpen = instant ? 1 : 0.0001;
  }
  private cradleOpen = 0;

  /** Pièces affichées : la pièce courante, ses voisines et les voisines de celles-ci
   *  (un mur partagé est construit par une seule des deux pièces : il faut l'afficher). */
  visibleRooms() {
    const s = new Set<string>([this.current]);
    for (const n of this.adj[this.current] ?? []) { s.add(n); for (const m of this.adj[n] ?? []) if (!/^D\d/.test(m) || this.current.startsWith('D')) s.add(m); }
    return s;
  }

  update(dt: number, t: number, playerPos: THREE.Vector3, playerBox: (b: THREE.Box3) => boolean, gameplay = true) {
    const F = this.api.flags;
    const vis = this.visibleRooms();
    for (const [id, r] of Object.entries(this.rooms)) r.group.visible = vis.has(id) && !this.exterior.visible;

    // prologue : vitre du poste
    if (this.cradleOpen > 0 && this.cradleOpen < 1) this.cradleOpen = Math.min(1, this.cradleOpen + dt * 0.6);
    this.cradleGlass.position.y = 1.3 + this.cradleOpen * 2.6;
    this.eyeReflection.position.y = 1.085 + this.cradleOpen * 2.6;

    // mission 1 : les néons s'allument un à un le long de la coursive
    if (this.neonChain.running) {
      this.neonChain.t += dt;
      const lights = this.rooms.B.lights;
      lights.forEach((l, i) => {
        const at = 0.4 + i * 0.45;
        const k = this.neonChain.t - at;
        l.level = k < 0 ? 0 : k < 0.5 ? (Math.random() < 0.5 ? 0.4 : 0.05) : 0.35;
        if (k > 0 && k < dt + 0.001) this.audio.spark(l.pos, 0.3);
      });
      const n = Math.min(lights.length, Math.floor((this.neonChain.t - 0.4) / 0.45) + 1);
      this.kit.strip('B').color.setRGB(0.6, 0.85, 1).multiplyScalar(n > 0 ? 1.1 : 0);
      if (this.neonChain.t > 0.4 + lights.length * 0.45 + 1) this.neonChain.running = false;
    }

    // allumage de la station section par section
    if (this.powerT >= 0) {
      this.powerT += dt;
      const order = this.poweredRooms();
      order.forEach((id, i) => {
        const k = this.powerT - 0.5 - i * 0.35;
        if (k < 0) return;
        const flick = k < 1.2 ? (Math.random() < 0.5 - k * 0.3 ? 0.05 : 1) : 1;
        this.setRoomLight(id, Math.min(1, k * 1.5) * flick * this.roomLevel(id));
      });
      this.relayMat.color.setRGB(0.25, 0.85, 1.6).multiplyScalar(Math.min(1, this.powerT / 2) * 2.5);
      if (this.powerT > 0.5 + order.length * 0.35 + 2) this.powerT = -1;
    } else if (this.powered) {
      this.relayMat.color.setRGB(0.25, 0.85, 1.6).multiplyScalar(2.2 + Math.sin(t * 2) * 0.4);
      const bl = this.rooms.B.lights[3]; if (bl) bl.level = Math.random() < 0.05 ? 0.1 : 1;
    }
    for (const b of this.beacons) {
      const alarm = b.room === 'K' && this.breach.active;
      const on = (Math.sin(t * (alarm ? 7 : 4)) > 0 ? 1 : 0.15) * (this.powered && !alarm ? 0 : 1);
      b.mat.color.setRGB(3 * on + 0.1, 0.2 * on, 0.05); b.mesh.rotation.y = t * 4;
    }
    for (const e of this.emergency) if (e.kind === 'emergency' && e.room !== 'H') e.level = this.powered ? 0 : (0.55 + 0.45 * Math.sin(t * 4)) * 0.8;
    this.pool.sources.filter((s) => s.room === 'E' && s.kind === 'screen').forEach((s) => (s.level = this.shutter.open));

    // arcs électriques (mission 2)
    for (const a of this.arcs) {
      if (!vis.has(a.room)) { a.arc.hide(); continue; }
      const cyc = (t + a.phase) % 3.1;
      const charging = cyc > 1.4 && cyc < 1.75, on = cyc >= 1.75 && !this.powered;
      if (on && Math.random() < 0.75) a.arc.draw(); else a.arc.hide();
      a.light.level = on ? 0.5 + Math.random() * 0.8 : charging && !this.powered ? Math.random() * 0.25 : 0;
      if (charging && !this.powered && Math.random() < 0.3) this.sparkBurst(a.src, 2);
      if (gameplay && on && playerBox(a.box)) { this.audio.zap(playerPos); this.api.kill('Arc électrique'); }
    }
    if (vis.has('C') && !this.powered) { this.audio.loop('arc', 'arc', new THREE.Vector3(-12.3, 2, -26), 0); this.audio.setLoop('arc', 0.25, 0.05); }
    else this.audio.setLoop('arc', 0);

    // jets de vapeur (mission 6)
    for (const j of this.jets) {
      if (!vis.has(j.room)) continue;
      const prev = j.jet.state;
      j.jet.update(dt, t);
      if (j.jet.state === 'warn' && prev === 'idle') this.audio.spark(j.jet.pos, 0.15);
      if (j.jet.state === 'on') {
        if (prev !== 'on') { this.audio.loop('jet' + j.jet.pos.z, 'steam', j.jet.pos.clone().setY(1), 0.6); setTimeout(() => this.audio.stopLoop('jet' + j.jet.pos.z), 1300); }
        if (Math.random() < 0.8) this.steam.emit(j.jet.pos.clone().setY(0.2), new THREE.Vector3((Math.random() - 0.5) * 0.6, 3 + Math.random() * 2, (Math.random() - 0.5) * 0.6), 1.4, 0.18, new THREE.Color(0.85, 0.88, 0.9), 0.3);
        if (gameplay && playerBox(j.jet.box)) this.api.kill('Vapeur brûlante');
      }
    }

    // brèche (mission 8) : aspiration
    this.external.set(0, 0, 0);
    const br = this.breach;
    if (br.closing) {
      br.close = Math.min(1, br.close + dt * 0.8);
      if (br.close >= 1 && br.active) {
        br.active = false; br.closing = false;
        F.breachClosed = true;
        this.audio.stopLoop('alarm'); this.audio.stopLoop('wind');
        this.doors.dKL.setState('closed');
        this.api.completeMission('m8', 'm9');
      }
    }
    if (br.bulkhead) br.bulkhead.position.y = 2.55 + 4.2 * (1 - br.close);
    if (br.active && this.current === 'K' && gameplay) {
      const d = br.center.clone().sub(playerPos); d.y = 0;
      const dist = d.length();
      const anchored = this.anchors.some((a) => Math.hypot(a.x - playerPos.x, a.z - playerPos.z) < 1.0);
      const strength = (1 - br.close) * THREE.MathUtils.clamp(14 / (dist + 1.5), 1.5, 6);
      if (!anchored) this.external.copy(d.normalize().multiplyScalar(strength));
      this.audio.loop('wind', 'steam', br.center.clone(), 0); this.audio.setLoop('wind', 0.7 * (1 - br.close));
      // objets et papiers aspirés
      if (Math.random() < 0.6) {
        const p = new THREE.Vector3(23 + Math.random() * 10, 0.2 + Math.random() * 3, -59 - Math.random() * 9);
        const v = br.center.clone().sub(p).normalize().multiplyScalar(4 + Math.random() * 3);
        this.papers.emit(p, v, 3, 0.03 + Math.random() * 0.03, new THREE.Color(0.85, 0.85, 0.8), 1);
      }
    } else if (!br.active) this.audio.setLoop('wind', 0);
    this.papers.update(dt);

    // hangar
    this.hangarOpen += Math.sign(this.hangarTarget - this.hangarOpen) * Math.min(Math.abs(this.hangarTarget - this.hangarOpen), dt * 0.15);
    for (const d of this.hangarDoors) d.position.y = (d.userData.y0 as number) + (d.userData.s as number) * this.hangarOpen * 4.2;
    this.hangarColl.enabled = this.hangarOpen < 0.95;
    for (const v of this.valves) v.update(dt);
    if (this.launchT >= 0) {
      this.launchT += dt;
      const k = Math.max(0, this.launchT - 1.5);
      this.shuttle.group.position.set(38 + k * k * 1.6, 0.3 + Math.min(1, this.launchT / 1.5) * 1.5 + k * 0.4, -47);
      this.shuttle.engMat.color.setRGB(0.6, 1.4, 3).multiplyScalar(Math.min(1, this.launchT) * 3);
      this.exterior.visible = this.launchT > 4;
      if (this.exterior.visible && this.shuttle.group.parent !== this.root.parent) this.root.parent?.attach(this.shuttle.group);
    }

    // vapeur ambiante
    for (const v of this.steamVents) {
      if (!vis.has(v.room) || v.rate <= 0) continue;
      v.burst -= dt;
      if (v.burst < -3 - Math.random() * 3) v.burst = 1.2;
      v.acc += v.rate * (v.burst > 0 ? 3 : 1) * this.q.particles * dt;
      while (v.acc > 1) {
        v.acc -= 1;
        const d = v.dir.clone().multiplyScalar(0.9 + Math.random() * 0.8).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3));
        const lit = this.powered ? 0.75 : 0.45;
        this.steam.emit(v.pos, d, 2.4 + Math.random(), 0.14 + Math.random() * 0.12, new THREE.Color(lit, lit * 1.04, lit * 1.1), 0.18);
      }
    }
    this.sparks.setFloor(this.rooms[this.current]?.spec.y ?? 0);
    this.steam.update(dt); this.sparks.update(dt);
    for (const d of Object.values(this.doors)) d.update(dt, playerPos, (open) => this.audio.door(d.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), open));
    for (const s of this.screens) {
      if (!vis.has(s.room)) continue;
      s.draw((s.tex.image as HTMLCanvasElement).getContext('2d')!, t, this.powered);
      s.tex.needsUpdate = true;
      s.mat.color.setScalar(this.powered ? 1.6 : 0.7);
    }
    this.shutter.update(dt);
    for (const h of Object.values(this.holos)) h.update(dt, t);
    for (const f of this.footprints) f.update(dt);
    for (const c of this.cones) c.update(t);
    this.plantMat.color.setRGB(0.37, 1, 0.69).multiplyScalar(2 + Math.sin(t * 1.3) * 0.8);
    const jm = this.root.getObjectByName('jetmod'); if (jm) jm.rotation.y = t * 0.6;
    if (gameplay) this.ph.updateTriggers(playerPos.clone().add(new THREE.Vector3(0, 0.3, 0)), dt);
    this.pool.update(playerPos, dt, vis);
  }

  revealFootprints() { for (const f of this.footprints) f.reveal = 7; }
  readonly cpOrder = CP_ORDER;
  readonly zoneId = 1;
  readonly zoneName = 'Station Halcyon';
  mapBounds = { minX: -26, maxX: 52, minZ: -72, maxZ: 12 };
  /** Environnement physique au point donné (apesanteur, gravité imposée, parois magnétiques). */
  env(_p: THREE.Vector3) { return { zeroG: false, forcedUp: null, magnetic: false }; }
  titleCamera(t: number, cam: THREE.PerspectiveCamera) {
    const a = t * 0.05;
    cam.up.set(0, 1, 0);
    cam.position.set(Math.sin(a) * 2.2, 2.3 + Math.sin(a * 0.7) * 0.3, -41.5 + Math.cos(a * 0.6) * 0.6);
    cam.lookAt(Math.sin(a * 0.8) * 1.5, 3.4, -60);
  }

  // ---------- textures dessinées ----------
  private drawSignal(g: CanvasRenderingContext2D, t: number, p: boolean) {
    g.fillStyle = '#02070b'; g.fillRect(0, 0, 512, 256);
    if (!p) { g.fillStyle = Math.sin(t * 3) > 0 ? '#ff3a1a' : '#40100a'; g.font = '600 30px "Barlow Condensed", sans-serif'; g.fillText('ÉNERGIE AUXILIAIRE — 4 %', 24, 60); return; }
    g.strokeStyle = '#6fe0ff'; g.lineWidth = 2; g.beginPath();
    const ph = (t * 0.25) % 1;
    for (let x = 0; x < 512; x++) {
      const k = x / 512; const d = Math.abs(k - ph);
      const pulse = Math.exp(-Math.pow((k * 3 % 1) - 0.5, 2) * 120) * (d < 0.3 ? 1 : 0.25);
      const y = 140 - pulse * 80 + Math.sin(x * 0.7 + t * 9) * 3;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = '#bff3ff'; g.font = '600 26px "Barlow Condensed", sans-serif'; g.fillText('SIGNAL ENTRANT · PÉRIODE 04:00:00', 20, 30);
    g.fillStyle = '#7fb8cc'; g.font = '20px "Barlow Condensed", sans-serif'; g.fillText('SOURCE : SURFACE — LIAISON RELAIS COUPÉE (S. HADDAD)', 20, 248);
  }
  private drawingTexture() {
    const c = document.createElement('canvas'); c.width = 600; c.height = 420;
    const g = c.getContext('2d')!;
    g.fillStyle = '#efe9dc'; g.fillRect(0, 0, 600, 420);
    g.fillStyle = '#1b2a4a'; g.beginPath(); g.arc(300, 520, 360, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 90; i++) { g.fillStyle = ['#36e0a0', '#a070ff', '#5fffb0'][i % 3]; g.globalAlpha = 0.7; g.beginPath(); g.arc(80 + Math.random() * 440, 230 + Math.random() * 150, 4 + Math.random() * 8, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1; g.fillStyle = '#d0d4dc'; g.beginPath(); g.arc(120, 80, 22, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(470, 60, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a2a2a'; g.font = 'italic 600 34px "Barlow", sans-serif'; g.fillText('bientôt', 420, 400);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  private photoTexture() {
    const c = document.createElement('canvas'); c.width = 560; c.height = 390;
    const g = c.getContext('2d')!;
    const grd = g.createLinearGradient(0, 0, 0, 390); grd.addColorStop(0, '#0b1726'); grd.addColorStop(1, '#23344a');
    g.fillStyle = grd; g.fillRect(0, 0, 560, 390);
    g.fillStyle = 'rgba(80,140,190,0.55)'; g.beginPath(); g.arc(420, 90, 70, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 6; i++) {
      const x = 70 + i * 84, h = 170 + (i % 3) * 14;
      g.fillStyle = ['#c9b6a2', '#8a6a52', '#d8c0a8', '#b08a6a', '#e0cdb8', '#9a7a62'][i];
      g.beginPath(); g.arc(x, 390 - h, 26, 0, Math.PI * 2); g.fill();
      g.fillStyle = ['#e8e8e8', '#d0571c', '#e8e8e8', '#3a4a5a', '#e8e8e8', '#3a4a5a'][i];
      g.fillRect(x - 36, 390 - h + 30, 72, h);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
}
