import {
  MISSION_LIMITS,
  fillTemplate,
  validateMission,
  type MissionIntent,
  type MissionOutcome,
  type MissionProposal,
  type MissionRequest,
  type MissionStep,
  type MissionTemplate,
  type MissionWorld,
} from "@chronos/shared";
import { SeededRng } from "../core/rng";
import type { Agent, AgentSystem } from "./agents";
import type { WorldClock } from "./clock";
import type { EchoVision } from "./powers";
import { FACTIONS, FACTION_LABELS, PLAYER_ID, type SocialSystem } from "./social";
import { hasLineOfSight } from "./social/perception";

/** Who can offer what, and what the local templates may be cast with (pack data). */
export interface MissionsDef {
  /** Minutes the victim must stay unharmed once the aggressor has closed in. */
  standoffMinutes: number;
  engageRange: number;
  strikeRange: number;
  placeRadius: number;
  detectRange: number;
  failure: { giverOpinion: number; factionReputation: number };
  givers: Record<string, { intent: MissionIntent; culprits: string[]; victims: string[]; places: string[] }>;
  templates: MissionTemplate[];
}

export type MissionSource = "ai" | "mock" | "template";
export type MissionStatus = "active" | "choice" | "done" | "failed";

export interface Mission {
  id: number;
  proposal: MissionProposal;
  source: MissionSource;
  status: MissionStatus;
  stepIndex: number;
  acceptedAt: number;
  deadline: number;
  /** investigate: the staged scene in the world log. */
  sceneEventId: number | null;
  /** protect: when the aggressor closed in (the standoff clock starts then). */
  engagedAt: number | null;
  lastOrderAt: number;
  outcome: "hero" | "dark" | null;
  failReason: string | null;
}

export type MissionNotice =
  | { kind: "accepted" | "step" | "choice"; mission: Mission; text: string }
  | { kind: "done"; mission: Mission; text: string; gold: number; outcome: "hero" | "dark" }
  | { kind: "failed"; mission: Mission; text: string };

export interface MissionPlayer {
  x: number;
  z: number;
  /** Shadow or false face. */
  unrecognizable: boolean;
  /** Fully unseen (shadow). */
  hidden: boolean;
}

export interface Objective {
  text: string;
  x: number;
  z: number;
}

/** Acts that make an aggressor back off. */
const DETERRENTS = new Set(["intimidate", "blackmail", "assault", "tk_shove", "tk_strike", "tk_crush", "time_torment"]);

/**
 * Missions runtime. A mission only exists once `validateMission` accepted it;
 * from then on it is followed purely by watching the simulation: positions,
 * the world log, and what the player's powers report. Deterministic, no AI.
 */
export class MissionSystem {
  readonly missions: Mission[] = [];
  readonly notices: MissionNotice[] = [];
  readonly rng: SeededRng;
  private nextId = 1;
  private lastEventId = 0;
  private readonly byId: Map<string, Agent>;

  constructor(
    private readonly agents: AgentSystem,
    private readonly social: SocialSystem,
    private readonly clock: WorldClock,
    readonly def: MissionsDef,
    seed: number,
  ) {
    this.rng = new SeededRng(seed ^ 0x51ed270b);
    this.byId = new Map(agents.agents.map((a) => [a.id, a]));
  }

  // ---------------------------------------------------------------- the closed world

  /** Everything a mission is allowed to refer to, right now. */
  world(): MissionWorld {
    const now = this.clock.totalMinutes;
    return {
      characters: this.agents.agents
        .filter((a) => a.key)
        .map((a) => ({ id: a.id, name: a.name, role: a.role, faction: a.faction, key: true, available: a.jailedUntil <= now })),
      places: [...this.agents.places.spots.values()].map((s) => ({ id: s.id, name: s.name })),
      taken: this.missions.map((m) => ({ giverId: m.proposal.giverId, title: m.proposal.title, active: m.status === "active" || m.status === "choice" })),
    };
  }

