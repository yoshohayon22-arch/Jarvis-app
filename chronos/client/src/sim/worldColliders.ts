import type { BuildingDef, PropDef, WorldLayout } from "@chronos/shared";
import type { Aabb, CircleCollider, CollisionWorld } from "./collision";

const DEFAULT_HEIGHT: Record<BuildingDef["kind"], number> = {
  house: 6,
  tavern: 7,
  forge: 5,
  temple: 11,
  barracks: 7,
  shack: 3.5,
  stall: 2.6,
  well: 1.2,
  tower: 14,
};

const PROP_RADIUS: Partial<Record<PropDef["kind"], number>> = {
  tree: 0.55,
  lantern: 0.2,
  barrel: 0.45,
  crate: 0.55,
  cart: 1.1,
  rock: 0.9,
};

const PROP_HEIGHT: Partial<Record<PropDef["kind"], number>> = {
  tree: 6,
  lantern: 3,
  barrel: 1,
  crate: 1,
  cart: 1.4,
  rock: 1.2,
};

/** Footprint of a building after its quarter-turn rotation. */
export function buildingFootprint(b: BuildingDef): { w: number; d: number } {
  const odd = (b.rot ?? 0) % 2 === 1;
  return odd ? { w: b.size[1], d: b.size[0] } : { w: b.size[0], d: b.size[1] };
}

export function buildingHeight(b: BuildingDef): number {
  return b.height ?? DEFAULT_HEIGHT[b.kind];
}

export function buildingAabb(b: BuildingDef): Aabb {
  const { w, d } = buildingFootprint(b);
  return {
    minX: b.pos[0] - w / 2,
    maxX: b.pos[0] + w / 2,
    minZ: b.pos[1] - d / 2,
    maxZ: b.pos[1] + d / 2,
    height: buildingHeight(b),
  };
}

export function propCollider(p: PropDef): CircleCollider | null {
  const r = PROP_RADIUS[p.kind];
  if (!p.solid || r === undefined) return null;
  return { x: p.pos[0], z: p.pos[1], r, height: PROP_HEIGHT[p.kind] ?? 1 };
}

/** Gates sit where roads cross the palisade (E, S, W, N). */
export const GATE_ANGLES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
export const GATE_HALF_WIDTH = 3.6;
export const WALL_THICKNESS = 0.8;
export const WALL_HEIGHT = 4.2;

export function buildCollisionWorld(layout: WorldLayout): CollisionWorld {
  const circles = layout.props.map(propCollider).filter((c): c is CircleCollider => c !== null);
  return {
    boxes: layout.buildings.map(buildingAabb),
    circles,
    rings: [
      {
        radius: layout.wallRadius,
        thickness: WALL_THICKNESS,
        height: WALL_HEIGHT,
        gates: GATE_ANGLES.map((angle) => ({ angle, halfWidth: GATE_HALF_WIDTH })),
      },
    ],
    boundsRadius: layout.size / 2 - 2,
  };
}
