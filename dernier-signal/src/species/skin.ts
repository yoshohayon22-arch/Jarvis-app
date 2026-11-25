import * as THREE from 'three';

// Peau des créatures : matériau physique (reflet doux, voile de lumière sur les bords)
// + micro-relief et variations de teinte calculés dans le shader
// + motifs bioluminescents qui ondulent et changent de couleur avec l'émotion.

export type Pattern = 'veines' | 'taches' | 'rayures' | 'spirales';
const PAT: Record<Pattern, number> = { veines: 0, taches: 1, rayures: 2, spirales: 3 };

export interface SkinOptions {
  color: THREE.ColorRepresentation;   // teinte de base
  color2?: THREE.ColorRepresentation; // teinte des zones sombres (dos, extrémités)
  rough?: number;
  sheen?: THREE.ColorRepresentation;  // voile sur les bords (duvet, peau fine)
  wet?: number;                       // brillance humide (0-1)
  pattern: Pattern;
  scale?: number;                     // densité des motifs
  bump?: number;                      // relief de la peau
  scales?: number;                    // écailles (0-1)
}

const NOISE = /* glsl */ `
float sk_h(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float sk_n(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(sk_h(i), sk_h(i + vec3(1,0,0)), f.x), mix(sk_h(i + vec3(0,1,0)), sk_h(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(sk_h(i + vec3(0,0,1)), sk_h(i + vec3(1,0,1)), f.x), mix(sk_h(i + vec3(0,1,1)), sk_h(i + vec3(1,1,1)), f.x), f.y), f.z); }
float sk_fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * sk_n(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
vec2 sk_cell(vec3 p){ vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 o = vec3(x, y, z); vec3 r = o + vec3(sk_h(i + o), sk_h(i + o + 7.1), sk_h(i + o + 13.7)) - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return vec2(sqrt(d1), sqrt(d2)); }
`;

export function makeSkin(o: SkinOptions) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: o.color, roughness: o.rough ?? 0.55, metalness: 0,
    sheen: 0.6, sheenColor: new THREE.Color(o.sheen ?? 0x8090a0), sheenRoughness: 0.5,
    clearcoat: o.wet ?? 0, clearcoatRoughness: 0.35,
  });
  const u = {
    uGlowCol: { value: new THREE.Color(0.25, 0.75, 1.6) },
    uGlow: { value: 1 },
    uTime: { value: 0 },
    uPattern: { value: PAT[o.pattern] },
    uPScale: { value: o.scale ?? 1 },
    uBump: { value: o.bump ?? 1 },
    uScales: { value: o.scales ?? 0 },
    uDark: { value: new THREE.Color(o.color2 ?? o.color) },
  };
  mat.userData.skin = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying vec3 vRest;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;\nvGlow = aGlow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vRest; varying float vGlow;
uniform vec3 uGlowCol, uDark; uniform float uGlow, uTime, uPattern, uPScale, uBump, uScales;
${NOISE}
float sk_pattern(vec3 p){
  p *= uPScale;
  if (uPattern < 0.5) { // veines : fines lignes ramifiées
    float n = sk_fbm(p * 3.2); float n2 = sk_fbm(p * 7.0 + 3.0);
    return smoothstep(0.022, 0.0, abs(n - 0.5)) + 0.5 * smoothstep(0.012, 0.0, abs(n2 - 0.5)) * step(0.45, n);
  }
  if (uPattern < 1.5) { // taches : constellations de points de tailles variées
    vec2 c = sk_cell(p * 9.0); vec2 c2 = sk_cell(p * 22.0 + 4.0);
    return smoothstep(0.22, 0.12, c.x) * step(0.35, sk_n(p * 4.0)) + 0.7 * smoothstep(0.16, 0.06, c2.x) * step(0.55, sk_n(p * 6.0 + 2.0));
  }
  if (uPattern < 2.5) { // rayures : bandes sinueuses autour du corps
    float w = sin(p.y * 26.0 + sk_fbm(p * 2.5) * 9.0 + p.x * 4.0);
    return smoothstep(0.86, 0.98, w) * (0.6 + 0.4 * sk_n(p * 5.0));
  }
  // spirales : anneaux concentriques autour de centres épars
  vec2 c = sk_cell(p * 4.0);
  float r = c.x * 26.0;
  return smoothstep(0.75, 1.0, sin(r)) * smoothstep(0.55, 0.2, c.x) * smoothstep(0.02, 0.12, c.x);
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
float skFw = length(fwidth(vRest));
#define SK_AA(f) clamp(1.0 - skFw * (f) * 2.0, 0.0, 1.0)
float skN = sk_fbm(vRest * 9.0);
// teinte : zones plus sombres sur le dos et marbrures
diffuseColor.rgb = mix(diffuseColor.rgb, uDark, smoothstep(0.35, 0.75, skN) * 0.65);
diffuseColor.rgb *= 0.9 + 0.2 * mix(0.5, sk_n(vRest * 38.0), SK_AA(38.0));
vec2 skC = sk_cell(vRest * 60.0);
float skScale = uScales * SK_AA(60.0) * smoothstep(0.0, 0.18, skC.y - skC.x);
diffuseColor.rgb *= 1.0 - uScales * SK_AA(60.0) * 0.18 * (1.0 - smoothstep(0.0, 0.2, skC.y - skC.x));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor * (0.85 + 0.35 * mix(0.5, sk_n(vRest * 25.0), SK_AA(25.0))), 0.08, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ // micro-relief : pores, plis, écailles
  float hgt = (sk_fbm(vRest * 70.0) * 0.6 * SK_AA(70.0) + sk_n(vRest * 210.0) * 0.25 * SK_AA(210.0)) * uBump + skScale * 0.9;
  vec3 sP = -vViewPosition; vec3 sX = dFdx(sP), sY = dFdy(sP);
  vec3 R1 = cross(sY, normal), R2 = cross(normal, sX);
  float det = dot(sX, R1) * faceDirection;
  vec2 dH = vec2(dFdx(hgt), dFdy(hgt)) * 0.0035;
  vec3 grad = sign(det) * (dH.x * R1 + dH.y * R2);
  normal = normalize(abs(det) * normal - grad);
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  float pat = sk_pattern(vRest) * smoothstep(0.08, 0.6, vGlow);
  float wave = 0.55 + 0.45 * sin(uTime * 2.2 - vRest.y * 5.0 + sk_n(vRest * 3.0) * 6.0);
  totalEmissiveRadiance += uGlowCol * pat * wave * uGlow * 1.7;
  totalEmissiveRadiance += uGlowCol * pat * 0.25 * uGlow; // halo sous la peau
}`);
  };
  return mat;
}

/** Œil : globe brillant + iris lumineux. */
export function makeEye(radius: number, iris: THREE.ColorRepresentation, glow = 0.6) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02 }));
  g.add(ball);
  const irisMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(iris).multiplyScalar(glow) });
  const ir = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.55, 24), irisMat);
  ir.position.z = radius * 0.985; g.add(ir);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.22, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  pupil.position.z = radius * 0.99; g.add(pupil);
  g.userData.iris = irisMat;
  return g;
}
