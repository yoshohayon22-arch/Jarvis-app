// La balise, les ruines anciennes à moitié enfouies, l'épave de la capsule de R-12,
// et les effets d'ambiance : pollen, lucioles, rayons de lumière sous la canopée.
import * as THREE from 'three';
import { U } from './atmosphere';
import { Terrain, BEACON, SPAWN, inHQZone } from './terrain';
import { rng } from './noise';
import { pbr } from '../core/textures';
import type { Physics } from '../world/physics';

/** Pilier ancien : prisme chanfreiné, sommet brisé, bandeaux sculptés. */
function pillarGeo(h: number, R: () => number) {
  const sh = new THREE.Shape(); const w = 0.62, c = 0.16;
  sh.moveTo(-w + c, -w); sh.lineTo(w - c, -w); sh.lineTo(w, -w + c); sh.lineTo(w, w - c); sh.lineTo(w - c, w); sh.lineTo(-w + c, w); sh.lineTo(-w, w - c); sh.lineTo(-w, -w + c); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, steps: Math.max(2, Math.round(h * 2)), bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    // sommet cassé en biais, bandeaux
    if (y > h - 0.8) p.setY(i, y - (p.getX(i) + 0.62) * (0.4 + R() * 0.05) - R() * 0.15);
    const band = Math.abs(((y / h) * 4) % 1 - 0.5) < 0.04 ? 0.94 : 1;
    p.setX(i, p.getX(i) * band); p.setZ(i, p.getZ(i) * band);
  }
  g.computeVertexNormals();
  return g;
}

export class Beacon {
  group = new THREE.Group();
  veins: THREE.MeshStandardMaterial;
  glyphs: THREE.MeshStandardMaterial;
  light = new THREE.PointLight(0x9a70ff, 0, 60, 1.4);
  shards: THREE.Mesh[] = [];

