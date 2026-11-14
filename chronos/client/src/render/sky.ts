import * as THREE from "three";
import { clamp, lerp } from "../core/math";
import type { WorldClock } from "../sim/clock";
import { PALETTE, type SkyStop } from "./palette";

type PaletteStop = SkyStop;

/** Sky/light palette keyed by sun elevation (-1 midnight .. 1 noon), from data/palette.json. */
const STOPS: PaletteStop[] = [...PALETTE.sky].sort((a, b) => a.e - b.e);

const ca = new THREE.Color();
const cb = new THREE.Color();
function mixColor(out: THREE.Color, a: string, b: string, t: number): THREE.Color {
  ca.set(a);
  cb.set(b);
  return out.copy(ca).lerp(cb, t);
}

export interface SkySample {
  top: THREE.Color;
  horizon: THREE.Color;
  sun: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
}

export function samplePalette(e: number, out: SkySample): SkySample {
  e = clamp(e, -1, 1);
  let i = 0;
  while (i < STOPS.length - 2 && e > (STOPS[i + 1] as PaletteStop).e) i++;
  const a = STOPS[i] as PaletteStop;
  const b = STOPS[i + 1] as PaletteStop;
  const t = clamp((e - a.e) / (b.e - a.e), 0, 1);
  mixColor(out.top, a.top, b.top, t);
  mixColor(out.horizon, a.horizon, b.horizon, t);
  mixColor(out.sun, a.sun, b.sun, t);
  mixColor(out.hemiSky, a.hemiSky, b.hemiSky, t);
  mixColor(out.hemiGround, a.hemiGround, b.hemiGround, t);
  out.sunIntensity = lerp(a.sunIntensity, b.sunIntensity, t);
  out.hemiIntensity = lerp(a.hemiIntensity, b.hemiIntensity, t);
  return out;
}

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunVisible;
uniform vec3 uMoonDir;
uniform float uMoonVisible;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(smoothstep(-0.05, 0.6, h), 0.7));
  col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.2, h));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 900.0) * 6.0 + pow(sd, 12.0) * 0.25) * uSunVisible;
  float md = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.9993, 0.9996, md) * 1.2 + pow(md, 40.0) * 0.08) * uMoonVisible;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/**
 * Sky dome, stars, sun/moon lights, hemisphere light and fog, all driven by the
 * world clock. One shadow-casting directional light alternates between sun and moon.
 */
export class DayNightCycle {
  readonly sky: THREE.Mesh;
  readonly stars: THREE.Points;
  readonly light = new THREE.DirectionalLight("#ffffff", 2);
  readonly hemi = new THREE.HemisphereLight("#ffffff", "#444444", 1);
  readonly fog: THREE.Fog;
  private readonly uniforms;
  private readonly sample: SkySample = {
    top: new THREE.Color(),
    horizon: new THREE.Color(),
    sun: new THREE.Color(),
    sunIntensity: 0,
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    hemiIntensity: 0,
  };
  private readonly sunDir = new THREE.Vector3();
  /** 0 = day, 1 = night; exposed for emissive materials and lanterns. */
  night = 0;

  constructor(scene: THREE.Scene) {
    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uSunVisible: { value: 1 },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uMoonVisible: { value: 0 },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(450, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    this.sky.renderOrder = -1;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    const starPos: number[] = [];
    let seed = 1337;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) {
      const u = rnd() * Math.PI * 2;
      const v = Math.acos(rnd() * 0.95);
      starPos.push(Math.sin(v) * Math.cos(u) * 420, Math.cos(v) * 420, Math.sin(v) * Math.sin(u) * 420);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(
      sg,
      new THREE.PointsMaterial({ color: PALETTE.light.stars, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }),
    );
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    this.light.shadow.radius = 3;
    const s = this.light.shadow.camera;
    s.left = -55;
    s.right = 55;
    s.top = 55;
    s.bottom = -55;
    s.near = 1;
    s.far = 260;
    this.light.shadow.bias = -0.0006;
    this.light.shadow.normalBias = 0.04;
    scene.add(this.light, this.light.target, this.hemi);

    this.fog = new THREE.Fog("#d8d2ee", PALETTE.atmosphere.fogNear, PALETTE.atmosphere.fogFar);
    scene.fog = this.fog;
  }

  /** Applies a shadow-map resolution and blur radius (quality presets). */
  setShadowQuality(mapSize: number, radius: number): void {
    const sh = this.light.shadow;
    if (sh.mapSize.x !== mapSize) {
      sh.mapSize.set(mapSize, mapSize);
      sh.map?.dispose();
      sh.map = null;
    }
    sh.radius = radius;
  }

  update(clock: WorldClock, focus: THREE.Vector3): void {
    const e = clock.sunElevation;
    const a = clock.sunAzimuth;
    // The light keeps a low, golden angle all day (long shadows); the clock's own
    // elevation still drives the sky palette and day phases.
    const A = PALETTE.atmosphere;
    this.sunDir.set(Math.cos(a), Math.sin(a) * A.sunElevationScale + 0.03, A.sunTilt).normalize();
    const p = samplePalette(e, this.sample);

    this.night = 1 - clock.daylight;
    const sunUp = e > -0.04;
    const dir = sunUp ? this.sunDir : this.sunDir.clone().negate();
    this.light.position.set(focus.x + dir.x * 120, focus.y + Math.max(dir.y, 0.08) * 120, focus.z + dir.z * 120);
    this.light.target.position.copy(focus);
    this.light.color.copy(p.sun);
    this.light.intensity = p.sunIntensity;

    this.hemi.color.copy(p.hemiSky);
    this.hemi.groundColor.copy(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity;

    this.uniforms.uTop.value.copy(p.top);
    this.uniforms.uHorizon.value.copy(p.horizon);
    this.uniforms.uSunDir.value.copy(this.sunDir);
    this.uniforms.uSunColor.value.copy(p.sun);
    this.uniforms.uSunVisible.value = clamp((e + 0.1) * 6, 0, 1);
    this.uniforms.uMoonDir.value.copy(this.sunDir).negate();
    this.uniforms.uMoonVisible.value = clamp((-e + 0.05) * 6, 0, 1);
    (this.stars.material as THREE.PointsMaterial).opacity = clamp((this.night - 0.4) * 1.8, 0, 1);

    this.fog.color.copy(p.horizon).lerp(p.top, 0.18);
    this.sky.position.copy(focus);
    this.stars.position.copy(focus);
  }
}
