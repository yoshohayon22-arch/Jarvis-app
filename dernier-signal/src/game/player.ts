import * as THREE from 'three';
import { CompactRobot } from '../robots/compact';
import type { Robot } from '../robots/Robot';
import { Body, type Physics } from '../world/physics';
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
    this.robot.position.copy(p); this.robot.rotation.y = yaw;
  }

  scan() { if (this.scanT <= 0) { this.scanT = 1.6; this.robot.wave.trigger(); return true; } return false; }

  update(dt: number, t: number, input: Input, camYaw: number, ph: Physics, audio: AudioEngine) {
    const b = this.body;
    // --- déplacement relatif à la caméra ---
    const mv = this.controllable ? input.move : new THREE.Vector2();
    const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3().addScaledVector(right, mv.x).addScaledVector(fwd, mv.y);
    const mag = Math.min(1, wish.length());
    const maxSpeed = 2.3;
    const target = wish.clone().normalize().multiplyScalar(mag * maxSpeed * (this.scanT > 0.6 ? 0.25 : 1));
    // une force externe (aspiration) déplace la vitesse « voulue » : on dérive malgré soi
    target.addScaledVector(this.external, 0.55);
    const accel = b.grounded ? 16 : 6;
    const hv = new THREE.Vector3(b.vel.x, 0, b.vel.z);
    hv.lerp(target, Math.min(1, accel * dt / Math.max(0.5, hv.distanceTo(target) + 0.5) * 2));
    b.vel.x = hv.x; b.vel.z = hv.z;

    // --- saut / jetpack ---
    if (b.grounded) this.coyote = 0.12; else this.coyote -= dt;
    const jumpDown = this.controllable && input.held.has('jump');
    if (this.controllable && input.wasPressed('jump') && this.coyote > 0) {
      b.vel.y = Math.sqrt(2 * 20 * 0.95);
      this.coyote = 0; this.jumpHeld = 0;
      audio.jump(this.pos);
      for (let i = 0; i < 8; i++) this.puff(0.4);
    }
    this.jumpHeld = jumpDown ? this.jumpHeld + dt : 0;
    const wantJet = this.hasJetpack && !b.grounded && jumpDown && (this.jumpHeld > 0.2 || b.vel.y < 0.5 || input.wasPressed('jump'));
    this.jetting = wantJet && this.energy > 0;
    if (this.jetting) {
      b.vel.y += 34 * dt;
      b.vel.y = Math.min(b.vel.y, 3.4);
      this.energy = Math.max(0, this.energy - dt / 1.35);
      audio.loop('jet', 'jet', this.pos, 0);
      audio.setLoop('jet', 0.55);
      audio.moveLoop('jet', this.pos);
      if (Math.random() < 0.5) input.rumble(0.15, 0.25, 60);
    } else {
      audio.setLoop('jet', 0);
    }
    if (b.grounded) this.energy = Math.min(1, this.energy + dt * 0.9);
    b.vel.y -= 20 * dt;
    b.vel.y = Math.max(b.vel.y, -18);

    b.move(ph, dt);

    // --- atterrissage ---
    if (!b.grounded) this.airTime += dt;
    if (b.grounded && !this.wasGrounded) {
      const power = Math.min(1.4, this.airTime * 1.6);
      if (this.airTime > 0.15) { audio.land(this.pos, power); input.rumble(0.3 * power, 0.2, 90); for (let i = 0; i < 10 * power; i++) this.puff(0.6); }
      this.airTime = 0;
    }
    this.wasGrounded = b.grounded;

    // --- pas ---
    this.speed = Math.hypot(b.vel.x, b.vel.z);
    if (b.grounded && this.speed > 0.4) {
      this.stepAcc += this.speed * dt;
      if (this.stepAcc > 0.36) { this.stepAcc = 0; this.stepSide ^= 1; audio.step(b.ground?.surface ?? 'metal', this.pos, 0.7 + this.speed * 0.1); if (this.stepSide && Math.random() < 0.15) audio.servo(this.pos, 0.6); }
    }

    // --- orientation ---
    if (this.speed > 0.3 && this.controllable) {
      const ty = Math.atan2(b.vel.x, b.vel.z);
      let d = ty - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 10);
    }
    this.robot.position.copy(b.pos);
    this.robot.rotation.y = this.yaw;

    // --- animation ---
    this.scanT = Math.max(0, this.scanT - dt);
    const r = this.robot;
    r.walkSpeed = this.speed / 2.2;
    r.groundSpeed = b.grounded ? this.speed : 0;
    if (this.scanT > 0) r.setAction('scan');
    else if (!b.grounded) r.setAction(this.jetting ? 'jetpack' : 'fall');
    else if (this.speed > 0.35) r.setAction('walk');
    else r.setAction('idle');
    r.update(dt, t);
    // flammes : pilotées par l'état réel du jetpack
    for (const f of r.flames) { f.power += ((this.jetting ? 1 : 0) - f.power) * Math.min(1, dt * 14); f.update(t); }
    if (r.light) { r.light.intensity = 0.05 + (this.jetting ? 1.6 : 0); }
    if (this.jetting && Math.random() < 0.7) this.puff(0.25, true);
    r.wave.position.set(b.pos.x, b.pos.y, b.pos.z);
    r.wave.update(dt, t, b.pos.y);

    this.lampFade += ((this.lampOn ? 1 : 0) - this.lampFade) * Math.min(1, dt * 14);
    this.headlamp.intensity = 26 * this.lampLevel * this.lampFade;
    this.headlamp.visible = this.lampFade > 0.01;
    if (this.beam) this.beam.visible = this.lampFade > 0.01;
    this.dust.update(dt);
  }

  private puff(speed: number, jet = false) {
    const p = this.pos.clone();
    if (jet) { const back = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).multiplyScalar(0.2); p.add(back); p.y += 0.25; }
    p.x += (Math.random() - 0.5) * 0.3; p.z += (Math.random() - 0.5) * 0.3; p.y += 0.03;
    const v = new THREE.Vector3((Math.random() - 0.5) * speed, jet ? -0.8 : Math.random() * 0.25, (Math.random() - 0.5) * speed);
    this.dust.emit(p, v, jet ? 0.9 : 1.4, jet ? 0.05 : 0.07, new THREE.Color(0.55, 0.6, 0.68), jet ? 0.25 : 0.35);
  }
}
