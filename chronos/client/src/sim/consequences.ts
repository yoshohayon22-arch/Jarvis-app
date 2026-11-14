import type { ActsDef, FactionId } from "@chronos/shared";
import type { Agent, AgentSystem } from "./agents";
import type { WorldClock } from "./clock";
import { districtAt } from "./districts";
import { PLAYER_ID, perceives, type ActResult, type SocialSystem } from "./social";

export interface ConsequencesDef {
  terror: { perFearAct: number; perWitness: number; violentBonus: number; decayPerHour: number; threshold: number };
  wanted: { giveUpMinutes: number; catchDistance: number; fineAll: boolean; jailUntilHour: number; reputationAfterJail: number };
  betrayal: { allyAbove: number; betrayBelow: number; guardPenalty: number };
  framing: { accusationsToArrest: number; jailHours: number };
  rules: {
    id: string;
    label: string;
    when: Record<string, { lt?: number; gt?: number }>;
    then: { wanted?: number; flag?: string };
  }[];
}

export interface PlayerView {
  x: number;
  z: number;
  /** Invisible (Shadow power): nobody can see or catch him. */
  hidden: boolean;
}

export type ConsequenceNotice =
  | { kind: "rule_on" | "rule_off"; text: string }
  | { kind: "district_terrorized" | "district_recovered"; text: string; districtId: string }
  | { kind: "betrayal"; text: string; agentId: string }
  | { kind: "arrest"; text: string }
  | { kind: "framed"; text: string; agentId: string };

/**
 * Turns reputations and deeds into visible changes of the world:
 * the guard hunts a wanted player, terrorized districts empty, betrayed allies
 * denounce you. Rules and thresholds come from the pack (consequences.json).
 */
export class ConsequenceSystem {
  readonly active = new Set<string>();
  readonly flags = new Set<string>();
  wantedLevel = 0;
  /** Terror per district, 0..1. */
  readonly terror = new Map<string, number>();
  readonly terrorized = new Set<string>();
  /** Key characters who liked the player enough to feel betrayed later. */
  readonly allies = new Set<string>();
  readonly betrayers = new Set<string>();
  /** How many crimes each inhabitant has been blamed for (rightly or not). */
  readonly accusations = new Map<string, number>();
  /** Notices for the UI (drained by the game). */
  readonly notices: ConsequenceNotice[] = [];
  private lastSeen: { x: number; z: number; t: number } | null = null;
  private lastEval = -Infinity;
  private lastDecay: number | null = null;
  private lastChase = -Infinity;
  /** Set by the game: what happens when a guard catches the player. */
  onArrest: (() => void) | null = null;

  constructor(
    readonly def: ConsequencesDef,
    private readonly agents: AgentSystem,
    private readonly social: SocialSystem,
    private readonly acts: ActsDef,
    private readonly clock: WorldClock,
  ) {
    for (const d of agents.places.layout.districts) this.terror.set(d.id, 0);
    agents.avoidDistrict = (id) => this.terrorized.has(id);
    social.onCommit = (result, actId) => this.onAct(result, actId);
  }

  private value(key: string): number {
    const [kind, id] = key.split(".") as [string, string];
    if (kind === "rep") return this.social.reputation.factions[id as FactionId] ?? 0;
    if (kind === "terror") return this.terror.get(id) ?? 0;
    return 0;
  }

  /** Fear spreads terror in the district where it happens. */
  private onAct(result: ActResult, actId: string): void {
    const act = this.acts.acts[actId];
    const e = result.event;
    if (act) this.accuse(result, act.tags);
    if (!act || e.actorId !== PLAYER_ID || !act.tags.includes("fear")) return;
    const district = e.districtId ?? districtAt(this.agents.places.layout, e.x, e.z)?.id;
    if (!district) return;
    const T = this.def.terror;
    const seen = result.witnesses.length + (result.targetNoticed ? 1 : 0);
    if (seen === 0) return;
    const add = T.perFearAct + T.perWitness * Math.min(seen, 10) + (act.violent ? T.violentBonus : 0);
    this.terror.set(district, Math.min(1, (this.terror.get(district) ?? 0) + add));
  }

