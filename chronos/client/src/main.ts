import * as THREE from "three";
import "./style.css";
import { FixedStep } from "./core/fixedStep";
import { Input } from "./core/input";
import { loadDefaultPack } from "./pack";
import type { ActsDef, CharacterDef, ExtrasDef } from "@chronos/shared";
import { FACTIONS, FACTION_LABELS, PLAYER_ID, SocialSystem } from "./sim/social";
import actsJson from "../data/packs/medieval/acts.json";
import { ACTIVITY_LABELS, createAgentSystem, type Agent } from "./sim/agents";
import { WorldClock } from "./sim/clock";
import { resolveCircleCircle } from "./sim/collision";
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
import { Crowd } from "./render/crowd";
import visualsJson from "../data/packs/medieval/visuals.json";
import charactersJson from "../data/packs/medieval/characters.json";
import extrasJson from "../data/packs/medieval/extras.json";

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
const characterDefs = (charactersJson as unknown as { characters: CharacterDef[] }).characters;
const agents = createAgentSystem(
  layout,
  collision,
  characterDefs,
  extrasJson as unknown as ExtrasDef,
  WORLD_SEED,
  clock,
);

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
  crowd?.setShadows(quality.crowdShadows);
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
const social = new SocialSystem(agents, actsJson as unknown as ActsDef, characterDefs, WORLD_SEED);
let coins = 10;
let crowd: Crowd | null = null;
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
  loadingEl.textContent = "Les habitants de Brumeval se réveillent…";
  crowd = await Crowd.create(lib, visuals.assetsBase, visuals.looks, visuals.crowd, agents.agents, quality.crowdShadows);
  scene.add(crowd.group);
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

const nameplatePos = new THREE.Vector3();
let nameplateAgent: Agent | null = null;
/** Shows who the closest inhabitant is and what they are doing. */
function updateNameplate(px: number, pz: number): void {
  const a = started && crowd ? agents.nearestTo(px, pz, 3.2) : null;
  nameplateAgent = a;
  if (!a || !crowd) {
    hud.hideNameplate();
    return;
  }
  nameplatePos.set(crowd.positions[a.index * 2] as number, 1.95 * a.scale, crowd.positions[a.index * 2 + 1] as number).project(camera);
  if (nameplatePos.z > 1) {
    hud.hideNameplate();
    return;
  }
  const place = agents.places.label(a.place);
  const doing = a.mode === "moving" && a.activity !== "patrol" && a.activity !== "wander" ? "est en route" : ACTIVITY_LABELS[a.activity];
  const known = social.topMemoryAbout(a, PLAYER_ID, clock.totalMinutes);
  const op = social.reputation.opinion(a.id);
  const mood = op <= -40 ? "te hait" : op <= -12 ? "se méfie de toi" : op >= 40 ? "t'admire" : op >= 12 ? "t'apprécie" : "";
  const knows = known
    ? `${known.kind === "heard" ? "A entendu dire que" : known.kind === "suffered" ? "N'oublie pas que" : "A vu que"} ${social.describe(known.claim, true)}`
    : "";
  const close = Math.hypot(a.x - player.x, a.z - player.z) < INTERACT_RANGE;
  hud.showNameplate(
    ((nameplatePos.x + 1) / 2) * window.innerWidth,
    ((1 - nameplatePos.y) / 2) * window.innerHeight,
    a.name,
    `${a.role} · ${doing}${place && a.mode !== "moving" ? " " + place : ""}`,
    a.key,
    [mood, knows].filter(Boolean).join(" · "),
    close ? "[E] aumône · [V] voler · [N] menacer · [B] frapper" : "",
  );
}

const INTERACT_RANGE = 2.4;
const ACT_KEYS: Record<string, string> = { KeyE: "give_alms", KeyV: "pickpocket", KeyN: "intimidate", KeyB: "assault" };

/** The player does something to an inhabitant. Everything that follows comes from the simulation. */
function playerAct(actId: string, target: Agent): void {
  if (actId === "give_alms") {
    if (coins <= 0) {
      hud.toast("Ta bourse est vide.");
      return;
    }
    coins--;
  }
  // A pickpocket goes unnoticed by the victim when done from behind.
  const toPlayerX = player.x - target.x;
  const toPlayerZ = player.z - target.z;
  const d = Math.hypot(toPlayerX, toPlayerZ) || 1;
  const facingPlayer = (Math.sin(target.facing) * toPlayerX + Math.cos(target.facing) * toPlayerZ) / d > 0.2;
  const before = { ...social.reputation.factions };
  const result = social.commit(
    actId,
    target,
    { actorId: PLAYER_ID, x: player.x, z: player.z, daylight: clock.daylight, targetNotices: actId === "pickpocket" ? facingPlayer : true },
    clock.totalMinutes,
  );
  if (actId === "pickpocket") coins += 1 + Math.floor(social.rng.next() * 5);
  const changes = FACTIONS.map((f) => ({ f, d: social.reputation.factions[f] - before[f] }))
    .filter((c) => Math.abs(c.d) >= 0.05)
    .map((c) => `${FACTION_LABELS[c.f]} ${c.d > 0 ? "+" : ""}${c.d.toFixed(1)}`);
  const seen = result.witnesses.length + (result.targetNoticed ? 1 : 0);
  hud.toast(seen === 0 ? "Personne n'a rien vu." : `${seen} témoin${seen > 1 ? "s" : ""}${changes.length ? " · " + changes.join(" · ") : ""}`);
  hud.setCoins(coins);
}

