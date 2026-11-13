/**
 * Era pack format (shared between client and future server tooling).
 * J1 only defines the world layout part; factions, characters, powers, etc.
 * will be added in later milestones without changing the engine.
 */

export type LocationId = string & { readonly __brand?: "LocationId" };
export type DistrictId = string & { readonly __brand?: "DistrictId" };

export type BuildingKind =
  | "house"
  | "tavern"
  | "forge"
  | "temple"
  | "barracks"
  | "shack"
  | "stall"
  | "well"
  | "tower"
  | "mill"
  | "yard"
  | "ruin";

export interface BuildingDef {
  id: LocationId;
  kind: BuildingKind;
  name: string;
  district: DistrictId;
  /** Center on the ground plane (x, z) in meters. */
  pos: [number, number];
  /** Footprint (width along x, depth along z) in meters, before rotation. */
  size: [number, number];
  /** Rotation around Y in quarter turns (0..3) — keeps colliders axis-aligned. */
  rot?: 0 | 1 | 2 | 3;
  height?: number;
}

export interface PropDef {
  kind:
    | "tree"
    | "lantern"
    | "barrel"
    | "crate"
    | "wheelbarrow"
    | "rock"
    | "fence"
    | "sack"
    | "lumber"
    | "stone"
    | "weaponrack"
    | "target"
    | "bucket"
    | "flag";
  /** Optional visual variant (e.g. flag color); the simulation ignores it. */
  variant?: string;
  pos: [number, number];
  rot?: number;
  /** Props with `solid: true` block movement. */
  solid?: boolean;
}

export interface DistrictDef {
  id: DistrictId;
  name: string;
  /** Axis-aligned rectangle [minX, minZ, maxX, maxZ]. */
  rect: [number, number, number, number];
  groundColor: string;
}

export interface WorldLayout {
  size: number; // square world, half extent = size / 2
  wallRadius: number; // circular palisade radius
  spawn: { pos: [number, number]; facing: number };
  districts: DistrictDef[];
  buildings: BuildingDef[];
  props: PropDef[];
  roads: { from: [number, number]; to: [number, number]; width: number }[];
  spots: SpotDef[];
  routes: RouteDef[];
}

export interface PackManifest {
  id: string;
  era: string;
  name: string;
  version: string;
  calendar: { minutesPerGameDay: number; startHour: number };
}

// ---------------------------------------------------------------- inhabitants (J2)

export type FactionId = "villagers" | "royal_guard" | "thieves_guild" | "mages_order";

export type ActivityKind = "sleep" | "work" | "eat" | "socialize" | "wander" | "pray" | "patrol" | "guard";

/**
 * Where an activity happens:
 *  "home" | "work"            aliases resolved per inhabitant
 *  "spot:<id>"                stand somewhere inside a named spot
 *  "building:<id>"            enter the building (inhabitant is hidden inside)
 *  "district:<id>"            roam inside a district
 *  "route:<id>"               walk a patrol route in a loop
 */
export type PlaceRef = string;

export interface ScheduleBlock {
  /** Start hour (0..24, decimals allowed). The block lasts until the next one starts. */
  from: number;
  do: ActivityKind;
  at: PlaceRef;
}

export interface SpotDef {
  id: string;
  /** French label used in the UI ("devant la taverne"). */
  name: string;
  pos: [number, number];
  radius: number;
}

export interface RouteDef {
  id: string;
  name: string;
  points: [number, number][];
}

/** Personality traits in 0..1. Used by needs now, by memory/rumors/dialogue later. */
export interface Traits {
  sociable: number;
  brave: number;
  honest: number;
  greedy: number;
  gossip: number;
  grudge: number;
  devout: number;
}

export interface RelationDef {
  to: string;
  kind: string;
  /** -100 (hatred) .. 100 (devotion). */
  value: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  role: string;
  faction: FactionId;
  look: string;
  tint: string;
  scale: number;
  speed: number;
  home: LocationId;
  traits: Traits;
  bio: string;
  goals: string[];
  inventory: { item: string; qty: number }[];
  relations: RelationDef[];
  secrets?: string[];
  schedule: ScheduleBlock[];
}

export interface ArchetypeDef {
  id: string;
  label: string;
  labelF: string;
  count: number;
  faction: FactionId;
  looks: string[];
  tints: string[];
  scale: [number, number];
  speed: [number, number];
  homes: LocationId[];
  /** Candidate work places; each extra gets one. */
  work: PlaceRef[];
  /** Per-inhabitant schedule offset, in minutes (±). */
  jitter: number;
  schedule: ScheduleBlock[];
}

export interface ExtrasDef {
  archetypes: ArchetypeDef[];
  names: { m: string[]; f: string[] };
  /** Looks that read as feminine (picks the name list and the role label). */
  feminineLooks: string[];
}

// ---------------------------------------------------------------- acts & reputation (J3)

export interface ActDef {
  /** French verb phrase used in rumors: "<actor> <label> <target>". */
  label: string;
  /** 0..1: how memorable the act is (drives memory decay and gossip). */
  importance: number;
  /** Opinion change of an informed member of each faction (before modifiers). */
  opinion: Record<FactionId, number>;
  /** Opinion change of the target itself. */
  target: number;
  tags: string[];
  reaction: "cheer" | "alarm";
  /** Violent acts make the victim and fearful witnesses run away. */
  violent?: boolean;
}

export interface ActsDef {
  acts: Record<string, ActDef>;
  tuning: {
    /** Weight of first-hand knowledge vs. hearsay. */
    witnessWeight: number;
    rumorWeight: number;
    /** Share of one person's opinion change that moves their faction's reputation. */
    factionShare: number;
    /** One event can move a faction by at most |opinion| × eventCap in total. */
    eventCap: number;
    /** Confidence multiplier per retelling. */
    hopConfidence: number;
    /** Minimum game minutes before someone repeats what they learned. */
    retellDelay: number;
    /** Base chance (per hop) that a detail gets distorted. */
    distortion: number;
  };
}
