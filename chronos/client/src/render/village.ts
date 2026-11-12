import * as THREE from "three";
import type { BuildingDef, PropDef, WorldLayout } from "@chronos/shared";
import { SeededRng } from "../core/rng";
import { GATE_ANGLES, GATE_HALF_WIDTH, WALL_HEIGHT, buildingHeight } from "../sim/worldColliders";
import { GeoBuilder, trs } from "./geoBuilder";

/** Palette: warm, slightly desaturated storybook colors. */
const C = {
  stone: "#9c9384",
  stoneDark: "#7c7468",
  stoneLight: "#d6cfbf",
  plaster: "#eadfc6",
  plasterWarm: "#e3cfa4",
  timber: "#5a3d27",
  wood: "#86603d",
  woodLight: "#a77c4f",
  roofTile: "#9a4632",
  roofDark: "#5e3b2b",
  roofSlate: "#4f5c74",
  thatch: "#b39352",
  door: "#4a2f1d",
  iron: "#3a3a40",
  leafA: "#4f7a3a",
  leafB: "#3f6a34",
  leafC: "#6b8f3e",
  trunk: "#5b412c",
  rock: "#8b8a86",
  road: "#a38b66",
  cloth: ["#b8423a", "#e4c35a", "#3f6fa3", "#6d9a4a", "#9b5aa0"],
};

export interface VillageMeshes {
  group: THREE.Group;
  /** Material for windows/flames: emissive intensity is driven by the day/night cycle. */
  glowMaterial: THREE.MeshStandardMaterial;
  /** Positions where real point lights are placed at night. */
  nightLightSpots: THREE.Vector3[];
}

export function buildVillage(layout: WorldLayout, seed: number): VillageMeshes {
  const rng = new SeededRng(seed ^ 0x9e3779b9);
  const solid = new GeoBuilder();
  const glow = new GeoBuilder();
  const ground = new GeoBuilder();
  const nightLightSpots: THREE.Vector3[] = [];

  buildGround(ground, layout, rng);
  for (const b of layout.buildings) buildBuilding(solid, glow, b, rng, nightLightSpots);
  for (const p of layout.props) buildProp(solid, glow, p, rng);
  buildPalisade(solid, glow, layout.wallRadius, rng);

  const mainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: "#2b2a33",
    emissive: "#ffb45e",
    emissiveIntensity: 0,
    flatShading: true,
    roughness: 0.6,
  });
  const groundMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });

  const group = new THREE.Group();
  group.name = "village";

  const groundMesh = new THREE.Mesh(ground.build(), groundMaterial);
  groundMesh.receiveShadow = true;
  groundMesh.name = "ground";
  group.add(groundMesh);

  const solidMesh = new THREE.Mesh(solid.build(), mainMaterial);
  solidMesh.castShadow = true;
  solidMesh.receiveShadow = true;
  solidMesh.name = "architecture";
  group.add(solidMesh);

  const glowMesh = new THREE.Mesh(glow.build(), glowMaterial);
  glowMesh.name = "glow";
  group.add(glowMesh);

  // Lantern spots get lights too (the closest ones are lit at night).
  for (const p of layout.props) if (p.kind === "lantern") nightLightSpots.push(new THREE.Vector3(p.pos[0], 2.9, p.pos[1]));

  return { group, glowMaterial, nightLightSpots };
}

// ---------------------------------------------------------------- ground

