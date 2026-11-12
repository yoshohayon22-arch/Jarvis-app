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
import { CameraRig } from "./render/cameraRig";
import { CharacterModel, KAEL_LOOK } from "./render/character";
import { DayNightCycle } from "./render/sky";
import { buildVillage } from "./render/village";
import { Hud } from "./ui/hud";

const WORLD_SEED = 20261112;
const PHYSICS_HZ = 60;
const SIM_HZ = 10;
const TIME_SCALES = [1, 10, 60, 0];
const NIGHT_LIGHTS = 6;

// ---------------------------------------------------------------- data & simulation
const pack = loadDefaultPack();
const layout = expandLayout(pack.layout, WORLD_SEED);
const collision = buildCollisionWorld(layout);
const clock = new WorldClock(pack.manifest.calendar.minutesPerGameDay, pack.manifest.calendar.startHour);
const player = createPlayer(layout.spawn.pos[0], layout.spawn.pos[1], layout.spawn.facing);
const prevPlayer: PlayerState = { ...player };

// ---------------------------------------------------------------- rendering
const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const dayNight = new DayNightCycle(scene);
const village = buildVillage(layout, WORLD_SEED);
scene.add(village.group);

const nightLights: THREE.PointLight[] = [];
for (let i = 0; i < NIGHT_LIGHTS; i++) {
  const l = new THREE.PointLight("#ffab55", 0, 16, 1.6);
  scene.add(l);
  nightLights.push(l);
}

const kael = new CharacterModel(KAEL_LOOK);
scene.add(kael.root);
const rig = new CameraRig();
rig.yaw = layout.spawn.facing + Math.PI; // start behind the player

const input = new Input(canvas);
const hud = new Hud();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- title / pause
const title = document.getElementById("title") as HTMLElement;
const pauseEl = document.getElementById("pause") as HTMLElement;
let started = false;
let paused = true;

function start(): void {
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
  const intensity = dayNight.night * 9;
  const sorted = village.nightLightSpots
    .map((p) => ({ p, d: (p.x - player.x) ** 2 + (p.z - player.z) ** 2 }))
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
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;

  if (input.wasPressed("F3")) hud.toggleDebug();
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
  kael.root.position.set(rx, 0, rz);
  kael.root.rotation.y = player.facing;
  const dodgeProgress = 1 - player.dodgeTime / PLAYER_TUNING.dodgeDuration;
  kael.animate(paused ? 0 : dt, playerSpeed(player), player.state, dodgeProgress);

  rig.update({ x: rx, y: 0, z: rz }, dt, collision.boxes);
  camera.position.set(rig.position.x, rig.position.y, rig.position.z);
  camera.lookAt(rig.pivot.x, rig.pivot.y, rig.pivot.z);

  focus.set(rx, 0, rz);
  dayNight.update(clock, focus);
  village.glowMaterial.emissiveIntensity = 0.15 + dayNight.night * 2.4;
  updateNightLights();

  const district = districtAt(layout, player.x, player.z);
  const districtName = district?.name ?? (Math.hypot(player.x, player.z) > layout.wallRadius ? "Hors les murs" : "");
  if (started && districtName && districtName !== lastDistrict) hud.showDistrict(districtName);
  lastDistrict = districtName;

  renderer.render(scene, camera);
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
};
