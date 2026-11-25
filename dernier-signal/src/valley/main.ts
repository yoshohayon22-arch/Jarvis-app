// Acte 2 · La vallée (tranche visuelle) : R-12 se promène dans la plaine de la balise
// et à l'orée de la forêt lumineuse, de jour comme de nuit.
import * as THREE from 'three';
import { ToneMappingMode } from 'postprocessing';
import '../ui/base.css';
import '../ui/game.css';
import './valley.css';
import { loadQuality, saveQuality, PRESETS, isTouchDevice, bootSucceeded, type PresetId } from '../core/quality';
import { acquireContext, createRenderer, Post, FpsMeter } from '../core/post';
import { texturesReady, setMaxAnisotropy } from '../core/textures';
import { setMaterialRes } from '../robots/materials';
import { Physics } from '../world/physics';
import { Input } from '../game/input';
import { Player } from '../game/player';
import { ThirdPersonCamera } from '../game/camera';
import { AudioEngine } from '../audio/audio';
import { Terrain, SPAWN, BEACON } from './terrain';
import { U, installHeightFog, withAtmosphere, SkyDome, timeOfDay } from './atmosphere';
import { Grass } from './grass';
import { Flora } from './flora';
import { River } from './water';
import { Beacon, Motes, Shafts } from './props';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const stage = (s: string) => (window as unknown as { __stage?: (s: string) => void }).__stage?.(s) ?? (($('#loader .msg').textContent = s + '…'));

installHeightFog();
const q = loadQuality();
setMaterialRes(q.textureRes);
const touch = isTouchDevice();
document.body.dataset.device = touch ? 'touch' : 'keyboard';
const P = { // réglages par préréglage
  econome: { grass: 22000, patch: 26, shadow: 1024, shadowR: 34, flora: 0.6, motes: 250, shafts: 6 },
  equilibre: { grass: 40000, patch: 32, shadow: 2048, shadowR: 40, flora: 0.85, motes: 400, shafts: 10 },
  haut: { grass: 80000, patch: 42, shadow: 2048, shadowR: 48, flora: 1, motes: 600, shafts: 14 },
  ultra: { grass: 130000, patch: 52, shadow: 4096, shadowR: 56, flora: 1.15, motes: 800, shafts: 18 },
}[q.id];

// ---------- rendu ----------
stage('Initialisation graphique');
const acq = await acquireContext(touch, () => {});
if ('error' in acq) { $('#loader .msg').textContent = 'La carte graphique est inaccessible'; const e = $('#loader .err'); e.style.display = 'block'; e.textContent = acq.error; await new Promise(() => {}); }
const { canvas, gl } = acq as { canvas: HTMLCanvasElement; gl: WebGL2RenderingContext };
const renderer = createRenderer(canvas, q, gl);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.001); // remplacé par le brouillard de hauteur
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 2400);
const post = new Post(renderer, scene, camera, q);
if (post.ao) { post.ao.configuration.aoRadius = 1.0; post.ao.configuration.intensity = 2.2; post.ao.configuration.distanceFalloff = 0.6; }
const fpsMeter = new FpsMeter($('#fps'));
// plus de contraste et de couleur que dans la station (lumière du jour naturelle)
post.tone.mode = ToneMappingMode.ACES_FILMIC;

// ---------- monde ----------
stage('Relief de la vallée (érosion)');
await new Promise((r) => setTimeout(r, 30));
const terrain = new Terrain();
const ph = new Physics();
ph.terrain = (x, z) => terrain.heightAt(x, z);
stage('Sol et textures');
scene.add(terrain.build(q.textureRes, U));
scene.add(terrain.far);
const sky = new SkyDome(); scene.add(sky);
stage('Forêt et rochers');
await new Promise((r) => setTimeout(r, 30));
const flora = new Flora(terrain, ph, q.textureRes, P.flora, true);
scene.add(flora.group);
const grass = new Grass(terrain.dataTex, P.grass, P.patch); scene.add(grass);
const river = new River(terrain); scene.add(river);
const beacon = new Beacon(terrain, ph, q.textureRes); scene.add(beacon.group, beacon.ruins);
const motes = new Motes(P.motes); (motes.material as THREE.ShaderMaterial).uniforms.tData.value = terrain.dataTex; scene.add(motes);
const forestTrunks = flora.trunks.filter((p) => terrain.sample(terrain.f.forest, p.x, p.z) > 0.5).sort((a, b) => a.distanceTo(new THREE.Vector3(SPAWN.x, 0, SPAWN.y)) - b.distanceTo(new THREE.Vector3(SPAWN.x, 0, SPAWN.y)));
const shafts = new Shafts(forestTrunks, P.shafts); scene.add(shafts);

