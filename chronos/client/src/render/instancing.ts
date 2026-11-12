import * as THREE from "three";
import type { LoadedModel } from "./assets";

export interface Placement {
  x: number;
  y?: number;
  z: number;
  yaw?: number;
  scale: number;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

/**
 * Matrix that seats a model on the ground: its bounding-box center goes to (x, z)
 * and its lowest point to y, after rotation and uniform scale.
 */
export function placementMatrix(model: LoadedModel, p: Placement, out = new THREE.Matrix4()): THREE.Matrix4 {
  const b = model.box;
  const cx = (b.min.x + b.max.x) / 2;
  const cz = (b.min.z + b.max.z) / 2;
  const center = new THREE.Matrix4().makeTranslation(-cx, -b.min.y, -cz);
  tmpQ.setFromAxisAngle(Y, p.yaw ?? 0);
  tmpV.set(p.x, p.y ?? 0, p.z);
  tmpS.setScalar(p.scale);
  out.compose(tmpV, tmpQ, tmpS).multiply(center);
  return out;
}

/**
 * Renders many copies of one model with one InstancedMesh per sub-mesh, so a
 * hundred trees cost as many draw calls as one tree.
 */
export function instanceModel(model: LoadedModel, placements: readonly Placement[], shadows = true): THREE.Group {
  const group = new THREE.Group();
  if (placements.length === 0) return group;
  model.scene.updateMatrixWorld(true);
  const bases = placements.map((p) => placementMatrix(model, p));
  model.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (o as THREE.SkinnedMesh).isSkinnedMesh) return;
    const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, placements.length);
    bases.forEach((base, i) => im.setMatrixAt(i, tmpM.multiplyMatrices(base, mesh.matrixWorld)));
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = shadows;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    im.name = mesh.name;
    group.add(im);
  });
  return group;
}
