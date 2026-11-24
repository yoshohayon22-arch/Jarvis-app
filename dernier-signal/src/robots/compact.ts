import * as THREE from 'three';
import { Robot, type Pose } from './Robot';
import { Builder, rbox, bcyl, bellows, cable, vent, lathe, smoothNoise } from './parts';
import * as M from './materials';

// Gabarit « compact » partagé par A · Pixel et B · Rouille.

type Style = 'pixel' | 'rouille';

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return new THREE.ShapeGeometry(s, 8);
}

export class CompactRobot extends Robot {
  private style: Style;
  private eyes: THREE.Mesh[] = [];
  private eyeMats: THREE.MeshBasicMaterial[] = [];
  private eyeBase: THREE.Color[] = [];
  private tipMat!: THREE.MeshBasicMaterial;
  private ledMats: THREE.MeshBasicMaterial[] = [];
  private flicker = 0;
  /** Puissance des yeux 0-1 (prologue : ils s'allument). */
  eyePower = 1;

  constructor(style: Style) {
    super(style,
      style === 'pixel' ? 'A · Pixel' : 'B · Rouille',
      style === 'pixel'
        ? 'Compact, orange et blanc. Tête-écran noire brillante, grands yeux cyan, sac à dos propulseur.'
        : 'Même gabarit, mais vieux et rafistolé : peinture écaillée, antenne tordue, plaque dépareillée, un œil qui grésille.');
    this.style = style;
    this.lightAnchor = { parent: 'pack', pos: [0, -0.3, -0.05] };
    this.build();
    this.captureRest();
  }