// lumières : soleil (ou lune la nuit) avec ombres qui suivent R-12, ciel d'ambiance
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(P.shadow);
const sc = sun.shadow.camera; sc.left = -P.shadowR; sc.right = P.shadowR; sc.top = P.shadowR; sc.bottom = -P.shadowR; sc.near = 1; sc.far = 260;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05; sun.shadow.radius = 3;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0x9ab8d0, 0x1a2018, 0.5); scene.add(hemi);
// éclairage d'environnement (reflets) recalculé depuis le ciel quand l'heure change
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene(); const envSky = new SkyDome(); envScene.add(envSky);
let envTex: THREE.Texture | null = null, envHour = -99;
function refreshEnv(hour: number) {
  if (Math.abs(hour - envHour) < 0.5 && envTex) return;
  envHour = hour;
  const rt = pmrem.fromScene(envScene, 0, 1, 1000);
  envTex?.dispose(); envTex = rt.texture; scene.environment = envTex;
}

// ---------- R-12 ----------
stage('R-12');
const player = new Player(scene, q);
player.hasJetpack = true; player.hasBoots = true; player.lampOn = false;
const input = new Input(canvas, $('#touch'));
const audio = new AudioEngine();
const tp = new ThirdPersonCamera(camera);
tp.dist = 4.6;
const spawnY = terrain.heightAt(SPAWN.x, SPAWN.y);
const spawnYaw = Math.atan2(BEACON.x - SPAWN.x, BEACON.y - SPAWN.y);
player.teleport(new THREE.Vector3(SPAWN.x, spawnY, SPAWN.y), spawnYaw);
tp.snap(player.pos, spawnYaw + Math.PI);
$('#touch').classList.add('show');

// tous les matériaux standards reçoivent l'atmosphère (brouillard de hauteur, soleil)
function patchScene() {
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    for (const mm of Array.isArray(m) ? m : [m]) if (!(mm as THREE.ShaderMaterial).isShaderMaterial && !mm.userData.atm) { withAtmosphere(mm); mm.userData.atm = true; }
  });
}

// ---------- temps ----------
const SAVE = 'dernier-signal:vallee';
let hour = 16.5, day = 1, speed = 1;
try { const s = JSON.parse(localStorage.getItem(SAVE) ?? 'null'); if (s) { hour = s.hour; day = s.day; } } catch { /* */ }
const HOUR_SECONDS = 30; // une heure de jeu = 30 s à ×1 (une journée = 12 min)
let auroraNight = Math.random() < 0.6;

