import * as THREE from "three";
import { SeededRng } from "../core/rng";
import type { Places } from "../sim/agents";
import type { ConsequenceSystem } from "../sim/consequences";
import { AssetLibrary } from "./assets";
import { instanceModel, type Placement } from "./instancing";
import type { VisualsDef } from "./worldView";

const DEBRIS = ["props/pallet", "props/crate_open", "props/resource_stone", "props/sack", "props/crate_long_A"];
const FLAGS = ["props/flag_red", "props/flag_yellow", "props/flag_blue"];

/**
 * Makes consequences visible in the scenery: a terrorized district is littered
 * with overturned crates and abandoned goods; a grateful market is decked with flags.
 * (People leaving the streets and guards giving chase come from the simulation itself.)
 */
export class ConsequenceView {
  readonly group = new THREE.Group();
  private readonly debris = new Map<string, THREE.Group>();
  private festive: THREE.Group | null = null;

  static async create(places: Places, visuals: VisualsDef, lib: AssetLibrary, seed: number): Promise<ConsequenceView> {
    const view = new ConsequenceView();
    view.group.name = "consequences";
    const rng = new SeededRng(seed ^ 0x7f4a7c15);
    const models = await lib.loadMany([...DEBRIS, ...FLAGS].map((m) => `${visuals.assetsBase}${m}.glb`));
    const get = (m: string) => models.get(`${visuals.assetsBase}${m}.glb`) ?? null;

    for (const d of places.layout.districts) {
      const g = new THREE.Group();
      const batches = new Map<string, Placement[]>();
      for (let i = 0; i < 18; i++) {
        const p = places.pointInDistrict(d.id, () => rng.next());
        const model = rng.pick(DEBRIS);
        const list = batches.get(model) ?? [];
        list.push({ x: p.x, z: p.z, yaw: rng.range(0, Math.PI * 2), scale: rng.range(4, 5.5) });
        batches.set(model, list);
      }
      for (const [m, placements] of batches) {
        const model = get(m);
        if (model) g.add(instanceModel(model, placements));
      }
      g.visible = false;
      view.debris.set(d.id, g);
      view.group.add(g);
    }

    const festive = new THREE.Group();
    FLAGS.forEach((m, k) => {
      const model = get(m);
      if (!model) return;
      const placements: Placement[] = [];
      for (let i = k; i < 14; i += FLAGS.length) {
        const a = (i / 14) * Math.PI * 2;
        const cell = places.nav.nearestFree(Math.cos(a) * 17, Math.sin(a) * 17, 6);
        if (cell < 0) continue;
        placements.push({ x: places.nav.cx(cell % places.nav.size), z: places.nav.cx((cell / places.nav.size) | 0), yaw: -a, scale: 14 });
      }
      festive.add(instanceModel(model, placements));
    });
    festive.visible = false;
    view.festive = festive;
    view.group.add(festive);
    return view;
  }

  update(cons: ConsequenceSystem): void {
    for (const [id, g] of this.debris) g.visible = cons.terrorized.has(id);
    if (this.festive) this.festive.visible = cons.flags.has("market_festive");
  }
}
