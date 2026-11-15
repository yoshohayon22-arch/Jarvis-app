import * as THREE from "three";
import "./style.css";
import { FixedStep } from "./core/fixedStep";
import { Input } from "./core/input";
import { loadDefaultPack } from "./pack";
import type { ActsDef, CharacterDef, ExtrasDef } from "@chronos/shared";
import { FACTIONS, FACTION_LABELS, PLAYER_ID, SocialSystem } from "./sim/social";
import actsJson from "../data/packs/medieval/acts.json";
import consequencesJson from "../data/packs/medieval/consequences.json";
import powersJson from "../data/powers.json";
import { AmbientSystem, type AmbientDef } from "./sim/ambient";
import { ConsequenceSystem, type ConsequencesDef } from "./sim/consequences";
import { MissionSystem, type Mission, type MissionsDef } from "./sim/missions";
import missionsJson from "../data/packs/medieval/missions.json";
import { AudioEngine, type Voice } from "./audio/audio";
import { StepCounter } from "./audio/mix";
import { MapView, type MapMarker, type MapState } from "./ui/mapView";
import { directions } from "./ui/mapMath";
import type { StoryChapter } from "./sim/missions";
import { generateMission, type GeneratedMission } from "./ai/missionGen";
import { applySave, captureSave, checkSave, type SaveGame, type SaveWorld } from "./save/saveGame";
import { IndexedDbBackend, MANUAL_SLOT, SaveStore } from "./save/store";
import type { MissionsSave } from "./sim/missions";
import { PropSystem } from "./sim/physics";
import { PowerSystem, type CastContext, type PowersData } from "./sim/powers";
import { ConsequenceView } from "./render/consequenceView";
import { PALETTE } from "./render/palette";
import { PowerFxView } from "./render/powerFx";
import { PropsView } from "./render/propsView";
import fallbackJson from "../data/packs/medieval/dialogue_fallback.json";
import { DIALOGUE_LIMITS, SUMMARY_LIMITS, type BudgetStatus, type DialogueRequest } from "@chronos/shared";
import { Conversation } from "./ai/conversation";
import { bark, localReply, type FallbackData } from "./ai/fallback";
import { AiGateway } from "./ai/gateway";
import { ACTIVITY_LABELS, createAgentSystem, type Agent } from "./sim/agents";
import { PHASE_LABELS, WorldClock } from "./sim/clock";
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

// ---------------------------------------------------------------- powers & consequences (J5)
const actsDef = actsJson as unknown as ActsDef;
const dynamicProps = new PropSystem(layout, collision);
const powers = new PowerSystem(powersJson as unknown as PowersData, agents, dynamicProps, social, clock);
const consequences = new ConsequenceSystem(consequencesJson as unknown as ConsequencesDef, agents, social, actsDef, clock);
const ambient = new AmbientSystem(agents, social, (consequencesJson as unknown as { ambient: AmbientDef }).ambient, clock, WORLD_SEED);
const missions = new MissionSystem(agents, social, clock, missionsJson as unknown as MissionsDef, WORLD_SEED);
powers.echoPinned = () => missions.sceneEvents();
const agentsById = new Map(agents.agents.map((a) => [a.id, a]));
const nameOf = (id: string | null): string => (id === PLAYER_ID ? "Kael" : id ? agentsById.get(id)?.name ?? "quelqu'un" : "");
powers.captureExtra = () => ({ coins, missions: missions.save() });
powers.restoreExtra = (e) => {
  const x = e as { coins: number; missions: MissionsSave } | null;
  coins = x?.coins ?? coins;
  // A mission accepted or advanced during the rewound seconds goes back with them.
  if (x?.missions) missions.load(x.missions);
};
powers.movePlayer = (x, z, facing) => {
  Object.assign(player, { x, z, facing, vx: 0, vz: 0 });
  Object.assign(prevPlayer, player);
};
consequences.onArrest = () => {
  // Fined, jailed until dawn, released in the barracks yard.
  coins = 0;
  powers.reveal();
  powers.dropDisguise();
  const yard = agents.places.spots.get("barracks_yard");
  if (yard) powers.movePlayer(yard.pos[0], yard.pos[1], 0);
  const jail = consequencesDef.wanted.jailUntilHour;
  const day = Math.floor(clock.totalMinutes / 1440);
  let release = day * 1440 + jail * 60;
  if (release <= clock.totalMinutes) release += 1440;
  clock.totalMinutes = release;
  agents.settle(clock);
};
const consequencesDef = consequencesJson as unknown as ConsequencesDef;
let propsView: PropsView | null = null;
let consequenceView: ConsequenceView | null = null;
const powerFx = new PowerFxView();
const POWER_SLOTS = powers.castable().map((c) => ({ id: c.ability.id, code: c.ability.key as string, vfx: c.power.vfx ?? "time" }));

function castContext(): CastContext {
  const b = rig.basis();
  return { player: { x: player.x, z: player.z, facing: player.facing, speed: playerSpeed(player) }, aimX: b.fx, aimZ: b.fz, daylight: clock.daylight };
}

const CAST_FAILURES: Record<string, string> = {
  cooldown: "Ce pouvoir n'est pas encore prêt.",
  energy: "Pas assez d'énergie.",
  locked: "Tu n'as pas encore éveillé ce pouvoir.",
  no_target: "Rien à portée dans cette direction.",
  not_studied: "Tu ne connais pas encore assez ce visage : reste près de cette personne quelques instants.",
  nothing_here: "Ce lieu n'a rien à raconter : il ne s'y est rien passé depuis hier.",
};

function ageLabel(minutes: number): string {
  if (minutes < 60) return `il y a ${Math.max(1, Math.round(minutes))} min`;
  return `il y a ${Math.round(minutes / 60)} h`;
}

/** Turns what the Echo read in the world log into ghosts and plain sentences. Nothing is invented here. */
function showEcho(): void {
  const visions = powers.lastEcho;
  powerFx.spawnEcho(visions.map((v) => ({ x: v.x, z: v.z, undone: v.undone, fold: v.fold, hasTarget: v.targetId !== null, masked: v.masked })));
  const lines = visions.map((v) => {
    if (v.fold) return { text: `${ageLabel(v.age)} — le temps s'est replié ici.`, tone: "undone" };
    const label = actsDef.acts[v.act]?.label ?? v.act;
    let text = `${ageLabel(v.age)} — ${nameOf(v.actorId)} ${label} ${nameOf(v.targetId)}`.trim();
    if (v.masked) text += ` — sous le visage de ${nameOf(v.apparentActorId)}`;
    if (v.undone) text += " (effacé : cela n'a jamais eu lieu)";
    if (v.witnessIds.length) text += ` · vu par ${v.witnessIds.slice(0, 3).map(nameOf).join(", ")}${v.witnessIds.length > 3 ? ` et ${v.witnessIds.length - 3} autres` : ""}`;
    else if (powers.resolved("echo")?.effects?.some((e) => e.showWitnesses)) text += " · sans témoin";
    if (powers.leverage.has(v.actorId) && v.actorId !== PLAYER_ID) text += " · tu tiens cette personne";
    return { text: text + ".", tone: v.undone ? "undone" : v.masked ? "masked" : "" };
  });
  hud.showEcho(lines);
  missions.noteEcho(visions);
  for (const l of lines.slice(0, 3)) social.pushFeed(clock.totalMinutes, `Écho : ${l.text}`, "neutral");
}

