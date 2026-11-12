import * as THREE from "three";
import type { WorldLayout } from "@chronos/shared";
import { smoothstep } from "../core/math";
import { districtAt } from "../sim/districts";
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

/**
 * Painted ground: one smooth-shaded mesh whose vertex colors encode grass,
 * district soils, roads and the worn strip along the walls. Hills rise only
 * outside the playable area to frame the horizon.
 */
export function buildTerrain(layout: WorldLayout): THREE.Group {
  // Fine mesh over the playable area, coarse mesh for the horizon (sunk slightly
  // where the fine one covers it, so they never z-fight).
  const g = new THREE.Group();
  g.name = "terrain";
  g.add(buildTerrainPatch(layout, 200, 0.8, 0));
  g.add(buildTerrainPatch(layout, 700, 5, 99));
  return g;
}

function buildTerrainPatch(layout: WorldLayout, size: number, step: number, sinkInside: number): THREE.Mesh {
  const segs = Math.round(size / step);
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  const C = (k: string) => new THREE.Color(groundColor(k));
  const grass = C("grass");
  const grassDark = C("grassDark");
  const grassLight = C("grassLight");
  const dirt = C("dirt");
  const dirtDark = C("dirtDark");
  const cobbleDark = C("cobbleDark");
  const districtColors = new Map(layout.districts.map((d) => [d.id, C(d.groundColor)]));
  const c = new THREE.Color();
  const tmp = new THREE.Color();
  const R = layout.wallRadius;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);

    // Relief outside the playable disc.
    const hill = smoothstep(FLAT_RADIUS, FLAT_RADIUS + 60, r);
    const y = hill * (fbm(x * 0.02, z * 0.02, 3, 7) * 18 + (r - FLAT_RADIUS) * 0.06) - (r > FLAT_RADIUS ? 0 : 0.02);
    pos.setY(i, sinkInside > 0 && Math.abs(x) < sinkInside && Math.abs(z) < sinkInside ? y - 0.3 : y);

    // Grass base with soft patches.
    const n1 = fbm(x * 0.045, z * 0.045, 3, 1);
    const n2 = fbm(x * 0.12 + 40, z * 0.12, 2, 2);
    c.copy(grass).lerp(grassDark, smoothstep(0.45, 0.75, n1)).lerp(grassLight, smoothstep(0.62, 0.85, n2) * 0.6);

    // District soil inside the walls.
    // District borders are warped by noise so they read as worn ground, not lines.
    const wx = (fbm(x * 0.06, z * 0.06, 2, 11) - 0.5) * 9;
    const wz = (fbm(x * 0.06 + 31, z * 0.06, 2, 12) - 0.5) * 9;
    const d = districtAt(layout, x + wx, z + wz);
    if (d && r < R - 2) {
      const dc = districtColors.get(d.id);
      if (dc) {
        tmp.copy(dc);
        if (d.groundColor === "cobble") {
          // Paving: large-scale wear + fine stone mottling.
          tmp.lerp(cobbleDark, smoothstep(0.45, 0.8, fbm(x * 0.35, z * 0.35, 2, 3)) * 0.55);
          tmp.lerp(grassDark, smoothstep(0.72, 0.9, fbm(x * 0.15, z * 0.15, 2, 4)) * 0.35);
        }
        const edge = smoothstep(R - 2, R - 8, r);
        c.lerp(tmp, (d.groundColor === "cobble" ? 0.95 : 0.65) * edge);
      }
    }

    // Worn earth along the foot of the wall.
    const wallBand = 1 - smoothstep(2.5, 6, Math.abs(r - R));
    c.lerp(dirtDark, wallBand * 0.55);

    // Roads with soft, slightly noisy edges.
    let road = 0;
    for (const rd of layout.roads) {
      const dd = distToSegment(x, z, rd.from[0], rd.from[1], rd.to[0], rd.to[1]);
      const wobble = (fbm(x * 0.3, z * 0.3, 2, 5) - 0.5) * 1.2;
      road = Math.max(road, 1 - smoothstep(rd.width / 2 - 0.5, rd.width / 2 + 1.2, dd + wobble));
    }
    if (road > 0) {
      tmp.copy(dirt).lerp(dirtDark, fbm(x * 0.4, z * 0.4, 2, 9) * 0.5);
      c.lerp(tmp, road);
    }

    // Distant ground fades slightly toward darker green under the hills.
    c.lerp(grassDark, hill * 0.35);

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, TERRAIN_MATERIAL);
  mesh.receiveShadow = true;
  return mesh;
}

const TERRAIN_MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });

/** Terrain height at (x, z), matching buildTerrain (used to seat backdrop props). */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const hill = smoothstep(FLAT_RADIUS, FLAT_RADIUS + 60, r);
  return hill * (fbm(x * 0.02, z * 0.02, 3, 7) * 18 + (r - FLAT_RADIUS) * 0.06);
}