  /** What this character could offer right now, or null. */
  offerOf(agentId: string): MissionIntent | null {
    const g = this.def.givers[agentId];
    const a = this.byId.get(agentId);
    if (!g || !a || a.jailedUntil > this.clock.totalMinutes) return null;
    if (this.missions.some((m) => m.proposal.giverId === agentId)) return null;
    if (this.active.length >= MISSION_LIMITS.activeMax) return null;
    return g.intent;
  }

  get active(): Mission[] {
    return this.missions.filter((m) => m.status === "active" || m.status === "choice");
  }

  /** Scenes of running investigations: the Echo always shows them when in reach. */
  sceneEvents(): Set<number> {
    const ids = new Set<number>();
    for (const m of this.active) if (m.sceneEventId !== null) ids.add(m.sceneEventId);
    return ids;
  }

  validate(proposal: unknown, intent: MissionIntent, giverId: string): string[] {
    return validateMission(proposal, this.world(), { intent, giverId });
  }

  /** The bounded world summary sent to the proxy. */
  request(intent: MissionIntent, giverId: string, attempt: number, previousErrors: string[]): MissionRequest {
    const w = this.world();
    const now = this.clock.totalMinutes;
    const recent = this.social.log
      .query({ since: now - 48 * 60 })
      .sort((a, b) => b.importance - a.importance || b.t - a.t)
      .slice(0, MISSION_LIMITS.digestEvents)
      .map((e) => this.social.describe({ actorId: e.apparentActorId, act: e.act, targetId: e.targetId, districtId: e.districtId, severity: 1 }).slice(0, 200));
    const rep = this.social.reputation.factions;
    const tensions = FACTIONS.filter((f) => Math.abs(rep[f]) >= 20).map((f) => `${FACTION_LABELS[f]} : Kael est ${rep[f] > 0 ? "bien vu" : "mal vu"} (${Math.round(rep[f])})`.slice(0, 120));
    return {
      intent,
      giverId,
      attempt,
      previousErrors: previousErrors.slice(0, 8).map((e) => e.slice(0, 200)),
      digest: { time: this.clock.format(), reputations: { ...rep }, recentEvents: recent, tensions },
      allowed: {
        characters: w.characters.filter((c) => c.available).map(({ id, name, role, faction }) => ({ id, name: name.slice(0, 60), role: role.slice(0, 80), faction })),
        places: w.places.slice(0, 40),
        takenTitles: w.taken.map((t) => t.title.slice(0, MISSION_LIMITS.titleMax)).slice(0, 12),
      },
    };
  }

