import * as THREE from "three";
import type { PowerFx } from "../sim/powers";
import { PALETTE } from "./palette";

const FRESNEL_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vP = position;
  gl_Position = projectionMatrix * mv;
}`;

const BUBBLE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  // Slow concentric ripples: time itself looks thick inside the bubble.
  float ripple = 0.5 + 0.5 * sin(vP.y * 9.0 - uTime * 1.4);
  float a = (rim * 0.85 + ripple * 0.06 + 0.04) * uAlpha;
  gl_FragColor = vec4(uColor * (1.4 + rim), a);
}`;

interface Live {
  obj: THREE.Object3D;
  age: number;
  life: number;
  update: (t: number, age: number) => void;
}

const color = (vfx: string, shade: "main" | "hero" | "dark" = "main") => new THREE.Color(PALETTE.vfx[vfx]?.[shade] ?? "#ffffff");

/**
 * One dedicated visual per power:
 *  time      → amber bubble (slow), frost ring (freeze), collapsing rings (rewind), spinning halo (loop)
 *  telekinesis → cyan pulses and a tether between the hand and the carried object
 *  shadow    → violet smoke puff (the hero himself turns into a translucent silhouette)
 */
export class PowerFxView {
  readonly group = new THREE.Group();
  private readonly live: Live[] = [];
  private readonly tether: THREE.Line;
  private readonly tetherGlow: THREE.PointLight;
  private readonly heldMarker: THREE.Mesh;
  private time = 0;

  constructor() {
    this.group.name = "power-fx";
    const c = color("telekinesis");
    this.tether = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: c.clone().multiplyScalar(3), transparent: true, opacity: 0.9, fog: false }),
    );
    this.tether.frustumCulled = false;
    this.tether.visible = false;
    this.tetherGlow = new THREE.PointLight(c, 0, 7, 1.6);
    this.heldMarker = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.85, 1),
      new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2), transparent: true, opacity: 0.16, depthWrite: false, wireframe: true, fog: false }),
    );
    this.heldMarker.visible = false;
    this.group.add(this.tether, this.tetherGlow, this.heldMarker);
  }

  private add(obj: THREE.Object3D, life: number, update: Live["update"]): void {
    this.group.add(obj);
    this.live.push({ obj, age: 0, life, update });
  }

  private ring(x: number, z: number, c: THREE.Color, life: number, from: number, to: number, y = 0.08, width = 0.35): void {
    const mat = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.2), transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false, fog: false });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(1 - width / Math.max(from, to, 1), 1, 48), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    this.add(mesh, life, (t) => {
      const r = from + (to - from) * (1 - (1 - t) * (1 - t));
      mesh.scale.setScalar(Math.max(0.01, r));
      mat.opacity = 1 - t;
    });
  }

  spawn(fx: PowerFx): void {
    const c = color(fx.vfx);
    const r = fx.radius ?? 2;
    switch (fx.kind) {
      case "zone": {
        const uniforms = { uColor: { value: c }, uAlpha: { value: 1 }, uTime: { value: 0 } };
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.ShaderMaterial({ uniforms, vertexShader: FRESNEL_VERT, fragmentShader: BUBBLE_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }),
        );
        dome.position.set(fx.x, 0, fx.z);
        const life = fx.duration ?? 5;
        this.add(dome, life, (t, age) => {
          uniforms.uTime.value = age;
          uniforms.uAlpha.value = Math.min(1, age * 4) * Math.min(1, (1 - t) * 6);
        });
        this.ring(fx.x, fx.z, c, 0.8, 0.5, r);
        break;
      }
      case "freeze": {
        const ice = color(fx.vfx, "hero");
        this.ring(fx.x, fx.z, ice, 0.7, 0.5, r, 0.1, 0.6);
        this.ring(fx.x, fx.z, ice, 1.1, 0.5, r * 0.7, 0.9, 0.3);
        break;
      }
      case "rewind": {
        // Three rings collapsing inward: the moment is pulled back.
        for (let i = 0; i < 3; i++) this.ring(fx.x, fx.z, i === 1 ? color(fx.vfx, "hero") : c, 0.6 + i * 0.25, r, 0.3, 0.1 + i * 0.5, 0.5);
        break;
      }
      case "loop": {
        const mat = new THREE.MeshBasicMaterial({ color: color(fx.vfx, "dark").multiplyScalar(2.5), transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false });
        const halo = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 6, 40, Math.PI * 1.6), mat);
        halo.position.set(fx.x, 1, fx.z);
        this.add(halo, fx.duration ?? 4, (t, age) => {
          halo.rotation.set(Math.PI / 2 + Math.sin(age * 3) * 0.3, 0, -age * 7);
          mat.opacity = Math.min(1, (1 - t) * 4);
        });
        break;
      }
      case "grab":
      case "throw":
      case "shove":
        this.ring(fx.x, fx.z, c, 0.45, 0.3, fx.kind === "shove" ? 2.6 : 1.6, 0.6, 0.4);
        break;
      case "cloak":
      case "uncloak": {
        const mat = new THREE.MeshBasicMaterial({ color: color("shadow", fx.kind === "cloak" ? "dark" : "hero"), transparent: true, opacity: 0.7, depthWrite: false });
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), mat);
        puff.position.set(fx.x, 1, fx.z);
        this.add(puff, 0.6, (t) => {
          puff.scale.setScalar(fx.kind === "cloak" ? 1.6 - t : 0.6 + t * 1.4);
          mat.opacity = 0.7 * (1 - t);
        });
        break;
      }
    }
  }

  /** @param held world position of the carried object/person, or null */
  update(dt: number, hand: THREE.Vector3, held: THREE.Vector3 | null): void {
    this.time += dt;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i] as Live;
      l.age += dt;
      const t = Math.min(1, l.age / l.life);
      l.update(t, l.age);
      if (t >= 1) {
        this.group.remove(l.obj);
        const m = l.obj as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose();
        this.live.splice(i, 1);
      }
    }
    this.tether.visible = this.heldMarker.visible = held !== null;
    this.tetherGlow.intensity = held ? 6 + Math.sin(this.time * 9) * 1.5 : 0;
    if (held) {
      const pos = this.tether.geometry.getAttribute("position") as THREE.BufferAttribute;
      pos.setXYZ(0, hand.x, hand.y, hand.z);
      pos.setXYZ(1, held.x, held.y, held.z);
      pos.needsUpdate = true;
      this.tetherGlow.position.copy(held);
      this.heldMarker.position.copy(held);
      this.heldMarker.rotation.set(this.time * 1.3, this.time * 1.7, 0);
    }
  }
}
