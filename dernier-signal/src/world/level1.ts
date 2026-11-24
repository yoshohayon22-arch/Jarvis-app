import * as THREE from 'three';
import { Builder, rbox, bcyl, lathe, vent, cable, type V3 } from '../robots/parts';
import * as M from '../robots/materials';
import { Kit, buildRoom, Door, Props, type Room, type RoomSpec } from './kit';
import { Physics } from './physics';
import { LightPool, type LightSource } from './lights';
import { Particles } from '../fx/particles';
import { holoMaterial, HoloPerson, projectorBase } from '../fx/hologram';
import { LightCone } from '../fx/volumetric';
import type { AudioEngine } from '../audio/audio';
import type { Quality } from '../core/quality';
import { OBJECTIVES } from '../story/zone1';

// Zone 1 · Station Halcyon — tranche verticale (les 10 premières minutes).
//
//   F  Baie d'observation (y = 3,2)
//   |
//   E  Hangar (passerelle à 3,2 m : jetpack requis)
//   |
//   D  Quartiers  ——  C  Salle des relais (énigme d'énergie, hologramme)
//                     |
//                     B  Coursive (arcs électriques)
//                     |
//                     A  Baie de maintenance (réveil)

export type ObjectiveKey = keyof typeof OBJECTIVES;

export interface GameApi {
  playLog(id: string): void;
  playHolo(id: string, holo: Hologram): void;
  openPuzzle(): void;
  gainJetpack(): void;
  setObjective(k: ObjectiveKey): void;
  checkpoint(id: string): void;
  kill(reason: string): void;
  toast(msg: string, sub?: string): void;
  enterRoom(id: string): void;
  clue(id: string): void;
  endOfSlice(): void;
  flags: Record<string, boolean>;
}

export interface Interactable { id: string; pos: THREE.Vector3; r: number; label: string; verb: string; enabled: () => boolean; act: () => void; }
export interface Scannable { id: string; pos: THREE.Vector3; label: string; clue?: string; }
export interface Checkpoint { id: string; pos: THREE.Vector3; yaw: number; }

export class Hologram {
  group = new THREE.Group();
  people: Record<string, HoloPerson> = {};
  mat = holoMaterial();
  base: ReturnType<typeof projectorBase>;
  level = 0; target = 0;
  constructor(kit: Kit, pos: V3, crew: { id: string; female: boolean; x: number; z: number; yaw: number; h: number }[]) {
    this.base = projectorBase(kit.m.dark);
    this.group.add(this.base.group);
    for (const c of crew) {
      const p = new HoloPerson(this.mat, { female: c.female, height: c.h });
      p.position.set(c.x, 0.12, c.z); p.baseYaw = c.yaw; p.rotation.y = c.yaw;
      this.people[c.id] = p; this.group.add(p);
    }
    this.group.position.set(...pos);
  }
  update(dt: number, t: number) {
    this.level += (this.target - this.level) * Math.min(1, dt * 2.5);
    const flick = this.level > 0.02 ? (Math.random() < 0.03 ? 0.4 : 1) : 0;
    this.mat.uniforms.uAlpha.value = this.level * flick;
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uGlitch.value = this.level < 0.9 ? 1 - this.level : (Math.random() < 0.01 ? 1 : 0);
    this.base.beamMat.uniforms.uPower.value = this.level;
    for (const p of Object.values(this.people)) { p.visible = this.level > 0.01; p.update(dt, t); }
  }
}

class Arc {
  segs: THREE.Mesh[] = [];
  on = false;
  t = 0;
  constructor(public from: THREE.Vector3, public to: THREE.Vector3, group: THREE.Group, mat: THREE.Material, public period = [1.3, 1.7]) {
    const g = new THREE.CylinderGeometry(0.012, 0.012, 1, 5, 1, true);
    g.translate(0, 0.5, 0);
    for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(g, mat); m.visible = false; group.add(m); this.segs.push(m); }
  }
  /** Redessine un éclair zigzaguant (trois branches). */
  draw() {
    let si = 0;
    for (let b = 0; b < 3; b++) {
      const n = 6;
      let prev = this.from.clone();
      const end = this.to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0, (Math.random() - 0.5) * 0.5));
      for (let i = 1; i <= n; i++) {
        const k = i / n;
        const p = this.from.clone().lerp(end, k);
        if (i < n) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.35));
        const m = this.segs[si++];
        const d = p.clone().sub(prev);
        m.position.copy(prev);
        m.scale.set(b === 0 ? 1.4 : 0.8, d.length(), b === 0 ? 1.4 : 0.8);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
        m.visible = true;
        prev = p;
      }
    }
  }
  hide() { for (const s of this.segs) s.visible = false; }
}

export class Level {
  kit: Kit;
  ph = new Physics();
  pool: LightPool;
  root = new THREE.Group();
  rooms: Record<string, Room> = {};
  adj: Record<string, string[]> = { A: ['B'], B: ['A', 'C'], C: ['B', 'D'], D: ['C', 'E'], E: ['D', 'F'], F: ['E'] };
  doors: Record<string, Door> = {};
  interact: Interactable[] = [];
  scannables: Scannable[] = [];
  checkpoints: Record<string, Checkpoint> = {};
  objectivePos: Partial<Record<ObjectiveKey, THREE.Vector3>> = {};
  current = 'A';
  powered = false;
  holo!: Hologram;
  private api: GameApi;
  private audio: AudioEngine;
  private steam: Particles; private sparks: Particles;
  private steamVents: { pos: THREE.Vector3; dir: THREE.Vector3; room: string; rate: number; acc: number; burst: number }[] = [];
  private arcs: Arc[] = [];
  private arcLights: LightSource[] = [];
  private arcHazard!: { box: THREE.Box3; active: boolean };
  private emergency: LightSource[] = [];
  private screens: { tex: THREE.CanvasTexture; draw: (g: CanvasRenderingContext2D, t: number, p: boolean) => void; room: string; mat: THREE.MeshBasicMaterial }[] = [];
  private relayMat!: THREE.MeshBasicMaterial;
  private jetGlow!: THREE.MeshBasicMaterial;
  private jetModule!: THREE.Group;
  private beacons: { mesh: THREE.Object3D; mat: THREE.MeshBasicMaterial }[] = [];
  private cones: LightCone[] = [];
  private powerT = -1;
  private q: Quality;
  private arcCycle = 0;

