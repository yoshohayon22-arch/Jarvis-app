import qualityJson from "../../data/quality.json";

export type QualityLevel = "minimal" | "low" | "high";
export const QUALITY_ORDER: readonly QualityLevel[] = ["minimal", "low", "high"];

export interface QualityPreset {
  label: string;
  maxPixelRatio: number;
  /** 0 disables shadows. */
  shadowMapSize: number;
  /** Refresh the shadow map every N frames. */
  shadowEvery: number;
  shadowRadius: number;
  multisampling: number;
  fxaa: boolean;
  ao: {
    intensity: number;
    radius: number;
    samples: number;
    rings: number;
    distanceThreshold: number;
    distanceFalloff: number;
    resolutionScale: number;
  } | null;
  dof: { focusRange: number; bokehScale: number; resolutionScale: number } | null;
  bloom: { intensity: number; threshold: number; smoothing: number; radius: number };
  vignette: { offset: number; darkness: number };
  maxNightLights: number;
  grass: { count: number; patch: number } | null;
  detailMaterials: boolean;
  crowdShadows: boolean;
  /** People further than this from the camera are not drawn (meters). */
  crowdDistance: number;
}

export const QUALITY = qualityJson as unknown as Record<QualityLevel, QualityPreset>;
// v2: the default changed (automatic, starting low); older saved choices are ignored.
const KEY = "chronos.quality.v2";

const isLevel = (v: unknown): v is QualityLevel => v === "minimal" || v === "low" || v === "high";

/** The player's choice: a fixed level, or "auto" (the default). */
export function initialQuality(): { level: QualityLevel; auto: boolean } {
  const q = new URLSearchParams(location.search).get("quality");
  if (isLevel(q)) return { level: q, auto: false };
  try {
    const saved = localStorage.getItem(KEY);
    if (isLevel(saved)) return { level: saved, auto: false };
  } catch {
    /* storage unavailable */
  }
  return { level: "low", auto: true };
}

export function saveQuality(level: QualityLevel | "auto"): void {
  try {
    localStorage.setItem(KEY, level);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Keeps the game fluid without asking: watches the frame rate and, when it stays
 * low, first lowers the preset, then the render resolution. It never raises
 * anything by itself (no flip-flopping); the player can always pick a level by hand.
 */
export class AutoQuality {
  /** Extra resolution factor applied on top of the preset (1 → 0.55). */
  scale = 1;
  private time = 0;
  private frames = 0;
  private windowTime = 0;
  private cooldown = 0;

  constructor(
    private readonly target = 30,
    private readonly warmup = 5,
    private readonly window = 3,
  ) {}

  /** Feed every rendered frame. Returns what to do, if anything. */
  frame(dt: number, level: QualityLevel): { level?: QualityLevel; scale?: number } | null {
    this.time += dt;
    if (this.time < this.warmup) return null;
    this.cooldown -= dt;
    this.frames++;
    this.windowTime += dt;
    if (this.windowTime < this.window) return null;
    const fps = this.frames / this.windowTime;
    this.frames = 0;
    this.windowTime = 0;
    if (fps >= this.target || this.cooldown > 0) return null;
    this.cooldown = 4;
    const i = QUALITY_ORDER.indexOf(level);
    if (i > 0) return { level: QUALITY_ORDER[i - 1] as QualityLevel };
    if (this.scale > 0.56) {
      this.scale = Math.max(0.55, Math.round((this.scale - 0.15) * 100) / 100);
      return { scale: this.scale };
    }
    return null;
  }

  reset(): void {
    this.time = 0;
    this.frames = 0;
    this.windowTime = 0;
    this.cooldown = 0;
  }
}
