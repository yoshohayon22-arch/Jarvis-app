import type { PropDef, WorldLayout } from "@chronos/shared";
import type { Agent } from "./agents";
import { resolveAll, type CollisionWorld } from "./collision";

/** Prop kinds that can be moved by telekinesis (everything else is static scenery). */
export const MOVABLE_KINDS: ReadonlySet<PropDef["kind"]> = new Set(["barrel", "crate", "sack", "bucket"]);

const RADIUS: Partial<Record<PropDef["kind"], number>> = { barrel: 0.5, crate: 0.55, sack: 0.35, bucket: 0.3 };

export interface DynamicProp {
  id: number;
  kind: PropDef["kind"];
  /** Index of the prop in the layout (lets the renderer reuse its model). */
  layoutIndex: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  spin: number;
  radius: number;
  held: boolean;
  /** Frozen in time until this game minute; impulses received meanwhile are released afterwards. */
  frozenUntil: number;
  /** Velocity stored while frozen (time + telekinesis interaction). */
  pendingVx: number;
  pendingVy: number;
  pendingVz: number;
  /** True while flying fast enough to hurt someone. */
  dangerous: boolean;
}

export const PHYSICS = { gravity: 18, restitution: 0.25, groundFriction: 6, hurtSpeed: 5, holdStiffness: 14 } as const;

export function isMovable(p: PropDef): boolean {
  return MOVABLE_KINDS.has(p.kind);
}

/**
 * Light kinematic physics for the handful of objects telekinesis can move:
 * gravity, ground bounce, friction, collision against the static world, and
 * hits on inhabitants. Deterministic, no engine dependency.
 */
export class PropSystem {
  readonly props: DynamicProp[] = [];
  /** Called when a fast object hits someone. */
  onHit: ((prop: DynamicProp, agent: Agent, speed: number) => void) | null = null;

  constructor(
    layout: WorldLayout,
    private readonly world: CollisionWorld,
  ) {
    layout.props.forEach((p, i) => {
      if (!isMovable(p)) return;
      this.props.push({
        id: this.props.length,
        kind: p.kind,
        layoutIndex: i,
        x: p.pos[0],
        y: 0,
        z: p.pos[1],
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: p.rot ?? 0,
        spin: 0,
        radius: RADIUS[p.kind] ?? 0.4,
        held: false,
        frozenUntil: 0,
        pendingVx: 0,
        pendingVy: 0,
        pendingVz: 0,
        dangerous: false,
      });
    });
  }

  /** Nearest prop to a point within range (optionally inside a view cone). */
  nearest(x: number, z: number, range: number, dirX = 0, dirZ = 0, minDot = -1): DynamicProp | null {
    let best: DynamicProp | null = null;
    let bestScore = Infinity;
    for (const p of this.props) {
      const dx = p.x - x;
      const dz = p.z - z;
      const d = Math.hypot(dx, dz);
      if (d > range) continue;
      if (d > 1 && (dx * dirX + dz * dirZ) / d < minDot) continue;
      if (d < bestScore) {
        bestScore = d;
        best = p;
      }
    }
    return best;
  }

  /** Gives a prop a velocity. If it is frozen in time, the impulse is stored and released on thaw. */
  impulse(p: DynamicProp, vx: number, vy: number, vz: number, now: number): void {
    if (p.frozenUntil > now) {
      p.pendingVx += vx;
      p.pendingVy += vy;
      p.pendingVz += vz;
      return;
    }
    p.vx += vx;
    p.vy += vy;
    p.vz += vz;
  }

  /**
   * @param dt seconds
   * @param now game minutes (for freezes)
   * @param timeFactorAt local flow of time at a point (time bubbles)
   */
  step(dt: number, now: number, agents: readonly Agent[], timeFactorAt: (x: number, z: number) => number = () => 1): void {
    for (const p of this.props) {
      if (p.held) {
        p.dangerous = false;
        continue;
      }
      if (p.frozenUntil > now) continue;
      if (p.pendingVx || p.pendingVy || p.pendingVz) {
        // Thawed: everything it received while frozen is released at once.
        p.vx += p.pendingVx;
        p.vy += p.pendingVy;
        p.vz += p.pendingVz;
        p.pendingVx = p.pendingVy = p.pendingVz = 0;
      }
      const speed = Math.hypot(p.vx, p.vy, p.vz);
      if (speed < 0.01 && p.y <= 0) {
        p.dangerous = false;
        continue;
      }
      const h = dt * timeFactorAt(p.x, p.z);
      p.vy -= PHYSICS.gravity * h;
      const bx = p.x;
      const bz = p.z;
      p.x += p.vx * h;
      p.y += p.vy * h;
      p.z += p.vz * h;
      p.yaw += p.spin * h;

      // Static world: stop against walls and lose energy.
      if (p.y < 3) {
        const pos = { x: p.x, z: p.z };
        resolveAll(this.world, pos, p.radius, 2);
        if (pos.x !== p.x || pos.z !== p.z) {
          p.x = pos.x;
          p.z = pos.z;
          p.vx = ((p.x - bx) / Math.max(h, 1e-6)) * PHYSICS.restitution;
          p.vz = ((p.z - bz) / Math.max(h, 1e-6)) * PHYSICS.restitution;
        }
      }
      if (p.y <= 0) {
        p.y = 0;
        if (p.vy < -2) p.vy = -p.vy * PHYSICS.restitution;
        else p.vy = 0;
        const k = Math.max(0, 1 - PHYSICS.groundFriction * h);
        p.vx *= k;
        p.vz *= k;
        p.spin *= k;
        if (Math.hypot(p.vx, p.vz) < 0.15) p.vx = p.vz = 0;
      }

      p.dangerous = Math.hypot(p.vx, p.vy, p.vz) > PHYSICS.hurtSpeed;
      if (p.dangerous && p.y < 2) {
        for (const a of agents) {
          if (a.insideOf || a.held) continue;
          if ((a.x - p.x) ** 2 + (a.z - p.z) ** 2 > (p.radius + 0.4) ** 2) continue;
          const hit = Math.hypot(p.vx, p.vy, p.vz);
          p.vx *= -0.2;
          p.vz *= -0.2;
          p.dangerous = false;
          this.onHit?.(p, a, hit);
          break;
        }
      }
    }
  }

  /** Moves a held prop toward a point (critically damped spring: no jitter, no overshoot). */
  hold(p: DynamicProp, tx: number, ty: number, tz: number, dt: number): void {
    const k = Math.min(1, PHYSICS.holdStiffness * dt);
    p.vx = ((tx - p.x) * k) / Math.max(dt, 1e-6);
    p.vy = ((ty - p.y) * k) / Math.max(dt, 1e-6);
    p.vz = ((tz - p.z) * k) / Math.max(dt, 1e-6);
    p.x += (tx - p.x) * k;
    p.y += (ty - p.y) * k;
    p.z += (tz - p.z) * k;
  }
}
