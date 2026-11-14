import type { ActivityKind, FactionId, PlaceRef, ScheduleBlock, Traits } from "@chronos/shared";

export type AgentMode = "moving" | "acting" | "inside";
export type AgentAnim = "idle" | "walk" | "run" | "interact" | "sit" | "cheer";

export interface Needs {
  /** 0 = satisfied, 1 = desperate. */
  hunger: number;
  energy: number;
  social: number;
}

/** Runtime state of one inhabitant. Plain data: serializable as-is for saves. */
export interface Agent {
  index: number;
  id: string;
  /** Key characters have a full sheet (bio, goals, relations) and will talk via AI. */
  key: boolean;
  name: string;
  role: string;
  archetype: string;
  faction: FactionId;
  look: string;
  tint: string;
  scale: number;
  walkSpeed: number;
  traits: Traits;
  home: string;
  /** Resolved work place for the "work" alias. */
  work: PlaceRef;
  schedule: ScheduleBlock[];

  // Position (prev* = previous tick, for render interpolation).
  x: number;
  z: number;
  prevX: number;
  prevZ: number;
  facing: number;

  needs: Needs;
  activity: ActivityKind;
  /** Place reference of the current activity (after alias resolution). */
  place: PlaceRef;
  /** True when the activity was forced by an urgent need rather than the schedule. */
  override: boolean;
  mode: AgentMode;
  anim: AgentAnim;
  /** Building the agent is inside of (hidden), or null. */
  insideOf: string | null;

  /** Flat waypoint list [x0, z0, x1, z1, ...] and the index of the next waypoint. */
  path: number[];
  pathIndex: number;
  targetX: number;
  targetZ: number;
  /** Enter this building on arrival. */
  enterOnArrival: string | null;
  /** Index of the next patrol point when patrolling a route. */
  routeIndex: number;
  /** Game minute at which the agent re-evaluates what to do within its activity. */
  nextThinkAt: number;
  /** Seconds without progress toward the waypoint (stuck detection). */
  stuckTime: number;
  /** Short symbol shown above the head ("!", "♥", "…") until `emoteUntil` (game minutes). */
  emote: string;
  emoteUntil: number;
  /** Running (fleeing or rushing somewhere). */
  hurry: boolean;
  /** Temporarily reacting to an event; the schedule resumes at the next think. */
  reacting: boolean;
  /** Height above the ground (lifted by telekinesis). */
  y: number;
  /** Frozen in time until this game minute. */
  frozenUntil: number;
  /** Local flow of time for this tick: 1 normal, 0 frozen, in between when slowed. */
  timeFactor: number;
  /** Carried by telekinesis: the simulation leaves them alone. */
  held: boolean;
  /** A guard chasing the player. */
  pursuing: boolean;
  /** Held in the barracks jail until this game minute. */
  jailedUntil: number;
  /** Per-agent PRNG state (mulberry32). */
  rng: number;
}

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  sleep: "dort",
  work: "travaille",
  eat: "mange",
  socialize: "discute",
  wander: "se promène",
  pray: "prie",
  patrol: "patrouille",
  guard: "monte la garde",
};
