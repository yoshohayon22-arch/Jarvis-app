import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { PACKED, loadPacks, packedFile } from "./packed";
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

  load(rawPath: string): Promise<LoadedModel> {
    // "kaykit/../people/x.glb" → "people/x.glb": packs may point at sibling asset folders.
    const path = rawPath.replace(/[^/]+\/\.\.\//g, "");
    let p = this.cache.get(path);
    if (!p) {
      const source: Promise<GLTF> = PACKED
        ? loadPacks(ASSET_ROOT).then(() => {
            const bytes = packedFile(path);
            if (!bytes) throw new Error(`Missing packed asset ${path}`);
            return this.loader.parseAsync(bytes, "");
          })
        : this.loader.loadAsync(ASSET_ROOT + path);
      p = source.then((gltf: GLTF) => {
        // The toy-like packs are toned down so they sit next to the photographic models.
        if (path.startsWith("kaykit/")) gltf.scene.traverse((o) => weather((o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined));
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
        const model = { scene, animations: gltf.animations, box: new THREE.Box3().setFromObject(scene) };
        this.resolved.push(model);
        return model;
      });
      p.catch(() => this.failed.add(path));
      this.cache.set(path, p);
    }
    return p;
  }

  private readonly resolved: LoadedModel[] = [];
  /** Every model loaded so far (to apply material enhancements to late arrivals). */
  loaded(): readonly LoadedModel[] {
    return this.resolved;
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

const weathered = new WeakMap<object, THREE.Texture>();
/** Desaturates and darkens a flat-color atlas (once per image). */
function weather(m: THREE.MeshStandardMaterial | undefined): void {
  const map = m?.map;
  const img = map?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!m || !map || !img || typeof document === "undefined") return;
  let t = weathered.get(img);
  if (!t) {
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.filter = "saturate(38%) brightness(82%) sepia(12%)";
    ctx.drawImage(img, 0, 0);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = map.colorSpace;
    t.flipY = map.flipY;
    t.wrapS = map.wrapS;
    t.wrapT = map.wrapT;
    t.magFilter = map.magFilter;
    t.minFilter = map.minFilter;
    weathered.set(img, t);
  }
  m.map = t;
  m.needsUpdate = true;
}