function applyTime(dt: number, t: number) {
  const T = timeOfDay(hour, day);
  U.uTime.value = t;
  U.uSunDir.value.copy(T.sun);
  U.uSunCol.value.copy(T.sunCol);
  U.uMoonDir.value.copy(T.moon); U.uMoon2Dir.value.copy(T.moon2);
  U.uDay.value = T.dayK; U.uDusk.value = T.dusk;
  const night = 1 - T.dayK;
  U.uNight.value = THREE.MathUtils.smoothstep(night, 0.3, 1);
  U.uAurora.value += ((auroraNight ? THREE.MathUtils.smoothstep(night, 0.6, 1) : 0) - U.uAurora.value) * Math.min(1, dt * 0.3);
  // vent qui varie lentement
  U.uWind.value.set(Math.cos(t * 0.05) * (0.8 + 0.4 * Math.sin(t * 0.13)), Math.sin(t * 0.05) * 0.6);
  U.uPlayer.value.copy(player.pos);
  // soleil le jour, première lune la nuit
  const useMoon = T.sun.y < 0.02;
  const ldir = useMoon ? T.moon : T.sun;
  const center = player.pos.clone();
  // calage sur la grille des texels d'ombre (évite le scintillement)
  const texel = (P.shadowR * 2) / P.shadow;
  center.x = Math.round(center.x / texel) * texel; center.z = Math.round(center.z / texel) * texel;
  sun.position.copy(center).addScaledVector(ldir, 120); sun.target.position.copy(center);
  if (useMoon) { sun.color.setRGB(0.55, 0.65, 1.0); sun.intensity = 0.55 * THREE.MathUtils.smoothstep(T.moon.y, 0.0, 0.25); }
  else { sun.color.copy(T.sunCol); sun.intensity = 5.2 * THREE.MathUtils.smoothstep(T.sun.y, -0.02, 0.25); }
  // ambiance du ciel
  const skyAmb = new THREE.Color(0.06, 0.08, 0.16).lerp(new THREE.Color(0.48, 0.62, 0.8), T.dayK).lerp(new THREE.Color(0.7, 0.45, 0.4), T.dusk * 0.5);
  hemi.color.copy(skyAmb); hemi.groundColor.setRGB(0.05, 0.06, 0.04).lerp(new THREE.Color(0.16, 0.17, 0.12), T.dayK);
  hemi.intensity = 0.3 + T.dayK * 0.55;
  scene.environmentIntensity = 0.12 + T.dayK * 0.3;
  // brouillard de hauteur : brume basse le matin et le soir, air clair à midi
  const morning = Math.max(0, 1 - Math.abs(hour - 6.5) / 2.5), evening = Math.max(0, 1 - Math.abs(hour - 20) / 3);
  U.uMist.value = morning * 2.4 + evening * 0.6 + night * 0.5;
  U.uFogH.value.set(terrain.heightAt(player.pos.x, player.pos.z) - 3, 0.12, 0.0018 + morning * 0.008, 0.00028 + night * 0.0004 + T.dusk * 0.0003);
  U.uFogCol.value.copy(new THREE.Color(0.02, 0.03, 0.06).lerp(new THREE.Color(0.55, 0.66, 0.78), T.dayK).lerp(new THREE.Color(0.8, 0.5, 0.42), T.dusk * 0.6));
  U.uFogSunCol.value.copy(T.sunCol).multiplyScalar(0.9 * T.dayK + 0.1);
  for (const m of [grass.material, river.material] as THREE.ShaderMaterial[]) {
    m.uniforms.uAmb.value.copy(skyAmb).multiplyScalar(0.55 + T.dayK * 0.4);
    if (m.uniforms.uSunI) m.uniforms.uSunI.value = useMoon ? 0.12 : 1.4 * THREE.MathUtils.smoothstep(T.sun.y, -0.02, 0.25);
  }
  flora.update(U.uNight.value);
  beacon.update(t, U.uNight.value);
  shafts.update(T.sun, camera);
  (shafts.material as THREE.ShaderMaterial).uniforms.uI.value = THREE.MathUtils.smoothstep(T.sun.y, 0.05, 0.3);
  sky.position.copy(camera.position);
  refreshEnv(hour);
  // heure affichée
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
  $('#vhud .time').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  $('#vhud .day').textContent = `Jour ${day} · ${T.dayK > 0.5 ? (T.dusk > 0.3 ? 'crépuscule' : 'jour') : 'nuit'}`;
}

