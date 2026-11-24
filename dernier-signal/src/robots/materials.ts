import * as THREE from 'three';
import { pbr, grunge } from '../core/textures';

// Matériaux PBR des robots. Une petite extension de shader ajoute l'usure :
// la peinture s'écaille sur les arêtes (détectées par la courbure de la surface)
// et des salissures / variations de rugosité viennent d'une texture Poly Haven.

export interface WearOptions {
  wear?: number;        // quantité d'écaillage sur les arêtes (0-1.5)
  scratches?: number;   // éraflures dispersées (0-1)
  dirt?: number;        // assombrissement par la salissure (0-1)
  roughVar?: number;    // variation de rugosité
  bareColor?: THREE.ColorRepresentation;
  bareRough?: number;
  scale?: number;       // échelle du motif de salissure (répétitions / mètre)
}

let RES: '1k' | '2k' = '1k';
export function setMaterialRes(r: '1k' | '2k') { RES = r; }

export function addWear<T extends THREE.MeshStandardMaterial>(mat: T, o: WearOptions = {}): T {
  const uniforms = {
    uGrunge: { value: grunge(RES) },
    uWear: { value: o.wear ?? 0.6 },
    uScratch: { value: o.scratches ?? 0.3 },
    uDirt: { value: o.dirt ?? 0.25 },
    uRoughVar: { value: o.roughVar ?? 0.3 },
    uBare: { value: new THREE.Color(o.bareColor ?? 0x9a9da3) },
    uBareRough: { value: o.bareRough ?? 0.32 },
    uGScale: { value: o.scale ?? 2.2 },
  };
  mat.userData.wear = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjP;\nvarying vec3 vObjN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjP = position;\nvObjN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vObjP; varying vec3 vObjN;
uniform sampler2D uGrunge; uniform float uWear, uScratch, uDirt, uRoughVar, uBareRough, uGScale; uniform vec3 uBare;
float dsWear = 0.0; float dsG = 0.5;
float dsTri(vec3 p, vec3 n){
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-5);
  return texture2D(uGrunge, p.yz).g * w.x + texture2D(uGrunge, p.xz).g * w.y + texture2D(uGrunge, p.xy).g * w.z;
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 on = normalize(vObjN);
  dsG = dsTri(vObjP * uGScale, on);
  float g2 = dsTri(vObjP * uGScale * 6.3 + 0.37, on);
  vec3 nV = normalize(vNormal);
  float curv = length(fwidth(nV)) / max(length(fwidth(vViewPosition)), 1e-5);
  float edge = smoothstep(18.0, 70.0, curv);
  float chip = edge * uWear * (0.35 + 1.1 * dsG);
  float scratch = smoothstep(0.86, 0.9, g2) * smoothstep(0.4, 0.65, dsG) * uScratch;
  dsWear = clamp(smoothstep(0.45, 0.62, chip) + scratch, 0.0, 1.0);
  diffuseColor.rgb *= mix(1.0 - uDirt, 1.0, smoothstep(0.15, 0.7, dsG));
  diffuseColor.rgb = mix(diffuseColor.rgb, uBare * (0.75 + 0.5 * g2), dsWear);
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor * mix(1.0 - uRoughVar, 1.0 + uRoughVar, dsG), 0.04, 1.0);
roughnessFactor = mix(roughnessFactor, uBareRough, dsWear);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 1.0, dsWear);`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
material.clearcoat *= (1.0 - dsWear);
#endif`);
  };
  mat.customProgramCacheKey = () => 'wear';
  return mat;
}

// ---------- Catalogue ----------

export function paint(color: THREE.ColorRepresentation, o: WearOptions & { rough?: number; clearcoat?: number } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color, roughness: o.rough ?? 0.42, metalness: 0.0,
    clearcoat: o.clearcoat ?? 0.5, clearcoatRoughness: 0.22,
  });
  const s = pbr('rust_coarse_01', RES, 1, false);
  m.normalMap = s.normalMap; m.normalScale.set(0.05, 0.05);
  return addWear(m, o);
}

export function steel(color: THREE.ColorRepresentation = 0x55585e, o: WearOptions & { rough?: number } = {}) {
  const s = pbr('rust_coarse_01', RES, 1.5, false);
  const m = new THREE.MeshStandardMaterial({
    color, metalness: 1.0, roughness: o.rough ?? 0.45,
    normalMap: s.normalMap, normalScale: new THREE.Vector2(0.15, 0.15),
  });
  return addWear(m, { wear: 0.25, scratches: 0.15, dirt: 0.3, roughVar: 0.4, bareColor: 0x9ea4ac, bareRough: 0.22, ...o });
}

export function treadPlate(color: THREE.ColorRepresentation = 0x2c2f34, repeat = 2) {
  const s = pbr('metal_plate', RES, repeat, false);
  return new THREE.MeshStandardMaterial({
    color, metalness: 0.9, roughnessMap: s.arm, metalnessMap: s.arm, aoMap: s.arm,
    roughness: 1.0, normalMap: s.normalMap, normalScale: new THREE.Vector2(0.8, 0.8),
  });
}

