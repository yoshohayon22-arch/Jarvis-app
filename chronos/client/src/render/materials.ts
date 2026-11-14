import * as THREE from "three";
import { ASSET_ROOT } from "./assets";

/**
 * "Stylized-realistic" surface detail for flat-shaded asset packs.
 *
 * KayKit models are painted with flat color gradients. This patch keeps their
 * colors but adds, in the shader:
 *  - tileable detail normal maps applied triplanar in world space, picked per
 *    pixel from the albedo (grey → stone, warm/brown → wood, green → foliage);
 *  - multi-scale albedo and roughness variation (no two bricks alike);
 *  - grime darkening near the ground.
 * Everything is CC0 (normal maps from @pmndrs/assets, see tools/import-pmndrs.mjs).
 */

export interface DetailTextures {
  stone: THREE.Texture;
  wood: THREE.Texture;
  foliage: THREE.Texture;
  cobble: THREE.Texture;
  ground: THREE.Texture;
  soil: THREE.Texture;
}

export async function loadDetailTextures(manager?: THREE.LoadingManager): Promise<DetailTextures> {
  const loader = new THREE.TextureLoader(manager);
  const load = async (name: string) => {
    const t = await loader.loadAsync(`${ASSET_ROOT}pmndrs/normals/${name}.webp`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const [stone, wood, foliage, cobble, ground, soil] = await Promise.all(
    ["stone", "wood", "bark", "pebbles", "ground", "soil"].map(load),
  );
  return { stone: stone!, wood: wood!, foliage: foliage!, cobble: cobble!, ground: ground!, soil: soil! };
}

const COMMON_GLSL = /* glsl */ `
varying vec3 vDetailWorldPos;
varying vec3 vDetailWorldNormal;

float dHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float dNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dHash(i), dHash(i + vec3(1, 0, 0)), f.x), mix(dHash(i + vec3(0, 1, 0)), dHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(dHash(i + vec3(0, 0, 1)), dHash(i + vec3(1, 0, 1)), f.x), mix(dHash(i + vec3(0, 1, 1)), dHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// Triplanar normal mapping with whiteout blending (world space in, world space out).
vec3 triplanarNormal(sampler2D tex, vec3 p, vec3 n, float scale) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= (w.x + w.y + w.z);
  vec3 tx = texture2D(tex, p.zy * scale).xyz * 2.0 - 1.0;
  vec3 ty = texture2D(tex, p.xz * scale).xyz * 2.0 - 1.0;
  vec3 tz = texture2D(tex, p.xy * scale).xyz * 2.0 - 1.0;
  tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
  ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
  tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
  return normalize(tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z);
}
`;

const VERTEX_WORLD = /* glsl */ `
#include <worldpos_vertex>
{
  vec4 dWorld = vec4(transformed, 1.0);
  vec3 dN = objectNormal;
  #ifdef USE_BATCHING
    dWorld = batchingMatrix * dWorld;
    dN = mat3(batchingMatrix) * dN;
  #endif
  #ifdef USE_INSTANCING
    dWorld = instanceMatrix * dWorld;
    dN = mat3(instanceMatrix) * dN;
  #endif
  dWorld = modelMatrix * dWorld;
  vDetailWorldPos = dWorld.xyz;
  vDetailWorldNormal = normalize(mat3(modelMatrix) * dN);
}
`;

const APPLY_DETAIL_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
{
  vec3 dWN = normalize(vDetailWorldNormal);
  vec3 dPerturbed = normalize(mix(dWN, detailWorldNormal, uDetailStrength));
  normal = normalize(normal + (viewMatrix * vec4(dPerturbed - dWN, 0.0)).xyz);
}
`;

export interface DetailOptions {
  /** World-space tiling (repeats per meter). */
  scale: number;
  /** 0..1 strength of the detail normal. */
  strength: number;
}

/** Patches a MeshStandardMaterial of a model (buildings, props, nature, characters). */
export function enhanceModelMaterial(mat: THREE.MeshStandardMaterial, tex: DetailTextures, opts: DetailOptions): void {
  if (mat.userData.detailEnhanced) return;
  mat.userData.detailEnhanced = true;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDetailStone = { value: tex.stone };
    shader.uniforms.uDetailWood = { value: tex.wood };
    shader.uniforms.uDetailFoliage = { value: tex.foliage };
    shader.uniforms.uDetailScale = { value: opts.scale };
    shader.uniforms.uDetailStrength = { value: opts.strength };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vDetailWorldPos;\nvarying vec3 vDetailWorldNormal;`)
      .replace("#include <worldpos_vertex>", VERTEX_WORLD);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nuniform sampler2D uDetailStone;\nuniform sampler2D uDetailWood;\nuniform sampler2D uDetailFoliage;\nuniform float uDetailScale;\nuniform float uDetailStrength;\n${COMMON_GLSL}`,
      )
      .replace(
        "#include <map_fragment>",
        /* glsl */ `#include <map_fragment>
  vec3 dAlb = diffuseColor.rgb;
  float dMax = max(dAlb.r, max(dAlb.g, dAlb.b));
  float dSat = dMax > 0.0001 ? (dMax - min(dAlb.r, min(dAlb.g, dAlb.b))) / dMax : 0.0;
  float dGreen = smoothstep(0.0, 0.08, dAlb.g - max(dAlb.r, dAlb.b));
  float dWarm = smoothstep(0.0, 0.06, dAlb.r - dAlb.b) * (1.0 - dGreen);
  vec3 dW = vec3((1.0 - dSat) * (1.0 - dGreen), dSat * dWarm, dGreen) + 0.001;
  dW /= (dW.x + dW.y + dW.z);
  float dN1 = dNoise(vDetailWorldPos * 0.8);
  float dN2 = dNoise(vDetailWorldPos * 3.7);
  diffuseColor.rgb *= 0.84 + 0.2 * dN1 + 0.1 * dN2;
  // Grime and moisture near the ground.
  diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.0, 1.4, vDetailWorldPos.y));`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>\n  roughnessFactor = clamp(roughnessFactor * (0.82 + 0.3 * dN2) - 0.12 * dW.x, 0.3, 1.0);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `vec3 detailWorldNormal;
{
  vec3 dWN0 = normalize(vDetailWorldNormal);
  vec3 nS = triplanarNormal(uDetailStone, vDetailWorldPos, dWN0, uDetailScale);
  vec3 nW = triplanarNormal(uDetailWood, vDetailWorldPos, dWN0, uDetailScale * 1.7);
  vec3 nF = triplanarNormal(uDetailFoliage, vDetailWorldPos, dWN0, uDetailScale * 2.2);
  detailWorldNormal = normalize(nS * dW.x + nW * dW.y + nF * dW.z);
}
${APPLY_DETAIL_NORMAL}`,
      );
  };
  mat.customProgramCacheKey = () => "chronos-detail-model";
  mat.needsUpdate = true;
}

/**
 * Terrain material: vertex colors + per-vertex surface weights (grass, earth, paving)
 * select the detail normal map and the micro-variation of albedo.
 */
export function createTerrainMaterial(tex: DetailTextures | null): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  if (!tex) return mat;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGround = { value: tex.ground };
    shader.uniforms.uSoil = { value: tex.soil };
    shader.uniforms.uCobble = { value: tex.cobble };
    shader.uniforms.uDetailStrength = { value: 0.55 };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\nattribute vec3 surface;\nvarying vec3 vSurface;\nvarying vec3 vDetailWorldPos;\nvarying vec3 vDetailWorldNormal;`,
      )
      .replace("#include <worldpos_vertex>", `${VERTEX_WORLD}\nvSurface = surface;`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nuniform sampler2D uGround;\nuniform sampler2D uSoil;\nuniform sampler2D uCobble;\nuniform float uDetailStrength;\nvarying vec3 vSurface;\n${COMMON_GLSL}`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
  vec3 sW = vSurface / max(vSurface.x + vSurface.y + vSurface.z, 0.001);
  vec3 p = vDetailWorldPos;
  float n1 = dNoise(p * 0.25);
  float n2 = dNoise(p * 1.3);
  float n3 = dNoise(p * 6.0);
  // Grass: clumps of yellowed and darker blades.
  vec3 grassVar = mix(vec3(0.82, 0.86, 0.7), vec3(1.12, 1.06, 0.82), n1) * (0.85 + 0.25 * n3);
  // Earth: pebbles and damp patches.
  vec3 soilVar = vec3(0.86 + 0.22 * n2) * mix(0.8, 1.05, n1) * (0.9 + 0.15 * step(0.78, n3));
  // Paving: stone-to-stone tint variation.
  vec3 cobbleVar = vec3(0.8 + 0.3 * dNoise(floor(p * 3.2) + 0.5)) * (0.9 + 0.12 * n2);
  diffuseColor.rgb *= grassVar * sW.x + soilVar * sW.y + cobbleVar * sW.z;`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>\n  roughnessFactor = clamp(0.95 - 0.25 * sW.z * dNoise(p * 2.0) - 0.15 * sW.y * step(0.7, n1), 0.45, 1.0);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `vec3 detailWorldNormal;
{
  vec3 up = normalize(vDetailWorldNormal);
  vec3 nG = triplanarNormal(uGround, p, up, 0.55);
  vec3 nS = triplanarNormal(uSoil, p, up, 0.35);
  vec3 nC = triplanarNormal(uCobble, p, up, 0.75);
  detailWorldNormal = normalize(nG * sW.x + nS * sW.y + nC * sW.z);
}
${APPLY_DETAIL_NORMAL}`,
      );
  };
  mat.customProgramCacheKey = () => "chronos-detail-terrain";
  return mat;
}
