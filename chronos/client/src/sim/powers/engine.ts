import type { Agent, AgentSystem } from "../agents";
import type { WorldClock } from "../clock";
import type { DynamicProp, PropSystem } from "../physics";
import { PLAYER_ID, hasLineOfSight, type SocialSystem } from "../social";
import { History } from "./history";
import type { AbilityDef, CastResult, EchoVision, EffectDef, PowerDef, PowerFx, PowersData } from "./types";

export interface PlayerRef {
  x: number;
  z: number;
  facing: number;
  /** Horizontal speed in m/s. */
  speed: number;
}

export interface CastContext {
  player: PlayerRef;
  /** Horizontal aim direction (camera forward), normalized. */
  aimX: number;
  aimZ: number;
  daylight: number;
}

interface Launched {
  agent: Agent;
  vx: number;
  vy: number;
  vz: number;
  /** Act to commit when they land (null for a harmless shove landing). */
  act: string | null;
}

interface Loop {
  agent: Agent;
  x: number;
  z: number;
  left: number;
  /** Game minutes between two resets. */
  period: number;
  nextAt: number;
}

const HOLD_DISTANCE = 2.4;
const HOLD_HEIGHT = 1.5;

/**
 * Data-driven powers. The engine only knows primitives (time zones, freezing,
 * rewinding, grabbing, shoving, invisibility…); `powers.json` composes them
 * into abilities with costs, cooldowns and hero/dark upgrades.
 */
export class PowerSystem {
  energy: number;
  readonly unlocked = new Set<string>();
  cloaked = false;
  holding: { prop: DynamicProp } | { agent: Agent } | null = null;
  /** False face: whose appearance the player wears, and until when (game minutes). */
  disguise: { agentId: string; until: number } | null = null;
  /** Seconds each inhabitant has been observed from close by (needed before imitating them). */
  readonly studied = new Map<string, number>();
  /** What the last Echo of the Past showed. */
  lastEcho: EchoVision[] = [];
  /** People the player holds a secret over (dark Echo upgrade). */
  readonly leverage = new Set<string>();
  /** Visual cues for the renderer (drained every frame). */
  readonly fx: PowerFx[] = [];
  private readonly cooldownUntil = new Map<string, number>();
  private readonly byId = new Map<string, { power: PowerDef; ability: AbilityDef }>();
  private readonly launched: Launched[] = [];
  private readonly loops: Loop[] = [];
  readonly history: History;
  /** Lets the game snapshot/restore state the engine does not own (coins…). */
  captureExtra: () => unknown = () => null;
  restoreExtra: (extra: unknown) => void = () => undefined;
  /** Moves the player (rewind). */
  movePlayer: (x: number, z: number, facing: number) => void = () => undefined;

  constructor(
    readonly data: PowersData,
    private readonly agents: AgentSystem,
    private readonly props: PropSystem,
    private readonly social: SocialSystem,
    private readonly clock: WorldClock,
  ) {
    this.energy = data.energy.max;
    for (const power of data.powers) for (const ability of power.abilities) this.byId.set(ability.id, { power, ability });
    for (const { power, ability } of this.byId.values()) if (power.enabled && ability.path === "base") this.unlocked.add(ability.id);
    const rate = clock.gameMinutesPerRealSecond;
    this.history = new History(6 * rate, 0.2 * rate);
    props.onHit = (prop, agent, speed) => this.onPropHit(prop, agent, speed);
  }

  /** Who witnesses believe they are looking at. */
  get apparentId(): string {
    return this.disguise ? this.disguise.agentId : PLAYER_ID;
  }

  /** Nobody recognizes the player: invisible, or wearing someone else's face. */
  get unrecognizable(): boolean {
    return this.cloaked || this.disguise !== null;
  }

  /** Seconds of close observation still needed before this person can be imitated (0 = ready). */
  studyLeft(agentId: string): number {
    const need = this.resolved("disguise")?.effects?.find((e) => e.primitive === "disguise")?.studySeconds ?? 3;
    return Math.max(0, need - (this.studied.get(agentId) ?? 0));
  }

