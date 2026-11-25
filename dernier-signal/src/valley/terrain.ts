// Relief de la vallée : carte de hauteur, érosion hydraulique, lit de la rivière, masques
// (forêt, humidité, roche, herbe), maillage et matériau à textures mélangées (Poly Haven).
import * as THREE from 'three';
import { fbm, ridged, rng, smooth, lerp } from './noise';
import { pbr } from '../core/textures';

export const SIZE = 320;      // côté de la tranche, en mètres
export const N = 257;          // points de la carte de hauteur
const CELL = SIZE / (N - 1);

/** Tracé de la rivière (du nord au sud-ouest), le long de l'orée de la forêt. */
export const RIVER_PTS: [number, number][] = [[-8, -175], [-20, -120], [-38, -72], [-40, -30], [-52, 12], [-78, 56], [-104, 100], [-128, 175]];
export const BEACON = new THREE.Vector2(26, 6);
export const SPAWN = new THREE.Vector2(40, 34);

export interface Field {
  h: Float32Array; forest: Float32Array; wet: Float32Array; grass: Float32Array; river: Float32Array; water: Float32Array;
}

const idx = (i: number, j: number) => j * N + i;
const toGrid = (x: number) => (x + SIZE / 2) / CELL;

export class Terrain {
  f: Field;
  mesh!: THREE.Mesh;
  far!: THREE.Mesh;
  /** carte de données pour les shaders (R hauteur, G herbe, B forêt, A humidité) */
  dataTex!: THREE.DataTexture;
  riverCurve: THREE.CatmullRomCurve3;
  riverSamples: { p: THREE.Vector2; level: number; width: number; t: number }[] = [];

  constructor() {
    this.riverCurve = new THREE.CatmullRomCurve3(RIVER_PTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5);
    const len = this.riverCurve.getLength();
    for (let k = 0; k <= 400; k++) {
      const t = k / 400, p = this.riverCurve.getPointAt(t);
      // niveau de l'eau : descend vers le sud, avec un petit rapide
      const level = 1.6 - t * 3.4 - smooth(0.44, 0.5, t) * 0.9;
      const width = 9 + 4 * Math.sin(t * 9.1) + 3 * smooth(0.6, 1, t);
      this.riverSamples.push({ p: new THREE.Vector2(p.x, p.z), level, width, t: t * len });
    }
    this.f = this.generate();
  }

  /** Distance à la rivière + infos du point le plus proche. */
  riverInfo(x: number, z: number) {
    let best = Infinity, bi = 0;
    for (let k = 0; k < this.riverSamples.length; k += 4) { const s = this.riverSamples[k].p; const d = (s.x - x) ** 2 + (s.y - z) ** 2; if (d < best) { best = d; bi = k; } }
    for (let k = Math.max(0, bi - 4); k <= Math.min(this.riverSamples.length - 1, bi + 4); k++) { const s = this.riverSamples[k].p; const d = (s.x - x) ** 2 + (s.y - z) ** 2; if (d < best) { best = d; bi = k; } }
    const s = this.riverSamples[bi];
    return { d: Math.sqrt(best), level: s.level, width: s.width, k: bi };
  }

  forestMask(x: number, z: number) {
    // forêt à l'ouest de la rivière, qui déborde un peu sur la rive est (l'orée)
    const r = this.riverInfo(x, z);
    const side = x < this.riverCurve.getPointAt(Math.min(1, Math.max(0, (z + 175) / 350))).x ? 1 : 0;
    const edge = fbm(x * 0.018 + 7, z * 0.018 - 3, 3) * 26;
    const west = smooth(-6, 22, (r.d + edge) * (side ? 1 : -1) + (side ? 14 : 6));
    const clearing = smooth(0, 1, (Math.hypot(x - BEACON.x, z - BEACON.y) - 42) / 30);
    return Math.max(0, Math.min(1, west * clearing));
  }

