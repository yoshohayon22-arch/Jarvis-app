import { describe, expect, it } from "vitest";
import { WorldClock } from "../src/sim/clock";

describe("WorldClock", () => {
  it("starts at the configured hour on day 1", () => {
    const c = new WorldClock(24, 7.5);
    expect(c.day).toBe(1);
    expect(c.hour).toBe(7);
    expect(c.minute).toBe(30);
    expect(c.format()).toBe("Jour 1 · 07:30");
  });

  it("runs a full game day in the configured real time", () => {
    const c = new WorldClock(24, 0);
    for (let i = 0; i < 24 * 60 * 10; i++) c.advance(0.1); // 24 real minutes at 10 Hz
    expect(c.totalMinutes).toBeCloseTo(24 * 60, 6);
  });

  it("honours timeScale (x60 = one game hour per real minute... times 60)", () => {
    const c = new WorldClock(24, 0);
    c.timeScale = 60;
    c.advance(1);
    expect(c.totalMinutes).toBeCloseTo(60, 6);
    c.timeScale = 0;
    c.advance(100);
    expect(c.totalMinutes).toBeCloseTo(60, 6);
  });

  it("computes phases and sun elevation", () => {
    const c = new WorldClock(24, 12);
    expect(c.phase).toBe("day");
    expect(c.sunElevation).toBeCloseTo(1, 6);
    expect(c.daylight).toBe(1);
    c.totalMinutes = 0;
    expect(c.phase).toBe("night");
    expect(c.sunElevation).toBeCloseTo(-1, 6);
    expect(c.daylight).toBe(0);
    c.totalMinutes = 6 * 60;
    expect(c.phase).toBe("dawn");
    expect(c.sunElevation).toBeCloseTo(0, 6);
    c.totalMinutes = 18 * 60 + 30;
    expect(c.phase).toBe("dusk");
  });

  it("serializes and restores", () => {
    const a = new WorldClock(24, 9);
    a.advance(123);
    a.timeScale = 10;
    const b = new WorldClock(24, 0);
    b.restore(a.serialize());
    expect(b.format()).toBe(a.format());
    expect(b.timeScale).toBe(10);
  });
});