  /** Game minutes for a duration in seconds. */
  private min(seconds: number): number {
    return seconds * this.clock.gameMinutesPerRealSecond;
  }

  // ---------------------------------------------------------------- definitions

  /** The ability as it currently works: base definition plus every unlocked upgrade. */
  resolved(id: string): AbilityDef | null {
    const entry = this.byId.get(id);
    if (!entry) return null;
    let a: AbilityDef = { ...entry.ability, effects: (entry.ability.effects ?? []).map((e) => ({ ...e })) };
    for (const { ability: up } of this.byId.values()) {
      if (up.upgrades !== id || !this.unlocked.has(up.id) || !up.set) continue;
      const effects = (a.effects ?? []).map((e) => ({ ...e, ...(up.set?.effects?.find((x) => x.primitive === e.primitive) ?? {}) }));
      a = { ...a, ...up.set, effects };
    }
    return a;
  }

  /** Abilities bound to a key, with their power (for the HUD bar). */
  castable(): { power: PowerDef; ability: AbilityDef; unlocked: boolean }[] {
    const out: { power: PowerDef; ability: AbilityDef; unlocked: boolean }[] = [];
    for (const { power, ability } of this.byId.values()) {
      if (!power.enabled || !ability.key) continue;
      out.push({ power, ability: this.resolved(ability.id) as AbilityDef, unlocked: this.unlocked.has(ability.id) });
    }
    return out;
  }

  upgrades(): { power: PowerDef; ability: AbilityDef; unlocked: boolean }[] {
    return [...this.byId.values()].filter((e) => e.power.enabled && e.ability.path !== "base").map((e) => ({ ...e, unlocked: this.unlocked.has(e.ability.id) }));
  }

  cooldownLeft(id: string, now: number): number {
    return Math.max(0, ((this.cooldownUntil.get(id) ?? 0) - now) / this.clock.gameMinutesPerRealSecond);
  }

  /** Unlocks hero/dark branches from the player's deeds. Returns what was just unlocked. */
  updateUnlocks(): AbilityDef[] {
    const fresh: AbilityDef[] = [];
    const m = this.social.moral;
    for (const { power, ability } of this.byId.values()) {
      if (!power.enabled || this.unlocked.has(ability.id) || !ability.unlock) continue;
      const u = ability.unlock;
      if ((u.heroActs === undefined || m.hero >= u.heroActs) && (u.darkActs === undefined || m.dark >= u.darkActs)) {
        this.unlocked.add(ability.id);
        fresh.push(ability);
      }
    }
    return fresh;
  }

  // ---------------------------------------------------------------- targeting

  private aimAgent(ctx: CastContext, range: number): Agent | null {
    let best: Agent | null = null;
    let bestD = range;
    for (const a of this.agents.agents) {
      if (a.insideOf || a.held) continue;
      const dx = a.x - ctx.player.x;
      const dz = a.z - ctx.player.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      if (d > 1.2 && (dx * ctx.aimX + dz * ctx.aimZ) / d < 0.6) continue;
      bestD = d;
      best = a;
    }
    return best;
  }

  /** Local flow of time at a point (time bubbles), shared with the prop physics. */
  timeFactorAt = (x: number, z: number): number => {
    let f = 1;
    for (const zone of this.agents.zones) if ((x - zone.x) ** 2 + (z - zone.z) ** 2 < zone.radius ** 2) f = Math.min(f, zone.scale);
    return f;
  };

  // ---------------------------------------------------------------- casting

