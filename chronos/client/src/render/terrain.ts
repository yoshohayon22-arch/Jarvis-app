import * as THREE from "three";
import type { WorldLayout } from "@chronos/shared";
import { smoothstep } from "../core/math";
import { districtAt } from "../sim/districts";
import { buildingFootprint } from "../sim/worldColliders";
import { createTerrainMaterial, type DetailTextures } from "./materials";
import { fbm } from "./noise";
import { groundColor } from "./palette";

/** Radius beyond which the ground may rise into hills (the player never gets there). */
export const FLAT_RADIUS = 104;

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export interface GroundSample {
  y: number;
  color: THREE.Color;
  /** Weights: grass, bare earth, paving. */
  grass: number;
  earth: number;
  paving: number;
}

/**
 * Evaluates the painted ground at a point: height, albedo and surface type.
 * Shared by the terrain mesh and the grass density map so they always agree.
 */
export class GroundSampler {
  private readonly C: Record<string, THREE.Color>;
  private readonly districtColors: Map<string, THREE.Color>;
  private readonly tmp = new THREE.Color();

  constructor(private readonly layout: WorldLayout) {
    const keys = ["grass", "grassDark", "grassLight", "dirt", "dirtDark", "cobbleDark"];
    this.C = Object.fromEntries(keys.map((k) => [k, new THREE.Color(groundColor(k))]));
    this.districtColors = new Map(layout.districts.map((d) => [d.id, new THREE.Color(groundColor(d.groundColor))]));
  }

  sample(x: number, z: number, out: GroundSample): GroundSample {
    const { C, tmp, layout } = this;
    const c = out.color;
    const r = Math.hypot(x, z);
    const R = layout.wallRadius;
    out.y = terrainHeight(x, z);
    const hill = smoothstep(FLAT_RADIUS, FLAT_RADIUS + 60, r);

    const n1 = fbm(x * 0.045, z * 0.045, 3, 1);
    const n2 = fbm(x * 0.12 + 40, z * 0.12, 2, 2);
    c.copy(C.grass!).lerp(C.grassDark!, smoothstep(0.45, 0.75, n1)).lerp(C.grassLight!, smoothstep(0.62, 0.85, n2) * 0.6);

    // District borders are warped by noise so they read as worn ground, not lines.
    const wx = (fbm(x * 0.06, z * 0.06, 2, 11) - 0.5) * 9;
    const wz = (fbm(x * 0.06 + 31, z * 0.06, 2, 12) - 0.5) * 9;
    const d = districtAt(layout, x + wx, z + wz);
    let paving = 0;
    let earth = 0;
    if (d && r < R - 2) {
      const dc = this.districtColors.get(d.id);
      if (dc) {
        tmp.copy(dc);
        if (d.groundColor === "cobble") {
          tmp.lerp(C.cobbleDark!, smoothstep(0.45, 0.8, fbm(x * 0.35, z * 0.35, 2, 3)) * 0.55);
          tmp.lerp(C.grassDark!, smoothstep(0.72, 0.9, fbm(x * 0.15, z * 0.15, 2, 4)) * 0.35);
        }
        const edge = smoothstep(R - 2, R - 8, r);
        c.lerp(tmp, (d.groundColor === "cobble" ? 0.95 : 0.65) * edge);
        if (d.groundColor === "cobble") paving = edge;
        if (d.groundColor === "mud") earth = 0.6 * edge;
      }
    }

    // Worn earth along the foot of the wall.
    const wallBand = 1 - smoothstep(2.5, 6, Math.abs(r - R));
    c.lerp(C.dirtDark!, wallBand * 0.55);
    earth = Math.max(earth, wallBand * 0.8);

    // Roads with soft, slightly noisy edges.
    let road = 0;
    for (const rd of layout.roads) {
      const dd = distToSegment(x, z, rd.from[0], rd.from[1], rd.to[0], rd.to[1]);
      if (dd > rd.width / 2 + 3) continue;
      const wobble = (fbm(x * 0.3, z * 0.3, 2, 5) - 0.5) * 1.2;
      road = Math.max(road, 1 - smoothstep(rd.width / 2 - 0.5, rd.width / 2 + 1.2, dd + wobble));
    }
    if (road > 0) {
      tmp.copy(C.dirt!).lerp(C.dirtDark!, fbm(x * 0.4, z * 0.4, 2, 9) * 0.5);
      c.lerp(tmp, road);
      earth = Math.max(earth, road * (1 - paving));
    }
    paving *= 1 - road * 0.3;
    c.lerp(C.grassDark!, hill * 0.35);

    out.paving = paving;
    out.earth = earth;
    out.grass = Math.max(0, 1 - earth - paving);
    return out;
  }
}