function buildGround(g: GeoBuilder, layout: WorldLayout, rng: SeededRng): void {
  // Grass: a grid of tiles with slight color jitter gives a low-poly patchwork.
  const half = layout.size / 2 + 120;
  const tile = 10;
  const grass = new THREE.Color("#6f8f48");
  const c = new THREE.Color();
  for (let x = -half; x < half; x += tile) {
    for (let z = -half; z < half; z += tile) {
      c.copy(grass).offsetHSL(rng.range(-0.015, 0.015), rng.range(-0.05, 0.05), rng.range(-0.035, 0.03));
      g.box(tile, 0.1, tile, x + tile / 2, -0.1, z + tile / 2, c.clone());
    }
  }
  // Districts: the ground inside the palisade, clipped to the wall circle by tiles.
  const dt = 2;
  for (const d of layout.districts) {
    const [x0, z0, x1, z1] = d.rect;
    const base = new THREE.Color(d.groundColor);
    for (let x = x0; x < x1; x += dt) {
      for (let z = z0; z < z1; z += dt) {
        const cx = x + dt / 2;
        const cz = z + dt / 2;
        if (Math.hypot(cx, cz) > layout.wallRadius - 0.6) continue;
        c.copy(base).offsetHSL(0, rng.range(-0.02, 0.02), rng.range(-0.012, 0.012));
        g.box(dt, 0.02, dt, cx, 0, cz, c.clone());
      }
    }
  }
  // Roads (oriented strips).
  for (const r of layout.roads) {
    const dx = r.to[0] - r.from[0];
    const dz = r.to[1] - r.from[1];
    const len = Math.hypot(dx, dz);
    const ang = Math.atan2(dx, dz);
    g.add(BOX_UNIT, C.road, trs((r.from[0] + r.to[0]) / 2, 0.035, (r.from[1] + r.to[1]) / 2, 0, ang, 0, r.width, 0.03, len));
    // Cobble specks along the road for texture.
    const n = Math.floor(len / 1.6);
    for (let i = 0; i < n; i++) {
      const t = (i + rng.next()) / n;
      const side = rng.range(-r.width / 2 + 0.3, r.width / 2 - 0.3);
      const px = r.from[0] + dx * t + Math.cos(ang) * side;
      const pz = r.from[1] + dz * t - Math.sin(ang) * side;
      g.box(rng.range(0.3, 0.6), 0.04, rng.range(0.3, 0.6), px, 0.04, pz, rng.next() < 0.5 ? "#958061" : "#ad9673", rng.range(0, 3));
    }
  }
}

const BOX_UNIT = new THREE.BoxGeometry(1, 1, 1);

// ---------------------------------------------------------------- buildings

function setBuildingBase(g: GeoBuilder, b: BuildingDef): void {
  g.base.copy(trs(b.pos[0], 0, b.pos[1], 0, ((b.rot ?? 0) * Math.PI) / 2, 0, 1, 1, 1));
}

function buildBuilding(solid: GeoBuilder, glow: GeoBuilder, b: BuildingDef, rng: SeededRng, lights: THREE.Vector3[]): void {
  setBuildingBase(solid, b);
  setBuildingBase(glow, b);
  // Local frame: width along x, depth along z, front facing +z.
  const [w, d] = b.size;
  const h = buildingHeight(b);
  switch (b.kind) {
    case "house":
      house(solid, glow, w, d, h, rng, rng.next() < 0.6 ? C.roofTile : C.thatch);
      break;
    case "tavern":
      house(solid, glow, w, d, h, rng, C.roofDark);
      tavernExtras(solid, glow, w, d);
      lights.push(worldPoint(b, 0, 2.6, d / 2 + 1.2));
      break;
    case "forge":
      forge(solid, glow, w, d, h);
      lights.push(worldPoint(b, 0, 1.6, d / 2 - 1));
      break;
    case "temple":
      temple(solid, glow, w, d, h);
      lights.push(worldPoint(b, 0, 3, d / 2 + 2));
      break;
    case "barracks":
      barracks(solid, glow, w, d, h);
      lights.push(worldPoint(b, 0, 2.5, d / 2 + 1.5));
      break;
    case "tower":
      tower(solid, glow, w, d, h);
      break;
    case "shack":
      shack(solid, glow, w, d, h, rng);
      break;
    case "stall":
      stall(solid, w, d, rng);
      break;
    case "well":
      well(solid);
      break;
  }
  solid.base.identity();
  glow.base.identity();
}

