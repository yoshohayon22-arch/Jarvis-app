// Packs the binary assets of a built client (.glb, .exr) into base64 JSON files,
// for hosts that only serve web file types. Usage: node tools/pack-assets.mjs <distDir>
// The build itself must be made with VITE_PACKED=1 so the game reads the packs.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, relative } from "node:path";

const dist = process.argv[2];
if (!dist) throw new Error("usage: node tools/pack-assets.mjs <distDir>");
const assets = join(dist, "assets");
const MAX_RAW = 8 * 1024 * 1024; // ≈ 11 MB of JSON per pack

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
// Only the models the pack's visuals actually reference are shipped.
const visuals = readFileSync(new URL("../client/data/packs/medieval/visuals.json", import.meta.url), "utf8");
const base = JSON.parse(visuals).assetsBase;
const used = new Set([...visuals.matchAll(/"((?:\.\.\/)?[a-z_0-9]+\/[A-Za-z_0-9]+)"/g)].map((m) => (m[1].startsWith("../") ? m[1].slice(3) : base + m[1]) + ".glb"));
let dropped = 0;
const binaries = walk(assets)
  .filter((f) => /\.(glb|exr)$/.test(f))
  .filter((f) => {
    const rel = relative(assets, f).replaceAll("\\", "/");
    if (f.endsWith(".exr") || used.has(rel)) return true;
    rmSync(f);
    dropped++;
    return false;
  })
  .sort();
console.log(`${dropped} unreferenced models left out`);
mkdirSync(join(assets, "packs"), { recursive: true });
const packs = [];
let current = {};
let size = 0;
const flush = () => {
  if (!Object.keys(current).length) return;
  const name = `pack-${packs.length}.json`;
  writeFileSync(join(assets, "packs", name), JSON.stringify({ files: current }));
  packs.push(name);
  current = {};
  size = 0;
};
for (const file of binaries) {
  const data = readFileSync(file);
  if (size + data.length > MAX_RAW) flush();
  current[relative(assets, file).replaceAll("\\", "/")] = data.toString("base64");
  size += data.length;
  rmSync(file);
}
flush();
writeFileSync(join(assets, "packs", "index.json"), JSON.stringify({ packs }));
console.log(`${binaries.length} files packed into ${packs.length} pack(s)`);