export function newGroundSample(): GroundSample {
  return { y: 0, color: new THREE.Color(), grass: 1, earth: 0, paving: 0 };
}

/**
 * Painted ground: a fine mesh over the playable area and a coarse one for the
 * horizon (sunk where the fine one covers it, so they never z-fight).
 */
export function buildTerrain(layout: WorldLayout, detail: DetailTextures | null = null): THREE.Group {
  const material = createTerrainMaterial(detail);
  const sampler = new GroundSampler(layout);
  const g = new THREE.Group();
  g.name = "terrain";
  g.add(buildTerrainPatch(sampler, 200, 0.8, 0, material));
  g.add(buildTerrainPatch(sampler, 700, 5, 99, material));
  return g;
}

function buildTerrainPatch(sampler: GroundSampler, size: number, step: number, sinkInside: number, material: THREE.Material): THREE.Mesh {
  const segs = Math.round(size / step);
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const surface = new Float32Array(pos.count * 3);
  const s = newGroundSample();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    sampler.sample(x, z, s);
    const sunk = sinkInside > 0 && Math.abs(x) < sinkInside && Math.abs(z) < sinkInside;
    pos.setY(i, s.y - (Math.hypot(x, z) > FLAT_RADIUS ? 0 : 0.02) - (sunk ? 0.3 : 0));
    colors[i * 3] = s.color.r;
    colors[i * 3 + 1] = s.color.g;
    colors[i * 3 + 2] = s.color.b;
    surface[i * 3] = s.grass;
    surface[i * 3 + 1] = s.earth;
    surface[i * 3 + 2] = s.paving;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("surface", new THREE.BufferAttribute(surface, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Grass map over the playable area: RGB = ground color, A = grass density
 * (zero on roads, paving and under buildings). Used by the grass field.
 */
export function buildGrassMap(layout: WorldLayout, extent = 200, res = 512): THREE.DataTexture {
  const sampler = new GroundSampler(layout);
  const s = newGroundSample();
  const data = new Uint8Array(res * res * 4);
  const boxes = layout.buildings.map((b) => {
    const f = buildingFootprint(b);
    return [b.pos[0] - f.w / 2 - 0.4, b.pos[1] - f.d / 2 - 0.4, b.pos[0] + f.w / 2 + 0.4, b.pos[1] + f.d / 2 + 0.4] as const;
  });
  const lin = new THREE.Color();
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x = ((i + 0.5) / res - 0.5) * extent;
      const z = ((j + 0.5) / res - 0.5) * extent;
      sampler.sample(x, z, s);
      let density = smoothstep(0.55, 0.95, s.grass);
      if (boxes.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1)) density = 0;
      if (Math.abs(Math.hypot(x, z) - layout.wallRadius) < 2.2) density = 0;
      lin.copy(s.color).convertLinearToSRGB();
      const k = (j * res + i) * 4;
      data[k] = lin.r * 255;
      data[k + 1] = lin.g * 255;
      data[k + 2] = lin.b * 255;
      data[k + 3] = density * 255;
    }
  }
  const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Terrain height at (x, z) (used to seat backdrop props). */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const hill = smoothstep(FLAT_RADIUS, FLAT_RADIUS + 60, r);
  return hill * (fbm(x * 0.02, z * 0.02, 3, 7) * 18 + (r - FLAT_RADIUS) * 0.06);
}