  cast(id: string, ctx: CastContext): CastResult {
    const entry = this.byId.get(id);
    if (!entry) return { ok: false, reason: "unknown" };
    if (!entry.power.enabled) return { ok: false, reason: "disabled" };
    if (!this.unlocked.has(id)) return { ok: false, reason: "locked" };
    const ability = this.resolved(id) as AbilityDef;
    const now = this.clock.totalMinutes;
    const toggleOff = (id === "cloak" && this.cloaked) || (id === "grab" && this.holding !== null) || (id === "disguise" && this.disguise !== null);
    if (!toggleOff) {
      if ((this.cooldownUntil.get(id) ?? 0) > now) return { ok: false, reason: "cooldown", ability };
      if (this.energy < (ability.cost ?? 0)) return { ok: false, reason: "energy", ability };
    }
    const vfx = entry.power.vfx ?? entry.power.id;
    const p = ctx.player;
    let target: Agent | null = null;
    let seen = !toggleOff;

    for (const e of ability.effects ?? []) {
      switch (e.primitive) {
        case "timeScaleZone": {
          this.agents.zones.push({ x: p.x, z: p.z, radius: e.radius ?? 8, scale: e.scale ?? 0.3, until: now + this.min(ability.duration ?? 5) });
          this.fx.push({ kind: "zone", vfx, x: p.x, z: p.z, radius: e.radius ?? 8, duration: ability.duration ?? 5 });
          break;
        }
        case "freezeTargets": {
          const r = e.radius ?? 8;
          const until = now + this.min(ability.duration ?? 4);
          const near = this.agents.agents
            .filter((a) => !a.insideOf && (a.x - p.x) ** 2 + (a.z - p.z) ** 2 < r * r)
            .sort((a, b) => (a.x - p.x) ** 2 + (a.z - p.z) ** 2 - ((b.x - p.x) ** 2 + (b.z - p.z) ** 2) || a.index - b.index)
            .slice(0, e.maxTargets ?? 3);
          for (const a of near) a.frozenUntil = until;
          for (const prop of this.props.props) if ((prop.x - p.x) ** 2 + (prop.z - p.z) ** 2 < r * r && !prop.held) prop.frozenUntil = until;
          this.fx.push({ kind: "freeze", vfx, x: p.x, z: p.z, radius: r, duration: ability.duration ?? 4 });
          break;
        }
        case "rewindLocal": {
          if (!this.rewind(e.window ?? 4, e.radius ?? 10, p)) return { ok: false, reason: "no_target", ability };
          this.fx.push({ kind: "rewind", vfx, x: p.x, z: p.z, radius: e.radius ?? 10, duration: 1.2 });
          break;
        }
        case "timeLoop": {
          target = this.aimAgent(ctx, e.range ?? 10);
          if (!target) return { ok: false, reason: "no_target", ability };
          const period = this.min((ability.duration ?? 4.5) / (e.loops ?? 3));
          this.loops.push({ agent: target, x: target.x, z: target.z, left: e.loops ?? 3, period, nextAt: now + period });
          this.fx.push({ kind: "loop", vfx, x: target.x, z: target.z, radius: 1.5, duration: ability.duration ?? 4.5 });
          break;
        }
        case "grab": {
          if (this.holding) {
            this.release(ctx, e);
            seen = true;
          } else {
            const prop = this.props.nearest(p.x, p.z, e.range ?? 12, ctx.aimX, ctx.aimZ, 0.5);
            const person = e.people ? this.aimAgent(ctx, e.range ?? 12) : null;
            const propD = prop ? Math.hypot(prop.x - p.x, prop.z - p.z) : Infinity;
            const personD = person ? Math.hypot(person.x - p.x, person.z - p.z) : Infinity;
            if (!prop && !person) return { ok: false, reason: "no_target", ability };
            if (person && personD < propD) {
              person.held = true;
              person.frozenUntil = 0;
              this.holding = { agent: person };
              this.agents.setEmote(person, "!", now, this.min(4));
            } else if (prop) {
              prop.held = true;
              this.holding = { prop };
            }
            this.fx.push({ kind: "grab", vfx, x: p.x, z: p.z });
          }
          break;
        }
        case "shove": {
          target = this.aimAgent(ctx, e.range ?? 9);
          if (!target) return { ok: false, reason: "no_target", ability };
          const dx = target.x - p.x;
          const dz = target.z - p.z;
          const d = Math.hypot(dx, dz) || 1;
          const t = 0.55;
          const dist = e.distance ?? 5;
          target.held = true;
          this.launched.push({ agent: target, vx: ((dx / d) * dist) / t, vy: 4.5, vz: ((dz / d) * dist) / t, act: null });
          this.fx.push({ kind: "shove", vfx, x: target.x, z: target.z });
          break;
        }
        case "echoRead": {
          const visions = this.readEcho(p, e);
          if (visions.length === 0) return { ok: false, reason: "nothing_here", ability };
          this.lastEcho = visions;
          this.fx.push({ kind: "echo", vfx, x: p.x, z: p.z, radius: e.radius ?? 12, duration: 9 });
          break;
        }
        case "disguise": {
          if (this.disguise) {
            this.dropDisguise();
            seen = false;
            break;
          }
          target = this.aimAgent(ctx, e.range ?? 8);
          if (!target) return { ok: false, reason: "no_target", ability };
          if ((this.studied.get(target.id) ?? 0) < (e.studySeconds ?? 3)) return { ok: false, reason: "not_studied", ability };
          // People see him change *before* the new face settles (unless he is hidden).
          this.witness(entry.power, null, ctx);
          seen = false;
          this.disguise = { agentId: target.id, until: now + this.min(ability.duration ?? 60) };
          this.fx.push({ kind: "mask", vfx, x: p.x, z: p.z });
          target = null; // imitating someone is not an act against them
          break;
        }
        case "invisibility": {
          if (this.cloaked) {
            this.reveal();
            seen = false;
          } else {
            // People see him vanish *before* he is hidden.
            this.witness(entry.power, null, ctx);
            seen = false;
            this.cloaked = true;
            this.fx.push({ kind: "cloak", vfx, x: p.x, z: p.z });
          }
          break;
        }
      }
    }

    if (!toggleOff) {
      this.energy -= ability.cost ?? 0;
      this.cooldownUntil.set(id, now + this.min(ability.cooldown ?? 0));
    }
    if (ability.act && target) {
      this.social.commit(ability.act, target, { actorId: PLAYER_ID, apparentActorId: this.apparentId, x: p.x, z: p.z, daylight: ctx.daylight, hidden: this.cloaked }, now);
    } else if (seen) this.witness(entry.power, null, ctx);
    return { ok: true, ability };
  }