  private generate(): Field {
    const h = new Float32Array(N * N), forest = new Float32Array(N * N), wet = new Float32Array(N * N), grass = new Float32Array(N * N), river = new Float32Array(N * N), water = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -SIZE / 2 + i * CELL, z = -SIZE / 2 + j * CELL;
      // collines douces + croupes, bords qui remontent (la vallée est fermée par des falaises au loin)
      let y = fbm(x * 0.008, z * 0.008, 5) * 9 + ridged(x * 0.012 + 3, z * 0.012 - 7, 4) * 5;
      y += fbm(x * 0.05, z * 0.05, 3) * 0.8;
      const edge = Math.max(Math.abs(x), Math.abs(z)) / (SIZE / 2);
      y += smooth(0.72, 1.0, edge) * 22 * (0.6 + 0.4 * fbm(x * 0.02, z * 0.02, 3));
      // la plaine de la balise est plus douce
      const db = Math.hypot(x - BEACON.x, z - BEACON.y);
      y = lerp(y, y * 0.35 + 2.2, smooth(70, 20, db));
      h[idx(i, j)] = y;
    }
    this.erode(h);
    // lit de la rivière et berges
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -SIZE / 2 + i * CELL, z = -SIZE / 2 + j * CELL;
      const r = this.riverInfo(x, z);
      const k = idx(i, j);
      const half = r.width / 2;
      const bed = r.level - 0.9 - 0.5 * smooth(half, 0, r.d);
      const bank = smooth(half + 14, half - 0.5, r.d);
      h[k] = lerp(h[k], Math.min(h[k], bed + Math.max(0, r.d - half) * 0.55), bank);
      if (r.d < half + 1.5) h[k] = Math.min(h[k], bed + Math.max(0, r.d - half + 1.5) * 0.4);
      river[k] = smooth(half + 6, half - 1, r.d);
      water[k] = r.level;
    }
    // masques
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -SIZE / 2 + i * CELL, z = -SIZE / 2 + j * CELL, k = idx(i, j);
      const fm = this.forestMask(x, z);
      forest[k] = fm;
      const r = this.riverInfo(x, z);
      wet[k] = Math.max(smooth(r.width / 2 + 10, r.width / 2, r.d), 0.25 * smooth(0.2, 0.9, fbm(x * 0.03 - 11, z * 0.03, 3) * 0.5 + 0.5));
      const slope = this.slopeAt(h, i, j);
      grass[k] = Math.max(0, (1 - smooth(0.45, 0.8, slope)) * (1 - fm * 0.85) * (1 - smooth(0.3, 0.8, river[k])) * (0.55 + 0.45 * smooth(-0.2, 0.4, fbm(x * 0.04, z * 0.04 + 5, 3))));
      const db = Math.hypot(x - BEACON.x, z - BEACON.y);
      if (db < 9) grass[k] *= smooth(5, 9, db);
    }
    return { h, forest, wet, grass, river, water };
  }

  private slopeAt(h: Float32Array, i: number, j: number) {
    const a = h[idx(Math.max(0, i - 1), j)], b = h[idx(Math.min(N - 1, i + 1), j)];
    const c = h[idx(i, Math.max(0, j - 1))], d = h[idx(i, Math.min(N - 1, j + 1))];
    return Math.hypot(b - a, d - c) / (2 * CELL);
  }

  /** Érosion hydraulique par gouttes (creuse des ravines, dépose les sédiments). */
  private erode(h: Float32Array) {
    const R = rng(42), drops = 26000;
    const inertia = 0.05, cap = 4, minCap = 0.01, dep = 0.3, ero = 0.3, evap = 0.02, grav = 4, life = 40, rad = 2;
    const brush: { di: number; dj: number; w: number }[] = [];
    let wsum = 0;
    for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) { const d = Math.hypot(di, dj); if (d <= rad) { const w = 1 - d / rad; brush.push({ di, dj, w }); wsum += w; } }
    brush.forEach((b) => (b.w /= wsum));
    const grad = (x: number, y: number) => {
      const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j;
      const a = h[idx(i, j)], b = h[idx(i + 1, j)], c = h[idx(i, j + 1)], d = h[idx(i + 1, j + 1)];
      return { gx: (b - a) * (1 - v) + (d - c) * v, gy: (c - a) * (1 - u) + (d - b) * u, h: a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v };
    };
    for (let n = 0; n < drops; n++) {
      let x = R() * (N - 3) + 1, y = R() * (N - 3) + 1, dx = 0, dy = 0, sp = 1, w = 1, sed = 0;
      for (let l = 0; l < life; l++) {
        const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j;
        const g = grad(x, y);
        dx = dx * inertia - g.gx * (1 - inertia); dy = dy * inertia - g.gy * (1 - inertia);
        const len = Math.hypot(dx, dy); if (len < 1e-6) break;
        dx /= len; dy /= len; x += dx; y += dy;
        if (x < 1 || y < 1 || x >= N - 2 || y >= N - 2) break;
        const nh = grad(x, y).h, dh = nh - g.h;
        const c = Math.max(-dh * sp * w * cap, minCap);
        if (sed > c || dh > 0) {
          const amt = dh > 0 ? Math.min(dh, sed) : (sed - c) * dep;
          sed -= amt;
          h[idx(i, j)] += amt * (1 - u) * (1 - v); h[idx(i + 1, j)] += amt * u * (1 - v); h[idx(i, j + 1)] += amt * (1 - u) * v; h[idx(i + 1, j + 1)] += amt * u * v;
        } else {
          const amt = Math.min((c - sed) * ero, -dh);
          for (const b of brush) { const ii = i + b.di, jj = j + b.dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue; const k = idx(ii, jj); const e = Math.min(h[k], amt * b.w); h[k] -= amt * b.w; sed += amt * b.w; void e; }
        }
        sp = Math.sqrt(Math.max(0, sp * sp + dh * grav)); w *= 1 - evap;
      }
    }
  }

  /** Hauteur du sol (interpolée). */
  heightAt(x: number, z: number) {
    const gx = Math.max(0, Math.min(N - 1.001, toGrid(x))), gz = Math.max(0, Math.min(N - 1.001, toGrid(z)));
    const i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j, h = this.f.h;
    return h[idx(i, j)] * (1 - u) * (1 - v) + h[idx(i + 1, j)] * u * (1 - v) + h[idx(i, j + 1)] * (1 - u) * v + h[idx(i + 1, j + 1)] * u * v;
  }
  sample(arr: Float32Array, x: number, z: number) {
    const i = Math.round(Math.max(0, Math.min(N - 1, toGrid(x)))), j = Math.round(Math.max(0, Math.min(N - 1, toGrid(z))));
    return arr[idx(i, j)];
  }
  normalAt(x: number, z: number) {
    const e = 0.6;
    return new THREE.Vector3(this.heightAt(x - e, z) - this.heightAt(x + e, z), 2 * e, this.heightAt(x, z - e) - this.heightAt(x, z + e)).normalize();
  }
  waterLevelAt(x: number, z: number) { const r = this.riverInfo(x, z); return r.d < r.width / 2 + 1 ? r.level : -Infinity; }

  // ---------- rendu ----------
  build(res: '1k' | '2k', uniforms: Record<string, THREE.IUniform>) {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, N - 1, N - 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const mask = new Float32Array(pos.count * 4);
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), z = pos.getZ(v);
      const i = Math.round(toGrid(x)), j = Math.round(toGrid(z)), k = idx(i, j);
      pos.setY(v, this.f.h[k]);
      mask.set([this.f.forest[k], this.f.wet[k], this.f.grass[k], this.f.river[k]], v * 4);
    }
    g.setAttribute('aMask', new THREE.BufferAttribute(mask, 4));
    g.computeVertexNormals();
    const mat = terrainMaterial(res, uniforms);
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.receiveShadow = true; this.mesh.castShadow = false;
    this.mesh.name = 'terrain';
    // anneau lointain : falaises et montagnes qui ferment l'horizon
    this.far = farRing(this, mat);
    // texture de données (hauteur, herbe, forêt, humidité) pour l'herbe et l'eau
    const data = new Uint16Array(N * N * 4);
    for (let k = 0; k < N * N; k++) data.set([THREE.DataUtils.toHalfFloat(this.f.h[k]), THREE.DataUtils.toHalfFloat(this.f.grass[k]), THREE.DataUtils.toHalfFloat(this.f.forest[k]), THREE.DataUtils.toHalfFloat(this.f.wet[k])], k * 4);
    this.dataTex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.HalfFloatType);
    this.dataTex.magFilter = THREE.LinearFilter; this.dataTex.minFilter = THREE.LinearFilter; this.dataTex.needsUpdate = true;
    return this.mesh;
  }
}

