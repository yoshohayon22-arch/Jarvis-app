import { describe, expect, it } from "vitest";
import { isInGate, rayAabb, resolveAll, resolveCircleAabb, type Aabb, type CollisionWorld } from "../src/sim/collision";

const box: Aabb = { minX: 0, minZ: 0, maxX: 4, maxZ: 4, height: 3 };

describe("circle vs AABB", () => {
  it("pushes a circle out of a face", () => {
    const p = { x: -0.2, z: 2 };
    expect(resolveCircleAabb(p, 0.5, box)).toBe(true);
    expect(p.x).toBeCloseTo(-0.5, 6);
    expect(p.z).toBe(2);
  });

  it("ejects a circle whose center is inside the box", () => {
    const p = { x: 3.9, z: 2 };
    resolveCircleAabb(p, 0.5, box);
    expect(p.x).toBeCloseTo(4.5, 6);
  });

  it("leaves distant circles untouched", () => {
    const p = { x: -2, z: -2 };
    expect(resolveCircleAabb(p, 0.5, box)).toBe(false);
  });
});

describe("palisade ring", () => {
  const world: CollisionWorld = {
    boxes: [],
    circles: [],
    rings: [{ radius: 10, thickness: 0.8, height: 4, gates: [{ angle: 0, halfWidth: 2 }] }],
    boundsRadius: 50,
  };

  it("blocks crossing the wall away from a gate", () => {
    const p = { x: 0, z: 9.8 };
    resolveAll(world, p, 0.4);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(10 - 0.4 - 0.4, 6);
  });

  it("lets the player through a gate", () => {
    expect(isInGate(world.rings[0]!, 10, 0.5)).toBe(true);
    const p = { x: 10, z: 0.5 };
    resolveAll(world, p, 0.4);
    expect(p.x).toBe(10);
  });

  it("keeps the player inside the world bounds", () => {
    const p = { x: 80, z: 0 };
    resolveAll(world, p, 0.4);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(49.6, 6);
  });
});

describe("rayAabb", () => {
  it("hits a box in front", () => {
    expect(rayAabb(-5, 1, 2, 1, 0, 0, box)).toBeCloseTo(5, 6);
  });
  it("misses a box above its height", () => {
    expect(rayAabb(-5, 5, 2, 1, 0, 0, box)).toBe(Infinity);
  });
  it("misses a box behind", () => {
    expect(rayAabb(-5, 1, 2, -1, 0, 0, box)).toBe(Infinity);
  });
});