  /** Using a power in front of people is itself an event they remember. */
  private witness(power: PowerDef, target: Agent | null, ctx: CastContext): void {
    if (!power.witnessAct) return;
    this.social.commit(power.witnessAct, target, { actorId: PLAYER_ID, apparentActorId: this.apparentId, x: ctx.player.x, z: ctx.player.z, daylight: ctx.daylight, hidden: this.cloaked }, this.clock.totalMinutes);
  }

  /** Ends the false face. */
  dropDisguise(): void {
    if (!this.disguise) return;
    this.disguise = null;
    this.fx.push({ kind: "unmask", vfx: "face", x: 0, z: 0 });
  }

  /**
   * Echo of the Past: what the world log holds about this place. No AI, no
   * invention: true authors (even masked), erased moments and time folds included.
   */
  private readEcho(p: PlayerRef, e: EffectDef): EchoVision[] {
    const now = this.clock.totalMinutes;
    const events = this.social.log
      .query({ near: { x: p.x, z: p.z, radius: e.radius ?? 12 }, since: now - (e.window ?? 24) * 60, includeUndone: true })
      .filter((ev) => ev.act !== "power_echo")
      .sort((a, b) => b.t - a.t || b.id - a.id)
      .slice(0, e.maxVisions ?? 5);
    const acts = this.social.acts.acts;
    return events.map((ev) => {
      // Dark upgrade: other people's crimes and secrets become leverage over them.
      if (e.leverage && !ev.undone) {
        const tags = acts[ev.act]?.tags ?? [];
        if (ev.actorId !== PLAYER_ID && (tags.includes("crime") || tags.includes("secret"))) {
          this.leverage.add(ev.actorId);
          if (tags.includes("secret") && ev.targetId) this.leverage.add(ev.targetId);
        }
      }
      return {
        eventId: ev.id,
        age: now - ev.t,
        act: ev.act,
        actorId: ev.actorId,
        apparentActorId: ev.apparentActorId,
        targetId: ev.targetId,
        x: ev.x,
        z: ev.z,
        undone: !!ev.undone,
        fold: ev.act === "time_fold",
        masked: ev.actorId !== ev.apparentActorId,
        witnessIds: e.showWitnesses ? [...ev.witnessIds] : [],
      };
    });
  }

