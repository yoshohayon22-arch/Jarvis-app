import * as THREE from "three";
import "./style.css";
import { FixedStep } from "./core/fixedStep";
import { Input } from "./core/input";
import { loadDefaultPack } from "./pack";
import { WorldClock } from "./sim/clock";
import { districtAt } from "./sim/districts";
import { PLAYER_TUNING, createPlayer, playerSpeed, stepPlayer, type PlayerState } from "./sim/player";
import { expandLayout } from "./sim/scenery";
import { buildCollisionWorld } from "./sim/worldColliders";
import { AnimatedCharacter } from "./render/animatedCharacter";
import { AssetLibrary } from "./render/assets";
import { CameraRig } from "./render/cameraRig";
import { CharacterModel, KAEL_LOOK } from "./render/character";
import { PostFx } from "./render/postfx";
import { QUALITY, initialQuality, saveQuality, type QualityLevel } from "./render/quality";
import { DayNightCycle } from "./render/sky";
import { buildWorldView, enhanceModel, loadModel, type VisualsDef } from "./render/worldView";
import { EnvironmentLighting } from "./render/environment";
import { GrassField } from "./render/grass";
import { loadDetailTextures } from "./render/materials";
import { buildGrassMap } from "./render/terrain";
import { Hud } from "./ui/hud";
import visualsJson from "../data/packs/medieval/visuals.json";

const WORLD_SEED = 20261112;
const PHYSICS_HZ = 60;
const SIM_HZ = 10;
const TIME_SCALES = [1, 10, 60, 0];
const visuals = visualsJson as unknown as VisualsDef;

// ---------------------------------------------------------------- data & simulation
const pack = loadDefaultPack();
const layout = expandLayout(pack.layout, WORLD_SEED);
const collision = buildCollisionWorld(layout);
const clock = new WorldClock(pack.manifest.calendar.minutesPerGameDay, pack.manifest.calendar.startHour);
const player = createPlayer(layout.spawn.pos[0], layout.spawn.pos[1], layout.spawn.facing);
const prevPlayer: PlayerState = { ...player };

// ---------------------------------------------------------------- rendering
let qualityLevel: QualityLevel = initialQuality();
let quality = QUALITY[qualityLevel];
const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.info.autoReset = false; // count every pass of the post-processing chain

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1200);
const dayNight = new DayNightCycle(scene);
dayNight.setShadowQuality(quality.shadowMapSize, quality.shadowRadius);
const postfx = new PostFx(renderer, scene, camera, quality);

const nightLights: THREE.PointLight[] = [];
function rebuildNightLights(count: number): void {
  for (const l of nightLights.splice(0)) scene.remove(l);
  for (let i = 0; i < count; i++) {
    const l = new THREE.PointLight("#ffab55", 0, 14, 1.7);
    scene.add(l);
    nightLights.push(l);
  }
}
rebuildNightLights(quality.maxNightLights);

// Placeholder hero, replaced by the glTF character once loaded.
const placeholderKael = new CharacterModel(KAEL_LOOK);
const playerRoot = new THREE.Group();
playerRoot.add(placeholderKael.root);
scene.add(playerRoot);
let animatedKael: AnimatedCharacter | null = null;

const rig = new CameraRig();
rig.yaw = layout.spawn.facing + Math.PI; // start behind the player

const input = new Input(canvas);
const hud = new Hud();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  postfx.setSize(window.innerWidth, window.innerHeight);
});

function setQuality(level: QualityLevel): void {
  qualityLevel = level;
  quality = QUALITY[level];
  saveQuality(level);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  dayNight.setShadowQuality(quality.shadowMapSize, quality.shadowRadius);
  postfx.apply(quality);
  rebuildNightLights(quality.maxNightLights);
  applyGrass();
  hud.toast(quality.label);
}

// ---------------------------------------------------------------- assets
const loadingEl = document.getElementById("loading") as HTMLElement;
const ctaEl = document.getElementById("cta") as HTMLElement;
const manager = new THREE.LoadingManager();
manager.onProgress = (_url, loaded, total) => {
  loadingEl.textContent = `Chargement de Brumeval… ${Math.round((loaded / Math.max(total, 1)) * 100)} %`;
};
const lib = new AssetLibrary(manager);
let world: Awaited<ReturnType<typeof buildWorldView>> | null = null;
let ready = false;

