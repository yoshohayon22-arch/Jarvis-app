import * as THREE from 'three';
import { loadHDRI } from '../core/textures';

// Quatre éclairages pour juger les métaux : studio, jour dans la vallée,
// nuit bioluminescente et pluie.

export type LightId = 'studio' | 'jour' | 'nuit' | 'pluie';
export const LIGHTS: { id: LightId; label: string }[] = [
  { id: 'studio', label: 'Studio' }, { id: 'jour', label: 'Jour · vallée' }, { id: 'nuit', label: 'Nuit · bioluminescente' }, { id: 'pluie', label: 'Pluie' },
];
const HDR: Record<LightId, string> = { studio: 'studio_small_09', jour: 'meadow_2', nuit: 'satara_night', pluie: 'overcast_soil_puresky' };

interface Rig { key: THREE.DirectionalLight; rim: THREE.SpotLight; rim2: THREE.SpotLight; hemi: THREE.HemisphereLight; backdrop: THREE.Object3D; spots: () => THREE.SpotLight[] }

export class Lighting {
  id: LightId = 'studio';
  private env = new Map<LightId, Promise<THREE.Texture>>();
  private glow = new THREE.Group();
  private rain: THREE.LineSegments;
  private rainU = { uT: { value: 0 } };
  private wet = 0;
  private glowLights: THREE.PointLight[] = [];
  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private rig: Rig, particles: number) {
    // plantes lumineuses de la nuit
    const cols = [0x35ffd0, 0x4fb8ff, 0x8cff6a, 0x3de0ff];
    const stemM = new THREE.MeshBasicMaterial({ color: 0x0b2a24 });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.2, r = 4.6 + Math.random() * 2.4;
      const c = new THREE.Color(cols[i % cols.length]);
      const capM = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.2) });
      const h = 0.08 + Math.random() * 0.22;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, h, 5), stemM); stem.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r * 0.6 - 1.2);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.03 + Math.random() * 0.03, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capM); cap.position.copy(stem.position).setY(h);
      this.glow.add(stem, cap);
    }
    for (const [x, z, c] of [[-3.5, 1.5, 0x30ffc8], [3.5, 1.5, 0x3ab8ff], [0, -2.5, 0x7cff7a]] as const) {
      const l = new THREE.PointLight(c, 0, 9, 1.6); l.position.set(x, 0.5, z); this.glowLights.push(l); this.glow.add(l);
    }
    this.glow.visible = false; scene.add(this.glow);
    // pluie : traits qui tombent
    const N = Math.round(2500 * Math.max(0.3, particles));
    const p = new Float32Array(N * 6), sd = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 16, y = Math.random() * 8, z = (Math.random() - 0.5) * 10 + 1, s = Math.random();
      p.set([x, y, z, x - 0.02, y - 0.22, z], i * 6); sd[i * 2] = s; sd[i * 2 + 1] = s;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(sd, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: this.rainU, transparent: true, depthWrite: false,
      vertexShader: 'attribute float aS; uniform float uT; varying float vA; void main(){ vec3 p = position; p.y = mod(p.y - uT * (7.0 + aS * 3.0), 8.0); vA = 0.12 + aS * 0.15; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.75, 0.82, 0.9, vA); }',
    });
    this.rain = new THREE.LineSegments(g, m); this.rain.frustumCulled = false; this.rain.visible = false; scene.add(this.rain);
  }
  private getEnv(id: LightId) {
    if (!this.env.has(id)) this.env.set(id, loadHDRI(this.renderer, HDR[id]));
    return this.env.get(id)!;
  }
  async set(id: LightId) {
    this.id = id;
    const env = await this.getEnv(id);
    if (this.id !== id) return;
    const { scene, rig } = this;
    scene.environment = env;
    const fog = scene.fog as THREE.FogExp2;
    rig.backdrop.visible = id === 'studio';
    this.glow.visible = id === 'nuit';
    this.rain.visible = id === 'pluie';
    scene.backgroundBlurriness = 0.35; scene.backgroundIntensity = 1;
    for (const s of rig.spots()) s.intensity = id === 'studio' ? 40 : id === 'nuit' ? 8 : id === 'pluie' ? 14 : 0;
    if (id === 'studio') {
      scene.background = new THREE.Color(0x030405); fog.color.set(0x05070a); fog.density = 0.035;
      scene.environmentIntensity = 0.45;
      rig.key.color.set(0xfff0e0); rig.key.intensity = 2.2; rig.key.position.set(-5, 8, 7);
      rig.rim.color.set(0x5fd8ff); rig.rim.intensity = 140; rig.rim2.intensity = 60;
      rig.hemi.color.set(0x9fb4d8); rig.hemi.groundColor.set(0x1a1410); rig.hemi.intensity = 0.35;
      this.wet = 0;
    } else if (id === 'jour') {
      scene.background = env; scene.backgroundIntensity = 0.9; fog.color.set(0xa9c0d6); fog.density = 0.012;
      scene.environmentIntensity = 0.9;
      rig.key.color.set(0xfff1d8); rig.key.intensity = 3.4; rig.key.position.set(6, 10, 5);
      rig.rim.intensity = 0; rig.rim2.intensity = 0;
      rig.hemi.color.set(0xbcd6ff); rig.hemi.groundColor.set(0x4a5a2a); rig.hemi.intensity = 0.6;
      this.wet = 0;
    } else if (id === 'nuit') {
      scene.background = new THREE.Color(0x02040a); fog.color.set(0x030812); fog.density = 0.05;
      scene.environmentIntensity = 0.22;
      rig.key.color.set(0x7c9cff); rig.key.intensity = 0.35; rig.key.position.set(-4, 9, -3);
      rig.rim.color.set(0x34ffd0); rig.rim.intensity = 60; rig.rim2.intensity = 0;
      rig.hemi.color.set(0x1a3050); rig.hemi.groundColor.set(0x02060a); rig.hemi.intensity = 0.25;
      this.wet = 0.15;
    } else {
      scene.background = env; scene.backgroundIntensity = 0.45; fog.color.set(0x4a535c); fog.density = 0.06;
      scene.environmentIntensity = 0.55;
      rig.key.color.set(0xc8d4e0); rig.key.intensity = 0.9; rig.key.position.set(2, 10, 4);
      rig.rim.color.set(0xa8c8ff); rig.rim.intensity = 50; rig.rim2.intensity = 0;
      rig.hemi.color.set(0x8494a6); rig.hemi.groundColor.set(0x22272c); rig.hemi.intensity = 0.5;
      this.wet = 0.85;
    }
    for (const l of this.glowLights) l.intensity = id === 'nuit' ? 6 : 0;
  }
  /** Humidité des surfaces selon l'éclairage (pluie). */
  get wetness() { return this.wet; }
  update(t: number) { if (this.rain.visible) this.rainU.uT.value = t; }
  preload() { for (const l of LIGHTS) this.getEnv(l.id); }
}
