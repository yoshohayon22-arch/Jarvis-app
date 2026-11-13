import * as THREE from "three";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import type { WorldClock } from "../sim/clock";
import { ASSET_ROOT } from "./assets";

/**
 * Image-based lighting from CC0 Poly Haven HDRIs: one environment per time of
 * day, prefiltered with PMREM. The visible sky stays procedural (sky.ts); the
 * HDRIs only light and reflect, which is what makes PBR materials read as real.
 */
const SLOTS = [
  { key: "night", file: "night", from: -1, intensity: 0.6 },
  { key: "dawn", file: "sunrise", from: -0.12, intensity: 0.55 },
  { key: "day", file: "park", from: 0.15, intensity: 1.0 },
] as const;
const DUSK = { file: "sunset", intensity: 0.55 };

export class EnvironmentLighting {
  private readonly maps = new Map<string, THREE.Texture>();
  private current: string | null = null;

  async load(renderer: THREE.WebGLRenderer, manager?: THREE.LoadingManager): Promise<void> {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const loader = new EXRLoader(manager);
    const files = [...new Set([...SLOTS.map((s) => s.file), DUSK.file])];
    await Promise.all(
      files.map(async (f) => {
        const hdr = await loader.loadAsync(`${ASSET_ROOT}pmndrs/hdri/${f}.exr`);
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        this.maps.set(f, pmrem.fromEquirectangular(hdr).texture);
        hdr.dispose();
      }),
    );
    pmrem.dispose();
  }

  get loaded(): boolean {
    return this.maps.size > 0;
  }

  update(scene: THREE.Scene, clock: WorldClock): void {
    if (!this.loaded) return;
    const e = clock.sunElevation;
    const evening = clock.minuteOfDay > 12 * 60;
    let slot: { file: string; intensity: number } = SLOTS[0];
    for (const s of SLOTS) if (e >= s.from) slot = s;
    if (slot.file === "sunrise" && evening) slot = DUSK;
    if (this.current !== slot.file) {
      scene.environment = this.maps.get(slot.file) ?? null;
      this.current = slot.file;
    }
    // Ease intensity around the switch points so changes are not noticeable.
    const target = slot.intensity * (0.6 + 0.4 * Math.min(1, Math.abs(e) * 4));
    scene.environmentIntensity += (target - scene.environmentIntensity) * 0.05;
  }
}
