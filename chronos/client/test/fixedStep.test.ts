import { describe, expect, it } from "vitest";
import { FixedStep } from "../src/core/fixedStep";
import { SeededRng } from "../src/core/rng";

describe("FixedStep", () => {
  it("runs the right number of steps regardless of frame rate", () => {
    const loop = new FixedStep(0.1);
    let steps = 0;
    for (let i = 0; i < 60; i++) loop.advance(1 / 60, () => steps++);
    expect(steps).toBe(10);
  });

  it("returns an interpolation factor in [0, 1)", () => {
    const loop = new FixedStep(0.1);
    const alpha = loop.advance(0.25, () => undefined);
    expect(alpha).toBeCloseTo(0.5, 6);
  });

  it("caps steps after a long stall", () => {
    const loop = new FixedStep(1 / 60, 8);
    let steps = 0;
    loop.advance(10, () => steps++);
    expect(steps).toBe(8);
  });
});

describe("SeededRng", () => {
  it("is deterministic for a given seed", () => {
    const a = new SeededRng(42);
    const b = new SeededRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("resumes from a saved state", () => {
    const a = new SeededRng(7);
    a.next();
    const b = new SeededRng(0);
    b.state = a.state;
    expect(b.next()).toBe(a.next());
  });
});
