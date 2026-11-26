import * as THREE from 'three';

// Matières des statues vivantes : acier brossé (humains), cuivre gravé et patiné (Vaëls),
// or lumineux (souvenirs). Tout est calculé dans le shader, sans texture : usure des arêtes,
// patine dans les creux, martelage, vêtements sculptés avec plis, gravures lumineuses.

export interface MetalOptions {
  color: THREE.ColorRepresentation;  // teinte du métal nu
  rough: number;                     // rugosité de base
  aniso?: number;                    // brossage (0 = poli)
  wear?: number;                     // arêtes polies par l'usure
  patina?: THREE.ColorRepresentation;
  patinaAmt?: number;                // patine dans les creux et par plaques
  patinaScale?: number;
  hammer?: number;                   // martelage
  bump?: number;                     // force du relief
  cloth?: { color: THREE.ColorRepresentation; rough: number; metal?: number }[]; // jusqu'à 4 finitions de vêtements
  clothThick?: number;               // m par unité de l'attribut aCloth.x (mm par défaut)
  fold?: number;                     // plis sculptés
  engrave?: 0 | 1 | 2 | 3;           // motif gravé lumineux (Racines, Hauteurs, Eaux, Nomades)
  engraveScale?: number;
  gold?: 0 | 1 | 2;                  // souvenir : or plein, filigrane, poussière
  height?: number;                   // taille du personnage (apparition, motifs)
  clearcoat?: number;
}

export interface MetalUniforms {
  uTime: { value: number }; uGlowCol: { value: THREE.Color }; uGlow: { value: number }; uGlowSpeed: { value: number };
  uAppear: { value: number }; uHeight: { value: number }; uWet: { value: number };
}

const NOISE = /* glsl */`
float mh1(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float mn3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(mh1(i),mh1(i+vec3(1,0,0)),f.x),mix(mh1(i+vec3(0,1,0)),mh1(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(mh1(i+vec3(0,0,1)),mh1(i+vec3(1,0,1)),f.x),mix(mh1(i+vec3(0,1,1)),mh1(i+vec3(1,1,1)),f.x),f.y),f.z); }
float mfb(vec3 p){ return mn3(p)*0.55 + mn3(p*2.03+7.1)*0.3 + mn3(p*4.1+3.3)*0.15; }
float ridge(vec3 p){ return 1.0 - abs(mn3(p)*2.0-1.0); }
`;

export function metalMaterial(o: MetalOptions) {
  const cloth = (o.cloth ?? [{ color: 0x555555, rough: 0.6 }]).concat([]);
  while (cloth.length < 4) cloth.push(cloth[cloth.length - 1]);
  const gold = o.gold !== undefined;
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 1, roughness: o.rough,
    anisotropy: o.aniso ?? 0, anisotropyRotation: 0,
    clearcoat: o.clearcoat ?? 0, clearcoatRoughness: 0.2,
    transparent: o.gold === 1, side: THREE.FrontSide,
  });
  const u: MetalUniforms & Record<string, { value: unknown }> = {
    uTime: { value: 0 }, uGlowCol: { value: new THREE.Color(0.2, 0.7, 1.8) }, uGlow: { value: 1 }, uGlowSpeed: { value: 1 },
    uAppear: { value: 1 }, uHeight: { value: o.height ?? 1.75 }, uWet: { value: 0 },
    uMetal: { value: new THREE.Color(o.color) }, uRough: { value: o.rough }, uWear: { value: o.wear ?? 0.5 },
    uPatina: { value: new THREE.Color(o.patina ?? 0x333333) }, uPatinaAmt: { value: o.patinaAmt ?? 0 }, uPatinaScale: { value: o.patinaScale ?? 5 },
    uHammer: { value: o.hammer ?? 0 }, uBump: { value: o.bump ?? 1 },
    uClothCol: { value: cloth.map((c) => new THREE.Color(c.color)) }, uClothRough: { value: new THREE.Vector4(...cloth.map((c) => c.rough)) },
    uClothMetal: { value: new THREE.Vector4(...cloth.map((c) => c.metal ?? 1)) },
    uClothThick: { value: o.clothThick ?? 0.001 }, uFoldGeo: { value: o.fold ?? 1 }, uFold: { value: o.fold ?? 1 }, uEngScale: { value: o.engraveScale ?? 1 },
  };
  m.userData.metal = u;
  m.defines = { ...(m.defines ?? {}) };
  if (o.engrave !== undefined) m.defines.ENGRAVE = o.engrave;
  if (gold) m.defines.GOLD = o.gold;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aCurv; attribute vec2 aCloth;
varying vec3 vRest; varying float vCurv; varying vec2 vCloth;
uniform float uClothThick, uFoldGeo;
${NOISE}`)
      .replace('#include <morphnormal_vertex>', `#include <morphnormal_vertex>