function castPower(id: string): void {
  const before = { ...social.reputation.factions };
  const r = powers.cast(id, castContext());
  if (!r.ok) {
    if (r.reason === "no_target" && id === "rewind") hud.toast("Le temps n'a encore rien à rendre.");
    else hud.toast(CAST_FAILURES[r.reason ?? ""] ?? "Impossible.");
    return;
  }
  animatedKael?.gesture("cast", 0.5);
  if (id === "rewind") hud.flash("time");
  if (id === "echo") showEcho();
  const changes = FACTIONS.map((f) => ({ f, d: social.reputation.factions[f] - before[f] }))
    .filter((c) => Math.abs(c.d) >= 0.05)
    .map((c) => `${FACTION_LABELS[c.f]} ${c.d > 0 ? "+" : ""}${c.d.toFixed(1)}`);
  if (id === "disguise" && powers.disguise)
    hud.toast(`Tu portes le visage de ${nameOf(powers.disguise.agentId)} : évite cette personne et ses proches.${changes.length ? " On t'a vu changer · " + changes.join(" · ") : ""}`);
  else if (changes.length) hud.toast(`${r.ability?.name} · ${changes.join(" · ")}`);
  hud.setCoins(coins);
}
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
  crowd.frozenTint.set(PALETTE.vfx.time?.hero ?? "#bfe6ff");
  [propsView, consequenceView] = await Promise.all([
    PropsView.create(layout, visuals, lib, dynamicProps.props),
    ConsequenceView.create(agents.places, visuals, lib, WORLD_SEED),
  ]);
  if (detail && quality.detailMaterials) for (const m of lib.loaded()) enhanceModel(m, detail);
  scene.add(propsView.group, consequenceView.group, powerFx.group);
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
  // Pick the environment map before compiling, so shaders are built once with it.
  environment.update(scene, clock);
  renderer.compile(scene, camera);
  ready = true;
  loadingEl.textContent = "";
  ctaEl.classList.remove("hidden");
  void refreshTitle();
})().catch((e) => {
  console.error(e);
  loadingEl.textContent = "Erreur de chargement — voir la console.";
});

// ---------------------------------------------------------------- title / pause
const title = document.getElementById("title") as HTMLElement;
const pauseEl = document.getElementById("pause") as HTMLElement;
let started = false;
let paused = true;

// ---------------------------------------------------------------- sound
const audio = new AudioEngine();
const stepCounter = new StepCounter();
const tavernPos = layout.buildings.find((b) => b.id === "tavern")?.pos ?? [0, 0];
let ambienceAt = 0;
let chatterAt = 6;
/** A stable voice per inhabitant, from their look. */
function voiceOf(a: Agent): Voice {
  const feminine = (visuals.looks[a.look] as { feminine?: boolean } | undefined)?.feminine === true;
  if (feminine) return a.index % 2 ? "female_light" : "female_standard";
  return a.index % 3 === 0 || a.faction === "royal_guard" ? "male_deep" : "male_standard";
}
function hurtSound(a: Agent): void {
  const feminine = (visuals.looks[a.look] as { feminine?: boolean } | undefined)?.feminine === true;
  if (feminine) audio.playVariant("hurt_f", 2, { at: a, volume: 0.9 });
  else audio.playVariant("hurt_m", 6, { at: a, volume: 0.9 });
}
const POWER_SOUNDS: Record<string, [string, number]> = {
  zone: ["spell_2", 0.8], freeze: ["spell_1", 1.2], rewind: ["chime_2", 0.7], loop: ["spell_4", 0.7], stasis: ["spell_1", 0.8],
  grab: ["spell_2", 1.3], throw: ["swish_2", 0.8], shove: ["swish_3", 0.7], cloak: ["spell_2", 0.6], uncloak: ["spell_2", 0.9],
  echo: ["chime_2", 0.55], mask: ["cloth", 0.8], unmask: ["cloth", 1.1],
};

/** Steps, ambience, music and the murmur of people nearby. */
function updateAudio(dt: number, moved: number): void {
  const b = rig.basis();
  audio.setListener(player.x, player.z, b.rx, b.rz);
  if (paused || !started) return;
  // A jump in position (teleport, loaded save, rewind) is not walking.
  if (moved > 1.5) stepCounter.reset();
  else if (player.state !== "dodge" && moved > 0) {
    const steps = stepCounter.advance(moved, player.state === "run");
    if (steps > 0 && !powers.cloaked) {
      const paved = districtAt(layout, player.x, player.z)?.id === "market";
      audio.playVariant(paved ? "step_stone" : "step_soft", 6, { volume: player.state === "run" ? 0.5 : 0.34 });
    }
  }
  ambienceAt -= dt;
  if (ambienceAt <= 0) {
    ambienceAt = 0.5;
    let crowdNear = 0;
    agents.forNeighbors(player.x, player.z, 18, (a) => {
      if (!a.insideOf) crowdNear++;
    });
    audio.updateAmbience({
      daylight: clock.daylight,
      crowdNear,
      tavernDistance: Math.hypot(player.x - (tavernPos[0] as number), player.z - (tavernPos[1] as number)),
      hour: clock.minuteOfDay / 60,
      outside: Math.hypot(player.x, player.z) > layout.wallRadius,
    });
  }
  // People talking among themselves: a voice here and there, placed in space.
  chatterAt -= dt;
  if (chatterAt <= 0) {
    chatterAt = 1.6 + Math.random() * 3.2;
    const near: Agent[] = [];
    agents.forNeighbors(player.x, player.z, 15, (a) => {
      if (!a.insideOf && a.mode === "acting" && (a.activity === "socialize" || a.activity === "work" || a.activity === "eat") && a.frozenUntil <= clock.totalMinutes) near.push(a);
    });
    const who = near[Math.floor(Math.random() * near.length)];
    if (who) audio.speak(voiceOf(who), "un mot ou deux en passant", who, 0.5);
  }
}

function start(): void {
  if (!ready) return;
  audio.unlock();
  audio.setPaused(false);
  audio.preload(["hit_1", "hit_2", "swish_1", "step_stone_1", "step_soft_1", "coins", "spell_1", "spell_2", "chime", "voice_male_standard_1"]);
  started = true;
  paused = false;
  title.classList.add("hidden");
  pauseEl.classList.add("hidden");
  input.requestPointerLock();
}
function pauseGame(): void {
  if (document.pointerLockElement) document.exitPointerLock();
  audio.setPaused(true);
  paused = true;
  pauseEl.classList.remove("hidden");
  refreshAiStatus();
  refreshSettingsUi();
  void refreshSaveList();
}

// ---------------------------------------------------------------- save / load / settings (J8)
const saveWorld: SaveWorld = { packId: "medieval", seed: WORLD_SEED, clock, agents, social, props: dynamicProps, powers, consequences, ambient, missions };
const saves = new SaveStore(new IndexedDbBackend());
const AUTOSAVE_EVERY_MINUTES = 120;
let lastAutosaveAt = clock.totalMinutes;
let lastSaveInfo = "aucune";
let saving = false;

function snapshot(): SaveGame {
  return captureSave(saveWorld, { x: player.x, z: player.z, facing: player.facing, coins }, [...aiSummaries]);
}

/** Writes the game to IndexedDB. Never throws: a full or blocked storage must not stop the game. */
async function saveGame(kind: "manual" | "auto"): Promise<boolean> {
  if (!started || saving) return false;
  saving = true;
  try {
    const save = snapshot();
    const slot = kind === "manual" ? (await saves.saveManual(save), MANUAL_SLOT) : await saves.saveAuto(save);
    lastAutosaveAt = clock.totalMinutes;
    lastSaveInfo = `${save.label} (${slot})`;
    if (kind === "manual") hud.toast(`Partie sauvegardée — ${save.label}`);
    return true;
  } catch (e) {
    console.warn("Save failed", e);
    if (kind === "manual") hud.toast("Sauvegarde impossible : le stockage du navigateur est indisponible.");
    return false;
  } finally {
    saving = false;
  }
}

