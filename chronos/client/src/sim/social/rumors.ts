import type { ActsDef } from "@chronos/shared";
import type { Agent } from "../agents";
import type { Claim, Memory } from "./memory";

/** Returns a number in [0, 1). */
export type Rand = () => number;

/** Can this memory be repeated yet? (People need a little time before they talk.) */
export function tellable(m: Memory, now: number, retellDelay: number): boolean {
  return now - m.t >= retellDelay && m.confidence > 0.15;
}

/**
 * The version of a story a teller passes on. Details may get distorted:
 * the act is exaggerated, the place is forgotten, or — rarely — someone else gets the blame.
 */
export function retell(m: Memory, teller: Agent, now: number, acts: ActsDef, rand: Rand, bystanders: readonly Agent[]): Memory {
  const T = acts.tuning;
  const claim: Claim = { ...m.claim };
  // Honest people repeat faithfully; gossips embellish.
  const p = T.distortion * (0.4 + teller.traits.gossip) * (1.3 - teller.traits.honest);
  if (rand() < p) claim.severity = Math.min(2, claim.severity + 0.25);
  if (rand() < p * 0.6) claim.districtId = null;
  if (rand() < p * 0.15 && bystanders.length > 0) {
    // Confusion: the story sticks to the wrong person.
    const other = bystanders[Math.floor(rand() * bystanders.length)] as Agent;
    if (other.id !== claim.targetId && other.id !== teller.id) claim.actorId = other.id;
  }
  return {
    eventId: m.eventId,
    t: now,
    kind: "heard",
    from: teller.id,
    claim,
    hops: m.hops + 1,
    confidence: m.confidence * T.hopConfidence,
    importance: m.importance,
  };
}

/** Chance that a teller shares a given story with a listener during one gossip opportunity. */
export function tellChance(teller: Agent, m: Memory, relation: number): number {
  const tie = relation > 25 ? 1.3 : relation < -25 ? 0.5 : 1;
  return Math.min(0.95, (0.15 + 0.85 * teller.traits.gossip) * (0.35 + 0.65 * m.importance) * tie * (0.5 + 0.5 * m.confidence));
}
