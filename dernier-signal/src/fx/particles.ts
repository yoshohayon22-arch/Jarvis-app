import * as THREE from 'three';

// Système de particules générique (vapeur, étincelles, poussière, débris lumineux).

export interface ParticleOpts {
  max: number;
  additive: boolean;
  gravity: number;
  drag: number;
  bounceY?: number | null;   // hauteur du sol pour le rebond
  bounce?: number;
  soft?: boolean;            // disque flou (vapeur) ou point net (étincelle)
  texture?: 'soft' | 'spark';
  grow?: number;             // croissance de taille sur la vie
}

export class Particles extends THREE.Points {
  private pos: Float32Array; private vel: Float32Array; private life: Float32Array; private maxLife: Float32Array;
  private size: Float32Array; private col: Float32Array; private alive: Float32Array;
  private o: ParticleOpts;
  private cursor = 0;
  private mat: THREE.ShaderMaterial;

  constructor(o: ParticleOpts) {
    const g = new THREE.BufferGeometry();
    const n = o.max;
    const pos = new Float32Array(n * 3), size = new Float32Array(n), col = new Float32Array(n * 4), alive = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('psize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcol', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: Math.min(2, window.devicePixelRatio || 1) }, uSoft: { value: o.soft ? 1 : 0 } },
      vertexShader: /* glsl */`
        attribute float psize; attribute vec4 pcol; uniform float uPx; varying vec4 vC;
        void main(){ vC = pcol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = psize * uPx * 300.0 / max(0.2, -mv.z); }`,
      fragmentShader: /* glsl */`
        uniform float uSoft; varying vec4 vC;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c) * 2.0; if (d > 1.0) discard;
          float a = uSoft > 0.5 ? pow(1.0 - d, 1.6) : smoothstep(1.0, 0.2, d);
          gl_FragColor = vec4(vC.rgb, vC.a * a); }`,
      transparent: true, depthWrite: false,
      blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    super(g, mat);
    this.mat = mat;
    this.o = o;
    this.pos = pos; this.size = size; this.col = col; this.alive = alive;
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.maxLife = new Float32Array(n);
    this.frustumCulled = false;
    this.renderOrder = o.additive ? 30 : 25;
    this.baseSize = new Float32Array(n);
    this.baseCol = new Float32Array(n * 4);
  }
  private baseSize: Float32Array;
  private baseCol: Float32Array;

  emit(p: THREE.Vector3, v: THREE.Vector3, life: number, size: number, color: THREE.Color, alpha = 1) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.o.max;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.life[i] = 0; this.maxLife[i] = life; this.alive[i] = 1;
    this.baseSize[i] = size;
    this.baseCol[i * 4] = color.r; this.baseCol[i * 4 + 1] = color.g; this.baseCol[i * 4 + 2] = color.b; this.baseCol[i * 4 + 3] = alpha;
  }

  update(dt: number) {
    const o = this.o;
    const dragK = Math.exp(-o.drag * dt);
    for (let i = 0; i < o.max; i++) {
      if (!this.alive[i]) { this.size[i] = 0; continue; }
      this.life[i] += dt;
      const k = this.life[i] / this.maxLife[i];
      if (k >= 1) { this.alive[i] = 0; this.size[i] = 0; continue; }
      const j = i * 3;
      this.vel[j + 1] -= o.gravity * dt;
      this.vel[j] *= dragK; this.vel[j + 1] *= dragK; this.vel[j + 2] *= dragK;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      if (o.bounceY != null && this.pos[j + 1] < o.bounceY && this.vel[j + 1] < 0) {
        this.pos[j + 1] = o.bounceY; this.vel[j + 1] *= -(o.bounce ?? 0.4); this.vel[j] *= 0.7; this.vel[j + 2] *= 0.7;
      }
      const fadeIn = Math.min(1, k * 8), fadeOut = 1 - k;
      this.size[i] = this.baseSize[i] * (1 + (o.grow ?? 0) * k);
      const a = this.baseCol[i * 4 + 3] * fadeIn * fadeOut * (o.soft ? fadeOut : 1);
      this.col[i * 4] = this.baseCol[i * 4] * (o.additive ? a : 1);
      this.col[i * 4 + 1] = this.baseCol[i * 4 + 1] * (o.additive ? a : 1);
      this.col[i * 4 + 2] = this.baseCol[i * 4 + 2] * (o.additive ? a : 1);
      this.col[i * 4 + 3] = o.additive ? 1 : a;
    }
    const g = this.geometry;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.psize as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.pcol as THREE.BufferAttribute).needsUpdate = true;
    void this.mat;
  }

  /** Hauteur de rebond modifiable (étincelles qui tombent au sol de la pièce). */
  setFloor(y: number) { this.o.bounceY = y; }
}
