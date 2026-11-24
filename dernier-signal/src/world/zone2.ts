import * as THREE from 'three';
import { Builder, rbox, bcyl, lathe, type V3 } from '../robots/parts';
import * as M from '../robots/materials';
import { Kit, buildRoom, Door, Props, type Room, type RoomSpec } from './kit';
import { Physics, type Axis } from './physics';
import { LightPool, type LightSource } from './lights';
import { Particles } from '../fx/particles';
import { Flame } from '../fx/robotfx';
import { Hologram, buildShuttle } from './elements';
import type { AudioEngine } from '../audio/audio';
import type { Quality } from '../core/quality';
import type { GameApi, Interactable, Scannable, Checkpoint, ObjectiveKey } from './zone1';
import type { Footprints } from './elements';

// Zone 2 · Épave de l'Asterion — missions 10 à 17 (voir MISSIONS.md).
//
//   Coque (y = 0) : navette amarrée ── sas ──┐         tour du réacteur (bottes : marcher sur ses parois)
//                                            │                │
//   R3 Vestiaire ── R2 Gravité folle ── R1 Pont brisé (apesanteur, tempêtes de débris)
//                                                             │
//   R4 Puits du réacteur (parois magnétiques) ── R5 Commandement ── R6 Capsules ── X2 Épave extérieure

export const CP2 = ['X', 'R1', 'R2', 'R3', 'X3', 'R4', 'R5', 'R6', 'X2'];

interface Storm { period: number; t: number; dir: THREE.Vector3; region: THREE.Box3; rooms: string[]; state: 'calm' | 'warn' | 'wave'; }

export class Zone2 {
  readonly zoneId = 2;
  readonly zoneName = 'Épave de l\'Asterion';
  mapBounds = { minX: -82, maxX: 64, minZ: -22, maxZ: 36 };
  onTeleport?: (cp: string) => void;
  dockT = -1;
  private scene: THREE.Scene;
  readonly cpOrder = CP2;
  kit: Kit;
  ph = new Physics();
  pool: LightPool;
  root = new THREE.Group();
  rooms: Record<string, Room> = {};
  adj: Record<string, string[]> = { X: ['R1'], R1: ['X', 'R2'], R2: ['R1', 'R2s', 'R3'], R2s: ['R2'], R3: ['R2'], X3: [], R4: ['R5'], R5: ['R4', 'R6'], R6: ['R5', 'X2'], X2: ['R6'] };
  doors: Record<string, Door> = {};
  interact: Interactable[] = [];
  scannables: Scannable[] = [];
  checkpoints: Record<string, Checkpoint> = {};
  objectivePos: Partial<Record<ObjectiveKey, THREE.Vector3>> = {};
  current = 'X';
  powered = false;
  external = new THREE.Vector3();
  holos: Record<string, Hologram> = {};
  footprints: Footprints[] = [];
  exterior = new THREE.Group();
  hull = new THREE.Group();
  private api: GameApi; private audio: AudioEngine;
  private sparks: Particles; private debris: Particles; private dust: Particles;
  private storms: Storm[] = [];
  private rocks!: THREE.InstancedMesh;
  private beacons: { mesh: THREE.Object3D; mat: THREE.MeshBasicMaterial; room: string }[] = [];
  private emergency: LightSource[] = [];
  private gravity = { t: 0, inverted: false, region: new THREE.Box3(new THREE.Vector3(-62, -30, 5), new THREE.Vector3(-30.3, -16, 11)), warn: false };
  private gravLamps: THREE.MeshBasicMaterial;
  private zeroGRegions: THREE.Box3[] = [];
  private magRegions: THREE.Box3[] = [];
  private radZones: { box: THREE.Box3; mat: THREE.MeshBasicMaterial }[] = [];
  private exposure = 0;
  private rings: { mesh: THREE.Group; tilt: THREE.Euler; aligned: boolean; k: number }[] = [];
  private coreMat: THREE.MeshBasicMaterial;
  private reactorLight: LightSource | null = null;
  private reactorT = -1;
  private suits: THREE.Object3D[] = [];
  private floaters: { o: THREE.Object3D; v: THREE.Vector3; w: THREE.Vector3 }[] = [];
  private parts: THREE.Object3D[] = [];
  lightning: THREE.DirectionalLight;
  private sun: THREE.DirectionalLight; private bounce: THREE.DirectionalLight; private outside = 1;
  private flash = 0; private nextFlash = 3;
  shuttle: ReturnType<typeof buildShuttle>;
  capsule = new THREE.Group();
  private capFlames: Flame[] = [];
  surface = new THREE.Group();
  descentT = -1;
  private heat!: THREE.Mesh;
  private glowPts!: THREE.PointsMaterial;

  constructor(scene: THREE.Scene, q: Quality, api: GameApi, audio: AudioEngine) {
    void q; this.api = api; this.scene = scene; this.audio = audio;
    this.kit = new Kit(q.textureRes);
    this.pool = new LightPool(scene, q.id === 'econome' ? 4 : q.id === 'equilibre' ? 5 : 6);
    scene.add(this.root, this.hull, this.exterior, this.surface);
    this.sparks = new Particles({ max: 300, additive: true, gravity: 0, drag: 0.6, soft: false });
    this.debris = new Particles({ max: 500, additive: false, gravity: 0, drag: 0, soft: false });
    this.dust = new Particles({ max: 260, additive: true, gravity: 0, drag: 0.1, soft: false });
    scene.add(this.sparks, this.debris, this.dust);
    this.lightning = new THREE.DirectionalLight(0xbfd8ff, 0);
    this.lightning.position.set(-200, -260, 80);
    scene.add(this.lightning);
    // lumière extérieure : soleil lointain + reflet bleuté de la planète (atténués à l'intérieur)
    this.sun = new THREE.DirectionalLight(0xffd9b0, 0); this.sun.position.set(120, 80, 60);
    this.bounce = new THREE.DirectionalLight(0x4a78c0, 0); this.bounce.position.set(-40, -200, 30);
    scene.add(this.sun, this.bounce);
    this.gravLamps = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.shuttle = buildShuttle(this.kit);
    this.build();
  }