async function loadGame(slot: string): Promise<boolean> {
  let raw: unknown;
  try {
    raw = await saves.load(slot);
  } catch {
    hud.toast("Chargement impossible : le stockage du navigateur est indisponible.");
    return false;
  }
  // A save is outside data: checked like any other input before it touches the world.
  const problem = checkSave(raw, saveWorld);
  if (problem) {
    hud.toast(`Chargement refusé : ${problem}.`);
    return false;
  }
  const save = raw as SaveGame;
  closeDialogue();
  offer = null;
  hud.showMissionOffer(null);
  drafts.clear();
  const p = applySave(save, saveWorld);
  Object.assign(player, { x: p.x, z: p.z, facing: p.facing, vx: 0, vz: 0 });
  Object.assign(prevPlayer, player);
  coins = p.coins;
  aiSummaries.clear();
  for (const [k, v] of save.aiSummaries) aiSummaries.set(k, v);
  lastAutosaveAt = clock.totalMinutes;
  lastSaveInfo = `${save.label} (${slot})`;
  hud.setCoins(coins);
  hud.toast(`Partie chargée — ${save.label}`);
  return true;
}

const SLOT_LABELS: Record<string, string> = { manual: "Sauvegarde manuelle", "auto-0": "Sauvegarde auto", "auto-1": "Sauvegarde auto", "auto-2": "Sauvegarde auto" };
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stop = (e: Event) => e.stopPropagation();

async function refreshSaveList(): Promise<void> {
  const list = await saves.list().catch(() => []);
  const box = el("save-list");
  box.replaceChildren();
  for (const s of list) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.slot = s.slot;
    b.textContent = s.label;
    const small = document.createElement("small");
    small.textContent = `${SLOT_LABELS[s.slot] ?? s.slot} · ${new Date(s.savedAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
    b.append(small);
    b.addEventListener("click", (e) => {
      stop(e);
      void loadGame(s.slot).then((ok) => ok && start());
    });
    box.append(b);
  }
}

// Settings: the player's own limits on AI use, kept in this browser.
const SETTINGS_KEY = "chronos.settings";
function loadSettings(): void {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as { aiEnabled?: unknown; sessionCapUsd?: unknown; volume?: unknown; music?: unknown };
    audio.settings = { volume: typeof raw.volume === "number" ? Math.max(0, Math.min(1, raw.volume)) : 0.8, music: raw.music !== false };
    gateway.settings = {
      enabled: raw.aiEnabled !== false,
      sessionCapUsd: typeof raw.sessionCapUsd === "number" && raw.sessionCapUsd > 0 ? raw.sessionCapUsd : null,
    };
  } catch {
    /* unreadable settings: keep defaults */
  }
}
function storeSettings(): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ aiEnabled: gateway.settings.enabled, sessionCapUsd: gateway.settings.sessionCapUsd, volume: audio.settings.volume, music: audio.settings.music }));
  } catch {
    /* private mode: settings last for the session only */
  }
}
function refreshSettingsUi(): void {
  el<HTMLInputElement>("set-ai").checked = gateway.settings.enabled;
  el<HTMLSelectElement>("set-cap").value = gateway.settings.sessionCapUsd === null ? "" : String(gateway.settings.sessionCapUsd);
  el<HTMLSelectElement>("set-quality").value = qualityLevel;
  el<HTMLInputElement>("set-volume").value = String(Math.round(audio.settings.volume * 100));
  el<HTMLInputElement>("set-music").checked = audio.settings.music;
  const g = gateway.stats;
  const server = aiStatus ? `serveur : ${aiStatus.spentTodayUsd.toFixed(4)} $ sur ${aiStatus.dailyLimitUsd} $ aujourd'hui (${aiStatus.mode === "ai" ? aiStatus.model : aiStatus.mode === "mock" ? "IA simulée" : "pas de clé"})` : "serveur IA injoignable : tout est local";
  el("set-spend").textContent = `Cette session : ${g.sessionCostUsd.toFixed(4)} $ · ${g.aiReplies} répliques, ${g.missionCalls} missions, ${g.summaryCalls} résumés · ${server}`;
}
el("pause-card").addEventListener("click", stop);
el<HTMLInputElement>("set-volume").addEventListener("input", (e) => {
  audio.settings.volume = Number((e.target as HTMLInputElement).value) / 100;
  audio.applyVolume();
  storeSettings();
});
el<HTMLInputElement>("set-music").addEventListener("change", (e) => {
  audio.settings.music = (e.target as HTMLInputElement).checked;
  storeSettings();
});
el<HTMLInputElement>("set-ai").addEventListener("change", (e) => {
  gateway.settings.enabled = (e.target as HTMLInputElement).checked;
  storeSettings();
});
el<HTMLSelectElement>("set-cap").addEventListener("change", (e) => {
  const v = Number((e.target as HTMLSelectElement).value);
  gateway.settings.sessionCapUsd = v > 0 ? v : null;
  storeSettings();
});
el<HTMLSelectElement>("set-quality").addEventListener("change", (e) => setQuality((e.target as HTMLSelectElement).value === "high" ? "high" : "low"));
el("btn-resume").addEventListener("click", start);
el("btn-save").addEventListener("click", () => void saveGame("manual").then(refreshSaveList));
// Two clicks instead of a browser dialog (dialogs are unavailable in some embedded views).
el("btn-restart").addEventListener("click", (e) => {
  const b = e.currentTarget as HTMLButtonElement;
  if (b.dataset.armed === "1") {
    window.location.reload();
    return;
  }
  b.dataset.armed = "1";
  b.textContent = "Confirmer : recommencer (les sauvegardes sont conservées)";
  window.setTimeout(() => {
    b.dataset.armed = "";
    b.textContent = "Recommencer depuis le début";
  }, 4000);
});
el("btn-new").addEventListener("click", (e) => {
  stop(e);
  start();
});
el("btn-continue").addEventListener("click", (e) => {
  stop(e);
  const slot = (e.currentTarget as HTMLElement).dataset.slot;
  if (slot) void loadGame(slot).then((ok) => ok && start());
});
/** Title screen: offer to continue when a save exists. */
async function refreshTitle(): Promise<void> {
  const latest = await saves.latest().catch(() => null);
  if (!latest || started) return;
  const b = el("btn-continue");
  b.dataset.slot = latest.slot;
  b.textContent = `Continuer — ${latest.label}`;
  el("title-menu").classList.remove("hidden");
  ctaEl.classList.add("hidden");
  hasSave = true;
}
let hasSave = false;
// Leaving the tab: keep what was played.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") void saveGame("auto");
});

