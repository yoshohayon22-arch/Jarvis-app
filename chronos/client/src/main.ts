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
import { ConsequenceSystem, type ConsequencesDef } from "./sim/consequences";
import { PropSystem } from "./sim/physics";
import { PowerSystem, type CastContext, type PowersData } from "./sim/powers";
import { ConsequenceView } from "./render/consequenceView";
import { PALETTE } from "./render/palette";
import { PowerFxView } from "./render/powerFx";
import { PropsView } from "./render/propsView";
import fallbackJson from "../data/packs/medieval/dialogue_fallback.json";
import { DIALOGUE_LIMITS, type BudgetStatus, type DialogueRequest } from "@chronos/shared";
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
powers.captureExtra = () => ({ coins });
powers.restoreExtra = (e) => {
  coins = (e as { coins: number } | null)?.coins ?? coins;
};
powers.movePlayer = (x, z, facing) => {
  Object.assign(player, { x, z, facing, vx: 0, vz: 0 });
  Object.assign(prevPlayer, player);
};
consequences.onArrest = () => {
  // Fined, jailed until dawn, released in the barracks yard.
  coins = 0;
  powers.reveal();
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
};

function castPower(id: string): void {
  const before = { ...social.reputation.factions };
  const r = powers.cast(id, castContext());
  if (!r.ok) {
    if (r.reason === "no_target" && id === "rewind") hud.toast("Le temps n'a encore rien à rendre.");
    else hud.toast(CAST_FAILURES[r.reason ?? ""] ?? "Impossible.");
    return;
  }
  if (id === "rewind") hud.flash("time");
  const changes = FACTIONS.map((f) => ({ f, d: social.reputation.factions[f] - before[f] }))
    .filter((c) => Math.abs(c.d) >= 0.05)
    .map((c) => `${FACTION_LABELS[c.f]} ${c.d > 0 ? "+" : ""}${c.d.toFixed(1)}`);
  if (changes.length) hud.toast(`${r.ability?.name} · ${changes.join(" · ")}`);
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
canvas.addEventListener("click", () => {
  if (started && !paused && !hud.dialogueOpen && !document.pointerLockElement) input.requestPointerLock();
});
document.addEventListener("pointerlockchange", () => {
  if (started && !document.pointerLockElement && !hud.dialogueOpen) {
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
  const a = started && crowd && !hud.dialogueOpen ? agents.nearestTo(px, pz, 3.2) : null;
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
    close ? "[F] parler · [E] aumône · [V] voler · [N] menacer · [B] frapper" : "",
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
    {
      actorId: PLAYER_ID,
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
  // Striking or threatening someone breaks the Shadow.
  if (actId === "assault" || actId === "intimidate") powers.reveal();
  const changes = FACTIONS.map((f) => ({ f, d: social.reputation.factions[f] - before[f] }))
    .filter((c) => Math.abs(c.d) >= 0.05)
    .map((c) => `${FACTION_LABELS[c.f]} ${c.d > 0 ? "+" : ""}${c.d.toFixed(1)}`);
  const seen = result.witnesses.length + (result.targetNoticed ? 1 : 0);
  hud.toast(seen === 0 ? "Personne n'a rien vu." : `${seen} témoin${seen > 1 ? "s" : ""}${changes.length ? " · " + changes.join(" · ") : ""}`);
  hud.setCoins(coins);
}

// ---------------------------------------------------------------- dialogue (J4)
const gateway = new AiGateway();
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

function openDialogue(a: Agent): void {
  const def = defsById.get(a.id);
  if (!def) {
    // Extras never use AI: a short local line.
    hud.toast(`${a.name} : « ${bark(fallbackData, a.faction, social.reputation.opinion(a.id), social.rng.next())} »`);
    return;
  }
  talkingTo = a;
  conversation = new Conversation(a.id, def.secrets ?? []);
  agents.hold(a, player.x, player.z, clock.totalMinutes);
  hud.openDialogue(a.name, a.role);
  document.exitPointerLock();
  refreshAiStatus();
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
  const opinion = social.reputation.opinion(a.id);
  const now = clock.totalMinutes;
  const memories = social.memory
    .relevant(a.id, PLAYER_ID, now, a.traits.grudge, DIALOGUE_LIMITS.memoriesMax)
    .map((m) => `${m.kind === "heard" ? "On t'a raconté que" : m.kind === "suffered" ? "Tu as subi ceci :" : "Tu as vu que"} ${social.describe(m.claim)}`.slice(0, 200));
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
      factionReputation: social.reputation.factions[a.faction],
      memories,
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
  const result = await gateway.dialogue(request, defsById.get(a.id)?.secrets?.length ?? 0, () =>
    localReply(fallbackData, request.playerText, opinion, firstTurn, social.rng.next()),
  );
  pending.remove();
  if (conversation !== conv) return; // the player walked away meanwhile
  const effects = conv.apply(result.reply, opinion, result.source !== "local");
  hud.addDialogueLine("npc", result.reply.line);
  if (effects.opinionDelta !== 0) {
    social.reputation.nudgeOpinion(a.id, effects.opinionDelta);
    hud.addDialogueLine("system", `${a.name} ${effects.opinionDelta > 0 ? "t'apprécie un peu plus" : "t'apprécie un peu moins"} (${effects.opinionDelta > 0 ? "+" : ""}${effects.opinionDelta}).`);
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

const handPos = new THREE.Vector3();
const heldPos = new THREE.Vector3();
const shadowTint = new THREE.Color(PALETTE.vfx.shadow?.main ?? "#6c4fa3");
let lastWanted = 0;

/** Everything the player sees of powers and consequences. */
function updatePowersUi(dt: number, rx: number, rz: number): void {
  const now = clock.totalMinutes;
  for (const fx of powers.fx.splice(0)) {
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
  hud.setVeil(powers.cloaked ? "shadow" : "");

  for (const a of powers.updateUnlocks()) {
    const path = a.path === "hero" ? "Voie héroïque" : "Voie sombre";
    hud.toast(`${path} — ${a.name} éveillé`);
    social.pushFeed(now, `${path} : « ${a.name} ». ${a.description}`, a.path === "hero" ? "good" : "bad");
  }
  for (const n of consequences.notices.splice(0)) {
    hud.toast(n.text);
    if (n.kind !== "betrayal" && n.kind !== "arrest") social.pushFeed(now, n.text, n.kind === "district_recovered" ? "good" : n.kind === "rule_off" ? "neutral" : "bad");
    if (n.kind === "arrest") hud.setCoins(coins);
  }
  if (consequences.wantedLevel !== lastWanted) {
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
    active: (c.ability.id === "cloak" && powers.cloaked) || (c.ability.id === "grab" && powers.holding !== null),
    vfx: c.power.vfx ?? "time",
  }));
  hud.updatePowers(powers.energy, powers.data.energy.max, slots);
}

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
      consequences.step({ x: player.x, z: player.z, hidden: powers.cloaked });
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
  updatePowersUi(frameDt, rx, rz);
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
    ai: aiDebugLine(),
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
