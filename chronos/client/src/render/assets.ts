import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

export const ASSET_ROOT = `${import.meta.env.BASE_URL}assets/`;

export interface LoadedModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  /** Bounding box of the untransformed model. */
  box: THREE.Box3;
}

/**
 * Loads glTF/GLB models from /assets once and hands out cheap clones.
 * Skinned characters are cloned with SkeletonUtils so each gets its own skeleton.
 */
export class AssetLibrary {
  private readonly loader: GLTFLoader;
  private readonly cache = new Map<string, Promise<LoadedModel>>();
  readonly failed = new Set<string>();

  constructor(manager?: THREE.LoadingManager) {
    this.loader = new GLTFLoader(manager);
    this.loader.setMeshoptDecoder(MeshoptDecoder);
  }

  load(path: string): Promise<LoadedModel> {
    let p = this.cache.get(path);
    if (!p) {
      p = this.loader.loadAsync(ASSET_ROOT + path).then((gltf: GLTF) => {
        const scene = gltf.scene;
        scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            const m = mesh.material as THREE.MeshStandardMaterial;
            if (m && m.isMeshStandardMaterial) {
              m.metalness = 0;
              m.roughness = Math.max(m.roughness, 0.8);
            }
          }
        });
        return { scene, animations: gltf.animations, box: new THREE.Box3().setFromObject(scene) };
      });
      p.catch(() => this.failed.add(path));
      this.cache.set(path, p);
    }
    return p;
  }

  async loadMany(paths: readonly string[]): Promise<Map<string, LoadedModel | null>> {
    const entries = await Promise.all(
      paths.map(async (p) => [p, await this.load(p).catch(() => null)] as const),
    );
    return new Map(entries);
  }

  /** A clone of a loaded model, safe to transform independently. */
  static instantiate(model: LoadedModel): THREE.Object3D {
    let skinned = false;
    model.scene.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true;
    });
    return skinned ? SkeletonUtils.clone(model.scene) : model.scene.clone(true);
  }
}