function worldPoint(b: BuildingDef, x: number, y: number, z: number): THREE.Vector3 {
  const a = ((b.rot ?? 0) * Math.PI) / 2;
  return new THREE.Vector3(b.pos[0] + x * Math.cos(a) + z * Math.sin(a), y, b.pos[1] - x * Math.sin(a) + z * Math.cos(a));
}

function windows(glow: GeoBuilder, solid: GeoBuilder, w: number, d: number, y: number, count: number, skipCenter: boolean): void {
  // Front and back.
  for (let i = 0; i < count; i++) {
    const x = -w / 2 + (w / count) * (i + 0.5);
    if (skipCenter && Math.abs(x) < 1) continue;
    for (const side of [1, -1]) {
      glow.box(0.7, 0.8, 0.08, x, y, side * (d / 2 + 0.02), "#fff");
      solid.box(0.9, 0.1, 0.14, x, y - 0.08, side * (d / 2 + 0.04), C.timber);
    }
  }
  // Sides.
  glow.box(0.08, 0.8, 0.7, w / 2 + 0.02, y, 0, "#fff");
  glow.box(0.08, 0.8, 0.7, -w / 2 - 0.02, y, 0, "#fff");
}

function house(solid: GeoBuilder, glow: GeoBuilder, w: number, d: number, h: number, rng: SeededRng, roof: string): void {
  const wallH = h * 0.58;
  const baseH = wallH * 0.45;
  solid.box(w, baseH, d, 0, 0, 0, C.stone);
  solid.box(w - 0.1, wallH - baseH, d - 0.1, 0, baseH, 0, rng.next() < 0.5 ? C.plaster : C.plasterWarm);
  // Half-timbering.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) solid.box(0.25, wallH - baseH, 0.25, (sx * (w - 0.1)) / 2, baseH, (sz * (d - 0.1)) / 2, C.timber);
  solid.box(w + 0.05, 0.2, d + 0.05, 0, baseH, 0, C.timber);
  solid.box(w + 0.05, 0.2, d + 0.05, 0, wallH - 0.2, 0, C.timber);
  for (let i = 1; i < 3; i++) {
    const x = -w / 2 + (w / 3) * i;
    solid.box(0.18, wallH - baseH, 0.06, x, baseH, d / 2 - 0.02, C.timber);
    solid.box(0.18, wallH - baseH, 0.06, x, baseH, -d / 2 + 0.02, C.timber);
  }
  // Roof with overhang; ridge along x.
  solid.gable(w + 0.8, h - wallH, d + 1, 0, wallH, 0, roof);
  // Chimney.
  solid.box(0.7, h * 0.5, 0.7, w * 0.28, wallH, -d * 0.15, C.stoneDark);
  // Door.
  solid.box(1.15, 2.1, 0.12, 0, 0, d / 2 + 0.02, C.door);
  solid.box(1.45, 0.18, 0.2, 0, 2.1, d / 2 + 0.03, C.timber);
  windows(glow, solid, w, d, baseH + (wallH - baseH) * 0.35, Math.max(2, Math.round(w / 2.6)), false);
  windows(glow, solid, w, d, baseH * 0.35, Math.max(2, Math.round(w / 3)), true);
}

function tavernExtras(solid: GeoBuilder, glow: GeoBuilder, w: number, d: number): void {
  // Hanging sign with a mug, porch, benches.
  solid.box(0.12, 0.12, 1.6, w / 2 - 1.5, 3.3, d / 2 + 0.8, C.iron);
  solid.box(1.2, 0.8, 0.1, w / 2 - 1.5, 2.4, d / 2 + 1.5, C.woodLight);
  solid.box(0.5, 0.5, 0.12, w / 2 - 1.5, 2.55, d / 2 + 1.56, "#e1b44c");
  solid.box(w * 0.6, 0.15, 2.2, 0, 3.2, d / 2 + 1.1, C.roofDark);
  for (const x of [-w * 0.3 + 0.1, w * 0.3 - 0.1]) solid.box(0.2, 3.2, 0.2, x, 0, d / 2 + 2.1, C.timber);
  solid.box(2.2, 0.45, 0.5, -w * 0.25, 0, d / 2 + 0.6, C.wood);
  glow.box(0.25, 0.35, 0.25, 0.9, 2.3, d / 2 + 0.25, "#fff");
}