  /**
   * The local fallback: a template of the right kind, cast with real people and
   * places. Tries casts in a seeded order until one passes validation.
   */
  fromTemplate(intent: MissionIntent, giverId: string): MissionProposal | null {
    const g = this.def.givers[giverId];
    if (!g) return null;
    const templates = this.def.templates.filter((t) => t.intent === intent);
    const world = this.world();
    const shuffled = <T>(list: readonly T[]): T[] => {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng.next() * (i + 1));
        [out[i], out[j]] = [out[j] as T, out[i] as T];
      }
      return out;
    };
    for (const t of shuffled(templates)) {
      for (const culpritId of shuffled(g.culprits.length ? g.culprits : [""])) {
        for (const victimId of shuffled(g.victims.length ? g.victims : [""])) {
          for (const placeId of shuffled(g.places.length ? g.places : [""])) {
            const proposal = fillTemplate(t, { giverId, culpritId, victimId, placeId }, world);
            if (validateMission(proposal, world, { intent, giverId }).length === 0) return proposal;
          }
        }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- lifecycle

  /** Registers a mission. Refuses anything the validator rejects. */
  accept(proposal: MissionProposal, source: MissionSource): Mission {
    const errors = validateMission(proposal, this.world());
    if (errors.length) throw new Error(`Invalid mission: ${errors.join("; ")}`);
    const now = this.clock.totalMinutes;
    const m: Mission = {
      id: this.nextId++,
      proposal,
      source,
      status: "active",
      stepIndex: 0,
      acceptedAt: now,
      deadline: now + proposal.timeLimitHours * 60,
      sceneEventId: null,
      engagedAt: null,
      lastOrderAt: -Infinity,
      outcome: null,
      failReason: null,
    };
    if (proposal.intent === "investigate") m.sceneEventId = this.stageScene(proposal, now);
    this.missions.push(m);
    this.lastEventId = Math.max(this.lastEventId, this.social.log.nextId - 1);
    this.social.pushFeed(now, `Mission acceptée : « ${proposal.title} » — ${proposal.summary}`, "neutral");
    this.notices.push({ kind: "accepted", mission: m, text: `Mission : ${proposal.title}` });
    return m;
  }

  /**
   * An investigation needs something true to find: the theft the giver talks about
   * is written into the world log (two hours ago, unseen), like any other event.
   */
  private stageScene(p: MissionProposal, now: number): number {
    const spot = this.agents.places.spots.get(p.placeId);
    const victim = this.byId.get(p.victimId) ?? null;
    const x = spot?.pos[0] ?? 0;
    const z = spot?.pos[1] ?? 0;
    const r = this.social.commit("pickpocket", victim, { actorId: p.culpritId, x, z, daylight: 0, hidden: true, targetNotices: false }, now - 120);
    return r.event.id;
  }

  private currentStep(m: Mission): MissionStep | null {
    return m.status === "active" ? (m.proposal.steps[m.stepIndex] ?? null) : null;
  }

  private advance(m: Mission): void {
    const now = this.clock.totalMinutes;
    m.stepIndex++;
    m.engagedAt = null;
    const next = m.proposal.steps[m.stepIndex];
    if (next) {
      this.notices.push({ kind: "step", mission: m, text: next.text });
      return;
    }
    m.status = "choice";
    const { hero, dark } = m.proposal;
    this.social.pushFeed(now, `« ${m.proposal.title} » — à toi de trancher : ${hero.label} / ${dark.label}`, "neutral");
    this.notices.push({ kind: "choice", mission: m, text: `À toi de trancher : ${hero.label} — ou — ${dark.label}` });
  }

  private finish(m: Mission, which: "hero" | "dark"): void {
    const now = this.clock.totalMinutes;
    const o: MissionOutcome = m.proposal[which];
    m.status = "done";
    m.outcome = which;
    for (const f of FACTIONS) if (o.reputation[f]) this.social.reputation.adjust(f, o.reputation[f]);
    // The path taken counts toward the powers' hero and dark branches.
    this.social.moral[which]++;
    if (o.targetId === m.proposal.giverId) this.social.reputation.nudgeOpinion(m.proposal.giverId, which === "hero" ? 10 : 4);
    const rep = FACTIONS.filter((f) => o.reputation[f]).map((f) => `${FACTION_LABELS[f]} ${o.reputation[f] > 0 ? "+" : ""}${o.reputation[f]}`);
    const text = `« ${m.proposal.title} » accomplie — ${o.epilogue}${o.gold ? ` (+${o.gold} pièces)` : ""}${rep.length ? ` · ${rep.join(" · ")}` : ""}`;
    this.social.pushFeed(now, text, which === "hero" ? "good" : "bad");
    this.notices.push({ kind: "done", mission: m, text, gold: o.gold, outcome: which });
  }

  private fail(m: Mission, reason: string): void {
    const now = this.clock.totalMinutes;
    m.status = "failed";
    m.failReason = reason;
    const giver = this.byId.get(m.proposal.giverId);
    this.social.reputation.nudgeOpinion(m.proposal.giverId, this.def.failure.giverOpinion);
    if (giver) this.social.reputation.adjust(giver.faction, this.def.failure.factionReputation);
    const text = `« ${m.proposal.title} » a échoué : ${reason}`;
    this.social.pushFeed(now, text, "bad");
    this.notices.push({ kind: "failed", mission: m, text });
  }

  // ---------------------------------------------------------------- what the game reports

  /** The player started talking with someone. */
  noteTalk(agentId: string): void {
    for (const m of this.active) {
      const s = this.currentStep(m);
      if (s?.type === "talk" && s.targetId === agentId) this.advance(m);
      else if (m.status === "choice") {
        for (const which of ["hero", "dark"] as const) {
          const o = m.proposal[which];
          if (o.type === "talk" && o.targetId === agentId) {
            this.finish(m, which);
            break;
          }
        }
      }
    }
  }

  /** The player used the Echo of the Past and saw these scenes. */
  noteEcho(visions: readonly EchoVision[]): void {
    for (const m of this.active) {
      const s = this.currentStep(m);
      if (s?.type !== "echo" || m.sceneEventId === null) continue;
      if (visions.some((v) => v.eventId === m.sceneEventId)) {
        const culprit = this.byId.get(m.proposal.culpritId)?.name ?? "quelqu'un";
        this.social.pushFeed(this.clock.totalMinutes, `L'écho ne ment pas : c'est ${culprit} qui a fait le coup.`, "neutral");
        this.advance(m);
      }
    }
  }

  // ---------------------------------------------------------------- per-tick tracking

  step(player: MissionPlayer): void {
    const now = this.clock.totalMinutes;
    const log = this.social.log;
    const fresh = log.events.filter((e) => e.id > this.lastEventId);
    this.lastEventId = Math.max(this.lastEventId, log.nextId - 1);

    for (const m of this.active) {
      if (now > m.deadline) {
        this.fail(m, "le temps imparti est écoulé.");
        continue;
      }
      if (m.status === "choice") {
        for (const which of ["hero", "dark"] as const) {
          const o = m.proposal[which];
          if (o.type === "act" && fresh.some((e) => this.isPlayerAct(e, o.actId, o.targetId))) {
            this.finish(m, which);
            break;
          }
        }
        continue;
      }
      const s = this.currentStep(m);
      if (!s) continue;
      switch (s.type) {
        case "goto": {
          const spot = this.agents.places.spots.get(s.placeId);
          if (spot && Math.hypot(player.x - spot.pos[0], player.z - spot.pos[1]) < this.def.placeRadius) this.advance(m);
          break;
        }
        case "act":
          if (fresh.some((e) => this.isPlayerAct(e, s.actId, s.targetId))) this.advance(m);
          break;
        case "infiltrate":
          this.stepInfiltrate(m, s, player);
          break;
        case "protect":
          this.stepProtect(m, s, fresh, now);
          break;
        default:
          break; // talk and echo are reported by the game
      }
    }
  }

  private isPlayerAct(e: { actorId: string; act: string; targetId: string | null; undone?: boolean }, actId: string, targetId: string): boolean {
    if (e.actorId !== PLAYER_ID || e.undone || e.targetId !== targetId) return false;
    return e.act === actId || (actId === "intimidate" && e.act === "blackmail");
  }

  /** Reach the place without being recognized by those who watch it. */
  private stepInfiltrate(m: Mission, s: MissionStep, player: MissionPlayer): void {
    const spot = this.agents.places.spots.get(s.placeId);
    if (!spot) return;
    const d = Math.hypot(player.x - spot.pos[0], player.z - spot.pos[1]);
    if (d < this.def.placeRadius) {
      this.advance(m);
      return;
    }
    if (player.unrecognizable || d > this.def.detectRange + this.def.placeRadius) return;
    const watcher = this.watcherOf(m, player);
    if (watcher) {
      this.agents.setEmote(watcher, "!", this.clock.totalMinutes, 4);
      this.fail(m, `${watcher.name} t'a reconnu en train de rôder.`);
    }
  }

  /** Someone who would raise the alarm: the named person, or anyone of their group (the guard by default). */
  private watcherOf(m: Mission, player: MissionPlayer): Agent | null {
    const named = this.byId.get(m.proposal.culpritId);
    const faction = named?.faction ?? "royal_guard";
    const now = this.clock.totalMinutes;
    const world = this.agents.places.collision;
    let found: Agent | null = null;
    this.agents.forNeighbors(player.x, player.z, this.def.detectRange, (a) => {
      if (found || a.insideOf || a.activity === "sleep" || a.frozenUntil > now || a.held) return;
      if (a.id !== named?.id && a.faction !== faction) return;
      const dx = player.x - a.x;
      const dz = player.z - a.z;
      const dist = Math.hypot(dx, dz) || 1;
      if ((Math.sin(a.facing) * dx + Math.cos(a.facing) * dz) / dist < 0.2) return; // looking away
      if (hasLineOfSight(world, a.x, a.z, player.x, player.z)) found = a;
    });
    return found;
  }

  /**
   * The aggressor walks up to the victim. The player wins by scaring them off,
   * by getting them jailed, or by keeping the two apart for the whole standoff
   * (frozen time, a time bubble, carrying the victim away…).
   */
  private stepProtect(m: Mission, s: MissionStep, fresh: readonly { actorId: string; act: string; targetId: string | null; undone?: boolean }[], now: number): void {
    const victim = this.byId.get(s.targetId);
    const aggressor = this.byId.get(m.proposal.culpritId);
    if (!victim || !aggressor) return;
    if (aggressor.jailedUntil > now) {
      this.social.pushFeed(now, `${aggressor.name} est au cachot : ${victim.name} ne risque plus rien.`, "good");
      this.advance(m);
      return;
    }
    if (fresh.some((e) => e.actorId === PLAYER_ID && !e.undone && e.targetId === aggressor.id && DETERRENTS.has(e.act))) {
      this.agents.react(aggressor, "flee", victim.x, victim.z, now, "!");
      this.social.pushFeed(now, `${aggressor.name} renonce et prend la fuite.`, "good");
      this.advance(m);
      return;
    }
    const stopped = aggressor.frozenUntil > now || aggressor.held;
    if (!stopped && !victim.insideOf && now - m.lastOrderAt >= 2) {
      m.lastOrderAt = now;
      this.agents.sendTo(aggressor, victim.x, victim.z, now);
      this.agents.setEmote(aggressor, "…", now, 2);
    }
    if (victim.insideOf || aggressor.insideOf) return;
    const dist = Math.hypot(aggressor.x - victim.x, aggressor.z - victim.z);
    if (m.engagedAt === null && dist < this.def.engageRange) {
      m.engagedAt = now;
      this.agents.setEmote(victim, "!", now, 4);
    }
    if (m.engagedAt !== null && now - m.engagedAt >= this.def.standoffMinutes) {
      this.social.pushFeed(now, `${aggressor.name} n'a pas pu approcher ${victim.name} et finit par s'en aller.`, "good");
      aggressor.nextThinkAt = now;
      this.advance(m);
      return;
    }
    if (!stopped && !victim.held && dist < this.def.strikeRange) {
      this.social.commit("assault", victim, { actorId: aggressor.id, x: aggressor.x, z: aggressor.z, daylight: this.clock.daylight }, now);
      aggressor.nextThinkAt = now;
      this.fail(m, `${aggressor.name} s'en est pris à ${victim.name}.`);
    }
  }

  // ---------------------------------------------------------------- UI helpers

  /** What to do next and where, for the HUD and the world marker. */
  objective(m: Mission): Objective | null {
    const at = (id: string): { x: number; z: number } | null => {
      const a = this.byId.get(id);
      return a ? { x: a.x, z: a.z } : null;
    };
    const place = (id: string): { x: number; z: number } | null => {
      const s = this.agents.places.spots.get(id);
      return s ? { x: s.pos[0], z: s.pos[1] } : null;
    };
    if (m.status === "choice") {
      const p = at(m.proposal.hero.targetId);
      return p ? { text: `${m.proposal.hero.label} — ou — ${m.proposal.dark.label}`, ...p } : null;
    }
    const s = this.currentStep(m);
    if (!s) return null;
    const p = s.placeId ? place(s.placeId) : at(s.targetId);
    return p ? { text: s.text, ...p } : null;
  }
}