function updateSocialUi(): void {
  if (nameplateAgent && !paused && Math.hypot(nameplateAgent.x - player.x, nameplateAgent.z - player.z) < INTERACT_RANGE) {
    for (const [code, actId] of Object.entries(ACT_KEYS)) if (input.wasPressed(code)) playerAct(actId, nameplateAgent);
  }
  if (input.wasPressed("KeyJ")) hud.toggleJournal();
  hud.updateJournal(
    FACTIONS.map((f) => ({ label: FACTION_LABELS[f], value: social.reputation.factions[f] })),
    social.reputation.portrait(),
    social.feed,
  );
  // Emote bubbles above nearby inhabitants.
  if (!crowd) return;
  const bubbles: { x: number; y: number; text: string }[] = [];
  const now = clock.totalMinutes;
  for (const a of agents.agents) {
    if (a.insideOf || !a.emote || a.emoteUntil < now || bubbles.length >= 16) continue;
    const ax = crowd.positions[a.index * 2] as number;
    const az = crowd.positions[a.index * 2 + 1] as number;
    if ((ax - player.x) ** 2 + (az - player.z) ** 2 > 40 * 40) continue;
    nameplatePos.set(ax, 2.25 * a.scale, az).project(camera);
    if (nameplatePos.z > 1 || Math.abs(nameplatePos.x) > 1.05 || Math.abs(nameplatePos.y) > 1.05) continue;
    bubbles.push({ x: ((nameplatePos.x + 1) / 2) * window.innerWidth, y: ((1 - nameplatePos.y) / 2) * window.innerHeight, text: a.emote });
  }
  hud.showBubbles(bubbles);
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
  let simAlpha = 1;
  if (!paused) {
    rig.look(input.mouseDX, input.mouseDY);
    if (input.wheel) rig.zoom(input.wheel);
    const move = readMoveInput();
    let dodgeConsumed = false;
    alpha = physics.advance(dt, (step) => {
      Object.assign(prevPlayer, player);
      stepPlayer(player, { ...move, dodge: move.dodge && !dodgeConsumed }, collision, step);
      // Inhabitants are solid: the player slides around them.
      agents.forNeighbors(player.x, player.z, 1.5, (a) => {
        resolveCircleCircle(player, PLAYER_TUNING.radius, { x: a.x, z: a.z, r: 0.3, height: 1.7 });
      });
      dodgeConsumed = true;
    });
    simAlpha = sim.advance(dt, (step) => {
      clock.advance(step);
      agents.step(step, clock, player);
      social.step(clock.totalMinutes);
    });
  }

  // Interpolated render state.
  const rx = prevPlayer.x + (player.x - prevPlayer.x) * alpha;
  const rz = prevPlayer.z + (player.z - prevPlayer.z) * alpha;
  playerRoot.position.set(rx, 0, rz);
  playerRoot.rotation.y = player.facing;
  const frameDt = paused ? 0 : dt;
  if (animatedKael) animatedKael.update(frameDt, playerSpeed(player), player.state);
  else placeholderKael.animate(frameDt, playerSpeed(player), player.state, 1 - player.dodgeTime / PLAYER_TUNING.dodgeDuration);

  crowd?.update(frameDt * Math.min(clock.timeScale, 4), simAlpha);
  updateNameplate(rx, rz);
  updateSocialUi();

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
    agents: agents.counts(),
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
    agents.settle(clock);
  },
  get agents() {
    return {
      ...agents.counts(),
      total: agents.agents.length,
      rendered: crowd !== null,
      nameplate: nameplateAgent?.id ?? null,
    };
  },
  act(actId: string, agentId: string) {
    const a = agents.agents.find((x) => x.id === agentId);
    if (a) playerAct(actId, a);
  },
  get social() {
    return {
      reputation: { ...social.reputation.factions },
      portrait: social.reputation.portrait(),
      events: social.log.events.length,
      informed: [...social.informed.values()],
      feed: social.feed.map((f) => f.text),
      emotes: agents.agents.filter((a) => a.emote && a.emoteUntil >= clock.totalMinutes).length,
      coins,
    };
  },
  agent(id: string) {
    const a = agents.agents.find((x) => x.id === id);
    return a ? { x: a.x, z: a.z, activity: a.activity, place: a.place, mode: a.mode, insideOf: a.insideOf, anim: a.anim } : null;
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
