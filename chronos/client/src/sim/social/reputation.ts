import type { ActDef, ActsDef, FactionId } from "@chronos/shared";
import { clamp } from "../../core/math";
import type { Agent } from "../agents";
import { PLAYER_ID } from "./events";
import type { Claim } from "./memory";

export const FACTIONS: FactionId[] = ["villagers", "royal_guard", "thieves_guild", "mages_order"];

export const FACTION_LABELS: Record<FactionId, string> = {
  villagers: "Villageois",
  royal_guard: "Garde royale",
  thieves_guild: "Guilde des voleurs",
  mages_order: "Ordre des mages",
};

export type RelationLookup = (fromId: string, toId: string) => number;

/**
 * Group reputations (-100..100 toward the player) and individual opinions.
 * Reputation only moves when someone *learns* of an act: an unseen deed changes nothing.
 */
export class Reputation {
  factions: Record<FactionId, number> = { villagers: 0, royal_guard: 0, thieves_guild: 0, mages_order: 0 };
  /** Individual opinions, key "<holder>|<subject>", -100..100. */
  opinions = new Map<string, number>();
  /** Accumulated faction movement per event (enforces the per-event cap). */
  private perEvent = new Map<number, Partial<Record<FactionId, number>>>();

  constructor(
    private readonly acts: ActsDef,
    private readonly relation: RelationLookup = () => 0,
  ) {}

  opinion(holderId: string, subjectId: string = PLAYER_ID): number {
    return this.opinions.get(`${holderId}|${subjectId}`) ?? 0;
  }

  /** How much learning of this claim changes the listener's opinion of the claimed actor. */
  opinionDelta(listener: Agent, claim: Claim, targetFaction: FactionId | null): number {
    const act = this.acts.acts[claim.act] as ActDef | undefined;
    if (!act) return 0;
    if (claim.targetId === listener.id) return act.target * claim.severity;
    let d = act.opinion[listener.faction] * claim.severity;
    const harmful = d < 0 || act.target < 0;
    if (claim.targetId) {
      // "One of ours" was hurt (or helped): it matters more.
      if (targetFaction === listener.faction) d = harmful ? Math.min(d, -Math.abs(act.opinion[listener.faction])) * 1.5 : d * 1.5;
      // Personal ties to the target, positive or negative.
      const tie = this.relation(listener.id, claim.targetId);
      if (tie > 25 && act.target < 0) d -= Math.abs(act.target) * 0.25;
      if (tie < -25 && act.target < 0) d += Math.abs(act.target) * 0.15;
    }
    return d;
  }

  /**
   * Applies what a listener just learned. `weight` is 1 for witnesses and lower for hearsay.
   * Returns the listener's opinion change.
   */
  inform(listener: Agent, claim: Claim, eventId: number, weight: number, targetFaction: FactionId | null): number {
    const delta = this.opinionDelta(listener, claim, targetFaction) * weight;
    if (delta === 0) return 0;
    const key = `${listener.id}|${claim.actorId}`;
    this.opinions.set(key, clamp((this.opinions.get(key) ?? 0) + delta, -100, 100));

    // Only the player has group reputations.
    if (claim.actorId === PLAYER_ID) {
      const T = this.acts.tuning;
      const act = this.acts.acts[claim.act];
      const base = act ? Math.max(Math.abs(act.opinion[listener.faction]), 1) : 1;
      const cap = base * T.eventCap;
      let acc = this.perEvent.get(eventId);
      if (!acc) this.perEvent.set(eventId, (acc = {}));
      const before = acc[listener.faction] ?? 0;
      const after = clamp(before + delta * T.factionShare, -cap, cap);
      acc[listener.faction] = after;
      this.factions[listener.faction] = clamp(this.factions[listener.faction] + (after - before), -100, 100);
    }
    return delta;
  }

  /** Bounded change of one person's opinion (dialogue outcomes). */
  nudgeOpinion(holderId: string, delta: number, subjectId: string = PLAYER_ID): void {
    const key = `${holderId}|${subjectId}`;
    this.opinions.set(key, clamp((this.opinions.get(key) ?? 0) + delta, -100, 100));
  }

  /** Direct adjustment (missions, powers…), always bounded. */
  adjust(faction: FactionId, delta: number): void {
    this.factions[faction] = clamp(this.factions[faction] + delta, -100, 100);
  }

  /** One-line portrait of who the player is to this town, derived from the four reputations. */
  portrait(): string {
    const parts: string[] = [];
    const say = (f: FactionId, loved: string, liked: string, disliked: string, hated: string) => {
      const v = this.factions[f];
      if (v >= 50) parts.push(loved);
      else if (v >= 15) parts.push(liked);
      else if (v <= -50) parts.push(hated);
      else if (v <= -15) parts.push(disliked);
    };
    say("villagers", "héros du peuple", "apprécié des villageois", "mal vu des villageois", "terreur des villageois");
    say("royal_guard", "protégé de la garde", "bien vu de la garde", "surveillé par la garde", "ennemi de la garde");
    say("thieves_guild", "frère de la guilde", "respecté des voleurs", "méprisé des voleurs", "homme à abattre pour la guilde");
    say("mages_order", "ami de l'Ordre", "toléré par les mages", "suspect aux yeux des mages", "hérétique pour l'Ordre");
    if (parts.length === 0) return "Un inconnu : personne n'a encore d'avis sur toi.";
    const text = parts.join(", ");
    return text.charAt(0).toUpperCase() + text.slice(1) + ".";
  }
}
