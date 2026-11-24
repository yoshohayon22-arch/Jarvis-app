import * as THREE from 'three';
import { Builder, rbox, bcyl, lathe, type V3 } from '../robots/parts';
import * as M from '../robots/materials';
import { holoMaterial, HoloPerson, projectorBase } from '../fx/hologram';
import type { Kit } from './kit';
import { CREW } from '../story/crew';

// Éléments interactifs réutilisables de la station.

/** Hologramme : un projecteur, des silhouettes, et (option) leur reflet dans une vitre. */
export class Hologram {
  group = new THREE.Group();
  people: Record<string, HoloPerson> = {};
  mat = holoMaterial();
  reflMat: THREE.ShaderMaterial | null = null;
  base: ReturnType<typeof projectorBase>;
  level = 0; target = 0;
  private extra: THREE.Object3D[] = [];
  constructor(kit: Kit, pos: V3, crew: { id: string; x: number; z: number; yaw: number }[], opts: { reflectZ?: number; robot?: [number, number, number] } = {}) {
    this.base = projectorBase(kit.m.dark);
    this.group.add(this.base.group);
    for (const c of crew) {
      const info = CREW[c.id];
      const p = new HoloPerson(this.mat, { female: info.female, height: info.height });
      p.position.set(c.x, 0.12, c.z); p.baseYaw = c.yaw; p.rotation.y = c.yaw;
      this.people[c.id] = p; this.group.add(p);
    }
    if (opts.robot) {
      // petite silhouette de R-12 posée sur l'établi
      const r = new THREE.Group();
      const add = (g: THREE.BufferGeometry, p: V3) => { const m = new THREE.Mesh(g, this.mat); m.position.set(...p); r.add(m); };
      add(new THREE.BoxGeometry(0.42, 0.3, 0.32), [0, 0.55, 0]); add(new THREE.BoxGeometry(0.44, 0.27, 0.29), [0, 0.9, 0]);
      add(new THREE.BoxGeometry(0.1, 0.3, 0.1), [0.1, 0.22, 0]); add(new THREE.BoxGeometry(0.1, 0.3, 0.1), [-0.1, 0.22, 0]);
      r.position.set(...opts.robot); r.rotation.y = -0.6;
      this.group.add(r); this.extra.push(r);
    }
    this.group.position.set(...pos);
    if (opts.reflectZ !== undefined) {
      // reflet dans la vitre : copie miroir, plus pâle, derrière le plan du verre
      this.reflMat = holoMaterial(new THREE.Color(0.12, 0.35, 0.8));
      const mirror = new THREE.Group();
      for (const c of crew) {
        const info = CREW[c.id];
        const p = new HoloPerson(this.reflMat, { female: info.female, height: info.height });
        p.position.set(c.x, 0.12, c.z); p.rotation.y = c.yaw; p.userData.src = c.id;
        mirror.add(p);
      }
      const dz = opts.reflectZ - pos[2];
      mirror.scale.z = -1; mirror.position.set(pos[0], pos[1], opts.reflectZ + dz);
      this.mirror = mirror;
    }
  }
  mirror: THREE.Group | null = null;
  update(dt: number, t: number) {
    this.level += (this.target - this.level) * Math.min(1, dt * 2.5);
    const flick = this.level > 0.02 ? (Math.random() < 0.03 ? 0.4 : 1) : 0;
    this.mat.uniforms.uAlpha.value = this.level * flick;
    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uGlitch.value = this.level < 0.9 ? 1 - this.level : (Math.random() < 0.01 ? 1 : 0);
    this.base.beamMat.uniforms.uPower.value = this.level;
    for (const p of Object.values(this.people)) { p.visible = this.level > 0.01; p.update(dt, t); }
    for (const e of this.extra) e.visible = this.level > 0.01;
    if (this.mirror && this.reflMat) {
      this.reflMat.uniforms.uAlpha.value = this.level * flick * 0.35;
      this.reflMat.uniforms.uTime.value = t;
      for (const c of this.mirror.children) {
        const src = this.people[c.userData.src as string];
        c.visible = this.level > 0.01;
        (c as HoloPerson).gesture = src.gesture;
        (c as HoloPerson).update(dt, t);
      }
    }
  }
}

