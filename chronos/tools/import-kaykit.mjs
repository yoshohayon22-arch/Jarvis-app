// Imports the CC0 KayKit packs into client/public/assets/kaykit as compact .glb files.
//
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 <dir>/adv
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0  <dir>/hex
//   node tools/import-kaykit.mjs <dir>
//
// Each model becomes a self-contained GLB (texture embedded), geometry and animations
// compressed with EXT_meshopt_compression (decoded in the browser by three's MeshoptDecoder).
// Characters keep only the animation clips the game uses.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, getBounds, meshopt, prune, resample } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { copyFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const src = resolve(process.argv[2] ?? ".");
const out = resolve(new URL("../client/public/assets/kaykit", import.meta.url).pathname);
const ADV = join(src, "adv/addons/kaykit_character_pack_adventures/Characters/gltf");
const HEX = join(src, "hex/addons/kaykit_medieval_hexagon_pack/Assets/gltf");

const CHARACTERS = ["Rogue_Hooded", "Rogue", "Knight", "Mage", "Barbarian"];
const KEEP_CLIPS = new Set([
  "Idle", "Unarmed_Idle", "Walking_A", "Walking_B", "Walking_C", "Walking_Backwards", "Running_A", "Running_B",
  "Dodge_Forward", "Dodge_Backward", "Dodge_Left", "Dodge_Right", "Jump_Full_Short",
  "Interact", "PickUp", "Use_Item", "Throw", "Cheer", "Hit_A", "Hit_B", "Death_A", "Death_A_Pose",
  "Sit_Chair_Down", "Sit_Chair_Idle", "Sit_Chair_StandUp", "Sit_Floor_Idle", "Lie_Idle",
  "Spellcast_Raise", "Spellcast_Shoot", "Spellcast_Long", "Spellcasting", "Block", "Blocking",
  "1H_Melee_Attack_Chop", "Unarmed_Melee_Attack_Punch_A",
]);

const COLORS = ["blue", "red", "yellow", "green"];
const BUILDINGS = ["barracks", "blacksmith", "church", "home_A", "home_B", "market", "tavern", "tower_A", "tower_B",
  "tower_base", "well", "windmill", "archeryrange", "lumbermill"];
const NEUTRAL = ["building_destroyed", "building_scaffolding", "building_stage_A", "building_stage_B", "building_stage_C",
  "building_grain", "building_dirt", "wall_straight", "wall_straight_gate", "wall_corner_A_inside", "wall_corner_A_outside",
  "fence_wood_straight", "fence_wood_straight_gate", "fence_stone_straight"];
const NATURE = ["tree_single_A", "tree_single_B", "tree_single_A_cut", "trees_A_small", "trees_A_medium", "trees_A_large",
  "trees_B_small", "trees_B_medium", "trees_B_large", "rock_single_A", "rock_single_B", "rock_single_C", "rock_single_D",
  "rock_single_E", "hill_single_A", "hill_single_B", "hill_single_C", "hills_A_trees", "hills_B_trees", "hills_C_trees",
  "mountain_A_grass_trees", "mountain_B_grass_trees", "mountain_C_grass_trees", "mountain_A", "mountain_B",
  "cloud_big", "cloud_small", "waterplant_A"];
const PROPS = ["barrel", "bucket_arrows", "bucket_empty", "bucket_water", "crate_A_big", "crate_A_small", "crate_B_big",
  "crate_B_small", "crate_long_A", "crate_open", "flag_blue", "flag_red", "flag_yellow", "ladder", "pallet",
  "resource_lumber", "resource_stone", "sack", "target", "tent", "weaponrack", "wheelbarrow"];

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });

let total = 0;
/** Model bounds (meters, untransformed), stored in the manifest so the simulation can size colliders without loading GLBs. */
const bounds = {};
async function convert(input, output, { clips } = {}) {
  const doc = await io.read(input);
  const b = getBounds(doc.getRoot().listScenes()[0]);
  const r = (v) => Math.round(v * 1000) / 1000;
  bounds[output] = { min: b.min.map(r), max: b.max.map(r) };
  if (clips) for (const a of doc.getRoot().listAnimations()) if (!clips.has(a.getName())) a.dispose();
  await doc.transform(resample(), dedup(), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  mkdirSync(resolve(output, ".."), { recursive: true });
  await io.write(output, doc);
  total += statSync(output).size;
}

for (const c of CHARACTERS)
  await convert(join(ADV, `${c}.glb`), join(out, "characters", `${c}.glb`), { clips: KEEP_CLIPS });
for (const color of COLORS)
  for (const b of BUILDINGS)
    await convert(join(HEX, "buildings", color, `building_${b}_${color}.gltf`), join(out, "buildings", `${b}_${color}.glb`));
for (const n of NEUTRAL) await convert(join(HEX, "buildings/neutral", `${n}.gltf`), join(out, "buildings", `${n.replace(/^building_/, "")}.glb`));
for (const n of NATURE) await convert(join(HEX, "decoration/nature", `${n}.gltf`), join(out, "nature", `${n}.glb`));
for (const p of PROPS) await convert(join(HEX, "decoration/props", `${p}.gltf`), join(out, "props", `${p}.glb`));

copyFileSync(join(src, "hex/LICENSE.txt"), join(out, "LICENSE-medieval-hexagon.txt"));
copyFileSync(join(src, "adv/LICENSE.txt"), join(out, "LICENSE-adventurers.txt"));
const manifest = {};
for (const dir of ["characters", "buildings", "nature", "props"])
  manifest[dir] = Object.fromEntries(
    readdirSync(join(out, dir))
      .filter((f) => f.endsWith(".glb"))
      .sort()
      .map((f) => [f.replace(/\.glb$/, ""), bounds[join(out, dir, f)] ?? null]),
  );
const manifestJson = JSON.stringify(manifest, null, 1) + "\n";
writeFileSync(join(out, "manifest.json"), manifestJson);
// Same data for the simulation/tests (sizes colliders without loading any GLB).
writeFileSync(resolve(out, "../../../data/kaykit-manifest.json"), manifestJson);
console.log(`Imported into ${out} — ${(total / 1024 / 1024).toFixed(2)} MB total (${basename(out)})`);
