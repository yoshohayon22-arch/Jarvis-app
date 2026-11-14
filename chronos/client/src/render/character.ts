import * as THREE from "three";
import type { MoveState } from "../sim/player";

export interface CharacterLook {
  skin: string;
  hair: string;
  tunic: string;
  cloak: string | null;
  trousers: string;
  boots: string;
  /** Kael's time shard glowing in his right palm. */
  shard?: boolean;
}

export const KAEL_LOOK: CharacterLook = {
  skin: "#e2b48f",
  hair: "#2f241d",
  tunic: "#5f7f8f",
  cloak: "#283a5c",
  trousers: "#5a4632",
  boots: "#3a2a1e",
  shard: true,
};

const box = (w: number, h: number, d: number, color: string, y = -h / 2) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, y, 0);
  const m = new THREE.Mesh(g, mat(color));
  m.castShadow = true;
  return m;
};

const materials = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string): THREE.MeshStandardMaterial {
  let m = materials.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 });
    materials.set(color, m);
  }
  return m;
}

/**
 * Low-poly humanoid built from boxes, animated procedurally (no rig needed).
 * Root sits on the ground; +z is the character's front.
 */
export class CharacterModel {
  readonly root = new THREE.Group();
  private readonly hips = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private cloak: THREE.Object3D | null = null;
  shardLight: THREE.PointLight | null = null;
  private phase = 0;
  private time = 0;

  constructor(look: CharacterLook) {
    this.root.add(this.hips);
    this.hips.position.y = 0.92;

    // Legs.
    for (const [leg, x] of [[this.legL, -0.12], [this.legR, 0.12]] as const) {
      leg.position.set(x, 0, 0);
      leg.add(box(0.17, 0.52, 0.2, look.trousers));
      const shin = box(0.15, 0.4, 0.18, look.boots, -0.2);
      shin.position.y = -0.52;
      leg.add(shin);
      this.hips.add(leg);
    }

    // Torso.
    this.hips.add(this.torso);
    const chest = box(0.46, 0.62, 0.27, look.tunic, 0.31);
    this.torso.add(chest);
    const belt = box(0.48, 0.08, 0.29, "#3b2a1c", 0.04);
    this.torso.add(belt);
    if (look.cloak) {
      const cloak = box(0.5, 1.05, 0.06, look.cloak, -0.47);
      cloak.position.set(0, 0.62, -0.17);
      this.torso.add(cloak);
      const collar = box(0.52, 0.12, 0.32, look.cloak, 0.06);
      collar.position.y = 0.56;
      this.torso.add(collar);
      this.cloak = cloak;
    }

    // Head.
    this.head.position.y = 0.66;
    this.torso.add(this.head);
    const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), mat(look.skin));
    skull.position.y = 0.17;
    skull.castShadow = true;
    this.head.add(skull);
    const hair = box(0.32, 0.12, 0.33, look.hair, 0.06);
    hair.position.set(0, 0.27, -0.02);
    this.head.add(hair);
    const fringe = box(0.3, 0.06, 0.12, look.hair, 0.03);
    fringe.position.set(0, 0.28, 0.12);
    this.head.add(fringe);
    for (const x of [-0.06, 0.06]) {
      const eye = box(0.035, 0.035, 0.02, "#1b1b22", 0.0175);
      eye.position.set(x, 0.18, 0.16);
      this.head.add(eye);
    }

    // Arms.
    for (const [arm, x] of [[this.armL, -0.3], [this.armR, 0.3]] as const) {
      arm.position.set(x, 0.58, 0);
      arm.add(box(0.13, 0.36, 0.15, look.tunic));
      const fore = box(0.11, 0.3, 0.13, look.skin, -0.15);
      fore.position.y = -0.36;
      arm.add(fore);
      this.torso.add(arm);
    }

    if (look.shard) {
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.06, 0),
        new THREE.MeshStandardMaterial({ color: "#ffcf7a", emissive: "#ffae3d", emissiveIntensity: 2.5 }),
      );
      shard.position.set(0, -0.66, 0.05);
      this.armR.add(shard);
      const light = new THREE.PointLight("#ffb347", 0.6, 3.5, 2);
      light.position.copy(shard.position);
      this.armR.add(light);
      this.shardLight = light;
    }
  }

  /**
   * @param speed horizontal speed in m/s
   * @param dodgeProgress 0..1 during a dodge roll, otherwise ignored
   */
  animate(dt: number, speed: number, state: MoveState, dodgeProgress: number): void {
    this.time += dt;
    const stride = state === "run" ? 1.45 : 1.05;
    this.phase += (dt * speed * Math.PI) / stride;
    const amount = Math.min(speed / 6.8, 1);
    const swing = Math.sin(this.phase) * (0.25 + amount * 0.65) * Math.min(speed / 1.2, 1);

    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;
    this.armL.rotation.z = -0.08;
    this.armR.rotation.z = 0.08;

    const bob = Math.abs(Math.sin(this.phase)) * 0.06 * Math.min(speed / 2, 1);
    const breathe = speed < 0.2 ? Math.sin(this.time * 2) * 0.012 : 0;
    this.hips.position.y = 0.92 + bob + breathe;
    this.torso.rotation.x = state === "run" ? 0.22 : state === "walk" ? 0.06 : 0;
    this.torso.rotation.y = Math.sin(this.phase) * 0.08 * amount;
    if (this.cloak) this.cloak.rotation.x = -0.1 - amount * 0.55 + Math.sin(this.time * 3) * 0.03;

    // Dodge: a low, leaning dash with arms tucked back.
    if (state === "dodge") {
      const k = Math.sin(dodgeProgress * Math.PI);
      this.torso.rotation.x = 0.25 + k * 0.75;
      this.hips.position.y = 0.92 - k * 0.32;
      this.legL.rotation.x = 0.9 * k;
      this.legR.rotation.x = -0.6 * k;
      this.armL.rotation.x = this.armR.rotation.x = 0.9 * k;
    }

    if (this.shardLight) this.shardLight.intensity = 0.5 + Math.sin(this.time * 2.3) * 0.15;
  }
}