title.addEventListener("click", () => {
  if (!hasSave) start();
});
pauseEl.addEventListener("click", start);
canvas.addEventListener("click", () => {
  if (started && !paused && !hud.dialogueOpen && !document.pointerLockElement) input.requestPointerLock();
});
document.addEventListener("pointerlockchange", () => {
  if (started && !paused && !document.pointerLockElement && !hud.dialogueOpen) {
    pauseGame();
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
  const a = started && crowd && !hud.dialogueOpen ? agents.nearestTo(px, pz, 4.2) : null;
  nameplateAgent = a;
  const reach = a && !paused && Math.hypot(a.x - player.x, a.z - player.z) < INTERACT_RANGE;
  const job = reach && a && !offer && !offerBusy ? (missions.storyFor(a.id) ? " · [M] écouter ce qu'il a à te confier" : missions.offerOf(a.id) ? " · [M] demander du travail" : "") : "";
  hud.setTalkPrompt(reach && a ? `[F] Parler à ${a.name}${job}` : "");
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
  const mask = powers.disguise?.agentId ?? null;
  const op = mask ? (mask === a.id ? 0 : Math.max(social.relation(a.id, mask), social.reputation.opinion(a.id, mask))) : social.reputation.opinion(a.id);
  const mood = mask ? (mask === a.id ? "c'est son visage que tu portes" : `te prend pour ${nameOf(mask)}`) : op <= -40 ? "te hait" : op <= -12 ? "se méfie de toi" : op >= 40 ? "t'admire" : op >= 12 ? "t'apprécie" : "";
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
    [
      close && started && !offer && !offerBusy && missions.offerOf(a.id) ? "[M] demander du travail" : "",
      close ? `[F] parler · [E] aumône · [V] voler · [N] ${powers.leverage.has(a.id) ? "faire chanter" : "menacer"} · [B] frapper` : "",
      powers.unlocked.has("disguise") && !mask ? (powers.studyLeft(a.id) <= 0 ? "visage mémorisé [9]" : `étude du visage… ${Math.ceil(powers.studyLeft(a.id))} s`) : "",
    ]
      .filter(Boolean)
      .join(" · "),
  );
}

const INTERACT_RANGE = 3.2;
const ACT_KEYS: Record<string, string> = { KeyE: "give_alms", KeyV: "pickpocket", KeyN: "intimidate", KeyB: "assault" };

/** The player does something to an inhabitant. Everything that follows comes from the simulation. */
function playerAct(actId: string, target: Agent): void {
  // A secret read in the Echo turns a threat into blackmail.
  const blackmail = actId === "intimidate" && powers.leverage.has(target.id);
  if (blackmail) actId = "blackmail";
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
    {
      actorId: PLAYER_ID,
      // Under a false face, witnesses remember someone else.
      apparentActorId: powers.apparentId,
      x: player.x,
      z: player.z,
      daylight: clock.daylight,
      hidden: powers.cloaked,
      // Unseen hands: under the Shadow, the victim never notices a theft.
      targetNotices: actId === "pickpocket" ? facingPlayer && !powers.cloaked : true,
    },
    clock.totalMinutes,
  );
  if (actId === "pickpocket") coins += (1 + Math.floor(social.rng.next() * 5)) * powers.theftMultiplier;
  if (actId === "assault") {
    // The blow itself: Kael swings, the victim staggers back.
    player.facing = Math.atan2(target.x - player.x, target.z - player.z);
    animatedKael?.gesture("attack", 0.45);
    const k = 0.7 / d;
    const nx = target.x - toPlayerX * k;
    const nz = target.z - toPlayerZ * k;
    if (agents.places.nav.isWalkable(nx, nz)) Object.assign(target, { x: nx, z: nz });
    powerFx.impact(target.x, target.z);
    audio.playVariant("swish", 4, { volume: 0.7 });
    audio.play(`hit_${1 + Math.floor(Math.random() * 6)}`, { volume: 0.9, delay: 0.1, at: target });
    hurtSound(target);
  }
  if (actId === "pickpocket") audio.play("cloth", { volume: 0.6 });
  if (actId === "give_alms" || actId === "blackmail") audio.play("coins", { volume: 0.7 });
  if (actId === "intimidate") audio.play("draw", { volume: 0.6 });
  // Striking or threatening someone breaks the Shadow.
  if (actId === "assault" || actId === "intimidate" || actId === "blackmail") powers.reveal();
  if (blackmail) {
    coins += 15;
    powers.leverage.delete(target.id);
    social.pushFeed(clock.totalMinutes, `${target.name} a payé 15 pièces pour ton silence.`, "bad");
  }
  const changes = FACTIONS.map((f) => ({ f, d: social.reputation.factions[f] - before[f] }))
    .filter((c) => Math.abs(c.d) >= 0.05)
    .map((c) => `${FACTION_LABELS[c.f]} ${c.d > 0 ? "+" : ""}${c.d.toFixed(1)}`);
  const seen = result.witnesses.length + (result.targetNoticed ? 1 : 0);
  const blamed = powers.disguise ? ` · on accusera ${nameOf(powers.disguise.agentId)}` : "";
  hud.toast(seen === 0 ? "Personne n'a rien vu." : `${seen} témoin${seen > 1 ? "s" : ""}${changes.length ? " · " + changes.join(" · ") : ""}${blamed}`);
  hud.setCoins(coins);
}

// ---------------------------------------------------------------- dialogue (J4)
const gateway = new AiGateway();
loadSettings();
const fallbackData = fallbackJson as unknown as FallbackData;
const defsById = new Map(characterDefs.map((c) => [c.id, c]));
let conversation: Conversation | null = null;
let talkingTo: Agent | null = null;
let aiStatus: BudgetStatus | null = null;
let aiStatusAt = -Infinity;

function refreshAiStatus(): void {
  aiStatusAt = performance.now();
  void gateway.budget().then((b) => (aiStatus = b));
}

function aiDebugLine(): string {
  const g = gateway.stats;
  if (!aiStatus) return `IA : proxy injoignable → répliques locales (${g.localReplies})`;
  const mode = aiStatus.mode === "ai" ? `IA ${aiStatus.model}` : aiStatus.mode === "mock" ? "IA simulée" : "pas de clé → repli local";
  return (
    `${mode}${aiStatus.exceeded ? " · BUDGET ATTEINT → repli" : ""} · ${aiStatus.calls} appels · cache ${aiStatus.cacheHits}\n` +
    `tokens ${aiStatus.inputTokens} entrée / ${aiStatus.outputTokens} sortie / ${aiStatus.cacheReadTokens} cache · ` +
    `${aiStatus.spentTodayUsd.toFixed(4)} $ / ${aiStatus.dailyLimitUsd} $ aujourd'hui · locales ${g.localReplies}`
  );
}

/** Who the inhabitant believes they are talking to, and what they think of that person. */
function speakerId(): string {
  return powers.apparentId;
}
function opinionOfSpeaker(a: Agent): number {
  const who = speakerId();
  if (who === PLAYER_ID) return social.reputation.opinion(a.id);
  // Their existing tie to the imitated person, shifted by what they saw "them" do.
  return Math.max(-100, Math.min(100, social.relation(a.id, who) + social.reputation.opinion(a.id, who)));
}

/** AI summaries of what a character remembers of Kael (optional; saved with the game so they are paid once). */
const aiSummaries = new Map<string, { key: string; text: string }>();
const memoryLine = (m: { kind: string; claim: Parameters<typeof social.describe>[0] }) =>
  `${m.kind === "heard" ? "On t'a raconté que" : m.kind === "suffered" ? "Tu as subi ceci :" : "Tu as vu que"} ${social.describe(m.claim)}`.slice(0, 200);

/** With many memories of Kael, asks once for a two-sentence summary; redone only after three new memories. */
function requestSummary(a: Agent): void {
  if (powers.disguise) return;
  const mems = social.memory.relevant(a.id, PLAYER_ID, clock.totalMinutes, a.traits.grudge, SUMMARY_LIMITS.memoriesMax);
  if (mems.length < SUMMARY_LIMITS.memoriesMin) return;
  const ids = mems.map((m) => m.eventId).sort((x, y) => x - y);
  const known = new Set((aiSummaries.get(a.id)?.key ?? "").split(",").filter(Boolean).map(Number));
  if (known.size > 0 && ids.filter((id) => !known.has(id)).length < 3) return;
  void gateway.summary({ characterId: a.id, memories: mems.map(memoryLine) }).then((text) => {
    if (text) aiSummaries.set(a.id, { key: ids.join(","), text });
    refreshAiStatus();
  });
}

