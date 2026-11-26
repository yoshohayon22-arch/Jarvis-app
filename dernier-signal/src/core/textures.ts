import * as THREE from 'three';

// Chargement des textures Poly Haven (CC0) à la résolution du préréglage.
const BASE = import.meta.env.BASE_URL + 'assets/polyhaven/';
const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();
const clones = new Map<string, THREE.Texture[]>();
let pendingCount = 0;
let totalCount = 0;
export function textureProgress() { return { loaded: totalCount - pendingCount, total: totalCount }; }

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
    pendingCount++; totalCount++;
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
export function pbr(id: string, res: '1k' | '2k', repeat = 1, withMap = true): PBRSet {
  const s = {
    map: withMap ? texClone(`${id}/diff_${res}.jpg`, true) : (null as unknown as THREE.Texture),
    normalMap: texClone(`${id}/nor_${res}.jpg`, false),
    arm: texClone(`${id}/arm_${res}.jpg`, false),
  };
  for (const t of Object.values(s)) t?.repeat.set(repeat, repeat);
  return s;
}

/** Texture unique (sans clone) pour les masques de salissure. */
export function grunge(res: '1k' | '2k'): THREE.Texture {
  return tex(`rust_coarse_01/arm_${res}.jpg`, false);
}

/** Éclairage d'ambiance : image HDR rangée dans un PNG RGBE (le service d'artefacts ne sert pas les .hdr),
 *  décodée sur la carte graphique puis préfiltrée pour les reflets. */
export function loadHDRI(renderer: THREE.WebGLRenderer, id: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(BASE + `hdri/${id}_1k.rgbe.png`, (png) => {
      png.premultiplyAlpha = false; png.colorSpace = THREE.NoColorSpace; png.generateMipmaps = false;
      png.minFilter = png.magFilter = THREE.NearestFilter;
      const img = png.image as { width: number; height: number };
      const rt = new THREE.WebGLRenderTarget(img.width, img.height, { type: THREE.HalfFloatType, depthBuffer: false });
      const mat = new THREE.ShaderMaterial({
        uniforms: { t: { value: png } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ vec4 c = texture2D(t, vUv); if (c.a == 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; } gl_FragColor = vec4(min((c.rgb * 255.0 + 0.5) / 256.0 * exp2(c.a * 255.0 - 128.0), vec3(30000.0)), 1.0); }',
        depthTest: false, depthWrite: false,
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
      const cam = new THREE.Camera();
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt); renderer.render(quad, cam); renderer.setRenderTarget(prev);
      rt.texture.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromEquirectangular(rt.texture).texture;
      pmrem.dispose(); rt.dispose(); png.dispose(); mat.dispose(); quad.geometry.dispose();
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
