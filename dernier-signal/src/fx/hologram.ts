import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Hologrammes : silhouettes humaines en lumière bleue translucide,
// lignes de balayage, scintillement et légère distorsion.

const holoVert = /* glsl */`
uniform float uTime; uniform float uGlitch;
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
  vec3 p = position;
  vec4 w = modelMatrix * vec4(p, 1.0);
  float band = step(0.985, fract(w.y * 3.0 - uTime * 0.7));
  w.x += (sin(w.y * 40.0 + uTime * 30.0) * 0.004 + band * 0.03) * (0.4 + uGlitch);
  vW = w.xyz;
  vec4 mv = viewMatrix * w;
  vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const holoFrag = /* glsl */`
uniform float uTime; uniform vec3 uColor; uniform float uAlpha; uniform float uGlitch;
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float rim = pow(f, 2.2);
  float scan = 0.55 + 0.45 * sin(vW.y * 140.0 - uTime * 6.0);
  float flick = 0.85 + 0.15 * sin(uTime * 37.0) * sin(uTime * 23.0);
  float a = (0.16 + rim * 1.4) * scan * flick * uAlpha;
  a *= 1.0 - uGlitch * step(0.5, fract(vW.y * 8.0 + uTime * 3.0)) * 0.7;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

export function holoMaterial(color = new THREE.Color(0.25, 0.75, 1.6)) {
  return new THREE.ShaderMaterial({
    vertexShader: holoVert, fragmentShader: holoFrag,
    uniforms: { uTime: { value: 0 }, uColor: { value: color }, uAlpha: { value: 0 }, uGlitch: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
  });
}

/** Silhouette humaine articulée (géométrie simple, lissée). */
export class HoloPerson extends THREE.Group {
  j: Record<string, THREE.Object3D> = {};
  mat: THREE.ShaderMaterial;
  gesture: 'point' | 'arms' | 'turn' | 'head' | 'none' = 'none';
  private gT = 0;
  baseYaw = 0;
  constructor(mat: THREE.ShaderMaterial, opts: { height?: number; female?: boolean } = {}) {
    super();
    this.mat = mat;
    const h = opts.height ?? 1.75;
    const s = h / 1.75;
    const J = (name: string, parent: THREE.Object3D, pos: [number, number, number]) => {
      const g = new THREE.Group(); g.position.set(pos[0] * s, pos[1] * s, pos[2] * s); parent.add(g); this.j[name] = g; return g;
    };
    const add = (joint: THREE.Object3D, geo: THREE.BufferGeometry, pos: [number, number, number] = [0, 0, 0], sc: [number, number, number] = [1, 1, 1]) => {
      geo.scale(sc[0] * s, sc[1] * s, sc[2] * s); geo.translate(pos[0] * s, pos[1] * s, pos[2] * s);
      joint.add(new THREE.Mesh(geo, mat));
    };
    const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 6, 16);
    const hips = J('hips', this, [0, 0.95, 0]);
    const chest = J('chest', hips, [0, 0.1, 0]);
    const head = J('head', chest, [0, 0.5, 0]);
    add(hips, cap(0.15, 0.08), [0, 0, 0], [1.05, 1, 0.75]);
    add(chest, mergeGeometries([cap(0.17, 0.25).translate(0, 0.22, 0), new THREE.SphereGeometry(0.06, 12, 8).translate(0, 0.45, 0)])!, [0, 0, 0], [opts.female ? 0.95 : 1.08, 1, 0.68]);
    add(head, new THREE.SphereGeometry(0.105, 24, 16), [0, 0.1, 0.0], [0.9, 1.1, 1]);
    for (const side of [1, -1]) {
      const sh = J(side > 0 ? 'armL' : 'armR', chest, [side * 0.2, 0.4, 0]);
      add(sh, cap(0.045, 0.24), [0, -0.15, 0]);
      const el = J(side > 0 ? 'foreL' : 'foreR', sh, [0, -0.3, 0]);
      add(el, cap(0.04, 0.22), [0, -0.14, 0]);
      add(el, new THREE.SphereGeometry(0.045, 10, 8), [0, -0.3, 0.01], [0.8, 1.1, 0.6]);
      const hip = J(side > 0 ? 'legL' : 'legR', hips, [side * 0.09, -0.05, 0]);
      add(hip, cap(0.065, 0.32), [0, -0.22, 0]);
      const kn = J(side > 0 ? 'shinL' : 'shinR', hip, [0, -0.44, 0]);
      add(kn, cap(0.05, 0.34), [0, -0.21, 0]);
      add(kn, new THREE.BoxGeometry(0.09, 0.05, 0.22), [0, -0.44, 0.04]);
    }
    this.j.armL.rotation.z = 0.12; this.j.armR.rotation.z = -0.12;
  }
  setGesture(g: HoloPerson['gesture']) { this.gesture = g; this.gT = 0; }
  update(dt: number, t: number) {
    this.gT += dt;
    const k = Math.min(1, this.gT / 0.6), e = k * k * (3 - 2 * k);
    const j = this.j;
    const br = Math.sin(t * 1.4) * 0.02;
    j.chest.rotation.x = br; j.head.rotation.set(Math.sin(t * 0.7) * 0.05, Math.sin(t * 0.4) * 0.15, 0);
    j.armL.rotation.set(0, 0, 0.12); j.armR.rotation.set(0, 0, -0.12); j.foreL.rotation.set(-0.15, 0, 0); j.foreR.rotation.set(-0.15, 0, 0);
    this.rotation.y += ((this.baseYaw + (this.gesture === 'turn' ? 0.9 * e : 0)) - this.rotation.y) * Math.min(1, dt * 3);
    switch (this.gesture) {
      case 'point': j.armR.rotation.set(-1.35 * e, 0.2 * e, -0.12); j.foreR.rotation.x = -0.15; break;
      case 'arms': j.armL.rotation.set(-0.6 * e, 0, 0.12 + 0.4 * e); j.armR.rotation.set(-0.6 * e, 0, -0.12 - 0.4 * e); j.foreL.rotation.x = -0.9 * e; j.foreR.rotation.x = -0.9 * e; break;
      case 'head': j.head.rotation.x += 0.25 * e * Math.sin(this.gT * 4); j.foreR.rotation.x = -1.2 * e; j.armR.rotation.x = -0.3 * e; break;
      case 'turn': j.armL.rotation.x = 0.1; break;
    }
  }
}

/** Projecteur au sol + cône lumineux. */
export function projectorBase(mat: THREE.Material, beamColor = new THREE.Color(0.2, 0.6, 1.4)) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 0.12, 40), mat);
  base.position.y = 0.06; base.castShadow = true; base.receiveShadow = true; g.add(base);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.32, 40), new THREE.MeshBasicMaterial({ color: beamColor.clone().multiplyScalar(2) }));
  lens.rotation.x = -Math.PI / 2; lens.position.y = 0.122; g.add(lens);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: beamColor }, uPower: { value: 0 } },
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vec4 w = modelMatrix*vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uPower; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 2.0) * (1.0 - smoothstep(0.0, 2.2, vY)) * 0.35 * uPower; gl_FragColor = vec4(uColor * a, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.32, 2.2, 40, 1, true).translate(0, 1.22, 0), beamMat);
  g.add(beam);
  return { group: g, beamMat, lensMat: lens.material as THREE.MeshBasicMaterial };
}