  /**
   * Someone other than the player is believed guilty of a crime — truly (a thief
   * caught in the act) or because the player wore their face. The guard takes them away
   * once a guard saw it or enough separate accusations pile up.
   */
  private accuse(result: ActResult, tags: readonly string[]): void {
    const e = result.event;
    const accused = e.apparentActorId;
    if (accused === PLAYER_ID || !tags.includes("crime")) return;
    const seen = result.witnesses.length + (result.targetNoticed ? 1 : 0);
    if (seen === 0) return;
    const agent = this.agents.agents.find((a) => a.id === accused);
    if (!agent || agent.faction === "royal_guard") return;
    const now = this.clock.totalMinutes;
    const count = (this.accusations.get(accused) ?? 0) + 1;
    this.accusations.set(accused, count);
    const guardSaw = result.witnesses.some((w) => w.faction === "royal_guard");
    if (agent.jailedUntil > now || (!guardSaw && count < this.def.framing.accusationsToArrest)) return;
    this.agents.jail(agent, now + this.def.framing.jailHours * 60);
    this.accusations.set(accused, 0);
    if (e.actorId === PLAYER_ID) {
      const text = `${agent.name} est arrêté à ta place : tu portais son visage.`;
      this.social.pushFeed(now, text, "bad");
      this.notices.push({ kind: "framed", agentId: accused, text });
    }
  }

  /** Called every simulation tick. */
  step(player: PlayerView): void {
    const now = this.clock.totalMinutes;
    if (this.lastDecay === null) this.lastDecay = now;
    // Stay correct if the clock ever moves backwards (debug time jump, loaded save).
    if (now < this.lastEval) this.lastEval = -Infinity;
    if (now < this.lastChase) this.lastChase = -Infinity;
    if (this.lastSeen && now < this.lastSeen.t) this.lastSeen.t = now;
    if (now - this.lastEval >= 1) {
      this.lastEval = now;
      this.decayTerror(now);
      this.evaluateRules();
      this.checkBetrayals(now);
      // In a terrorized district (or when shunned), people run when they see him coming.
      if (!player.hidden) {
        this.agents.forNeighbors(player.x, player.z, 6, (a) => {
          if (!a.reacting && !a.held && a.frozenUntil <= now && this.shuns(a) && Math.hypot(a.x - player.x, a.z - player.z) < 6)
            this.agents.react(a, "flee", player.x, player.z, now, "!");
        });
      }
    }
    this.pursue(player, now);
  }

  private decayTerror(now: number): void {
    const hours = Math.max(0, now - (this.lastDecay as number)) / 60;
    this.lastDecay = now;
    const T = this.def.terror;
    for (const [id, v] of this.terror) {
      const next = Math.max(0, v - T.decayPerHour * hours);
      this.terror.set(id, next);
      const name = this.agents.places.districts.get(id)?.name ?? id;
      // Hysteresis: a district recovers only once terror has clearly fallen.
      if (!this.terrorized.has(id) && next >= T.threshold) {
        this.terrorized.add(id);
        this.notices.push({ kind: "district_terrorized", districtId: id, text: `${name} vit dans la peur : les rues se vident.` });
        this.sendHome(id, now);
      } else if (this.terrorized.has(id) && next < T.threshold * 0.6) {
        this.terrorized.delete(id);
        this.notices.push({ kind: "district_recovered", districtId: id, text: `${name} reprend vie.` });
      }
    }
  }

  /** People currently in a district that just became terrorized reconsider at once. */
  private sendHome(districtId: string, now: number): void {
    for (const a of this.agents.agents) {
      if (a.faction === "royal_guard" || a.insideOf) continue;
      if (this.agents.places.districtOf(a.place) === districtId) a.nextThinkAt = now;
    }
  }

  private evaluateRules(): void {
    let wanted = 0;
    const flags = new Set<string>();
    for (const rule of this.def.rules) {
      const on = Object.entries(rule.when).every(([key, c]) => {
        const v = this.value(key);
        return (c.lt === undefined || v < c.lt) && (c.gt === undefined || v > c.gt);
      });
      if (on) {
        if (rule.then.wanted) wanted = Math.max(wanted, rule.then.wanted);
        if (rule.then.flag) flags.add(rule.then.flag);
      }
      if (on && !this.active.has(rule.id)) {
        this.active.add(rule.id);
        this.notices.push({ kind: "rule_on", text: rule.label });
      } else if (!on && this.active.has(rule.id)) {
        this.active.delete(rule.id);
        this.notices.push({ kind: "rule_off", text: `Ce n'est plus vrai : ${rule.label.charAt(0).toLowerCase()}${rule.label.slice(1)}` });
      }
    }
    this.wantedLevel = wanted;
    this.flags.clear();
    for (const f of flags) this.flags.add(f);
    if (wanted === 0) {
      this.lastSeen = null;
      for (const a of this.agents.agents) a.pursuing = false;
    }
  }

