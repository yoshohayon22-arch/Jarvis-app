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
const binaries = walk(assets).filter((f) => /\.(glb|exr)$/.test(f)).sort();
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