vec3 restN = objectNormal;`)
      .replace('#include <morphtarget_vertex>', `#include <morphtarget_vertex>
vRest = transformed; vCurv = aCurv; vCloth = aCloth;
if (aCloth.x > 0.0) {
  // volume du vêtement : plis réels dans la forme (drapé + froissures), pas pour barbe et cheveux
  float fg = aCloth.y > 2.5 ? 0.5 : ridge(vRest*vec3(20.0, 4.5, 20.0) + vec3(0.0, mn3(vRest*3.0)*2.0, 0.0)) * 0.6 + ridge(vRest*vec3(6.0, 24.0, 6.0) + mn3(vRest*5.0)*1.5) * 0.55;
  transformed += restN * aCloth.x * uClothThick * (0.5 + fg * uFoldGeo);
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vRest; varying float vCurv; varying vec2 vCloth;
uniform float uTime, uGlow, uGlowSpeed, uAppear, uHeight, uWet, uRough, uWear, uPatinaAmt, uPatinaScale, uHammer, uBump, uFold, uEngScale;
uniform vec3 uGlowCol, uMetal, uPatina, uClothCol[4];
uniform vec4 uClothRough, uClothMetal;
${NOISE}`)
      .replace('#include <roughnessmap_fragment>', `
vec3 P = vRest;
vec3 baseCol = uMetal; float rough = uRough; float metalK = 1.0; float hgt = 0.0; vec3 engEmit = vec3(0.0);
float isCloth = step(0.01, vCloth.x);
// brossage fin et martelage
float scr = mn3(vec3(P.x*900.0, P.y*5.0, P.z*900.0));
rough += (scr - 0.5) * 0.1;
float hn = mn3(P*60.0); hgt += uHammer * hn * hn * 0.6;
if (isCloth > 0.5) {
  int id = int(vCloth.y + 0.5);
  vec3 cc = uClothCol[0]; float cr = uClothRough.x, cm = uClothMetal.x;
  if (id == 1) { cc = uClothCol[1]; cr = uClothRough.y; cm = uClothMetal.y; }
  else if (id == 2) { cc = uClothCol[2]; cr = uClothRough.z; cm = uClothMetal.z; }
  else if (id == 3) { cc = uClothCol[3]; cr = uClothRough.w; cm = uClothMetal.w; }
  baseCol = cc; rough = cr + (mn3(P*300.0) - 0.5) * 0.12; metalK = cm;
  // plis sculptés : drapé vertical + froissures horizontales
  float drape = ridge(P*vec3(26.0, 4.0, 26.0) + vec3(0.0, mn3(P*3.0)*2.0, 0.0));
  float crumple = ridge(P*vec3(7.0, 38.0, 7.0) + mn3(P*6.0)*1.5);
  if (id == 3) hgt += ridge(P*vec3(260.0, 22.0, 260.0) + mn3(P*40.0)) * 1.3; // barbe et sourcils : fines mèches sculptées
  else hgt += uFold * (drape * 0.55 + crumple * 0.45) * 1.4;
  // coutures
  float seam = 1.0 - smoothstep(0.0, 0.004, abs(fract(P.y*7.0 + mn3(P*2.0)*0.3) - 0.5) - 0.495);
  hgt -= seam * 0.3;
}
// usure : arêtes polies, creux sombres et patinés
float cv = clamp(vCurv, -1.0, 1.0);
float edge = max(cv, 0.0), cav = max(-cv, 0.0);
baseCol *= 1.0 + edge * uWear * 0.5 - cav * 0.35;
rough = mix(rough, rough * 0.45, edge * uWear);
float pn = mfb(P * uPatinaScale);
float pt = smoothstep(0.42, 0.8, pn * 0.75 + cav * 1.1 - edge * 0.4) * uPatinaAmt;
baseCol = mix(baseCol, uPatina, pt); rough = mix(rough, 0.82, pt); metalK = mix(metalK, 0.1, pt);
hgt += pt * 0.25;
#ifdef ENGRAVE
{
  vec3 Q = P * uEngScale;
  float g = 0.0;
  #if ENGRAVE == 0
    float v = ridge(Q*vec3(3.2, 2.2, 3.2) + mn3(Q*1.3)*1.2);
    g = smoothstep(0.9, 0.965, v);
  #elif ENGRAVE == 1
    float q = fract(Q.y*7.0 + abs(Q.x)*9.0 + floor(Q.z*3.0)*0.5);
    g = smoothstep(0.468, 0.486, abs(q - 0.5));
    g *= step(0.35, mn3(Q*2.5));
  #elif ENGRAVE == 2
    float q = fract(Q.y*6.0 + sin(Q.x*14.0 + Q.z*11.0)*0.45 + mn3(Q*2.0)*0.5);
    g = smoothstep(0.468, 0.486, abs(q - 0.5));
  #else
    float a = atan(Q.z, Q.x);
    float q = fract(Q.y*5.0 + a*0.6366 + mn3(Q*1.7)*0.6);
    g = smoothstep(0.468, 0.486, abs(q - 0.5));
    g *= step(0.3, mn3(Q*1.4 + 4.0));
  #endif
  g *= (1.0 - isCloth) * smoothstep(0.25, 0.5, mn3(Q*1.1 + 9.0) + 0.2);
  baseCol *= 1.0 - g * 0.55; hgt -= g * 0.9;
  float wave = 0.7 + 0.3 * sin(uTime * 2.2 * uGlowSpeed - P.y * 9.0);
  engEmit = uGlowCol * g * uGlow * wave;
}
#endif
#ifdef GOLD
{
  float th = vRest.y / uHeight * 0.85 + mn3(vRest*14.0) * 0.15;
  float e = uAppear * 1.2 - th;
  if (e < 0.0) discard;
  engEmit += vec3(2.4, 1.6, 0.6) * (1.0 - smoothstep(0.0, 0.05, e)) * 3.0;
  #if GOLD == 2
    vec3 cell = floor(vRest * 140.0);
    float r = mh1(cell);
    if (r > 0.55 + 0.35 * sin(uTime * 1.5 + r * 40.0 + vRest.y * 6.0)) discard;
    engEmit += vec3(1.8, 1.2, 0.45) * step(0.985, mh1(cell + floor(uTime * 6.0))) * 2.0;
  #endif
}
#endif
// pluie et mouillé : surface plus lisse et plus sombre
baseCol *= 1.0 - uWet * 0.25; rough = mix(rough, 0.08, uWet * 0.8);
diffuseColor.rgb = baseCol;
float roughnessFactor = clamp(rough, 0.04, 1.0);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor *= metalK;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
  float dhx = dFdx(hgt), dhy = dFdy(hgt);
  vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  normal = normalize(abs(det) * normal - grad * uBump * 0.0012);
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += engEmit;
#ifdef GOLD
{
  float fr = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);
  totalEmissiveRadiance += uMetal * (0.18 + fr * 1.1);
  #if GOLD == 1
    float scan = 0.6 + 0.4 * step(0.5, fract(vRest.y * 90.0 - uTime * 0.8));
    diffuseColor.a = mix(0.16, 0.95, fr) * scan;
    totalEmissiveRadiance += uMetal * fr * 0.8;
  #endif
}
#endif`);
  };
  m.customProgramCacheKey = () => 'metal-v1-' + JSON.stringify(m.defines);
  return m;
}

