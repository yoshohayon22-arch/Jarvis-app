import { clamp, damp } from "../core/math";
import { rayAabb, type Aabb } from "../sim/collision";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const CAMERA_TUNING = {
  pivotHeight: 1.55,
  shoulderOffset: 0.45,
  minDistance: 1.6,
  maxDistance: 10,
  defaultDistance: 5.2,
  minPitch: -0.35,
  maxPitch: 1.25,
  mouseSensitivity: 0.0025,
  zoomStep: 0.0018,
  /** Distance easing (out = recovering after an obstacle, in = snapping in front of a wall). */
  easeOut: 4,
  wallPadding: 0.3,
  followRate: 18,
};

/**
 * Third-person orbit camera. Pure math (no three.js) so it can be unit tested.
 * yaw = 0 puts the camera south of the player (+z) looking north.
 */
export class CameraRig {
  yaw = 0;
  pitch = 0.32;
  desiredDistance = CAMERA_TUNING.defaultDistance;
  distance = CAMERA_TUNING.defaultDistance;
  readonly pivot: Vec3 = { x: 0, y: 0, z: 0 };
  readonly position: Vec3 = { x: 0, y: 0, z: 0 };
  private initialized = false;

  look(dx: number, dy: number): void {
    const s = CAMERA_TUNING.mouseSensitivity;
    this.yaw -= dx * s;
    this.pitch = clamp(this.pitch + dy * s, CAMERA_TUNING.minPitch, CAMERA_TUNING.maxPitch);
  }

  zoom(wheelDelta: number): void {
    this.desiredDistance = clamp(
      this.desiredDistance * (1 + wheelDelta * CAMERA_TUNING.zoomStep),
      CAMERA_TUNING.minDistance,
      CAMERA_TUNING.maxDistance,
    );
  }

  /** Horizontal forward/right vectors used to make movement camera-relative. */
  basis(): { fx: number; fz: number; rx: number; rz: number } {
    return { fx: -Math.sin(this.yaw), fz: -Math.cos(this.yaw), rx: Math.cos(this.yaw), rz: -Math.sin(this.yaw) };
  }

  update(target: Vec3, dt: number, blockers: readonly Aabb[]): void {
    const T = CAMERA_TUNING;
    const { rx, rz } = this.basis();
    const px = target.x + rx * T.shoulderOffset;
    const py = target.y + T.pivotHeight;
    const pz = target.z + rz * T.shoulderOffset;
    if (!this.initialized) {
      this.pivot.x = px;
      this.pivot.y = py;
      this.pivot.z = pz;
      this.initialized = true;
    } else {
      const k = damp(T.followRate, dt);
      this.pivot.x += (px - this.pivot.x) * k;
      this.pivot.y += (py - this.pivot.y) * k;
      this.pivot.z += (pz - this.pivot.z) * k;
    }

    const cp = Math.cos(this.pitch);
    const dx = Math.sin(this.yaw) * cp;
    const dy = Math.sin(this.pitch);
    const dz = Math.cos(this.yaw) * cp;

    // Pull the camera in front of any wall between the pivot and the desired position.
    let hit = this.desiredDistance + T.wallPadding;
    for (const b of blockers) {
      const t = rayAabb(this.pivot.x, this.pivot.y, this.pivot.z, dx, dy, dz, b);
      if (t < hit) hit = t;
    }
    // Keep above the ground.
    if (dy < 0) hit = Math.min(hit, (this.pivot.y - 0.25) / -dy);
    const allowed = Math.max(T.minDistance * 0.5, Math.min(this.desiredDistance, hit - T.wallPadding));

    if (allowed < this.distance) {
      // Never let a wall come between the player and the camera: snap in.
      this.distance = allowed;
    } else {
      this.distance += (allowed - this.distance) * damp(T.easeOut, dt);
    }

    this.position.x = this.pivot.x + dx * this.distance;
    this.position.y = this.pivot.y + dy * this.distance;
    this.position.z = this.pivot.z + dz * this.distance;
  }
}
