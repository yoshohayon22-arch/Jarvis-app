/** Pure audio decisions (what should be heard, how loud): testable without a sound card. */

export interface AmbienceInput {
  /** 0 (night) … 1 (full day). */
  daylight: number;
  /** People outdoors within earshot of the hero. */
  crowdNear: number;
  /** Distance to the tavern door, meters. */
  tavernDistance: number;
  /** Hour of the day, 0–24. */
  hour: number;
  /** Outside the village walls. */
  outside: boolean;
}

export type AmbienceLayer = "day" | "birds" | "night" | "crowd" | "pub";
export type MusicTrack = "market" | "inn" | "explore";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Target gain (0–1) of every ambience loop. */
export function ambienceMix(i: AmbienceInput): Record<AmbienceLayer, number> {
  const day = clamp01(i.daylight);
  const evening = i.hour >= 17 || i.hour < 1;
  const pubOpen = i.hour >= 11 || i.hour < 1;
  const nearPub = clamp01(1 - i.tavernDistance / 22);
  return {
    day: 0.55 * day,
    birds: 0.5 * day * (i.outside ? 1 : 0.6),
    night: 0.6 * (1 - day),
    crowd: clamp01(i.crowdNear / 14) * (0.25 + 0.75 * day) * 0.7,
    pub: pubOpen ? nearPub * (evening ? 0.9 : 0.45) : 0,
  };
}

/** Which music fits the moment. */
export function musicFor(i: AmbienceInput): MusicTrack {
  if (i.tavernDistance < 16 && (i.hour >= 17 || i.hour < 1)) return "inn";
  if (i.daylight > 0.45 && !i.outside) return "market";
  return "explore";
}

/** Gain and stereo pan of a sound at (dx, dz) from the listener, given the camera's right vector. */
export function spatial(dx: number, dz: number, rightX: number, rightZ: number, maxDistance = 28): { gain: number; pan: number } {
  const d = Math.hypot(dx, dz);
  if (d >= maxDistance) return { gain: 0, pan: 0 };
  const gain = (1 - d / maxDistance) ** 2;
  const pan = d < 0.5 ? 0 : Math.max(-1, Math.min(1, ((dx * rightX + dz * rightZ) / d) * 0.85));
  return { gain, pan };
}

/** Footstep cadence: returns how many steps happened while travelling `distance` more meters. */
export class StepCounter {
  private travelled = 0;
  constructor(private readonly stride = 0.78) {}
  advance(distance: number, running: boolean): number {
    this.travelled += distance;
    const stride = running ? this.stride * 1.55 : this.stride;
    let steps = 0;
    while (this.travelled >= stride) {
      this.travelled -= stride;
      steps++;
    }
    return steps;
  }
  reset(): void {
    this.travelled = 0;
  }
}

/** A short "sentence" of voice blips for a line of text: more words, more syllables (bounded). */
export function speechPattern(text: string, seed: number): { index: number; at: number; rate: number }[] {
  const words = Math.max(1, Math.min(7, Math.round(text.trim().split(/\s+/).length / 2.2)));
  const out: { index: number; at: number; rate: number }[] = [];
  let s = (seed >>> 0) || 1;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  let t = 0;
  for (let i = 0; i < words; i++) {
    out.push({ index: 1 + Math.floor(rnd() * 4), at: t, rate: 0.92 + rnd() * 0.2 });
    t += 0.16 + rnd() * 0.1;
  }
  return out;
}
