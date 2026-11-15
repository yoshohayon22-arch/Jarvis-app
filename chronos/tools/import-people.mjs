// Post-processes the character GLBs produced by tools/blender/convert_characters.py
// (CC0 "Modular RPG Characters" by System G6) into client/public/assets/people:
// alpha-tested material, WebP atlas, meshopt compression.
//   node tools/import-people.mjs <dir with *.glb>
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, resample, textureCompress } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const src = resolve(process.argv[2] ?? ".");
const out = resolve(new URL("../client/public/assets/people", import.meta.url).pathname);
mkdirSync(out, { recursive: true });
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
let total = 0;
for (const f of readdirSync(src).filter((x) => x.endsWith(".glb")).sort()) {
  const doc = await io.read(join(src, f));
  for (const m of doc.getRoot().listMaterials()) m.setAlphaMode("MASK").setAlphaCutoff(0.5).setDoubleSided(true).setMetallicFactor(0).setRoughnessFactor(0.85);
  await doc.transform(
    resample(),
    dedup(),
    prune({ keepLeaves: true }),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 512], quality: 86 }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  await io.write(join(out, f), doc);
  total += statSync(join(out, f)).size;
}
writeFileSync(
  join(out, "LICENSE-people.txt"),
  "Characters: \"Modular RPG Characters\" by System G6, CC0 1.0 (public domain).\nhttps://opengameart.org/content/modular-rpg-characters\nConverted and re-packed for this game (parts joined per look, textures atlased).\n",
);
console.log(`people: ${readdirSync(out).length - 1} models, ${(total / 1024).toFixed(0)} KB`);