function farRing(t: Terrain, mat: THREE.Material) {
  // grille polaire de SIZE/2 à 1400 m, raccordée au bord de la tranche
  const rings = 34, segs = 160;
  const pos: number[] = [], ind: number[] = [], mask: number[] = [];
  for (let r = 0; r <= rings; r++) {
    const k = r / rings;
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      // rayon du carré de la tranche dans cette direction
      const sq = (SIZE / 2 - 2) / Math.max(Math.abs(ca), Math.abs(sa));
      const rad = lerp(sq, 1400, Math.pow(k, 1.6));
      const x = ca * rad, z = sa * rad;
      let y: number;
      if (r === 0) y = t.heightAt(x, z) - 0.05;
      else {
        const m = Math.pow(k, 0.7);
        const north = smooth(0.2, -0.9, sa) * 0.7 + 0.3; // falaises plus hautes au nord
        y = t.heightAt(ca * sq, sa * sq) + m * (60 + 220 * north) * (0.55 + 0.45 * ridged(x * 0.004 + 2, z * 0.004, 5)) + fbm(x * 0.01, z * 0.01, 3) * 12 * m;
      }
      pos.push(x, y, z); mask.push(0.1, 0.1, 0, 0);
    }
  }
  for (let r = 0; r < rings; r++) for (let s = 0; s < segs; s++) { const a = r * (segs + 1) + s, b = a + segs + 1; ind.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aMask', new THREE.Float32BufferAttribute(mask, 4));
  g.setIndex(ind); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true;
  return m;
}

