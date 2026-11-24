import * as THREE from 'three';
import type { Physics } from '../world/physics';

// Caméra à la troisième personne, souple, qui évite les murs et se rapproche dans les couloirs.

export class ThirdPersonCamera {
  cam: THREE.PerspectiveCamera;
  yaw = Math.PI;
  pitch = 0.28;
  dist = 3.4;
  private curDist = 3.4;
  private target = new THREE.Vector3();
  private idle = 0;
  shake = 0;
  constructor(cam: THREE.PerspectiveCamera) { this.cam = cam; }

  snap(p: THREE.Vector3, yaw: number) {
    this.yaw = yaw; this.target.copy(p).add(new THREE.Vector3(0, 0.85, 0)); this.curDist = this.dist;
  }

  update(dt: number, look: THREE.Vector2, playerPos: THREE.Vector3, playerVel: THREE.Vector3, ph: Physics, t: number) {
    this.yaw -= look.x; this.pitch += look.y;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -0.55, 1.15);
    // alignement automatique doux derrière le robot quand il avance et qu'on ne touche pas la caméra
    if (look.lengthSq() > 1e-6) this.idle = 0; else this.idle += dt;
    const hs = Math.hypot(playerVel.x, playerVel.z);
    if (this.idle > 1.5 && hs > 1.2) {
      const moveYaw = Math.atan2(-playerVel.x, -playerVel.z);
      let d = moveYaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 2.2) this.yaw += d * Math.min(1, dt * 0.6);
    }
    const want = playerPos.clone().add(new THREE.Vector3(0, 0.85, 0));
    this.target.lerp(want, 1 - Math.exp(-dt * 12));
    this.target.y += (want.y - this.target.y) * (1 - Math.exp(-dt * 6));

    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    // espace disponible (couloirs étroits → plus proche)
    let desired = this.dist;
    const hit = ph.raycast(this.target, dir, desired + 0.3, true);
    if (hit) desired = Math.max(0.6, hit.dist - 0.3);
    // rapprochement rapide, éloignement lent
    this.curDist += (desired - this.curDist) * (desired < this.curDist ? 1 - Math.exp(-dt * 20) : 1 - Math.exp(-dt * 2.5));
    const pos = this.target.clone().addScaledVector(dir, this.curDist);
    // décalage latéral léger (épaule)
    const side = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(0.0);
    pos.add(side);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      pos.x += (Math.random() - 0.5) * this.shake * 0.08; pos.y += (Math.random() - 0.5) * this.shake * 0.08;
    }
    this.cam.position.copy(pos);
    this.cam.lookAt(this.target.x, this.target.y + Math.sin(t * 0.7) * 0.004, this.target.z);
  }
}