  /** Drops the invisibility (ran out of energy, struck someone…). */
  reveal(): void {
    if (!this.cloaked) return;
    this.cloaked = false;
    this.fx.push({ kind: "uncloak", vfx: "shadow", x: 0, z: 0 });
  }

  /** Multiplier applied to pickpocket loot (dark shadow upgrade, only while cloaked). */
  get theftMultiplier(): number {
    if (!this.cloaked) return 1;
    return this.resolved("cloak")?.effects?.find((e) => e.primitive === "invisibility")?.theftMultiplier ?? 1;
  }

  private release(ctx: CastContext, e: EffectDef): void {
    const h = this.holding;
    if (!h) return;
    this.holding = null;
    const speed = e.throwSpeed ?? 14;
    const now = this.clock.totalMinutes;
    if ("prop" in h) {
      h.prop.held = false;
      h.prop.vx = h.prop.vy = h.prop.vz = 0;
      h.prop.spin = 6;
      this.props.impulse(h.prop, ctx.aimX * speed, 3.2, ctx.aimZ * speed, now);
      this.fx.push({ kind: "throw", vfx: "telekinesis", x: h.prop.x, z: h.prop.z });
      return;
    }
    const a = h.agent;
    if (e.people === "violent") {
      this.launched.push({ agent: a, vx: ctx.aimX * speed * 0.55, vy: 6, vz: ctx.aimZ * speed * 0.55, act: "tk_crush" });
      this.fx.push({ kind: "throw", vfx: "telekinesis", x: a.x, z: a.z });
    } else {
      this.land(a, null);
    }
  }

  /** Puts a carried or thrown person back on walkable ground. */
  private land(a: Agent, act: string | null): void {
    const nav = this.agents.places.nav;
    const cell = nav.nearestFree(a.x, a.z, 30);
    if (cell >= 0 && !nav.isWalkable(a.x, a.z)) {
      a.x = nav.cx(cell % nav.size);
      a.z = nav.cx((cell / nav.size) | 0);
    }
    a.y = 0;
    a.held = false;
    a.prevX = a.x;
    a.prevZ = a.z;
    const now = this.clock.totalMinutes;
    a.nextThinkAt = now + this.min(1.5);
    this.agents.hold(a, a.x, a.z + 1, now, this.min(1.5));
    if (act) this.social.commit(act, a, { actorId: PLAYER_ID, apparentActorId: this.apparentId, x: a.x, z: a.z, daylight: this.clock.daylight, hidden: this.cloaked }, now);
  }

  private onPropHit(prop: DynamicProp, agent: Agent, _speed: number): void {
    this.social.commit("tk_strike", agent, { actorId: PLAYER_ID, apparentActorId: this.apparentId, x: prop.x, z: prop.z, daylight: this.clock.daylight, hidden: this.cloaked }, this.clock.totalMinutes);
  }

