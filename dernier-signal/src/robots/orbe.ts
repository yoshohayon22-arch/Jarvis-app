import * as THREE from 'three';
import { Robot, type Pose, type ActionId } from './Robot';
import { Builder, rbox, bcyl, lathe, bellows, vent, smoothNoise } from './parts';
import * as M from './materials';

// D · Orbe : un corps sphérique qui se met en boule pour rouler
// et se déploie (capot, jambes, bras) pour marcher.

export class OrbeRobot extends Robot {
  readonly actions: ActionId[] = ['idle', 'walk', 'roll', 'jump', 'jetpack', 'float', 'scan'];
  private fold = 0;
  private rollAngle = 0;
  private irisMat!: THREE.MeshBasicMaterial;
  private pupilMat!: THREE.MeshBasicMaterial;
  private seamMat!: THREE.MeshBasicMaterial;
  private iris!: THREE.Object3D;

  constructor() {
    super('orbe', 'D · Orbe', 'Corps sphérique : se met en boule pour rouler, se déplie (capot, jambes, bras) pour marcher.');
    this.gait = { stride: 0.38, knee: 0.8, armSwing: 0.35, bob: 0.02, period: 0.85, elbow: -0.5 };
    this.lightAnchor = { parent: 'hips', pos: [0, -0.32, -0.05] };
    this.build();
    this.captureRest();
  }

