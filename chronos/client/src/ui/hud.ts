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
  ai: string;
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

  // ---- dialogue
  private readonly dialogueEl = $("dialogue");
  private readonly dialogueLog = $("dialogue-log");
  private readonly dialogueInput = $<HTMLInputElement>("dialogue-input");
  dialogueOpen = false;

  /** Wires the dialogue form once. `onSend` receives the player's text; `onClose` fires on Escape. */
  bindDialogue(onSend: (text: string) => void, onClose: () => void): void {
    $("dialogue-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const text = this.dialogueInput.value.trim();
      if (!text || this.dialogueInput.disabled) return;
      this.dialogueInput.value = "";
      onSend(text);
    });
    this.dialogueInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    });
  }

  openDialogue(name: string, role: string): void {
    this.dialogueOpen = true;
    $("dialogue-name").textContent = name;
    $("dialogue-role").textContent = role;
    $("dialogue-source").textContent = "";
    this.dialogueLog.replaceChildren();
    this.dialogueEl.classList.add("visible");
    this.dialogueInput.disabled = false;
    this.dialogueInput.value = "";
    this.dialogueInput.focus();
  }

  closeDialogue(): void {
    this.dialogueOpen = false;
    this.dialogueEl.classList.remove("visible");
    this.dialogueInput.blur();
  }

  addDialogueLine(kind: "player" | "npc" | "system" | "pending", text: string): HTMLElement {
    const p = document.createElement("p");
    p.className = kind;
    p.textContent = text;
    this.dialogueLog.append(p);
    this.dialogueLog.scrollTop = this.dialogueLog.scrollHeight;
    return p;
  }

  setDialogueBusy(busy: boolean, source = ""): void {
    this.dialogueInput.disabled = busy;
    if (!busy) {
      this.dialogueInput.focus();
      $("dialogue-source").textContent = source;
    }
  }

  // ---- powers
  private powerKey = "";
  private energyPct = -1;
  /** Energy gauge + one slot per castable ability (key, name, cooldown, lock). */
  updatePowers(energy: number, max: number, slots: readonly { key: string; name: string; cost: number; cooldown: number; locked: boolean; active: boolean; vfx: string }[]): void {
    // Only touch the DOM when the gauge moves by a visible amount (cheap to composite: transform only).
    const pct = Math.round(Math.max(0, Math.min(100, (energy / max) * 100)));
    if (pct !== this.energyPct) {
      this.energyPct = pct;
      ($("energy-fill") as HTMLElement).style.transform = `scaleX(${pct / 100})`;
    }
    const k = slots.map((s) => `${s.key}${s.name}${s.locked}${s.active}${Math.ceil(s.cooldown)}${energy < s.cost}`).join("|");
    if (k === this.powerKey) return;
    this.powerKey = k;
    const bar = $("powers");
    bar.replaceChildren();
    for (const s of slots) {
      const el = document.createElement("div");
      el.className = `slot ${s.vfx}${s.locked ? " locked" : ""}${s.active ? " active" : ""}${!s.locked && (s.cooldown > 0 || energy < s.cost) ? " unavailable" : ""}`;
      const key = document.createElement("kbd");
      key.textContent = s.key;
      const name = document.createElement("span");
      name.textContent = s.locked ? "verrouillé" : s.name;
      el.append(key, name);
      if (!s.locked && s.cooldown > 0) {
        const cd = document.createElement("b");
        cd.textContent = `${Math.ceil(s.cooldown)}`;
        el.append(cd);
      }
      bar.append(el);
    }
  }

  /** A mission being offered (null hides the card). Built with textContent: model text is never parsed as HTML. */
  showMissionOffer(o: { giver: string; title: string; briefing: string; steps: string[]; hours: number; source: string } | null): void {
    const el = $("mission-offer");
    el.replaceChildren();
    el.classList.toggle("visible", o !== null);
    if (!o) return;
    const add = (tag: string, text: string, cls = "") => {
      const n = document.createElement(tag);
      n.textContent = text;
      if (cls) n.className = cls;
      el.append(n);
      return n;
    };
    add("small", `${o.giver} te propose`);
    add("h3", o.title);
    add("p", `« ${o.briefing} »`, "briefing");
    const ol = document.createElement("ol");
    for (const st of o.steps) {
      const li = document.createElement("li");
      li.textContent = st;
      ol.append(li);
    }
    el.append(ol);
    add("p", `Délai : ${o.hours} h de jeu · deux issues possibles, à toi de choisir par tes actes.`, "meta");
    add("p", "[Entrée] accepter · [Retour arrière] refuser", "keys");
    add("em", o.source);
  }

  /** "X réfléchit…" while a mission is being written. */
  setMissionBusy(text: string): void {
    const el = $("mission-busy");
    if (el.textContent !== text) el.textContent = text;
  }

  private missionsKey = "";
  /** Active missions with their current objective and time left. */
  updateMissions(list: readonly { title: string; objective: string; left: string; choice: boolean }[]): void {
    const key = JSON.stringify(list);
    if (key === this.missionsKey) return;
    this.missionsKey = key;
    const el = $("hud-missions");
    el.replaceChildren();
    for (const m of list) {
      const row = document.createElement("div");
      row.className = m.choice ? "mission choice" : "mission";
      const t = document.createElement("strong");
      t.textContent = m.title;
      const o = document.createElement("span");
      o.textContent = m.objective;
      const l = document.createElement("i");
      l.textContent = m.left;
      row.append(t, o, l);
      el.append(row);
    }
  }

  /** What the Echo of the Past revealed (lines stay on screen for a while). */
  private echoTimer: number | undefined;
  showEcho(lines: readonly { text: string; tone: string }[]): void {
    const el = $("echo");
    el.replaceChildren();
    const h = document.createElement("h3");
    h.textContent = "Écho du passé";
    el.append(h);
    for (const l of lines) {
      const p = document.createElement("p");
      p.className = l.tone;
      p.textContent = l.text;
      el.append(p);
    }
    el.classList.add("visible");
    window.clearTimeout(this.echoTimer);
    this.echoTimer = window.setTimeout(() => el.classList.remove("visible"), 14000);
  }

  /** "Visage : Pip (42 s)" while a false face is worn. */
  setDisguise(text: string): void {
    const el = $("hud-disguise");
    if (el.textContent !== text) el.textContent = text;
  }

  setWanted(level: number): void {
    const el = $("hud-wanted");
    el.textContent = level >= 2 ? "★★ CHASSE À L'HOMME" : level === 1 ? "★ RECHERCHÉ PAR LA GARDE" : "";
  }

  /** Full-screen tint for a power (time flash, shadow veil). */
  setVeil(kind: "" | "shadow"): void {
    $("veil").className = kind;
  }

  flash(kind: "time"): void {
    const el = $("flash");
    el.className = "";
    void el.offsetWidth; // restart the animation
    el.className = kind;
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
      `${d.ai}\n` +
      `[T] vitesse du temps · [G] qualité · [F3] debug`;
  }
}
