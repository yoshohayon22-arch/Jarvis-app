import type { ActivityKind, PlaceRef } from "@chronos/shared";
import { angleDelta } from "../../core/math";
import type { WorldClock } from "../clock";
import { resolveAll } from "../collision";
import type { Places, Point } from "./places";
import { blockAt } from "./schedule";
import type { Agent, AgentAnim } from "./types";

export const AGENT_TUNING = {
  radius: 0.35,
  /** Needs change per game hour. */
  hungerRate: 0.04,
  energyRate: 0.05,
  socialRate: 0.06,
  eatRecovery: 2.5,
  sleepRecovery: 0.13,
  socialRecovery: 0.8,
  /** A need above `urgent` overrides the schedule until it falls below `satisfied`. */
  urgent: 0.9,
  satisfied: 0.25,
  separationRadius: 0.85,
  separationStrength: 2.2,
  arriveDistance: 0.25,
  /** Above this time scale, agents skip local avoidance and follow paths exactly. */
  fastForwardScale: 4,
} as const;

/** mulberry32 step on the agent's own state: every agent has an independent, saved stream. */
function rand(a: Agent): number {
  let t = (a.rng = (a.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const ACTING_ANIM: Record<ActivityKind, AgentAnim> = {
  sleep: "idle",
  work: "interact",
  eat: "sit",
  socialize: "idle",
  wander: "idle",
  pray: "sit",
  patrol: "idle",
  guard: "idle",
};

/**
 * Deterministic simulation of every inhabitant: needs, schedule, navigation
 * and local avoidance. No rendering, no AI — runs headless in tests.
 */
export interface TimeZone {
  x: number;
  z: number;
  radius: number;
  /** Flow of time inside the zone (0.25 = four times slower). */
  scale: number;
  /** Game minute at which the zone ends. */
  until: number;
}

export class AgentSystem {
  private readonly hash = new Map<number, Agent[]>();
  private lastMinutes: number | null = null;
  /** Current game minute (updated every step). */
  now = 0;
  /** Bubbles of altered time (time powers). */
  zones: TimeZone[] = [];
  /** Districts inhabitants currently avoid (terrorized): they stay home instead. */
  avoidDistrict: (districtId: string) => boolean = () => false;

  constructor(
    readonly agents: Agent[],
    readonly places: Places,
  ) {}

  // ---------------------------------------------------------------- decisions

  /** Activity the agent should be doing now: urgent needs first, then the schedule. */
  desired(a: Agent, hour: number): { activity: ActivityKind; place: PlaceRef; override: boolean } {
    const T = AGENT_TUNING;
    // Locked up: nothing else matters until release.
    if (a.jailedUntil > this.now) return { activity: "sleep", place: "building:barracks", override: true };
    const block = blockAt(a.schedule, hour);
    const n = a.needs;
    // Keep satisfying an urgent need until it is really gone.
    if (a.override) {
      if (a.activity === "sleep" && n.energy > T.satisfied) return { activity: "sleep", place: "home", override: true };
      if (a.activity === "eat" && n.hunger > T.satisfied) return { activity: "eat", place: a.place, override: true };
    }
    if (n.energy > T.urgent && block.do !== "sleep") return { activity: "sleep", place: "home", override: true };
    if (n.hunger > T.urgent && block.do !== "eat" && block.do !== "sleep") {
      const poor = a.archetype === "pauper" || a.archetype === "child";
      return { activity: "eat", place: poor ? "home" : "building:tavern", override: true };
    }
    if (n.social > T.urgent && (block.do === "wander" || block.do === "work") && a.traits.sociable > 0.5)
      return { activity: "socialize", place: "spot:market_well", override: true };
    return { activity: block.do, place: block.at, override: false };
  }

  private resolveAlias(a: Agent, place: PlaceRef): PlaceRef {
    if (place === "home") return `building:${a.home}`;
    if (place === "work") return a.work;
    return place;
  }

  /** Starts an activity: picks a destination and plans the path. */
  private begin(a: Agent, activity: ActivityKind, placeRef: PlaceRef, override: boolean): void {
    let place = this.resolveAlias(a, placeRef);
    // A terrorized district empties: its visitors stay home (the guard still does its rounds).
    if (a.faction !== "royal_guard" && activity !== "sleep") {
      const d = this.places.districtOf(place);
      if (d && this.avoidDistrict(d)) place = `building:${a.home}`;
    }
    a.activity = activity;
    a.place = place;
    a.override = override;
    const [kind, id] = place.split(":") as [string, string];

    if (kind === "building") {
      if (a.insideOf === id) {
        a.mode = "inside";
        return;
      }
      this.goTo(a, this.places.entrance(id), id);
      return;
    }
    if (kind === "route") {
      const route = this.places.routes.get(id);
      if (!route) throw new Error(`Unknown route "${id}"`);
      // Join the route at its nearest point.
      let best = 0;
      let bestD = Infinity;
      route.points.forEach((p, i) => {
        const d = (p[0] - a.x) ** 2 + (p[1] - a.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      a.routeIndex = best;
      const p = route.points[best] as [number, number];
      this.goTo(a, { x: p[0], z: p[1] }, null);
      return;
    }
    if (kind === "district") {
      this.goTo(a, this.places.pointInDistrict(id, () => rand(a)), null);
      return;
    }
    // spot
    this.goTo(a, this.places.pointInSpot(id, () => rand(a), (x, z) => this.targetTaken(a, x, z)), null);
  }

  /** True when another agent already stands (or is heading) within arm's reach of a point. */
  private targetTaken(self: Agent, x: number, z: number): boolean {
    for (const o of this.agents) {
      if (o === self || o.insideOf) continue;
      if ((o.targetX - x) ** 2 + (o.targetZ - z) ** 2 < 0.9 * 0.9) return true;
    }
    return false;
  }

  private goTo(a: Agent, target: Point, enter: string | null): void {
    // Step out of the building first.
    if (a.insideOf) {
      const e = this.places.entrance(a.insideOf);
      a.x = a.prevX = e.x;
      a.z = a.prevZ = e.z;
      a.insideOf = null;
    }
    a.targetX = target.x;
    a.targetZ = target.z;
    a.enterOnArrival = enter;
    a.stuckTime = 0;
    const path = this.places.nav.findPath(a.x, a.z, target.x, target.z);
    if (!path || path.length === 0) {
      // Already there (or unreachable): act in place rather than freeze the simulation.
      a.path = [];
      a.pathIndex = 0;
      this.arrive(a);
      return;
    }
    a.path = path;
    a.pathIndex = 0;
    a.mode = "moving";
    a.anim = "walk";
  }

  private arrive(a: Agent): void {
    a.path = [];
    a.pathIndex = 0;
    a.hurry = false;
    if (a.reacting) {
      // Stay put (catching breath, confronting…) until the next think resumes the schedule.
      a.enterOnArrival = null;
      a.mode = "acting";
      a.anim = "idle";
      return;
    }
    if (a.enterOnArrival) {
      a.insideOf = a.enterOnArrival;
      a.enterOnArrival = null;
      a.mode = "inside";
      a.anim = "idle";
      return;
    }
    if (a.activity === "patrol" && a.place.startsWith("route:")) {
      const route = this.places.routes.get(a.place.slice(6));
      if (route) {
        a.routeIndex = (a.routeIndex + 1) % route.points.length;
        const p = route.points[a.routeIndex] as [number, number];
        this.goTo(a, { x: p[0], z: p[1] }, null);
        return;
      }
    }
    a.mode = "acting";
    a.anim = ACTING_ANIM[a.activity];
    // Sentries look outward, away from the village center.
    if (a.activity === "guard" || a.activity === "patrol") a.facing = Math.atan2(a.x, a.z);
  }

  /** Periodic re-evaluation: follow the schedule, or vary behavior within the activity. */
  private think(a: Agent, minutes: number, hour: number): void {
    const want = this.desired(a, hour);
    let wantPlace = this.resolveAlias(a, want.place);
    if (a.faction !== "royal_guard" && want.activity !== "sleep") {
      const d = this.places.districtOf(wantPlace);
      if (d && this.avoidDistrict(d)) wantPlace = `building:${a.home}`;
    }
    const resume = a.reacting;
    a.reacting = false;
    if (resume || want.activity !== a.activity || wantPlace !== a.place) {
      this.begin(a, want.activity, want.place, want.override);
    } else if (a.mode === "acting") {
      a.override = want.override;
      if (a.activity === "wander") {
        this.begin(a, a.activity, a.place, a.override);
      } else if (a.activity === "work") {
        a.anim = rand(a) < 0.65 ? "interact" : "idle";
      } else if (a.activity === "socialize") {
        const near = this.nearest(a, 3.5);
        if (near) a.facing = Math.atan2(near.x - a.x, near.z - a.z);
        a.anim = near && rand(a) < 0.2 ? "cheer" : "idle";
      }
    }
    a.nextThinkAt = minutes + 4 + rand(a) * 6;
  }

  // ---------------------------------------------------------------- reactions

  setEmote(a: Agent, emote: string, now: number, minutes: number): void {
    a.emote = emote;
    a.emoteUntil = now + minutes;
  }

  /**
   * Makes an inhabitant react to something happening at (sx, sz):
   * watch (turn toward it), cheer, flee (run away) or confront (guards rush in).
   */
  react(a: Agent, kind: "watch" | "cheer" | "flee" | "confront", sx: number, sz: number, now: number, emote: string): void {
    if (a.insideOf) return;
    this.setEmote(a, emote, now, kind === "flee" ? 6 : 4);
    const dx = a.x - sx;
    const dz = a.z - sz;
    const d = Math.hypot(dx, dz) || 1;
    if (kind === "watch" || kind === "cheer") {
      if (a.mode === "acting") {
        a.facing = Math.atan2(-dx, -dz);
        a.anim = kind === "cheer" ? "cheer" : "idle";
        a.nextThinkAt = Math.max(a.nextThinkAt, now + 3);
      }
      return;
    }
    const nav = this.places.nav;
    let tx: number;
    let tz: number;
    if (kind === "flee") {
      tx = a.x + (dx / d) * 16;
      tz = a.z + (dz / d) * 16;
    } else {
      tx = sx + (dx / d) * 1.6;
      tz = sz + (dz / d) * 1.6;
    }
    const cell = nav.nearestFree(tx, tz, 20);
    if (cell < 0) return;
    a.reacting = true;
    this.goTo(a, { x: nav.cx(cell % nav.size), z: nav.cx((cell / nav.size) | 0) }, null);
    if (a.mode === "moving") {
      a.hurry = true;
      a.anim = "run";
    }
    a.nextThinkAt = now + (kind === "flee" ? 12 : 8);
  }

  /** The guard takes someone away: they walk to the barracks and stay inside until released. */
  jail(a: Agent, until: number): void {
    a.jailedUntil = until;
    a.pursuing = false;
    a.reacting = false;
    a.nextThinkAt = this.now;
    this.setEmote(a, "!", this.now, 5);
  }

  /** Keeps an inhabitant in place, facing a point (while the player talks to them). */
  hold(a: Agent, x: number, z: number, now: number, minutes = 3): void {
    if (a.insideOf) return;
    a.reacting = true;
    a.hurry = false;
    a.path = [];
    a.pathIndex = 0;
    a.enterOnArrival = null;
    a.mode = "acting";
    a.anim = "idle";
    a.facing = Math.atan2(x - a.x, z - a.z);
    a.targetX = a.x;
    a.targetZ = a.z;
    a.nextThinkAt = now + minutes;
  }

  // ---------------------------------------------------------------- spatial queries

  private key(x: number, z: number): number {
    return (Math.floor(x / 2) + 512) * 1024 + (Math.floor(z / 2) + 512);
  }

  private rebuildHash(): void {
    this.hash.clear();
    for (const a of this.agents) {
      if (a.insideOf) continue;
      const k = this.key(a.x, a.z);
      const cell = this.hash.get(k);
      if (cell) cell.push(a);
      else this.hash.set(k, [a]);
    }
  }

  /** Visits agents near a point (uses the hash built at the start of the tick). */
  forNeighbors(x: number, z: number, radius: number, fn: (o: Agent) => void): void {
    const r = Math.ceil(radius / 2);
    const cx = Math.floor(x / 2);
    const cz = Math.floor(z / 2);
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) {
        const cell = this.hash.get((cx + i + 512) * 1024 + (cz + j + 512));
        if (cell) for (const o of cell) fn(o);
      }
  }

  nearest(a: Agent, radius: number): Agent | null {
    let best: Agent | null = null;
    let bestD = radius * radius;
    this.forNeighbors(a.x, a.z, radius, (o) => {
      if (o === a) return;
      const d = (o.x - a.x) ** 2 + (o.z - a.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    });
    return best;
  }

  /** Closest visible agent to a point within `radius` (used by the UI). */
  nearestTo(x: number, z: number, radius: number): Agent | null {
    let best: Agent | null = null;
    let bestD = radius * radius;
    for (const o of this.agents) {
      if (o.insideOf) continue;
      const d = (o.x - x) ** 2 + (o.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- stepping

  private updateNeeds(a: Agent, hours: number): void {
    const T = AGENT_TUNING;
    const n = a.needs;
    const settled = a.mode !== "moving";
    const eating = a.activity === "eat" && settled;
    const sleeping = a.activity === "sleep" && a.mode === "inside";
    n.hunger += (eating ? -T.eatRecovery : T.hungerRate * (sleeping ? 0.45 : 1)) * hours;
    n.energy += (sleeping ? -T.sleepRecovery : T.energyRate) * hours;
    const company = (a.activity === "socialize" && settled) || (eating && a.insideOf === "tavern");
    if (company) n.social -= T.socialRecovery * hours;
    // Working or resting next to someone is mild company too.
    else if (a.mode === "acting" && this.nearest(a, 3)) n.social -= T.socialRecovery * 0.3 * hours;
    else n.social += T.socialRate * (0.5 + a.traits.sociable) * hours;
    n.hunger = Math.max(0, Math.min(1, n.hunger));
    n.energy = Math.max(0, Math.min(1, n.energy));
    n.social = Math.max(0, Math.min(1, n.social));
  }

  private move(a: Agent, dt: number, fast: boolean, player: Point | null): void {
    const T = AGENT_TUNING;
    const speed = a.walkSpeed * (a.hurry ? 2.1 : 1);
    let remaining = speed * dt;
    const startX = a.x;
    const startZ = a.z;
    let dirX = 0;
    let dirZ = 0;
    while (remaining > 0 && a.pathIndex < a.path.length) {
      const wx = a.path[a.pathIndex] as number;
      const wz = a.path[a.pathIndex + 1] as number;
      const dx = wx - a.x;
      const dz = wz - a.z;
      const d = Math.hypot(dx, dz);
      if (d <= Math.max(remaining, T.arriveDistance)) {
        if (d <= remaining) {
          a.x = wx;
          a.z = wz;
          remaining -= d;
        } else remaining = 0;
        a.pathIndex += 2;
        if (d > 1e-6) {
          dirX = dx / d;
          dirZ = dz / d;
        }
        continue;
      }
      dirX = dx / d;
      dirZ = dz / d;
      a.x += dirX * remaining;
      a.z += dirZ * remaining;
      remaining = 0;
    }

    if (!fast) {
      // Local avoidance: slide away from close neighbors and from the player.
      let px = 0;
      let pz = 0;
      const push = (ox: number, oz: number, radius: number) => {
        const dx = a.x - ox;
        const dz = a.z - oz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius || d2 < 1e-8) return;
        const d = Math.sqrt(d2);
        const w = (radius - d) / radius;
        px += (dx / d) * w;
        pz += (dz / d) * w;
      };
      this.forNeighbors(a.x, a.z, T.separationRadius, (o) => {
        if (o !== a) push(o.x, o.z, T.separationRadius);
      });
      if (player) push(player.x, player.z, T.separationRadius + 0.15);
      a.x += px * T.separationStrength * dt;
      a.z += pz * T.separationStrength * dt;
      resolveAll(this.places.collision, a, T.radius, 2);

      // Stuck detection: replan when not making progress.
      const moved = Math.hypot(a.x - startX, a.z - startZ);
      a.stuckTime = moved < speed * dt * 0.25 ? a.stuckTime + dt : 0;
      if (a.stuckTime > 2.5 && a.pathIndex < a.path.length) {
        const enter = a.enterOnArrival;
        this.goTo(a, { x: a.targetX, z: a.targetZ }, enter);
        return;
      }
    }

    if (dirX !== 0 || dirZ !== 0) {
      const target = Math.atan2(dirX, dirZ);
      a.facing += angleDelta(a.facing, target) * Math.min(1, dt * 9);
    }
    if (a.pathIndex >= a.path.length) this.arrive(a);
  }

  /**
   * Advances every inhabitant by one simulation tick.
   * @param dt real seconds of the tick (fixed step)
   */
  step(dt: number, clock: WorldClock, player: Point | null = null): void {
    const minutes = clock.totalMinutes;
    this.now = minutes;
    const hour = clock.minuteOfDay / 60;
    const elapsedMin = this.lastMinutes === null ? 0 : Math.max(0, minutes - this.lastMinutes);
    this.lastMinutes = minutes;
    // A clock jump (debug "set hour") must not starve everyone at once.
    const hours = Math.min(elapsedMin, 30) / 60;
    const moveDt = dt * clock.timeScale;
    const fast = clock.timeScale > AGENT_TUNING.fastForwardScale;

    this.zones = this.zones.filter((z) => z.until > minutes);
    this.rebuildHash();
    for (const a of this.agents) {
      a.prevX = a.x;
      a.prevZ = a.z;
      this.updateNeeds(a, hours);
      // Local flow of time: frozen, slowed inside a time bubble, or normal.
      let factor = 1;
      if (a.frozenUntil > minutes) factor = 0;
      else for (const z of this.zones) if ((a.x - z.x) ** 2 + (a.z - z.z) ** 2 < z.radius * z.radius) factor = Math.min(factor, z.scale);
      a.timeFactor = factor;
      if (a.held || factor === 0) continue;
      if (minutes >= a.nextThinkAt) this.think(a, minutes, hour);
      if (a.mode === "moving" && moveDt > 0) this.move(a, moveDt * factor, fast, player);
    }
  }

  /**
   * Puts everyone where their schedule says they should be right now
   * (used at game start and by debug time jumps).
   */
  settle(clock: WorldClock): void {
    const minutes = clock.totalMinutes;
    this.now = minutes;
    const hour = clock.minuteOfDay / 60;
    this.lastMinutes = minutes;
    for (const a of this.agents) {
      this.think(a, minutes, hour);
      if (a.mode === "moving") {
        a.x = a.targetX;
        a.z = a.targetZ;
        this.arrive(a);
        // Patrols keep walking: leave them on their way to the next point.
      }
      a.prevX = a.x;
      a.prevZ = a.z;
    }
  }

  counts(): { outside: number; inside: number; moving: number } {
    let inside = 0;
    let moving = 0;
    for (const a of this.agents) {
      if (a.insideOf) inside++;
      else if (a.mode === "moving") moving++;
    }
    return { outside: this.agents.length - inside, inside, moving };
  }
}
