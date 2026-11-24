import * as THREE from 'three';

// « Brouillard volumétrique » léger : cônes de lumière additifs avec poussière animée
// (bruit 3D), et particules de poussière qui scintillent dans les faisceaux.

const coneVert = /* glsl */`
varying vec3 vW; varying vec3 vN; varying float vH;
uniform float uLen;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vH = -position.y / uLen; // 0 au sommet, 1 en bas
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const coneFrag = /* glsl */`
uniform vec3 uColor; uniform float uTime; uniform float uIntensity; uniform float uFloor;
varying vec3 vW; varying vec3 vN; varying float vH;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z); }
void main(){
  vec3 V = normalize(cameraPosition - vW);
  float edge = pow(abs(dot(normalize(vN), V)), 1.8);
  float n = noise(vW * 2.2 + vec3(0.0, -uTime * 0.12, uTime * 0.05)) * 0.6 + noise(vW * 5.0 - uTime * 0.2) * 0.4;
  float fall = smoothstep(0.0, 0.15, vH) * (1.0 - smoothstep(0.75, 1.0, vH)) * (1.0 - vH * 0.55);
  float floorFade = smoothstep(uFloor, uFloor + 0.35, vW.y);
  float a = edge * fall * floorFade * (0.55 + 0.9 * n) * uIntensity;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

export class LightCone extends THREE.Mesh {
  mat: THREE.ShaderMaterial;
  constructor(from: THREE.Vector3, to: THREE.Vector3, radius: number, color: THREE.ColorRepresentation, intensity = 0.06, floorY = 0) {
    const len = from.distanceTo(to);
    const g = new THREE.ConeGeometry(radius, len, 48, 12, true);
    g.translate(0, -len / 2, 0); // sommet à l'origine
    const mat = new THREE.ShaderMaterial({
      vertexShader: coneVert, fragmentShader: coneFrag,
      uniforms: {
        uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uIntensity: { value: intensity },
        uLen: { value: len }, uFloor: { value: floorY },
      },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    super(g, mat);
    this.mat = mat;
    this.position.copy(from);
    const dir = to.clone().sub(from).normalize();
    this.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    this.renderOrder = 20;
  }
  update(t: number) { this.mat.uniforms.uTime.value = t; }
}

export class Dust extends THREE.Points {
  private mat: THREE.ShaderMaterial;
  constructor(count: number, box: THREE.Box3, color: THREE.ColorRepresentation = 0xbfdcff) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const size = box.getSize(new THREE.Vector3());
    for (let i = 0; i < count; i++) {
      pos[i * 3] = box.min.x + Math.random() * size.x;
      pos[i * 3 + 1] = box.min.y + Math.random() * size.y;
      pos[i * 3 + 2] = box.min.z + Math.random() * size.z;
      seed[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uMin: { value: box.min.clone() }, uSize: { value: size },
        uPx: { value: window.devicePixelRatio || 1 },
      },
      vertexShader: /* glsl */`
        attribute float seed; uniform float uTime; uniform vec3 uMin; uniform vec3 uSize; uniform float uPx;
        varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.13 + seed * 40.0) * 0.25;
          p.y = uMin.y + mod(p.y - uMin.y + uTime * (0.015 + seed * 0.03), uSize.y);
          p.z += cos(uTime * 0.11 + seed * 30.0) * 0.25;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.0 + seed * 2.2) * uPx * (6.0 / -mv.z);
          vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.8 + seed * 2.0) + seed * 60.0));
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; varying float vA;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(uColor * a * vA * 0.5, 1.0); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    super(g, mat);
    this.mat = mat;
    this.frustumCulled = false;
    this.renderOrder = 21;
  }
  update(t: number) { this.mat.uniforms.uTime.value = t; }
}
