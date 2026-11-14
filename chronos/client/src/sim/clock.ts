import { smoothstep } from "../core/math";

export type DayPhase = "night" | "dawn" | "day" | "dusk";

export const PHASE_LABELS: Record<DayPhase, string> = {
  night: "Nuit",
  dawn: "Aube",
  day: "Jour",
  dusk: "Crépuscule",
};

const MINUTES_PER_DAY = 24 * 60;

export interface ClockState {
  totalMinutes: number;
  timeScale: number;
}

/**
 * World time. Game time is counted in minutes since day 1, 00:00.
 * `realMinutesPerGameDay` controls how long a full day lasts in real time.
 */
export class WorldClock {
  totalMinutes: number;
  /** Debug/gameplay multiplier (0 = paused). Powers will use per-zone scales instead. */
  timeScale = 1;

  constructor(
    readonly realMinutesPerGameDay: number,
    startHour: number,
  ) {
    if (realMinutesPerGameDay <= 0) throw new Error("realMinutesPerGameDay must be > 0");
    this.totalMinutes = startHour * 60;
  }

  /** Game minutes elapsed per real second at timeScale 1. */
  get gameMinutesPerRealSecond(): number {
    return MINUTES_PER_DAY / (this.realMinutesPerGameDay * 60);
  }

  advance(realDtSeconds: number): void {
    this.totalMinutes += realDtSeconds * this.gameMinutesPerRealSecond * this.timeScale;
  }

  get day(): number {
    return Math.floor(this.totalMinutes / MINUTES_PER_DAY) + 1;
  }

  get minuteOfDay(): number {
    const m = this.totalMinutes % MINUTES_PER_DAY;
    return m < 0 ? m + MINUTES_PER_DAY : m;
  }

  get hour(): number {
    return Math.floor(this.minuteOfDay / 60);
  }

  get minute(): number {
    return Math.floor(this.minuteOfDay % 60);
  }

  get phase(): DayPhase {
    const h = this.minuteOfDay / 60;
    if (h >= 5 && h < 7) return "dawn";
    if (h >= 7 && h < 17.5) return "day";
    if (h >= 17.5 && h < 19.5) return "dusk";
    return "night";
  }

  /** Sun height in [-1, 1]: 0 at 06:00 and 18:00, 1 at noon, -1 at midnight. */
  get sunElevation(): number {
    const angle = (this.minuteOfDay / MINUTES_PER_DAY - 0.25) * Math.PI * 2;
    return Math.sin(angle);
  }

  /** Sun azimuth angle around the Y axis (radians); rises in the east, sets in the west. */
  get sunAzimuth(): number {
    return (this.minuteOfDay / MINUTES_PER_DAY - 0.25) * Math.PI * 2;
  }

  /** 0 (full night) .. 1 (full day), smooth through dawn and dusk. */
  get daylight(): number {
    return smoothstep(-0.12, 0.22, this.sunElevation);
  }

  format(): string {
    const hh = String(this.hour).padStart(2, "0");
    const mm = String(this.minute).padStart(2, "0");
    return `Jour ${this.day} · ${hh}:${mm}`;
  }

  serialize(): ClockState {
    return { totalMinutes: this.totalMinutes, timeScale: this.timeScale };
  }

  restore(s: ClockState): void {
    this.totalMinutes = s.totalMinutes;
    this.timeScale = s.timeScale;
  }
}
