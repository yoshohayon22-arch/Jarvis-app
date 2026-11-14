import { lerp } from "../../core/math";
import type { Agent } from "../agents";
import type { Aabb, CollisionWorld } from "../collision";

export const PERCEPTION = {
  /** Sight range in meters at night / in full daylight. */
  nightRange: 9,
  dayRange: 24,
  /** Within this distance people notice even what happens behind them (sound). */
  hearing: 5,
} as const;

/** True when the 2D segment (x0,z0)→(x1,z1) crosses the box. */
export function segmentHitsBox(x0: number, z0: number, x1: number, z1: number, b: Aabb): boolean {
  let tmin = 0;
  let tmax = 1;
  const dx = x1 - x0;
  const dz = z1 - z0;
  for (const [o, d, mn, mx] of [[x0, dx, b.minX, b.maxX], [z0, dz, b.minZ, b.maxZ]] as const) {
    if (Math.abs(d) < 1e-9) {
      if (o < mn || o > mx) return false;
    } else {
      let t1 = (mn - o) / d;
      let t2 = (mx - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}

export function hasLineOfSight(world: CollisionWorld, x0: number, z0: number, x1: number, z1: number): boolean {
  for (const b of world.boxes) if (b.height > 1.6 && segmentHitsBox(x0, z0, x1, z1, b)) return false;
  return true;
}

export interface PerceptionContext {
  /** 0 (night) .. 1 (day). */
  daylight: number;
  /** The actor cannot be seen (Shadow power, J5): only hearing range applies… and it is silent. */
  actorHidden?: boolean;
}

/** Can this inhabitant perceive something happening at (x, z)? */
export function perceives(o: Agent, x: number, z: number, world: CollisionWorld, ctx: PerceptionContext): boolean {
  if (o.insideOf || o.activity === "sleep") return false;
  if (ctx.actorHidden) return false;
  const dx = x - o.x;
  const dz = z - o.z;
  const d = Math.hypot(dx, dz);
  if (d > lerp(PERCEPTION.nightRange, PERCEPTION.dayRange, ctx.daylight)) return false;
  if (d > PERCEPTION.hearing) {
    // Must be roughly facing it (field of view ≈ 200°).
    const fx = Math.sin(o.facing);
    const fz = Math.cos(o.facing);
    if ((dx * fx + dz * fz) / d < -0.17) return false;
  }
  return hasLineOfSight(world, o.x, o.z, x, z);
}

export function witnessesOf(
  agents: readonly Agent[],
  x: number,
  z: number,
  world: CollisionWorld,
  ctx: PerceptionContext,
  exclude: ReadonlySet<string> = new Set(),
): Agent[] {
  return agents.filter((a) => !exclude.has(a.id) && perceives(a, x, z, world, ctx));
}
