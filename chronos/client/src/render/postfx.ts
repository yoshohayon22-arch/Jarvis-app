import * as THREE from "three";
import {
  BlendFunction,
  BloomEffect,
  DepthOfFieldEffect,
  Effect,
  EffectComposer,
  EffectPass,
  FXAAEffect,
  NormalPass,
  RenderPass,
  SSAOEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";
import { PALETTE } from "./palette";
import type { QualityPreset } from "./quality";

const GRADE_FRAG = /* glsl */ `
uniform vec3 shadowTint;
uniform vec3 highlightTint;
uniform float balance;
uniform float strength;
uniform float saturation;
uniform float contrast;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float w = smoothstep(0.0, 1.0, clamp(l + balance, 0.0, 1.0));
  vec3 tint = mix(shadowTint, highlightTint, w) * 2.0;
  vec3 graded = mix(c, c * tint, strength);
  float l2 = dot(graded, vec3(0.2126, 0.7152, 0.0722));
  graded = mix(vec3(l2), graded, saturation);
  graded = (graded - 0.5) * contrast + 0.5;
  outputColor = vec4(clamp(graded, 0.0, 1.0), inputColor.a);
}`;

/** Linear exposure before tone mapping (driven by the time of day). */
export class ExposureEffect extends Effect {
  constructor() {
    super(
      "ExposureEffect",
      "uniform float exposure;\nvoid mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { outputColor = vec4(inputColor.rgb * exposure, inputColor.a); }",
      { uniforms: new Map<string, THREE.Uniform>([["exposure", new THREE.Uniform(1)]]) },
    );
  }
  set value(v: number) {
    this.uniforms.get("exposure")!.value = v;
  }
}

/** Split-toning color grade (cool shadows, warm highlights) from data/palette.json. */
export class ColorGradeEffect extends Effect {
  constructor() {
    const g = PALETTE.grading;
    super("ColorGradeEffect", GRADE_FRAG, {
      uniforms: new Map<string, THREE.Uniform>([
        ["shadowTint", new THREE.Uniform(new THREE.Vector3(...g.shadowTint))],
        ["highlightTint", new THREE.Uniform(new THREE.Vector3(...g.highlightTint))],
        ["balance", new THREE.Uniform(g.balance)],
        ["strength", new THREE.Uniform(g.strength)],
        ["saturation", new THREE.Uniform(g.saturation)],
        ["contrast", new THREE.Uniform(g.contrast)],
      ]),
    });
  }
}

/**
 * Post-processing chain (pmndrs/postprocessing): optional SSAO, bloom,
 * vignette and ACES tone mapping, rebuilt when the quality preset changes.
 * Rendering happens in HDR (half float) so emissive lights bloom naturally.
 */
export class PostFx {
  private composer!: EffectComposer;
  private normalPass: NormalPass | null = null;
  private dof: DepthOfFieldEffect | null = null;
  /** World point kept in focus by the depth of field (the player's head). */
  readonly focus = new THREE.Vector3();
  private readonly exposure = new ExposureEffect();
  /** Exposure multiplier (1 = neutral). */
  set exposureValue(v: number) {
    this.exposure.value = v;
  }

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    preset: QualityPreset,
  ) {
    // Tone mapping is done by the effect chain, not the renderer.
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.apply(preset);
  }

  apply(p: QualityPreset): void {
    this.composer?.dispose();
    this.normalPass = null;
    const composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: p.multisampling,
    });
    composer.addPass(new RenderPass(this.scene, this.camera));

    if (p.ao) {
      this.normalPass = new NormalPass(this.scene, this.camera);
      composer.addPass(this.normalPass);
      const ssao = new SSAOEffect(this.camera, this.normalPass.texture, {
        blendFunction: BlendFunction.MULTIPLY,
        samples: p.ao.samples,
        rings: p.ao.rings,
        distanceThreshold: p.ao.distanceThreshold,
        distanceFalloff: p.ao.distanceFalloff,
        rangeThreshold: 0.0005,
        rangeFalloff: 0.001,
        luminanceInfluence: 0.6,
        minRadiusScale: 0.3,
        radius: p.ao.radius,
        intensity: p.ao.intensity,
        bias: 0.03,
        fade: 0.02,
        resolutionScale: p.ao.resolutionScale,
        color: new THREE.Color("#1d1a2a"),
      });
      composer.addPass(new EffectPass(this.camera, ssao));
    }

    this.dof = null;
    if (p.dof) {
      this.dof = new DepthOfFieldEffect(this.camera, {
        focusRange: p.dof.focusRange,
        bokehScale: p.dof.bokehScale,
        resolutionScale: p.dof.resolutionScale,
      });
      this.dof.target = this.focus;
      composer.addPass(new EffectPass(this.camera, this.dof));
    }

    const bloom = new BloomEffect({
      intensity: p.bloom.intensity,
      luminanceThreshold: p.bloom.threshold,
      luminanceSmoothing: p.bloom.smoothing,
      mipmapBlur: true,
      radius: p.bloom.radius,
    });
    const vignette = new VignetteEffect({ offset: p.vignette.offset, darkness: p.vignette.darkness });
    const toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    composer.addPass(new EffectPass(this.camera, this.exposure, bloom, toneMapping, new ColorGradeEffect(), vignette));
    if (p.fxaa) composer.addPass(new EffectPass(this.camera, new FXAAEffect()));

    const size = this.renderer.getSize(new THREE.Vector2());
    composer.setSize(size.x, size.y);
    this.composer = composer;
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
  }

  render(dt: number): void {
    this.composer.render(dt);
  }
}
