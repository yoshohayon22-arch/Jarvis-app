// Extracts the CC0 HDRIs and normal maps we use from @pmndrs/assets (base64 JS modules)
// into client/public/assets/pmndrs as plain files.   node tools/import-pmndrs.mjs
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const pkg = dirname(require.resolve("@pmndrs/assets/package.json"));
const out = resolve(new URL("../client/public/assets/pmndrs", import.meta.url).pathname);

// HDRIs (Poly Haven, 512px EXR): one per time of day.
const HDRI = ["sunrise", "dawn", "park", "sky", "sunset", "night", "forest"];
// Tileable normal maps used as surface detail (see client/src/render/materials.ts).
const NORMALS = {
  "0009": "pebbles",
  "0026": "cobble",
  "0015": "ground",
  "0027": "soil",
  "0002": "rock",
  "0003": "stone",
  "0011": "wood",
  "0019": "bark",
  "0024": "plaster",
};

function extract(src, dest) {
  const js = readFileSync(src, "utf8");
  const m = js.match(/base64,([^'"]+)['"]/);
  if (!m) throw new Error(`No base64 payload in ${src}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(m[1], "base64"));
}

for (const h of HDRI) extract(join(pkg, "hdri", `${h}.exr.js`), join(out, "hdri", `${h}.exr`));
for (const [id, name] of Object.entries(NORMALS)) extract(join(pkg, "normals", `${id}.webp.js`), join(out, "normals", `${name}.webp`));
copyFileSync(join(pkg, "LICENSE"), join(out, "LICENSE-pmndrs-assets.txt"));
console.log(`Extracted ${HDRI.length} HDRIs and ${Object.keys(NORMALS).length} normal maps into ${out}`);
