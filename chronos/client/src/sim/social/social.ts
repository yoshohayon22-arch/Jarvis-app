import type { ActsDef, CharacterDef, FactionId } from "@chronos/shared";
import { SeededRng } from "../../core/rng";
import type { Agent, AgentSystem } from "../agents";
import { districtAt } from "../districts";
import { EventLog, PLAYER_ID, type WorldEvent } from "./events";
import { MemoryStore, memoryWeight, type Claim, type Memory } from "./memory";
import { witnessesOf } from "./perception";
import { Reputation } from "./reputation";
import { retell, tellChance, tellable } from "./rumors";

export interface ActContext {
  /** Real author and where they stand. */
  actorId: string;
  x: number;
  z: number;
  /** Who people think they see (false face, J6). Defaults to the actor. */
  apparentActorId?: string;
  /** The actor cannot be perceived (Shadow, J5). */
  hidden?: boolean;
  daylight: number;
  /** Whether the target itself notices (e.g. a pickpocket from behind goes unnoticed). */
  targetNotices?: boolean;
}

export interface ActResult {
  event: WorldEvent;
  witnesses: Agent[];
  targetNoticed: boolean;
}

export interface FeedEntry {
  t: number;
  text: string;
  tone: "good" | "bad" | "neutral";
}

/**
 * Memory, rumors and reputations. Deterministic and AI-free: acts become
 * events, witnesses remember them, stories travel by word of mouth, and each
 * person who learns something shifts their own opinion and their group's.
 */
export class SocialSystem {
  readonly log = new EventLog();
  readonly memory = new MemoryStore();
  readonly reputation: Reputation;
  readonly feed: FeedEntry[] = [];
  readonly rng: SeededRng;
  private readonly byId = new Map<string, Agent>();
  private readonly relations = new Map<string, number>();
  private lastGossipMinute = -Infinity;
  private lastConsolidation = -Infinity;
  /** Event id → number of people who know about it. */
  readonly informed = new Map<number, number>();
  private announced = new Map<number, number>();

  constructor(
    readonly agents: AgentSystem,
    readonly acts: ActsDef,
    characters: readonly CharacterDef[],
    seed: number,
  ) {
    this.rng = new SeededRng(seed ^ 0x2f6b1a57);
    for (const a of agents.agents) this.byId.set(a.id, a);
    for (const c of characters) for (const r of c.relations) this.relations.set(`${c.id}|${r.to}`, r.value);
    this.reputation = new Reputation(acts, (from, to) => this.relation(from, to));
  }

  relation(fromId: string, toId: string): number {
    return this.relations.get(`${fromId}|${toId}`) ?? 0;
  }

  private factionOf(id: string | null): FactionId | null {
    return id ? this.byId.get(id)?.faction ?? null : null;
  }

  private learn(listener: Agent, m: Memory, weight: number): boolean {
    if (!this.memory.add(listener.id, m)) return false;
    this.informed.set(m.eventId, (this.informed.get(m.eventId) ?? 0) + 1);
    this.reputation.inform(listener, m.claim, m.eventId, weight * m.confidence, this.factionOf(m.claim.targetId));
    return true;
  }

