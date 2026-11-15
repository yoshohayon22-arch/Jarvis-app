import { describe, expect, it } from "vitest";
import { bearingLabel, directions, miniMarker, worldToMap } from "../src/ui/mapMath";

describe("map math (north is −z)", () => {
  it("names the eight directions", () => {
    expect(bearingLabel(0, -10)).toBe("au nord");
    expect(bearingLabel(10, 0)).toBe("à l'est");
    expect(bearingLabel(0, 10)).toBe("au sud");
    expect(bearingLabel(-10, 0)).toBe("à l'ouest");
    expect(bearingLabel(7, -7)).toBe("au nord-est");
    expect(bearingLabel(-7, 7)).toBe("au sud-ouest");
  });
  it("gives walking directions to an objective", () => {
    expect(directions(1, 2)).toBe("tout près");
    expect(directions(30, -30)).toBe("à 42 m au nord-est");
    expect(directions(0, 203)).toBe("à 205 m au sud");
  });
  it("puts the village centre in the middle of the map, north up", () => {
    expect(worldToMap(0, 0, 200, 1000)).toEqual({ x: 500, y: 500 });
    expect(worldToMap(0, -100, 200, 1000).y).toBe(0);
    expect(worldToMap(100, 0, 200, 1000).x).toBe(1000);
  });
  it("pins far markers to the rim of the minimap, in the right direction", () => {
    const near = miniMarker(10, 0, 50, 100);
    expect(near).toEqual({ x: 20, y: 0, pinned: false });
    const far = miniMarker(0, -400, 50, 100);
    expect(far.pinned).toBe(true);
    expect(far.x).toBeCloseTo(0);
    expect(far.y).toBeCloseTo(-94);
  });
});
