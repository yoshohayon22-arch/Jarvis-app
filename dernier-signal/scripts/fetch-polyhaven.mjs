// Télécharge les textures et HDRI Poly Haven (licence CC0) utilisées par le jeu.
// Usage : NODE_USE_ENV_PROXY=1 node scripts/fetch-polyhaven.mjs (ImageMagick requis)
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const OUT = 'public/assets/polyhaven';
const TEXTURES = {
  // id: cartes nécessaires
  rusty_painted_metal: ['Diffuse', 'nor_gl', 'arm'],
  metal_plate: ['Diffuse', 'nor_gl', 'arm'],
  smooth_concrete_floor: ['Diffuse', 'nor_gl', 'arm'],
  rust_coarse_01: ['Diffuse', 'nor_gl', 'arm'],
  blue_metal_plate: ['Diffuse', 'nor_gl', 'arm'],
  painted_metal_shutter: ['Diffuse', 'nor_gl', 'arm'],
  container_side: ['Diffuse', 'nor_gl', 'arm'],
  metal_grate_rusty: ['Diffuse', 'nor_gl', 'arm'],
  corrugated_iron_02: ['Diffuse', 'nor_gl', 'arm'],
  concrete_floor_worn_001: ['Diffuse', 'nor_gl', 'arm'],
};
const HDRIS = { studio_small_09: ['1k'] };
const RES = ['1k', '2k'];
const SHORT = { Diffuse: 'diff', nor_gl: 'nor', arm: 'arm' };

async function exists(p) { try { await access(p); return true; } catch { return false; } }
async function dl(url, path) {
  if (await exists(path)) return;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(await r.arrayBuffer()));
  // Recompression (ImageMagick) : les normales gardent la chrominance complète.
  if (path.endsWith('.jpg')) {
    const isNormal = /nor_/.test(path);
    execFileSync('mogrify', ['-strip', '-quality', isNormal ? '88' : '80', '-sampling-factor', isNormal ? '4:4:4' : '4:2:0', path]);
  }
  console.log('✓', path);
}

for (const [id, maps] of Object.entries(TEXTURES)) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  for (const res of RES) for (const m of maps) {
    const f = files[m]?.[res]?.jpg;
    if (!f) { console.warn('manquant', id, m, res); continue; }
    await dl(f.url, join(OUT, id, `${SHORT[m]}_${res}.jpg`));
  }
}
for (const [id, resList] of Object.entries(HDRIS)) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  for (const res of resList) await dl(files.hdri[res].hdr.url, join(OUT, 'hdri', `${id}_${res}.hdr`));
}