  /**
   * Someone does something to someone. Creates the event, finds the witnesses,
   * gives them memories and applies first-hand reputation effects.
   */
  commit(actId: string, target: Agent | null, ctx: ActContext, now: number): ActResult {
    const act = this.acts.acts[actId];
    if (!act) throw new Error(`Unknown act "${actId}"`);
    const apparent = ctx.apparentActorId ?? ctx.actorId;
    const layout = this.agents.places.layout;
    const exclude = new Set([ctx.actorId, apparent]);
    if (target) exclude.add(target.id);
    const witnesses = witnessesOf(this.agents.agents, ctx.x, ctx.z, this.agents.places.collision, { daylight: ctx.daylight, actorHidden: ctx.hidden }, exclude);
    const targetNoticed = !!target && (ctx.targetNotices ?? true);

    const event = this.log.add({
      t: now,
      act: actId,
      actorId: ctx.actorId,
      apparentActorId: apparent,
      targetId: target?.id ?? null,
      x: ctx.x,
      z: ctx.z,
      districtId: districtAt(layout, ctx.x, ctx.z)?.id ?? null,
      importance: act.importance,
      tags: [...act.tags],
      witnessIds: witnesses.map((w) => w.id),
    });
    const claim: Claim = { actorId: apparent, act: actId, targetId: event.targetId, districtId: event.districtId, severity: 1 };
    const W = this.acts.tuning.witnessWeight;
    const base = { eventId: event.id, t: now, from: null, hops: 0, confidence: 1, importance: act.importance };
    if (target && targetNoticed) this.learn(target, { ...base, kind: "suffered", claim: { ...claim } }, W);
    for (const w of witnesses) this.learn(w, { ...base, kind: "witnessed", claim: { ...claim } }, W);

    // Visible reactions.
    const sys = this.agents;
    if (act.reaction === "cheer") {
      if (target && targetNoticed) sys.react(target, "cheer", ctx.x, ctx.z, now, "♥");
      for (const w of witnesses) sys.react(w, "watch", ctx.x, ctx.z, now, w.faction === "thieves_guild" ? "…" : "♥");
    } else {
      if (target && targetNoticed) sys.react(target, act.violent ? "flee" : "watch", ctx.x, ctx.z, now, "!");
      for (const w of witnesses) {
        if (w.faction === "royal_guard") sys.react(w, "confront", ctx.x, ctx.z, now, "!");
        else if (act.violent && w.traits.brave < 0.45) sys.react(w, "flee", ctx.x, ctx.z, now, "!");
        else sys.react(w, "watch", ctx.x, ctx.z, now, w.faction === "thieves_guild" ? "…" : "!");
      }
    }

    if (apparent === PLAYER_ID || ctx.actorId === PLAYER_ID) {
      const seen = witnesses.length + (targetNoticed ? 1 : 0);
      const who = target ? target.name : "";
      this.pushFeed(
        now,
        seen === 0
          ? `Personne ne t'a vu : « ${this.describe(claim, true)} » reste entre toi et ${who || "ta conscience"}.`
          : `${seen} ${seen > 1 ? "personnes savent" : "personne sait"} : ${this.describe(claim, true)}.`,
        act.reaction === "cheer" ? "good" : "bad",
      );
      this.announced.set(event.id, seen);
    }
    return { event, witnesses, targetNoticed };
  }

  /** French sentence for a claim: "Kael a volé Aldric Montclar (Place du Marché)". */
  describe(claim: Claim, secondPerson = false): string {
    const act = this.acts.acts[claim.act];
    const actor = claim.actorId === PLAYER_ID ? (secondPerson ? "tu" : "Kael") : this.byId.get(claim.actorId)?.name ?? "quelqu'un";
    let verb = act?.label ?? claim.act;
    if (secondPerson && claim.actorId === PLAYER_ID) verb = verb.replace(/^a /, "as ");
    const target = claim.targetId ? this.byId.get(claim.targetId)?.name ?? "quelqu'un" : "";
    const where = claim.districtId ? this.agents.places.districts.get(claim.districtId)?.name : null;
    const many = claim.severity >= 1.5 ? " sauvagement" : claim.severity > 1 ? " sans pitié" : "";
    return `${actor} ${verb}${many && act?.reaction === "alarm" ? many : ""} ${target}${where ? ` (${where})` : ""}`.trim();
  }

  /** Adds a line to the player's journal feed. */
  pushFeed(t: number, text: string, tone: FeedEntry["tone"]): void {
    this.feed.push({ t, text, tone });
    if (this.feed.length > 40) this.feed.shift();
  }

