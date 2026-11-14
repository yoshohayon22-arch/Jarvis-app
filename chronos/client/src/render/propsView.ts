import * as THREE from "three";
import type { WorldLayout } from "@chronos/shared";
import type { DynamicProp } from "../sim/physics";
import { AssetLibrary } from "./assets";
import { PALETTE } from "./palette";
import type { VisualsDef } from "./worldView";

/** Renders the few objects telekinesis can move (one mesh each, driven by the prop physics). */
export class PropsView {
  readonly group = new THREE.Group();
  private readonly items: { prop: DynamicProp; obj: THREE.Object3D; lift: number }[] = [];
  private readonly frost = new THREE.Color(PALETTE.vfx.time?.hero ?? "#ffffff");

  static async create(layout: WorldLayout, visuals: VisualsDef, lib: AssetLibrary, props: readonly DynamicProp[]): Promise<PropsView> {
    const view = new PropsView();
    view.group.name = "dynamic-props";
    for (const prop of props) {
      const v = visuals.props[prop.kind];
      const def = layout.props[prop.layoutIndex];
      const modelPath = v?.models?.[prop.id % (v.models?.length ?? 1)];
      let obj: THREE.Object3D;
      let lift = 0;
      const model = modelPath ? await lib.load(`${visuals.assetsBase}${modelPath}.glb`).catch(() => null) : null;
      if (model) {
        const scale = typeof v?.scale === "number" ? v.scale : (v?.scale?.[0] ?? 5);
        const inner = AssetLibrary.instantiate(model);
        const b = model.box;
        inner.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
        obj = new THREE.Group();
        obj.add(inner);
        obj.scale.setScalar(scale);
      } else {
        // Placeholder when the model is missing.
        obj = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshStandardMaterial({ color: "#a77c4f", flatShading: true }));
        lift = 0.45;
        (obj as THREE.Mesh).castShadow = true;
      }
      void def;
      view.items.push({ prop, obj, lift });
      view.group.add(obj);
    }
    return view;
  }

  update(now: number): void {
    for (const { prop, obj, lift } of this.items) {
      obj.position.set(prop.x, prop.y + lift, prop.z);
      obj.rotation.y = prop.yaw;
      // Frozen objects hang slightly tilted, as if caught mid-motion.
      obj.rotation.z = prop.frozenUntil > now ? 0.12 : 0;
    }
  }

  positionOf(prop: DynamicProp, out: THREE.Vector3): THREE.Vector3 {
    return out.set(prop.x, prop.y + 0.5, prop.z);
  }
}