function openDialogue(a: Agent): void {
  if (powers.disguise?.agentId === a.id) {
    hud.toast(`${a.name} te dévisage : c'est son propre visage.`);
    return;
  }
  missions.noteTalk(a.id);
  const def = defsById.get(a.id);
  talkingTo = a;
  conversation = new Conversation(a.id, def?.secrets ?? []);
  if (def) requestSummary(a);
  agents.hold(a, player.x, player.z, clock.totalMinutes);
  hud.openDialogue(a.name, a.role);
  if (document.pointerLockElement) document.exitPointerLock();
  // They speak first: a greeting that fits what they think of Kael (extras: a remark of their own).
  const hello = def ? localReply(fallbackData, "bonjour", opinionOfSpeaker(a), true, social.rng.next()).line : bark(fallbackData, a.faction, opinionOfSpeaker(a), social.rng.next());
  hud.addDialogueLine("npc", hello);
  audio.speak(voiceOf(a), hello, a, 0.85);
  if (def) refreshAiStatus();
}

function closeDialogue(): void {
  if (!hud.dialogueOpen) return;
  hud.closeDialogue();
  if (talkingTo) talkingTo.nextThinkAt = clock.totalMinutes; // back to their day
  talkingTo = null;
  conversation = null;
  input.requestPointerLock();
}

async function sayToNpc(text: string): Promise<void> {
  const a = talkingTo;
  const conv = conversation;
  if (!a || !conv) return;
  const who = speakerId();
  const opinion = opinionOfSpeaker(a);
  const now = clock.totalMinutes;
  const memories = social.memory.relevant(a.id, who, now, a.traits.grudge, DIALOGUE_LIMITS.memoriesMax).map(memoryLine);
  // A summary stands for the long tail of memories; the freshest ones stay verbatim.
  const summary = who === PLAYER_ID ? aiSummaries.get(a.id) : undefined;
  if (summary) {
    memories.length = Math.min(memories.length, DIALOGUE_LIMITS.memoriesMax - 1);
    memories.unshift(summary.text);
  }
  // A giver remembers the job they handed out (plain fact from the missions runtime).
  const given = who === PLAYER_ID ? missions.missions.find((m) => m.proposal.giverId === a.id) : undefined;
  if (given) {
    const state = given.status === "done" ? "Kael l'a menée à bien" : given.status === "failed" ? "Kael a échoué" : "elle est en cours";
    memories.unshift(`Tu as confié une mission à Kael (« ${given.proposal.title} ») : ${state}.`.slice(0, 200));
    memories.length = Math.min(memories.length, DIALOGUE_LIMITS.memoriesMax);
  }
  let bystanders = 0;
  let guardNearby = false;
  agents.forNeighbors(a.x, a.z, 8, (o) => {
    if (o === a) return;
    bystanders++;
    if (o.faction === "royal_guard") guardNearby = true;
  });
  const request: DialogueRequest = {
    characterId: a.id,
    playerText: text.slice(0, DIALOGUE_LIMITS.playerTextMax),
    history: conv.history(),
    context: {
      opinion,
      // An imitated face borrows that person's standing, not the hero's.
      factionReputation: who === PLAYER_ID ? social.reputation.factions[a.faction] : 0,
      memories,
      ...(who !== PLAYER_ID ? { speaker: { name: nameOf(who) } } : {}),
      scene: {
        time: `${clock.format()} (${PHASE_LABELS[clock.phase].toLowerCase()})`,
        place: agents.places.label(a.place).slice(0, 80),
        activity: ACTIVITY_LABELS[a.activity],
        bystanders,
        guardNearby,
      },
    },
  };
  conv.addPlayer(request.playerText);
  hud.addDialogueLine("player", request.playerText);
  const pending = hud.addDialogueLine("pending", `${a.name} réfléchit…`);
  hud.setDialogueBusy(true);
  const firstTurn = conv.turns.length === 1;
  // Extras never use AI: they answer with local lines, like everyone does offline.
  const local = () => localReply(fallbackData, request.playerText, opinion, firstTurn, social.rng.next());
  const result = defsById.has(a.id)
    ? await gateway.dialogue(request, defsById.get(a.id)?.secrets?.length ?? 0, local)
    : { reply: local(), source: "local" as const, reason: "figurant" };
  pending.remove();
  if (conversation !== conv) return; // the player walked away meanwhile
  const effects = conv.apply(result.reply, opinion, result.source !== "local");
  hud.addDialogueLine("npc", result.reply.line);
  audio.speak(voiceOf(a), result.reply.line, a, 0.85);
  if (effects.opinionDelta !== 0) {
    social.reputation.nudgeOpinion(a.id, effects.opinionDelta, who);
    const whom = who === PLAYER_ID ? "t'" : `${nameOf(who)} : l'`;
    hud.addDialogueLine("system", `${a.name} ${effects.opinionDelta > 0 ? `${whom}apprécie un peu plus` : `${whom}apprécie un peu moins`} (${effects.opinionDelta > 0 ? "+" : ""}${effects.opinionDelta}).`);
  }
  if (effects.secret) {
    social.pushFeed(now, `Secret confié par ${a.name} : ${effects.secret}`, "neutral");
    hud.addDialogueLine("system", "Un secret a été noté dans ton journal (J).");
  }
  if (effects.callGuard) {
    let called = 0;
    for (const g of agents.agents) {
      if (g.faction !== "royal_guard" || g.insideOf || Math.hypot(g.x - a.x, g.z - a.z) > 30) continue;
      agents.react(g, "confront", player.x, player.z, now, "!");
      called++;
    }
    agents.setEmote(a, "!", now, 4);
    hud.addDialogueLine("system", called ? `${a.name} appelle la garde !` : `${a.name} appelle la garde, mais personne n'entend.`);
  }
  const label = result.source === "ai" ? "IA" : result.source === "cache" ? "IA (cache)" : result.source === "mock" ? "IA simulée" : `réplique locale — ${result.reason}`;
  hud.setDialogueBusy(false, label);
  refreshAiStatus();
  if (effects.end) window.setTimeout(closeDialogue, 1800);
}
hud.bindDialogue((text) => void sayToNpc(text), closeDialogue);

// ---------------------------------------------------------------- missions (J7)
const INTENT_LABELS = { investigate: "enquête", protect: "protection", infiltrate: "infiltration" } as const;
let offer: { giver: Agent; gen: GeneratedMission; storyId?: string } | null = null;
let offerBusy = false;
let lastGen: GeneratedMission | null = null;
/** Drafts already paid for: asking the same person again shows the same offer. */
const drafts = new Map<string, GeneratedMission>();

function sourceLabel(g: GeneratedMission): string {
  if (g.source === "story") return "histoire principale";
  if (g.source === "ai") return g.attempts > 1 ? `IA (${g.attempts} essais)` : "IA";
  if (g.source === "mock") return g.attempts > 1 ? `IA simulée (${g.attempts} essais)` : "IA simulée";
  return `mission locale — ${g.fallbackReason ?? "sans IA"}`;
}