const environment = new EnvironmentLighting();
let grass: GrassField | null = null;
let grassMap: THREE.DataTexture | null = null;
const GRASS_EXTENT = 200;

function applyGrass(): void {
  if (grass) {
    scene.remove(grass.mesh);
    grass.mesh.geometry.dispose();
    grass = null;
  }
  if (quality.grass && grassMap) {
    grass = new GrassField(grassMap, GRASS_EXTENT, quality.grass.count, quality.grass.patch);
    scene.add(grass.mesh);
  }
}

const loading = (async () => {
  const detail = await loadDetailTextures(manager).catch((e) => {
    console.warn("Detail textures unavailable, using plain materials", e);
    return null;
  });
  const [view, kaelModel] = await Promise.all([
    buildWorldView(layout, visuals, lib, WORLD_SEED, quality.detailMaterials ? detail : null),
    loadModel(lib, visuals, visuals.characters.kael!.model),
    environment.load(renderer, manager).catch((e) => console.warn("HDRI lighting unavailable", e)),
  ]);
  if (kaelModel && detail && quality.detailMaterials) enhanceModel(kaelModel, detail);
  grassMap = buildGrassMap(layout, GRASS_EXTENT);
  applyGrass();
  world = view;
  scene.add(view.group);
  if (kaelModel) {
    const kael = new AnimatedCharacter(kaelModel, visuals.characters.kael!, true);
    if (kael.hasClips) {
      playerRoot.remove(placeholderKael.root);
      playerRoot.add(kael.root);
      animatedKael = kael;
    }
  }
  if (view.placeholders.length) console.warn("Missing models, using placeholders:", view.placeholders);
  renderer.compile(scene, camera);
  ready = true;
  loadingEl.textContent = "";
  ctaEl.classList.remove("hidden");
})().catch((e) => {
  console.error(e);
  loadingEl.textContent = "Erreur de chargement — voir la console.";
});

// ---------------------------------------------------------------- title / pause
const title = document.getElementById("title") as HTMLElement;
const pauseEl = document.getElementById("pause") as HTMLElement;
let started = false;
let paused = true;

function start(): void {
  if (!ready) return;
  started = true;
  paused = false;
  title.classList.add("hidden");
  pauseEl.classList.add("hidden");
  input.requestPointerLock();
}
title.addEventListener("click", start);
pauseEl.addEventListener("click", start);
document.addEventListener("pointerlockchange", () => {
  if (started && !document.pointerLockElement) {
    paused = true;
    pauseEl.classList.remove("hidden");
  }
});

// ---------------------------------------------------------------- loop
const physics = new FixedStep(1 / PHYSICS_HZ);
const sim = new FixedStep(1 / SIM_HZ);
let timeScaleIndex = 0;
let lastDistrict = "";
let last = performance.now();
let fpsAcc = 0;
let fpsFrames = 0;
let fps = 0;
const focus = new THREE.Vector3();

function readMoveInput() {
  const f = (input.isDown("KeyW", "ArrowUp") ? 1 : 0) - (input.isDown("KeyS", "ArrowDown") ? 1 : 0);
  const s = (input.isDown("KeyD", "ArrowRight") ? 1 : 0) - (input.isDown("KeyA", "ArrowLeft") ? 1 : 0);
  const b = rig.basis();
  return {
    moveX: b.fx * f + b.rx * s,
    moveZ: b.fz * f + b.rz * s,
    run: input.isDown("ShiftLeft", "ShiftRight"),
    dodge: input.wasPressed("Space"),
  };
}

function updateNightLights(): void {
  const intensity = dayNight.night * 10;
  const spots = world?.lightSpots ?? [];
  const sorted = spots
    .map((s) => ({ p: s.pos, d: (s.pos.x - player.x) ** 2 + (s.pos.z - player.z) ** 2 }))
    .sort((a, b) => a.d - b.d);
  nightLights.forEach((l, i) => {
    const s = sorted[i];
    if (!s || intensity < 0.05) {
      l.intensity = 0;
      return;
    }
    l.position.copy(s.p);
    l.intensity = intensity;
  });
}

