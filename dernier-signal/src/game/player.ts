import * as THREE from 'three';
import { CompactRobot } from '../robots/compact';
import type { Robot } from '../robots/Robot';
import { Body, type Physics, type Axis } from '../world/physics';
import type { Input } from './input';
import type { AudioEngine } from '../audio/audio';
import { Particles } from '../fx/particles';
import { LightCone } from '../fx/volumetric';
import type { Quality } from '../core/quality';

// Le joueur : R-12 (design B · Rouille), physique, jetpack, lampe frontale.

export class Player {
  robot: Robot;
  body = new Body();
  yaw = Math.PI;              // orientation du robot
  hasJetpack = false;
  energy = 1;                 // jauge du jetpack
  jetting = false;
  controllable = true;
  headlamp: THREE.SpotLight;
  private beam: LightCone | null = null;
  private coyote = 0;
  private jumpHeld = 0;
  private stepAcc = 0;
  private stepSide = 0;
  private scanT = 0;
  private airTime = 0;
  private wasGrounded = true;
  private dust: Particles;
  speed = 0;
  lampLevel = 1;
  /** Lampe frontale allumée / éteinte par le joueur. */
  lampOn = false;
  /** Force externe (m/s²) : aspiration de la brèche, etc. */
  external = new THREE.Vector3();
  private lampFade = 1;