function forge(solid: GeoBuilder, glow: GeoBuilder, w: number, d: number, h: number): void {
  const wallH = h * 0.62;
  // Closed back half, open workshop front under a lean-to roof.
  solid.box(w, wallH, d * 0.55, 0, 0, -d * 0.225, C.stoneDark);
  solid.gable(w + 0.6, h - wallH, d * 0.55 + 0.8, 0, wallH, -d * 0.225, C.roofDark);
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) solid.box(0.3, wallH - 0.4, 0.3, x, 0, d / 2 - 0.3, C.timber);
  solid.box(w + 0.4, 0.2, d * 0.5, 0, wallH - 0.4, d * 0.25, C.roofDark, 0, -0.18);
  // Furnace + big chimney with ember glow.
  solid.box(2.2, 1.6, 1.6, -w / 2 + 1.6, 0, -0.2, C.stone);
  glow.box(1, 0.6, 0.08, -w / 2 + 1.6, 0.4, 0.62, "#fff");
  solid.box(1.4, h + 1.2, 1.4, -w / 2 + 1.6, 0, -d * 0.3, C.stone);
  // Anvil & quench barrel.
  solid.box(0.5, 0.55, 0.5, 0.8, 0, d * 0.2, C.stoneDark);
  solid.box(1, 0.3, 0.4, 0.8, 0.55, d * 0.2, C.iron);
  solid.cylinder(0.45, 0.8, 2.6, 0, d * 0.25, C.wood, 8);
}

function temple(solid: GeoBuilder, glow: GeoBuilder, w: number, d: number, h: number): void {
  const wallH = h * 0.55;
  solid.box(w + 1.2, 0.5, d + 1.2, 0, 0, 0, C.stone);
  solid.box(w, wallH, d, 0, 0.5, 0, C.stoneLight);
  // Buttresses.
  for (let i = 0; i < 5; i++) {
    const z = -d / 2 + (d / 4) * i;
    solid.box(0.8, wallH * 0.8, 0.9, w / 2 + 0.3, 0.5, z, C.stone);
    solid.box(0.8, wallH * 0.8, 0.9, -w / 2 - 0.3, 0.5, z, C.stone);
    if (i < 4) {
      glow.box(0.08, 2.4, 0.9, w / 2 + 0.02, 2.2, z + d / 8, "#fff");
      glow.box(0.08, 2.4, 0.9, -w / 2 - 0.02, 2.2, z + d / 8, "#fff");
    }
  }
  // Roof: ridge along z for a nave (rotate prism 90°).
  solid.gable(d + 0.8, h - wallH, w + 1.2, 0, wallH + 0.5, 0, C.roofSlate, Math.PI / 2);
  // Bell tower at the front.
  const tw = 4.2;
  solid.box(tw, h + 2, tw, 0, 0.5, d / 2 - tw / 2, C.stoneLight);
  solid.pyramid(tw + 0.6, 4.5, tw + 0.6, 0, h + 2.5, d / 2 - tw / 2, C.roofSlate);
  glow.box(1.2, 1.6, 0.08, 0, h - 1, d / 2 + 0.03, "#fff");
  // Rose window + great door + steps.
  glow.cylinder(0.9, 0.08, 0, 5.2, d / 2 + 0.05, "#fff", 10, Math.PI / 2);
  solid.box(2.2, 3.4, 0.15, 0, 0.5, d / 2 + 0.05, C.door);
  solid.box(3.6, 0.25, 1.2, 0, 0, d / 2 + 1.1, C.stone);
  // Golden sun emblem.
  solid.cylinder(0.5, 0.1, 0, h + 7.2, d / 2 - tw / 2 + tw / 2 + 0.35, "#e3b54a", 8, Math.PI / 2);
}

