import { describe, expect, it } from "vitest";
import { NavGrid, isFree } from "../src/sim/nav/grid";
import type { CollisionWorld } from "../src/sim/collision";

const world: CollisionWorld = {
  // A wall across the map with a 4 m door at x in [8, 12].
  boxes: [
    { minX: -50, maxX: 8, minZ: -1, maxZ: 1, height: 3 },
    { minX: 12, maxX: 50, minZ: -1, maxZ: 1, height: 3 },
  ],
  circles: [{ x: 0, z: 10, r: 1, height: 2 }],
  rings: [],
  boundsRadius: 48,
};
const nav = new NavGrid(world, 100);

function length(sx: number, sz: number, path: number[]): number {
  let l = 0;
  let x = sx;
  let z = sz;
  for (let i = 0; i < path.length; i += 2) {
    l += Math.hypot(path[i]! - x, path[i + 1]! - z);
    x = path[i]!;
    z = path[i + 1]!;
  }
  return l;
}

describe("NavGrid", () => {
  it("marks blockers and bounds as unwalkable", () => {
    expect(nav.isWalkable(0, 0)).toBe(false);
    expect(nav.isWalkable(0, 10)).toBe(false);
    expect(nav.isWalkable(10, 0)).toBe(true);
    expect(nav.isWalkable(49, 49)).toBe(false);
    expect(isFree(world, 20, 20, 0.4)).toBe(true);
  });

  it("goes straight when nothing is in the way", () => {
    const p = nav.findPath(-20, 20, 20, 20)!;
    expect(p).toEqual([20, 20]);
  });

  it("routes through the door in the wall", () => {
    const p = nav.findPath(-20, -20, -20, 20)!;
    expect(p).not.toBeNull();
    // Must pass through the opening (x between 8 and 12 near z = 0).
    let x = -20;
    let z = -20;
    let crossed = false;
    for (let i = 0; i < p.length; i += 2) {
      const nx = p[i]!;
      const nz = p[i + 1]!;
      if ((z < 0 && nz >= 0) || (z <= 0 && nz > 0)) {
        const t = (0 - z) / (nz - z);
        const cx = x + (nx - x) * t;
        expect(cx).toBeGreaterThan(8);
        expect(cx).toBeLessThan(12);
        crossed = true;
      }
      x = nx;
      z = nz;
    }
    expect(crossed).toBe(true);
    // Reasonably short: not more than 15% over the geometric optimum via the door edge.
    const optimal = Math.hypot(28.5, 20) * 2;
    expect(length(-20, -20, p)).toBeLessThan(optimal * 1.15);
  });

  it("never walks through blocked cells", () => {
    const p = nav.findPath(-30, -30, 30, 30)!;
    let x = -30;
    let z = -30;
    for (let i = 0; i < p.length; i += 2) {
      expect(nav.lineOfSight(x, z, p[i]!, p[i + 1]!)).toBe(true);
      x = p[i]!;
      z = p[i + 1]!;
    }
  });

  it("snaps a blocked goal to the nearest free cell", () => {
    const p = nav.findPath(-20, 20, 0, 10)!;
    expect(p).not.toBeNull();
    const ex = p[p.length - 2]!;
    const ez = p[p.length - 1]!;
    expect(nav.isWalkable(ex, ez)).toBe(true);
    expect(Math.hypot(ex, ez - 10)).toBeLessThan(3);
  });

  it("returns null when the goal is sealed off", () => {
    const sealed: CollisionWorld = { boxes: [{ minX: -50, maxX: 50, minZ: -1, maxZ: 1, height: 3 }], circles: [], rings: [], boundsRadius: 48 };
    expect(new NavGrid(sealed, 100).findPath(0, -20, 0, 20)).toBeNull();
  });

  it("is deterministic", () => {
    expect(nav.findPath(-30, -25, 33, 28)).toEqual(nav.findPath(-30, -25, 33, 28));
  });
});
