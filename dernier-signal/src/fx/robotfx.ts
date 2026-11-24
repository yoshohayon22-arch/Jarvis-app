import * as THREE from 'three';

// Effets visuels liés aux robots : flamme du jetpack et onde du scanner.

const flameVert = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const flameFrag = /* glsl */`
uniform float uTime; uniform float uPower; uniform vec3 uCore; uniform vec3 uEdge;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
void main(){
  float along = vUv.y;                // 1 = buse, 0 = pointe
  float facing = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  float n = noise(vec2(vUv.x * 6.0, along * 5.0 + uTime * 14.0));
  float body = pow(along, 1.4) * (0.65 + 0.7 * n);
  float a = body * facing * uPower;
  vec3 col = mix(uEdge, uCore, pow(along, 3.0) * facing);
  gl_FragColor = vec4(col * a, 1.0);
}`;

export class Flame extends THREE.Group {
  private mats: THREE.ShaderMaterial[] = [];
  power = 0;
  constructor(length = 0.26, radius = 0.032) {
    super();
    const mk = (len: number, rad: number, core: number, edge: THREE.Color, coreC: THREE.Color) => {
      const g = new THREE.ConeGeometry(rad, len, 20, 6, true);
      g.rotateX(Math.PI); g.translate(0, -len / 2, 0);
      const m = new THREE.ShaderMaterial({
        vertexShader: flameVert, fragmentShader: flameFrag,
        uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uCore: { value: coreC.multiplyScalar(core) }, uEdge: { value: edge } },
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      this.mats.push(m);
      const mesh = new THREE.Mesh(g, m);
      mesh.renderOrder = 10;
      this.add(mesh);
    };
    mk(length, radius, 6, new THREE.Color(0.05, 0.35, 1.6), new THREE.Color(0.75, 0.95, 1.0));
    mk(length * 0.55, radius * 0.55, 10, new THREE.Color(0.4, 0.8, 2.5), new THREE.Color(1, 1, 1));
    this.visible = false;
  }
  update(t: number) {
    const flick = 0.85 + 0.15 * Math.sin(t * 61.0) * Math.sin(t * 37.0);
    for (const m of this.mats) { m.uniforms.uTime.value = t; m.uniforms.uPower.value = this.power * flick; }
    this.visible = this.power > 0.01;
    const s = 0.4 + 0.6 * this.power;
    this.scale.set(0.8 + 0.2 * this.power, s * flick, 0.8 + 0.2 * this.power);
  }
}

const waveVert = /* glsl */`
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  vec4 mv = viewMatrix * w;
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const waveFrag = /* glsl */`
uniform float uFade; uniform vec3 uColor; uniform float uTime; uniform float uFloorY;
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
  float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float shell = pow(rim, 3.5);
  float lines = 0.55 + 0.45 * smoothstep(0.6, 1.0, sin(vW.y * 90.0 - uTime * 8.0));
  float aboveFloor = smoothstep(uFloorY - 0.01, uFloorY + 0.04, vW.y);
  float a = shell * lines * uFade * aboveFloor;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;
const ringFrag = /* glsl */`
uniform float uFade; uniform vec3 uColor; varying vec2 vUv;
void main(){
  float r = vUv.x;                         // 0 intérieur → 1 bord
  float band = smoothstep(0.0, 1.0, r) * smoothstep(1.0, 0.94, r);
  float edge = smoothstep(0.9, 0.985, r) * smoothstep(1.0, 0.985, r);
  float a = (band * 0.25 + edge * 2.0) * uFade;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

export class ScanWave extends THREE.Group {
  private shellMat: THREE.ShaderMaterial;
  private ringMat: THREE.ShaderMaterial;
  private shell: THREE.Mesh;
  private ring: THREE.Mesh;
  age = 99;
  duration = 1.6;
  maxRadius = 2.6;
  constructor(color = new THREE.Color(0.2, 1.4, 2.4)) {
    super();
    this.shellMat = new THREE.ShaderMaterial({
      vertexShader: waveVert, fragmentShader: waveFrag,
      uniforms: { uFade: { value: 0 }, uColor: { value: color }, uTime: { value: 0 }, uFloorY: { value: 0 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), this.shellMat);
    this.shell.renderOrder = 11;
    this.add(this.shell);

    const rg = new THREE.RingGeometry(0.0, 1, 96, 1);
    // uv.x = rayon normalisé
    const pos = rg.attributes.position; const uv = rg.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, Math.hypot(pos.getX(i), pos.getY(i)), 0);
    rg.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: ringFrag,
      uniforms: { uFade: { value: 0 }, uColor: { value: color } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.ring = new THREE.Mesh(rg, this.ringMat);
    this.ring.renderOrder = 11;
    this.add(this.ring);
    this.visible = false;
  }
  trigger() { this.age = 0; }
  /** Rayon actuel (utilisé pour illuminer ce que l'onde traverse). */
  get radius() { return this.age < this.duration ? this.ease(this.age / this.duration) * this.maxRadius : -1; }
  private ease(x: number) { return 1 - Math.pow(1 - x, 2.2); }
  update(dt: number, t: number, floorY: number) {
    this.age += dt;
    const k = this.age / this.duration;
    this.visible = k < 1;
    if (!this.visible) return;
    const r = Math.max(0.01, this.ease(k) * this.maxRadius);
    const fade = Math.min(1, k * 8) * (1 - k) * (1 - k);
    this.shell.scale.setScalar(r);
    this.shell.position.y = 0.5;
    this.ring.scale.setScalar(Math.sqrt(Math.max(0, r * r - 0.25)) + 0.001);
    this.ring.position.y = floorY - this.position.y + 0.004;
    this.shellMat.uniforms.uFade.value = fade * 1.4;
    this.shellMat.uniforms.uTime.value = t;
    this.shellMat.uniforms.uFloorY.value = floorY;
    this.ringMat.uniforms.uFade.value = fade;
  }
}

/** Faisceau en éventail projeté par l'œil pendant le scan. */
export class ScanBeam extends THREE.Mesh {
  mat: THREE.ShaderMaterial;
  constructor(color = new THREE.Color(0.2, 1.3, 2.2)) {
    const g = new THREE.ConeGeometry(0.42, 1.2, 32, 1, true, -0.7, 1.4);
    g.translate(0, -0.6, 0); g.rotateX(-Math.PI / 2); // pointe à l'origine, ouvre vers +Z
    g.scale(1, 0.12, 1);
    const mat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uColor; uniform float uPower; uniform float uTime; varying vec3 vP;
        void main(){ float d = clamp(vP.z / 1.2, 0.0, 1.0);
          float lines = 0.6 + 0.4 * sin(vP.z * 60.0 - uTime * 20.0);
          float a = (1.0 - d) * (1.0 - d) * uPower * lines;
          gl_FragColor = vec4(uColor * a, 1.0); }`,
      uniforms: { uColor: { value: color }, uPower: { value: 0 }, uTime: { value: 0 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    super(g, mat);
    this.mat = mat;
    this.renderOrder = 12;
    this.visible = false;
  }
  update(power: number, t: number) {
    this.mat.uniforms.uPower.value = power;
    this.mat.uniforms.uTime.value = t;
    this.visible = power > 0.01;
  }
}