  constructor(t: Terrain, ph: Physics, res: '1k' | '2k') {
    const y0 = t.heightAt(BEACON.x, BEACON.y);
    this.group.position.set(BEACON.x, y0, BEACON.y);
    // monolithe facetté, sombre et brillant
    const obsidian = new THREE.MeshPhysicalMaterial({ color: 0x08080c, roughness: 0.14, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
    const prof: THREE.Vector2[] = [[0, -2], [2.6, -2], [3.1, 1], [2.4, 6], [1.9, 14], [1.1, 20], [0.2, 24.5], [0, 24.6]].map(([a, b]) => new THREE.Vector2(a, b));
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 7), obsidian);
    body.rotation.y = 0.3; body.scale.set(1, 1, 0.75); body.castShadow = true; body.receiveShadow = true;
    this.group.add(body);
    this.veins = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(0x9a6bff), emissiveIntensity: 2 });
    // veines lumineuses en spirale
    for (let k = 0; k < 3; k++) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 60; i++) { const v = i / 60, a = v * Math.PI * 4 + k * 2.1, r = THREE.MathUtils.lerp(3.05, 0.4, v) * (v < 0.1 ? 1 : 0.98); pts.push(new THREE.Vector3(Math.cos(a) * r, v * 23 + 0.5, Math.sin(a) * r * 0.75)); }
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.06, 5), this.veins);
      this.group.add(m);
    }
    // éclats de cristal en lévitation
    const crystal = new THREE.MeshPhysicalMaterial({ color: 0x2a1a50, emissive: new THREE.Color(0x6a3cff), emissiveIntensity: 0.6, roughness: 0.05, metalness: 0, transmission: 0, clearcoat: 1 });
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.6 + (i % 3) * 0.3, 0), crystal);
      s.scale.y = 2.2; s.userData.a = (i / 7) * Math.PI * 2; s.userData.r = 5 + (i % 2) * 1.5; s.userData.h = 6 + i * 1.6;
      s.castShadow = true; this.group.add(s); this.shards.push(s);
    }
    this.light.position.set(0, 10, 0); this.group.add(this.light);
    ph.add([BEACON.x - 2.6, y0 - 2, BEACON.y - 2.2], [BEACON.x + 2.6, y0 + 24, BEACON.y + 2.2], { surface: 'concrete' });

    // ruines anciennes : pierre sculptée, glyphes qui s'éclairent
    const st = pbr('mossy_rock', res);
    const stone = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughnessMap: st.arm, aoMap: st.arm, color: 0xb8b8c4, roughness: 1 });
    this.glyphs = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(0x7d5cff), emissiveIntensity: 1 });
    const R = rng(91);
    const add = (geo: THREE.BufferGeometry, x: number, z: number, yOff: number, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, stone);
      const y = t.heightAt(x, z) + yOff;
      m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true;
      ruins.add(m);
      geo.computeBoundingBox(); const bb = geo.boundingBox!.clone().applyMatrix4(m.matrixWorld.compose(m.position, m.quaternion, m.scale));
      ph.add([bb.min.x, bb.min.y, bb.min.z], [bb.max.x, bb.max.y, bb.max.z], { surface: 'concrete', camera: false });
      return m;
    };
    const ruins = new THREE.Group(); this.ruins = ruins;
    // anneau de piliers brisés autour de la balise
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + 0.2, r = 16 + R() * 3;
      const x = BEACON.x + Math.cos(a) * r, z = BEACON.y + Math.sin(a) * r;
      if (Math.hypot(x - SPAWN.x, z - SPAWN.y) < 6 || inHQZone(x, z, 3)) continue;
      const h = 1.2 + R() * 4.5;
      const p = add(pillarGeo(h, R), x, z, -0.8, (R() - 0.5) * 0.25, a, (R() - 0.5) * 0.2);
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.07, h * 0.55, 0.04), this.glyphs); g.position.set(0, h * 0.42, 0.7); p.add(g);
      const g2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.04), this.glyphs); g2.position.set(0, h * 0.62, 0.7); p.add(g2);
      if (R() < 0.5) add(new THREE.BoxGeometry(1.2, 0.9, 2.4), x + Math.cos(a + 1) * 2.5, z + Math.sin(a + 1) * 2.5, -0.1, R() * 0.5, R() * 3, 0.3);
    }
    // arche à moitié enfouie et dalles
    const archCurve = new THREE.EllipseCurve(0, 0, 4.2, 5.4, 0, Math.PI, false, 0);
    const archShape = new THREE.Shape(); const pts = archCurve.getPoints(24);
    pts.forEach((p, i) => (i ? archShape.lineTo(p.x * 1.18, p.y * 1.12) : archShape.moveTo(p.x * 1.18, p.y * 1.12)));
    pts.reverse().forEach((p) => archShape.lineTo(p.x, p.y));
    const arch = add(new THREE.ExtrudeGeometry(archShape, { depth: 1.1, bevelEnabled: false }), BEACON.x - 26, BEACON.y + 14, -1.6, 0, 0.9, 0.12);
    const ag = new THREE.Mesh(new THREE.TorusGeometry(4.9, 0.05, 4, 40, Math.PI), this.glyphs); ag.position.z = 1.12; arch.add(ag);
    for (let i = 0; i < 14; i++) { const a = R() * Math.PI * 2, r = 9 + R() * 24; add(new THREE.BoxGeometry(1.5 + R() * 2, 0.35, 1.5 + R() * 2), BEACON.x + Math.cos(a) * r, BEACON.y + Math.sin(a) * r, -0.12, (R() - 0.5) * 0.15, R() * 3, (R() - 0.5) * 0.15); }

  }
  ruins!: THREE.Group;

  update(t: number, night: number) {
    const p = 0.5 + 0.5 * Math.sin(t * 0.9);
    this.veins.emissiveIntensity = 1.2 + p * 2.2 + night * 2.5;
    this.glyphs.emissiveIntensity = 0.2 + night * 2.8 * (0.7 + 0.3 * Math.sin(t * 1.7));
    this.light.intensity = night * (120 + p * 60) + 10;
    for (const s of this.shards) { const a = s.userData.a + t * 0.08; s.position.set(Math.cos(a) * s.userData.r, s.userData.h + Math.sin(t * 0.7 + s.userData.a) * 0.6, Math.sin(a) * s.userData.r * 0.8); s.rotation.y = t * 0.3 + s.userData.a; }
  }
}

