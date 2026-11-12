import * as THREE from "three";
import type { MoveState } from "../sim/player";
import { AssetLibrary, type LoadedModel } from "./assets";
import { PALETTE } from "./palette";
import type { CharacterVisual } from "./worldView";

type ClipKey = keyof CharacterVisual["clips"];

/**
 * A glTF character driven by the simulation state: picks idle/walk/run/dodge
 * clips, cross-fades between them and matches playback speed to ground speed.
 */
export class AnimatedCharacter {
  readonly root = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<ClipKey, THREE.AnimationAction>();
  private current: ClipKey | null = null;
  private dodgeHold = 0;
  private time = 0;
  shardLight: THREE.PointLight | null = null;

  constructor(model: LoadedModel, private readonly def: CharacterVisual, withShard: boolean) {
    const body = AssetLibrary.instantiate(model);
    for (const name of def.hiddenNodes) {
      const node = body.getObjectByName(name);
      if (node) node.visible = false;
    }
    // Normalize height using the visible meshes only.
    const box = new THREE.Box3();
    body.updateMatrixWorld(true);
    body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && isVisibleChain(m)) {
        m.geometry.computeBoundingBox();
        const gb = m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld);
        box.union(gb);
      }
      if (m.isMesh) m.frustumCulled = false; // skinned bounds are bind-pose only
    });
    const h = box.max.y - box.min.y;
    body.scale.setScalar(h > 0.1 ? def.height / h : 1);
    this.root.add(body);

    this.mixer = new THREE.AnimationMixer(body);
    for (const [key, clipName] of Object.entries(def.clips) as [ClipKey, string][]) {
      const clip = THREE.AnimationClip.findByName(model.animations, clipName);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      if (key === "dodge") {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions.set(key, action);
    }
    this.play("idle", 0);

    if (withShard) {
      const hand = body.getObjectByName("handslot.r") ?? body.getObjectByName("hand.r");
      if (hand) {
        const shard = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.07, 0),
          new THREE.MeshStandardMaterial({ color: PALETTE.material.shardCore, emissive: PALETTE.light.shard, emissiveIntensity: 3 }),
        );
        shard.scale.setScalar(1 / body.scale.x);
        hand.add(shard);
        const light = new THREE.PointLight(PALETTE.light.shard, 0.8, 3.5, 2);
        hand.add(light);
        this.shardLight = light;
      }
    }
  }

  get hasClips(): boolean {
    return this.actions.size > 0;
  }

  private play(key: ClipKey, fade = 0.2): void {
    if (this.current === key) return;
    const next = this.actions.get(key);
    if (!next) return;
    const prev = this.current ? this.actions.get(this.current) : undefined;
    next.reset().setEffectiveWeight(1).play();
    if (prev && fade > 0) next.crossFadeFrom(prev, fade, false);
    else if (prev) prev.stop();
    this.current = key;
  }

  update(dt: number, speed: number, state: MoveState): void {
    this.time += dt;
    if (state === "dodge" && this.current !== "dodge") {
      this.play("dodge", 0.08);
      const a = this.actions.get("dodge");
      if (a) a.timeScale = a.getClip().duration / 0.55;
      this.dodgeHold = 0.42;
    }
    this.dodgeHold -= dt;
    if (this.dodgeHold <= 0) {
      const key: ClipKey = speed < 0.25 ? "idle" : state === "run" || speed > (this.def.walkSpeed + this.def.runSpeed) / 2 ? "run" : "walk";
      this.play(key, 0.22);
      const a = this.actions.get(key);
      if (a && key === "walk") a.timeScale = THREE.MathUtils.clamp(speed / this.def.walkSpeed, 0.6, 1.8);
      if (a && key === "run") a.timeScale = THREE.MathUtils.clamp(speed / this.def.runSpeed, 0.7, 1.5);
      if (a && key === "idle") a.timeScale = 1;
    }
    this.mixer.update(dt);
    if (this.shardLight) this.shardLight.intensity = 0.7 + Math.sin(this.time * 2.3) * 0.2;
  }
}

function isVisibleChain(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}