/** Matériau du sol : herbe, litière de forêt, roche (triplanaire), sable et mousse, selon pente, forêt et humidité. */
function terrainMaterial(res: '1k' | '2k', uniforms: Record<string, THREE.IUniform>) {
  const grass = pbr('forest_ground_04', res), leaves = pbr('forest_leaves_02', res), rock = pbr('cliff_side', res), sand = pbr('coast_sand_01', res);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  // une carte « factice » force l'inclusion des UV / normal map dans le shader standard
  mat.normalMap = grass.normalMap;
  const tx = { tGrass: grass.map, tGrassN: grass.normalMap, tLeaf: leaves.map, tLeafN: leaves.normalMap, tRock: rock.map, tRockN: rock.normalMap, tSand: sand.map, tSandN: sand.normalMap };
  for (const t of Object.values(tx)) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1); }
  mat.onBeforeCompile = (sh) => {
    for (const [k, v] of Object.entries(tx)) sh.uniforms[k] = { value: v };
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aMask;\nvarying vec4 vMask;\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMask = aMask;\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;\nvWNorm = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tGrass, tGrassN, tLeaf, tLeafN, tRock, tRockN, tSand, tSandN;
uniform float uWet;
varying vec4 vMask; varying vec3 vWPos; varying vec3 vWNorm;
float th(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float tn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(th(i),th(i+vec2(1,0)),f.x), mix(th(i+vec2(0,1)),th(i+vec2(1,1)),f.x), f.y); }
vec3 triN(sampler2D t, vec3 p, vec3 n, vec3 w, float s){
  vec3 nx = texture2D(t, p.zy * s).xyz * 2.0 - 1.0, ny = texture2D(t, p.xz * s).xyz * 2.0 - 1.0, nz = texture2D(t, p.xy * s).xyz * 2.0 - 1.0;
  nx = vec3(nx.xy + n.zy, abs(nx.z) * n.x); ny = vec3(ny.xy + n.xz, abs(ny.z) * n.y); nz = vec3(nz.xy + n.xy, abs(nz.z) * n.z);
  return normalize(nx.zyx * w.x + ny.xzy * w.y + nz.xyz * w.z);
}
vec3 gBlendN; float gRough;`)
      .replace('#include <map_fragment>', `
