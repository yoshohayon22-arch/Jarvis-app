import { angleDelta, damp } from "../core/math";
import { resolveAll, type CollisionWorld } from "./collision";

export type MoveState = "idle" | "walk" | "run" | "dodge";

export interface PlayerInput {
  /** Desired horizontal direction in world space (already camera-relative). Length 0..1. */
  moveX: number;
  moveZ: number;
  run: boolean;
  /** Edge-triggered: true only on the frame the key was pressed. */
  dodge: boolean;
}

export interface PlayerState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Facing angle around Y. 0 = facing +z (south), PI = facing -z (north). */
  facing: number;
  state: MoveState;
  dodgeTime: number;
  dodgeCooldown: number;
  dodgeDirX: number;
  dodgeDirZ: number;
}

export const PLAYER_TUNING = {
  radius: 0.4,
  walkSpeed: 3.2,
  runSpeed: 6.8,
  acceleration: 12,
  deceleration: 16,
  turnRate: 14,
  dodgeSpeed: 12,
  dodgeDuration: 0.22,
  dodgeCooldown: 0.9,
} as const;

export function createPlayer(x: number, z: number, facing: number): PlayerState {
  return {
    x,
    z,
    vx: 0,
    vz: 0,
    facing,
    state: "idle",
    dodgeTime: 0,
    dodgeCooldown: 0,
    dodgeDirX: 0,
    dodgeDirZ: 0,
  };
}

/** Advances the player by one fixed step. Pure apart from mutating `p`. */
export function stepPlayer(p: PlayerState, input: PlayerInput, world: CollisionWorld, dt: number): void {
  const T = PLAYER_TUNING;
  let mx = input.moveX;
  let mz = input.moveZ;
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const moving = len > 0.05;

  p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt);

  if (input.dodge && p.dodgeCooldown <= 0 && p.state !== "dodge") {
    // Dodge in the input direction, or forward when standing still.
    const dx = moving ? mx : Math.sin(p.facing);
    const dz = moving ? mz : Math.cos(p.facing);
    const dl = Math.hypot(dx, dz) || 1;
    p.dodgeDirX = dx / dl;
    p.dodgeDirZ = dz / dl;
    p.dodgeTime = T.dodgeDuration;
    p.dodgeCooldown = T.dodgeCooldown;
    p.state = "dodge";
  }

  if (p.state === "dodge") {
    p.vx = p.dodgeDirX * T.dodgeSpeed;
    p.vz = p.dodgeDirZ * T.dodgeSpeed;
    p.dodgeTime -= dt;
    if (p.dodgeTime <= 0) p.state = moving ? (input.run ? "run" : "walk") : "idle";
  } else {
    const speed = input.run ? T.runSpeed : T.walkSpeed;
    const tx = mx * speed;
    const tz = mz * speed;
    const k = damp(moving ? T.acceleration : T.deceleration, dt);
    p.vx += (tx - p.vx) * k;
    p.vz += (tz - p.vz) * k;
    if (!moving && Math.hypot(p.vx, p.vz) < 0.05) {
      p.vx = 0;
      p.vz = 0;
    }
    const sp = Math.hypot(p.vx, p.vz);
    p.state = sp < 0.15 ? "idle" : sp > (T.walkSpeed + T.runSpeed) / 2 ? "run" : "walk";
  }

  const prevX = p.x;
  const prevZ = p.z;
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  resolveAll(world, p, T.radius);

  // Remove velocity lost against obstacles so we do not "stick" to walls.
  if (dt > 0) {
    p.vx = (p.x - prevX) / dt;
    p.vz = (p.z - prevZ) / dt;
    if (p.state === "dodge") {
      // keep the dodge impulse direction; collision already clamped position
      p.vx = p.dodgeDirX * T.dodgeSpeed;
      p.vz = p.dodgeDirZ * T.dodgeSpeed;
    }
  }

  // Face the direction of travel.
  const faceX = p.state === "dodge" ? p.dodgeDirX : mx;
  const faceZ = p.state === "dodge" ? p.dodgeDirZ : mz;
  if (Math.hypot(faceX, faceZ) > 0.05) {
    const target = Math.atan2(faceX, faceZ);
    p.facing += angleDelta(p.facing, target) * damp(T.turnRate, dt);
  }
}

/** Current horizontal speed (m/s). */
export const playerSpeed = (p: PlayerState) => Math.hypot(p.vx, p.vz);