/** Arc électrique zigzaguant (trois branches). */
export class Arc {
  segs: THREE.Mesh[] = [];
  constructor(public from: THREE.Vector3, public to: THREE.Vector3, group: THREE.Group, mat: THREE.Material) {
    const g = new THREE.CylinderGeometry(0.012, 0.012, 1, 5, 1, true);
    g.translate(0, 0.5, 0);
    for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(g, mat); m.visible = false; m.frustumCulled = false; group.add(m); this.segs.push(m); }
  }
  draw() {
    let si = 0;
    for (let b = 0; b < 3; b++) {
      let prev = this.from.clone();
      const end = this.to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.0, 0, (Math.random() - 0.5) * 1.0));
      for (let i = 1; i <= 6; i++) {
        const p = this.from.clone().lerp(end, i / 6);
        if (i < 6) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.35));
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

/** Empreintes révélées par le scanner (s'estompent après quelques secondes). */
export class Footprints {
  mesh: THREE.InstancedMesh;
  private mat: THREE.MeshBasicMaterial;
  reveal = 0;
  constructor(path: [number, number, number][], color = new THREE.Color(0.3, 1.4, 2.2), spacing = 0.55) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(32, 42, 18, 30, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(32, 100, 14, 20, 0, 0, Math.PI * 2); g.fill();
    const tex = new THREE.CanvasTexture(c);
    this.mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    // échantillonner le chemin
    const pts: { p: THREE.Vector3; yaw: number; side: number }[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const a = new THREE.Vector3(...path[i]), b = new THREE.Vector3(...path[i + 1]);
      const len = a.distanceTo(b); const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      for (let d = 0; d < len; d += spacing) pts.push({ p: a.clone().lerp(b, d / len), yaw, side: pts.length % 2 ? 1 : -1 });
    }
    const geo = new THREE.PlaneGeometry(0.12, 0.26); geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, this.mat, pts.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    pts.forEach((f, i) => {
      const off = new THREE.Vector3(Math.cos(f.yaw) * 0.09 * f.side, 0.015, -Math.sin(f.yaw) * 0.09 * f.side);
      q.setFromEuler(new THREE.Euler(0, f.yaw + Math.PI, 0));
      m.compose(f.p.clone().add(off), q, s);
      this.mesh.setMatrixAt(i, m);
    });
    this.mesh.renderOrder = 6;
    this.mesh.frustumCulled = false;
  }
  update(dt: number) {
    this.reveal = Math.max(0, this.reveal - dt);
    this.mat.opacity = Math.min(1, this.reveal / 2) * (0.75 + 0.25 * Math.sin(this.reveal * 6));
    this.mesh.visible = this.reveal > 0;
  }
}