vec3 wn = normalize(vWNorm);
float slope = 1.0 - wn.y;
vec2 uv = vWPos.xz;
float macro = tn(uv * 0.02) * 0.6 + tn(uv * 0.11) * 0.4;
// herbe à deux échelles pour casser la répétition
vec3 cG = mix(texture2D(tGrass, uv * 0.22).rgb, texture2D(tGrass, uv * 0.047).rgb, 0.45);
cG *= mix(vec3(0.72, 0.95, 0.88), vec3(0.95, 1.0, 0.82), macro); // teinte extraterrestre, légèrement bleutée
vec3 cL = texture2D(tLeaf, uv * 0.25).rgb * vec3(0.85, 0.78, 0.9);
vec3 cS = texture2D(tSand, uv * 0.2).rgb * vec3(0.8, 0.8, 0.78);
vec3 aw = pow(abs(wn), vec3(4.0)); aw /= dot(aw, vec3(1.0));
vec3 cR = (texture2D(tRock, vWPos.zy * 0.08).rgb * aw.x + texture2D(tRock, vWPos.xz * 0.08).rgb * aw.y + texture2D(tRock, vWPos.xy * 0.08).rgb * aw.z);
cR = mix(vec3(dot(cR, vec3(0.3, 0.5, 0.2))), cR, 0.35) * vec3(0.72, 0.74, 0.82);
float fRock = smoothstep(0.32, 0.55, slope + (macro - 0.5) * 0.12);
float fLeaf = smoothstep(0.25, 0.75, vMask.x + (macro - 0.5) * 0.3);
float fGrass = smoothstep(0.1, 0.6, vMask.z) * (1.0 - fLeaf);
float fSand = smoothstep(0.35, 0.8, vMask.w) * (1.0 - fRock);
vec3 col = mix(cG, cL, fLeaf);
// sous l'herbe : terre couverte d'un tapis vert sombre
col = mix(col, col * vec3(0.3, 0.52, 0.34) + vec3(0.0, 0.01, 0.005), fGrass * 0.9);
col = mix(col, cS, fSand);
col = mix(col, cR, fRock);
// humidité : sol plus sombre et plus brillant
float wet = clamp(vMask.y * 0.8 + uWet, 0.0, 1.0) * (1.0 - fRock * 0.5);
col *= mix(1.0, 0.62, wet);
diffuseColor.rgb *= col;
vec3 nG = normalize(texture2D(tGrassN, uv * 0.22).xyz * 2.0 - 1.0);
vec3 nL = normalize(texture2D(tLeafN, uv * 0.25).xyz * 2.0 - 1.0);
vec3 nS = normalize(texture2D(tSandN, uv * 0.2).xyz * 2.0 - 1.0);
vec3 nT = normalize(mix(mix(mix(nG, nL, fLeaf), nS, fSand), vec3(0,0,1), wet * 0.4));
// tangente-espace (plan horizontal) → monde, puis mélange avec la roche triplanaire
vec3 nWorldFlat = normalize(vec3(nT.x, 0.0, -nT.y) * 0.9 + wn * nT.z);
vec3 nWorldRock = triN(tRockN, vWPos * 0.08, wn, aw, 1.0);
gBlendN = normalize(mix(nWorldFlat, nWorldRock, fRock));
gRough = mix(mix(0.93, 0.88, fLeaf), 0.82, fRock) - wet * 0.55;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(gRough, 0.08, 1.0);')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(gBlendN, 0.0)).xyz);');
  };
  mat.customProgramCacheKey = () => 'terrain';
  return mat;
}