async function requestMission(giver: Agent): Promise<boolean> {
  const intent = missions.offerOf(giver.id);
  if (!intent || offerBusy || offer) return false;
  offerBusy = true;
  hud.setMissionBusy(`${giver.name} réfléchit à ce qu'il pourrait te confier…`);
  agents.hold(giver, player.x, player.z, clock.totalMinutes, 2);
  // The main story comes first: its chapters are written by hand, no AI involved.
  const chapter = missions.storyFor(giver.id);
  if (chapter) {
    offerBusy = false;
    hud.setMissionBusy("");
    const p = chapter.proposal;
    offer = { giver, gen: { proposal: p, source: "story", attempts: 0, rejections: [], fallbackReason: null, costUsd: 0 }, storyId: chapter.id };
    hud.showMissionOffer({ giver: `${giver.name} — histoire principale`, title: p.title, briefing: p.briefing, steps: p.steps.map((st) => st.text), hours: p.timeLimitHours, source: `chapitre ${chapter.chapter} sur ${missions.storyProgress.total}` });
    audio.speak(voiceOf(giver), p.briefing, giver, 0.85);
    return true;
  }
  let gen = drafts.get(giver.id) ?? null;
  // A draft made earlier may no longer fit the world (someone was jailed since).
  if (gen && missions.validate(gen.proposal, intent, giver.id).length) gen = null;
  gen ??= await generateMission(missions, (req) => gateway.mission(req), intent, giver.id);
  offerBusy = false;
  hud.setMissionBusy("");
  refreshAiStatus();
  if (!gen) {
    hud.toast(`${giver.name} n'a rien à te confier pour l'instant.`);
    return false;
  }
  lastGen = gen;
  drafts.set(giver.id, gen);
  offer = { giver, gen };
  const p = gen.proposal;
  hud.showMissionOffer({ giver: `${giver.name} (${INTENT_LABELS[p.intent]})`, title: p.title, briefing: p.briefing, steps: p.steps.map((st) => st.text), hours: p.timeLimitHours, source: sourceLabel(gen) });
  return true;
}

function answerOffer(accept: boolean): void {
  if (!offer) return;
  const { giver, gen, storyId } = offer;
  offer = null;
  hud.showMissionOffer(null);
  if (!accept) {
    hud.toast(`Tu déclines l'offre de ${giver.name}.`);
    return;
  }
  // The world may have moved while the card was open: the validator has the last word.
  const errors = missions.validate(gen.proposal, gen.proposal.intent, giver.id);
  if (errors.length) {
    drafts.delete(giver.id);
    hud.toast(`${giver.name} se ravise : la situation a changé.`);
    return;
  }
  drafts.delete(giver.id);
  missions.accept(gen.proposal, gen.source, storyId ?? null);
}

function timeLeft(m: Mission): string {
  const min = Math.max(0, m.deadline - clock.totalMinutes);
  return min >= 120 ? `reste ${Math.round(min / 60)} h` : `reste ${Math.round(min)} min`;
}

const mapView = new MapView(layout, agents.places.spots);
const miniCanvas = document.getElementById("minimap") as HTMLCanvasElement;
const bigCanvas = document.getElementById("bigmap-canvas") as HTMLCanvasElement;
let mapAt = 0;
let storyHinted = false;

/** Where the story continues when no mission is running: its giver, with directions. */
function storyHint(): { chapter: StoryChapter; giver: Agent } | null {
  const chapter = missions.openChapters()[0];
  const giver = chapter ? agentsById.get(chapter.proposal.giverId) : undefined;
  return chapter && giver ? { chapter, giver } : null;
}

function mapState(): MapState {
  const markers: MapMarker[] = [];
  for (const m of missions.active) {
    const o = missions.objective(m);
    if (o) markers.push({ x: o.x, z: o.z, kind: "objective", label: m.proposal.title });
  }
  for (const c of missions.openChapters()) {
    const g = agentsById.get(c.proposal.giverId);
    if (g) markers.push({ x: g.x, z: g.z, kind: "story", label: g.name });
  }
  for (const id of Object.keys(missions.def.givers)) {
    const g = agentsById.get(id);
    if (g && !missions.storyFor(id) && missions.offerOf(id)) markers.push({ x: g.x, z: g.z, kind: "job", label: g.name });
  }
  if (consequences.wantedLevel > 0) for (const a of agents.agents) if (a.pursuing && !a.insideOf) markers.push({ x: a.x, z: a.z, kind: "guard" });
  return { player: { x: player.x, z: player.z, facing: player.facing }, markers };
}

const marker = new THREE.Group();
{
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.vfx.time?.main ?? "#ffbf5e").multiplyScalar(1.4), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.6, 26, 12, 1, true), mat);
  beam.position.y = 13;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.06, 6, 40), mat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.15;
  marker.add(beam, ring);
  marker.visible = false;
  scene.add(marker);
}

function missionDebugLine(): string {
  const all = missions.missions;
  const count = (st: string) => all.filter((m) => m.status === st).length;
  const g = lastGen;
  return (
    `missions : ${missions.active.length} en cours · ${count("done")} accomplies · ${count("failed")} échouées` +
    (g ? `\ndernière génération : ${sourceLabel(g)} · ${g.rejections.length} refus du validateur · ${g.costUsd.toFixed(4)} $` + (g.rejections[0] ? `\n  refus : ${g.rejections[0].slice(0, 2).join(" ; ").slice(0, 160)}` : "") : "")
  );
}

function updateMissionsUi(dt: number): void {
  if (nameplateAgent && !paused && !hud.dialogueOpen && input.wasPressed("KeyM") && Math.hypot(nameplateAgent.x - player.x, nameplateAgent.z - player.z) < INTERACT_RANGE) {
    if (missions.offerOf(nameplateAgent.id)) void requestMission(nameplateAgent);
    else if (defsById.has(nameplateAgent.id)) hud.toast(`${nameplateAgent.name} n'a pas de travail pour toi.`);
  }
  if (offer && !hud.dialogueOpen) {
    agents.hold(offer.giver, player.x, player.z, clock.totalMinutes, 2);
    if (input.wasPressed("Enter") || input.wasPressed("NumpadEnter")) answerOffer(true);
    else if (input.wasPressed("Backspace") || Math.hypot(offer.giver.x - player.x, offer.giver.z - player.z) > INTERACT_RANGE + 3) answerOffer(false);
  }
  for (const n of missions.notices.splice(0)) {
    hud.toast(n.kind === "step" ? `Objectif : ${n.text}` : n.text);
    audio.play(n.kind === "failed" ? "stones" : n.kind === "done" ? "chime" : "chime_2", { volume: 0.8, rate: n.kind === "failed" ? 0.7 : 1 });
    if (n.kind === "done" && n.gold > 0) audio.play("coins_2", { volume: 0.8, delay: 0.35 });
    if (n.kind === "done") {
      coins += n.gold;
      hud.setCoins(coins);
    }
    if (n.kind === "done" || n.kind === "failed") void saveGame("auto");
  }
  // The clock may have jumped back (debug, loaded save): restart the autosave period.
  if (clock.totalMinutes < lastAutosaveAt) lastAutosaveAt = clock.totalMinutes;
  if (started && !paused && clock.totalMinutes - lastAutosaveAt >= AUTOSAVE_EVERY_MINUTES) void saveGame("auto");
  const active = missions.active;
  const hint = active.length === 0 ? storyHint() : null;
  const rows = active.map((m) => {
    const o = missions.objective(m);
    return { title: m.proposal.title, objective: o ? `${o.text} — ${directions(o.x - player.x, o.z - player.z)}` : "", left: timeLeft(m), choice: m.status === "choice" };
  });
  if (hint)
    rows.push({ title: "Histoire principale", objective: `Va voir ${hint.giver.name} (${hint.giver.role}) — ${directions(hint.giver.x - player.x, hint.giver.z - player.z)}`, left: "[M] près de lui pour l'écouter · [C] carte", choice: false });
  hud.updateMissions(rows);
  if (started && hint && !storyHinted) {
    storyHinted = true;
    hud.toast(`${hint.giver.name} veut te parler. Suis la balise dorée, ou ouvre la carte avec C.`);
  }
  if (input.wasPressed("KeyC") && started && !hud.dialogueOpen) {
    hud.toggleMap();
    audio.play("ui_open", { volume: 0.5 });
    mapAt = 0;
  }
  mapAt -= dt;
  if (started && mapAt <= 0) {
    mapAt = hud.mapOpen ? 0.25 : 0.12;
    const state = mapState();
    mapView.drawMini(miniCanvas, state);
    if (hud.mapOpen) {
      mapView.drawFull(bigCanvas, state);
      const prog = missions.storyProgress;
      hud.setMapMissions([
        { title: `Histoire principale : ${prog.done} chapitre${prog.done > 1 ? "s" : ""} sur ${prog.total}`, text: hint ? `Prochain : ${hint.chapter.proposal.title} — ${hint.giver.name}` : prog.done === prog.total ? "Terminée." : "", tone: "hint" },
        ...missions.missions
          .slice()
          .reverse()
          .map((m) => ({
            title: m.proposal.title,
            text: m.status === "done" ? "Accomplie" : m.status === "failed" ? `Échouée : ${m.failReason ?? ""}` : (missions.objective(m)?.text ?? ""),
            tone: m.status === "done" ? "done" : m.status === "failed" ? "failed" : "",
          })),
      ]);
    }
  }
  const target = active[0] ? missions.objective(active[0]) : hint ? { x: hint.giver.x, z: hint.giver.z, text: "" } : null;
  marker.visible = target !== null && started;
  if (target) {
    marker.position.set(target.x, 0, target.z);
    marker.rotation.y += dt * 0.8;
  }
}

