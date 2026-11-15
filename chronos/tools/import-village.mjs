// Post-processes the building GLBs produced by tools/blender/convert_buildings.py
// (CC0 medieval village models by Daniel Andersson, OpenGameArt) into
// client/public/assets/village: WebP textures, meshopt, and a bounds manifest.
//   node tools/import-village.mjs <dir with *.glb>
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, getBounds, join as joinPrimitives, meshopt, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const src = resolve(process.argv[2] ?? ".");
const out = resolve(new URL("../client/public/assets/village", import.meta.url).pathname);
mkdirSync(out, { recursive: true });
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const manifest = {};
let total = 0;
for (const f of readdirSync(src).filter((x) => x.endsWith(".glb")).sort()) {
  const doc = await io.read(join(src, f));
  for (const m of doc.getRoot().listMaterials()) m.setMetallicFactor(0).setRoughnessFactor(0.9).setDoubleSided(true);
  await doc.transform(dedup(), flatten(), joinPrimitives(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.4, error: 0.004 }), prune(), textureCompress({ encoder: sharp, targetFormat: "webp", resize: [512, 512], quality: 80 }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const b = getBounds(doc.getRoot().listScenes()[0]);
  const r = (v) => Math.round(v * 1000) / 1000;
  manifest[f.replace(/\.glb$/, "")] = { min: b.min.map(r), max: b.max.map(r) };
  await io.write(join(out, f), doc);
  total += statSync(join(out, f)).size;
}
writeFileSync(resolve(new URL("../client/data/village-manifest.json", import.meta.url).pathname), JSON.stringify(manifest, null, 1));
writeFileSync(
  join(out, "LICENSE-village.txt"),
  "Buildings: medieval village models by Daniel Andersson, CC0 1.0 (public domain), via OpenGameArt\n(medieval-house-pack, medieval-tavern, medieval-church, medieval-blacksmith, medieval-gatehouse, medieval-well, medieval-waterpowered-sawmill).\nhttps://opengameart.org/users/daniel-andersson — converted from .blend to glTF for this game.\n",
);
console.log(`village: ${Object.keys(manifest).length} models, ${(total / 1024).toFixed(0)} KB`);
