import paletteJson from "../../data/palette.json";

export interface SkyStop {
  e: number;
  top: string;
  horizon: string;
  sun: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
}

export interface Palette {
  ground: Record<string, string>;
  sky: SkyStop[];
  light: Record<"lantern" | "door" | "shard" | "moon" | "stars", string>;
  material: Record<"iron" | "lanternGlass" | "shardCore", string>;
  vfx: Record<string, { main: string; hero: string; dark: string }>;
  ui: Record<"ink" | "inkDim" | "panel" | "accent", string>;
  grading: {
    shadowTint: [number, number, number];
    highlightTint: [number, number, number];
    balance: number;
    strength: number;
    saturation: number;
    contrast: number;
  };
  atmosphere: { sunElevationScale: number; sunTilt: number; fogNear: number; fogFar: number };
}

/** The art-direction palette (data/palette.json). */
export const PALETTE = paletteJson as unknown as Palette;

export function groundColor(key: string): string {
  const c = PALETTE.ground[key];
  if (!c) throw new Error(`Unknown palette ground color "${key}"`);
  return c;
}