function updateSocialUi(): void {
  if (hud.dialogueOpen && talkingTo) {
    // The character stays with us; walking away ends the conversation.
    agents.hold(talkingTo, player.x, player.z, clock.totalMinutes);
    if (Math.hypot(talkingTo.x - player.x, talkingTo.z - player.z) > INTERACT_RANGE + 2.5) closeDialogue();
  }
  if (hud.debugVisible && performance.now() - aiStatusAt > 5000) refreshAiStatus();
  if (nameplateAgent && !paused && !hud.dialogueOpen && input.wasPressed("KeyF") && Math.hypot(nameplateAgent.x - player.x, nameplateAgent.z - player.z) < INTERACT_RANGE)
    openDialogue(nameplateAgent);
  if (nameplateAgent && !paused && Math.hypot(nameplateAgent.x - player.x, nameplateAgent.z - player.z) < INTERACT_RANGE) {
    for (const [code, actId] of Object.entries(ACT_KEYS)) if (input.wasPressed(code)) playerAct(actId, nameplateAgent);
  }
  if (input.wasPressed("KeyJ")) {
    hud.toggleJournal();
    audio.play("ui_open", { volume: 0.5 });
  }
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

const handPos = new THREE.Vector3();
const heldPos = new THREE.Vector3();
const shadowTint = new THREE.Color(PALETTE.vfx.shadow?.main ?? "#6c4fa3");
let lastWanted = 0;

/** Everything the player sees of powers and consequences. */
function updatePowersUi(dt: number, rx: number, rz: number): void {
  const now = clock.totalMinutes;
  for (const fx of powers.fx.splice(0)) {
    const snd = POWER_SOUNDS[fx.kind];
    if (snd) audio.play(snd[0], { rate: snd[1], volume: 0.75 });
    // Cloak/uncloak cues carry no position: they happen on the hero.
    if (fx.kind === "cloak" || fx.kind === "uncloak") powerFx.spawn({ ...fx, x: rx, z: rz });
    else powerFx.spawn(fx);
  }
  const h = powers.holding;
  let held: THREE.Vector3 | null = null;
  if (h && "prop" in h) held = heldPos.set(h.prop.x, h.prop.y + 0.5, h.prop.z);
  else if (h && crowd) held = heldPos.set(crowd.positions[h.agent.index * 2] as number, h.agent.y + 0.9, crowd.positions[h.agent.index * 2 + 1] as number);
  handPos.set(rx + Math.sin(player.facing) * 0.35, 1.15, rz + Math.cos(player.facing) * 0.35);
  powerFx.update(dt, handPos, held);
  propsView?.update(now);
  animatedKael?.setGhost(powers.cloaked, shadowTint);
  // False face: the hero is drawn as one more member of the imitated person's look.
  const worn = powers.disguise ? agentsById.get(powers.disguise.agentId) ?? null : null;
  const masked = worn !== null && !powers.cloaked && crowd !== null;
  playerRoot.visible = !masked;
  if (crowd) {
    crowd.impostor = masked && worn
      ? { look: worn.look, tint: worn.tint, scale: worn.scale, x: rx, z: rz, facing: player.facing, anim: playerSpeed(player) > 3.2 ? "run" : playerSpeed(player) > 0.3 ? "walk" : "idle", speed: playerSpeed(player) }
      : null;
  }
  hud.setDisguise(worn && powers.disguise ? `Visage : ${worn.name} · ${Math.max(0, Math.ceil(powers.disguise.until - now))} min` : "");
  if (powers.spottedBy) {
    hud.toast(`${nameOf(powers.spottedBy)} t'a démasqué !`);
    powers.spottedBy = null;
  }
  hud.setVeil(powers.cloaked ? "shadow" : "");

  for (const a of powers.updateUnlocks()) {
    const path = a.path === "hero" ? "Voie héroïque" : "Voie sombre";
    hud.toast(`${path} — ${a.name} éveillé`);
    social.pushFeed(now, `${path} : « ${a.name} ». ${a.description}`, a.path === "hero" ? "good" : "bad");
  }
  for (const n of consequences.notices.splice(0)) {
    hud.toast(n.text);
    if (n.kind !== "betrayal" && n.kind !== "arrest") social.pushFeed(now, n.text, n.kind === "district_recovered" ? "good" : n.kind === "rule_off" ? "neutral" : "bad");
    if (n.kind === "arrest") {
      hud.setCoins(coins);
      audio.play("chain", { volume: 0.9 });
      audio.play("lock", { volume: 0.9, delay: 0.5 });
    }
  }
  if (consequences.wantedLevel !== lastWanted) {
    if (consequences.wantedLevel > lastWanted) audio.play("draw", { volume: 0.8 });
    lastWanted = consequences.wantedLevel;
    hud.setWanted(lastWanted);
  }
  consequenceView?.update(consequences);

  const slots = powers.castable().map((c) => ({
    key: (c.ability.key ?? "").replace("Digit", ""),
    name: c.ability.name,
    cost: c.ability.cost ?? 0,
    cooldown: powers.cooldownLeft(c.ability.id, now),
    locked: !c.unlocked,
    active: (c.ability.id === "cloak" && powers.cloaked) || (c.ability.id === "grab" && powers.holding !== null) || (c.ability.id === "disguise" && powers.disguise !== null),
    vfx: c.power.vfx ?? "time",
  }));
  hud.updatePowers(powers.energy, powers.data.energy.max, slots);
}

let lastRx = 0;
let lastRz = 0;
function frame(now: number): void {
  renderer.info.reset();
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;

  if (input.wasPressed("F3")) hud.toggleDebug();
  if (input.wasPressed("KeyG")) setQuality(qualityLevel === "high" ? "low" : "high");
  if (started && !paused && !hud.dialogueOpen) for (const slot of POWER_SLOTS) if (input.wasPressed(slot.code)) castPower(slot.id);
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
      // Inhabitants are solid: the player slides around them (unless they are up in the air).
      agents.forNeighbors(player.x, player.z, 1.5, (a) => {
        if (a.y < 1) resolveCircleCircle(player, PLAYER_TUNING.radius, { x: a.x, z: a.z, r: 0.3, height: 1.7 });
      });
      for (const p of dynamicProps.props) {
        if (!p.held && p.y < 0.8 && Math.abs(p.x - player.x) < 2 && Math.abs(p.z - player.z) < 2)
          resolveCircleCircle(player, PLAYER_TUNING.radius, { x: p.x, z: p.z, r: p.radius, height: 1 });
      }
      dodgeConsumed = true;
    });
    simAlpha = sim.advance(dt, (step) => {
      clock.advance(step);
      // An invisible hero is not there as far as the inhabitants are concerned.
      agents.step(step, clock, powers.cloaked ? null : player);
      dynamicProps.step(step * Math.min(clock.timeScale, 4), clock.totalMinutes, agents.agents, powers.timeFactorAt);
      powers.update(step, castContext());
      social.step(clock.totalMinutes);
      ambient.step();
      missions.step({ x: player.x, z: player.z, unrecognizable: powers.unrecognizable, hidden: powers.cloaked });
      // A guard hunting Kael walks past a stranger's face.
      consequences.step({ x: player.x, z: player.z, hidden: powers.unrecognizable });
    });
  }

  // Interpolated render state.
  const rx = prevPlayer.x + (player.x - prevPlayer.x) * alpha;
  const rz = prevPlayer.z + (player.z - prevPlayer.z) * alpha;
  playerRoot.position.set(rx, 0, rz);
  playerRoot.rotation.y = player.facing;
  const frameDt = paused ? 0 : dt;
  updateAudio(frameDt, paused ? 0 : Math.hypot(rx - lastRx, rz - lastRz));
  lastRx = rx;
  lastRz = rz;
  if (animatedKael) animatedKael.update(frameDt, playerSpeed(player), player.state);
  else placeholderKael.animate(frameDt, playerSpeed(player), player.state, 1 - player.dodgeTime / PLAYER_TUNING.dodgeDuration);

  if (crowd?.impostor) Object.assign(crowd.impostor, { x: rx, z: rz, facing: player.facing });
  crowd?.update(frameDt * Math.min(clock.timeScale, 4), simAlpha);
  updatePowersUi(frameDt, rx, rz);
  updateNameplate(rx, rz);
  updateSocialUi();
  updateMissionsUi(frameDt);

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
  if (started && districtName && districtName !== lastDistrict)
    hud.showDistrict(district && consequences.terrorized.has(district.id) ? `${districtName} — la peur règne` : districtName);
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
    ai: `${aiDebugLine()}\n${missionDebugLine()}\nsauvegarde : ${lastSaveInfo} · IA ${gateway.settings.enabled ? "activée" : "désactivée"}${gateway.settings.sessionCapUsd !== null ? ` · plafond ${gateway.settings.sessionCapUsd} $` : ""} · session ${gateway.stats.sessionCostUsd.toFixed(4)} $`,
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
  talk(agentId: string) {
    const a = agents.agents.find((x) => x.id === agentId);
    if (a) openDialogue(a);
  },
  say: (text: string) => sayToNpc(text),
  closeDialogue,
  get ai() {
    return { stats: { ...gateway.stats }, status: aiStatus, open: hud.dialogueOpen, turns: conversation?.turns.map((t) => ({ ...t })) ?? [] };
  },
  setOpinion(agentId: string, value: number) {
    social.reputation.opinions.set(`${agentId}|${PLAYER_ID}`, value);
  },
  act(actId: string, agentId: string) {
    const a = agents.agents.find((x) => x.id === agentId);
    if (a) playerAct(actId, a);
  },
  cast: (id: string) => castPower(id),
  save: (kind: "manual" | "auto" = "manual") => saveGame(kind),
  load: (slot: string) => loadGame(slot),
  saves: () => saves.list(),
  snapshot,
  pause: pauseGame,
  get settings() {
    return { ...gateway.settings };
  },
  get audio() {
    return { ready: audio.ready, played: audio.played, track: audio.currentTrack, ...audio.settings };
  },
  setAi(enabled: boolean, cap: number | null = null) {
    gateway.settings = { enabled, sessionCapUsd: cap };
    storeSettings();
  },
  get summaries() {
    return [...aiSummaries];
  },
  requestMission(giverId: string) {
    const a = agentsById.get(giverId);
    return a ? requestMission(a) : Promise.resolve(false);
  },
  answerOffer,
  get missions() {
    return {
      offer: offer ? { giverId: offer.giver.id, title: offer.gen.proposal.title, source: offer.gen.source, attempts: offer.gen.attempts, rejections: offer.gen.rejections.length, proposal: offer.gen.proposal } : null,
      list: missions.missions.map((m) => ({ id: m.id, title: m.proposal.title, intent: m.proposal.intent, status: m.status, step: m.stepIndex, outcome: m.outcome, failReason: m.failReason, source: m.source, objective: missions.objective(m), proposal: m.proposal })),
      marker: marker.visible,
      story: missions.storyProgress,
      open: missions.openChapters().map((c) => c.id),
      mapOpen: hud.mapOpen,
    };
  },
  aim(yaw: number) {
    rig.yaw = yaw;
  },
  get powers() {
    return {
      energy: powers.energy,
      cloaked: powers.cloaked,
      holding: powers.holding ? ("prop" in powers.holding ? "prop" : "agent") : null,
      unlocked: [...powers.unlocked],
      zones: agents.zones.length,
      disguise: powers.disguise?.agentId ?? null,
      apparent: powers.apparentId,
      echo: powers.lastEcho.map((v) => ({ ...v })),
      leverage: [...powers.leverage],
      studied: Object.fromEntries(powers.studied),
      jailed: agents.agents.filter((a) => a.jailedUntil > clock.totalMinutes).map((a) => a.id),
      frozen: agents.agents.filter((a) => a.frozenUntil > clock.totalMinutes).length,
      props: dynamicProps.props.map((p) => ({ x: p.x, y: p.y, z: p.z, held: p.held })),
    };
  },
  get consequences() {
    return {
      wanted: consequences.wantedLevel,
      terror: Object.fromEntries(consequences.terror),
      terrorized: [...consequences.terrorized],
      flags: [...consequences.flags],
      pursuing: agents.agents.filter((a) => a.pursuing).length,
    };
  },
  setReputation(faction: string, value: number) {
    const f = faction as keyof typeof social.reputation.factions;
    social.reputation.adjust(f, value - social.reputation.factions[f]);
  },
  setMoral(hero: number, dark: number) {
    social.moral.hero = hero;
    social.moral.dark = dark;
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
    return a ? { x: a.x, z: a.z, facing: a.facing, activity: a.activity, place: a.place, mode: a.mode, insideOf: a.insideOf, anim: a.anim } : null;
  },
  outdoors: () => agents.agents.filter((a) => !a.insideOf).map((a) => ({ id: a.id, x: a.x, z: a.z, faction: a.faction, key: a.key })),
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
  renderInfo: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, fps, programs: renderer.info.programs?.length ?? 0, env: scene.environment ? scene.environment.uuid.slice(0, 4) : null, envI: scene.environmentIntensity, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
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