  /** An ally (opinion once high) whose opinion collapses goes to denounce the player. */
  private checkBetrayals(now: number): void {
    const B = this.def.betrayal;
    for (const a of this.agents.agents) {
      if (!a.key || this.betrayers.has(a.id)) continue;
      const op = this.social.reputation.opinion(a.id);
      if (op >= B.allyAbove) this.allies.add(a.id);
      else if (op <= B.betrayBelow && this.allies.has(a.id)) {
        this.betrayers.add(a.id);
        this.allies.delete(a.id);
        this.social.reputation.adjust("royal_guard", B.guardPenalty);
        const text = `${a.name}, que tu as trahi, t'a dénoncé à la garde.`;
        this.social.pushFeed(now, text, "bad");
        this.notices.push({ kind: "betrayal", agentId: a.id, text });
        // Visibly: they hurry to the barracks to talk to the guard.
        const yard = this.agents.places.spots.get("barracks_yard");
        if (yard && !a.insideOf) this.agents.react(a, "confront", yard.pos[0], yard.pos[1], now, "…");
      }
    }
  }

  /** Guards who see a wanted player chase him; if they reach him, he is arrested. */
  private pursue(player: PlayerView, now: number): void {
    if (this.wantedLevel === 0) return;
    const W = this.def.wanted;
    const daylight = this.clock.daylight;
    const world = this.agents.places.collision;
    const guards = this.agents.agents.filter((a) => a.faction === "royal_guard" && !a.insideOf && !a.held && a.frozenUntil <= now);
    let seenNow = false;
    for (const g of guards) {
      if (!player.hidden && perceives(g, player.x, player.z, world, { daylight })) {
        seenNow = true;
        if (!g.pursuing) {
          g.pursuing = true;
          this.agents.setEmote(g, "!", now, 3);
        }
      }
    }
    if (seenNow) this.lastSeen = { x: player.x, z: player.z, t: now };
    if (this.lastSeen && now - this.lastSeen.t > W.giveUpMinutes) {
      this.lastSeen = null;
      for (const g of guards) g.pursuing = false;
    }
    if (!this.lastSeen) return;
    // At level 2 the alarm is general: every guard outdoors joins the hunt.
    if (this.wantedLevel >= 2) for (const g of guards) g.pursuing = true;

    // Re-plan a few times per second toward the last known position.
    if (now - this.lastChase >= 0.5) {
      this.lastChase = now;
      for (const g of guards) if (g.pursuing) this.agents.react(g, "confront", this.lastSeen.x, this.lastSeen.z, now, g.emote || "!");
    }
    if (player.hidden) return;
    for (const g of guards) {
      if (g.pursuing && Math.hypot(g.x - player.x, g.z - player.z) < W.catchDistance) {
        this.arrest(now);
        return;
      }
    }
  }

  private arrest(now: number): void {
    const W = this.def.wanted;
    for (const a of this.agents.agents) a.pursuing = false;
    this.lastSeen = null;
    // The sentence is served: the guard's grudge is partly settled.
    const rep = this.social.reputation;
    if (rep.factions.royal_guard < W.reputationAfterJail) rep.adjust("royal_guard", W.reputationAfterJail - rep.factions.royal_guard);
    const text = "Arrêté ! La garde vide ta bourse et te jette au cachot jusqu'à l'aube.";
    this.social.pushFeed(now, text, "bad");
    this.notices.push({ kind: "arrest", text });
    this.onArrest?.();
    this.evaluateRules();
  }

  /** Should this inhabitant shy away from the player right now? (terrorized district or shunned) */
  shuns(a: Agent): boolean {
    if (a.faction === "royal_guard") return false;
    if (this.flags.has("villagers_shun") && a.faction === "villagers") return true;
    const d = districtAt(this.agents.places.layout, a.x, a.z);
    return !!d && this.terrorized.has(d.id);
  }
}
