import { PHASE_LABELS, type WorldClock } from "../sim/clock";

const PHASE_ICON = { dawn: "◐", day: "☀", dusk: "◑", night: "☾" } as const;

export interface DebugInfo {
  fps: number;
  drawCalls: number;
  triangles: number;
  x: number;
  z: number;
  state: string;
  speed: number;
  timeScale: number;
}

const $ = <T extends HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

export class Hud {
  private readonly clockEl = $("hud-clock");
  private readonly districtEl = $("hud-district");
  private readonly debugEl = $("debug");
  private readonly speedEl = $("hud-speed");
  private lastClock = "";
  private districtTimer = 0;
  debugVisible = false;

  update(clock: WorldClock, dt: number): void {
    const text = `${PHASE_ICON[clock.phase]} ${clock.format()} · ${PHASE_LABELS[clock.phase]}`;
    if (text !== this.lastClock) {
      this.clockEl.textContent = text;
      this.lastClock = text;
    }
    if (this.districtTimer > 0) {
      this.districtTimer -= dt;
      if (this.districtTimer <= 0) this.districtEl.classList.remove("visible");
    }
  }

  showDistrict(name: string): void {
    this.districtEl.textContent = name;
    this.districtEl.classList.add("visible");
    this.districtTimer = 3;
  }

  private toastTimer: number | undefined;
  toast(text: string): void {
    const el = $("toast");
    el.textContent = text;
    el.classList.add("visible");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove("visible"), 1800);
  }

  showTimeScale(scale: number): void {
    this.speedEl.textContent = scale === 1 ? "" : scale === 0 ? "⏸ Temps figé" : `⏩ Temps ×${scale}`;
  }

  toggleDebug(): void {
    this.debugVisible = !this.debugVisible;
    this.debugEl.classList.toggle("visible", this.debugVisible);
  }

  updateDebug(d: DebugInfo): void {
    if (!this.debugVisible) return;
    this.debugEl.textContent =
      `FPS ${d.fps.toFixed(0)} · draw calls ${d.drawCalls} · tris ${(d.triangles / 1000).toFixed(1)}k\n` +
      `pos ${d.x.toFixed(1)}, ${d.z.toFixed(1)} · ${d.state} · ${d.speed.toFixed(1)} m/s\n` +
      `time scale ×${d.timeScale}\n` +
      `[T] vitesse du temps · [G] qualité · [F3] debug`;
  }
}
