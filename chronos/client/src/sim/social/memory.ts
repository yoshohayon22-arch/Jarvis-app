/** What someone believes happened (possibly distorted by retelling). */
export interface Claim {
  actorId: string;
  act: string;
  targetId: string | null;
  districtId: string | null;
  /** 1 = as it happened; grows when the story is exaggerated. */
  severity: number;
}

export interface Memory {
  eventId: number;
  /** Game minute at which this person learned it. */
  t: number;
  kind: "suffered" | "witnessed" | "heard";
  /** Who told them (null when first-hand). */
  from: string | null;
  claim: Claim;
  hops: number;
  /** 0..1, drops with each retelling. */
  confidence: number;
  /** 0..1, from the act. */
  importance: number;
}

/** Old important memories condensed into one lasting impression of someone. */
export interface MemorySummary {
  about: string;
  /** Sum of remembered opinion impact (sign tells friend or foe). */
  sentiment: number;
  count: number;
  importance: number;
  /** Game minute of the most recent memory merged in. */
  t: number;
  acts: Record<string, number>;
}

export const MEMORY = {
  /** Memories whose weight falls below this are forgotten. */
  forgetBelow: 0.05,
  /** Base half-life-like constant in game days; grudge-holders remember up to 5× longer. */
  tauDays: 1.2,
  tauGrudgeDays: 5,
  /** Important memories older than this get summarized. */
  summarizeAfterDays: 2,
  summarizeImportance: 0.5,
  maxPerAgent: 40,
} as const;

const DAY = 1440;

/** Current strength of a memory: importance fading exponentially with age. */
export function memoryWeight(m: Memory, now: number, grudge: number): number {
  const tau = MEMORY.tauDays + MEMORY.tauGrudgeDays * grudge;
  return m.importance * (0.5 + 0.5 * m.confidence) * Math.exp(-Math.max(0, now - m.t) / DAY / tau);
}

export class MemoryStore {
  readonly memories = new Map<string, Memory[]>();
  readonly summaries = new Map<string, MemorySummary[]>();

  of(agentId: string): Memory[] {
    return this.memories.get(agentId) ?? [];
  }

  summariesOf(agentId: string): MemorySummary[] {
    return this.summaries.get(agentId) ?? [];
  }

  knows(agentId: string, eventId: number): boolean {
    return this.of(agentId).some((m) => m.eventId === eventId);
  }

  /** Records a memory. Returns false when the person already knew about that event. */
  add(agentId: string, m: Memory): boolean {
    let list = this.memories.get(agentId);
    if (!list) this.memories.set(agentId, (list = []));
    if (list.some((x) => x.eventId === m.eventId)) return false;
    list.push(m);
    return true;
  }

  /** Erases every memory of an event (it was undone by a time rewind). Returns how many people forgot. */
  forgetEvent(eventId: number): number {
    let n = 0;
    for (const [id, list] of this.memories) {
      const keep = list.filter((m) => m.eventId !== eventId);
      n += list.length - keep.length;
      this.memories.set(id, keep);
    }
    return n;
  }

  /**
   * Forgets faded memories and condenses old important ones into summaries.
   * @param sentimentOf opinion impact of a memory for its owner (used for the summary's sign)
   */
  consolidate(now: number, grudgeOf: (agentId: string) => number, sentimentOf: (agentId: string, m: Memory) => number): void {
    for (const [agentId, list] of this.memories) {
      const grudge = grudgeOf(agentId);
      const keep: Memory[] = [];
      for (const m of list) {
        const w = memoryWeight(m, now, grudge);
        const old = now - m.t > MEMORY.summarizeAfterDays * DAY;
        if (old && m.importance >= MEMORY.summarizeImportance) {
          this.mergeIntoSummary(agentId, m, sentimentOf(agentId, m));
          continue;
        }
        if (w < MEMORY.forgetBelow) continue;
        keep.push(m);
      }
      // Hard cap: drop the weakest.
      if (keep.length > MEMORY.maxPerAgent) {
        keep.sort((a, b) => memoryWeight(b, now, grudge) - memoryWeight(a, now, grudge));
        keep.length = MEMORY.maxPerAgent;
        keep.sort((a, b) => a.t - b.t);
      }
      this.memories.set(agentId, keep);
    }
  }

  private mergeIntoSummary(agentId: string, m: Memory, sentiment: number): void {
    let list = this.summaries.get(agentId);
    if (!list) this.summaries.set(agentId, (list = []));
    let s = list.find((x) => x.about === m.claim.actorId);
    if (!s) list.push((s = { about: m.claim.actorId, sentiment: 0, count: 0, importance: 0, t: m.t, acts: {} }));
    s.sentiment += sentiment;
    s.count++;
    s.importance = Math.max(s.importance, m.importance);
    s.t = Math.max(s.t, m.t);
    s.acts[m.claim.act] = (s.acts[m.claim.act] ?? 0) + 1;
  }

  /** The k strongest memories a person has about someone (for dialogue prompts and the UI). */
  relevant(agentId: string, about: string, now: number, grudge: number, k = 3): Memory[] {
    return this.of(agentId)
      .filter((m) => m.claim.actorId === about)
      .sort((a, b) => memoryWeight(b, now, grudge) - memoryWeight(a, now, grudge))
      .slice(0, k);
  }
}
