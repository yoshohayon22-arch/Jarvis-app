import qualityJson from "../../data/quality.json";

export type QualityLevel = "low" | "high";

export interface QualityPreset {
  label: string;
  maxPixelRatio: number;
  shadowMapSize: number;
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
}

export const QUALITY = qualityJson as unknown as Record<QualityLevel, QualityPreset>;
const KEY = "chronos.quality";

export function initialQuality(): QualityLevel {
  const q = new URLSearchParams(location.search).get("quality");
  if (q === "low" || q === "high") return q;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "low" || saved === "high") return saved;
  } catch {
    /* storage unavailable */
  }
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  return mobile ? "low" : "high";
}

export function saveQuality(level: QualityLevel): void {
  try {
    localStorage.setItem(KEY, level);
  } catch {
    /* storage unavailable */
  }
}