  /**
   * Rewinds everything within `radius` to its state `windowSeconds` ago, and
   * erases the events that happened there since. Returns false when there is no history yet.
   */
  private rewind(windowSeconds: number, radius: number, p: PlayerRef): boolean {
    const now = this.clock.totalMinutes;
    const frame = this.history.frameAt(now - this.min(windowSeconds));
    if (!frame) return false;
    const r2 = radius * radius;
    const inRange = (x: number, z: number) => (x - p.x) ** 2 + (z - p.z) ** 2 < r2;
    this.agents.agents.forEach((a, i) => {
      const old = frame.agents[i];
      if (!old || !(inRange(a.x, a.z) || inRange(old.x, old.z))) return;
      Object.assign(a, JSON.parse(JSON.stringify(old)) as Agent);
      a.prevX = a.x;
      a.prevZ = a.z;
    });
    this.props.props.forEach((prop, i) => {
      const old = frame.props[i];
      if (old && (inRange(prop.x, prop.z) || inRange(old.x, old.z))) Object.assign(prop, old);
    });
    // Whatever was being carried or thrown is back where it was.
    this.holding = null;
    this.launched.length = 0;
    this.loops.length = 0;
    for (const a of this.agents.agents) if (a.held && inRange(a.x, a.z)) a.held = false;
    for (const e of this.social.log.query({ since: frame.t, near: { x: p.x, z: p.z, radius } })) {
      if (e.act !== "time_fold") this.social.undo(e.id, now);
    }
    this.movePlayer(frame.player.x, frame.player.z, frame.player.facing);
    this.restoreExtra(frame.extra);
    // The fold itself leaves a trace only Echo of the Past can read (J6).
    this.social.log.add({
      t: now, act: "time_fold", actorId: PLAYER_ID, apparentActorId: PLAYER_ID, targetId: null, x: p.x, z: p.z,
      districtId: null, importance: 0.9, tags: ["time", "fold"], witnessIds: [],
    });
    this.history.clear();
    return true;
  }

  // ---------------------------------------------------------------- per-tick update