  constructor(scene: THREE.Scene, q: Quality, api: GameApi, audio: AudioEngine) {
    this.q = q;
    this.api = api; this.audio = audio;
    this.kit = new Kit(q.textureRes);
    this.pool = new LightPool(scene, (q.id === 'equilibre' || q.id === 'econome') ? 4 : 6);
    scene.add(this.root);
    this.steam = new Particles({ max: Math.round(500 * q.particles + 100), additive: false, gravity: -0.25, drag: 1.2, soft: true, grow: 3.5 });
    this.sparks = new Particles({ max: 400, additive: true, gravity: 9.8, drag: 0.4, bounceY: 0, bounce: 0.35, soft: false });
    scene.add(this.steam, this.sparks);
    this.build();
  }

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
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: true });
    this.screens.push({ tex, draw, room, mat });
    return mat;
  }

  private build() {
    const K = this.kit;
    // ============ A · Baie de maintenance ============
    const A = this.room({ id: 'A', x0: -5, z0: 0.3, x1: 5, z1: 10.3, y: 0, h: 4.5, openings: [{ side: 'n', c: 0, w: 2.4, h: 2.8, door: 'dA' }], lightColor: 0xcfe8ff });
    const BA = A.builder, gA = A.group;
    // berceau de recharge de R-12
    BA.add(gA, K.m.dark, rbox(1.6, 0.16, 1.4, 0.04), [0, 0.08, 8.6]);
    BA.add(gA, K.m.orange, rbox(1.66, 0.04, 1.46, 0.02), [0, 0.17, 8.6]);
    BA.add(gA, K.m.trim, rbox(1.4, 2.6, 0.3, 0.05), [0, 1.3, 9.6]);
    BA.add(gA, K.m.dark, rbox(1.1, 1.9, 0.06, 0.02), [0, 1.35, 9.43]);
    for (const x of [-0.75, 0.75]) BA.add(gA, K.m.steel, bcyl(0.06, 2.7, 0.01, 14), [x, 1.35, 9.4]);
    BA.add(gA, K.m.dark, rbox(0.5, 0.2, 0.5, 0.04), [0, 2.5, 9.15]);
    Props.cables(K, BA, gA, [[0.3, 2.4, 9.2], [0.25, 1.6, 9.0], [0.15, 1.0, 8.9]], 0.025);
    Props.cables(K, BA, gA, [[-0.3, 2.4, 9.2], [-0.4, 1.4, 9.1], [-0.2, 0.9, 8.85]], 0.02);
    const cradleSign = K.sign('R-12', 'POSTE DE RECHARGE');
    BA.add(gA, cradleSign, new THREE.PlaneGeometry(0.9, 0.22), [0, 2.35, 9.44]);
    this.ph.add([-0.7, 0, 9.4], [0.7, 2.6, 9.8]);
    // établi + journal + tasse
    BA.add(gA, K.m.trim, rbox(3.6, 0.08, 1.0, 0.02), [-4.0, 0.95, 5.0], [0, Math.PI / 2, 0]);
    BA.add(gA, K.m.dark, rbox(3.4, 0.9, 0.9, 0.03), [-4.05, 0.45, 5.0], [0, Math.PI / 2, 0]);
    for (let i = 0; i < 3; i++) BA.add(gA, K.m.dark, vent(0.7, 0.25, 3, 0.01), [-3.59, 0.6, 3.9 + i * 1.1], [0, Math.PI / 2, 0]);
    BA.add(gA, K.m.trim, rbox(3.6, 0.05, 0.45, 0.01), [-4.6, 2.0, 5.0], [0, Math.PI / 2, 0]);
    this.ph.add([-5, 0, 3.2], [-3.5, 0.99, 6.8], { camera: false });
    // pièces détachées : une tête de robot démontée (inquiétant)
    BA.add(gA, K.m.white, rbox(0.42, 0.26, 0.28, 0.06), [-4.1, 1.12, 3.9], [0, 0.6, 0]);
    BA.add(gA, K.m.black, rbox(0.34, 0.19, 0.03, 0.04), [-3.98, 1.12, 4.0], [0, 0.6 + Math.PI / 2, 0]);
    BA.add(gA, K.m.dark, bcyl(0.05, 0.5, 0.01, 12), [-4.3, 1.0, 5.6], [0, 0, Math.PI / 2]);
    BA.add(gA, K.m.steel, rbox(0.25, 0.05, 0.08, 0.01), [-4.0, 1.0, 6.1], [0, 0.3, 0]);
    // tasse « MIRA »
    BA.add(gA, K.m.white, lathe([[0, 0], [0.045, 0], [0.048, 0.1], [0.044, 0.1], [0.041, 0.006], [0, 0.006]], 20), [-3.85, 0.99, 6.4]);
    BA.add(gA, K.m.white, new THREE.TorusGeometry(0.028, 0.008, 6, 12), [-3.81, 1.04, 6.45], [0, 0.8, 0]);
    this.scannables.push({ id: 'mug', pos: new THREE.Vector3(-3.85, 1.05, 6.4), label: 'Tasse « MIRA »', clue: 'mug' });
    // enregistreur (journal 01)
    const recGlow = M.glow(0x40ff9a, 3);
    BA.add(gA, K.m.dark, rbox(0.22, 0.05, 0.14, 0.015), [-3.9, 1.02, 5.2]);
    BA.add(gA, recGlow, rbox(0.03, 0.012, 0.03, 0.005, 1), [-3.82, 1.05, 5.25]);
    this.interact.push({ id: 'log01', pos: new THREE.Vector3(-3.9, 1.05, 5.2), r: 1.6, label: 'Enregistreur', verb: 'Écouter', enabled: () => true, act: () => this.api.playLog('log01') });
    // étagères, caisses, fûts
    Props.locker(K, BA, gA, this.ph, [4.4, 0, 6.5], -Math.PI / 2, 3);
    Props.crate(K, BA, gA, this.ph, [3.6, 0, 2.2], [1.0, 0.8, 1.0], 0.2);
    Props.crate(K, BA, gA, this.ph, [3.7, 0.8, 2.3], [0.7, 0.6, 0.7], -0.1, K.m.orange);
    Props.barrel(K, BA, gA, this.ph, [-4.2, 0, 1.3]);
    Props.barrel(K, BA, gA, this.ph, [-3.5, 0, 1.0], K.m.trim);
    Props.pipeV(K, BA, gA, [4.6, 0, 0.8], 4.5, 0.12);
    BA.add(gA, K.sign('BAIE DE MAINTENANCE', 'MODULE M-2 · HALCYON'), new THREE.PlaneGeometry(2.4, 0.6), [0, 3.55, 0.31]);
    // gyrophares de secours
    for (const [x, z] of [[-4.6, 9.8], [4.6, 0.8]]) this.beacon(gA, BA, 'A', new THREE.Vector3(x, 3.6, z));
    this.steamVents.push({ pos: new THREE.Vector3(4.6, 2.2, 0.8), dir: new THREE.Vector3(-1, 0.2, 0.3), room: 'A', rate: 14, acc: 0, burst: 0 });
    const dA = this.door('dA', 'A', [0, 0, 0.15], true, 'jammed');
    dA.auto = false;
    this.interact.push({
      id: 'forceA', pos: new THREE.Vector3(0, 1.2, 0.5), r: 1.8, label: 'Porte bloquée', verb: 'Forcer l\'ouverture',
      enabled: () => !this.api.flags.doorA,
      act: () => {
        this.api.flags.doorA = true; dA.target = 0.42;
        this.sparkBurst(new THREE.Vector3(0.2, 2.4, 0.4), 40);
        this.audio.spark(new THREE.Vector3(0, 2.4, 0.4));
        this.api.setObjective('power'); this.api.checkpoint('B');
      },
    });
    this.checkpoints.A = { id: 'A', pos: new THREE.Vector3(0, 0.2, 7.6), yaw: Math.PI };
    this.objectivePos.wake = new THREE.Vector3(0, 1.4, 0.2);

    // ============ B · Coursive ============
    const Bm = this.room({ id: 'B', x0: -1.5, z0: -16, x1: 1.5, z1: 0, y: 0, h: 3.2, openings: [], skip: ['n', 's'], stripEvery: 3.5 });
    const BB = Bm.builder, gB = Bm.group;
    // panneau de plafond tombé + câbles
    BB.add(gB, K.m.ceiling, rbox(1.2, 0.06, 2.4, 0.01), [0.7, 0.18, -10.6], [0.15, 0.3, 0.12]);
    this.ph.add([0.1, 0, -11.8], [1.4, 0.24, -9.4], { camera: false });
    Props.cables(K, BB, gB, [[-0.6, 3.15, -7.2], [-0.4, 2.6, -7.6], [-0.25, 2.2, -8.0]], 0.035);
    Props.cables(K, BB, gB, [[0.5, 3.15, -8.8], [0.3, 2.7, -8.3], [0.15, 2.25, -8.05]], 0.03);
    BB.add(gB, K.m.dark, rbox(1.4, 0.1, 1.4, 0.02), [0, 3.12, -8.0]);
    const arcMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 6, 12) });
    for (const end of [new THREE.Vector3(-1.4, 0.4, -8.0), new THREE.Vector3(1.4, 0.6, -8.0)]) {
      const arc = new Arc(new THREE.Vector3(0, 2.2, -8.0), end, gB, arcMat);
      this.arcs.push(arc);
      this.arcLights.push(this.pool.add(new THREE.Vector3(0, 1.4, -8), 0x8fc8ff, 6, 4, 'B', 'spark', 0));
    }
    this.arcHazard = { box: new THREE.Box3(new THREE.Vector3(-1.5, 0, -8.6), new THREE.Vector3(1.5, 3, -7.4)), active: false };
    BB.add(gB, K.m.hazard, new THREE.PlaneGeometry(2.8, 0.25), [0, 0.012, -6.9], [-Math.PI / 2, 0, 0]);
    BB.add(gB, K.m.hazard, new THREE.PlaneGeometry(2.8, 0.25), [0, 0.012, -9.1], [-Math.PI / 2, 0, 0]);
    BB.add(gB, K.sign('DANGER — HAUTE TENSION', '', 1024, 160, '#ffcf4a'), new THREE.PlaneGeometry(1.6, 0.25), [-1.33, 2.4, -6.2], [0, Math.PI / 2, 0]);
    BB.add(gB, K.sign('COURSIVE B', 'MAINTENANCE ⟷ RELAIS'), new THREE.PlaneGeometry(1.8, 0.45), [1.33, 2.4, -2.5], [0, -Math.PI / 2, 0]);
    this.steamVents.push({ pos: new THREE.Vector3(-1.35, 0.6, -4.2), dir: new THREE.Vector3(1, 0.4, 0), room: 'B', rate: 22, acc: 0, burst: 0 });
    this.steamVents.push({ pos: new THREE.Vector3(1.35, 2.7, -12.5), dir: new THREE.Vector3(-0.6, -0.4, 0.2), room: 'B', rate: 18, acc: 0, burst: 0 });
    BB.add(gB, K.m.dark, vent(0.5, 0.4, 5, 0.02), [-1.34, 0.6, -4.2], [0, Math.PI / 2, 0]);
    BB.add(gB, K.m.dark, vent(0.5, 0.4, 5, 0.02), [1.34, 2.7, -12.5], [0, -Math.PI / 2, 0]);
    this.beacon(gB, BB, 'B', new THREE.Vector3(1.3, 2.9, -14.5));
    this.beacon(gB, BB, 'B', new THREE.Vector3(-1.3, 2.9, -1.5));
    this.checkpoints.B = { id: 'B', pos: new THREE.Vector3(0, 0.1, -1.2), yaw: Math.PI };

    // ============ C · Salle des relais ============
    const C = this.room({ id: 'C', x0: -6, z0: -28.3, x1: 6, z1: -16.3, y: 0, h: 5, openings: [{ side: 's', c: 0, w: 2.4, h: 2.8 }, { side: 'e', c: -23.3, w: 2.4, h: 2.8 }], lightColor: 0xcde9ff });
    const BC = C.builder, gC = C.group;
    // colonne de relais centrale
    this.relayMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    BC.add(gC, K.m.dark, bcyl(1.0, 0.4, 0.04, 40), [0, 0.2, -22.5]);
    BC.add(gC, K.m.trim, bcyl(0.65, 4.6, 0.04, 40), [0, 2.6, -22.5]);
    for (let i = 0; i < 6; i++) BC.add(gC, this.relayMat, new THREE.TorusGeometry(0.67, 0.03, 8, 48), [0, 0.8 + i * 0.65, -22.5], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; BC.add(gC, K.m.dark, rbox(0.12, 4.4, 0.18, 0.02), [Math.sin(a) * 0.7, 2.6, -22.5 + Math.cos(a) * 0.7], [0, a, 0]); }
    this.ph.add([-0.8, 0, -23.3], [0.8, 5, -21.7]);
    // consoles nord + écrans
    const scrA = this.screen('C', (g, t, p) => this.drawSignalScreen(g, t, p));
    const scrB = this.screen('C', (g, t, p) => this.drawStatusScreen(g, t, p));
    Props.console(K, BC, gC, this.ph, [-3, 0, -27.4], 0, scrA);
    Props.console(K, BC, gC, this.ph, [3, 0, -27.4], 0, scrB);
    // tableau blanc (indice)
    const boardTex = this.boardTexture();
    BC.add(gC, K.m.trim, rbox(2.0, 1.2, 0.05, 0.02), [5.85, 2.2, -19.5], [0, -Math.PI / 2, 0]);
    BC.add(gC, new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.35 }), new THREE.PlaneGeometry(1.9, 1.1), [5.82, 2.2, -19.5], [0, -Math.PI / 2, 0]);
    this.scannables.push({ id: 'board', pos: new THREE.Vector3(5.8, 2.2, -19.5), label: 'Tableau blanc', clue: 'board' });
    // panneau de distribution (énigme)
    const panelScr = this.screen('C', (g, t, p) => this.drawPanelScreen(g, t, p));
    BC.add(gC, K.m.trim, rbox(0.3, 2.2, 1.8, 0.04), [-5.85, 1.3, -22.0]);
    BC.add(gC, K.m.dark, rbox(0.06, 1.0, 1.4, 0.02), [-5.68, 1.55, -22.0]);
    BC.add(gC, panelScr, new THREE.PlaneGeometry(1.3, 0.9), [-5.645, 1.55, -22.0], [0, Math.PI / 2, 0]);
    BC.add(gC, K.m.hazard, new THREE.PlaneGeometry(1.7, 0.12), [-5.69, 0.3, -22.0], [0, Math.PI / 2, 0]);
    for (let i = 0; i < 5; i++) Props.cables(K, BC, gC, [[-5.9, 2.4, -21.4 + i * 0.1 - 0.4], [-5.9, 3.6, -21.2 + i * 0.2 - 0.5], [-5.9, 4.9, -20 + i * 0.3]], 0.025);
    this.ph.add([-6, 0, -22.9], [-5.7, 2.4, -21.1]);
    this.interact.push({ id: 'panel', pos: new THREE.Vector3(-5.4, 1.3, -22.0), r: 1.9, label: 'Panneau de distribution', verb: 'Router l\'énergie', enabled: () => !this.powered, act: () => this.api.openPuzzle() });
    this.objectivePos.power = new THREE.Vector3(-5.5, 1.6, -22);
    this.objectivePos.route = new THREE.Vector3(-5.5, 1.6, -22);
    // projecteur d'hologramme
    this.holo = new Hologram(K, [2.6, 0, -19.6], [
      { id: 'okafor', female: false, x: -0.35, z: 0.1, yaw: 0.9, h: 1.82 },
      { id: 'varga', female: true, x: 0.45, z: -0.15, yaw: -1.9, h: 1.7 },
    ]);
    gC.add(this.holo.group);
    this.ph.add([2.0, 0, -20.2], [3.2, 0.12, -19.0], { camera: false });
    this.interact.push({ id: 'holo01', pos: new THREE.Vector3(2.6, 0.8, -19.6), r: 2.0, label: 'Projecteur holographique', verb: 'Lire l\'enregistrement', enabled: () => this.powered, act: () => this.api.playHolo('holo01', this.holo) });
    // divers
    Props.crate(K, BC, gC, this.ph, [-4.8, 0, -17.4], [1.0, 1.0, 1.0], 0.1);
    Props.barrel(K, BC, gC, this.ph, [4.9, 0, -17.2], K.m.trim);
    Props.pipeV(K, BC, gC, [-5.6, 0, -27.8], 5, 0.14);
    Props.pipeV(K, BC, gC, [5.6, 0, -27.8], 5, 0.14);
    BC.add(gC, K.sign('SALLE DES RELAIS', 'DISTRIBUTION ÉNERGÉTIQUE'), new THREE.PlaneGeometry(2.6, 0.65), [0, 4.1, -28.29]);
    this.beacon(gC, BC, 'C', new THREE.Vector3(-5.7, 4.4, -16.8));
    this.beacon(gC, BC, 'C', new THREE.Vector3(5.7, 4.4, -27.8));
    this.door('dCD', 'C', [6.15, 0, -23.3], false, 'locked');
    this.checkpoints.C = { id: 'C', pos: new THREE.Vector3(0, 0.1, -17.5), yaw: Math.PI };
    this.objectivePos.quarters = new THREE.Vector3(6.15, 1.4, -23.3);

    // ============ D · Quartiers ============
    const D = this.room({ id: 'D', x0: 6.3, z0: -28.3, x1: 16.3, z1: -18.3, y: 0, h: 3.4, openings: [{ side: 'n', c: 11.3, w: 2.4, h: 2.8 }], skip: ['w'], lightColor: 0xffd7aa, wall: 'white' });
    const BD = D.builder, gD = D.group;
    Props.bunk(K, BD, gD, this.ph, [15.2, 0, -21.0], Math.PI / 2);
    Props.bunk(K, BD, gD, this.ph, [15.2, 0, -24.0], Math.PI / 2);
    Props.bunk(K, BD, gD, this.ph, [15.2, 0, -27.0], Math.PI / 2);
    Props.locker(K, BD, gD, this.ph, [8.6, 0, -18.75], Math.PI, 4);
    Props.table(K, BD, gD, this.ph, [10.5, 0, -23.5], 1.6, 0.9);
    // chaises
    for (const [x, z] of [[9.5, -23.5], [11.5, -23.0]]) { BD.add(gD, K.m.dark, rbox(0.45, 0.06, 0.45, 0.02), [x, 0.46, z]); BD.add(gD, K.m.dark, rbox(0.06, 0.45, 0.06, 0.01), [x, 0.23, z]); BD.add(gD, K.m.dark, rbox(0.45, 0.5, 0.05, 0.02), [x, 0.75, z + 0.22]); }
    // somnifères (indice)
    BD.add(gD, K.m.white, rbox(0.12, 0.05, 0.08, 0.01), [10.3, 0.835, -23.6], [0, 0.4, 0]);
    BD.add(gD, K.m.orange, rbox(0.121, 0.015, 0.081, 0.005), [10.3, 0.85, -23.6], [0, 0.4, 0]);
    this.scannables.push({ id: 'pills', pos: new THREE.Vector3(10.3, 0.85, -23.6), label: 'Somnifères', clue: 'pills' });
    // tablette (journal 02) sur la couchette
    const tabScr = this.screen('D', (g) => this.drawTablet(g));
    BD.add(gD, K.m.dark, rbox(0.3, 0.02, 0.22, 0.01), [14.9, 0.6, -24.3], [0, 0.5, 0]);
    BD.add(gD, tabScr, new THREE.PlaneGeometry(0.26, 0.18), [14.9, 0.612, -24.3], [-Math.PI / 2, 0, 0.5]);
    this.interact.push({ id: 'log02', pos: new THREE.Vector3(14.9, 0.7, -24.3), r: 1.7, label: 'Tablette personnelle', verb: 'Lire', enabled: () => true, act: () => this.api.playLog('log02') });
    // photo d'équipage (indice)
    const photo = this.photoTexture();
    BD.add(gD, K.m.dark, rbox(0.62, 0.45, 0.03, 0.01), [12.5, 1.7, -18.32]);
    BD.add(gD, new THREE.MeshStandardMaterial({ map: photo, roughness: 0.4 }), new THREE.PlaneGeometry(0.56, 0.39), [12.5, 1.7, -18.3]);
    this.scannables.push({ id: 'photo', pos: new THREE.Vector3(12.5, 1.7, -18.35), label: 'Photo d\'équipage', clue: 'photo' });
    BD.add(gD, K.sign('QUARTIERS', 'ÉQUIPAGE · 6 COUCHETTES'), new THREE.PlaneGeometry(1.8, 0.45), [8.4, 2.7, -28.29]);
    // porte du hangar forcée + pied-de-biche
    const dDE = this.door('dDE', 'D', [11.3, 0, -28.45], true, 'jammed');
    dDE.auto = false; dDE.open = 0.4; dDE.target = 0.4;
    BD.add(gD, K.m.orange, cable([[10.3, 0.03, -27.2], [10.7, 0.04, -26.9], [11.2, 0.05, -26.6]], 0.018, 8));
    this.scannables.push({ id: 'crowbar', pos: new THREE.Vector3(10.7, 0.1, -26.9), label: 'Pied-de-biche', clue: 'crowbar' });
    this.objectivePos.hangar = new THREE.Vector3(11.3, 1.4, -28.45);
    this.emergency.push(this.pool.add(new THREE.Vector3(12, 2.6, -23), 0xffb070, 1.2, 4, 'D', 'neon', 0.35));

    // ============ E · Hangar ============
    const hole = { x0: 15.2, z0: -37, x1: 18.4, z1: -33.8 };
    const E = this.room({ id: 'E', x0: 4.3, z0: -46.3, x1: 20.3, z1: -28.6, y: 0, h: 9, openings: [{ side: 'n', c: 12.3, w: 2.4, h: 2.8, y: 3.2 }], skip: ['s'], holes: [hole], floor: 'concrete', lightColor: 0xd4e6ff, stripEvery: 5 });
    const BE = E.builder, gE = E.group;
    // passerelle (mezzanine)
    this.ph.add([4.3, 2.95, -46.3], [20.3, 3.2, -41.3]);
    BE.add(gE, K.m.floor, new THREE.BoxGeometry(16, 0.25, 5), [12.3, 3.075, -43.8]);
    BE.add(gE, K.m.grate, new THREE.BoxGeometry(15.6, 0.02, 1.0), [12.3, 3.21, -42.4]);
    BE.add(gE, K.m.dark, rbox(16, 0.35, 0.25, 0.03), [12.3, 2.85, -41.4]);
    for (let x = 5; x <= 20; x += 3) { BE.add(gE, K.m.dark, rbox(0.25, 2.95, 0.25, 0.03), [x, 1.47, -41.5]); this.ph.add([x - 0.13, 0, -41.63], [x + 0.13, 2.95, -41.37]); }
    // garde-corps (avec une ouverture au-dessus des caisses)
    const railGap = [11.0, 13.4];
    for (const [a, b] of [[4.3, railGap[0]], [railGap[1], 20.3]]) {
      BE.add(gE, K.m.orange, rbox(b - a, 0.06, 0.06, 0.02), [(a + b) / 2, 4.2, -41.35]);
      BE.add(gE, K.m.orange, rbox(b - a, 0.05, 0.05, 0.02), [(a + b) / 2, 3.7, -41.35]);
      for (let x = a + 0.1; x < b; x += 1.2) BE.add(gE, K.m.orange, rbox(0.06, 1.0, 0.06, 0.02), [x, 3.7, -41.35]);
      this.ph.add([a, 3.2, -41.45], [b, 4.25, -41.25], { camera: false });
    }
    // caisses pour grimper
    Props.crate(K, BE, gE, this.ph, [12.2, 0, -39.6], [1.6, 0.9, 1.6], 0, K.m.white);
    Props.crate(K, BE, gE, this.ph, [12.3, 0.9, -40.2], [1.4, 0.9, 1.2], 0.05, K.m.orange);
    // conteneurs
    const cont = (x: number, z: number, ry: number, mat: THREE.Material, y = 0) => {
      BE.add(gE, mat, rbox(6, 2.6, 2.4, 0.05), [x, y + 1.3, z], [0, ry, 0]);
      BE.add(gE, K.m.dark, rbox(6.05, 0.12, 2.45, 0.03), [x, y + 0.06, z], [0, ry, 0]);
      const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
      const hx = (6 * c + 2.4 * s) / 2, hz = (6 * s + 2.4 * c) / 2;
      this.ph.add([x - hx, y, z - hz], [x + hx, y + 2.6, z + hz]);
    };
    cont(7.2, -38.5, Math.PI / 2, K.m.container);
    cont(18.6, -42.9 + 0, 0, K.m.containerB, 0);
    cont(17.0, -30.6, 0, K.m.containerB);
    Props.barrel(K, BE, gE, this.ph, [5.2, 0, -30.0]);
    Props.barrel(K, BE, gE, this.ph, [5.9, 0, -29.6], K.m.trim);
    Props.barrel(K, BE, gE, this.ph, [19.4, 0, -36.4]);
    // berceau de navette vide (indice visuel : la navette est partie)
    BE.add(gE, K.m.dark, rbox(5.5, 0.3, 3.5, 0.05), [11.5, 0.15, -34.5]);
    for (const [x, z] of [[9.4, -33.2], [13.6, -33.2], [9.4, -35.8], [13.6, -35.8]]) BE.add(gE, K.m.orange, rbox(0.4, 1.0, 0.4, 0.05), [x, 0.8, z]);
    BE.add(gE, K.m.hazard, new THREE.PlaneGeometry(5.0, 0.3), [11.5, 0.305, -32.9], [-Math.PI / 2, 0, 0]);
    this.ph.add([8.75, 0, -36.25], [14.25, 0.3, -32.75], { camera: false });
    BE.add(gE, K.sign('NAVETTE H-1', 'BERCEAU 1 · VIDE'), new THREE.PlaneGeometry(2.0, 0.5), [4.32, 3.0, -34.5], [0, Math.PI / 2, 0]);
    // module de propulsion (jetpack)
    this.jetModule = new THREE.Group();
    this.jetModule.position.set(7.6, 0, -32.2);
    gE.add(this.jetModule);
    const BJ = new Builder();
    BJ.add(this.jetModule, K.m.dark, rbox(1.2, 0.8, 0.9, 0.04), [0, 0.4, 0]);
    BJ.add(this.jetModule, K.m.orange, rbox(1.24, 0.08, 0.94, 0.02), [0, 0.78, 0]);
    BJ.add(this.jetModule, K.m.hazard, new THREE.PlaneGeometry(1.1, 0.12), [0, 0.6, 0.455]);
    BJ.add(this.jetModule, K.sign('MODULE DE PROPULSION', 'R-SÉRIE · TYPE J'), new THREE.PlaneGeometry(0.9, 0.22), [0, 0.35, 0.455]);
    const jm = new THREE.Group(); jm.name = 'jet'; jm.position.y = 0.95; this.jetModule.add(jm);
    BJ.add(jm, K.m.orange, rbox(0.34, 0.28, 0.14, 0.04), [0, 0.0, 0]);
    for (const x of [-0.09, 0.09]) BJ.add(jm, K.m.steel, lathe([[0.022, 0], [0.026, -0.01], [0.04, -0.05], [0.0, -0.05]], 20), [x, -0.14, 0]);
    BJ.build();
    this.jetGlow = M.glow(0xffa040, 4);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.012, 8, 48), this.jetGlow);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.81; this.jetModule.add(ring);
    this.ph.add([7.0, 0, -32.65], [8.2, 0.8, -31.75]);
    this.interact.push({ id: 'jetpack', pos: new THREE.Vector3(7.6, 1.0, -32.2), r: 1.9, label: 'Module de propulsion', verb: 'Installer', enabled: () => !this.api.flags.jetpack, act: () => this.api.gainJetpack() });
    this.objectivePos.jetpack = new THREE.Vector3(7.6, 1.2, -32.2);
    this.objectivePos.catwalk = new THREE.Vector3(12.3, 4.6, -46.4);
    // éclairage de hangar : grandes lampes suspendues
    for (const x of [8.3, 16.3]) for (const z of [-32, -39]) {
      BE.add(gE, K.m.dark, lathe([[0.0, 0.3], [0.2, 0.28], [0.55, 0.0], [0.5, -0.02], [0.0, 0.2]], 24), [x, 7.6, z]);
      BE.add(gE, K.m.steel, bcyl(0.02, 1.0, 0.005, 6), [x, 8.4, z]);
      BE.add(gE, K.strip('E'), new THREE.CircleGeometry(0.48, 24), [x, 7.595, z], [Math.PI / 2, 0, 0]);
      const ls = this.pool.add(new THREE.Vector3(x, 7.0, z), 0xd8e8ff, 14, 9, 'E', 'neon', 0.55);
      this.rooms.E.lights.push(ls);
      if (this.q.volumetric) { const cone = new LightCone(new THREE.Vector3(x, 7.55, z), new THREE.Vector3(x, 0, z), 2.6, 0xa8c4ff, 0.03); gE.add(cone); this.cones.push(cone); }
    }
    BE.add(gE, K.sign('HANGAR', 'BAIE D\'AMARRAGE H'), new THREE.PlaneGeometry(3.2, 0.8), [20.28, 6.0, -37.5], [0, -Math.PI / 2, 0]);
    this.door('dEF', 'E', [12.3, 3.2, -46.45], true, 'closed');
    this.checkpoints.E = { id: 'E', pos: new THREE.Vector3(11.3, 0.1, -29.6), yaw: Math.PI };
    this.steamVents.push({ pos: new THREE.Vector3(16.8, -0.5, -35.4), dir: new THREE.Vector3(0, 1, 0), room: 'E', rate: 16, acc: 0, burst: 0 });

    // ============ F · Baie d'observation ============
    const F = this.room({ id: 'F', x0: 6.3, z0: -58.6, x1: 18.3, z1: -46.6, y: 3.2, h: 6, openings: [{ side: 'n', c: 12.3, w: 10.5, h: 4.6, y: 0.7, frame: false }], skip: ['s'], lightColor: 0xb8dcff, wall: 'white' });
    const BF = F.builder, gF = F.group;
    // grande vitre givrée + montants
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 4.6), K.m.glassWin);
    glass.position.set(12.3, 3.2 + 0.7 + 2.3, -58.6 - 0.15); gF.add(glass);
    this.ph.add([7.05, 3.2, -58.9], [17.55, 9.2, -58.6]);
    for (let i = 0; i <= 5; i++) BF.add(gF, K.m.trim, rbox(0.22, 4.7, 0.4, 0.04), [7.05 + i * 2.1, 3.2 + 0.7 + 2.3, -58.75]);
    BF.add(gF, K.m.trim, rbox(10.8, 0.25, 0.45, 0.04), [12.3, 3.2 + 0.7 + 4.6, -58.75]);
    BF.add(gF, K.m.trim, rbox(10.8, 0.25, 0.45, 0.04), [12.3, 3.2 + 0.7, -58.75]);
    // givre sur les bords de la vitre
    const frost = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 4.6), new THREE.MeshBasicMaterial({ map: this.frostTexture(), transparent: true, depthWrite: false, color: new THREE.Color(0.55, 0.7, 0.85) }));
    frost.position.copy(glass.position); frost.position.z += 0.01; gF.add(frost);
    // bancs
    for (const x of [9.5, 15.1]) { BF.add(gF, K.m.white, rbox(2.4, 0.12, 0.7, 0.04), [x, 3.65, -54.5]); BF.add(gF, K.m.dark, rbox(2.0, 0.42, 0.4, 0.03), [x, 3.41, -54.5]); this.ph.add([x - 1.2, 3.2, -54.85], [x + 1.2, 3.71, -54.15], { camera: false }); }
    // télescope
    BF.add(gF, K.m.dark, bcyl(0.25, 0.1, 0.02, 24), [12.3, 3.25, -56.6]);
    BF.add(gF, K.m.dark, bcyl(0.05, 1.1, 0.01, 12), [12.3, 3.8, -56.6]);
    BF.add(gF, K.m.white, bcyl(0.12, 1.3, 0.02, 24), [12.3, 4.5, -56.8], [1.1, 0, 0]);
    this.ph.add([12.0, 3.2, -57.0], [12.6, 4.6, -56.2], { camera: false });
    this.scannables.push({ id: 'asterion', pos: new THREE.Vector3(14.5, 6.0, -58.4), label: 'L\'Asterion', clue: 'asterion' });
    this.objectivePos.bay = new THREE.Vector3(12.3, 4.6, -52);
    // lumière bleutée de la planète entrant par la vitre
    for (const x of [9, 15.6]) this.pool.add(new THREE.Vector3(x, 6.2, -57.6), 0x6f9fe0, 9, 9, 'F', 'screen', 1);
    this.checkpoints.F = { id: 'F', pos: new THREE.Vector3(12.3, 3.3, -47.6), yaw: Math.PI };

    // triggers d'entrée de pièce
    const roomTrig = (id: string) => {
      const s = this.rooms[id].spec;
      this.ph.trigger([s.x0, s.y - 0.5, s.z0], [s.x1, s.y + s.h, s.z1], { onEnter: () => { this.current = id; this.api.enterRoom(id); } });
    };
    for (const id of Object.keys(this.rooms)) roomTrig(id);
    // points de contrôle
    this.ph.trigger([-6, 0, -28.3], [6, 3, -16.3], { onEnter: () => this.api.checkpoint('C') });
    this.ph.trigger([4.3, 0, -31.5], [20.3, 3, -28.6], { onEnter: () => this.api.checkpoint('E') });
    this.ph.trigger([6.3, 3.0, -52], [18.3, 7, -46.6], { onEnter: () => { this.api.checkpoint('F'); this.api.endOfSlice(); } });
    // vide (puits du hangar)
    this.ph.trigger([hole.x0, -20, hole.z0], [hole.x1, -1.2, hole.z1], { onEnter: () => this.api.kill('Chute dans le puits de service') });

    // construire toute la géométrie fusionnée
    for (const r of Object.values(this.rooms)) r.builder.build();
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && !(o as THREE.Mesh).castShadow) { const m = (o as THREE.Mesh).material as THREE.Material; if (!m.transparent && !(m as THREE.MeshBasicMaterial).isMeshBasicMaterial && !(m as THREE.ShaderMaterial).isShaderMaterial) o.castShadow = true; } });
    // éclairage initial : seulement les secours
    this.setRoomLight('E', 0.55);
    this.setRoomLight('F', 0.7);
  }

  private beacon(g: THREE.Group, B: Builder, room: string, p: THREE.Vector3) {
    B.add(g, this.kit.m.dark, bcyl(0.12, 0.08, 0.02, 16), [p.x, p.y + 0.18, p.z]);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.05) });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.18, 16), mat);
    m.position.copy(p).add(new THREE.Vector3(0, 0.05, 0));
    g.add(m);
    this.beacons.push({ mesh: m, mat });
    this.emergency.push(this.pool.add(p.clone().add(new THREE.Vector3(0, -0.3, 0)), 0xff2a10, 3.2, 5.5, room, 'emergency', 1));
  }

  /** Niveau des bandeaux d'une pièce (0 = éteint). */
  setRoomLight(id: string, lvl: number) {
    const r = this.rooms[id];
    for (const l of r.lights) l.level = lvl;
    const col = new THREE.Color(r.spec.lightColor ?? 0xbfe6ff);
    this.kit.strip(id).color.copy(col).multiplyScalar(lvl * 3.2);
  }

  /** Séquence de rétablissement de l'énergie. */
  restorePower() {
    if (this.powered) return;
    this.powered = true;
    this.powerT = 0;
    this.audio.powerUp();
    this.doors.dCD.setState('closed');
  }

  sparkBurst(p: THREE.Vector3, n: number) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3);
      this.sparks.emit(p, v, 0.6 + Math.random() * 0.8, 0.012 + Math.random() * 0.012, new THREE.Color(3, 1.8, 0.7));
    }
  }

  visibleRooms() {
    const s = new Set<string>([this.current, ...(this.adj[this.current] ?? [])]);
    if (this.current === 'E' || this.current === 'F') { s.add('E'); s.add('F'); }
    return s;
  }

  update(dt: number, t: number, playerPos: THREE.Vector3, playerInHazard: (b: THREE.Box3) => boolean, gameplay = true) {
    const vis = this.visibleRooms();
    for (const [id, r] of Object.entries(this.rooms)) r.group.visible = vis.has(id);
    // séquence d'allumage
    if (this.powerT >= 0) {
      this.powerT += dt;
      const order: [string, number][] = [['C', 0.6], ['B', 1.6], ['A', 2.4], ['D', 3.0]];
      for (const [id, at] of order) {
        const k = this.powerT - at;
        if (k < 0) continue;
        const flick = k < 1.2 ? (Math.random() < 0.5 - k * 0.3 ? 0.05 : 1) : 1;
        this.setRoomLight(id, Math.min(1, k * 1.5) * flick * (id === 'D' ? 0.85 : 1));
      }
      this.relayMat.color.setRGB(0.25, 0.85, 1.6).multiplyScalar(Math.min(1, this.powerT / 2) * 2.5);
      if (this.powerT > 4.5) this.powerT = -1;
    } else if (this.powered) {
      // néon qui clignote dans la coursive
      const bl = this.rooms.B.lights[2];
      if (bl) bl.level = Math.random() < 0.06 ? 0.1 : 1;
      this.relayMat.color.setRGB(0.25, 0.85, 1.6).multiplyScalar(2.2 + Math.sin(t * 2) * 0.4);
    }
    // gyrophares (s'éteignent avec l'énergie)
    for (const b of this.beacons) { const on = (Math.sin(t * 4) > 0 ? 1 : 0.15) * (this.powered ? 0.0 : 1); b.mat.color.setRGB(3 * on + 0.1, 0.2 * on, 0.05); b.mesh.rotation.y = t * 4; }
    for (const e of this.emergency) if (e.kind === 'emergency') e.level = this.powered ? 0 : (0.55 + 0.45 * Math.sin(t * 4)) * 0.8;

    // arcs électriques
    this.arcCycle = (this.arcCycle + dt) % 2.9;
    const charging = this.arcCycle > 1.35 && this.arcCycle < 1.6;
    const arcOn = this.arcCycle >= 1.6;
    this.arcHazard.active = arcOn;
    if (vis.has('B')) {
      for (const a of this.arcs) { if (arcOn && Math.random() < 0.7) a.draw(); else a.hide(); }
      for (const l of this.arcLights) l.level = arcOn ? 0.5 + Math.random() * 0.8 : charging ? Math.random() * 0.2 : 0;
      if (charging && Math.random() < 0.4) this.sparkBurst(new THREE.Vector3(0, 2.2, -8), 2);
      if (arcOn && Math.random() < 0.3) this.sparkBurst(new THREE.Vector3((Math.random() - 0.5) * 2.6, 0.05, -8 + (Math.random() - 0.5) * 0.6), 3);
      this.audio.loop('arc', 'arc', new THREE.Vector3(0, 2, -8), 0);
      this.audio.setLoop('arc', arcOn ? 0.5 : charging ? 0.08 : 0, 0.03);
    } else this.audio.setLoop('arc', 0);
    if (gameplay && arcOn && playerInHazard(this.arcHazard.box)) { this.audio.zap(playerPos); this.api.kill('Arc électrique'); }

    // vapeur
    for (const v of this.steamVents) {
      if (!vis.has(v.room)) continue;
      v.burst -= dt;
      if (v.burst < -3 - Math.random() * 3) v.burst = 1.2;
      const rate = v.rate * (v.burst > 0 ? 3 : 1) * this.q.particles;
      v.acc += rate * dt;
      while (v.acc > 1) {
        v.acc -= 1;
        const d = v.dir.clone().multiplyScalar(0.9 + Math.random() * 0.8).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3));
        const lit = this.powered ? 0.75 : 0.45;
        this.steam.emit(v.pos, d, 2.2 + Math.random(), 0.12 + Math.random() * 0.1, new THREE.Color(lit, lit * 1.04, lit * 1.1), 0.18);
      }
    }
    this.sparks.setFloor(this.rooms[this.current].spec.y);
    this.steam.update(dt); this.sparks.update(dt);
    // portes
    for (const d of Object.values(this.doors)) d.update(dt, playerPos, (open) => this.audio.door(d.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), open));
    // écrans
    for (const s of this.screens) {
      if (!vis.has(s.room)) continue;
      const g = (s.tex.image as HTMLCanvasElement).getContext('2d')!;
      s.draw(g, t, this.powered);
      s.tex.needsUpdate = true;
      s.mat.color.setScalar(this.powered ? 1.6 : 0.7);
    }
    // module jetpack : halo pulsé
    if (this.jetModule) {
      const has = this.api.flags.jetpack;
      this.jetGlow.color.setRGB(1, 0.55, 0.2).multiplyScalar(has ? 0.2 : 2.5 + Math.sin(t * 3) * 1.5);
      const jm = this.jetModule.getObjectByName('jet');
      if (jm) { jm.visible = !has; jm.rotation.y = t * 0.6; jm.position.y = 1.05 + Math.sin(t * 1.5) * 0.04; }
    }
    this.holo.update(dt, t);
    for (const c of this.cones) c.update(t);
    if (gameplay) this.ph.updateTriggers(playerPos.clone().add(new THREE.Vector3(0, 0.3, 0)), dt);
    this.pool.update(playerPos, dt, vis);
  }

  // ---------- écrans et textures dessinées ----------
  private drawSignalScreen(g: CanvasRenderingContext2D, t: number, p: boolean) {
    g.fillStyle = '#02070b'; g.fillRect(0, 0, 512, 256);
    if (!p) { g.fillStyle = Math.sin(t * 3) > 0 ? '#ff3a1a' : '#40100a'; g.font = '600 30px "Barlow Condensed", sans-serif'; g.fillText('ÉNERGIE AUXILIAIRE — 4 %', 24, 60); g.fillStyle = '#5b2a20'; g.font = '22px "Barlow Condensed", sans-serif'; g.fillText('Systèmes non essentiels coupés', 24, 96); return; }
    g.strokeStyle = 'rgba(80,200,255,0.25)'; g.lineWidth = 1;
    for (let x = 0; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x, 230); g.stroke(); }
    g.strokeStyle = '#6fe0ff'; g.lineWidth = 2; g.beginPath();
    const ph = (t * 0.25) % 1;
    for (let x = 0; x < 512; x++) {
      const k = x / 512; const d = Math.abs(k - ph);
      const pulse = Math.exp(-Math.pow((k * 3 % 1) - 0.5, 2) * 120) * (d < 0.3 ? 1 : 0.25);
      const y = 140 - pulse * 80 + Math.sin(x * 0.7 + t * 9) * 3;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = '#bff3ff'; g.font = '600 26px "Barlow Condensed", sans-serif'; g.fillText('SIGNAL ENTRANT · PÉRIODE 41:00', 20, 30);
    g.fillStyle = '#7fb8cc'; g.font = '20px "Barlow Condensed", sans-serif'; g.fillText('SOURCE : SURFACE — COORD. INCONNUES', 20, 248);
  }
  private drawStatusScreen(g: CanvasRenderingContext2D, t: number, p: boolean) {
    g.fillStyle = '#02070b'; g.fillRect(0, 0, 512, 256);
    g.font = '600 26px "Barlow Condensed", sans-serif';
    const rows = p ? [['ÉQUIPAGE À BORD', '0 / 6', '#ff8a6a'], ['NAVETTE H-1', 'ABSENTE', '#ffcf6a'], ['CONTACT ASTERION', 'PERDU · J+31', '#ff8a6a'], ['SUPPORT VIE', 'NOMINAL', '#7dffb2']] : [['ÉQUIPAGE À BORD', '—', '#5b2a20'], ['', '', ''], ['', '', ''], ['', '', '']];
    rows.forEach(([a, b, c], i) => { g.fillStyle = p ? '#9fd8ee' : '#40100a'; g.fillText(a, 24, 50 + i * 50); g.fillStyle = c; g.fillText(b, 330, 50 + i * 50); });
    if (!p && Math.sin(t * 2) > 0) { g.fillStyle = '#ff3a1a'; g.fillText('HORS LIGNE', 24, 50); }
  }
  private drawPanelScreen(g: CanvasRenderingContext2D, t: number, p: boolean) {
    g.fillStyle = '#02070b'; g.fillRect(0, 0, 512, 256);
    g.font = '600 34px "Barlow Condensed", sans-serif';
    g.fillStyle = p ? '#7dffb2' : (Math.sin(t * 4) > 0 ? '#ffb020' : '#6a4808');
    g.fillText(p ? 'DISTRIBUTION : RÉTABLIE' : 'DISTRIBUTION : COUPÉE', 24, 56);
    g.font = '24px "Barlow Condensed", sans-serif'; g.fillStyle = '#7fb8cc';
    g.fillText(p ? 'Secteurs A · B · C · D alimentés' : 'Reroutage manuel requis', 24, 100);
    for (let i = 0; i < 5; i++) { g.fillStyle = p ? '#2c8f6a' : i < 1 ? '#8a5a10' : '#2a2f36'; g.fillRect(24 + i * 92, 150, 80, 60); }
  }
  private drawTablet(g: CanvasRenderingContext2D) {
    g.fillStyle = '#0a1016'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#cfe6f2'; g.font = '600 30px "Barlow Condensed", sans-serif'; g.fillText('H. ISHII — JOURNAL', 24, 46);
    g.fillStyle = '#6f8fa0'; g.font = '22px "Barlow", sans-serif';
    ['Jour 205', 'Elio ne dort plus. Il écoute', 'le signal au casque, la nuit…'].forEach((l, i) => g.fillText(l, 24, 92 + i * 36));
  }
  private boardTexture() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 600;
    const g = c.getContext('2d')!;
    g.fillStyle = '#e9ecee'; g.fillRect(0, 0, 1024, 600);
    g.fillStyle = 'rgba(120,130,140,0.25)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 1024, Math.random() * 600, 120 + Math.random() * 200, 8);
    g.strokeStyle = '#1d3f8a'; g.fillStyle = '#1d3f8a'; g.lineWidth = 6;
    g.font = 'italic 700 150px "Barlow Condensed", sans-serif'; g.fillText('41:00', 300, 220);
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(290, 250 + i * 18); g.lineTo(700, 245 + i * 18); g.stroke(); }
    g.font = 'italic 600 90px "Barlow Condensed", sans-serif'; g.fillText('I   ·   II   ·   III   →   ?', 230, 430);
    g.fillStyle = '#b02020'; g.font = 'italic 600 54px "Barlow", sans-serif'; g.fillText('ça compte.', 640, 540);
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
    g.strokeStyle = '#d01818'; g.lineWidth = 5; g.beginPath(); g.ellipse(70 + 5 * 84, 390 - 198, 42, 48, 0.1, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, 0, 560, 390);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  private frostTexture() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const g = c.getContext('2d')!;
    const img = g.createImageData(1024, 512);
    for (let y = 0; y < 512; y++) for (let x = 0; x < 1024; x++) {
      const ex = Math.min(x, 1023 - x) / 1024, ey = Math.min(y, 511 - y) / 512;
      const e = Math.min(ex * 3, ey * 3.5);
      const n = Math.random();
      const a = Math.max(0, 1 - e * 6) * (0.4 + 0.6 * n);
      const i = (y * 1024 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * a * 90;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
}
