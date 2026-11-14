import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const tmpColor = new THREE.Color();
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

/**
 * Accumulates many small low-poly pieces (each with a flat vertex color) and
 * merges them into a single geometry, so a whole district costs one draw call.
 */
export class GeoBuilder {
  private parts: THREE.BufferGeometry[] = [];
  /** Transform applied to every piece added (e.g. building position/rotation). */
  base = new THREE.Matrix4();

  get count(): number {
    return this.parts.length;
  }

  add(template: THREE.BufferGeometry, color: THREE.ColorRepresentation, local?: THREE.Matrix4): void {
    const g = template.index ? template.toNonIndexed() : template.clone();
    if (g.getAttribute("uv")) g.deleteAttribute("uv");
    if (g.getAttribute("uv1")) g.deleteAttribute("uv1");
    const m = local ? tmpMatrix.multiplyMatrices(this.base, local) : this.base;
    g.applyMatrix4(m);
    tmpColor.set(color);
    const n = g.getAttribute("position").count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.parts.push(g);
  }

  /** Box resting on y (bottom face at y), centered on x/z. */
  box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: THREE.ColorRepresentation,
    rotY = 0,
    rotX = 0,
    rotZ = 0,
  ): void {
    this.add(BOX, color, trs(x, y + h / 2, z, rotX, rotY, rotZ, w, h, d));
  }

  /** Gable roof: ridge along local x, spans `d` along z, apex `h` above y. */
  gable(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, rotY = 0): void {
    this.add(PRISM, color, trs(x, y, z, 0, rotY, 0, w, h, d));
  }

  /** Four-sided pyramid roof. */
  pyramid(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.ColorRepresentation): void {
    this.add(PYRAMID, color, trs(x, y + h / 2, z, 0, 0, 0, w, h, d));
  }

  cylinder(
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
    color: THREE.ColorRepresentation,
    segments: 5 | 6 | 8 | 10 = 6,
    rotX = 0,
    rotZ = 0,
    rotY = 0,
  ): void {
    this.add(CYLINDERS[segments], color, trs(x, y + h / 2, z, rotX, rotY, rotZ, r * 2, h, r * 2));
  }

  cone(r: number, h: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, segments: 5 | 6 | 7 | 8 = 7, rotY = 0): void {
    this.add(CONES[segments], color, trs(x, y + h / 2, z, 0, rotY, 0, r * 2, h, r * 2));
  }

  blob(sx: number, sy: number, sz: number, x: number, y: number, z: number, color: THREE.ColorRepresentation, rotY = 0): void {
    this.add(ICO, color, trs(x, y, z, 0, rotY, 0, sx, sy, sz));
  }

  rock(s: number, x: number, z: number, color: THREE.ColorRepresentation, rotY = 0): void {
    this.add(DODECA, color, trs(x, s * 0.35, z, 0.3, rotY, 0.2, s, s * 0.75, s * 0.9));
  }

  build(): THREE.BufferGeometry {
    if (this.parts.length === 0) return new THREE.BufferGeometry();
    const merged = mergeGeometries(this.parts, false);
    if (!merged) throw new Error("GeoBuilder: merge failed (incompatible attributes)");
    for (const p of this.parts) p.dispose();
    this.parts = [];
    merged.computeBoundingSphere();
    return merged;
  }
}

export function trs(
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number,
  sx: number,
  sy: number,
  sz: number,
): THREE.Matrix4 {
  tmpEuler.set(rx, ry, rz);
  tmpQuat.setFromEuler(tmpEuler);
  tmpPos.set(x, y, z);
  tmpScale.set(sx, sy, sz);
  return new THREE.Matrix4().compose(tmpPos, tmpQuat, tmpScale);
}

/** Unit triangular prism: base on y=0 spanning z in [-0.5, 0.5], apex at y=1, length x in [-0.5, 0.5]. */
function makePrism(): THREE.BufferGeometry {
  const L = [-0.5, 0, -0.5], R = [-0.5, 0, 0.5], T = [-0.5, 1, 0];
  const L2 = [0.5, 0, -0.5], R2 = [0.5, 0, 0.5], T2 = [0.5, 1, 0];
  // Counter-clockwise when seen from outside (verified by hand: outward normals).
  const tris = [
    L, R, T, // end -x
    L2, T2, R2, // end +x
    R, T2, T, R, R2, T2, // slope +z
    L, T2, L2, L, T, T2, // slope -z
    L, R2, R, L, L2, R2, // bottom
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const PRISM = makePrism();
const PYRAMID = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4);
const CYLINDERS = {
  5: new THREE.CylinderGeometry(0.5, 0.5, 1, 5),
  6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  10: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
};
const CONES = {
  5: new THREE.ConeGeometry(0.5, 1, 5),
  6: new THREE.ConeGeometry(0.5, 1, 6),
  7: new THREE.ConeGeometry(0.5, 1, 7),
  8: new THREE.ConeGeometry(0.5, 1, 8),
};
const ICO = new THREE.IcosahedronGeometry(0.5, 0);
const DODECA = new THREE.DodecahedronGeometry(0.5, 0);
