import type { BuildingDef, DistrictDef, RouteDef, SpotDef, WorldLayout } from "@chronos/shared";
import type { CollisionWorld } from "../collision";
import { NavGrid } from "../nav/grid";
import { buildingFootprint } from "../worldColliders";

export interface Point {
  x: number;
  z: number;
}

/** Static lookup tables the agent system needs: navigation, entrances, spots, routes. */
export class Places {
  readonly nav: NavGrid;
  readonly buildings = new Map<string, BuildingDef>();
  readonly entrances = new Map<string, Point>();
  readonly spots = new Map<string, SpotDef>();
  readonly routes = new Map<string, RouteDef>();
  readonly districts = new Map<string, DistrictDef>();

  constructor(
    readonly layout: WorldLayout,
    readonly collision: CollisionWorld,
  ) {
    this.nav = new NavGrid(collision, layout.size);
    for (const b of layout.buildings) {
      this.buildings.set(b.id, b);
      this.entrances.set(b.id, this.computeEntrance(b));
    }
    for (const s of layout.spots) this.spots.set(s.id, s);
    for (const r of layout.routes) this.routes.set(r.id, r);
    for (const d of layout.districts) this.districts.set(d.id, d);
  }

  /** Walkable point just outside the building's front door (front = local +z, rotated). */
  private computeEntrance(b: BuildingDef): Point {
    const rot = b.rot ?? 0;
    const f = buildingFootprint(b);
    const dirs: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    const [dx, dz] = dirs[rot] as [number, number];
    const half = (dx !== 0 ? f.w : f.d) / 2;
    const x = b.pos[0] + dx * (half + 1.3);
    const z = b.pos[1] + dz * (half + 1.3);
    const cell = this.nav.nearestFree(x, z);
    if (cell < 0) return { x, z };
    return { x: this.nav.cx(cell % this.nav.size), z: this.nav.cx((cell / this.nav.size) | 0) };
  }

  entrance(buildingId: string): Point {
    const e = this.entrances.get(buildingId);
    if (!e) throw new Error(`Unknown building "${buildingId}"`);
    return e;
  }

  /** Random walkable point inside a spot. `rand` returns a number in [0, 1). */
  pointInSpot(spotId: string, rand: () => number, avoid?: (x: number, z: number) => boolean): Point {
    const s = this.spots.get(spotId);
    if (!s) throw new Error(`Unknown spot "${spotId}"`);
    let fallback: Point | null = null;
    for (let i = 0; i < 12; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * s.radius;
      const x = s.pos[0] + Math.cos(a) * r;
      const z = s.pos[1] + Math.sin(a) * r;
      if (!this.nav.isWalkable(x, z)) continue;
      if (!fallback) fallback = { x, z };
      if (!avoid || !avoid(x, z)) return { x, z };
    }
    if (fallback) return fallback;
    const cell = this.nav.nearestFree(s.pos[0], s.pos[1]);
    return { x: this.nav.cx(cell % this.nav.size), z: this.nav.cx((cell / this.nav.size) | 0) };
  }

  /** Random walkable point inside a district (and inside the walls). */
  pointInDistrict(districtId: string, rand: () => number): Point {
    const d = this.districts.get(districtId);
    if (!d) throw new Error(`Unknown district "${districtId}"`);
    const [x0, z0, x1, z1] = d.rect;
    const maxR = this.layout.wallRadius - 4;
    for (let i = 0; i < 30; i++) {
      const x = x0 + rand() * (x1 - x0);
      const z = z0 + rand() * (z1 - z0);
      if (Math.hypot(x, z) < maxR && this.nav.isWalkable(x, z)) return { x, z };
    }
    const cell = this.nav.nearestFree((x0 + x1) / 2, (z0 + z1) / 2, 40);
    return { x: this.nav.cx(cell % this.nav.size), z: this.nav.cx((cell / this.nav.size) | 0) };
  }

  /** Validates a place reference against the pack; returns an error message or null. */
  checkRef(ref: string): string | null {
    if (ref === "home" || ref === "work") return null;
    const [kind, id] = ref.split(":");
    if (!id) return `malformed place "${ref}"`;
    const table =
      kind === "spot" ? this.spots : kind === "building" ? this.buildings : kind === "district" ? this.districts : kind === "route" ? this.routes : null;
    if (!table) return `unknown place kind "${kind}"`;
    return table.has(id) ? null : `unknown ${kind} "${id}"`;
  }

  /** Human-readable French label of a place ("devant la taverne"). */
  label(ref: string): string {
    const [kind, id] = ref.split(":");
    if (!id) return "";
    if (kind === "spot") return this.spots.get(id)?.name ?? "";
    if (kind === "building") return `dans : ${this.buildings.get(id)?.name ?? id}`;
    if (kind === "district") return this.districts.get(id)?.name ?? "";
    if (kind === "route") return this.routes.get(id)?.name ?? "";
    return "";
  }
}
