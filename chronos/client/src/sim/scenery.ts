import type { PropDef, WorldLayout } from "@chronos/shared";
import { SeededRng } from "../core/rng";
import { GATE_ANGLES } from "./worldColliders";

/**
 * Deterministic decoration outside the palisade (forest ring, rocks).
 * Generated from the seed so it never needs to be saved.
 */
export function generateScenery(layout: WorldLayout, seed: number): PropDef[] {
  const rng = new SeededRng(seed);
  const out: PropDef[] = [];
  const inner = layout.wallRadius + 6;
  const outer = layout.size / 2 - 4;
  const roadClearance = 6;
  let attempts = 0;
  while (out.length < 170 && attempts < 4000) {
    attempts++;
    const a = rng.range(-Math.PI, Math.PI);
    const r = Math.sqrt(rng.range(inner * inner, outer * outer));
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    // Keep roads leading out of the gates free.
    const nearRoad = GATE_ANGLES.some((g) => {
      const along = x * Math.cos(g) + z * Math.sin(g);
      const across = Math.abs(-x * Math.sin(g) + z * Math.cos(g));
      return along > 0 && across < roadClearance;
    });
    if (nearRoad) continue;
    if (out.some((p) => Math.hypot(p.pos[0] - x, p.pos[1] - z) < 3.2)) continue;
    out.push({
      kind: rng.next() < 0.9 ? "tree" : "rock",
      pos: [Math.round(x * 100) / 100, Math.round(z * 100) / 100],
      rot: rng.range(0, Math.PI * 2),
      solid: true,
    });
  }
  return out;
}

export function expandLayout(layout: WorldLayout, seed: number): WorldLayout {
  return { ...layout, props: [...layout.props, ...generateScenery(layout, seed)] };
}
