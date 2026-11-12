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
  | "tower";

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
  kind: "tree" | "lantern" | "barrel" | "crate" | "cart" | "rock" | "fence";
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
}

export interface PackManifest {
  id: string;
  era: string;
  name: string;
  version: string;
  calendar: { minutesPerGameDay: number; startHour: number };
}
