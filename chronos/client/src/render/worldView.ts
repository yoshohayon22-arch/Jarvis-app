import * as THREE from "three";
import type { BuildingDef, PropDef, WorldLayout } from "@chronos/shared";
import { SeededRng } from "../core/rng";
import { GATE_ANGLES } from "../sim/worldColliders";
import { AssetLibrary, type LoadedModel } from "./assets";
import type { CrowdDef, LookDef } from "./crowd";
import { GeoBuilder } from "./geoBuilder";
import { instanceModel, type Placement } from "./instancing";
import { PALETTE } from "./palette";
import { buildPlaceholderBuilding, buildPlaceholderProp, buildPlaceholderWall, worldPoint } from "./placeholders";
import { enhanceModelMaterial, type DetailTextures } from "./materials";
import { buildTerrain, terrainHeight } from "./terrain";

type Range = number | [number, number];

export interface VisualsDef {
  assetsBase: string;
  buildings: Record<string, { model: string; scale: number }>;
  props: Record<
    string,
    { models?: string[]; variants?: Record<string, string>; scale?: Range; yaw?: number; placeholder?: string }
  >;
  wall: {
    segment: string;
    gate: string;
    gateTower: string;
    segments: number;
    scale: number;
    gateScale: number;
    gateTowerScale: number;
    /** Extra yaw for named nodes of the gate model (opens the door leaves). */
    gateNodeYaw?: Record<string, number>;
  };
  scenery: Record<
    "forest" | "backdrop" | "clouds" | "bushes",
    { models: string[]; count: number; radius: [number, number]; scale: [number, number]; height?: [number, number] }
  >;
  characters: Record<string, CharacterVisual>;
  looks: Record<string, LookDef>;
  crowd: CrowdDef;
}

export interface CharacterVisual {
  model: string;
  height: number;
  hiddenNodes: string[];
  clips: Record<"idle" | "walk" | "run" | "dodge", string>;
  walkSpeed: number;
  runSpeed: number;
}

export interface LightSpot {
  pos: THREE.Vector3;
  kind: "lantern" | "door";
}

export interface WorldView {
  group: THREE.Group;
  /** Emissive materials whose intensity follows the night (lantern glass, placeholder windows). */
  nightGlow: THREE.MeshStandardMaterial[];
  lightSpots: LightSpot[];
  clouds: THREE.Object3D[];
  /** Asset paths that failed and were replaced by placeholders. */
  placeholders: string[];
}

const DOOR_LIGHT_KINDS = new Set<BuildingDef["kind"]>(["tavern", "temple", "barracks", "forge", "house", "shack"]);

const pickRange = (r: Range | undefined, rng: SeededRng, fallback = 1) =>
  r === undefined ? fallback : typeof r === "number" ? r : rng.range(r[0], r[1]);

/**
 * Builds the visible world from the pack's layout + visuals mapping. Models are
 * instanced per glTF; anything missing falls back to a procedural placeholder.
 */