/** Ajoute à une géométrie quelconque (accessoires) les attributs attendus par la matière. */
export function prepGeo(g: THREE.BufferGeometry, cloth = 0, id = 0) {
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (!g.attributes.aCurv) g.setAttribute('aCurv', new THREE.BufferAttribute(new Float32Array(n), 1));
  if (!g.attributes.aCloth) { const a = new Float32Array(n * 2); for (let i = 0; i < n; i++) { a[i * 2] = cloth; a[i * 2 + 1] = id; } g.setAttribute('aCloth', new THREE.BufferAttribute(a, 2)); }
  if (!g.attributes.tangent) {
    const N = g.attributes.normal, t = new Float32Array(n * 4), v = new THREE.Vector3(), up = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(N, i);
      up.set(0, 1, 0); if (Math.abs(v.y) > 0.9) up.set(1, 0, 0);
      up.sub(v.clone().multiplyScalar(up.dot(v))).normalize();
      t[i * 4] = up.x; t[i * 4 + 1] = up.y; t[i * 4 + 2] = up.z; t[i * 4 + 3] = 1;
    }
    g.setAttribute('tangent', new THREE.BufferAttribute(t, 4));
  }
  return g;
}

// ---------- palettes ----------
export const CLANS = {
  racines: { name: 'Racines', color: 0xc9774a, patina: 0x4f9c86, patinaAmt: 0.85, rough: 0.42, glow: 0 as const },
  hauteurs: { name: 'Hauteurs', color: 0x9c3d26, patina: 0x3a1610, patinaAmt: 0.5, rough: 0.38, glow: 1 as const },
  eaux: { name: 'Eaux', color: 0xd99a7c, patina: 0x6f8fb0, patinaAmt: 0.25, rough: 0.16, glow: 2 as const },
  nomades: { name: 'Nomades', color: 0x6a4a2a, patina: 0x1d1a14, patinaAmt: 0.55, rough: 0.34, glow: 3 as const },
};
export type ClanId = keyof typeof CLANS;
