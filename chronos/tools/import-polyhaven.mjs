// Downloads CC0 ground textures from Poly Haven (https://polyhaven.com) into
// client/public/assets/ground as 1024 px WebP albedo maps.
//   node tools/import-polyhaven.mjs
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const out = resolve(new URL("../client/public/assets/ground", import.meta.url).pathname);
mkdirSync(out, { recursive: true });
const UA = "asset-fetch/1.0";
const JOBS = { grass: "leafy_grass", dirt: "dirt", cobble: "cobblestone_floor_04" };
for (const [name, id] of Object.entries(JOBS)) {
  // curl honours the environment's HTTPS proxy, which Node's fetch does not.
  const get = (u) => execFileSync("curl", ["-sS", "-m", "120", "-A", UA, u], { maxBuffer: 1 << 28 });
  const files = JSON.parse(get(`https://api.polyhaven.com/files/${id}`).toString("utf8"));
  const url = files.Diffuse["1k"].jpg.url;
  const buf = get(url);
  await sharp(buf).resize(1024, 1024).webp({ quality: 82 }).toFile(join(out, `${name}.webp`));
  console.log(name, id, url);
}
writeFileSync(join(out, "LICENSE-ground.txt"), `Ground textures from Poly Haven (https://polyhaven.com), CC0 1.0 (public domain):\n${Object.entries(JOBS).map(([n, id]) => `${n}.webp: ${id}`).join("\n")}\n`);
