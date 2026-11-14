import { describe, expect, it } from "vitest";
import layoutJson from "../data/packs/medieval/layout.json";
import manifestJson from "../data/packs/medieval/pack.json";
import type { PackManifest, WorldLayout } from "@chronos/shared";
import { buildingAabb, buildCollisionWorld, propCollider } from "../src/sim/worldColliders";
import { expandLayout, generateScenery } from "../src/sim/scenery";
import { districtAt } from "../src/sim/districts";
import { resolveAll, type Aabb } from "../src/sim/collision";

const layout = layoutJson as WorldLayout;
const manifest = manifestJson as PackManifest;

const overlap = (a: Aabb, b: Aabb, eps = 0.01) =>
  a.minX < b.maxX - eps && a.maxX > b.minX + eps && a.minZ < b.maxZ - eps && a.maxZ > b.minZ + eps;

describe("medieval pack layout", () => {
  it("has a valid manifest", () => {
    expect(manifest.id).toBe("medieval");
    expect(manifest.calendar.minutesPerGameDay).toBeGreaterThan(0);
  });

  it("contains every location required by the V1 brief", () => {
    const kinds = new Set(layout.buildings.map((b) => b.kind));
    for (const k of ["tavern", "forge", "temple", "barracks", "shack"] as const) expect(kinds).toContain(k);
    expect(layout.districts.map((d) => d.id)).toEqual(expect.arrayContaining(["market", "lowtown", "garrison"]));
  });

  it("has unique building ids", () => {
    const ids = layout.buildings.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no overlapping buildings", () => {
    const boxes = layout.buildings.map((b) => ({ id: b.id, box: buildingAabb(b) }));
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++)
        expect(overlap(boxes[i]!.box, boxes[j]!.box), `${boxes[i]!.id} / ${boxes[j]!.id}`).toBe(false);
  });

  it("keeps every building inside the palisade", () => {
    for (const b of layout.buildings) {
      const a = buildingAabb(b);
      for (const [x, z] of [[a.minX, a.minZ], [a.maxX, a.minZ], [a.minX, a.maxZ], [a.maxX, a.maxZ]] as const)
        expect(Math.hypot(x, z), b.id).toBeLessThan(layout.wallRadius - 2);
    }
  });

  it("places each building in the district it declares", () => {
    for (const b of layout.buildings) expect(districtAt(layout, b.pos[0], b.pos[1])?.id, b.id).toBe(b.district);
  });

  it("keeps roads free of buildings", () => {
    for (const r of layout.roads) {
      const steps = 200;
      for (let i = 0; i <= steps; i++) {
        const x = r.from[0] + ((r.to[0] - r.from[0]) * i) / steps;
        const z = r.from[1] + ((r.to[1] - r.from[1]) * i) / steps;
        for (const b of layout.buildings) {
          const a = buildingAabb(b);
          const inside = x > a.minX + 0.05 && x < a.maxX - 0.05 && z > a.minZ + 0.05 && z < a.maxZ - 0.05;
          expect(inside, `road crosses ${b.id} at ${x},${z}`).toBe(false);
        }
      }
    }
  });

  it("keeps solid props out of buildings", () => {
    for (const p of layout.props) {
      const c = propCollider(p);
      if (!c) continue;
      for (const b of layout.buildings) {
        const a = buildingAabb(b);
        const cx = Math.max(a.minX, Math.min(c.x, a.maxX));
        const cz = Math.max(a.minZ, Math.min(c.z, a.maxZ));
        expect(Math.hypot(c.x - cx, c.z - cz), `${p.kind}@${p.pos} in ${b.id}`).toBeGreaterThan(c.r);
      }
    }
  });

  it("spawns the player on free ground", () => {
    const world = buildCollisionWorld(expandLayout(layout, 1));
    const p = { x: layout.spawn.pos[0], z: layout.spawn.pos[1] };
    resolveAll(world, p, 0.4);
    expect(p).toEqual({ x: layout.spawn.pos[0], z: layout.spawn.pos[1] });
  });

  it("generates deterministic scenery outside the walls", () => {
    const a = generateScenery(layout, 99);
    const b = generateScenery(layout, 99);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(100);
    for (const p of a) expect(Math.hypot(p.pos[0], p.pos[1])).toBeGreaterThan(layout.wallRadius + 5);
  });
});