  private build() {
    const R = this.style === 'rouille';
    const B = new Builder();
    // --- matériaux ---
    const orange = R ? M.rusty(0xffffff, 1.4) : M.paint(0xe2571a, { wear: 0.75, scratches: 0.25, dirt: 0.2, rough: 0.4 });
    const white = R ? M.paint(0xb9b2a2, { wear: 1.3, scratches: 0.7, dirt: 0.6, rough: 0.6, clearcoat: 0.1, bareColor: 0x7a6a58, bareRough: 0.65 })
      : M.paint(0xeeeae2, { wear: 0.55, scratches: 0.2, dirt: 0.18, rough: 0.36 });
    const dark = M.steel(R ? 0x4a4540 : 0x45484e, R ? { wear: 0.5, dirt: 0.6, rough: 0.6, bareColor: 0x8a6a4a } : {});
    const chrome = M.steel(0x9aa0a8, { rough: 0.22, wear: 0.1, dirt: 0.15 });
    const rubber = M.rubber(0x141517);
    const black = M.glossyBlack();
    const slotM = M.rubber(0x050505);
    const patch = M.treadPlate(0x5c5f63, 0.6);

    // --- squelette ---
    const hips = this.joint('hips', this.rig, [0, 0.36, 0]);
    const torso = this.joint('torso', hips, [0, 0.05, 0]);
    const head = this.joint('head', torso, [0, 0.34, 0]);
    const armL = this.joint('armL', torso, [0.255, 0.25, 0]);
    const armR = this.joint('armR', torso, [-0.255, 0.25, 0]);
    const foreL = this.joint('foreL', armL, [0, -0.16, 0]);
    const foreR = this.joint('foreR', armR, [0, -0.16, 0]);
    const legL = this.joint('legL', hips, [0.1, -0.03, 0]);
    const legR = this.joint('legR', hips, [-0.1, -0.03, 0]);
    const shinL = this.joint('shinL', legL, [0, -0.13, 0]);
    const shinR = this.joint('shinR', legR, [0, -0.13, 0]);
    const footL = this.joint('footL', shinL, [0, -0.125, 0.0]);
    const footR = this.joint('footR', shinR, [0, -0.125, 0.0]);
    const antenna = this.joint('antenna', head, [R ? 0.13 : -0.13, 0.27, -0.04]);

    // --- bassin ---
    B.add(hips, dark, rbox(0.3, 0.07, 0.2, 0.025), [0, -0.01, 0]);
    B.add(hips, white, rbox(0.24, 0.05, 0.22, 0.02), [0, 0.02, 0]);
    for (const s of [1, -1]) B.add(hips, chrome, bcyl(0.035, 0.05, 0.006, 24), [s * 0.1, -0.03, 0], [0, 0, Math.PI / 2]);

    // --- jambes ---
    for (const [leg, shin, foot, s] of [[legL, shinL, footL, 1], [legR, shinR, footR, -1]] as const) {
      B.add(leg, rubber, bellows(0.043, 0.12, 5), [0, -0.065, 0]);
      B.add(leg, dark, bcyl(0.03, 0.03, 0.006, 20), [0, -0.13, 0], [0, 0, Math.PI / 2]);
      // tibia
      B.add(shin, white, rbox(0.095, 0.12, 0.105, 0.025), [0, -0.06, 0]);
      B.add(shin, orange, rbox(0.1, 0.045, 0.05, 0.015), [0, -0.01, 0.04]); // genouillère
      B.add(shin, dark, vent(0.06, 0.04, 4), [0, -0.075, 0.054]);
      B.screws(shin, chrome, slotM, [{ p: [s * 0.032, -0.105, 0.053] }, { p: [-s * 0.032, -0.105, 0.053] }]);
      B.add(shin, dark, bcyl(0.028, 0.02, 0.005, 20), [0, -0.125, 0], [0, 0, Math.PI / 2]);
      // pied
      B.add(foot, orange, rbox(0.125, 0.05, 0.17, 0.022), [0, -0.035, 0.02]);
      B.add(foot, rubber, rbox(0.135, 0.022, 0.19, 0.01), [0, -0.064, 0.02]);
      B.add(foot, dark, rbox(0.08, 0.02, 0.05, 0.008), [0, -0.012, -0.045]);
      B.screws(foot, chrome, slotM, [{ p: [0.045, -0.035, 0.106] }, { p: [-0.045, -0.035, 0.106] }]);
    }

    // --- torse ---
    B.add(torso, white, rbox(0.42, 0.3, 0.32, 0.055, 4), [0, 0.17, 0]);
    B.add(torso, orange, rbox(0.31, 0.17, 0.03, 0.02), [0, 0.2, 0.158]); // plastron
    B.add(torso, dark, rbox(0.33, 0.012, 0.02, 0.004), [0, 0.1, 0.16]); // joint de panneau
    B.add(torso, dark, rbox(0.2, 0.05, 0.03, 0.01), [0, 0.06, 0.15]);
    B.add(torso, dark, vent(0.13, 0.03, 3), [0, 0.06, 0.167]);
    for (const s of [1, -1]) {
      B.add(torso, dark, vent(0.12, 0.11, 6), [s * 0.211, 0.17, 0.02], [0, s * Math.PI / 2, 0]);
      B.add(torso, R && s === 1 ? patch : orange, rbox(0.12, 0.09, 0.15, 0.035), [s * 0.235, 0.27, 0]); // épaulettes
      B.add(torso, dark, bcyl(0.045, 0.04, 0.008, 24), [s * 0.215, 0.25, 0], [0, 0, Math.PI / 2]);
    }
    B.screws(torso, chrome, slotM, [
      { p: [0.14, 0.27, 0.174] }, { p: [-0.14, 0.27, 0.174] }, { p: [0.14, 0.13, 0.174] }, { p: [-0.14, 0.13, 0.174] },
    ]);
    if (R) B.screws(torso, chrome, slotM, [
      { p: [0.29, 0.3, 0.05], r: [0, Math.PI / 2, 0] }, { p: [0.29, 0.3, -0.05], r: [0, Math.PI / 2, 0] },
      { p: [0.29, 0.24, 0.05], r: [0, Math.PI / 2, 0] }, { p: [0.29, 0.24, -0.05], r: [0, Math.PI / 2, 0] },
    ]);
    // cou
    B.add(torso, rubber, bellows(0.05, 0.05, 3), [0, 0.335, 0]);
    B.add(torso, dark, bcyl(0.075, 0.025, 0.008, 28), [0, 0.322, 0]);

    // décalques
    const chestTex = M.textTexture([
      { text: 'R-12', size: 150, y: 110, color: R ? 'rgba(40,30,25,0.85)' : 'rgba(30,32,36,0.9)' },
      { text: 'HALCYON · MAINTENANCE', size: 34, y: 205, font: '600', color: R ? 'rgba(40,30,25,0.7)' : 'rgba(30,32,36,0.75)' },
    ]);
    B.add(torso, M.decal(chestTex), new THREE.PlaneGeometry(0.24, 0.12), [0, 0.205, 0.1735]);

    // sac à dos + propulseurs
    const pack = this.joint('pack', torso, [0, 0.17, -0.2]);
    B.add(pack, orange, rbox(0.3, 0.25, 0.11, 0.035), [0, 0.01, -0.02]);
    B.add(pack, white, rbox(0.24, 0.07, 0.04, 0.015), [0, 0.09, -0.07]);
    B.add(pack, dark, vent(0.18, 0.08, 5), [0, -0.03, -0.077]);
    const hz = M.textTexture([], 256, 64, true);
    B.add(pack, M.decal(hz, { color: 0xffffff }), new THREE.PlaneGeometry(0.22, 0.05), [0, 0.09, -0.0905], [0, Math.PI, 0]);
    for (const s of [1, -1]) {
      B.add(pack, dark, bcyl(0.035, 0.05, 0.008, 24), [s * 0.085, -0.13, -0.02]);
      B.add(pack, chrome, lathe([[0.022, 0], [0.026, -0.01], [0.04, -0.05], [0.036, -0.052], [0.02, -0.012], [0.0, -0.012]], 28), [s * 0.085, -0.155, -0.02]);
      B.add(pack, rubber, rbox(0.035, 0.24, 0.02, 0.008), [s * 0.11, 0.0, 0.065]); // bretelles
    }
    this.addJet(pack, [0.085, -0.205, -0.02]);
    this.addJet(pack, [-0.085, -0.205, -0.02]);
    // câbles sac → bras
    for (const s of [1, -1]) B.add(torso, rubber, cable([[s * 0.12, 0.08, -0.17], [s * 0.2, 0.06, -0.16], [s * 0.24, 0.12, -0.08], [s * 0.245, 0.2, -0.03]], 0.008, 24));

    // indicateurs lumineux
    const ledC = [0x34ff88, 0xffb020, 0x34ff88];
    ledC.forEach((c, i) => {
      const m = M.glow(c, 5); this.ledMats.push(m);
      const led = new THREE.Mesh(rbox(0.016, 0.01, 0.01, 0.003, 1), m);
      led.position.set(0.12 - i * 0.022, 0.1, 0.169); torso.add(led);
    });

    // --- bras ---
    for (const [arm, fore, s] of [[armL, foreL, 1], [armR, foreR, -1]] as const) {
      B.add(arm, dark, new THREE.SphereGeometry(0.045, 24, 16), [s * 0.02, 0, 0]);
      B.add(arm, white, rbox(0.075, 0.13, 0.08, 0.022), [s * 0.025, -0.08, 0]);
      B.add(arm, dark, bcyl(0.032, 0.085, 0.006, 20), [s * 0.025, -0.16, 0], [0, 0, Math.PI / 2]);
      B.add(fore, orange, rbox(0.085, 0.12, 0.09, 0.025), [s * 0.025, -0.07, 0.0]);
      B.add(fore, dark, rbox(0.06, 0.03, 0.065, 0.01), [s * 0.025, -0.14, 0.0]);
      // pince
      B.add(fore, dark, rbox(0.022, 0.06, 0.02, 0.007), [s * 0.025 + 0.018, -0.175, 0.012], [0.15, 0, -0.1]);
      B.add(fore, dark, rbox(0.022, 0.06, 0.02, 0.007), [s * 0.025 - 0.018, -0.175, 0.012], [0.15, 0, 0.1]);
      B.add(fore, dark, rbox(0.02, 0.045, 0.02, 0.007), [s * 0.025, -0.165, -0.025], [-0.35, 0, 0]);
      B.screws(fore, chrome, slotM, [{ p: [s * 0.068, -0.07, 0.0], r: [0, s * Math.PI / 2, 0] }]);
    }

    // --- tête ---
    B.add(head, white, rbox(0.44, 0.27, 0.29, 0.07, 5), [0, 0.15, 0]);
    B.add(head, black, rbox(0.37, 0.205, 0.04, 0.045, 4), [0, 0.15, 0.13]);
    B.add(head, dark, rbox(0.39, 0.015, 0.25, 0.005), [0, 0.022, -0.005]);
    for (const s of [1, -1]) {
      B.add(head, orange, bcyl(0.062, 0.045, 0.012, 32), [s * 0.235, 0.15, -0.01], [0, 0, Math.PI / 2]);
      B.add(head, dark, vent(0.06, 0.06, 4, 0.004), [s * 0.259, 0.15, -0.01], [0, s * Math.PI / 2, 0]);
    }
    B.screws(head, chrome, slotM, [
      { p: [0.19, 0.26, 0.11], r: [-0.6, 0, 0] }, { p: [-0.19, 0.26, 0.11], r: [-0.6, 0, 0] },
    ]);
    const sideTex = M.textTexture([{ text: 'UNITÉ 12', size: 70, y: 128, color: 'rgba(30,32,36,0.8)' }], 512, 256);
    B.add(head, M.decal(sideTex), new THREE.PlaneGeometry(0.12, 0.06), [0, 0.24, -0.146], [0, Math.PI, 0]);

    // yeux (non fusionnés : animés)
    const eyeGeo = roundedRect(0.075, 0.105, 0.03);
    const coreGeo = roundedRect(0.05, 0.078, 0.022);
    for (const s of [1, -1]) {
      const g = new THREE.Group();
      g.position.set(s * 0.085, 0.155, 0.1515);
      const m1 = M.glow(0x2fd8ff, 2.2), m2 = M.glow(0xb8f6ff, 6.5);
      const e1 = new THREE.Mesh(eyeGeo, m1), e2 = new THREE.Mesh(coreGeo, m2);
      e2.position.z = 0.0008;
      g.add(e1, e2);
      head.add(g);
      this.eyes.push(g as unknown as THREE.Mesh);
      this.eyeMats.push(m1, m2);
      this.eyeBase.push(m1.color.clone(), m2.color.clone());
    }
    const visor = new THREE.Mesh(rbox(0.36, 0.195, 0.01, 0.004, 2), M.visorGlass());
    visor.position.set(0, 0.15, 0.156); visor.renderOrder = 5; head.add(visor);

    // antenne
    if (R) {
      B.add(antenna, chrome, cable([[0, 0, 0], [0.0, 0.05, 0], [0.02, 0.09, -0.01], [0.07, 0.11, -0.03]], 0.0045, 20));
      B.add(antenna, rubber, rbox(0.03, 0.02, 0.012, 0.004), [0.01, 0.06, 0.004], [0, 0, 0.3]); // ruban adhésif
    } else {
      B.add(antenna, chrome, bcyl(0.0045, 0.12, 0.002, 12), [0, 0.06, 0]);
    }
    B.add(antenna, dark, bcyl(0.018, 0.02, 0.005, 20), [0, 0.0, 0]);
    this.tipMat = M.glow(R ? 0xff5a1a : 0xff7a2a, 5);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), this.tipMat);
    tip.position.set(R ? 0.072 : 0, R ? 0.112 : 0.125, R ? -0.03 : 0);
    antenna.add(tip);

    if (R) {
      // fils dénudés et rafistolages
      B.add(torso, M.rubber(0xa01e14), cable([[-0.17, 0.05, 0.15], [-0.2, 0.0, 0.12], [-0.17, -0.04, 0.06]], 0.004, 16));
      B.add(torso, M.rubber(0xd8b020), cable([[-0.16, 0.05, 0.15], [-0.215, 0.01, 0.1], [-0.18, -0.03, 0.04]], 0.0035, 16));
      const tape = M.paint(0x8f8c86, { wear: 0, scratches: 0, dirt: 0.5, rough: 0.9, clearcoat: 0 });
      B.add(head, tape, rbox(0.07, 0.03, 0.006, 0.002), [-0.17, 0.27, 0.1], [-0.5, 0, 0.35]);
      B.add(armR, tape, rbox(0.082, 0.035, 0.087, 0.004), [-0.025, -0.05, 0], [0, 0, 0.05]);
    }

    // faisceau du scan, depuis les yeux
    this.beam.position.set(0, 0.155, 0.17);
    head.add(this.beam);

    B.build();
  }

  protected applyExtras(p: Pose, dt: number, t: number) {
    const b = this.blinkAmount();
    const beam = p['s.beam']?.[0] ?? 0;
    for (let i = 0; i < this.eyes.length; i++) {
      let open = 1 - b * 0.92;
      // Rouille : l'œil droit grésille de temps en temps
      if (this.style === 'rouille' && i === 1) {
        this.flicker -= dt;
        if (this.flicker < -2.5 - Math.random() * 3) this.flicker = 0.45;
        const on = this.flicker > 0 ? (Math.sin(t * 90) > 0.2 ? 0.15 : 1) * (0.6 + 0.4 * smoothNoise(t * 40)) : 1;
        open *= this.flicker > 0 ? 0.85 : 1;
        this.eyeMats[2].color.copy(this.eyeBase[2]).multiplyScalar(on * 0.8 * this.eyePower);
        this.eyeMats[3].color.copy(this.eyeBase[3]).multiplyScalar(on * 0.8 * this.eyePower);
      } else {
        const k = (1 + beam * 0.6) * this.eyePower;
        this.eyeMats[i * 2].color.copy(this.eyeBase[i * 2]).multiplyScalar(k);
        this.eyeMats[i * 2 + 1].color.copy(this.eyeBase[i * 2 + 1]).multiplyScalar(k);
      }
      this.eyes[i].scale.y = Math.max(0.08, open);
    }
    // voyants et pointe d'antenne
    const pulse = 0.6 + 0.4 * Math.sin(t * 2.2);
    this.tipMat.color.setRGB(1, this.style === 'rouille' ? 0.25 : 0.42, 0.12).multiplyScalar(2 + 4 * pulse);
    this.ledMats[1].color.setRGB(1, 0.65, 0.1).multiplyScalar(Math.sin(t * 4.5) > 0 ? 5 : 0.3);
  }
}
