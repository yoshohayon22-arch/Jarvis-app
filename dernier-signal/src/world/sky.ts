import * as THREE from 'three';

// Ciel spatial : champ d'étoiles dense en couches qui scintillent, nébuleuse générée par shader
// dans la couleur de la zone, planète avec atmosphère (diffusion sur le limbe), épave de l'Asterion.

export class Sky extends THREE.Group {
  private starMats: THREE.ShaderMaterial[] = [];
  private nebula: THREE.ShaderMaterial;
  planet: THREE.Group;
  private planetMat: THREE.ShaderMaterial;
  asterion: THREE.Group;
  private beacon: THREE.MeshBasicMaterial;

  constructor(tint = new THREE.Color(0.15, 0.45, 0.8), quality = 1) {
    super();
    // nébuleuse
    this.nebula = new THREE.ShaderMaterial({
      uniforms: { uTint: { value: tint }, uTime: { value: 0 } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */`
        uniform vec3 uTint; uniform float uTime; varying vec3 vD;
        float h(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        float n(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
          return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
        float fbm(vec3 p){ float a=0.5, s=0.; for(int i=0;i<6;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
        void main(){
          vec3 d = normalize(vD);
          float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.55, -0.78))) * 2.2, 2.0));
          float f = fbm(d * 3.0 + vec3(0.0, 0.0, uTime * 0.002));
          float g = fbm(d * 7.0 + f * 1.5);
          float neb = smoothstep(0.35, 0.95, f * 0.7 + g * 0.5) * band;
          float dust = smoothstep(0.55, 0.75, g) * band;
          vec3 col = uTint * neb * 0.55 + vec3(0.6, 0.3, 0.9) * pow(neb, 2.0) * 0.25;
          col *= 1.0 - dust * 0.85;
          col += vec3(0.004, 0.006, 0.012);
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    const neb = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 32), this.nebula);
    neb.renderOrder = -10;
    this.add(neb);
    // étoiles en 3 couches
    const layers = [[Math.round(9000 * quality), 0.9, 850], [Math.round(3000 * quality), 1.6, 800], [Math.round(400 * quality), 2.8, 780]];
    for (const [count, size, radius] of layers) {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3), seed = new Float32Array(count), col = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        // concentration vers le plan galactique
        let v = new THREE.Vector3().randomDirection();
        if (Math.random() < 0.5) { const band = new THREE.Vector3(0.3, 0.55, -0.78).normalize(); v.addScaledVector(band, -v.dot(band) * 0.8).normalize(); }
        v = v.multiplyScalar(radius);
        pos.set([v.x, v.y, v.z], i * 3);
        seed[i] = Math.random();
        const temp = Math.random();
        const c = temp < 0.15 ? new THREE.Color(1.0, 0.75, 0.55) : temp < 0.35 ? new THREE.Color(0.75, 0.85, 1.0) : new THREE.Color(1, 1, 1);
        col.set([c.r, c.g, c.b], i * 3);
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
      g.setAttribute('scol', new THREE.BufferAttribute(col, 3));
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uSize: { value: size }, uPx: { value: Math.min(2, window.devicePixelRatio || 1) } },
        vertexShader: /* glsl */`
          attribute float seed; attribute vec3 scol; uniform float uTime; uniform float uSize; uniform float uPx; varying vec3 vC;
          void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
            float tw = 0.6 + 0.4 * sin(uTime * (1.0 + seed * 4.0) + seed * 80.0);
            float b = pow(seed, 6.0) * 3.0 + 0.35;
            vC = scol * b * tw; gl_PointSize = uSize * uPx * (0.6 + seed * 0.8); }`,
        fragmentShader: 'varying vec3 vC; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c)*2.0; float a = exp(-d*d*4.0); gl_FragColor = vec4(vC * a, 1.0); }',
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      });
      this.starMats.push(m);
      const pts = new THREE.Points(g, m); pts.renderOrder = -9; pts.frustumCulled = false;
      this.add(pts);
    }
    // planète
    this.planet = new THREE.Group();
    this.planetMat = new THREE.ShaderMaterial({
      uniforms: { uSun: { value: new THREE.Vector3(0.85, 0.3, -0.25).normalize() }, uTime: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vP; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vP = position; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: /* glsl */`
        uniform vec3 uSun; uniform float uTime; varying vec3 vN; varying vec3 vP; varying vec3 vW;
        float h(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        float n(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
          return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
        float fbm(vec3 p){ float a=0.5, s=0.; for(int i=0;i<6;i++){ s+=a*n(p); p*=2.1; a*=0.5; } return s; }
        void main(){
          vec3 N = normalize(vN); vec3 d = normalize(vP);
          float land = fbm(d * 3.2);
          float clouds = smoothstep(0.5, 0.8, fbm(d * 6.0 + vec3(uTime * 0.003, 0.0, 0.0)));
          vec3 sea = vec3(0.01, 0.035, 0.05);
          vec3 ground = mix(vec3(0.04, 0.12, 0.08), vec3(0.13, 0.07, 0.16), smoothstep(0.45, 0.7, land));
          vec3 col = mix(sea, ground, smoothstep(0.47, 0.52, land));
          col = mix(col, vec3(0.55, 0.62, 0.7), clouds * 0.6);
          float lit = max(dot(N, uSun), 0.0);
          float term = smoothstep(-0.05, 0.25, dot(N, uSun));
          vec3 day = col * (0.15 + 1.6 * lit);
          // côté nuit : lueurs bioluminescentes émeraude et violettes
          float glow = smoothstep(0.62, 0.72, fbm(d * 14.0)) * smoothstep(0.5, 0.55, land);
          vec3 night = col * 0.015 + glow * mix(vec3(0.1, 0.9, 0.5), vec3(0.6, 0.2, 1.0), fbm(d * 5.0)) * 0.55 * (1.0 - clouds * 0.7);
          vec3 c = mix(night, day, term);
          // diffusion atmosphérique sur le limbe
          vec3 V = normalize(cameraPosition - vW);
          float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          c += vec3(0.25, 0.6, 1.0) * rim * (0.15 + 1.5 * smoothstep(-0.3, 0.6, dot(N, uSun)));
          gl_FragColor = vec4(c, 1.0);
        }`,
      fog: false,
    });
    const R = 220;
    this.planet.add(new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), this.planetMat));
    const atmo = new THREE.ShaderMaterial({
      uniforms: { uSun: this.planetMat.uniforms.uSun },
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: 'uniform vec3 uSun; varying vec3 vN; varying vec3 vW; void main(){ vec3 V = normalize(cameraPosition - vW); float f = 1.0 - abs(dot(normalize(vN), V)); float a = pow(f, 4.0) * (0.25 + 1.4 * smoothstep(-0.4, 0.7, dot(normalize(vN), uSun))); gl_FragColor = vec4(vec3(0.3, 0.65, 1.2) * a, 1.0); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide, fog: false,
    });
    this.planet.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 96, 64), atmo));
    this.planet.position.set(-120, -150, -520);
    this.add(this.planet);
    // Asterion : silhouette lointaine
    this.asterion = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.7, metalness: 0.6, fog: false });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 32, 16), hull); body.rotation.z = Math.PI / 2; this.asterion.add(body);
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.5, 8, 24), hull); ring.rotation.y = Math.PI / 2; ring.position.x = -12 + i * 5.5; this.asterion.add(ring);
    }
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 2.5, 6, 16), hull); eng.rotation.z = Math.PI / 2; eng.position.x = 18; this.asterion.add(eng);
    const broken = new THREE.Mesh(new THREE.BoxGeometry(9, 1.5, 7), hull); broken.position.set(-4, 3, 0); broken.rotation.z = 0.3; this.asterion.add(broken);
    this.beacon = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.6, 0.2), fog: false });
    for (const x of [-16, 21]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), this.beacon); b.position.set(x, 2.8, 0); this.asterion.add(b); }
    this.asterion.position.set(90, 25, -260);
    this.asterion.rotation.set(0.15, 0.6, 0.12);
    this.add(this.asterion);
  }
  update(t: number) {
    for (const m of this.starMats) m.uniforms.uTime.value = t;
    this.nebula.uniforms.uTime.value = t;
    this.planetMat.uniforms.uTime.value = t;
    this.planet.rotation.y = t * 0.004;
    this.beacon.color.setRGB(4, 0.6, 0.2).multiplyScalar(Math.sin(t * 2.4) > 0.6 ? 1 : 0.02);
  }
}
