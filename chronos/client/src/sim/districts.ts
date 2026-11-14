import type { DistrictDef, WorldLayout } from "@chronos/shared";

/** District containing a point, or null outside the palisade. */
export function districtAt(layout: WorldLayout, x: number, z: number): DistrictDef | null {
  if (Math.hypot(x, z) > layout.wallRadius) return null;
  for (const d of layout.districts) {
    const [x0, z0, x1, z1] = d.rect;
    if (x >= x0 && x < x1 && z >= z0 && z < z1) return d;
  }
  return null;
}
