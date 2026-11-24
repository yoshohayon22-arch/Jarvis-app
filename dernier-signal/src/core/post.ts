import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, NoiseEffect, BlendFunction, SMAAEffect, SMAAPreset, ChromaticAberrationEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import type { Quality } from './quality';

// Chaîne de post-traitement : rendu HDR → occlusion ambiante (N8AO) → bloom → tone mapping AgX
// → vignettage + grain → aberration chromatique légère → anti-crénelage SMAA.

export class ContextLostError extends Error {}

/** Crée le contexte WebGL2 nous-mêmes pour détecter un contexte refusé ou perdu dès la naissance (iPad saturé). */
export function createContext(canvas: HTMLCanvasElement, mobile: boolean): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', {
    antialias: false, stencil: false, depth: true, alpha: false, premultipliedAlpha: true,
    powerPreference: mobile ? 'default' : 'high-performance', failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: false,
  }) as WebGL2RenderingContext | null;
  if (!gl) throw new ContextLostError('WebGL2 indisponible');
  if (gl.isContextLost() || !gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT)) throw new ContextLostError('contexte graphique perdu');
  return gl;
}

export function createRenderer(canvas: HTMLCanvasElement, q: Quality, context?: WebGL2RenderingContext) {
  const r = new THREE.WebGLRenderer({
    canvas, context, antialias: false, stencil: false, depth: true, powerPreference: 'high-performance',
  });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NoToneMapping; // fait en post-traitement
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
  return r;
}

export class Post {
  composer: EffectComposer;
  ao: N8AOPostPass | null = null;
  bloom: BloomEffect;
  tone: ToneMappingEffect;
  private ca: EffectPass | null = null;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, q: Quality) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.composer.addPass(new RenderPass(scene, camera));

    if (q.ao !== 'off') {
      this.ao = new N8AOPostPass(scene, camera, size.x, size.y);
      const c = this.ao.configuration;
      c.aoRadius = 0.45; c.distanceFalloff = 1.0; c.intensity = 2.6;
      c.color = new THREE.Color(0x05070c);
      c.gammaCorrection = false;
      c.halfRes = q.ao === 'performance';
      this.ao.setQualityMode(q.ao === 'performance' ? 'Performance' : 'Medium');
      this.composer.addPass(this.ao);
    }

    this.bloom = new BloomEffect({
      mipmapBlur: true, luminanceThreshold: 1.0, luminanceSmoothing: 0.35, intensity: 1.05, radius: 0.75,
      levels: q.id === 'equilibre' ? 6 : 8,
    });
    this.bloom.blendMode.opacity.value = q.bloom ? 1 : 0;
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.62 });
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    noise.blendMode.opacity.value = 0.055;
    this.composer.addPass(new EffectPass(camera, this.bloom, this.tone, vignette, noise));

    if (q.chromatic) {
      this.ca = new EffectPass(camera, new ChromaticAberrationEffect({
        offset: new THREE.Vector2(0.00045, 0.00045), radialModulation: true, modulationOffset: 0.35,
      }));
      this.composer.addPass(this.ca);
    }
    this.composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: q.id === 'equilibre' ? SMAAPreset.MEDIUM : SMAAPreset.HIGH })));
  }

  setSize(w: number, h: number) { this.composer.setSize(w, h); }
  render(dt: number) { this.composer.render(dt); }
}

/** Compteur d'images par seconde (affichage optionnel). */
export class FpsMeter {
  el: HTMLElement;
  private frames = 0; private acc = 0; fps = 60;
  constructor(el: HTMLElement) { this.el = el; }
  tick(dt: number) {
    this.frames++; this.acc += dt;
    if (this.acc >= 0.5) {
      this.fps = this.frames / this.acc; this.frames = 0; this.acc = 0;
      this.el.textContent = `${this.fps.toFixed(0)} i/s`;
      this.el.style.color = this.fps >= 50 ? '#7dffb2' : this.fps >= 30 ? '#ffd27d' : '#ff7d7d';
    }
  }
}
