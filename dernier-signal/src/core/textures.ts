import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

// Chargement des textures Poly Haven (CC0) à la résolution du préréglage.
const BASE = import.meta.env.BASE_URL + 'assets/polyhaven/';
const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();
const clones = new Map<string, THREE.Texture[]>();
let pendingCount = 0;

export interface PBRSet { map: THREE.Texture; normalMap: THREE.Texture; arm: THREE.Texture; }

let maxAniso = 4;
export function setMaxAnisotropy(n: number) { maxAniso = n; }

function texClone(path: string, srgb: boolean): THREE.Texture {
  const base = tex(path, srgb);
  const c = base.clone();
  const k = path + srgb;
  if (!clones.has(k)) clones.set(k, []);
  clones.get(k)!.push(c);
  if (base.image) c.needsUpdate = true;
  return c;
}

function tex(path: string, srgb: boolean): THREE.Texture {
  const k = path + srgb;
  let t = cache.get(k);
  if (!t) {
    pendingCount++;
    const key = k;
    t = loader.load(BASE + path, () => {
      pendingCount--;
      for (const c of clones.get(key) ?? []) c.needsUpdate = true;
    }, undefined, () => { pendingCount--; });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    cache.set(k, t);
  }
  return t;
}

/** Charge diffuse / normale / ARM (AO-Rugosité-Métal) d'une texture Poly Haven. */
export function pbr(id: string, res: '1k' | '2k', repeat = 1): PBRSet {
  const s = {
    map: texClone(`${id}/diff_${res}.jpg`, true),
    normalMap: texClone(`${id}/nor_${res}.jpg`, false),
    arm: texClone(`${id}/arm_${res}.jpg`, false),
  };
  for (const t of Object.values(s)) t.repeat.set(repeat, repeat);
  return s;
}

/** Texture unique (sans clone) pour les masques de salissure. */
export function grunge(res: '1k' | '2k'): THREE.Texture {
  return tex(`rust_coarse_01/arm_${res}.jpg`, false);
}

export function loadHDRI(renderer: THREE.WebGLRenderer, id: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new HDRLoader().load(BASE + `hdri/${id}_1k.hdr`, (hdr) => {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose(); pmrem.dispose();
      resolve(env);
    }, undefined, reject);
  });
}

/** Promesse résolue quand toutes les textures en cours sont chargées. */
export function texturesReady(): Promise<void> {
  return new Promise((res) => {
    const check = () => { if (pendingCount > 0) setTimeout(check, 50); else res(); };
    check();
  });
}
