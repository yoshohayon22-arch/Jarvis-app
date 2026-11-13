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
  agents: { outside: number; inside: number; moving: number };
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

  private readonly nameplateEl = $("nameplate");
  private nameplateKey = "";
  showNameplate(x: number, y: number, name: string, detail: string, key: boolean, knows = "", hint = ""): void {
    const k = `${name}|${detail}|${knows}|${hint}`;
    if (k !== this.nameplateKey) {
      this.nameplateKey = k;
      this.nameplateEl.replaceChildren();
      const n = document.createElement("strong");
      n.textContent = name;
      const d = document.createElement("span");
      d.textContent = detail;
      this.nameplateEl.append(n, d);
      if (knows) {
        const kEl = document.createElement("em");
        kEl.textContent = knows;
        this.nameplateEl.append(kEl);
      }
      if (hint) {
        const h = document.createElement("small");
        h.textContent = hint;
        this.nameplateEl.append(h);
      }
      this.nameplateEl.classList.toggle("key", key);
    }
    this.nameplateEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    this.nameplateEl.classList.add("visible");
  }

  hideNameplate(): void {
    this.nameplateEl.classList.remove("visible");
  }

  // ---- emote bubbles
  private readonly bubbleLayer = $("bubbles");
  private readonly bubbleEls: HTMLElement[] = [];
  showBubbles(bubbles: readonly { x: number; y: number; text: string }[]): void {
    while (this.bubbleEls.length < bubbles.length) {
      const el = document.createElement("div");
      el.className = "bubble";
      this.bubbleLayer.appendChild(el);
      this.bubbleEls.push(el);
    }
    this.bubbleEls.forEach((el, i) => {
      const b = bubbles[i];
      if (!b) {
        el.style.display = "none";
        return;
      }
      el.style.display = "";
      if (el.textContent !== b.text) {
        el.textContent = b.text;
        el.dataset.kind = b.text === "♥" ? "good" : b.text === "!" ? "bad" : "neutral";
      }
      el.style.transform = `translate(${Math.round(b.x)}px, ${Math.round(b.y)}px) translate(-50%, -100%)`;
    });
  }

  // ---- coins
  setCoins(n: number): void {
    $("hud-coins").textContent = `⛁ ${n}`;
  }

  // ---- journal (reputations + what people know)
  private readonly journalEl = $("journal");
  private journalKey = "";
  journalVisible = false;
  toggleJournal(): void {
    this.journalVisible = !this.journalVisible;
    this.journalEl.classList.toggle("visible", this.journalVisible);
  }

  updateJournal(reps: readonly { label: string; value: number }[], portrait: string, feed: readonly { t: number; text: string; tone: string }[]): void {
    if (!this.journalVisible) return;
    const key = reps.map((r) => r.value.toFixed(1)).join("|") + portrait + feed.length;
    if (key === this.journalKey) return;
    this.journalKey = key;
    const el = this.journalEl;
    el.replaceChildren();
    const h = document.createElement("h3");
    h.textContent = "Réputations";
    const p = document.createElement("p");
    p.className = "portrait";
    p.textContent = portrait;
    el.append(h, p);
    for (const r of reps) {
      const row = document.createElement("div");
      row.className = "rep";
      const name = document.createElement("span");
      name.textContent = r.label;
      const bar = document.createElement("div");
      bar.className = "bar";
      const fill = document.createElement("i");
      const w = Math.min(50, Math.abs(r.value) / 2);
      fill.style.width = `${w}%`;
      fill.style.left = r.value >= 0 ? "50%" : `${50 - w}%`;
      fill.className = r.value >= 0 ? "pos" : "neg";
      bar.append(fill);
      const val = document.createElement("b");
      val.textContent = `${r.value > 0 ? "+" : ""}${r.value.toFixed(0)}`;
      row.append(name, bar, val);
      el.append(row);
    }
    const h2 = document.createElement("h3");
    h2.textContent = "Ce que l'on sait de toi";
    el.append(h2);
    const list = document.createElement("ul");
    if (feed.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Rien encore. Tes actes devant témoins apparaîtront ici.";
      list.append(li);
    }
    for (const f of [...feed].reverse().slice(0, 9)) {
      const li = document.createElement("li");
      li.className = f.tone;
      const day = Math.floor(f.t / 1440) + 1;
      const hh = String(Math.floor((f.t % 1440) / 60)).padStart(2, "0");
      const mm = String(Math.floor(f.t % 60)).padStart(2, "0");
      li.textContent = `J${day} ${hh}:${mm} — ${f.text}`;
      list.append(li);
    }
    el.append(list);
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
      `habitants : ${d.agents.outside} dehors (${d.agents.moving} en marche) · ${d.agents.inside} à l'intérieur\n` +
      `[T] vitesse du temps · [G] qualité · [F3] debug`;
  }
}