  /** @param dt real seconds of the tick */
  update(dt: number, ctx: CastContext): void {
    const now = this.clock.totalMinutes;
    const E = this.data.energy;
    const scale = this.clock.timeScale > 0 ? 1 : 0;
    const p = ctx.player;

    // Energy: drains while a sustained power is active, otherwise recharges (faster when standing still).
    let drain = 0;
    if (this.cloaked) {
      const cloak = this.resolved("cloak");
      const still = cloak?.effects?.find((e) => e.primitive === "invisibility")?.stillDrainFactor ?? 1;
      drain += (cloak?.drainPerSecond ?? 6) * (p.speed < 0.3 ? still : 1);
    }
    if (this.holding) drain += this.resolved("grab")?.drainPerSecond ?? 4;
    if (drain > 0) this.energy -= drain * dt * scale;
    else this.energy += (E.regenPerSecond + (p.speed < 0.3 ? E.regenRestingBonus : 0)) * dt * scale;
    this.energy = Math.max(0, Math.min(E.max, this.energy));
    if (this.energy <= 0) {
      if (this.cloaked) this.reveal();
      if (this.holding) this.release(ctx, { primitive: "grab", throwSpeed: 0 });
    }

    // False face: study people from close by; a worn face expires, and close ones can see through it.
    const dis = this.resolved("disguise")?.effects?.find((e) => e.primitive === "disguise");
    if (dis && this.unlocked.has("disguise")) {
      const studyR2 = (dis.studyRange ?? 4) ** 2;
      for (const a of this.agents.agents) {
        if (a.insideOf) continue;
        const near = (a.x - p.x) ** 2 + (a.z - p.z) ** 2 < studyR2;
        const cur = this.studied.get(a.id) ?? 0;
        if (near) this.studied.set(a.id, Math.min(cur + dt * scale, 30));
        else if (cur > 0) this.studied.set(a.id, Math.max(0, cur - dt * scale * 0.05)); // fades slowly
      }
      const d = this.disguise;
      if (d) {
        if (now >= d.until) this.dropDisguise();
        else if (!this.cloaked) {
          const spot2 = (dis.spotRange ?? 7) ** 2;
          const world = this.agents.places.collision;
          for (const a of this.agents.agents) {
            if ((a.x - p.x) ** 2 + (a.z - p.z) ** 2 > spot2) continue;
            // The person themself, or someone close to them, is not fooled — if they get a good look:
            // they must be awake, outdoors, facing the impostor, with nothing in between.
            const close = a.id === d.agentId || this.social.relation(a.id, d.agentId) > 30 || this.social.relation(d.agentId, a.id) > 30;
            if (!close || a.insideOf || a.activity === "sleep" || a.frozenUntil > now) continue;
            const dx = p.x - a.x;
            const dz = p.z - a.z;
            const dist = Math.hypot(dx, dz) || 1;
            if ((Math.sin(a.facing) * dx + Math.cos(a.facing) * dz) / dist < 0.3) continue;
            if (!hasLineOfSight(world, a.x, a.z, p.x, p.z)) continue;
            this.dropDisguise();
            const victim = this.agents.agents.find((x) => x.id === d.agentId) ?? null;
            this.agents.setEmote(a, "?", now, this.min(4));
            this.social.commit("impersonation", victim, { actorId: PLAYER_ID, x: p.x, z: p.z, daylight: ctx.daylight, targetNotices: a.id === d.agentId }, now);
            this.spottedBy = a.id;
            break;
          }
        }
      }
    }

    // Carried object or person follows a point in front of the caster.
    const h = this.holding;
    if (h) {
      const tx = p.x + ctx.aimX * HOLD_DISTANCE;
      const tz = p.z + ctx.aimZ * HOLD_DISTANCE;
      if ("prop" in h) this.props.hold(h.prop, tx, HOLD_HEIGHT, tz, dt);
      else {
        const a = h.agent;
        const k = Math.min(1, 10 * dt);
        a.prevX = a.x;
        a.prevZ = a.z;
        a.x += (tx - a.x) * k;
        a.z += (tz - a.z) * k;
        a.y += (HOLD_HEIGHT - a.y) * k;
        a.anim = "idle";
      }
    }

    // People in flight (shoved or thrown).
    for (let i = this.launched.length - 1; i >= 0; i--) {
      const l = this.launched[i] as Launched;
      const a = l.agent;
      a.prevX = a.x;
      a.prevZ = a.z;
      l.vy -= 18 * dt;
      const nx = a.x + l.vx * dt;
      const nz = a.z + l.vz * dt;
      // Stop at walls instead of flying through buildings.
      if (a.y > 3 || this.agents.places.nav.isWalkable(nx, nz)) {
        a.x = nx;
        a.z = nz;
      } else l.vx = l.vz = 0;
      a.y += l.vy * dt;
      if (a.y <= 0 && l.vy < 0) {
        this.launched.splice(i, 1);
        this.land(a, l.act);
      }
    }

    // Time loops: the victim is yanked back to where the loop started.
    for (let i = this.loops.length - 1; i >= 0; i--) {
      const loop = this.loops[i] as Loop;
      if (now < loop.nextAt) continue;
      const a = loop.agent;
      if (!a.insideOf && !a.held) {
        a.x = a.prevX = loop.x;
        a.z = a.prevZ = loop.z;
        this.agents.setEmote(a, "?", now, loop.period);
        this.agents.react(a, "flee", this.clockPlayer.x, this.clockPlayer.z, now, "?");
      }
      loop.left--;
      loop.nextAt = now + loop.period;
      if (loop.left <= 0) this.loops.splice(i, 1);
    }
    this.clockPlayer = { x: p.x, z: p.z };

    this.history.record(now, this.agents.agents, this.props.props, { x: p.x, z: p.z, facing: p.facing }, this.captureExtra());
  }

  private clockPlayer = { x: 0, z: 0 };
  /** Who last saw through the false face (for the UI). */
  spottedBy: string | null = null;
}