  private room(s: RoomSpec) { const r = buildRoom(this.kit, this.ph, this.pool, s); this.rooms[s.id] = r; this.root.add(r.group); return r; }
  private door(id: string, room: string, pos: V3, alongX: boolean, state: Door['state'], w = 2.4, h = 2.8) {
    const d = new Door(this.kit, this.ph, new THREE.Vector3(...pos), alongX, w, h, state, room);
    this.rooms[room].group.add(d.group); this.doors[id] = d; return d;
  }
  private cp(id: string, room: string, pos: V3, yaw: number) { this.checkpoints[id] = { id, room, pos: new THREE.Vector3(...pos), yaw }; }
  private beacon(room: string, p: THREE.Vector3, color = 0xff2a10) {
    const r = this.rooms[room];
    r.builder.add(r.group, this.kit.m.dark, bcyl(0.12, 0.08, 0.02, 16), [p.x, p.y + 0.18, p.z]);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.05) });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.18, 16), mat);
    m.position.copy(p).add(new THREE.Vector3(0, 0.05, 0)); r.group.add(m);
    this.beacons.push({ mesh: m, mat, room });
    this.emergency.push(this.pool.add(p.clone().add(new THREE.Vector3(0, -0.4, 0)), color, 5, 9, room, 'emergency', 1));
  }
  private plate(B: Builder, g: THREE.Object3D, mat: THREE.Material, min: V3, max: V3, tag?: string) {
    B.add(g, mat, new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]), [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]);
    return this.ph.add(min, max, { tag });
  }

  private build() {
    const K = this.kit, F = this.api.flags;
    const hullMat = K.m.wallWreck;
    const burnt = M.steel(0x1c1714, { rough: 0.8, wear: 0.2, dirt: 0.7 });
    const HB = new Builder();
    // ================= Coque extérieure (X) =================
    // dessus de la coque (magnétique), percé du sas au-dessus du pont brisé
    const topHoles = [{ x0: 8, z0: -2, x1: 12, z1: 2 }];
    const rects = [{ x0: -80, z0: -20, x1: 34, z1: 28 }];
    for (const h of topHoles) { const r = rects.pop()!; rects.push({ x0: r.x0, z0: r.z0, x1: h.x0, z1: r.z1 }, { x0: h.x1, z0: r.z0, x1: r.x1, z1: r.z1 }, { x0: h.x0, z0: r.z0, x1: h.x1, z1: h.z0 }, { x0: h.x0, z0: h.z1, x1: h.x1, z1: r.z1 }); }
    for (const r of rects) this.plate(HB, this.hull, hullMat, [r.x0, -1, r.z0], [r.x1, 0, r.z1], 'mag');
    // flancs, fond, extrémités (le flanc sud est éventré sur le pont brisé)
    this.plate(HB, this.hull, hullMat, [-80, -80, 28], [34, 0, 29], 'mag');
    this.plate(HB, this.hull, hullMat, [-80, -81, -20], [34, -80, 29]);
    this.plate(HB, this.hull, hullMat, [-81, -80, -20], [-80, 0, 29]);
    this.plate(HB, this.hull, hullMat, [34, -80, -20], [35, -34, 29]);
    this.plate(HB, this.hull, hullMat, [34, -26, -20], [35, 0, 29]);
    this.plate(HB, this.hull, hullMat, [34, -34, -20], [35, -26, 12]);
    this.plate(HB, this.hull, hullMat, [34, -34, 24], [35, -26, 29]);
    this.plate(HB, this.hull, hullMat, [-80, -80, -21], [-30, 0, -20]);
    this.plate(HB, this.hull, hullMat, [15, -80, -21], [34, 0, -20]);
    this.plate(HB, this.hull, hullMat, [-30, -80, -21], [15, -27, -20]);
    // bords déchirés de la brèche sud
    for (let i = 0; i < 26; i++) HB.add(this.hull, burnt, rbox(1 + (i % 4), 0.3, 0.6 + (i % 3) * 0.5, 0.05), [-30 + i * 1.75, -1 - (i % 5) * 0.8, -20 - (i % 3) * 0.6], [0.6 * Math.sin(i), i, 0.4 * Math.cos(i * 1.3)]);
    // nervures, antennes, détails
    for (let x = -76; x < 32; x += 8) HB.add(this.hull, burnt, rbox(0.6, 0.5, 48, 0.1), [x, 0.25, 4]);
    for (let i = 0; i < 14; i++) HB.add(this.hull, K.m.dark, rbox(1.5 + (i % 3), 0.8, 2 + (i % 2) * 2, 0.1), [-70 + i * 7.5, 0.4, -14 + ((i * 7) % 30)]);
    // tour du réacteur (magnétique) : on y monte avec les bottes
    this.plate(HB, this.hull, hullMat, [-3, 0, -6], [3, 20, 6], 'mag');
    for (let y = 2; y < 20; y += 3) HB.add(this.hull, burnt, rbox(6.2, 0.25, 12.2, 0.05), [0, y, 0]);
    HB.add(this.hull, K.m.hazard, new THREE.PlaneGeometry(4, 4), [0, 20.02, 0], [-Math.PI / 2, 0, 0]);
    HB.add(this.hull, K.m.dark, bcyl(1.2, 0.3, 0.05, 24), [0, 20.15, 0]);
    this.interact.push({ id: 'towerHatch', pos: new THREE.Vector3(0, 20.6, 0), r: 2.2, label: 'Écoutille du réacteur', verb: 'Descendre dans le puits', enabled: () => !!F.boots, act: () => this.enterReactor() });
    this.objectivePos.m13b = new THREE.Vector3(0, 20.6, 0);
    // antenne extérieure + casque de Kenji (secret)
    HB.add(this.hull, K.m.steel, bcyl(0.12, 7, 0.02, 10), [-56, 3.5, -12]);
    HB.add(this.hull, K.m.dark, rbox(2, 0.1, 0.1, 0.02), [-56, 6.5, -12]);
    HB.add(this.hull, K.m.white, new THREE.SphereGeometry(0.2, 16, 12), [-55.75, 1.3, -12], [0, 0, 0], [1, 1.1, 1.05]);
    HB.add(this.hull, M.glossyBlack(), new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI), [-55.62, 1.3, -12], [0, Math.PI / 2, 0]);
    this.scannables.push({ id: 's_casque', pos: new THREE.Vector3(-55.75, 1.3, -12), label: 'Casque accroché', clue: 'casqueKenji' });
    this.interact.push({ id: 'casque', pos: new THREE.Vector3(-55.8, 1.0, -12), r: 1.8, label: 'Casque sur l\'antenne', verb: 'Examiner', enabled: () => !F.clue_casqueKenji, act: () => { F.clue_casqueKenji = true; this.api.clue('casqueKenji'); } });
    // navette amarrée de travers
    this.shuttle.group.position.set(24, 1.2, 8); this.shuttle.group.rotation.set(0.12, -2.4, -0.2);
    this.hull.add(this.shuttle.group);
    this.ph.add([19, 0, 4], [29, 3.5, 12]);
    HB.build();
    this.hull.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    this.zeroGRegions.push(new THREE.Box3(new THREE.Vector3(-90, -0.2, -40), new THREE.Vector3(60, 60, 50)));
    this.magRegions.push(new THREE.Box3(new THREE.Vector3(-90, -1.5, -40), new THREE.Vector3(60, 60, 50)));
    this.cp('X', 'X', [22, 2.5, 2], -Math.PI / 2);
    this.objectivePos.m10 = new THREE.Vector3(10, 0.5, 0);
    // débris flottants autour de l'épave
    const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(i % 3 ? rockGeo : rbox(1.2, 0.2, 0.8, 0.05), burnt);
      m.position.set(-60 + Math.random() * 100, 3 + Math.random() * 25, -30 + Math.random() * 70);
      m.scale.setScalar(0.4 + Math.random() * 1.6); m.castShadow = true;
      this.exterior.add(m);
      this.floaters.push({ o: m, v: new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.3), w: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(0.3) });
    }

    // ================= R1 · Pont brisé (apesanteur + tempêtes) =================
    const R1 = this.room({ id: 'R1', x0: -30, z0: -14, x1: 15, z1: 14, y: -26, h: 24, noCeiling: true, wreck: true, stripEvery: 6, lightColor: 0xff9a60,
      openings: [{ side: 'n', c: -7.5, w: 45.6, h: 24.5, frame: false }, { side: 'w', c: 8, w: 2.4, h: 2.8 }] });
    const B1 = R1.builder, g1 = R1.group;
    this.zeroGRegions.push(new THREE.Box3(new THREE.Vector3(-30, -27, -16), new THREE.Vector3(15, -1, 14)));
    // abris : cloisons arrachées, conteneurs
    const shelter = (min: V3, max: V3) => { this.plate(B1, g1, K.m.wallWreck, min, max); for (let i = 0; i < 3; i++) B1.add(g1, burnt, rbox(0.4, max[1] - min[1], 0.4, 0.05), [min[0] + (max[0] - min[0]) * (i / 2), (min[1] + max[1]) / 2, max[2] + 0.2]); };
    shelter([-4, -20, 1.5], [13, -6, 2.5]);
    shelter([-28, -26, -1], [-6, -12, 0]);
    shelter([-20, -9, 5], [-10, -3, 6]);
    for (const [x, y, z, ry] of [[6, -24, 9, 0.3], [-14, -16, 9, -0.2], [-24, -25, 4, 0.1], [2, -12, 10, 0.6]] as const) {
      B1.add(g1, K.m.containerB, rbox(5, 2.4, 2.4, 0.05), [x, y, z], [0, ry, 0.15]);
      this.ph.add([x - 2.6, y - 1.3, z - 1.4], [x + 2.6, y + 1.3, z + 1.4]);
    }
    // cargaisons qui flottent (décor)
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(rbox(0.6 + (i % 3) * 0.3, 0.6, 0.6, 0.05), i % 2 ? K.m.orange : K.m.white);
      m.position.set(-26 + (i * 3.1) % 40, -24 + (i * 2.3) % 20, -10 + (i * 4.7) % 22); m.castShadow = true;
      g1.add(m); this.floaters.push({ o: m, v: new THREE.Vector3((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.15), w: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(0.4) });
    }
    // impacts alignés (indice)
    for (let i = 0; i < 30; i++) B1.add(g1, burnt, new THREE.CircleGeometry(0.15 + Math.random() * 0.3, 10), [-28 + Math.random() * 40, -24 + Math.random() * 20, 13.69], [0, Math.PI, 0]);
    this.scannables.push({ id: 's_impacts', pos: new THREE.Vector3(-8, -14, 13.6), label: 'Impacts dans la paroi', clue: 'impacts' });
    // enregistreur d'Ilse
    B1.add(g1, K.m.dark, rbox(0.6, 0.4, 0.15, 0.03), [9, -6, 13.85]);
    B1.add(g1, M.glow(0x40ff9a, 3), rbox(0.06, 0.03, 0.03, 0.01, 1), [9.2, -5.9, 13.76]);
    this.interact.push({ id: 'ilse2', pos: new THREE.Vector3(9, -6, 13.2), r: 1.8, label: 'Enregistreur d\'Ilse', verb: 'Écouter', enabled: () => true, act: () => this.api.playLog('ilse2') });
    // alcôve de l'ancien équipage (secret, scanner)
    B1.add(g1, K.m.dark, rbox(0.2, 1.4, 1.6, 0.03), [14.8, -24.3, -10]);
    this.scannables.push({ id: 'alcove', pos: new THREE.Vector3(14.6, -24.3, -10), label: 'Alcôve scellée', onScan: () => { F.alcove = true; } });
    this.interact.push({ id: 'ancien', pos: new THREE.Vector3(14, -24.3, -10), r: 1.8, label: 'Alcôve scellée', verb: 'Ouvrir et lire', enabled: () => !!F.alcove, act: () => this.api.playLog('ancien') });
    this.door('dR1R2', 'R1', [-30.15, -26, 8], false, 'closed');
    this.beacon('R1', new THREE.Vector3(14.6, -4, 13.6)); this.beacon('R1', new THREE.Vector3(-29.6, -10, 13.6)); this.beacon('R1', new THREE.Vector3(-29.6, -24, -13.4));
    this.storms.push({ period: 16, t: 4, dir: new THREE.Vector3(0, 0, 1), region: new THREE.Box3(new THREE.Vector3(-30, -27, -14), new THREE.Vector3(15, -2, 14)), rooms: ['R1'], state: 'calm' });
    this.cp('R1', 'R1', [10, -4, 6], Math.PI);
    this.objectivePos.m11 = new THREE.Vector3(-30, -24.6, 8);
    this.ph.trigger([8, -6, -2], [12, -1, 2], { onEnter: () => { if (!F.m10done) { F.m10done = true; this.api.completeMission('m10', 'm11'); this.api.checkpoint('R1'); } } });

    // ================= R2 · Section de gravité folle =================
    const R2 = this.room({ id: 'R2', x0: -62, z0: 5, x1: -30.3, z1: 11, y: -26, h: 6, noCeiling: true, skip: ['e', 'w'], wreck: true, stripEvery: 4, lightColor: 0xffb070,
      holes: [{ x0: -38, z0: 4, x1: -35, z1: 12 }, { x0: -50, z0: 4, x1: -46.5, z1: 12 }],
      openings: [{ side: 's', c: -52, w: 1.6, h: 2.4 }] });
    const B2 = R2.builder, g2 = R2.group;
    // plafond avec ses propres trous (on y marche quand la gravité s'inverse)
    const ceil = [[-62.3, -56], [-53, -44], [-41, -30.3]];
    for (const [a, b] of ceil) { this.plate(B2, g2, K.m.floor, [a, -20, 4.7], [b, -19.6, 11.3]); B2.add(g2, K.m.grate, new THREE.BoxGeometry(b - a, 0.02, 1.0), [(a + b) / 2, -20.01, 8]); }
    for (const [a, b] of [[-56, -53], [-44, -41]]) { B2.add(g2, K.m.hazard, new THREE.PlaneGeometry(b - a + 0.4, 0.3), [(a + b) / 2, -20.02, 5.2], [Math.PI / 2, 0, 0]); B2.add(g2, K.m.hazard, new THREE.PlaneGeometry(b - a + 0.4, 0.3), [(a + b) / 2, -20.02, 10.8], [Math.PI / 2, 0, 0]); }
    for (const [a, b] of [[-38, -35], [-50, -46.5]]) { B2.add(g2, K.m.hazard, new THREE.PlaneGeometry(b - a + 0.4, 0.3), [(a + b) / 2, -25.98, 5.2], [-Math.PI / 2, 0, 0]); B2.add(g2, K.m.hazard, new THREE.PlaneGeometry(b - a + 0.4, 0.3), [(a + b) / 2, -25.98, 10.8], [-Math.PI / 2, 0, 0]); }
    // lampes d'avertissement de gravité
    for (let x = -60; x < -31; x += 4) { B2.add(g2, this.gravLamps, rbox(0.5, 0.1, 0.1, 0.02, 1), [x, -23, 5.12]); B2.add(g2, this.gravLamps, rbox(0.5, 0.1, 0.1, 0.02, 1), [x, -23, 10.88]); }
    this.ph.trigger([-62, -40, 4], [-30.3, -29, 12], { onEnter: () => this.api.kill('Chute dans les entrailles du vaisseau') });
    this.ph.trigger([-62, -18.5, 4], [-30.3, -8, 12], { onEnter: () => this.api.kill('Aspiré vers les ponts supérieurs') });
    B2.add(g2, K.m.dark, rbox(0.7, 0.5, 0.12, 0.03), [-42.5, -24.6, 5.08]);
    B2.add(g2, M.glow(0x40ff9a, 3), rbox(0.06, 0.03, 0.03, 0.01, 1), [-42.3, -24.5, 5.16]);
    this.interact.push({ id: 'kenji1', pos: new THREE.Vector3(-42.5, -24.8, 5.6), r: 1.7, label: 'Enregistreur de Kenji', verb: 'Écouter', enabled: () => true, act: () => this.api.playLog('kenji1') });
    this.door('dR2s', 'R2', [-52, -26, 11.15], true, 'closed', 1.6, 2.4);
    this.cp('R2', 'R2', [-31.6, -26, 8], -Math.PI / 2);
    this.objectivePos.m12 = new THREE.Vector3(-62, -24.6, 8);
    // cabine obscure (secret : Samir chante)
    const R2s = this.room({ id: 'R2s', x0: -58, z0: 11.3, x1: -46, z1: 18, y: -26, h: 3.4, skip: ['n'], wreck: true, openings: [] });
    Props.bunk(K, R2s.builder, R2s.group, this.ph, [-56.5, -26, 15], Math.PI / 2);
    this.holos.samirChante = new Hologram(K, [-50, -26, 15], [{ id: 'haddad', x: 0, z: 0, yaw: -1.2 }]);
    R2s.group.add(this.holos.samirChante.group);
    this.interact.push({ id: 'samirChante', pos: new THREE.Vector3(-50, -25.2, 15), r: 2, label: 'Projecteur éteint', verb: 'Lire l\'enregistrement', enabled: () => true, act: () => this.api.playHolo('samirChante', this.holos.samirChante) });

    // ================= R3 · Vestiaire =================
    const R3 = this.room({ id: 'R3', x0: -74, z0: 2, x1: -62.3, z1: 14, y: -26, h: 5, wreck: true, lightColor: 0xffc890, openings: [{ side: 'e', c: 8, w: 2.4, h: 2.8 }] });
    const B3 = R3.builder, g3 = R3.group;
    this.door('dR2R3', 'R3', [-62.15, -26, 8], false, 'closed');
    Props.locker(K, B3, g3, this.ph, [-73.5, -26, 8], Math.PI / 2, 6);
    // combinaisons vides qui flottent
    const suitMat = M.paint(0xd06a2a, { wear: 0.6, dirt: 0.5, rough: 0.8, clearcoat: 0 });
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Group();
      const add = (geo: THREE.BufferGeometry, p: V3, mat: THREE.Material = suitMat) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.castShadow = true; s.add(m); };
      add(new THREE.CapsuleGeometry(0.22, 0.5, 6, 12), [0, 1.1, 0]); add(new THREE.SphereGeometry(0.2, 16, 12), [0, 1.7, 0], K.m.white);
      add(new THREE.SphereGeometry(0.15, 16, 10), [0, 1.7, 0.08], M.glossyBlack());
      for (const x of [-0.3, 0.3]) { add(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), [x, 1.0, 0]); add(new THREE.CapsuleGeometry(0.09, 0.6, 4, 8), [x * 0.5, 0.35, 0]); }
      s.position.set(-71 + (i % 3) * 2.6, -25.5 + (i % 2) * 0.8, 4 + Math.floor(i / 3) * 6);
      s.rotation.set(0.3 * i, i, 0.2);
      g3.add(s); this.suits.push(s);
    }
    this.scannables.push({ id: 's_comb', pos: new THREE.Vector3(-68, -24.5, 7), label: 'Combinaisons vides', clue: 'combinaisons' });
    // bottes magnétiques
    const bootsG = new THREE.Group(); bootsG.position.set(-72.6, -25, 11.5); bootsG.name = 'boots'; g3.add(bootsG);
    const bb = new Builder(); for (const x of [-0.15, 0.15]) { bb.add(bootsG, K.m.orange, rbox(0.14, 0.12, 0.26, 0.03), [x, 0.06, 0]); bb.add(bootsG, M.glow(0x5fe6ff, 3), rbox(0.15, 0.02, 0.2, 0.01, 1), [x, 0.005, 0]); } bb.build();
    this.interact.push({ id: 'boots', pos: new THREE.Vector3(-72.4, -25, 11.5), r: 1.8, label: 'Bottes magnétiques', verb: 'Installer', enabled: () => !F.boots, act: () => { F.boots = true; bootsG.visible = false; this.api.unlock('boots'); this.api.completeMission('m13', 'm13b'); } });
    B3.add(g3, K.m.trim, rbox(0.3, 2.6, 1.8, 0.04), [-73.85, -24.7, 4]);
    B3.add(g3, K.m.hazard, new THREE.PlaneGeometry(1.6, 0.14), [-73.69, -23.2, 4], [0, Math.PI / 2, 0]);
    this.interact.push({ id: 'sasExt', pos: new THREE.Vector3(-73.2, -25.2, 4), r: 1.8, label: 'Sas extérieur', verb: 'Sortir sur la coque', enabled: () => !!F.boots, act: () => this.exitToHull() });
    this.cp('R3', 'R3', [-63.6, -26, 8], -Math.PI / 2);
    this.objectivePos.m13 = new THREE.Vector3(-72.6, -24.6, 11.5);
    this.cp('X3', 'X', [-66, 0.05, 8], Math.PI / 2);
    this.ph.trigger([-74, -27, 2], [-62.3, -21, 14], { onEnter: () => { if (F.done_m12 !== true) this.api.completeMission('m12', 'm13'); } });

    // ================= R4 · Puits du réacteur (parois magnétiques) =================
    const R4 = this.room({ id: 'R4', x0: -10, z0: -10, x1: 10, z1: 10, y: -70, h: 44, mag: true, wreck: true, noCeiling: false, stripEvery: 8, lightColor: 0xff8a40,
      openings: [{ side: 's', c: 0, w: 3, h: 3.5, y: 36, frame: false }] });
    const B4 = R4.builder, g4 = R4.group;
    this.magRegions.push(new THREE.Box3(new THREE.Vector3(-10.5, -71, -10.5), new THREE.Vector3(10.5, -26, 10.5)));
    // cœur du réacteur
    this.ph.add([-2.5, -70, -2.5], [2.5, -26, 2.5], { tag: 'mag' });
    B4.add(g4, K.m.dark, bcyl(2.5, 44, 0.1, 40), [0, -48, 0]);
    for (let y = -68; y < -27; y += 2.5) B4.add(g4, this.coreMat, new THREE.TorusGeometry(2.52, 0.05, 8, 48), [0, y, 0], [Math.PI / 2, 0, 0]);
    // quatre anneaux de confinement désalignés
    const ringY = [-62, -54, -46, -38];
    const consoles: [V3, number][] = [[[0, 0, 9.7], Math.PI], [[9.7, 0, 0], -Math.PI / 2], [[0, 0, -9.7], 0], [[-9.7, 0, 0], Math.PI / 2]];
    ringY.forEach((y, i) => {
      const g = new THREE.Group(); g.position.set(0, y, 0);
      const rm = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.35, 12, 64), K.m.orange as THREE.Material); rm.castShadow = true;
      const rl = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.08, 8, 64), this.coreMat); rl.position.z = 0;
      g.add(rm, rl);
      const tilt = new THREE.Euler(Math.PI / 2 + 0.5 * (i % 2 ? 1 : -1), 0.3 * i, 0.4);
      g.rotation.copy(tilt); g4.add(g);
      this.rings.push({ mesh: g, tilt, aligned: false, k: 0 });
      const [cp, ry] = consoles[i];
      const pos: V3 = [cp[0], y, cp[2]];
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
      const out = new THREE.Vector3(0, 0, 0.35).applyQuaternion(q);
      B4.add(g4, K.m.trim, rbox(1.4, 1.2, 0.5, 0.04), pos, [0, ry, 0]);
      const scr = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.2) });
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), scr); sm.position.set(pos[0] + out.x * 0.75, y + 0.1, pos[2] + out.z * 0.75); sm.rotation.y = ry; g4.add(sm);
      sm.userData.ring = i; (this.rings[i] as unknown as { scr: THREE.MeshBasicMaterial }).scr = scr;
      this.interact.push({ id: 'ring' + i, pos: new THREE.Vector3(pos[0] + out.x * 2, y, pos[2] + out.z * 2), r: 2.4, label: `Anneau de confinement ${i + 1} sur 4`, verb: 'Réaligner', enabled: () => !this.rings[i].aligned, act: () => this.alignRing(i) });
    });
    this.scannables.push({ id: 's_anneaux', pos: new THREE.Vector3(0, -62, 4.4), label: 'Anneaux désalignés', clue: 'anneaux' });
    // zones irradiées (traverser vite)
    const rad = (min: V3, max: V3) => {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.2, 0.3), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const m = new THREE.Mesh(new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]), mat);
      m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2); g4.add(m);
      this.radZones.push({ box: new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)), mat });
    };
    rad([9, -60, -4], [10, -56, 4]); rad([-4, -50, -10], [4, -48, -9]); rad([-10, -44, -3], [-9, -40, 3]); rad([-3, -36, 9], [3, -33, 10]);
    // journal de Tomás, au fond
    B4.add(g4, K.m.dark, rbox(0.7, 0.5, 0.12, 0.03), [-6, -68.8, -9.85]);
    B4.add(g4, M.glow(0x40ff9a, 3), rbox(0.06, 0.03, 0.03, 0.01, 1), [-5.8, -68.7, -9.77]);
    this.interact.push({ id: 'tomas2', pos: new THREE.Vector3(-6, -69, -9.2), r: 1.8, label: 'Enregistreur de Tomás', verb: 'Écouter', enabled: () => true, act: () => this.api.playLog('tomas2') });
    for (let i = 0; i < 4; i++) this.beacon('R4', new THREE.Vector3([9.6, -9.6, 9.6, -9.6][i], -66 + i * 9, [9.6, 9.6, -9.6, -9.6][i]));
    this.reactorLight = this.pool.add(new THREE.Vector3(0, -48, 0), 0xffa040, 0, 22, 'R4', 'neon', 0);
    this.cp('R4', 'R4', [0, -70, -7], 0);
    this.objectivePos.m14 = new THREE.Vector3(0, -62, 9);

    // ================= R5 · Poste de commandement =================
    const R5 = this.room({ id: 'R5', x0: -10, z0: 10.3, x1: 10, z1: 26, y: -34, h: 6, skip: ['n'], wreck: true, lightColor: 0xffb070, openings: [{ side: 'e', c: 18, w: 2.4, h: 2.8 }] });
    const B5 = R5.builder, g5 = R5.group;
    for (const [x, z, ry] of [[-7, 24.6, 0], [0, 24.6, 0], [7, 24.6, 0], [-8.6, 17, Math.PI / 2]] as const) Props.console(K, B5, g5, this.ph, [x, -34, z], ry);
    B5.add(g5, K.m.dark, bcyl(1.2, 1.0, 0.05, 30), [0, -33.5, 18]);
    this.ph.add([-1.2, -34, 16.8], [1.2, -33, 19.2]);
    this.holos.commandement = new Hologram(K, [0, -34, 18.5], [
      { id: 'haddad', x: -1.4, z: -0.8, yaw: 0.6 }, { id: 'varga', x: 0, z: 0.6, yaw: 3.1 }, { id: 'mori', x: 1.6, z: -0.4, yaw: -0.9 },
      { id: 'reyes', x: -2.2, z: 1.2, yaw: 2.2 }, { id: 'fontaine', x: -2.8, z: 0.4, yaw: 1.8 }, { id: 'achebe', x: 2.4, z: 1.3, yaw: -2.4 },
    ]);
    g5.add(this.holos.commandement.group);
    this.interact.push({ id: 'commandement', pos: new THREE.Vector3(0, -33.2, 15.6), r: 2.4, label: 'Enregistrements de bord', verb: 'Lire', enabled: () => true,
      act: () => this.api.playHolo('commandement', this.holos.commandement, () => { if (!F.m15done) { F.m15done = true; this.doors.dR5R6.setState('closed'); this.api.completeMission('m15', 'm16'); } }) });
    B5.add(g5, K.sign('POSTE DE COMMANDEMENT', 'ASTERION', 1024, 256, '#ffcf9a'), new THREE.PlaneGeometry(3, 0.75), [0, -29.3, 25.98], [0, Math.PI, 0]);
    this.door('dR5R6', 'R5', [10.15, -34, 18], false, 'locked');
    this.beacon('R5', new THREE.Vector3(9.6, -28.6, 25.6));
    this.cp('R5', 'R5', [0, -34, 11.6], 0);
    this.objectivePos.m15 = new THREE.Vector3(0, -33, 15.6);
    this.ph.trigger([-10, -35, 10.3], [10, -29, 26], { onEnter: () => { if (F.done_m14 && !F.done_m15) this.api.setObjective('m15'); } });

    // ================= R6 · Baie des capsules =================
    const R6 = this.room({ id: 'R6', x0: 10.3, z0: 10.3, x1: 34, z1: 26, y: -34, h: 8, skip: ['w'], wreck: true, lightColor: 0xffb070,
      openings: [{ side: 'e', c: 18, w: 12, h: 6, y: 1, frame: false }] });
    const B6 = R6.builder, g6 = R6.group;
    for (let i = 0; i < 4; i++) { const x = 13 + i * 4.5; B6.add(g6, K.m.dark, bcyl(1.4, 0.3, 0.05, 24), [x, -33.85, 25]); B6.add(g6, K.m.hazard, new THREE.RingGeometry(1.4, 1.7, 24), [x, -33.98, 25], [-Math.PI / 2, 0, 0]); }
    // capsule endommagée
    const capMat = M.paint(0xd8d8d0, { wear: 1.1, scratches: 0.5, dirt: 0.5, rough: 0.5 });
    const cb = new Builder();
    cb.add(this.capsule, capMat, lathe([[0, 2.4], [0.7, 2.2], [1.25, 1.2], [1.4, 0.2], [1.35, 0], [0, 0]], 32));
    cb.add(this.capsule, K.m.orange, rbox(0.9, 1.3, 0.2, 0.05), [0, 1.0, 1.3], [0.15, 0, 0]);
    cb.add(this.capsule, burnt, bcyl(1.45, 0.25, 0.05, 32), [0, 0.1, 0]);
    cb.add(this.capsule, M.glossyBlack(), new THREE.CircleGeometry(0.35, 24), [0, 1.6, 0.98], [-0.6, 0, 0]);
    cb.build();
    for (const x of [-0.6, 0.6]) { const f = new Flame(1.6, 0.35); f.position.set(x, 0, 0); this.capsule.add(f); this.capFlames.push(f); }
    this.capsule.position.set(30.5, -34, 23.5);
    g6.add(this.capsule);
    this.ph.add([29, -34, 22], [32, -31.6, 25]);
    this.interact.push({ id: 'capsule', pos: new THREE.Vector3(30.5, -33.2, 21.6), r: 2.2, label: 'Capsule de descente', verb: 'Réparer et embarquer',
      enabled: () => this.partsFound() === 3, act: () => this.launchCapsule() });
    this.interact.push({ id: 'capsuleCheck', pos: new THREE.Vector3(30.5, -33.2, 21.6), r: 2.2, label: 'Capsule endommagée', verb: 'Inspecter',
      enabled: () => this.partsFound() < 3 && !F.capChecked, act: () => { F.capChecked = true; this.api.toast('Capsule endommagée', 'Il manque trois pièces. Les capsules détruites flottent à l\'extérieur.'); this.api.setObjective('m16b'); } });
    B6.add(g6, K.m.dark, rbox(0.3, 0.02, 0.22, 0.01), [27, -33.18, 24.6]);
    B6.add(g6, new THREE.MeshBasicMaterial({ color: 0x0a1016 }), new THREE.PlaneGeometry(0.26, 0.18), [27, -33.165, 24.6], [-Math.PI / 2, 0, 0]);
    Props.table(K, B6, g6, this.ph, [27, -34, 24.6], 1.4, 0.8);
    this.interact.push({ id: 'lea2', pos: new THREE.Vector3(27, -33.2, 23.6), r: 1.8, label: 'Carnet de Léa', verb: 'Lire', enabled: () => true, act: () => this.api.playLog('lea2') });
    this.beacon('R6', new THREE.Vector3(33.6, -27, 11));
    this.cp('R6', 'R6', [11.6, -34, 18], -Math.PI / 2);
    this.objectivePos.m16 = new THREE.Vector3(30.5, -32.5, 21.6);
    this.objectivePos.m16c = new THREE.Vector3(30.5, -32.5, 21.6);

    // ================= X2 · Épave extérieure (apesanteur + tempêtes) =================
    const XB = new Builder();
    this.zeroGRegions.push(new THREE.Box3(new THREE.Vector3(34.6, -60, -10), new THREE.Vector3(90, 0, 50)));
    const chunk = (min: V3, max: V3) => this.plate(XB, this.exterior, burnt, min, max);
    chunk([40, -36, 10], [43, -30, 18]); chunk([48, -30, 20], [51, -22, 30]); chunk([56, -42, 4], [59, -34, 12]); chunk([44, -44, 26], [47, -38, 34]); chunk([52, -24, 6], [55, -20, 12]);
    const partSpots: V3[] = [[44, -32, 14], [52, -26, 25], [60, -38, 8]];
    partSpots.forEach((p, i) => {
      const g = new THREE.Group(); g.position.set(...p); g.name = 'part' + i;
      const wreck = new THREE.Mesh(lathe([[0, 1.6], [0.6, 1.4], [1.0, 0.6], [1.1, 0], [0, 0]], 20), burnt); wreck.rotation.set(1.2 * i, i, 0.6); wreck.position.set(-1.4, 0, 0); g.add(wreck);
      const part = new THREE.Mesh(rbox(0.4, 0.3, 0.3, 0.05), K.m.orange as THREE.Material); g.add(part);
      const glowM = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 8, 32), M.glow(0x5fe6ff, 3)); g.add(glowM);
      this.exterior.add(g); this.parts.push(g);
      this.interact.push({ id: 'part' + i, pos: new THREE.Vector3(...p), r: 2.0, label: `Pièce de capsule ${i + 1} sur 3`, verb: 'Récupérer', enabled: () => !F['part' + i], act: () => this.takePart(i) });
    });
    XB.build();
    this.storms.push({ period: 14, t: 0, dir: new THREE.Vector3(-1, 0, 0), region: new THREE.Box3(new THREE.Vector3(34.6, -60, -10), new THREE.Vector3(90, 0, 50)), rooms: ['X2'], state: 'calm' });
    this.objectivePos.m16b = new THREE.Vector3(...partSpots[0]);
    this.cp('X2', 'R6', [32, -34, 18], -Math.PI / 2);

    // rochers de la tempête (instanciés)
    this.rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.25, 0), burnt, 120);
    this.rocks.frustumCulled = false; this.rocks.count = 0;
    this.root.add(this.rocks);

    // triggers d'entrée de pièce
    for (const [id, r] of Object.entries(this.rooms)) {
      const s = r.spec;
      this.ph.trigger([s.x0, s.y - 0.5, s.z0], [s.x1, s.y + s.h, s.z1], { onEnter: () => { this.current = id; this.api.enterRoom(id); } });
    }
    this.ph.trigger([-90, -0.5, -40], [60, 60, 50], { onEnter: () => { this.current = 'X'; this.api.enterRoom('X'); } });
    this.ph.trigger([34, -60, -10], [90, 0, 50], { onEnter: () => { this.current = 'X2'; this.api.enterRoom('X2'); } });
    const cpT = (id: string, min: V3, max: V3) => this.ph.trigger(min, max, { onEnter: () => this.api.checkpoint(id) });
    cpT('R2', [-33, -27, 5], [-30.3, -22, 11]); cpT('R3', [-66, -27, 2], [-62.3, -22, 14]); cpT('R5', [-10, -35, 10.3], [10, -30, 14]); cpT('R6', [10.3, -35, 10.3], [14, -30, 26]);
    // hors limites (dérive dans le vide)
    this.ph.trigger([-400, -400, -400], [400, -120, 400], { onEnter: () => this.api.kill('Perdu dans le vide') });

    for (const r of Object.values(this.rooms)) r.builder.build();
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !m.castShadow) { const mat = m.material as THREE.Material; if (!mat.transparent && !(mat as THREE.MeshBasicMaterial).isMeshBasicMaterial && !(mat as THREE.ShaderMaterial).isShaderMaterial) m.castShadow = true; } });
    for (const id of Object.keys(this.rooms)) this.setRoomLight(id, id === 'R4' ? 0.15 : id === 'R2s' ? 0 : 0.35);
    this.buildSurface();
  }

  // ---------- missions ----------
  setRoomLight(id: string, lvl: number) {
    const r = this.rooms[id]; if (!r) return;
    for (const l of r.lights) l.level = lvl;
    this.kit.strip(id).color.copy(new THREE.Color(r.spec.lightColor ?? 0xff9a60)).multiplyScalar(lvl * 3.2);
  }
  partsFound() { return [0, 1, 2].filter((i) => this.api.flags['part' + i]).length; }
  takePart(i: number) {
    this.api.flags['part' + i] = true; this.parts[i].visible = false;
    const n = this.partsFound();
    this.audio.beep('happy'); this.api.toast(`Pièce ${n} sur 3 récupérée`, n < 3 ? 'Attention aux vagues de débris.' : 'Retourne à la capsule.');
    if (n < 3) this.objectivePos.m16b = this.parts[[0, 1, 2].find((k) => !this.api.flags['part' + k])!].position.clone();
    else this.api.setObjective('m16c');
    this.api.saveNow();
  }
  alignRing(i: number) {
    const r = this.rings[i]; r.aligned = true;
    this.audio.door(r.mesh.position.clone(), true); this.audio.land(r.mesh.position.clone(), 1);
    const n = this.rings.filter((x) => x.aligned).length;
    this.api.flags['ring' + i] = true;
    this.api.toast(`Anneau ${n} sur 4 aligné`, n < 4 ? 'Monte le long des parois jusqu\'au suivant.' : 'Séquence d\'allumage du réacteur…');
    if (n < 4) this.objectivePos.m14 = this.ringTarget();
    else { this.reactorT = 0; this.audio.powerUp(); this.api.flags.reactor = true; this.api.completeMission('m14', 'm15'); }
    this.api.saveNow();
  }
  private ringTarget() {
    const i = this.rings.findIndex((r) => !r.aligned);
    const it = this.interact.find((x) => x.id === 'ring' + i);
    return it ? it.pos.clone() : new THREE.Vector3(0, -34, 10.3);
  }
  exitToHull() {
    this.api.cinematic([{ pos: [-73, -24.5, 6], look: [-73.8, -24.5, 4], dur: 1.2 }], () => {
      this.onTeleport?.('X3');
      this.api.toast('Sur la coque', 'Les bottes te gardent collé au métal. Marche vers la tour du réacteur : tu peux monter sur ses parois.');
    });
  }
  enterReactor() {
    this.onTeleport?.('R4');
    this.api.toast('Puits du réacteur', 'Les parois sont magnétiques : marche dessus pour atteindre chaque anneau.');
    this.api.setObjective('m14');
    this.objectivePos.m14 = this.ringTarget();
  }
  launchCapsule() {
    this.api.flags.descent = true;
    this.descentT = 0;
    this.audio.powerUp();
    this.api.setObjective('m17');
    // la capsule quitte l'épave et plonge vers la planète
    this.capsule.removeFromParent(); this.exterior.add(this.capsule);
    this.capsule.position.set(36, -30, 18); this.capsule.rotation.set(0, 0, -Math.PI / 2);
    this.api.cinematic([
      { pos: [44, -24, 30], look: [36, -30, 18], to: [50, -22, 34], lookTo: [44, -32, 18], dur: 4, fov: 50 },
      { pos: [60, -44, 40], look: [60, -64, 18], to: [64, -64, 44], lookTo: [70, -114, 18], dur: 6, fov: 45, shake: 0.3 },
      { pos: [22, -1800, 26], look: [0, -1720, 0], to: [18, -1850, 18], lookTo: [0, -1930, -28], dur: 7, fov: 55, shake: 1 },
      { pos: [30, -1955, 40], look: [0, -1975, -40], to: [6, -1980, 10], lookTo: [-20, -1984, -80], dur: 8, fov: 60, shake: 0.1 },
    ], () => this.api.endOfZone());
  }

  /** Paysage nocturne de la planète, vu à la fin de la descente. */
  private buildSurface() {
    const g = this.surface; g.visible = false;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800, 64, 64), new THREE.MeshStandardMaterial({ color: 0x07100c, roughness: 0.9 }));
    const pos = ground.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 0.03) * 6 + Math.cos(pos.getY(i) * 0.025) * 8);
    ground.geometry.computeVertexNormals(); ground.rotation.x = -Math.PI / 2; ground.position.y = -2000; g.add(ground);
    const n = 3000, gp = new Float32Array(n * 3), gc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 700, z = (Math.random() - 0.5) * 700;
      gp.set([x, -2000 + Math.sin(x * 0.03) * 6 + Math.cos(-z * 0.025) * 8 + 1 + Math.random() * 3, z], i * 3);
      const c = Math.random() < 0.6 ? [0.1, 1.6, 0.8] : [0.9, 0.3, 1.8]; gc.set(c, i * 3);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(gp, 3)); geo.setAttribute('color', new THREE.BufferAttribute(gc, 3));
    this.glowPts = new THREE.PointsMaterial({ size: 0.6, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    g.add(new THREE.Points(geo, this.glowPts));
    // forêts : troncs et frondaisons sombres, lueurs bioluminescentes
    const trunk = new THREE.MeshStandardMaterial({ color: 0x0b0f0c, roughness: 1 });
    const crown = new THREE.MeshStandardMaterial({ color: 0x06120e, roughness: 0.95, emissive: new THREE.Color(0.0, 0.025, 0.02) });
    const tg = new THREE.ConeGeometry(2.5, 9, 7), cg = new THREE.CylinderGeometry(0.25, 0.4, 4, 6);
    const ti = new THREE.InstancedMesh(tg, crown, 500), ci = new THREE.InstancedMesh(cg, trunk, 500);
    const mm = new THREE.Matrix4();
    for (let i = 0; i < 500; i++) {
      const x = (Math.random() - 0.5) * 500, z = -40 - Math.random() * 400, h = -2000 + Math.sin(x * 0.03) * 6 + Math.cos(-z * 0.025) * 8, s = 0.6 + Math.random() * 1.2;
      if (Math.abs(x + 20) < 10 && Math.abs(z + 80) < 14) continue;
      mm.compose(new THREE.Vector3(x, h + 6 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); ti.setMatrixAt(i, mm);
      mm.compose(new THREE.Vector3(x, h + 1.5 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); ci.setMatrixAt(i, mm);
    }
    g.add(ti, ci);
    // nappes de nuages traversées pendant la descente
    this.glowPts.map = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d')!; const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
    const cloudTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!; const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    for (let i = 0; i < 60; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: new THREE.Color(0.25, 0.3, 0.35), transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
      sp.position.set((Math.random() - 0.5) * 160, -1820 - Math.random() * 60, -20 + (Math.random() - 0.5) * 160); sp.scale.setScalar(40 + Math.random() * 50); g.add(sp);
    }
    // halo de rentrée atmosphérique autour de la capsule
    this.heat = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.4, 0.3), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.heat.visible = false; this.capsule.add(this.heat);
    for (const [x, y, z, r] of [[-300, 260, -500, 30], [200, 180, -600, 18]] as const) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.4, 1.5), fog: false })); m.position.set(x, y - 2000, z); g.add(m); }
  }

  // ---------- état sauvegardé ----------
  applyFlags() {
    const F = this.api.flags;
    if (F.boots) { const b = this.root.getObjectByName('boots'); if (b) b.visible = false; }
    this.rings.forEach((r, i) => { if (F['ring' + i]) { r.aligned = true; r.k = 1; } });
    if (F.reactor) { this.reactorT = 99; }
    if (F.m15done) this.doors.dR5R6.setState('closed');
    for (let i = 0; i < 3; i++) if (F['part' + i]) this.parts[i].visible = false;
    if (this.rings.some((r) => !r.aligned)) this.objectivePos.m14 = this.ringTarget();
  }
  revealFootprints() { /* pas d'empreintes dans l'épave */ }

  env(p: THREE.Vector3) {
    let forcedUp: { axis: Axis; sign: number } | null = null;
    if (this.gravity.region.containsPoint(p)) forcedUp = { axis: 'y', sign: this.gravity.inverted ? -1 : 1 };
    const zeroG = this.zeroGRegions.some((b) => b.containsPoint(p));
    const magnetic = this.magRegions.some((b) => b.containsPoint(p));
    return { zeroG, forcedUp, magnetic };
  }

  visibleRooms() {
    const s = new Set<string>([this.current]);
    for (const n of this.adj[this.current] ?? []) { s.add(n); for (const m of this.adj[n] ?? []) s.add(m); }
    return s;
  }

  titleCamera(t: number, cam: THREE.PerspectiveCamera) {
    const a = t * 0.03;
    cam.up.set(0, 1, 0);
    cam.position.set(60 + Math.sin(a) * 20, 30 + Math.sin(a * 0.7) * 5, 70 + Math.cos(a) * 10);
    cam.lookAt(-20, -10, 0);
    this.current = 'X';
  }

  update(dt: number, t: number, playerPos: THREE.Vector3, playerBox: (b: THREE.Box3) => boolean, gameplay = true) {
    const F = this.api.flags;
    const vis = this.visibleRooms();
    const inDescent = this.descentT > 10;
    for (const [id, r] of Object.entries(this.rooms)) r.group.visible = (vis.has(id) || this.current === 'X' && id === 'R1') && !inDescent;
    this.hull.visible = !inDescent; this.root.visible = !inDescent;
    this.surface.visible = inDescent;
    if (inDescent && this.capsule.parent !== this.surface) { this.surface.add(this.capsule); const fog = this.scene.fog as THREE.FogExp2; fog.color.set(0x050b0a); fog.density = 0.004; }
    for (const f of this.floaters) f.o.visible = !inDescent;
    for (const p of this.parts) if (inDescent) p.visible = false;

    // amarrage : la navette arrive et se pose de travers
    if (this.dockT >= 0 && this.dockT < 7) {
      this.dockT += dt;
      const k = Math.min(1, this.dockT / 6), e = 1 - Math.pow(1 - k, 3);
      this.shuttle.group.position.set(24 + 50 * (1 - e), 1.2 + 26 * (1 - e), 8 + 40 * (1 - e));
      this.shuttle.group.rotation.set(0.12 * e, -2.4 - 0.6 * (1 - e), -0.2 * e);
      if (k >= 1 && this.dockT - dt < 6) { this.audio.land(this.shuttle.group.position.clone(), 2); this.api.rumble?.(0.9, 0.9, 500); this.sparks.emit(new THREE.Vector3(22, 0.5, 6), new THREE.Vector3(0, 3, 0), 40, 0.05, new THREE.Color(4, 2, 0.6), 2); }
    }

    const outTarget = ['X', 'X2'].includes(this.current) ? 1 : this.current === 'R1' ? 0.4 : this.current === 'R6' ? 0.25 : 0;
    this.outside += (outTarget - this.outside) * Math.min(1, dt * 2);
    this.sun.intensity = 1.6 * this.outside; this.bounce.intensity = 0.9 * this.outside;
    // éclairs lointains de la planète
    this.nextFlash -= dt;
    if (this.nextFlash < 0) { this.flash = 1; this.nextFlash = 2 + Math.random() * 6; this.audio.land(undefined, 0.3); }
    this.flash = Math.max(0, this.flash - dt * 3);
    this.lightning.intensity = (this.flash > 0.5 || (this.flash > 0.2 && Math.random() < 0.5) ? 5 : 0) * this.flash * Math.max(0.15, this.outside);

    // gravité folle : bascule toutes les 4,5 s, avertissement 1 s avant
    const g = this.gravity;
    g.t += dt;
    const P = 4.5;
    if (g.t > P) { g.t = 0; g.inverted = !g.inverted; if (vis.has('R2')) { this.audio.door(new THREE.Vector3(-46, -23, 8), true); this.api.rumble?.(0.4, 0.4, 200); } }
    g.warn = g.t > P - 1;
    const lampOn = g.warn ? (Math.sin(t * 20) > 0 ? 1 : 0.1) : 0.3;
    this.gravLamps.color.setRGB(3, 1.2, 0.1).multiplyScalar(lampOn);

    // tempêtes de débris
    let alert: string | null = null;
    let rockN = 0;
    const m4 = new THREE.Matrix4();
    for (const s of this.storms) {
      const active = s.rooms.includes(this.current);
      s.t = (s.t + dt) % s.period;
      const prev = s.state;
      s.state = s.t > s.period - 3 ? 'wave' : s.t > s.period - 6.5 ? 'warn' : 'calm';
      if (!active) continue;
      if (s.state === 'warn') { alert = 'Tempête de débris imminente — mets-toi à l\'abri'; if (prev === 'calm') { this.audio.loop('storm', 'jet', playerPos.clone(), 0); } this.audio.setLoop('storm', 0.25); }
      if (s.state === 'wave') {
        alert = 'Tempête de débris !';
        this.audio.setLoop('storm', 0.9);
        this.api.rumble?.(0.3, 0.6, 100);
        // rochers qui traversent
        for (let i = 0; i < 70; i++) {
          const k = ((t * 1.7 + i * 0.137) % 1);
          const base = new THREE.Vector3().lerpVectors(s.region.min, s.region.max, 0.5);
          const size = s.region.getSize(new THREE.Vector3());
          const off = new THREE.Vector3(((i * 7.31) % 1) - 0.5, ((i * 3.77) % 1) - 0.5, ((i * 5.13) % 1) - 0.5).multiply(size);
          const pos = base.clone().add(off).addScaledVector(s.dir, (k - 0.5) * size.dot(new THREE.Vector3(Math.abs(s.dir.x), Math.abs(s.dir.y), Math.abs(s.dir.z))));
          m4.compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(t * 3 + i, i, t)), new THREE.Vector3(1, 1, 1).multiplyScalar(0.6 + (i % 4) * 0.5));
          if (rockN < 120) this.rocks.setMatrixAt(rockN++, m4);
        }
        if (Math.random() < 0.8) { const p = playerPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 16)).addScaledVector(s.dir, -10); this.debris.emit(p, s.dir.clone().multiplyScalar(30), 1, 0.03, new THREE.Color(0.5, 0.4, 0.35), 1); }
        // exposé ? on lance un rayon vers la source
        if (gameplay && s.region.containsPoint(playerPos)) {
          const from = playerPos.clone().add(new THREE.Vector3(0, 0.6, 0));
          const hit = this.ph.raycast(from, s.dir.clone().negate(), 60, true);
          if (!hit) this.api.kill('Frappé par la tempête de débris');
        }
      }
      if (s.state === 'calm' && prev === 'wave') this.audio.setLoop('storm', 0);
    }
    this.rocks.count = rockN; this.rocks.instanceMatrix.needsUpdate = true;
    this.api.alert(alert);

    // radiations
    let inRad = false;
    for (const z of this.radZones) { z.mat.opacity = 0.25 + Math.sin(t * 6) * 0.1; if (gameplay && playerBox(z.box)) inRad = true; }
    this.exposure = inRad ? this.exposure + dt / 2.2 : Math.max(0, this.exposure - dt * 0.6);
    this.api.radiation(this.exposure);
    if (inRad && Math.random() < 0.3) this.audio.spark(playerPos, 0.15);
    if (this.exposure >= 1) { this.exposure = 0; this.api.kill('Dose de radiation mortelle'); }

    // réacteur
    for (const r of this.rings) {
      r.k += ((r.aligned ? 1 : 0) - r.k) * Math.min(1, dt * 1.5);
      const target = new THREE.Euler(Math.PI / 2, 0, 0);
      r.mesh.rotation.set(THREE.MathUtils.lerp(r.tilt.x, target.x, r.k), THREE.MathUtils.lerp(r.tilt.y, 0, r.k), THREE.MathUtils.lerp(r.tilt.z, 0, r.k) + (r.aligned ? 0 : Math.sin(t * 0.7) * 0.05));
      const scr = (r as unknown as { scr: THREE.MeshBasicMaterial }).scr;
      scr.color.setRGB(r.aligned ? 0.3 : 3, r.aligned ? 3 : 1.0, r.aligned ? 0.8 : 0.2).multiplyScalar(Math.sin(t * 4) > 0 || r.aligned ? 1 : 0.4);
    }
    if (this.reactorT >= 0) {
      this.reactorT += dt;
      const k = Math.min(1, this.reactorT / 4);
      this.coreMat.color.setRGB(3, 1.4, 0.3).multiplyScalar(k * (1.5 + Math.sin(t * 3) * 0.3));
      if (this.reactorLight) { this.reactorLight.level = k; this.reactorLight.intensity = 40; }
      if (this.reactorT < 4) this.api.rumble?.(0.4 * k, 0.6, 60);
      for (const id of ['R4', 'R5', 'R6', 'R1', 'R2', 'R3']) this.setRoomLight(id, 0.35 + 0.5 * k);
      if (this.reactorT > 3 && !this.powered) { this.powered = true; this.audio.setPowered(true); }
    }
    for (const b of this.beacons) { const on = Math.sin(t * 4) > 0 ? 1 : 0.15; b.mat.color.setRGB(3 * on + 0.1, (this.powered ? 1.2 : 0.2) * on, 0.05); b.mesh.rotation.y = t * 4; }
    for (const e of this.emergency) e.level = 0.55 + 0.45 * Math.sin(t * 4);

    // objets flottants, combinaisons
    for (const f of this.floaters) { f.o.position.addScaledVector(f.v, dt); f.o.rotation.x += f.w.x * dt; f.o.rotation.y += f.w.y * dt; }
    this.suits.forEach((s, i) => { s.position.y += Math.sin(t * 0.5 + i) * dt * 0.08; s.rotation.y += dt * 0.05 * (i % 2 ? 1 : -1); s.rotation.z = Math.sin(t * 0.3 + i) * 0.4; });
    for (const p of this.parts) p.rotation.y = t * 0.5;

    // descente
    if (this.descentT >= 0) {
      this.descentT += dt;
      const d = this.descentT;
      if (d < 10) {
        this.capsule.position.set(36 + d * d * 0.6, -30 - d * d * 1.4, 18);
        for (const f of this.capFlames) { f.power = Math.min(1, Math.max(0, (d - 5) / 3)); f.update(t); }
        if (d > 6) this.api.rumble?.(0.5, 0.7, 80);
      } else if (d < 17) {
        // rentrée atmosphérique : flammes, secousses, traversée des nuages
        const k = (d - 10) / 7, e = k * k * (3 - 2 * k);
        this.capsule.position.set(0, -1720 - 210 * e, -28 * e);
        this.capsule.rotation.set(0, 0, 0);
        for (const f of this.capFlames) { f.power = 1; f.update(t); }
        this.heat.visible = true; (this.heat.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - e);
        this.api.rumble?.(0.8 * (1 - e), 0.9, 80);
      } else {
        this.heat.visible = false;
        this.capsule.position.set(-20, -1983, -80); this.capsule.rotation.set(0.2, 0.5, 0.15);
        for (const f of this.capFlames) f.power = 0;
      }
    }

    this.sparks.update(dt); this.debris.update(dt); this.dust.update(dt);
    for (const d of Object.values(this.doors)) d.update(dt, playerPos, (open) => this.audio.door(d.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), open));
    for (const h of Object.values(this.holos)) h.update(dt, t);
    if (gameplay) this.ph.updateTriggers(playerPos.clone().add(new THREE.Vector3(0, 0.3, 0)), dt);
    this.pool.update(playerPos, dt, vis);
    void F;
  }
}