// ---------- pause ----------
let paused = false;
let freeCam: { p: THREE.Vector3; l: THREE.Vector3 } | null = null;
function setSpeed(s: number) { speed = s; document.querySelectorAll<HTMLElement>('#vpause [data-s]').forEach((b) => b.classList.toggle('on', +b.dataset.s! === s)); }
function openPause() { paused = true; $('#vpause').hidden = false; input.menuMode = true; input.releasePointer(); }
function closePause() { paused = false; $('#vpause').hidden = true; input.menuMode = false; }
$('#pausebtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); openPause(); });
$('#v-resume').addEventListener('click', closePause);
document.querySelectorAll<HTMLElement>('#vpause [data-s]').forEach((b) => b.addEventListener('click', () => setSpeed(+b.dataset.s!)));
document.querySelectorAll<HTMLElement>('#vpause [data-h]').forEach((b) => b.addEventListener('click', () => { hour = +b.dataset.h!; auroraNight = true; }));
{
  const sel = $<HTMLSelectElement>('#vq');
  for (const p of Object.values(PRESETS)) { const o = document.createElement('option'); o.value = p.id; o.textContent = p.label; sel.appendChild(o); }
  sel.value = q.id; sel.onchange = () => { saveQuality(sel.value as PresetId); location.reload(); };
  const f = $<HTMLInputElement>('#vfps'); f.onchange = () => ($('#fps').hidden = !f.checked);
}
setSpeed(1);

// ---------- boucle ----------
function onResize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.fov = innerWidth / innerHeight < 1 ? 70 : 58; camera.updateProjectionMatrix();
  post.setSize(innerWidth, innerHeight);
}
addEventListener('resize', onResize);
const timer = new THREE.Timer();
let t = 0, saveAcc = 0;
function step(dt: number) {
  t += dt;
  input.update(dt);
  if (input.padPressed && !audio.running) audio.ensure();
  if (!paused) {
    if (input.wasPressed('pause')) openPause();
    if (input.wasPressed('lamp')) player.lampOn = !player.lampOn;
    hour += (dt * speed) / HOUR_SECONDS;
    if (hour >= 24) { hour -= 24; day++; auroraNight = Math.random() < 0.6; }
    tp.update(dt, input.look, player.pos, player.body.vel, player.visUp, ph, t);
    player.update(dt, t, input, tp.frame, tp.yaw, tp.forward(), ph, audio);
    // la caméra ne passe pas sous le sol
    const gy = terrain.heightAt(camera.position.x, camera.position.z) + 0.45;
    if (camera.position.y < gy) camera.position.y = gy;
    // limites de la tranche
    const lim = 150;
    if (Math.abs(player.pos.x) > lim || Math.abs(player.pos.z) > lim) { player.pos.x = THREE.MathUtils.clamp(player.pos.x, -lim, lim); player.pos.z = THREE.MathUtils.clamp(player.pos.z, -lim, lim); player.body.vel.set(0, 0, 0); }
    if (player.pos.y < terrain.heightAt(player.pos.x, player.pos.z) - 2) player.teleport(new THREE.Vector3(SPAWN.x, spawnY, SPAWN.y), spawnYaw);
  } else if (input.wasPressed('pause')) closePause();
  if (freeCam) { camera.position.copy(freeCam.p); camera.up.set(0, 1, 0); camera.lookAt(freeCam.l); }
  applyTime(dt, t);
  audio.updateListener(camera);
  saveAcc += dt; if (saveAcc > 10) { saveAcc = 0; try { localStorage.setItem(SAVE, JSON.stringify({ hour, day })); } catch { /* */ } }
}
function frame() {
  requestAnimationFrame(frame);
  timer.update();
  const dt = Math.min(timer.getDelta(), 1 / 20);
  fpsMeter.tick(dt);
  step(dt);
  post.render(dt);
  input.endFrame();
}

async function boot() {
  onResize();
  stage('Téléchargement des textures');
  await texturesReady();
  patchScene();
  stage('Préparation des effets');
  applyTime(0, 0);
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  renderer.setRenderTarget(rt);
  await renderer.compileAsync(scene, camera).catch(() => {});
  renderer.setRenderTarget(null); rt.dispose();
  step(1 / 60); post.render(1 / 60);
  $('#loader').classList.add('done');
  frame();
  setTimeout(bootSucceeded, 4000);
  const wake = () => { audio.ensure(); if (audio.ctx && !(wake as unknown as { done?: boolean }).done) { (wake as unknown as { done?: boolean }).done = true; audio.startAmbience('menu'); } };
  addEventListener('pointerdown', wake, true); addEventListener('keydown', wake, true);
}
(window as unknown as { __valley: unknown }).__valley = {
  step, player, tp, terrain, flora, camera, renderer,
  setHour: (h: number) => { hour = h; envHour = -99; }, setSpeed, U,
  simulate: (sec: number, keys: string[] = []) => { const k = (input as unknown as { keys: Set<string> }).keys; keys.forEach((c) => k.add(c)); for (let i = 0; i < sec * 30; i++) { step(1 / 30); input.endFrame(); } keys.forEach((c) => k.delete(c)); },
  render: () => post.render(1 / 60),
  freeCam: (p: number[] | null, l?: number[]) => { freeCam = p ? { p: new THREE.Vector3(...p), l: new THREE.Vector3(...l!) } : null; },
};
boot().catch((e) => { $('#loader .msg').textContent = 'Erreur : ' + e; console.error(e); });