export async function buildWorldView(
  layout: WorldLayout,
  visuals: VisualsDef,
  lib: AssetLibrary,
  seed: number,
  detail: DetailTextures | null = null,
): Promise<WorldView> {
  const rng = new SeededRng(seed ^ 0x5bd1e995);
  const group = new THREE.Group();
  group.name = "world";
  group.add(buildTerrain(layout, detail));

  const path = (p: string) => `${visuals.assetsBase}${p}.glb`;
  const batches = new Map<string, Placement[]>();
  const add = (model: string, p: Placement) => {
    const key = path(model);
    let list = batches.get(key);
    if (!list) batches.set(key, (list = []));
    list.push(p);
  };
  const placeholderBuildings: BuildingDef[] = [];
  const placeholderProps: PropDef[] = [];
  const lightSpots: LightSpot[] = [];

  // Buildings.
  const buildingModel = new Map<string, string>();
  for (const b of layout.buildings) {
    const v = visuals.buildings[b.id];
    if (!v) {
      placeholderBuildings.push(b);
      continue;
    }
    buildingModel.set(b.id, path(v.model));
    add(v.model, { x: b.pos[0], z: b.pos[1], yaw: ((b.rot ?? 0) * Math.PI) / 2, scale: v.scale });
    if (DOOR_LIGHT_KINDS.has(b.kind)) lightSpots.push({ pos: worldPoint(b, 0, 2.4, b.size[1] / 2 + 1.2), kind: "door" });
  }

  // Props (hand-placed + generated scenery).
  const propModel = new Map<PropDef, string>();
  layout.props.forEach((p) => {
    const v = visuals.props[p.kind];
    const model = v?.variants ? v.variants[p.variant ?? ""] ?? Object.values(v.variants)[0] : v?.models ? rng.pick(v.models) : undefined;
    if (!v || !model) {
      placeholderProps.push(p);
      if (p.kind === "lantern") lightSpots.push({ pos: new THREE.Vector3(p.pos[0], 2.9, p.pos[1]), kind: "lantern" });
      return;
    }
    propModel.set(p, path(model));
    add(model, { x: p.pos[0], z: p.pos[1], yaw: (p.rot ?? rng.range(0, Math.PI * 2)) + (v.yaw ?? 0), scale: pickRange(v.scale, rng) });
  });

  // Town wall: straight chords around the circle, gates on the road axes, towers beside gates.
  const W = visuals.wall;
  const n = W.segments;
  const gateIdx = new Set(GATE_ANGLES.map((a) => ((Math.round((a / (Math.PI * 2)) * n) % n) + n) % n));
  const towerIdx = new Set([...gateIdx].flatMap((g) => [(g + 1) % n, (g - 1 + n) % n]));
  const chordR = layout.wallRadius * Math.cos(Math.PI / n);
  for (let k = 0; k < n; k++) {
    const th = (k / n) * Math.PI * 2;
    const p: Placement = { x: Math.cos(th) * chordR, z: Math.sin(th) * chordR, yaw: -th - Math.PI / 2, scale: W.scale };
    if (gateIdx.has(k)) add(W.gate, { ...p, scale: W.gateScale });
    else if (towerIdx.has(k)) {
      add(W.segment, p);
      add(W.gateTower, { ...p, x: Math.cos(th) * (layout.wallRadius + 2.2), z: Math.sin(th) * (layout.wallRadius + 2.2), scale: W.gateTowerScale });
    } else add(W.segment, p);
  }

  // Scenery beyond the walls: forest ring, mountains on the horizon, clouds.
  const ring = (def: VisualsDef["scenery"]["forest"], yFn: (x: number, z: number) => number) => {
    for (let i = 0; i < def.count; i++) {
      const a = (i / def.count) * Math.PI * 2 + rng.range(-0.08, 0.08);
      const r = rng.range(def.radius[0], def.radius[1]);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      add(rng.pick(def.models), { x, z, y: yFn(x, z), yaw: rng.range(0, Math.PI * 2), scale: rng.range(def.scale[0], def.scale[1]) });
    }
  };
  ring(visuals.scenery.forest, (x, z) => terrainHeight(x, z) - 0.3);
  ring(visuals.scenery.backdrop, (x, z) => terrainHeight(x, z) - 2);
  const clouds: THREE.Object3D[] = [];
  const cloudDef = visuals.scenery.clouds;
  const cloudPlacements: [string, Placement][] = [];
  for (let i = 0; i < cloudDef.count; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(cloudDef.radius[0], cloudDef.radius[1]);
    const h = cloudDef.height ?? [80, 110];
    cloudPlacements.push([
      path(rng.pick(cloudDef.models)),
      { x: Math.cos(a) * r, z: Math.sin(a) * r, y: rng.range(h[0], h[1]), yaw: rng.range(0, Math.PI * 2), scale: rng.range(cloudDef.scale[0], cloudDef.scale[1]) },
    ]);
  }

  // Small vegetation scattered on open grass (purely visual, no collision).
  const bush = visuals.scenery.bushes;
  const blockers = layout.buildings.map((b) => {
    const odd = (b.rot ?? 0) % 2 === 1;
    const w = (odd ? b.size[1] : b.size[0]) / 2 + 1.2;
    const d = (odd ? b.size[0] : b.size[1]) / 2 + 1.2;
    return [b.pos[0] - w, b.pos[1] - d, b.pos[0] + w, b.pos[1] + d] as const;
  });
  const nearRoad = (x: number, z: number) =>
    layout.roads.some((r) => {
      const dx = r.to[0] - r.from[0];
      const dz = r.to[1] - r.from[1];
      const t = Math.max(0, Math.min(1, ((x - r.from[0]) * dx + (z - r.from[1]) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(x - r.from[0] - dx * t, z - r.from[1] - dz * t) < r.width / 2 + 1.2;
    });
  for (let i = 0, tries = 0; i < bush.count && tries < bush.count * 20; tries++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.range(bush.radius[0] ** 2, bush.radius[1] ** 2));
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(r - layout.wallRadius) < 4) continue;
    if (r < layout.wallRadius && Math.abs(x) < 23 && Math.abs(z) < 23) continue; // paved market
    if (blockers.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1)) continue;
    if (nearRoad(x, z)) continue;
    add(rng.pick(bush.models), { x, z, yaw: rng.range(0, Math.PI * 2), scale: rng.range(bush.scale[0], bush.scale[1]) });
    i++;
  }

  // Load everything in parallel.
  const all = [...new Set([...batches.keys(), ...cloudPlacements.map(([p]) => p)])];
  const models = await lib.loadMany(all);
  const failed = all.filter((p) => !models.get(p));

  // Stylized-realistic surface detail on every model material.
  if (detail) for (const m of models.values()) if (m) enhanceModel(m, detail);

  // Open the gate's door leaves (node-level tweak declared in the visuals data).
  const gateModel = models.get(path(W.gate));
  if (gateModel && W.gateNodeYaw) {
    for (const [name, yaw] of Object.entries(W.gateNodeYaw)) {
      const node = gateModel.scene.getObjectByName(name);
      if (node) node.rotation.y += yaw;
    }
    gateModel.scene.updateMatrixWorld(true);
  }

  for (const [key, placements] of batches) {
    const model = models.get(key);
    if (model) group.add(instanceModel(model, placements));
  }
  for (const [key, p] of cloudPlacements) {
    const model = models.get(key);
    if (!model) continue;
    const cloud = instanceModel(model, [p], false);
    cloud.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.receiveShadow = false;
    });
    clouds.push(cloud);
    group.add(cloud);
  }

  // Placeholders for missing models, unmapped objects and lanterns.
  const solid = new GeoBuilder();
  const glow = new GeoBuilder();
  for (const b of layout.buildings) {
    const m = buildingModel.get(b.id);
    if (!m || !models.get(m)) buildPlaceholderBuilding(solid, glow, b, rng);
  }
  for (const p of layout.props) {
    const m = propModel.get(p);
    if (!m || !models.get(m)) buildPlaceholderProp(solid, glow, p, rng);
  }
  if (!models.get(path(W.segment))) buildPlaceholderWall(solid, glow, layout.wallRadius, rng);

  const glowMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.material.lanternGlass,
    emissive: PALETTE.light.lantern,
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  if (solid.count > 0) {
    const mesh = new THREE.Mesh(
      solid.build(),
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }),
    );
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = "placeholders";
    group.add(mesh);
  }
  if (glow.count > 0) group.add(new THREE.Mesh(glow.build(), glowMaterial));

  return { group, nightGlow: [glowMaterial], lightSpots, clouds, placeholders: failed };
}

/** Loads the shared models needed by characters (separately so the title screen can show progress). */
export async function loadModel(lib: AssetLibrary, visuals: VisualsDef, model: string): Promise<LoadedModel | null> {
  return lib.load(`${visuals.assetsBase}${model}.glb`).catch(() => null);
}

/** Applies the detail shader patch to every standard material of a model. */
export function enhanceModel(model: LoadedModel, detail: DetailTextures): void {
  model.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial)
        enhanceModelMaterial(m as THREE.MeshStandardMaterial, detail, { scale: 0.85, strength: 0.65 });
    }
  });
}