export function rubber(color: THREE.ColorRepresentation = 0x141517) {
  return addWear(new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 }),
    { wear: 0.0, scratches: 0.0, dirt: 0.4, roughVar: 0.2 });
}

export function glossyBlack() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x030406, roughness: 0.06, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.03,
    specularIntensity: 1, ior: 1.5,
  });
}

/** Verre de visière : transparent, reflète l'environnement. */
export function visorGlass() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x0b1014, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.28,
    clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false,
  });
}

export function pearl() {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xf2f0ec, roughness: 0.28, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.08,
    iridescence: 0.55, iridescenceIOR: 1.35,
    sheen: 0.4, sheenColor: new THREE.Color(0xdfe8ff), sheenRoughness: 0.4,
  });
  return addWear(m, { wear: 0.0, scratches: 0.06, dirt: 0.06, roughVar: 0.15, scale: 1.5 });
}

export function rusty(tint: THREE.ColorRepresentation = 0xffffff, repeat = 1.6) {
  const s = pbr('rusty_painted_metal', RES, repeat);
  const m = new THREE.MeshStandardMaterial({
    color: tint, map: s.map, normalMap: s.normalMap, normalScale: new THREE.Vector2(1, 1),
    roughnessMap: s.arm, metalnessMap: s.arm, roughness: 1, metalness: 1,
  });
  return addWear(m, { wear: 0.9, scratches: 0.4, dirt: 0.45, roughVar: 0.2, bareColor: 0x6b4a33, bareRough: 0.7, scale: 2.0 });
}

/** Matériau émissif HDR (valeurs > 1 → halo de bloom). */
export function glow(color: THREE.ColorRepresentation, intensity = 4) {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, toneMapped: true });
}

export function decal(tex: THREE.Texture, opts: { color?: THREE.ColorRepresentation; rough?: number } = {}) {
  return new THREE.MeshStandardMaterial({
    map: tex, transparent: true, color: opts.color ?? 0xffffff, roughness: opts.rough ?? 0.6,
    metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false,
  });
}

/** Texte / marquages peints générés sur canvas. */
export function textTexture(lines: { text: string; size: number; y: number; font?: string; color?: string }[], w = 512, h = 256, stripes = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, w, h);
  if (stripes) {
    g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip();
    for (let x = -h; x < w + h; x += 56) {
      g.fillStyle = '#d8a21a'; g.beginPath();
      g.moveTo(x, h); g.lineTo(x + 28, h); g.lineTo(x + 28 + h, 0); g.lineTo(x + h, 0); g.fill();
    }
    g.restore();
  }
  for (const l of lines) {
    g.fillStyle = l.color ?? '#ffffff';
    g.font = `${l.font ?? '700'} ${l.size}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(l.text, w / 2, l.y);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------- Unification des matériaux (temps de chargement) ----------
// Safari compile un programme GPU par combinaison de cartes/options. En donnant à tous les
// matériaux éclairés EXACTEMENT les mêmes cartes (textures neutres 1×1 si besoin) et la même
// extension d'usure, des dizaines de matériaux partagent un seul programme.

function px(r: number, g: number, b: number, srgb = false) {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}
let defaults: { white: THREE.Texture; flat: THREE.Texture; arm: THREE.Texture } | null = null;
function defs() { return defaults ?? (defaults = { white: px(255, 255, 255, true), flat: px(128, 128, 255), arm: px(255, 255, 255) }); }

const unifiedCache = new Map<THREE.Material, THREE.Material>();

export function unifyMaterial(src: THREE.Material): THREE.Material {
  const hit = unifiedCache.get(src);
  if (hit) return hit;
  const s = src as THREE.MeshStandardMaterial;
  if (!s.isMeshStandardMaterial || s.fog === false) { unifiedCache.set(src, src); return src; }
  let m: THREE.MeshStandardMaterial;
  if ((s as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
    const p = s as THREE.MeshPhysicalMaterial;
    m = new THREE.MeshStandardMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(m, p);
    // le vernis (clearcoat) est approché par une surface un peu plus lisse
    m.roughness = Math.max(0.04, p.roughness * (1 - 0.35 * p.clearcoat));
    const w = p.userData.wear as Record<string, { value: unknown }> | undefined;
    m.userData = {};
    if (w) addWear(m, {
      wear: w.uWear.value as number, scratches: w.uScratch.value as number, dirt: w.uDirt.value as number, roughVar: w.uRoughVar.value as number,
      bareColor: w.uBare.value as THREE.Color, bareRough: w.uBareRough.value as number, scale: w.uGScale.value as number,
    });
  } else m = s;
  const d = defs();
  if (!m.map) m.map = d.white;
  if (!m.normalMap) { m.normalMap = d.flat; m.normalScale.set(1, 1); }
  if (!m.roughnessMap) m.roughnessMap = d.arm;
  if (!m.metalnessMap) m.metalnessMap = d.arm;
  m.aoMap = null;
  if (!m.userData.wear) addWear(m, { wear: 0, scratches: 0, dirt: 0, roughVar: 0 });
  m.needsUpdate = true;
  unifiedCache.set(src, m);
  return m;
}

export function unifyScene(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(unifyMaterial) : unifyMaterial(mesh.material);
  });
}
