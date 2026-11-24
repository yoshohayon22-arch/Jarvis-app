/// <reference types="vite/client" />
declare module 'n8ao' {
  import type { Pass } from 'postprocessing';
  import type { Scene, Camera, Color } from 'three';
  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);
    configuration: {
      aoRadius: number; distanceFalloff: number; intensity: number; color: Color;
      halfRes: boolean; gammaCorrection: boolean; screenSpaceRadius: boolean;
      aoSamples: number; denoiseSamples: number; denoiseRadius: number; transparencyAware: boolean;
      accumulate: boolean;
    };
    setQualityMode(mode: 'Performance' | 'Low' | 'Medium' | 'High' | 'Ultra'): void;
  }
}