function crenellations(solid: GeoBuilder, w: number, d: number, y: number, color: string): void {
  const step = 1.1;
  for (let x = -w / 2 + 0.3; x <= w / 2 - 0.3; x += step) {
    solid.box(0.55, 0.6, 0.45, x, y, d / 2 - 0.2, color);
    solid.box(0.55, 0.6, 0.45, x, y, -d / 2 + 0.2, color);
  }
  for (let z = -d / 2 + 0.3; z <= d / 2 - 0.3; z += step) {
    solid.box(0.45, 0.6, 0.55, w / 2 - 0.2, y, z, color);
    solid.box(0.45, 0.6, 0.55, -w / 2 + 0.2, y, z, color);
  }
}

function barracks(solid: GeoBuilder, glow: GeoBuilder, w: number, d: number, h: number): void {
  solid.box(w, h, d, 0, 0, 0, C.stone);
  solid.box(w + 0.3, 0.3, d + 0.3, 0, h, 0, C.stoneDark);
  crenellations(solid, w + 0.3, d + 0.3, h + 0.3, C.stoneDark);
  solid.box(2.4, 3, 0.2, 0, 0, d / 2 + 0.05, C.door);
  solid.box(3, 0.4, 0.4, 0, 3, d / 2 + 0.1, C.stoneDark);
  // Royal banners (blue and gold).
  for (const x of [-3.2, 3.2]) {
    solid.box(1.1, 3, 0.08, x, h - 3.6, d / 2 + 0.06, "#2f4f8f");
    solid.box(0.5, 0.5, 0.09, x, h - 2.4, d / 2 + 0.07, "#e3b54a");
  }
  for (let i = 0; i < 5; i++) glow.box(0.5, 0.9, 0.08, -w / 2 + 1.5 + i * ((w - 3) / 4), h * 0.55, d / 2 + 0.02, "#fff");
}

function tower(solid: GeoBuilder, glow: GeoBuilder, w: number, d: number, h: number): void {
  solid.box(w, h, d, 0, 0, 0, C.stone);
  solid.box(w + 0.8, 0.4, d + 0.8, 0, h, 0, C.stoneDark);
  crenellations(solid, w + 0.8, d + 0.8, h + 0.4, C.stoneDark);
  solid.pyramid(w * 0.8, 2.8, d * 0.8, 0, h + 0.4, 0, C.roofSlate);
  solid.box(1.3, 2.3, 0.15, 0, 0, d / 2 + 0.03, C.door);
  glow.box(0.35, 1, 0.08, 0, h * 0.55, d / 2 + 0.02, "#fff");
  glow.box(0.35, 1, 0.08, 0, h * 0.8, d / 2 + 0.02, "#fff");
  // Flag.
  solid.box(0.1, 2.2, 0.1, 0, h + 3.1, 0, C.iron);
  solid.box(1.2, 0.7, 0.05, 0.65, h + 4.4, 0, "#2f4f8f");
}

