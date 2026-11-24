import * as THREE from 'three';
import { Flame, ScanWave, ScanBeam } from '../fx/robotfx';
import { smoothNoise } from './parts';

// Squelette commun à tous les robots + système d'animation procédurale.
// Chaque « action » calcule une pose (rotations / décalages des articulations) ;
// les poses sont fondues entre elles pour des transitions douces.

export type ActionId = 'idle' | 'walk' | 'jump' | 'jetpack' | 'float' | 'scan' | 'roll' | 'fall';
export type Pose = Record<string, number[]>;

export const ACTION_LABELS: Record<ActionId, string> = {
  idle: 'Attente', walk: 'Marche', jump: 'Saut', jetpack: 'Jetpack', float: 'Apesanteur', scan: 'Scan', roll: 'Rouler', fall: 'Chute',
};

export interface Gait {
  stride: number; knee: number; armSwing: number; bob: number; period: number; elbow: number;
}

const JOINTS = ['hips', 'torso', 'head', 'armL', 'armR', 'foreL', 'foreR', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR', 'antenna', 'pack'] as const;
export type JointName = typeof JOINTS[number] | string;

function addP(p: Pose, k: string, x = 0, y = 0, z = 0) {
  const v = p[k] ?? (p[k] = [0, 0, 0]);
  v[0] += x; v[1] += y; v[2] += z;
}
function setS(p: Pose, k: string, v: number) { p[k] = [v, 0, 0]; }

export abstract class Robot extends THREE.Group {
  readonly rid: string;
  readonly title: string;
  readonly tagline: string;
  readonly actions: ActionId[] = ['idle', 'walk', 'jump', 'jetpack', 'float', 'scan'];
  rig = new THREE.Group();
  j: Record<string, THREE.Object3D> = {};
  protected rest = new Map<THREE.Object3D, { r: THREE.Euler; p: THREE.Vector3 }>();
  protected gait: Gait = { stride: 0.42, knee: 0.75, armSwing: 0.45, bob: 0.018, period: 0.95, elbow: -0.35 };

  action: ActionId = 'idle';
  private weights = new Map<ActionId, number>([['idle', 1]]);
  private clocks = new Map<ActionId, number>([['idle', 0]]);
  protected pose: Pose = {};
  private tmp: Pose = {};

  flames: Flame[] = [];
  wave = new ScanWave();
  beam = new ScanBeam();
  light: THREE.PointLight | null = null;
  protected blinkT = 2;
  protected blink = 0;
  protected eyeColor = new THREE.Color(0.25, 1.6, 2.6);
  private lastScanPhase = 0;
  /** Pour l'atelier : intensité du halo de sélection. */
  focus = 0;
  /** En jeu : la physique gère la position, on ignore les déplacements de la pose. */
  gameMode = false;
  /** En jeu : allure de marche (adapte la cadence). */
  walkSpeed = 1;
  /** En jeu : vitesse réelle au sol (m/s). Si > 0, la cadence des pas suit cette vitesse (pieds qui ne glissent pas). */
  groundSpeed = 0;
  /** Longueur de jambe (hanche → cheville), pour caler les pas. */
  protected legLength = 0.33;

  constructor(id: string, title: string, tagline: string) {
    super();
    this.rid = id; this.title = title; this.tagline = tagline;
    this.add(this.rig);
  }

  /** Crée une articulation nommée, enfant d'une autre. */
  protected joint(name: string, parent: THREE.Object3D, pos: [number, number, number]) {
    const g = new THREE.Group();
    g.name = name; g.position.set(...pos);
    parent.add(g);
    this.j[name] = g;
    return g;
  }

  protected captureRest() {
    this.rig.traverse((o) => this.rest.set(o, { r: o.rotation.clone(), p: o.position.clone() }));
  }

  protected addJet(parent: THREE.Object3D, pos: [number, number, number], len = 0.26, rad = 0.032) {
    const f = new Flame(len, rad);
    f.position.set(...pos);
    parent.add(f);
    this.flames.push(f);
  }

  /** Position de la lumière d'accent (près des propulseurs / du visage). */
  protected lightAnchor: { parent: string; pos: [number, number, number] } = { parent: 'torso', pos: [0, 0.0, -0.3] };

  enableLight(on: boolean) {
    if (on && !this.light) {
      this.light = new THREE.PointLight(0x66ccff, 0, 2.5, 2);
      this.light.castShadow = false;
      this.light.position.set(...this.lightAnchor.pos);
      (this.j[this.lightAnchor.parent] ?? this.rig).add(this.light);
    }
  }

  setAction(a: ActionId, restart = false) {
    if (a === this.action) { if (restart) this.clocks.set(a, 0); return; }
    this.action = a;
    this.clocks.set(a, 0);
    if (!this.weights.has(a)) this.weights.set(a, 0);
  }

  // ---------- poses génériques (bipède) ----------

  protected poseIdle(t: number, p: Pose) {
    const br = Math.sin(t * Math.PI * 2 * 0.22);
    addP(p, 'torso', br * 0.018, 0, 0);
    addP(p, 'p.torso', 0, br * 0.004, 0);
    addP(p, 'head', smoothNoise(t * 0.22, 1) * 0.16 - 0.02, smoothNoise(t * 0.18, 2) * 0.7, smoothNoise(t * 0.15, 3) * 0.1);
    addP(p, 'armL', smoothNoise(t * 0.3, 4) * 0.05, 0, 0.07 + br * 0.025);
    addP(p, 'armR', smoothNoise(t * 0.3, 5) * 0.05, 0, -0.07 - br * 0.025);
    addP(p, 'foreL', -0.18, 0, 0); addP(p, 'foreR', -0.18, 0, 0);
    addP(p, 'antenna', smoothNoise(t * 0.8, 6) * 0.08, 0, smoothNoise(t * 0.7, 7) * 0.1);
  }

  protected poseWalk(t: number, p: Pose) {
    const g = this.gait;
    const ph = (t / g.period) * Math.PI * 2;
    const s = Math.sin(ph), c = Math.cos(ph);
    addP(p, 'legL', -s * g.stride, 0, 0);
    addP(p, 'legR', s * g.stride, 0, 0);
    addP(p, 'shinL', Math.max(0, c) * g.knee + 0.08, 0, 0);
    addP(p, 'shinR', Math.max(0, -c) * g.knee + 0.08, 0, 0);
    // pied : se pose à plat (compense cuisse + genou), décolle du talon en fin d'appui, pointe relevée en l'air
    const rollL = Math.max(0, -s) * Math.max(0, -c) * 0.55, rollR = Math.max(0, s) * Math.max(0, c) * 0.55;
    addP(p, 'footL', s * g.stride - Math.max(0, c) * g.knee - 0.08 + rollL - Math.max(0, c) * 0.25, 0, 0);
    addP(p, 'footR', -s * g.stride - Math.max(0, -c) * g.knee - 0.08 + rollR - Math.max(0, -c) * 0.25, 0, 0);
    addP(p, 'p.hips', 0, -Math.abs(Math.cos(ph)) * g.bob * -1 - g.bob, 0);
    addP(p, 'hips', 0, s * 0.06, Math.sin(ph) * 0.035);
    addP(p, 'torso', 0.06, -s * 0.1, -Math.sin(ph) * 0.02);
    addP(p, 'armL', s * g.armSwing, 0, 0.08);
    addP(p, 'armR', -s * g.armSwing, 0, -0.08);
    addP(p, 'foreL', g.elbow + Math.min(0, s) * 0.2, 0, 0);
    addP(p, 'foreR', g.elbow + Math.min(0, -s) * 0.2, 0, 0);
    addP(p, 'head', -0.04 + Math.sin(ph * 2) * 0.02, s * 0.08, 0);
    addP(p, 'antenna', Math.sin(ph * 2 + 1) * 0.12, 0, Math.sin(ph) * 0.08);
  }

  protected poseJump(t: number, p: Pose) {
    const T = 1.9, tt = t % T;
    const ease = (x: number) => x * x * (3 - 2 * x);
    const cl = (x: number) => Math.min(1, Math.max(0, x));
    const crouch = tt < 0.38 ? ease(cl(tt / 0.38)) : tt < 0.48 ? 1 - ease(cl((tt - 0.38) / 0.1)) : tt < 1.2 ? 0 : tt < 1.32 ? ease(cl((tt - 1.2) / 0.12)) : 1 - ease(cl((tt - 1.32) / 0.5));
    const airT = (tt - 0.46) / 0.74;
    const h = airT > 0 && airT < 1 ? 4 * airT * (1 - airT) * 0.62 : 0;
    const inAir = airT > 0 && airT < 1 ? 1 : 0;
    addP(p, 'p.rig', 0, h, 0);
    addP(p, 'p.hips', 0, -crouch * 0.075, 0);
    addP(p, 'legL', -0.7 * crouch - inAir * 0.35 * Math.sin(airT * Math.PI), 0, 0.04 * crouch);
    addP(p, 'legR', -0.7 * crouch - inAir * 0.1, 0, -0.04 * crouch);
    addP(p, 'shinL', 1.3 * crouch + inAir * 0.7 * Math.sin(airT * Math.PI), 0, 0);
    addP(p, 'shinR', 1.3 * crouch + inAir * 0.3, 0, 0);
    addP(p, 'footL', -0.6 * crouch, 0, 0); addP(p, 'footR', -0.6 * crouch, 0, 0);
    addP(p, 'torso', 0.25 * crouch - inAir * 0.08, 0, 0);
    const up = inAir * Math.sin(Math.min(1, airT * 2.2) * Math.PI * 0.5);
    addP(p, 'armL', 0.55 * crouch - 2.3 * up, 0, 0.15 + 0.25 * up);
    addP(p, 'armR', 0.55 * crouch - 2.3 * up, 0, -0.15 - 0.25 * up);
    addP(p, 'foreL', -0.3 * up, 0, 0); addP(p, 'foreR', -0.3 * up, 0, 0);
    addP(p, 'head', -0.25 * crouch + 0.2 * up, 0, 0);
    addP(p, 'antenna', 0.4 * crouch - 0.5 * up, 0, 0);
    const squash = tt > 1.18 && tt < 1.4 ? -0.08 * Math.sin(((tt - 1.18) / 0.22) * Math.PI) : 0;
    setS(p, 's.squash', -crouch * 0.05 + (tt > 0.4 && tt < 0.56 ? 0.06 * Math.sin(((tt - 0.4) / 0.16) * Math.PI) : 0) + squash);
  }

  protected poseJetpack(t: number, p: Pose) {
    const rise = Math.min(1, t / 0.9);
    const e = rise * rise * (3 - 2 * rise);
    addP(p, 'p.rig', smoothNoise(t * 0.7, 9) * 0.03, e * (0.55 + Math.sin(t * 1.8) * 0.04), smoothNoise(t * 0.6, 10) * 0.03);
    addP(p, 'rig', 0.1 * e + smoothNoise(t * 0.9, 11) * 0.05, 0, smoothNoise(t * 0.8, 12) * 0.06);
    addP(p, 'legL', 0.12 + Math.sin(t * 1.4) * 0.07, 0, 0.05);
    addP(p, 'legR', 0.18 + Math.sin(t * 1.4 + 1) * 0.07, 0, -0.05);
    addP(p, 'shinL', 0.4, 0, 0); addP(p, 'shinR', 0.32, 0, 0);
    addP(p, 'footL', 0.25, 0, 0); addP(p, 'footR', 0.25, 0, 0);
    addP(p, 'armL', 0.15, 0, 0.42 + Math.sin(t * 1.1) * 0.05);
    addP(p, 'armR', 0.15, 0, -0.42 - Math.sin(t * 1.1) * 0.05);
    addP(p, 'foreL', -0.5, 0, 0); addP(p, 'foreR', -0.5, 0, 0);
    addP(p, 'head', -0.12 + smoothNoise(t * 0.4, 13) * 0.1, smoothNoise(t * 0.3, 14) * 0.4, 0);
    addP(p, 'antenna', 0.3, 0, smoothNoise(t * 3, 15) * 0.1);
    setS(p, 's.flame', Math.min(1, t * 4) * (0.85 + 0.15 * Math.sin(t * 7)));
  }

  protected poseFloat(t: number, p: Pose) {
    const e = Math.min(1, t / 1.2);
    addP(p, 'p.rig', 0, e * (0.5 + Math.sin(t * 0.6) * 0.08), 0);
    addP(p, 'rig', e * Math.sin(t * 0.37) * 0.4, e * Math.sin(t * 0.21) * 0.7, e * Math.sin(t * 0.29) * 0.35);
    addP(p, 'armL', -0.3 + Math.sin(t * 0.5) * 0.15, 0, 0.95 + Math.sin(t * 0.43) * 0.12);
    addP(p, 'armR', -0.2 + Math.sin(t * 0.5 + 2) * 0.15, 0, -0.95 - Math.sin(t * 0.47) * 0.12);
    addP(p, 'foreL', -0.45, 0, 0); addP(p, 'foreR', -0.45, 0, 0);
    addP(p, 'legL', -0.25 + Math.sin(t * 0.4) * 0.12, 0, 0.22);
    addP(p, 'legR', 0.15 + Math.sin(t * 0.4 + 1.5) * 0.12, 0, -0.22);
    addP(p, 'shinL', 0.45, 0, 0); addP(p, 'shinR', 0.6, 0, 0);
    addP(p, 'head', smoothNoise(t * 0.25, 16) * 0.3, smoothNoise(t * 0.2, 17) * 0.8, 0);
    addP(p, 'antenna', Math.sin(t * 0.8) * 0.2, 0, Math.sin(t * 0.6) * 0.2);
  }

  protected poseScan(t: number, p: Pose) {
    const T = 3.4, tt = t % T;
    const up = Math.min(1, t / 0.5);
    const sweep = tt > 0.5 && tt < 2.6 ? Math.sin(((tt - 0.5) / 2.1) * Math.PI * 2) : 0;
    addP(p, 'head', 0.22 * up, sweep * 0.55, 0);
    addP(p, 'torso', 0.06 * up, sweep * 0.15, 0);
    addP(p, 'armR', -1.25 * up, sweep * 0.2, -0.12);
    addP(p, 'foreR', -0.35 * up, 0, 0);
    addP(p, 'armL', 0, 0, 0.1); addP(p, 'foreL', -0.25, 0, 0);
    addP(p, 'legL', -0.08, 0, 0.03); addP(p, 'legR', 0.1, 0, -0.03);
    addP(p, 'shinL', 0.12, 0, 0); addP(p, 'shinR', 0.12, 0, 0);
    addP(p, 'p.hips', 0, -0.008, 0);
    addP(p, 'antenna', -0.2, 0, Math.sin(t * 9) * 0.06);
    setS(p, 's.beam', tt > 0.45 && tt < 2.65 ? Math.min(1, (tt - 0.45) * 5, (2.65 - tt) * 5) : 0);
    setS(p, 's.scanPhase', tt);
  }

  protected poseRoll(_t: number, _p: Pose) { /* spécifique à Orbe */ }

  /** En l'air (sans jetpack) : jambes repliées, bras écartés pour l'équilibre. */
  protected poseFall(t: number, p: Pose) {
    addP(p, 'legL', -0.45, 0, 0.06); addP(p, 'legR', -0.2, 0, -0.06);
    addP(p, 'shinL', 0.8, 0, 0); addP(p, 'shinR', 0.5, 0, 0);
    addP(p, 'footL', -0.2, 0, 0); addP(p, 'footR', -0.1, 0, 0);
    addP(p, 'armL', -0.5, 0, 0.5 + Math.sin(t * 9) * 0.05); addP(p, 'armR', -0.5, 0, -0.5 - Math.sin(t * 9) * 0.05);
    addP(p, 'foreL', -0.4, 0, 0); addP(p, 'foreR', -0.4, 0, 0);
    addP(p, 'torso', -0.06, 0, 0); addP(p, 'head', 0.1, 0, 0);
    addP(p, 'antenna', -0.4, 0, Math.sin(t * 12) * 0.1);
  }

  protected computeAction(a: ActionId, t: number, p: Pose) {
    switch (a) {
      case 'idle': this.poseIdle(t, p); break;
      case 'walk': this.poseWalk(t, p); break;
      case 'jump': this.poseJump(t, p); break;
      case 'jetpack': this.poseJetpack(t, p); break;
      case 'float': this.poseFloat(t, p); break;
      case 'scan': this.poseScan(t, p); break;
      case 'roll': this.poseRoll(t, p); break;
      case 'fall': this.poseFall(t, p); break;
    }
  }

  /** Hook : effets propres au robot (yeux, lumières…), appelé après application de la pose. */
  protected abstract applyExtras(p: Pose, dt: number, t: number): void;

  update(dt: number, t: number) {
    // fondu des poids d'action
    for (const [a, w] of this.weights) {
      const target = a === this.action ? 1 : 0;
      const nw = THREE.MathUtils.clamp(w + (target - w) * Math.min(1, dt * 5.5) + (target > w ? dt * 0.3 : -dt * 0.3), 0, 1);
      if (nw <= 0 && a !== this.action) { this.weights.delete(a); continue; }
      this.weights.set(a, nw);
    }
    let sum = 0;
    for (const w of this.weights.values()) sum += w;

    const p = this.pose;
    for (const k in p) delete p[k];
    for (const [a, w] of this.weights) {
      const walkRate = this.groundSpeed > 0
        // distance parcourue par cycle ≈ 4 × amplitude × longueur de jambe
        ? THREE.MathUtils.clamp(0.8 * (this.groundSpeed * this.gait.period) / (4 * this.gait.stride * this.legLength), 0.3, 2.4)
        : THREE.MathUtils.clamp(this.walkSpeed, 0.3, 1.8);
      const ct = (this.clocks.get(a) ?? 0) + dt * (a === 'walk' ? walkRate : 1);
      this.clocks.set(a, ct);
      const tp = this.tmp;
      for (const k in tp) delete tp[k];
      // le « idle » sert de fond permanent (respiration), les autres le recouvrent
      this.computeAction(a, a === 'idle' ? t : ct, tp);
      const ww = w / (sum || 1);
      for (const k in tp) {
        const v = p[k] ?? (p[k] = [0, 0, 0]);
        if (k === 's.scanPhase') { if (a === this.action) v[0] = tp[k][0]; continue; }
        v[0] += tp[k][0] * ww; v[1] += tp[k][1] * ww; v[2] += tp[k][2] * ww;
      }
    }

    if (this.gameMode) { delete p['p.rig']; delete p['rig']; }
    // application aux articulations
    for (const [o, r] of this.rest) {
      const key = o === this.rig ? 'rig' : o.name;
      if (!key) continue;
      const rot = p[key];
      const pos = p['p.' + key];
      o.rotation.set(r.r.x + (rot?.[0] ?? 0), r.r.y + (rot?.[1] ?? 0), r.r.z + (rot?.[2] ?? 0));
      o.position.set(r.p.x + (pos?.[0] ?? 0), r.p.y + (pos?.[1] ?? 0), r.p.z + (pos?.[2] ?? 0));
    }
    const sq = p['s.squash']?.[0] ?? 0;
    this.rig.scale.set(1 - sq * 0.6, 1 + sq, 1 - sq * 0.6);

    // flammes
    const fl = p['s.flame']?.[0] ?? 0;
    for (const f of this.flames) { f.power = fl; f.update(t); }

    // scan : déclenche l'onde une fois par cycle
    const ph = p['s.scanPhase']?.[0] ?? -1;
    if (this.action === 'scan' && ph >= 0.5 && this.lastScanPhase < 0.5) this.wave.trigger();
    this.lastScanPhase = this.action === 'scan' ? ph : 0;
    this.beam.update(p['s.beam']?.[0] ?? 0, t);

    // clignement des yeux
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blinkT = 2 + Math.random() * 4; this.blink = 0.0001; }
    if (this.blink > 0) { this.blink += dt / 0.16; if (this.blink >= 1) this.blink = 0; }

    if (this.light) {
      const scanBoost = (p['s.beam']?.[0] ?? 0) * 0.6;
      const jet = fl;
      this.light.intensity = 0.08 + scanBoost * 0.4 + jet * 1.4;
      this.light.color.setRGB(0.3 + jet * 0.2, 0.75 + jet * 0.1, 1);
    }

    this.applyExtras(p, dt, t);
  }

  /** Valeur 0→1→0 du clignement. */
  protected blinkAmount() { return this.blink > 0 ? Math.sin(this.blink * Math.PI) : 0; }
}

export { JOINTS };
