import * as THREE from 'three';
import { Robot, type Pose } from './Robot';
import { Builder, lathe, bcyl, smoothNoise } from './parts';
import * as M from './materials';

// C · Halo : coque nacrée sans aspérités, une seule bande lumineuse pour visage,
// se déplace en lévitation sur un anneau de lumière.

export class HaloRobot extends Robot {
  private bandMat!: THREE.MeshBasicMaterial;
  private ringMat!: THREE.MeshBasicMaterial;
  private seamMats: THREE.MeshBasicMaterial[] = [];
  private ring!: THREE.Mesh;

  constructor() {
    super('halo', 'C · Halo', 'Épuré, blanc nacré, presque sans aspérités. Une seule bande lumineuse en guise de visage, il glisse en lévitation.');
    this.gait = { stride: 0, knee: 0, armSwing: 0.22, bob: 0.0, period: 1.6, elbow: -0.25 };
    this.lightAnchor = { parent: 'pod', pos: [0, -0.42, 0] };
    this.build();
    this.captureRest();
  }

  private build() {
    const B = new Builder();
    const shell = M.pearl();
    const satin = M.steel(0x2a2c31, { rough: 0.35, wear: 0, scratches: 0.15, dirt: 0.1 });
    const black = M.glossyBlack();

    const hips = this.joint('hips', this.rig, [0, 0.42, 0]);
    const pod = this.joint('pod', hips, [0, 0, 0]);
    const torso = this.joint('torso', hips, [0, 0.04, 0]);
    const head = this.joint('head', torso, [0, 0.39, 0]);
    const armL = this.joint('armL', torso, [0.205, 0.29, 0]);
    const armR = this.joint('armR', torso, [-0.205, 0.29, 0]);
    const foreL = this.joint('foreL', armL, [0, -0.17, 0]);
    const foreR = this.joint('foreR', armR, [0, -0.17, 0]);

    // nacelle inférieure (goutte)
    const podGeo = lathe([[0, -0.36], [0.025, -0.355], [0.06, -0.33], [0.095, -0.28], [0.125, -0.2], [0.145, -0.11], [0.152, -0.04], [0.148, 0.0], [0.135, 0.022], [0.0, 0.03]], 56);
    podGeo.scale(1, 1, 0.86);
    B.add(pod, shell, podGeo);
    B.add(pod, satin, bcyl(0.122, 0.035, 0.01, 48), [0, 0.035, 0], [0, 0, 0], [1, 1, 0.86]);
    this.ringMat = M.glow(0x7fe8ff, 5);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.007, 12, 64), this.ringMat);
    this.ring.rotation.x = Math.PI / 2; this.ring.position.y = -0.33;
    pod.add(this.ring);
    const tip = new THREE.Mesh(new THREE.CircleGeometry(0.03, 32), M.glow(0xbff6ff, 6));
    tip.rotation.x = Math.PI / 2; tip.position.y = -0.3605; pod.add(tip);

    // torse : coque profilée
    const torsoGeo = lathe([[0.0, 0.0], [0.11, 0.0], [0.135, 0.03], [0.16, 0.1], [0.19, 0.2], [0.2, 0.27], [0.185, 0.32], [0.14, 0.355], [0.07, 0.37], [0.0, 0.372]], 64);
    torsoGeo.scale(1, 1, 0.78);
    B.add(torso, shell, torsoGeo, [0, 0.0, 0]);
    // fine jointure lumineuse à la taille
    const seam = M.glow(0x9ff0ff, 2.5); this.seamMats.push(seam);
    const seamRing = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.0025, 8, 96), seam);
    seamRing.rotation.x = Math.PI / 2; seamRing.scale.set(1, 0.86, 1); seamRing.position.y = 0.01;
    torso.add(seamRing);
    // rainure de poitrine
    const groove = new THREE.TorusGeometry(0.195, 0.0018, 6, 96, Math.PI * 0.9);
    groove.rotateZ(Math.PI * 0.05); groove.rotateX(Math.PI / 2); groove.scale(1, 1, 0.78);
    B.add(torso, satin, groove, [0, 0.235, 0.003]);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.008, 24), M.glow(0x9ff0ff, 6));
    dot.position.set(0.07, 0.25, 0.1425); dot.rotation.y = 0.45; torso.add(dot);
    this.seamMats.push(dot.material as THREE.MeshBasicMaterial);
    // propulseurs dorsaux discrets
    for (const s of [1, -1]) {
      B.add(torso, satin, lathe([[0.016, 0.03], [0.024, 0.0], [0.03, -0.05], [0.0, -0.05]], 24), [s * 0.06, 0.12, -0.125]);
    }
    this.addJet(torso, [0.06, 0.07, -0.125], 0.22, 0.026);
    this.addJet(torso, [-0.06, 0.07, -0.125], 0.22, 0.026);

    // cou + tête (œuf)
    B.add(torso, satin, bcyl(0.035, 0.05, 0.01, 32), [0, 0.385, 0]);
    const headGeo = new THREE.SphereGeometry(1, 64, 40);
    headGeo.scale(0.165, 0.145, 0.16);
    B.add(head, shell, headGeo, [0, 0.12, 0]);
    // bande-visage : verre noir + bande lumineuse
    const visorGeo = new THREE.CylinderGeometry(1, 1, 1, 64, 1, true, -0.95, 1.9);
    const visor = visorGeo.clone(); visor.scale(0.163, 0.05, 0.158);
    B.add(head, black, visor, [0, 0.13, 0.004]);
    this.bandMat = M.glow(0xc6f7ff, 7);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 64, 1, true, -0.7, 1.4), this.bandMat);
    band.scale.set(0.1645, 0.011, 0.1595); band.position.set(0, 0.13, 0.004);
    head.add(band);

    // bras fins, articulations lumineuses
    for (const [arm, fore, s] of [[armL, foreL, 1], [armR, foreR, -1]] as const) {
      B.add(arm, shell, new THREE.SphereGeometry(0.048, 32, 20), [s * 0.0, 0, 0]);
      B.add(arm, shell, lathe([[0, 0.0], [0.032, -0.01], [0.036, -0.06], [0.03, -0.14], [0.0, -0.15]], 32), [s * 0.01, -0.01, 0]);
      const jm = M.glow(0x9ff0ff, 2.2); this.seamMats.push(jm);
      const jr = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.003, 8, 32), jm);
      jr.rotation.y = Math.PI / 2; jr.position.set(s * 0.01, -0.17, 0); arm.add(jr);
      B.add(fore, satin, new THREE.SphereGeometry(0.022, 20, 14), [s * 0.01, 0, 0]);
      B.add(fore, shell, lathe([[0, 0.0], [0.03, -0.012], [0.033, -0.07], [0.026, -0.13], [0.0, -0.14]], 32), [s * 0.01, -0.012, 0]);
      const hand = new THREE.SphereGeometry(1, 32, 20); hand.scale(0.028, 0.042, 0.022);
      B.add(fore, shell, hand, [s * 0.01, -0.17, 0.005]);
    }

    this.beam.position.set(0, 0.13, 0.17);
    head.add(this.beam);
    B.build();
  }

  // Lévitation : pas de jambes, la nacelle se penche et glisse.
  protected poseWalk(t: number, p: Pose) {
    const ph = (t / this.gait.period) * Math.PI * 2;
    p['p.hips'] = [0, 0.02 + Math.sin(ph * 2) * 0.008, 0];
    p['hips'] = [0.16, Math.sin(ph) * 0.05, Math.sin(ph) * 0.03];
    p['pod'] = [0.12 + Math.sin(ph * 2) * 0.03, 0, -Math.sin(ph) * 0.05];
    p['torso'] = [-0.06, -Math.sin(ph) * 0.08, 0];
    p['armL'] = [Math.sin(ph) * this.gait.armSwing + 0.15, 0, 0.12];
    p['armR'] = [-Math.sin(ph) * this.gait.armSwing + 0.15, 0, -0.12];
    p['foreL'] = [-0.25, 0, 0]; p['foreR'] = [-0.25, 0, 0];
    p['head'] = [-0.08, Math.sin(ph) * 0.06, 0];
  }

  protected poseIdle(t: number, p: Pose) {
    super.poseIdle(t, p);
    const h = p['p.hips'] ?? (p['p.hips'] = [0, 0, 0]);
    h[1] += Math.sin(t * 1.3) * 0.012;
    const pod = p['pod'] ?? (p['pod'] = [0, 0, 0]);
    pod[0] += smoothNoise(t * 0.3, 21) * 0.04; pod[2] += smoothNoise(t * 0.25, 22) * 0.04;
  }

  protected applyExtras(p: Pose, _dt: number, t: number) {
    const b = this.blinkAmount();
    const beam = p['s.beam']?.[0] ?? 0;
    const breathe = 0.85 + 0.15 * Math.sin(t * 1.4);
    this.bandMat.color.setRGB(0.78, 0.97, 1).multiplyScalar(7 * (1 - b * 0.85) * (1 + beam * 0.5));
    const flame = p['s.flame']?.[0] ?? 0;
    this.ringMat.color.setRGB(0.5, 0.91, 1).multiplyScalar(4 * breathe + flame * 4);
    this.ring.scale.setScalar(1 + flame * 0.25 + Math.sin(t * 3) * 0.02);
    for (const m of this.seamMats) m.color.setRGB(0.62, 0.94, 1).multiplyScalar(2.4 * breathe);
  }
}
