// Imports CC0 nature models (3TD Starter Pack by Ron Kapaun, OpenGameArt) into
// client/public/assets/nature. Input: GLBs converted from the pack's .DAE files (assimp),
// whose textures are still external; each job names the folder holding them.
//   node tools/import-nature.mjs <glb dir> name=<texture dir> [name=<texture dir> ...]
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, flatten, getBounds, join as joinPrimitives, meshopt, prune, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const src = resolve(process.argv[2]);
const jobs = process.argv.slice(3).map((a) => a.split("="));
const out = resolve(new URL("../client/public/assets/nature", import.meta.url).pathname);
const manifestPath = resolve(new URL("../client/data/nature-manifest.json", import.meta.url).pathname);
mkdirSync(out, { recursive: true });
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });

/** Splits a GLB and embeds the textures found (by file name) in `texDir`. */
function embed(glbPath, texDir) {
  const buf = readFileSync(glbPath);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  const bin = buf.subarray(20 + jsonLen + 8);
  const files = readdirSync(texDir);
  const resources = { "model.bin": new Uint8Array(bin) };
  json.buffers[0].uri = "model.bin";
  for (const img of json.images ?? []) {
    const want = basename(String(img.uri ?? "").replaceAll("\\", "/")).toLowerCase();
    const hit = files.find((f) => f.toLowerCase() === want) ?? files.find((f) => f.toLowerCase().replace(/\.[a-z]+$/, "") === want.replace(/\.[a-z]+$/, ""));
    if (!hit) throw new Error(`texture not found: ${img.uri}`);
    img.uri = hit;
    resources[hit] = new Uint8Array(readFileSync(join(texDir, hit)));
  }
  return io.readJSON({ json, resources });
}

const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
let total = 0;
for (const [name, texDir] of jobs) {
  const file = readdirSync(src).find((f) => f.toLowerCase() === `${name.toLowerCase()}.glb`);
  const doc = await embed(join(src, file), texDir);
  // The pack ships several levels of detail and a collision hull in one file: keep the finest only.
  const lod = (n) => (/Collision/i.test(n.getName()) ? -1 : Number(/^node-(?!detail|BB).*?(\d{2,})$/.exec(n.getName())?.[1] ?? NaN));
  const levels = doc.getRoot().listNodes().map(lod).filter((v) => v >= 16);
  const best = Math.max(...levels);
  for (const n of doc.getRoot().listNodes()) {
    const v = lod(n);
    // Names such as "node-Base01" also end in digits: only sizes of 16 and more are detail levels.
    if (v === -1 || (v >= 16 && v < best)) {
      n.traverse((c) => c.setMesh(null));
    }
  }
  for (const m of doc.getRoot().listMaterials()) if (/^ColorEffect/.test(m.getName())) m.dispose();
  for (const m of doc.getRoot().listMaterials()) {
    const tex = m.getBaseColorTexture();
    const meta = tex ? await sharp(Buffer.from(tex.getImage())).metadata() : null;
    // Leaf cards: cut-out alpha, both sides visible.
    if (meta?.hasAlpha) m.setAlphaMode("MASK").setAlphaCutoff(0.4).setDoubleSided(true);
    else m.setAlphaMode("OPAQUE");
    m.setMetallicFactor(0).setRoughnessFactor(0.9).setNormalTexture(null).setEmissiveTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null);
  }
  await doc.transform(dedup(), flatten(), joinPrimitives(), weld(), prune(), textureCompress({ encoder: sharp, targetFormat: "webp", resize: [512, 512], quality: 82 }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  // Stand the model on the ground, centred on its footprint.
  const scene = doc.getRoot().listScenes()[0];
  const b0 = getBounds(scene);
  const pivot = doc.createNode("pivot").setTranslation([-(b0.min[0] + b0.max[0]) / 2, -b0.min[1], -(b0.min[2] + b0.max[2]) / 2]);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    pivot.addChild(child);
  }
  scene.addChild(pivot);
  const b = getBounds(scene);
  const r = (v) => Math.round(v * 1000) / 1000;
  const id = name.toLowerCase();
  manifest[id] = { min: b.min.map(r), max: b.max.map(r) };
  await io.write(join(out, `${id}.glb`), doc);
  total += statSync(join(out, `${id}.glb`)).size;
  console.log(id, manifest[id].min, manifest[id].max);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
writeFileSync(join(out, "LICENSE-nature.txt"), "Trees, rocks and wagon: 3TD Starter Pack #1 by Ron Kapaun (3 Tier Digital Studios), CC0 1.0 (public domain).\nhttps://opengameart.org/content/3td-starter-pack-1 — converted from Collada to glTF for this game.\n");
console.log(`nature: ${jobs.length} models, ${(total / 1024).toFixed(0)} KB`);