function frame(now: number): void {
  renderer.info.reset();
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;

  if (input.wasPressed("F3")) hud.toggleDebug();
  if (input.wasPressed("KeyG")) setQuality(qualityLevel === "high" ? "low" : "high");
  if (input.wasPressed("KeyT")) {
    timeScaleIndex = (timeScaleIndex + 1) % TIME_SCALES.length;
    clock.timeScale = TIME_SCALES[timeScaleIndex] ?? 1;
    hud.showTimeScale(clock.timeScale);
  }

  let alpha = 1;
  if (!paused) {
    rig.look(input.mouseDX, input.mouseDY);
    if (input.wheel) rig.zoom(input.wheel);
    const move = readMoveInput();
    let dodgeConsumed = false;
    alpha = physics.advance(dt, (step) => {
      Object.assign(prevPlayer, player);
      stepPlayer(player, { ...move, dodge: move.dodge && !dodgeConsumed }, collision, step);
      dodgeConsumed = true;
    });
    sim.advance(dt, (step) => clock.advance(step));
  }

  // Interpolated render state.
  const rx = prevPlayer.x + (player.x - prevPlayer.x) * alpha;
  const rz = prevPlayer.z + (player.z - prevPlayer.z) * alpha;
  playerRoot.position.set(rx, 0, rz);
  playerRoot.rotation.y = player.facing;
  const frameDt = paused ? 0 : dt;
  if (animatedKael) animatedKael.update(frameDt, playerSpeed(player), player.state);
  else placeholderKael.animate(frameDt, playerSpeed(player), player.state, 1 - player.dodgeTime / PLAYER_TUNING.dodgeDuration);

  rig.update({ x: rx, y: 0, z: rz }, dt, collision.boxes);
  camera.position.set(rig.position.x, rig.position.y, rig.position.z);
  camera.lookAt(rig.pivot.x, rig.pivot.y, rig.pivot.z);

  focus.set(rx, 0, rz);
  dayNight.update(clock, focus);
  environment.update(scene, clock);
  grass?.update(paused ? 0 : dt, focus);
  if (world) {
    for (const m of world.nightGlow) m.emissiveIntensity = 0.2 + dayNight.night * 6;
    for (const [i, c] of world.clouds.entries()) {
      c.position.x += dt * (0.6 + (i % 3) * 0.25) * (paused ? 0 : 1);
      if (c.position.x > 300) c.position.x -= 600;
    }
  }
  updateNightLights();

  const district = districtAt(layout, player.x, player.z);
  const districtName = district?.name ?? (Math.hypot(player.x, player.z) > layout.wallRadius ? "Hors les murs" : "");
  if (started && districtName && districtName !== lastDistrict) hud.showDistrict(districtName);
  lastDistrict = districtName;

  postfx.focus.set(rx, 1.4, rz);
  postfx.exposureValue = 1 + dayNight.night * 1.1;
  postfx.render(dt);
  hud.update(clock, dt);

  fpsAcc += dt;
  fpsFrames++;
  if (fpsAcc >= 0.5) {
    fps = fpsFrames / fpsAcc;
    fpsAcc = 0;
    fpsFrames = 0;
  }
  hud.updateDebug({
    fps,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    x: player.x,
    z: player.z,
    state: player.state,
    speed: playerSpeed(player),
    timeScale: clock.timeScale,
  });

  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- test/debug hook
declare global {
  interface Window {
    __chronos?: unknown;
  }
}
window.__chronos = {
  start,
  get player() {
    return { x: player.x, z: player.z, state: player.state, facing: player.facing };
  },
  get clock() {
    return { day: clock.day, hour: clock.hour, minute: clock.minute, phase: clock.phase, timeScale: clock.timeScale };
  },
  setHour(h: number) {
    clock.totalMinutes = (clock.day - 1) * 1440 + h * 60;
  },
  setCamera(yaw: number, pitch: number, distance: number) {
    rig.yaw = yaw;
    rig.pitch = pitch;
    rig.desiredDistance = distance;
  },
  teleport(x: number, z: number, facing?: number) {
    player.x = x;
    player.z = z;
    if (facing !== undefined) player.facing = facing;
    Object.assign(prevPlayer, player);
  },
  renderInfo: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, fps }),
  get ready() {
    return ready;
  },
  get animated() {
    return animatedKael !== null;
  },
  get placeholders() {
    return world?.placeholders ?? [];
  },
  setQuality,
  loading,
};
