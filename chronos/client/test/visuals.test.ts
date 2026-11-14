import { describe, expect, it } from "vitest";
import layoutJson from "../data/packs/medieval/layout.json";
import visualsJson from "../data/packs/medieval/visuals.json";
import manifestJson from "../data/kaykit-manifest.json";
import paletteJson from "../data/palette.json";
import qualityJson from "../data/quality.json";
import type { WorldLayout } from "@chronos/shared";

type Bounds = { min: number[]; max: number[] } | null;
const layout = layoutJson as WorldLayout;
const visuals = visualsJson as unknown as {
  buildings: Record<string, { model: string; scale: number }>;
  props: Record<string, { models?: string[]; variants?: Record<string, string>; placeholder?: string }>;
  wall: { segment: string; gate: string; gateTower: string };
  scenery: Record<string, { models: string[] }>;
  characters: Record<string, { model: string }>;
};
const manifest = manifestJson as unknown as Record<string, Record<string, Bounds>>;

function bounds(path: string): Bounds | undefined {
  const [dir, name] = path.split("/");
  return manifest[dir!]?.[name!];
}

describe("pack visuals ↔ imported assets", () => {
  it("references only models that were imported", () => {
    const paths = [
      ...Object.values(visuals.buildings).map((b) => b.model),
      ...Object.values(visuals.props).flatMap((p) => [...(p.models ?? []), ...Object.values(p.variants ?? {})]),
      visuals.wall.segment,
      visuals.wall.gate,
      visuals.wall.gateTower,
      ...Object.values(visuals.scenery).flatMap((s) => s.models),
      ...Object.values(visuals.characters).map((c) => c.model),
    ];
    for (const p of paths) expect(bounds(p), p).toBeTruthy();
  });

  it("gives every building a model", () => {
    for (const b of layout.buildings) expect(visuals.buildings[b.id], b.id).toBeTruthy();
  });

  it("matches each building footprint (collider) to its model at the chosen scale", () => {
    for (const b of layout.buildings) {
      const v = visuals.buildings[b.id]!;
      const bb = bounds(v.model)!;
      const w = (bb.max[0]! - bb.min[0]!) * v.scale;
      const d = (bb.max[2]! - bb.min[2]!) * v.scale;
      expect(Math.abs(w - b.size[0]), `${b.id} width`).toBeLessThan(0.1);
      expect(Math.abs(d - b.size[1]), `${b.id} depth`).toBeLessThan(0.1);
    }
  });

  it("gives every prop kind a model or a placeholder", () => {
    for (const p of layout.props) {
      const v = visuals.props[p.kind];
      expect(v, p.kind).toBeTruthy();
      expect(!!(v!.models || v!.variants || v!.placeholder), p.kind).toBe(true);
    }
  });
});

describe("art direction data", () => {
  it("defines every district ground color in the palette", () => {
    for (const d of layout.districts) expect(paletteJson.ground, d.id).toHaveProperty(d.groundColor);
  });

  it("orders sky stops by sun elevation and covers night to noon", () => {
    const es = paletteJson.sky.map((s) => s.e);
    expect([...es].sort((a, b) => a - b)).toEqual(es);
    expect(es[0]).toBe(-1);
    expect(es[es.length - 1]).toBe(1);
  });

  it("has both quality presets with the same keys", () => {
    expect(Object.keys(qualityJson.low).sort()).toEqual(Object.keys(qualityJson.high).sort());
  });
});