/** Jet de vapeur brûlante intermittent (danger). */
export class SteamJet {
  group = new THREE.Group();
  private col: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  t: number;
  state: 'idle' | 'warn' | 'on' = 'idle';
  box: THREE.Box3;
  constructor(public pos: THREE.Vector3, public height: number, public period = 4.2, public onTime = 1.4, phase = 0, radius = 0.55) {
    this.t = phase;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPower: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: `uniform float uTime; uniform float uPower; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.5);
          float k = n(vec2(vUv.x * 8.0, vUv.y * 4.0 - uTime * 6.0));
          float a = f * (0.4 + 0.6 * k) * (1.0 - vUv.y * 0.7) * uPower * 0.55;
          gl_FragColor = vec4(vec3(0.85, 0.9, 0.95) * a, a); }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const g = new THREE.CylinderGeometry(radius * 1.3, radius * 0.5, height, 20, 4, true);
    g.translate(0, height / 2, 0);
    this.col = new THREE.Mesh(g, this.mat);
    this.group.add(this.col);
    this.group.position.copy(pos);
    this.box = new THREE.Box3(pos.clone().add(new THREE.Vector3(-radius, 0, -radius)), pos.clone().add(new THREE.Vector3(radius, height, radius)));
  }
  update(dt: number, time: number) {
    this.t = (this.t + dt) % this.period;
    const warnStart = this.period - this.onTime - 0.9;
    this.state = this.t > this.period - this.onTime ? 'on' : this.t > warnStart ? 'warn' : 'idle';
    const target = this.state === 'on' ? 1 : this.state === 'warn' ? 0.12 : 0;
    const p = this.mat.uniforms.uPower;
    p.value += (target - p.value) * Math.min(1, dt * 10);
    this.mat.uniforms.uTime.value = time;
    this.col.visible = p.value > 0.01;
  }
}

/** Volet à lamelles qui se relève (baie d'observation). */
export class Shutter {
  group = new THREE.Group();
  private slats: THREE.Mesh[] = [];
  open = 0; target = 0;
  constructor(kit: Kit, center: THREE.Vector3, w: number, h: number, n = 8) {
    const sh = h / n;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(rbox(w, sh * 1.02, 0.14, 0.02), kit.m.shutter);
      m.position.set(0, -h / 2 + sh * (i + 0.5), 0);
      m.castShadow = true;
      m.userData.y0 = m.position.y;
      this.group.add(m); this.slats.push(m);
    }
    this.group.position.copy(center);
    this.h = h;
  }
  private h: number;
  update(dt: number) {
    this.open += Math.sign(this.target - this.open) * Math.min(Math.abs(this.target - this.open), dt * 0.12);
    // les lamelles se replient vers le haut, celle du bas en dernier
    this.slats.forEach((s, i) => {
      const k = THREE.MathUtils.clamp(this.open * 1.4 - (i / this.slats.length) * 0.4, 0, 1);
      const top = this.h / 2 + 0.1;
      s.position.y = THREE.MathUtils.lerp(s.userData.y0 as number, top - (this.slats.length - 1 - i) * 0.05, k);
      s.scale.y = 1 - k * 0.8;
    });
  }
}

/** Vanne (volant qui tourne). */
export class Valve {
  group = new THREE.Group();
  wheel: THREE.Mesh;
  lampMat: THREE.MeshBasicMaterial;
  open = false; spin = 0;
  constructor(kit: Kit, pos: THREE.Vector3, ry = 0) {
    const B = new Builder();
    B.add(this.group, kit.m.steel, bcyl(0.12, 1.0, 0.02, 16), [0, 0.5, 0]);
    B.add(this.group, kit.m.dark, rbox(0.5, 0.3, 0.3, 0.04), [0, 1.05, 0]);
    B.add(this.group, kit.m.orange, bcyl(0.09, 0.3, 0.02, 14), [0, 1.05, 0.25], [Math.PI / 2, 0, 0]);
    B.build();
    this.wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 28), kit.m.orange as THREE.Material);
    this.wheel.position.set(0, 1.05, 0.42); this.wheel.castShadow = true;
    const spokes = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.04), kit.m.orange as THREE.Material);
    const sp2 = spokes.clone(); sp2.rotation.z = Math.PI / 2;
    this.wheel.add(spokes, sp2);
    this.group.add(this.wheel);
    this.lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.05) });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), this.lampMat);
    lamp.position.set(0.2, 1.25, 0.1); this.group.add(lamp);
    this.group.position.copy(pos); this.group.rotation.y = ry;
  }
  update(dt: number) {
    if (this.spin > 0) { this.spin -= dt; this.wheel.rotation.z += dt * 6; }
    this.lampMat.color.setRGB(this.open ? 0.2 : 3, this.open ? 3 : 0.2, 0.1);
  }
}

/** Navette H-1 (procédurale). */
export function buildShuttle(kit: Kit) {
  const g = new THREE.Group();
  const B = new Builder();
  const hull = M.paint(0xd8dce0, { wear: 0.8, scratches: 0.4, dirt: 0.35, rough: 0.45 });
  const stripe = kit.m.orange;
  const body = lathe([[0, -4.2], [0.6, -4.0], [1.25, -3.2], [1.5, -1.5], [1.5, 1.8], [1.3, 3.0], [0.9, 3.8], [0.5, 4.2], [0, 4.35]], 32);
  body.rotateX(Math.PI / 2); body.scale(1, 0.75, 1);
  B.add(g, hull, body, [0, 1.6, 0]);
  B.add(g, stripe, rbox(3.08, 0.25, 2.2, 0.05), [0, 1.9, -0.4]);
  const glass = M.glossyBlack();
  const cock = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2); cock.scale(0.85, 0.5, 1.2);
  B.add(g, glass, cock, [0, 2.2, 2.6], [0.25, 0, 0]);
  for (const s of [1, -1]) {
    B.add(g, hull, rbox(3.4, 0.18, 2.2, 0.06), [s * 2.6, 1.3, -1.2], [0, s * -0.25, s * -0.08]);
    B.add(g, kit.m.dark, bcyl(0.45, 1.6, 0.05, 20), [s * 1.2, 1.4, -4.3], [Math.PI / 2, 0, 0]);
    B.add(g, kit.m.dark, rbox(0.2, 1.1, 0.25, 0.04), [s * 1.0, 0.55, 1.6]);
    B.add(g, kit.m.dark, rbox(0.2, 1.1, 0.25, 0.04), [s * 1.0, 0.55, -2.2]);
  }
  B.add(g, hull, rbox(0.25, 1.6, 1.6, 0.06), [0, 2.9, -3.0], [-0.3, 0, 0]);
  B.add(g, kit.sign('H-1', 'HALCYON'), new THREE.PlaneGeometry(1.2, 0.3), [1.505, 1.6, 0.5], [0, Math.PI / 2, 0]);
  B.build();
  const engMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
  for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), engMat); e.position.set(s * 1.2, 1.4, -5.11); e.rotation.y = Math.PI; g.add(e); }
  return { group: g, engMat };
}

/** Coque extérieure de la station (visible seulement pendant la cinématique de départ). */
export function buildStationExterior(kit: Kit) {
  const g = new THREE.Group();
  const B = new Builder();
  const hull = M.paint(0xc8ccd2, { wear: 0.6, scratches: 0.3, dirt: 0.4, rough: 0.55, scale: 0.15 });
  const dark = kit.m.dark;
  // modules principaux (enveloppent l'intérieur)
  B.add(g, hull, rbox(80, 14, 90, 3), [10, 4, -30]);
  B.add(g, dark, rbox(82, 2, 92, 1), [10, 4, -30]);
  // anneau et panneaux solaires
  B.add(g, hull, new THREE.TorusGeometry(70, 3, 12, 64), [10, 4, -30], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    B.add(g, dark, rbox(4, 1.2, 60, 0.3), [10 + Math.cos(a) * 35, 4, -30 + Math.sin(a) * 35], [0, -a, 0]);
  }
  for (const s of [1, -1]) {
    const panel = M.paint(0x1a2a4a, { wear: 0, scratches: 0.1, dirt: 0.1, rough: 0.2 });
    B.add(g, panel, rbox(60, 0.4, 18, 0.1), [10 + s * 110, 4, -30]);
    B.add(g, dark, rbox(40, 1.5, 1.5, 0.2), [10 + s * 80, 4, -30]);
  }
  B.add(g, hull, bcyl(12, 30, 2, 32), [10, 26, -30]);
  B.add(g, kit.sign('HALCYON', 'STATION ORBITALE'), new THREE.PlaneGeometry(30, 7.5), [50.2, 8, -10], [0, Math.PI / 2, 0]);
  B.build(false);
  const lights = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.5, 1.6) });
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.2), lights);
    m.position.set(50.25, -1 + Math.floor(i / 10) * 2.5, -70 + (i % 10) * 8); m.rotation.y = Math.PI / 2;
    g.add(m);
  }
  g.visible = false;
  return g;
}