function shack(solid: GeoBuilder, glow: GeoBuilder, w: number, d: number, h: number, rng: SeededRng): void {
  const lean = rng.range(-0.04, 0.04);
  solid.box(w, h * 0.7, d, 0, 0, 0, rng.next() < 0.5 ? C.wood : "#6e5236", 0, 0, lean);
  // Planks.
  for (let i = 0; i < Math.floor(w / 0.6); i++) solid.box(0.08, h * 0.7, 0.05, -w / 2 + 0.3 + i * 0.6, 0, d / 2 + 0.02, C.timber);
  // Sloped patched roof.
  solid.box(w + 0.6, 0.18, d + 0.7, 0, h * 0.78, 0, C.thatch, 0, 0.22);
  solid.box(1.2, 0.2, 1, rng.range(-w / 4, w / 4), h * 0.82 + 0.1, rng.range(-d / 4, d / 4), "#8c7b5a", 0, 0.22);
  solid.box(0.9, 1.8, 0.1, -w / 4, 0, d / 2 + 0.05, C.door);
  glow.box(0.5, 0.45, 0.08, w / 4, 1.2, d / 2 + 0.03, "#fff");
}

function stall(solid: GeoBuilder, w: number, d: number, rng: SeededRng): void {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) solid.box(0.15, 2.5, 0.15, (sx * (w - 0.2)) / 2, 0, (sz * (d - 0.2)) / 2, C.wood);
  solid.box(w, 0.9, 0.6, 0, 0, d / 2 - 0.4, C.woodLight);
  // Striped canopy.
  const stripes = 6;
  const a = rng.pick(C.cloth);
  for (let i = 0; i < stripes; i++) {
    const x = -w / 2 + (w / stripes) * (i + 0.5);
    solid.box(w / stripes, 0.08, d + 0.6, x, 2.5, 0.1, i % 2 === 0 ? a : "#efe6d2", 0, 0, 0);
  }
  solid.box(w, 0.08, d + 0.6, 0, 2.48, 0.1, a, 0, 0, 0);
  // Goods.
  for (let i = 0; i < 4; i++) solid.box(0.4, 0.3, 0.35, -w / 2 + 0.6 + i * 0.9, 0.9, d / 2 - 0.4, rng.pick(["#c9853a", "#d6c25a", "#9b3c2f", "#7aa04a"]));
}

function well(solid: GeoBuilder): void {
  solid.cylinder(1.4, 0.9, 0, 0, 0, C.stone, 10);
  solid.cylinder(1.1, 0.92, 0, 0.01, 0, "#2c3a4a", 10);
  for (const x of [-1.2, 1.2]) solid.box(0.18, 2.4, 0.18, x, 0.9, 0, C.timber);
  solid.box(2.6, 0.15, 0.15, 0, 2.6, 0, C.timber);
  solid.gable(3, 0.9, 1.8, 0, 3.2, 0, C.roofTile);
  solid.cylinder(0.2, 0.3, 0.3, 1.6, 0, C.wood, 6);
}

// ---------------------------------------------------------------- props