  constructor(scene: THREE.Scene, q: Quality) {
    this.robot = new CompactRobot('rouille');
    this.robot.gameMode = true;
    this.robot.enableLight(q.robotLights);
    scene.add(this.robot);
    scene.add(this.robot.wave);
    this.robot.wave.maxRadius = 9; this.robot.wave.duration = 1.9;
    this.robot.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });

    // lampe frontale (seule source d'ombres)
    const head = this.robot.j.head;
    this.headlamp = new THREE.SpotLight(0xdfeaff, 26, 18, 0.48, 0.55, 1.6);
    this.headlamp.position.set(0, 0.16, 0.2);
    this.headlamp.castShadow = true;
    this.headlamp.shadow.mapSize.setScalar((q.id === 'equilibre' || q.id === 'econome') ? 1024 : 2048);
    this.headlamp.shadow.bias = -0.0004; this.headlamp.shadow.normalBias = 0.03; this.headlamp.shadow.radius = 3;
    this.headlamp.shadow.camera.near = 0.3; this.headlamp.shadow.camera.far = 18;
    const tgt = new THREE.Object3D(); tgt.position.set(0, -0.35, 4);
    head.add(this.headlamp, tgt);
    this.headlamp.target = tgt;
    if (q.volumetric) {
      this.beam = new LightCone(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.5, 6), 2.6, 0xcfe0ff, 0.035, -100);
      this.beam.position.set(0, 0.16, 0.22);
      this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, -0.08, 1).normalize());
      head.add(this.beam);
    }
    this.dust = new Particles({ max: 120, additive: false, gravity: -0.2, drag: 2.5, soft: true, grow: 2 });
    scene.add(this.dust);
  }

  get pos() { return this.body.pos; }

  teleport(p: THREE.Vector3, yaw: number) {
    this.body.pos.copy(p); this.body.vel.set(0, 0, 0); this.yaw = yaw; this.energy = 1;
    this.body.setUp('y', 1); this.visUp.set(0, 1, 0);
    this.facing.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.robot.position.copy(p); this.robot.quaternion.setFromEuler(new THREE.Euler(0, yaw, 0));
  }

  scan() { if (this.scanT <= 0) { this.scanT = 1.6; this.robot.wave.trigger(); return true; } return false; }

  /** Environnement fourni par la zone à chaque image. */
  env: { zeroG: boolean; forcedUp: { axis: Axis; sign: number } | null; magnetic: boolean } = { zeroG: false, forcedUp: null, magnetic: false };
  hasBoots = false;
  /** Direction de regard du robot (monde), dans le plan perpendiculaire au haut. */
  facing = new THREE.Vector3(0, 0, -1);
  /** « Haut » visuel lissé (orientation du robot et de la caméra). */
  visUp = new THREE.Vector3(0, 1, 0);
  private airLoose = 0;
  floating = false;

  get up() { return this.floating ? this.visUp.clone() : this.body.up; }

  update(dt: number, t: number, input: Input, camQ: THREE.Quaternion, camYaw: number, camFwd: THREE.Vector3, ph: Physics, audio: AudioEngine) {
    const b = this.body;
    const env = this.env;
    // ---- gravité imposée (section de gravité folle) ----
    if (env.forcedUp && (b.upAxis !== env.forcedUp.axis || b.upSign !== env.forcedUp.sign)) {
      b.reorient(env.forcedUp.axis, env.forcedUp.sign);
      b.grounded = false;
    }
    const attached = this.hasBoots && env.magnetic && (b.grounded || this.airLoose < 0.35);
    this.floating = env.zeroG && !attached && !env.forcedUp;
    if (!env.forcedUp && !env.magnetic && !this.floating && (b.upAxis !== 'y' || b.upSign !== 1)) { b.reorient('y', 1); }

    const mv = this.controllable ? input.move : new THREE.Vector2();
    const fwdL = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw)).applyQuaternion(camQ);
    const rightL = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw)).applyQuaternion(camQ);

    if (this.floating) {
      // ---- apesanteur : 6 directions ----
      const upW = new THREE.Vector3(0, 1, 0).applyQuaternion(camQ);
      const ud = this.controllable ? (input.held.has('up') || input.held.has('jump') ? 1 : 0) - (input.held.has('down') ? 1 : 0) : 0;
      const wish = new THREE.Vector3().addScaledVector(camFwd, mv.y).addScaledVector(rightL, mv.x).addScaledVector(upW, ud);
      if (wish.lengthSq() > 1) wish.normalize();
      b.vel.addScaledVector(wish, 5.5 * dt);
      b.vel.addScaledVector(this.external, dt);
      b.vel.multiplyScalar(Math.exp(-0.9 * dt));
      if (b.vel.length() > 3.6) b.vel.setLength(3.6);
      this.jetting = wish.lengthSq() > 0.01;
      if (this.jetting) { audio.loop('jet', 'jet', this.pos, 0); audio.setLoop('jet', 0.25 + wish.length() * 0.2); audio.moveLoop('jet', this.pos); }
      else audio.setLoop('jet', 0);
      b.move(ph, dt);
      if (b.vel.lengthSq() > 0.05) {
        const v = b.vel.clone(); v.addScaledVector(this.visUp, -v.dot(this.visUp));
        if (v.lengthSq() > 0.01) this.facing.lerp(v.normalize(), Math.min(1, dt * 4)).normalize();
      }
      this.speed = b.vel.length();
      this.airLoose = 1;
      this.visUp.lerp(new THREE.Vector3(0, 1, 0), Math.min(1, dt * 1.5)).normalize();
    } else {
      const up = b.up;
      // déplacement dans le plan du sol courant
      const fwd = fwdL.clone().addScaledVector(up, -fwdL.dot(up));
      const right = rightL.clone().addScaledVector(up, -rightL.dot(up));
      if (fwd.lengthSq() < 1e-4) fwd.copy(new THREE.Vector3(0, 1, 0).applyQuaternion(camQ)).addScaledVector(up, -up.dot(new THREE.Vector3(0, 1, 0).applyQuaternion(camQ)));
      fwd.normalize(); right.normalize();
      const wish = new THREE.Vector3().addScaledVector(right, mv.x).addScaledVector(fwd, mv.y);
      const mag = Math.min(1, wish.length());
      const maxSpeed = 2.3;
      const target = wish.clone().normalize().multiplyScalar(mag * maxSpeed * (this.scanT > 0.6 ? 0.25 : 1));
      target.addScaledVector(this.external, 0.55);
      const vUp = b.vel.dot(up);
      const hv = b.vel.clone().addScaledVector(up, -vUp);
      const accel = b.grounded ? 16 : 6;
      hv.lerp(target, Math.min(1, accel * dt / Math.max(0.5, hv.distanceTo(target) + 0.5) * 2));
      let vu = vUp;
      // saut / jetpack
      if (b.grounded) this.coyote = 0.12; else this.coyote -= dt;
      const jumpDown = this.controllable && input.held.has('jump');
      if (this.controllable && input.wasPressed('jump') && this.coyote > 0) {
        vu = Math.sqrt(2 * 20 * 0.95);
        this.coyote = 0; this.jumpHeld = 0;
        audio.jump(this.pos);
        for (let i = 0; i < 8; i++) this.puff(0.4);
      }
      this.jumpHeld = jumpDown ? this.jumpHeld + dt : 0;
      const wantJet = this.hasJetpack && !b.grounded && jumpDown && (this.jumpHeld > 0.2 || vu < 0.5 || input.wasPressed('jump'));
      this.jetting = wantJet && this.energy > 0;
      if (this.jetting) {
        vu = Math.min(vu + 34 * dt, 3.4);
        this.energy = Math.max(0, this.energy - dt / 1.35);
        audio.loop('jet', 'jet', this.pos, 0); audio.setLoop('jet', 0.55); audio.moveLoop('jet', this.pos);
        if (Math.random() < 0.5) input.rumble(0.15, 0.25, 60);
      } else audio.setLoop('jet', 0);
      if (b.grounded) this.energy = Math.min(1, this.energy + dt * 0.9);
      vu = Math.max(vu - 20 * dt, -18);
      b.vel.copy(hv).addScaledVector(up, vu);
      const wasG = b.grounded;
      b.move(ph, dt);
      // ---- bottes magnétiques : passer sur un mur / un plafond, ou contourner une arête ----
      if (this.hasBoots && env.magnetic && !env.forcedUp) this.magnetize(ph, wasG, audio);
      this.airLoose = b.grounded ? 0 : this.airLoose + dt;
      if (!b.grounded && this.airLoose > 0.6 && !env.forcedUp && (b.upAxis !== 'y' || b.upSign !== 1) && !(env.zeroG)) { b.reorient('y', 1); }
      // atterrissage
      if (!b.grounded) this.airTime += dt;
      if (b.grounded && !this.wasGrounded) {
        const power = Math.min(1.4, this.airTime * 1.6);
        if (this.airTime > 0.15) { audio.land(this.pos, power); input.rumble(0.3 * power, 0.2, 90); for (let i = 0; i < 10 * power; i++) this.puff(0.6); }
        this.airTime = 0;
      }
      this.wasGrounded = b.grounded;
      const hvel = b.vel.clone().addScaledVector(b.up, -b.vel.dot(b.up));
      this.speed = hvel.length();
      if (b.grounded && this.speed > 0.4) {
        this.stepAcc += this.speed * dt;
        if (this.stepAcc > 0.36) { this.stepAcc = 0; this.stepSide ^= 1; audio.step(b.ground?.surface ?? 'metal', this.pos, 0.7 + this.speed * 0.1); if (this.stepSide && Math.random() < 0.15) audio.servo(this.pos, 0.6); }
      }
      if (this.speed > 0.3 && this.controllable) this.facing.lerp(hvel.normalize(), Math.min(1, dt * 10));
      this.facing.addScaledVector(b.up, -this.facing.dot(b.up));
      if (this.facing.lengthSq() < 1e-4) this.facing.copy(fwd);
      this.facing.normalize();
      this.visUp.lerp(b.up, Math.min(1, dt * 9)).normalize();
    }

    // ---- orientation du robot : haut = visUp, avant = facing ----
    const U = this.visUp.clone();
    const Fw = this.facing.clone().addScaledVector(U, -this.facing.dot(U));
    if (Fw.lengthSq() < 1e-4) Fw.set(0, 0, 1).addScaledVector(U, -U.z);
    Fw.normalize();
    const R = new THREE.Vector3().crossVectors(U, Fw).normalize();
    this.robot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(R, U, Fw));
    this.robot.position.copy(b.pos);
    this.yaw = Math.atan2(this.facing.x, this.facing.z);

    // ---- animation ----
    this.scanT = Math.max(0, this.scanT - dt);
    const r = this.robot;
    r.walkSpeed = this.speed / 2.2;
    r.groundSpeed = b.grounded && !this.floating ? this.speed : 0;
    if (this.scanT > 0) r.setAction('scan');
    else if (this.floating) r.setAction('float');
    else if (!b.grounded) r.setAction(this.jetting ? 'jetpack' : 'fall');
    else if (this.speed > 0.35) r.setAction('walk');
    else r.setAction('idle');
    r.update(dt, t);
    for (const f of r.flames) { f.power += ((this.jetting ? 1 : 0) - f.power) * Math.min(1, dt * 14); f.update(t); }
    if (r.light) { r.light.intensity = 0.05 + (this.jetting ? 1.6 : 0); }
    if (this.jetting && Math.random() < 0.7) this.puff(0.25, true);
    r.wave.position.copy(b.pos);
    r.wave.update(dt, t, b.pos.y);

    this.lampFade += ((this.lampOn ? 1 : 0) - this.lampFade) * Math.min(1, dt * 14);
    this.headlamp.intensity = 26 * this.lampLevel * this.lampFade;
    this.headlamp.visible = this.lampFade > 0.01;
    if (this.beam) this.beam.visible = this.lampFade > 0.01;
    this.dust.update(dt);
  }

  /** Bottes magnétiques : changement de surface au contact d'une paroi, ou en contournant une arête. */
  private magnetize(ph: Physics, wasGrounded: boolean, audio: AudioEngine) {
    const b = this.body;
    const oldAxis = b.upAxis, oldSign = b.upSign;
    const hit = b.lateralHit;
    if (hit && b.grounded && (hit.collider.tag === 'mag' || (hit.axis === 'y' && -hit.dir > 0))) {
      const na = hit.axis, ns = -hit.dir;
      const p = b.pos.clone();
      p[na] = ns > 0 ? hit.collider.box.max[na] : hit.collider.box.min[na];
      p[oldAxis] += oldSign * (b.radius + 0.03);
      if (b.fits(ph, p, na, ns)) {
        b.pos.copy(p); b.setUp(na, ns); b.vel.set(0, 0, 0); b.grounded = true;
        audio.land(this.pos, 0.5); this.facing.set(0, 0, 0); this.facing[oldAxis] = oldSign;
        return;
      }
    }
    // arête : on vient de perdre le contact en avançant au-delà du bord
    if (!b.grounded && wasGrounded) {
      const up = new THREE.Vector3(); up[oldAxis] = oldSign;
      const v = b.vel.clone().addScaledVector(up, -b.vel.dot(up));
      if (v.lengthSq() < 0.01) return;
      const ax = (['x', 'y', 'z'] as Axis[]).filter((a) => a !== oldAxis).sort((a1, a2) => Math.abs(v[a2]) - Math.abs(v[a1]))[0];
      const s = Math.sign(v[ax]);
      // surface autour du coin : juste derrière nous, sous nos pieds
      const q = b.pos.clone(); q[oldAxis] -= oldSign * 0.25; q[ax] -= s * 0.35;
      const c = ph.colliders.find((cc) => cc.enabled && cc.box.containsPoint(q) && (cc.tag === 'mag' || (ax === 'y' && s > 0)));
      if (!c) return;
      const p = b.pos.clone();
      p[ax] = s > 0 ? c.box.max[ax] : c.box.min[ax];
      p[oldAxis] = (oldSign > 0 ? c.box.max[oldAxis] : c.box.min[oldAxis]) - oldSign * (b.radius + 0.05);
      if (b.fits(ph, p, ax, s)) {
        b.pos.copy(p); b.setUp(ax, s); b.vel.set(0, 0, 0); b.grounded = true;
        this.facing.set(0, 0, 0); this.facing[oldAxis] = -oldSign;
      }
    }
  }

  private puff(speed: number, jet = false) {
    const p = this.pos.clone();
    if (jet) { const back = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).multiplyScalar(0.2); p.add(back); p.y += 0.25; }
    p.x += (Math.random() - 0.5) * 0.3; p.z += (Math.random() - 0.5) * 0.3; p.y += 0.03;
    const v = new THREE.Vector3((Math.random() - 0.5) * speed, jet ? -0.8 : Math.random() * 0.25, (Math.random() - 0.5) * speed);
    this.dust.emit(p, v, jet ? 0.9 : 1.4, jet ? 0.05 : 0.07, new THREE.Color(0.55, 0.6, 0.68), jet ? 0.25 : 0.35);
  }
}