  private build() {
    const B = new Builder();
    const shell = M.paint(0xd9dcd8, { wear: 0.7, scratches: 0.35, dirt: 0.25, rough: 0.34, clearcoat: 0.7 });
    const accent = M.paint(0x2a8f9a, { wear: 0.8, scratches: 0.3, dirt: 0.2, rough: 0.4 });
    const dark = M.steel(0x3c3f44);
    const chrome = M.steel(0xa4a9b0, { rough: 0.2, wear: 0.05 });
    const rubber = M.rubber();
    const black = M.glossyBlack();
    const slotM = M.rubber(0x050505);

    const R = 0.3;
    const hips = this.joint('hips', this.rig, [0, 0.62, 0]);
    const head = this.joint('head', hips, [0, 0, 0]);         // œil sur cardan
    const hood = this.joint('hood', hips, [0, 0, 0]); // le capot pivote autour du centre et glisse derrière la coque
    const armL = this.joint('armL', hips, [0.27, 0.02, 0]);
    const armR = this.joint('armR', hips, [-0.27, 0.02, 0]);
    const foreL = this.joint('foreL', armL, [0.0, -0.13, 0]);
    const foreR = this.joint('foreR', armR, [0.0, -0.13, 0]);
    const legL = this.joint('legL', hips, [0.12, -0.16, 0]);
    const legR = this.joint('legR', hips, [-0.12, -0.16, 0]);
    const shinL = this.joint('shinL', legL, [0, -0.2, 0]);
    const shinR = this.joint('shinR', legR, [0, -0.2, 0]);
    const footL = this.joint('footL', shinL, [0, -0.19, 0]);
    const footR = this.joint('footR', shinR, [0, -0.19, 0]);

    // demi-coque inférieure
    const lower = new THREE.SphereGeometry(R, 64, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    B.add(hips, shell, lower);
    const inner = new THREE.SphereGeometry(R * 0.965, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    inner.scale(-1, 1, 1); // faces internes
    B.add(hips, dark, inner);
    B.add(hips, accent, new THREE.TorusGeometry(R * 0.985, 0.012, 12, 96), [0, -0.005, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      B.screws(hips, chrome, slotM, [{ p: [Math.sin(a) * R * 0.99, -0.04, Math.cos(a) * R * 0.99], r: [0, a, 0] }]);
    }
    // bandes de roulement
    for (const s of [-0.11, 0.11]) {
      B.add(hips, rubber, new THREE.TorusGeometry(Math.sqrt(R * R - s * s) + 0.002, 0.009, 8, 96, Math.PI), [s, 0, 0], [0, Math.PI / 2, Math.PI]);
    }
    // noyau (gris anthracite satiné, panneaux)
    const core = M.paint(0x3b4146, { wear: 0.5, scratches: 0.25, dirt: 0.45, rough: 0.72, clearcoat: 0.0, bareColor: 0x8a9098 });
    // greebles : panneaux, grilles et vis sur le noyau
    const place = (lat: number, lon: number, geo: THREE.BufferGeometry, mat: THREE.Material, lift = 0) => {
      const d = new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
      const qn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
      const e = new THREE.Euler().setFromQuaternion(qn);
      const pp = d.multiplyScalar(R * 0.9 + lift);
      B.add(hips, mat, geo, [pp.x, pp.y, pp.z], [e.x, e.y, e.z]);
    };
    const grille = M.steel(0x2b2e33, { rough: 0.5 });
    for (const [lat, lon] of [[0.75, 0.0], [0.55, 0.9], [0.55, -0.9], [0.2, 1.35], [0.2, -1.35], [1.2, 2.2], [0.9, 3.14], [0.4, 2.6], [0.4, -2.6]]) {
      place(lat, lon, rbox(0.09, 0.06, 0.016, 0.006), shell, 0.0);
    }
    for (const [lat, lon] of [[0.55, 0.9], [0.55, -0.9], [0.9, 3.14]]) place(lat, lon, vent(0.06, 0.036, 4, 0.005), grille, 0.009);
    for (const [lat, lon] of [[0.82, 0.32], [0.82, -0.32], [0.62, 0.55], [0.62, -0.55]]) {
      const d = new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
      const qn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
      const e = new THREE.Euler().setFromQuaternion(qn);
      const pp = d.multiplyScalar(R * 0.9);
      B.screws(hips, chrome, slotM, [{ p: [pp.x, pp.y, pp.z], r: [e.x, e.y, e.z] }]);
    }
    B.add(hips, core, new THREE.SphereGeometry(R * 0.9, 48, 32), [0, 0, 0]);
    for (let i = 0; i < 3; i++) {
      B.add(hips, dark, new THREE.TorusGeometry(R * 0.902, 0.003, 6, 96), [0, 0, 0], [Math.PI / 2, (i - 1) * 0.5, 0]);
    }
    B.add(hips, dark, new THREE.TorusGeometry(R * 0.902, 0.003, 6, 96), [0, R * 0.35, 0], [Math.PI / 2, 0, 0], [0.93, 0.93, 0.93]);
    this.seamMat = M.glow(0x45e6ff, 2.5);
    const seam = new THREE.Mesh(new THREE.TorusGeometry(R * 0.905, 0.0035, 8, 96), this.seamMat);
    seam.rotation.y = Math.PI / 2; hips.add(seam);

    // capot supérieur (s'ouvre vers l'arrière)
    const RH = R * 1.03;
    const top = new THREE.SphereGeometry(RH, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    B.add(hood, shell, top);
    const topIn = new THREE.SphereGeometry(RH * 0.97, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2); topIn.scale(-1, 1, 1);
    B.add(hood, dark, topIn);
    B.add(hood, accent, new THREE.TorusGeometry(RH, 0.01, 10, 96), [0, 0.002, 0], [Math.PI / 2, 0, 0]);
    // arête centrale
    B.add(hood, accent, new THREE.TorusGeometry(RH + 0.002, 0.012, 10, 64, Math.PI), [0, 0, 0], [0, Math.PI / 2, 0]);
    for (const s of [1, -1]) B.add(hood, dark, bcyl(0.045, 0.02, 0.006, 24), [s * RH, 0, 0], [0, 0, Math.PI / 2]);
    const decalTex = M.textTexture([{ text: 'R-12', size: 120, y: 128, color: 'rgba(30,34,38,0.85)' }]);
    const da = Math.PI / 4;
    B.add(hood, M.decal(decalTex), new THREE.PlaneGeometry(0.15, 0.075), [0.0, Math.cos(da) * RH + 0.003, Math.sin(da) * RH + 0.003], [-da, 0, 0]);

    // œil sur cardan
    const eye = new THREE.Group(); eye.rotation.x = -0.25; eye.scale.setScalar(1.25); eye.position.z = -0.075; head.add(eye);
    B.add(eye, chrome, lathe([[0.085, 0.0], [0.095, 0.012], [0.09, 0.03], [0.075, 0.035], [0.07, 0.02]], 48), [0, 0, R * 0.86], [Math.PI / 2, 0, 0]);
    B.add(eye, black, new THREE.SphereGeometry(0.075, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0, R * 0.88], [Math.PI / 2, 0, 0], [1, 0.45, 1]);
    this.iris = new THREE.Group(); this.iris.position.set(0, 0, R * 0.88 + 0.022); eye.add(this.iris);
    this.irisMat = M.glow(0x2fd8ff, 3);
    this.pupilMat = M.glow(0xd6fbff, 8);
    this.iris.add(new THREE.Mesh(new THREE.RingGeometry(0.03, 0.05, 48), this.irisMat));
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.018, 32), this.pupilMat); pupil.position.z = 0.001;
    this.iris.add(pupil);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 0.01), this.irisMat);
      tick.position.set(Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0); tick.rotation.z = a + Math.PI / 2; this.iris.add(tick);
    }
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.077, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.visorGlass());
    glass.rotation.x = Math.PI / 2; glass.scale.set(1, 0.5, 1); glass.position.z = R * 0.885; eye.add(glass);
    this.beam.position.set(0, 0, R * 0.95); eye.add(this.beam);

    // bras télescopiques
    for (const [arm, fore, s] of [[armL, foreL, 1], [armR, foreR, -1]] as const) {
      B.add(arm, dark, bcyl(0.04, 0.03, 0.006, 24), [0, 0, 0], [0, 0, Math.PI / 2]);
      B.add(arm, chrome, bcyl(0.018, 0.13, 0.004, 16), [s * 0.01, -0.065, 0]);
      B.add(arm, accent, rbox(0.045, 0.05, 0.05, 0.012), [s * 0.01, -0.02, 0]);
      B.add(fore, dark, new THREE.SphereGeometry(0.024, 16, 12), [s * 0.01, 0, 0]);
      B.add(fore, shell, rbox(0.05, 0.1, 0.05, 0.016), [s * 0.01, -0.06, 0]);
      B.add(fore, dark, rbox(0.018, 0.045, 0.016, 0.005), [s * 0.01 + 0.014, -0.125, 0.008], [0.1, 0, -0.12]);
      B.add(fore, dark, rbox(0.018, 0.045, 0.016, 0.005), [s * 0.01 - 0.014, -0.125, 0.008], [0.1, 0, 0.12]);
    }
    // jambes télescopiques
    for (const [leg, shin, foot] of [[legL, shinL, footL], [legR, shinR, footR]] as const) {
      B.add(leg, dark, new THREE.SphereGeometry(0.04, 20, 14));
      B.add(leg, accent, rbox(0.06, 0.16, 0.065, 0.02), [0, -0.1, 0]);
      B.add(leg, dark, bcyl(0.028, 0.08, 0.005, 16), [0, -0.2, 0], [0, 0, Math.PI / 2]);
      B.add(shin, rubber, bellows(0.028, 0.08, 4), [0, -0.05, 0]);
      B.add(shin, chrome, bcyl(0.016, 0.16, 0.004, 16), [0, -0.1, 0]);
      B.add(shin, dark, bcyl(0.03, 0.03, 0.006, 16), [0, -0.18, 0]);
      B.add(foot, shell, rbox(0.09, 0.04, 0.13, 0.018), [0, -0.035, 0.02]);
      B.add(foot, rubber, rbox(0.095, 0.016, 0.14, 0.006), [0, -0.058, 0.02]);
    }
    // propulseurs ventraux
    for (const s of [1, -1]) B.add(hips, chrome, lathe([[0.018, 0], [0.026, -0.02], [0.022, -0.022], [0.0, -0.01]], 20), [s * 0.09, -0.27, -0.09], [0.35, 0, 0]);
    this.addJet(hips, [0.09, -0.29, -0.095], 0.22, 0.024);
    this.addJet(hips, [-0.09, -0.29, -0.095], 0.22, 0.024);

    B.build();
  }

  // --- poses spécifiques ---
  protected poseRoll(t: number, p: Pose) {
    p['s.fold'] = [1, 0, 0];
    p['head'] = [0, 0, 0];
    p['p.hips'] = [0, Math.abs(Math.sin(t * 6)) * 0.004, 0];
    p['s.roll'] = [1, 0, 0];
  }
  protected poseJump(t: number, p: Pose) {
    const T = 1.9, tt = t % T;
    const air = (tt - 0.35) / 0.9;
    const inAir = air > 0 && air < 1;
    p['s.fold'] = [inAir ? 1 : tt < 0.35 ? tt / 0.35 * 0.4 : Math.max(0, 1 - (tt - 1.25) / 0.4), 0, 0];
    p['p.rig'] = [0, inAir ? 4 * air * (1 - air) * 0.7 : 0, 0];
    p['rig'] = [inAir ? -air * Math.PI * 2 : 0, 0, 0];
    const land = tt > 1.22 && tt < 1.45 ? Math.sin(((tt - 1.22) / 0.23) * Math.PI) : 0;
    p['s.squash'] = [-0.12 * land, 0, 0];
  }
  protected poseFloat(t: number, p: Pose) {
    super.poseFloat(t, p);
    p['s.fold'] = [0.35 + 0.15 * Math.sin(t * 0.5), 0, 0];
  }
  protected poseIdle(t: number, p: Pose) {
    super.poseIdle(t, p);
    p['head'] = [smoothNoise(t * 0.3, 31) * 0.3, smoothNoise(t * 0.22, 32) * 1.1, 0];
  }

  protected applyExtras(p: Pose, dt: number, t: number) {
    const target = p['s.fold']?.[0] ?? 0;
    this.fold += (target - this.fold) * Math.min(1, dt * 7);
    const f = this.fold;
    const open = 1 - f;
    const ease = open * open * (3 - 2 * open);
    this.j.hips.position.y -= 0.32 * f;
    this.j.hood.rotation.x = -1.72 * ease;
    for (const k of ['legL', 'legR', 'armL', 'armR']) {
      const o = this.j[k];
      o.scale.setScalar(Math.max(0.001, ease));
    }
    this.j.legL.position.y += 0.06 * f; this.j.legR.position.y += 0.06 * f;
    // roulade
    const rolling = p['s.roll']?.[0] ?? 0;
    this.rollAngle += dt * rolling * 4.5;
    if (rolling > 0.01) this.j.hips.rotation.x += this.rollAngle;
    else this.rollAngle = this.rollAngle % (Math.PI * 2) * (1 - Math.min(1, dt * 3));
    // œil
    const b = this.blinkAmount();
    const beam = p['s.beam']?.[0] ?? 0;
    this.iris.scale.set(1 - b * 0.6 + beam * 0.15, 1 - b * 0.95 + beam * 0.15, 1);
    this.iris.rotation.z = t * 0.6;
    this.irisMat.color.setRGB(0.18, 0.85, 1).multiplyScalar(3 * (1 + beam * 0.6) * (0.3 + 0.7 * ease));
    this.pupilMat.color.setRGB(0.84, 0.98, 1).multiplyScalar(8 * (0.2 + 0.8 * ease));
    this.seamMat.color.setRGB(0.27, 0.9, 1).multiplyScalar(2.2 + Math.sin(t * 2) * 0.8 + f * 2);
  }
}