function buildProp(solid: GeoBuilder, glow: GeoBuilder, p: PropDef, rng: SeededRng): void {
  const [x, z] = p.pos;
  const rot = p.rot ?? 0;
  switch (p.kind) {
    case "tree": {
      const pine = rng.next() < 0.55;
      const s = rng.range(0.8, 1.35);
      solid.cylinder(0.25 * s, 2 * s, x, 0, z, C.trunk, 5);
      if (pine) {
        const col = rng.pick([C.leafA, C.leafB]);
        solid.cone(1.9 * s, 2.6 * s, x, 1.4 * s, z, col, 7, rot);
        solid.cone(1.5 * s, 2.3 * s, x, 2.7 * s, z, col, 7, rot + 0.4);
        solid.cone(1.0 * s, 1.9 * s, x, 3.9 * s, z, col, 7, rot + 0.8);
      } else {
        const col = rng.pick([C.leafA, C.leafC]);
        solid.blob(3.4 * s, 2.8 * s, 3.2 * s, x, 3.3 * s, z, col, rot);
        solid.blob(2.2 * s, 2 * s, 2.2 * s, x + 0.8 * s, 4.2 * s, z - 0.4 * s, col, rot + 1);
      }
      break;
    }
    case "rock":
      solid.rock(rng.range(1.4, 2.4), x, z, C.rock, rot);
      break;
    case "lantern":
      solid.box(0.16, 2.9, 0.16, x, 0, z, C.iron);
      solid.box(0.36, 0.1, 0.36, x, 3.3, z, C.iron);
      solid.box(0.38, 0.12, 0.38, x, 2.78, z, C.iron);
      glow.box(0.28, 0.42, 0.28, x, 2.88, z, "#fff");
      break;
    case "barrel":
      solid.cylinder(0.42, 0.95, x, 0, z, C.wood, 8);
      solid.cylinder(0.44, 0.08, x, 0.2, z, C.iron, 8);
      solid.cylinder(0.44, 0.08, x, 0.7, z, C.iron, 8);
      break;
    case "crate":
      solid.box(0.95, 0.9, 0.95, x, 0, z, C.woodLight, rot);
      solid.box(1, 0.1, 1, x, 0.42, z, C.timber, rot);
      break;
    case "cart": {
      solid.box(2.2, 0.15, 1.3, x, 0.7, z, C.wood, rot);
      solid.box(2.2, 0.5, 0.08, x - Math.sin(rot) * 0.62, 0.85, z - Math.cos(rot) * 0.62, C.woodLight, rot);
      for (const side of [-1, 1]) {
        const wx = x + Math.sin(rot) * 0.75 * side;
        const wz = z + Math.cos(rot) * 0.75 * side;
        solid.add(WHEEL, C.timber, trs(wx, 0.55, wz, 0, rot + Math.PI / 2, Math.PI / 2, 1.1, 0.12, 1.1));
      }
      break;
    }
    case "fence":
      for (let i = -1; i <= 1; i++) solid.box(0.14, 1.1, 0.14, x + Math.cos(rot) * i * 1.3, 0, z - Math.sin(rot) * i * 1.3, C.wood);
      solid.box(2.9, 0.1, 0.08, x, 0.5, z, C.woodLight, rot);
      solid.box(2.9, 0.1, 0.08, x, 0.9, z, C.woodLight, rot);
      break;
  }
}

const WHEEL = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);

// ---------------------------------------------------------------- palisade

function buildPalisade(solid: GeoBuilder, glow: GeoBuilder, radius: number, rng: SeededRng): void {
  const circumference = Math.PI * 2 * radius;
  const n = Math.floor(circumference / 0.56);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI;
    const inGate = GATE_ANGLES.some((g) => {
      let d = Math.abs(a - g) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      return d * radius < GATE_HALF_WIDTH;
    });
    if (inGate) continue;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const h = WALL_HEIGHT + rng.range(-0.3, 0.4);
    solid.cylinder(0.29, h, x, 0, z, rng.next() < 0.5 ? C.wood : "#7a5735", 5);
    solid.cone(0.29, 0.6, x, h, z, C.woodLight, 5);
  }
  // Walkway beam along the inside.
  for (let i = 0; i < n; i += 6) {
    const a = (i / n) * Math.PI * 2 - Math.PI;
    solid.box(0.12, 0.25, 3.6, Math.cos(a) * (radius - 0.4), 2.6, Math.sin(a) * (radius - 0.4), C.timber, -a);
  }
  // Gate towers.
  for (const g of GATE_ANGLES) {
    for (const side of [-1, 1]) {
      const a = g + (side * (GATE_HALF_WIDTH + 1.6)) / radius;
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      solid.box(3, 7, 3, x, 0, z, C.wood, -a);
      solid.box(3.6, 0.3, 3.6, x, 7, z, C.timber, -a);
      solid.pyramid(3.8, 2.6, 3.8, x, 7.3, z, C.roofDark);
      glow.box(0.5, 0.6, 0.5, x, 5, z, "#fff", -a);
    }
    const gx = Math.cos(g) * radius;
    const gz = Math.sin(g) * radius;
    solid.box(0.5, 0.6, GATE_HALF_WIDTH * 2 + 3, gx, 6.2, gz, C.timber, -g);
  }
}