  /** People who can currently talk to this agent: close by outdoors, or in the same building (awake). */
  private listenersFor(a: Agent): Agent[] {
    if (a.activity === "sleep") return [];
    if (a.insideOf) return this.agents.agents.filter((o) => o !== a && o.insideOf === a.insideOf && o.activity !== "sleep");
    if (a.mode === "moving") return [];
    const out: Agent[] = [];
    this.agents.forNeighbors(a.x, a.z, 2.8, (o) => {
      if (o !== a && !o.insideOf && o.mode !== "moving" && (o.x - a.x) ** 2 + (o.z - a.z) ** 2 < 2.8 * 2.8) out.push(o);
    });
    return out.sort((p, q) => p.index - q.index);
  }

  /** One round of word of mouth: every talkative person may pass one story to one neighbor. */
  private gossip(now: number): void {
    const T = this.acts.tuning;
    const rand = () => this.rng.next();
    for (const teller of this.agents.agents) {
      const mems = this.memory.of(teller.id);
      if (mems.length === 0) continue;
      const listeners = this.listenersFor(teller);
      if (listeners.length === 0) continue;
      // The story most worth telling right now.
      let best: Memory | null = null;
      let bestW = 0;
      for (const m of mems) {
        if (!tellable(m, now, T.retellDelay)) continue;
        if (m.claim.actorId === teller.id) continue; // nobody spreads their own misdeeds
        const w = memoryWeight(m, now, teller.traits.grudge);
        if (w > bestW) {
          bestW = w;
          best = m;
        }
      }
      if (!best) continue;
      const fresh = listeners.filter((l) => !this.memory.knows(l.id, (best as Memory).eventId) && l.id !== (best as Memory).claim.actorId);
      if (fresh.length === 0) continue;
      const listener = fresh[Math.floor(rand() * fresh.length)] as Agent;
      if (rand() >= tellChance(teller, best, this.relation(teller.id, listener.id))) continue;
      const told = retell(best, teller, now, this.acts, rand, listeners);
      if (this.learn(listener, told, T.rumorWeight)) {
        if (!listener.emote || listener.emoteUntil < now) this.agents.setEmote(listener, "…", now, 2);
      }
    }
    // Tell the player when a story about them has spread noticeably.
    for (const [eventId, count] of this.informed) {
      const last = this.announced.get(eventId);
      if (last === undefined) continue;
      if (count >= last + 5 && count >= last * 1.5) {
        const e = this.log.get(eventId);
        if (e) {
          const claim: Claim = { actorId: e.apparentActorId, act: e.act, targetId: e.targetId, districtId: null, severity: 1 };
          this.pushFeed(now, `La rumeur court : ${count} personnes ont entendu que ${this.describe(claim, true)}.`, "neutral");
        }
        this.announced.set(eventId, count);
      }
    }
  }

  /** Advances rumors (once per game minute) and memory upkeep (once per game hour). */
  step(now: number): void {
    if (now - this.lastGossipMinute >= 1) {
      // After a time jump, catch up with a bounded number of rounds.
      const gap = now - this.lastGossipMinute;
      const rounds = Number.isFinite(gap) ? Math.min(30, Math.max(1, Math.floor(gap))) : 1;
      this.lastGossipMinute = now;
      for (let i = 0; i < rounds; i++) this.gossip(now);
    }
    if (now - this.lastConsolidation >= 60) {
      this.lastConsolidation = now;
      this.memory.consolidate(
        now,
        (id) => this.byId.get(id)?.traits.grudge ?? 0.5,
        (id, m) => {
          const a = this.byId.get(id);
          return a ? this.reputation.opinionDelta(a, m.claim, this.factionOf(m.claim.targetId)) : 0;
        },
      );
    }
  }

  /** What this person would say they know about someone (strongest memory), for the UI and prompts. */
  topMemoryAbout(agent: Agent, subjectId: string, now: number): Memory | null {
    return this.memory.relevant(agent.id, subjectId, now, agent.traits.grudge, 1)[0] ?? null;
  }
}
