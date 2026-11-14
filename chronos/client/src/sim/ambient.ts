import { SeededRng } from "../core/rng";
import type { Agent, AgentSystem } from "./agents";
import type { WorldClock } from "./clock";
import type { SocialSystem } from "./social";

export interface AmbientDef {
  pickpocketChancePerCheck: number;
  checkEveryMinutes: number;
  meetingRange: number;
}

/**
 * Things inhabitants do on their own initiative: thieves pick pockets where
 * they "work", a corrupt guard meets the guild at night. Every such deed goes
 * through the same event log, witnesses and rumors as the player's acts — so
 * there is something true to investigate with the Echo of the Past.
 */
export class AmbientSystem {
  readonly rng: SeededRng;
  private lastCheck: number | null = null;
  /** "<a>|<b>" → day number of their last recorded secret meeting. */
  private readonly meetings = new Map<string, number>();

  constructor(
    private readonly agents: AgentSystem,
    private readonly social: SocialSystem,
    private readonly def: AmbientDef,
    private readonly clock: WorldClock,
    seed: number,
  ) {
    this.rng = new SeededRng(seed ^ 0x3c6ef372);
  }

  step(): void {
    const now = this.clock.totalMinutes;
    if (this.lastCheck === null || now < this.lastCheck) this.lastCheck = now;
    if (now - this.lastCheck < this.def.checkEveryMinutes) return;
    this.lastCheck = now;
    const daylight = this.clock.daylight;
    const settled = (a: Agent) => !a.insideOf && a.mode === "acting" && !a.held && a.frozenUntil <= now && a.jailedUntil <= now;

    for (const thief of this.agents.agents) {
      if (thief.faction !== "thieves_guild" || thief.activity !== "work" || !settled(thief)) continue;
      if (this.rng.next() >= this.def.pickpocketChancePerCheck) continue;
      // The mark: the closest ordinary villager within arm's reach.
      let victim: Agent | null = null;
      let best = 3.5 * 3.5;
      this.agents.forNeighbors(thief.x, thief.z, 3.5, (o) => {
        if (o === thief || o.faction !== "villagers" || o.insideOf) return;
        const d = (o.x - thief.x) ** 2 + (o.z - thief.z) ** 2;
        if (d < best) {
          best = d;
          victim = o;
        }
      });
      if (!victim) continue;
      this.social.commit("pickpocket", victim, { actorId: thief.id, x: thief.x, z: thief.z, daylight, targetNotices: this.rng.next() < 0.25 }, now);
    }

    // A guard and a guild member talking away from prying eyes: a secret worth knowing.
    const day = Math.floor(now / 1440);
    const r2 = this.def.meetingRange ** 2;
    for (const guard of this.agents.agents) {
      if (guard.faction !== "royal_guard" || guard.activity !== "socialize" || !settled(guard)) continue;
      for (const other of this.agents.agents) {
        if (other.faction !== "thieves_guild" || other.activity !== "socialize" || !settled(other)) continue;
        if ((guard.x - other.x) ** 2 + (guard.z - other.z) ** 2 > r2) continue;
        const key = `${guard.id}|${other.id}`;
        if (this.meetings.get(key) === day) continue;
        this.meetings.set(key, day);
        this.social.commit("secret_meeting", other, { actorId: guard.id, x: guard.x, z: guard.z, daylight }, now);
      }
    }
  }
}
