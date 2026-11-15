/** Pure helpers for the map and the objective compass. North is −z, east is +x. */

const BEARINGS = ["au nord", "au nord-est", "à l'est", "au sud-est", "au sud", "au sud-ouest", "à l'ouest", "au nord-ouest"] as const;

/** "au nord-est" for a vector from the player to a target. */
export function bearingLabel(dx: number, dz: number): string {
  const a = Math.atan2(dx, -dz); // 0 = north, clockwise
  return BEARINGS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8] as string;
}

/** "à 42 m au nord-est", or "tout près" within arm's reach. */
export function directions(dx: number, dz: number): string {
  const d = Math.hypot(dx, dz);
  if (d < 4) return "tout près";
  return `à ${d < 100 ? Math.round(d) : Math.round(d / 5) * 5} m ${bearingLabel(dx, dz)}`;
}

/** World (x, z) → pixel on a north-up map of `worldSize` meters drawn on `px` pixels. */
export function worldToMap(x: number, z: number, worldSize: number, px: number): { x: number; y: number } {
  return { x: (x / worldSize + 0.5) * px, y: (z / worldSize + 0.5) * px };
}

/**
 * Where to draw a marker on a round minimap centred on the player: inside the
 * disc at scale, or pinned to the rim (with `pinned`) when it is further away.
 */
export function miniMarker(dx: number, dz: number, radiusMeters: number, radiusPx: number): { x: number; y: number; pinned: boolean } {
  const d = Math.hypot(dx, dz);
  const k = radiusPx / radiusMeters;
  if (d <= radiusMeters * 0.94) return { x: dx * k, y: dz * k, pinned: false };
  const r = radiusPx * 0.94;
  return { x: (dx / d) * r, y: (dz / d) * r, pinned: true };
}