/** Pollen (jour) et lucioles (nuit) autour du joueur. */
export class Motes extends THREE.Points {
  constructor(count: number) {
    const p = new Float32Array(count * 3), r = new Float32Array(count);
    for (let i = 0; i < count; i++) { p.set([(Math.random() - 0.5) * 60, Math.random() * 8, (Math.random() - 0.5) * 60], i * 3); r[i] = Math.random(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aR', new THREE.BufferAttribute(r, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...U, tData: { value: null as THREE.Texture | null }, uSize: { value: 320 } },
      vertexShader: /* glsl */ `
        attribute float aR; uniform float uTime, uNight, uDay; uniform vec3 uPlayer; uniform sampler2D tData; uniform float uSize;
        varying float vA; varying vec3 vC;
        void main(){
          vec3 c = uPlayer - vec3(30.0, 0.0, 30.0);
          vec3 p = position; p.xz = c.xz + mod(p.xz + vec2(30.0) - c.xz + vec2(sin(uTime * 0.1 + aR * 6.0), cos(uTime * 0.13 + aR * 5.0)) * 3.0, 60.0);
          float g = texture2D(tData, (p.xz + uSize * 0.5) / uSize).r;
          p.y = g + 0.4 + mod(position.y + sin(uTime * 0.4 + aR * 20.0) * 0.6, 7.0);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float firefly = step(0.55, aR) * uNight;
          float blink = pow(0.5 + 0.5 * sin(uTime * (1.5 + aR * 2.0) + aR * 50.0), 4.0);
          vA = mix(0.35 * uDay * step(aR, 0.55), firefly * blink * 1.6, step(0.55, aR));
          vC = mix(vec3(1.0, 0.95, 0.8), vec3(0.55, 1.0, 0.45), step(0.55, aR));
          gl_PointSize = (step(0.55, aR) * 9.0 + 3.0) * 30.0 / -mv.z;
        }`,
      fragmentShader: 'varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC * (1.0 + vA * 3.0), a); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    super(g, mat);
    this.frustumCulled = false;
  }
}

/** Rayons de lumière sous la canopée : plans additifs orientés vers le soleil. */
export class Shafts extends THREE.InstancedMesh {
  constructor(trunks: THREE.Vector3[], max: number) {
    const g = new THREE.PlaneGeometry(1, 1, 1, 8); g.translate(0, -0.5, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...U, uI: { value: 1 } },
      vertexShader: 'varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uSunCol; uniform float uDay, uI, uTime; varying vec2 vUv; varying float vD; void main(){ float e = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.7, vUv.y); float flick = 0.75 + 0.25 * sin(uTime * 0.7 + vUv.x * 9.0); gl_FragColor = vec4(uSunCol * e * 0.09 * uDay * uI * flick * smoothstep(2.0, 10.0, vD), 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const n = Math.min(max, trunks.length);
    super(g, mat, n);
    this.userData.trunks = trunks.slice(0, n);
    this.frustumCulled = false;
  }
  update(sun: THREE.Vector3, cam: THREE.Camera) {
    const m = new THREE.Matrix4(), tr = this.userData.trunks as THREE.Vector3[];
    const L = 22;
    const s = sun.clone(); if (s.y < 0.15) s.y = 0.15; s.normalize();
    tr.forEach((p, i) => {
      const top = p.clone().add(new THREE.Vector3(3 * Math.sin(i), 24, 3 * Math.cos(i)));
      const mid = top.clone().addScaledVector(s, -L * 0.5);
      const toCam = cam.position.clone().sub(mid); toCam.addScaledVector(s, -toCam.dot(s)).normalize();
      const x = new THREE.Vector3().crossVectors(s, toCam).normalize();
      const basis = new THREE.Matrix4().makeBasis(x.multiplyScalar(3 + (i % 3)), s.clone().multiplyScalar(L), toCam);
      m.copy(basis).setPosition(top);
      this.setMatrixAt(i, m);
    });
    this.instanceMatrix.needsUpdate = true;
  }
}
