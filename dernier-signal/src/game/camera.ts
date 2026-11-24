import * as THREE from 'three';
import type { Physics } from '../world/physics';

// Caméra à la troisième personne, souple, qui évite les murs, se rapproche dans les couloirs
// et suit le « haut » du robot (plafond, murs magnétiques) en basculant en douceur.

const Y = new THREE.Vector3(0, 1, 0);

export class ThirdPersonCamera {
  cam: THREE.PerspectiveCamera;
  yaw = Math.PI;
  pitch = 0.28;
  dist = 3.4;
  /** Repère local (y local = haut du robot) → monde. */
  frame = new THREE.Quaternion();
  private curDist = 3.4;
  private target = new THREE.Vector3();
  private idle = 0;
  shake = 0;
  constructor(cam: THREE.PerspectiveCamera) { this.cam = cam; }

  get up() { return Y.clone().applyQuaternion(this.frame); }
  forward() { return this.cam.getWorldDirection(new THREE.Vector3()); }

  snap(p: THREE.Vector3, yaw: number) {
    this.yaw = yaw; this.frame.identity();
    this.target.copy(p).add(new THREE.Vector3(0, 0.85, 0)); this.curDist = this.dist;
  }

  update(dt: number, look: THREE.Vector2, playerPos: THREE.Vector3, playerVel: THREE.Vector3, playerUp: THREE.Vector3, ph: Physics, t: number) {
    // bascule progressive du repère vers le haut du robot
    const curUp = this.up;
    if (curUp.dot(playerUp) < 0.9999) {
      const delta = new THREE.Quaternion().setFromUnitVectors(curUp, playerUp.clone().normalize());
      const part = new THREE.Quaternion().slerp(delta, Math.min(1, dt * 3.5));
      this.frame.premultiply(part).normalize();
    }
    const up = this.up;
    this.yaw -= look.x; this.pitch += look.y;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -0.55, 1.15);
    if (look.lengthSq() > 1e-6) this.idle = 0; else this.idle += dt;
    const inv = this.frame.clone().invert();
    const vl = playerVel.clone().applyQuaternion(inv);
    const hs = Math.hypot(vl.x, vl.z);
    if (this.idle > 1.5 && hs > 1.2) {
      const moveYaw = Math.atan2(-vl.x, -vl.z);
      let d = moveYaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 2.2) this.yaw += d * Math.min(1, dt * 0.6);
    }
    const want = playerPos.clone().addScaledVector(up, 0.85);
    this.target.lerp(want, 1 - Math.exp(-dt * 12));

    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)).applyQuaternion(this.frame);
    let desired = this.dist;
    const hit = ph.raycast(this.target, dir, desired + 0.3, true);
    if (hit) desired = Math.max(0.6, hit.dist - 0.3);
    this.curDist += (desired - this.curDist) * (desired < this.curDist ? 1 - Math.exp(-dt * 20) : 1 - Math.exp(-dt * 2.5));
    const pos = this.target.clone().addScaledVector(dir, this.curDist);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      pos.x += (Math.random() - 0.5) * this.shake * 0.08; pos.y += (Math.random() - 0.5) * this.shake * 0.08;
    }
    this.cam.position.copy(pos);
    this.cam.up.copy(up);
    this.cam.lookAt(this.target.x, this.target.y + Math.sin(t * 0.7) * 0.004, this.target.z);
  }
}
