import * as THREE from 'three';
import '../ui/base.css';
import '../ui/game.css';
import { loadQuality, saveQuality, PRESETS, isTouchDevice, bootSucceeded, recoveredFromCrash, type PresetId } from '../core/quality';
import { createRenderer, acquireContext, Post, FpsMeter } from '../core/post';
import { texturesReady, setMaxAnisotropy, textureProgress } from '../core/textures';
import { setMaterialRes, unifyScene } from '../robots/materials';
import { Input } from './input';
import { Player } from './player';
import { ThirdPersonCamera } from './camera';
import { Zone1, type GameApi, type Shot } from '../world/zone1';
import { Zone2 } from '../world/zone2';
import type { ObjectiveKey } from '../story';
import type { Hologram } from '../world/elements';
import { Sky } from '../world/sky';
import { AudioEngine, Voices } from '../audio/audio';
import { Hud } from '../ui/hud';
import { loadSave, writeSave, newSave, clearSave, loadOptions, saveOptions, type SaveData, type Options } from './save';
import { LOGS, HOLOS, CLUES, OBJECTIVES, ROOMS, MISSION_NAMES } from '../story';
import { CREW } from '../story/crew';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const $$ = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];

// ---------- réglages ----------
const q = loadQuality();
const opts: Options = loadOptions({ preset: q.id, resScale: 1, shadows: (q.id === 'equilibre' || q.id === 'econome') ? 'low' : 'high', volumetric: q.volumetric, particles: q.particles, bloom: q.bloom, fps: false, music: 0.7, sfx: 0.9, sensitivity: 1, invertY: false, voices: true, speech: 1.3 });
if (q.id !== 'econome') { q.volumetric = opts.volumetric; q.particles = opts.particles; q.bloom = opts.bloom; }
setMaterialRes(q.textureRes);
document.body.dataset.device = isTouchDevice() ? 'touch' : 'keyboard';


// ---------- rendu ----------
(window as unknown as { __stage?: (s: string) => void }).__stage?.('Initialisation graphique (WebGL)');
const touch = isTouchDevice();
const acq = await acquireContext(touch, (n) => { if (n > 1) ($('#loader .msg')).textContent = `En attente de la carte graphique… (essai ${n})`; });
if ('error' in acq) {
  ($('#loader .msg')).textContent = 'La carte graphique est inaccessible';
  const err = $('#loader .err'); err.style.display = 'block';
  err.textContent = 'Diagnostic à envoyer à Claude : ' + acq.error;
  await new Promise(() => {}); // on s'arrête ici en gardant le diagnostic à l'écran
}
const { canvas, gl } = acq as { canvas: HTMLCanvasElement; gl: WebGL2RenderingContext };
const renderer = createRenderer(canvas, q, gl);
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); (document.querySelector('#loader') as HTMLElement).classList.remove('done'); ($('#loader .msg')).textContent = 'Contexte graphique perdu — rechargement…'; setTimeout(() => location.reload(), 1500); });
const basePR = Math.min(window.devicePixelRatio || 1, q.pixelRatio);
renderer.setPixelRatio(basePR * opts.resScale);
setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x06090d, 0.05);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 1600);
const post = new Post(renderer, scene, camera, q);
(window as unknown as { __stage?: (s: string) => void }).__stage?.('Éclairage d’ambiance');
if (post.ao) { post.ao.configuration.aoRadius = 0.6; post.ao.configuration.intensity = 3; }
const pmrem = new THREE.PMREMGenerator(renderer);
// environnement de reflets : simple dégradé (aucune compilation de matériau éclairé)
{
  const W = 64, H = 32, data = new Uint16Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = 1 - y / (H - 1); // 1 = haut
    const panel = (v > 0.75 && (x % 16) < 5) ? 5 : 0;
    const r = 0.08 + v * 0.75 + panel, g = 0.09 + v * 0.85 + panel, b = 0.12 + v * 1.0 + panel;
    data.set([r, g, b, 1].map((v) => THREE.DataUtils.toHalfFloat(v)), (y * W + x) * 4);
  }
  const eq = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  eq.magFilter = THREE.LinearFilter; eq.minFilter = THREE.LinearFilter;
  eq.mapping = THREE.EquirectangularReflectionMapping; eq.needsUpdate = true;
  scene.environment = pmrem.fromEquirectangular(eq).texture;
}
scene.environmentIntensity = 0.06;
const hemi = new THREE.HemisphereLight(0x3a4c66, 0x0a0806, 0.12);
scene.add(hemi);
(window as unknown as { __stage?: (s: string) => void }).__stage?.('Ciel et planète');
const sky = new Sky(new THREE.Color(0.1, 0.42, 0.75), q.particles);
scene.add(sky);

// ---------- systèmes ----------
(window as unknown as { __stage?: (s: string) => void }).__stage?.('Commandes et son');
const input = new Input(canvas, $('#touch'));
input.sensitivity = opts.sensitivity; input.invertY = opts.invertY;
const audio = new AudioEngine();
audio.setVolumes({ music: opts.music, sfx: opts.sfx });
const voices = new Voices();
voices.speed = opts.speech ?? 1.3;
const hud = new Hud();
hud.device = input.device;
input.onDevice.push((d) => { hud.device = d; refreshHints(); });
const fps = new FpsMeter($('#fps'));
$('#fps').hidden = !opts.fps;

let save: SaveData = loadSave() ?? newSave();
type State = 'title' | 'play' | 'pause' | 'reboot' | 'intro' | 'cinematic';
let state: State = 'title';
let objective: ObjectiveKey = 'init';
let endShown = false;

const api: GameApi = {
  flags: save.flags,
  playLog, playHolo, setObjective, completeMission, checkpoint, kill, toast: (a, b) => hud.toast(a, b), enterRoom, clue, unlock, openKeypad, cinematic, endOfZone,
  saveNow: () => writeSave(save),
  alert: (txt) => setAlert(txt),
  radiation: (v) => setRadiation(v),
  rumble: (a, b, ms) => input.rumble(a, b, ms),
};
const zoneNum = (save.flags.zone2 ? 2 : 1) as 1 | 2;
if (zoneNum === 2) { scene.fog = new THREE.FogExp2(0x0a0605, 0.012); sky.planet.position.set(-80, -520, -120); sky.planet.scale.setScalar(1.6); sky.asterion.visible = false; }
(window as unknown as { __stage?: (s: string) => void }).__stage?.('Construction de la station');
const _t0 = performance.now();
const level: Zone1 | Zone2 = zoneNum === 2 ? new Zone2(scene, q, api, audio) : new Zone1(scene, q, api, audio);
const z1 = level instanceof Zone1 ? level : null;
const z2 = level instanceof Zone2 ? level : null;
if (z2) z2.onTeleport = (cp) => { save.cp = cp; writeSave(save); flashSaved(); respawn(); };
(window as unknown as { __timing: Record<string, number> }).__timing = { level: performance.now() - _t0, sinceNav: performance.now() };
(window as unknown as { __stage?: (s: string) => void }).__stage?.('Assemblage de R-12');
const player = new Player(scene, q);
if (opts.shadows === 'low') player.headlamp.shadow.mapSize.setScalar(512);
const tp = new ThirdPersonCamera(camera);
const robotEyes = player.robot as unknown as { eyePower: number };

// ---------- histoire ----------
let story: { cancel: () => void; skip: () => void } | null = null;
function stopStory() { story?.cancel(); story = null; voices.stop(); hud.subtitle(null); }

async function speakLines(lines: { crew: string; text: string }[], onLine?: (i: number) => void) {
  let cancelled = false;
  let cur: { cancel: () => void } | null = null;
  let skipWait: (() => void) | null = null;
  const me = { cancel: () => { cancelled = true; cur?.cancel(); skipWait?.(); }, skip: () => { cur?.cancel(); skipWait?.(); } };
  story = me;
  for (let i = 0; i < lines.length && !cancelled; i++) {
    const c = CREW[lines[i].crew];
    hud.subtitle(c.name, lines[i].text);
    onLine?.(i);
    if (opts.voices) { const s = voices.speak(lines[i].text, c.voice, c.voiceIndex, 1); cur = s; await s.done; }
    else await new Promise<void>((r) => { const h = setTimeout(r, (500 + lines[i].text.length * 42) / voices.speed); skipWait = () => { clearTimeout(h); r(); }; });
    if (!cancelled) await new Promise((r) => setTimeout(r, 150));
  }
  if (!cancelled) hud.subtitle(null);
  if (story === me) story = null;
  return !cancelled;
}
const MEMORIES = () => Object.keys(LOGS).length + Object.keys(HOLOS).length;
const found = () => save.logs.length + save.holos.length;

function playLog(id: string) {
  stopStory();
  const L = LOGS[id];
  const isNew = !save.logs.includes(id);
  if (isNew) { save.logs.push(id); audio.discovery(); writeSave(save); }
  const who = [...new Set(L.lines.map((l) => CREW[l.crew].first))].join(' et ');
  hud.toast(`${L.secret ? 'Secret · ' : ''}${L.kind === 'audio' ? 'Journal audio' : 'Journal écrit'} · ${L.title}`, `${who} — ${L.place}, ${L.day}${isNew ? ` · souvenirs ${found()}/${MEMORIES()}` : ''}`);
  audio.beep('ok', player.pos);
  speakLines(L.lines);
}

function playHolo(id: string, holo: Hologram, onDone?: () => void) {
  stopStory();
  const H = HOLOS[id];
  const isNew = !save.holos.includes(id);
  if (isNew) { save.holos.push(id); audio.discovery(); writeSave(save); }
  hud.toast(`${H.secret ? 'Secret · ' : ''}Hologramme · ${H.title}`, `${H.place}, ${H.day}${isNew ? ` · souvenirs ${found()}/${MEMORIES()}` : ''}`);
  holo.target = 1;
  audio.loop('holo', 'hum', holo.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0.15);
  setTimeout(() => {
    speakLines(H.lines, (i) => { const l = H.lines[i]; holo.people[l.crew]?.setGesture(l.gesture ?? 'none'); }).then(() => { holo.target = 0; audio.stopLoop('holo'); onDone?.(); });
  }, 900);
}

function clue(id: string) {
  if (save.clues.includes(id)) return;
  save.clues.push(id);
  hud.toast(`${CLUES[id].secret ? 'Secret · ' : 'Indice · '}${CLUES[id].title}`, CLUES[id].text);
  audio.beep('question', player.pos);
  writeSave(save);
}

function setObjective(k: ObjectiveKey) {
  if (k === objective) return;
  objective = k; save.objective = k;
  hud.setObjective(OBJECTIVES[k]);
  if (k !== 'init') audio.beep('ok');
  writeSave(save);
}

function completeMission(k: ObjectiveKey, next: ObjectiveKey) {
  if (save.flags['done_' + k]) return;
  save.flags['done_' + k] = true;
  setTimeout(() => hud.toast('Mission terminée', MISSION_NAMES[k] ?? ''), 600);
  audio.beep('happy', player.pos);
  setObjective(next);
}

function checkpoint(id: string) {
  if (level.cpOrder.indexOf(id) < level.cpOrder.indexOf(save.cp)) return;
  if (id !== save.cp) { save.cp = id; writeSave(save); flashSaved(); }
}
function flashSaved() { const e = $('#saved'); e.classList.remove('show'); void e.offsetWidth; e.classList.add('show'); }

function enterRoom(id: string) {
  hud.setZone(level.zoneName, ROOMS[id] ?? '');
  if (!save.visited.includes(id)) { save.visited.push(id); writeSave(save); }
  if (id === 'E' && objective === 'm3' && save.flags.notebook) setObjective('m4');
  if (id === 'F' && objective === 'm5') { /* déjà la bonne mission */ }
}

function unlock(what: 'lamp' | 'scan' | 'jetpack' | 'notebook' | 'boots') {
  save.flags[what] = true;
  audio.discovery(); input.rumble(0.3, 0.5, 250);
  if (what === 'lamp') {
    player.lampOn = true; save.flags.lampOff = false;
    audio.beep('happy', player.pos);
    hud.toast('Lampe frontale opérationnelle', `${hud.icon('lamp')} pour l'allumer ou l'éteindre`);
    completeMission('m1', 'm2');
  } else if (what === 'scan') {
    audio.beep('happy', player.pos);
    hud.toast('Module de scan installé', `${hud.icon('scan')} envoie une onde qui révèle les traces et les indices`);
    z1?.doors.dFG.setState('closed');
    completeMission('m5', 'm6');
  } else if (what === 'jetpack') {
    player.hasJetpack = true;
    audio.beep('happy', player.pos);
    hud.toast('Jetpack installé', `Maintiens ${hud.icon('jump')} en l'air pour voler`);
  } else if (what === 'boots') {
    player.hasBoots = true;
    audio.beep('happy', player.pos);
    hud.toast('Bottes magnétiques installées', 'Tu restes collé au métal : marche sur les murs, les plafonds… et la coque.');
  } else if (what === 'notebook') {
    setTimeout(() => hud.toast('Carnet débloqué', `Pause → Carnet : journaux, indices et carte de la station`), 4500);
  }
  refreshUnlocks();
  writeSave(save);
}
function refreshUnlocks() {
  $('#touch .tb.scan').hidden = !save.flags.scan;
  $('#touch .tb.lamp').hidden = !save.flags.lamp;
  $('#btn-notebook').hidden = !save.flags.notebook;
  $('#touch .tb.lamp').classList.toggle('off', !player.lampOn);
}

function applyPower() {
  audio.setPowered(true);
  audio.loop('hum', 'hum', new THREE.Vector3(-12.3, 2, -26.3), 0.12);
  envTarget = 0.32;
}

// ---------- clavier à code ----------
let keypadCb: ((code: string) => boolean) | null = null;
let keypadVal = '';
function openKeypad(onCode: (code: string) => boolean) {
  keypadCb = onCode; keypadVal = ''; renderKeypad();
  state = 'pause';
  openPanel('#keypad');
}
function renderKeypad(err = false) {
  $('#kp-display').textContent = keypadVal.padEnd(4, '·').split('').join(' ');
  $('#kp-display').classList.toggle('err', err);
}
$$('#keypad .kp').forEach((b) => (b.onclick = () => {
  const v = b.dataset.k as string;
  if (v === 'del') keypadVal = keypadVal.slice(0, -1);
  else if (keypadVal.length < 4) keypadVal += v;
  audio.ui('move');
  renderKeypad();
  if (keypadVal.length === 4) {
    const ok = keypadCb?.(keypadVal);
    if (ok) { audio.ui('ok'); setTimeout(() => { closeAllPanels(); if (state === 'pause') state = 'play'; }, 350); }
    else { audio.beep('sad'); renderKeypad(true); setTimeout(() => { keypadVal = ''; renderKeypad(); }, 700); }
  }
}));

// ---------- cinématiques ----------
let cine: { shots: Shot[]; i: number; t: number; onDone?: () => void } | null = null;
function cinematic(shots: Shot[], onDone?: () => void) {
  cine = { shots, i: 0, t: 0, onDone };
  state = 'cinematic';
  player.controllable = false;
  document.body.classList.add('cine');
  hud.setPrompt(null);
}
function updateCinematic(dt: number) {
  if (!cine) return;
  const s = cine.shots[cine.i];
  cine.t += dt;
  camera.up.set(0, 1, 0);
  const k = Math.min(1, cine.t / s.dur), e = k * k * (3 - 2 * k);
  const from = new THREE.Vector3(...s.pos), to = new THREE.Vector3(...(s.to ?? s.pos));
  const lf = new THREE.Vector3(...s.look), lt = new THREE.Vector3(...(s.lookTo ?? s.look));
  camera.position.copy(from.lerp(to, e));
  camera.lookAt(lf.lerp(lt, e));
  if (s.shake) { const a = s.shake * 0.012; camera.rotation.x += (Math.random() - 0.5) * a; camera.rotation.y += (Math.random() - 0.5) * a; }
  if (s.fov) { camera.fov += (s.fov - camera.fov) * Math.min(1, dt * 2); camera.updateProjectionMatrix(); }
  if (k >= 1) {
    cine.i++; cine.t = 0;
    if (cine.i >= cine.shots.length) {
      const done = cine.onDone; cine = null;
      document.body.classList.remove('cine');
      player.controllable = true;
      onResize();
      tp.snap(player.pos, tp.yaw);
      if (state === 'cinematic') state = 'play';
      done?.();
    }
  }
}

function endOfZone() {
  if (endShown) return;
  endShown = true;
  save.flags[zoneNum === 2 ? 'zone2done' : 'zone1done'] = true;
  setObjective(zoneNum === 2 ? 'end2' : 'end');
  if (zoneNum === 2) {
    $('#endcard small').textContent = 'Fin de la Zone 2 · Épave de l\'Asterion';
    $('#endcard h2').textContent = 'La surface';
    $('#endcard p').textContent = 'La capsule s\'écrase dans une forêt qui luit dans la nuit. Le signal est tout proche. La suite : Zone 3.';
    $('#btn-end-continue').textContent = 'Retour à l\'écran titre';
  } else $('#btn-end-continue').textContent = 'Continuer vers la Zone 2';
  writeSave(save);
  const f = (a: number, b: number) => `${a} / ${b}`;
  $('#end-logs').textContent = f(save.logs.length, Object.keys(LOGS).length);
  $('#end-holos').textContent = f(save.holos.length, Object.keys(HOLOS).length);
  $('#end-clues').textContent = f(save.clues.length, Object.keys(CLUES).length);
  $('#end-pct').textContent = Math.round((found() / MEMORIES()) * 100) + ' %';
  state = 'pause';
  openPanel('#endcard');
}

let rebootT = 0;
function kill(reason: string) {
  if (state !== 'play') return;
  state = 'reboot'; rebootT = 2.2;
  input.rumble(0.9, 0.9, 400);
  tp.shake = 1;
  audio.reboot();
  $('#reboot .why').textContent = reason;
  $('#reboot').classList.add('show');
}
function respawn() {
  const cp = level.checkpoints[save.cp] ?? level.checkpoints[level.cpOrder[0]];
  player.teleport(cp.pos, cp.yaw, cp.up);
  tp.snap(cp.pos, cp.yaw + Math.PI);
  level.current = cp.room;
  enterRoom(level.current);
}

// ---------- lampe ----------
function toggleLamp() {
  if (!save.flags.lamp) { hud.toast('Lampe hors service', 'Trouve une source d\'énergie pour la recharger.'); return; }
  player.lampOn = !player.lampOn;
  save.flags.lampOff = !player.lampOn;
  audio.servo(player.pos, 0.8); audio.ui(player.lampOn ? 'ok' : 'back');
  input.rumble(0.05, 0.2, 60);
  $('#touch .tb.lamp').classList.toggle('off', !player.lampOn);
}

// ---------- son : relance après coupure ----------
function updateSoundHint() {
  const muted = state !== 'title' && !audio.running;
  $('#nosound').classList.toggle('show', muted);
}

// ---------- interactions & scan ----------
let nearest: (typeof level.interact)[number] | null = null;
function updateInteract() {
  nearest = null;
  let best = Infinity;
  const p = player.pos.clone().addScaledVector(player.up, 0.6);
  for (const it of level.interact) {
    if (!it.enabled()) continue;
    const d = it.pos.distanceTo(p);
    if (d < it.r && d < best) { best = d; nearest = it; }
  }
  hud.setPrompt(nearest ? nearest.label : null, nearest?.verb);
}
function doScan() {
  if (!save.flags.scan) return;
  if (!player.scan()) return;
  level.revealFootprints();
  audio.scan();
  input.rumble(0.1, 0.3, 150);
  setTimeout(() => {
    const eye = player.pos.clone().addScaledVector(player.up, 0.9);
    const visible = (p: THREE.Vector3) => {
      const d = p.clone().sub(eye); const len = d.length();
      const hit = level.ph.raycast(eye, d.normalize(), len, true);
      return !hit || hit.dist > len - 0.6;
    };
    for (const s of level.scannables) {
      if (s.pos.distanceTo(player.pos) > 9.5) continue;
      if (!visible(s.pos)) continue;
      const known = s.clue ? save.clues.includes(s.clue) : false;
      hud.scanLabel(s.label, s.pos, known);
      if (s.clue) { clue(s.clue); save.flags['clue_' + s.clue] = true; }
      s.onScan?.();
    }
    for (const it of level.interact) if (it.enabled() && it.pos.distanceTo(player.pos) < 9.5 && visible(it.pos)) hud.scanLabel(it.label, it.pos, false);
  }, 450);
}

// ---------- menus ----------
let panelStack: string[] = [];
let focusIdx = 0;
function focusables() {
  const top = panelStack[panelStack.length - 1];
  return top ? $$(`${top} .f:not([hidden])`).filter((e) => e.offsetParent !== null) : [];
}
function setFocus(i: number) {
  const f = focusables();
  if (!f.length) return;
  focusIdx = (i + f.length) % f.length;
  f.forEach((e, k) => e.classList.toggle('focus', k === focusIdx));
  if (input.device !== 'touch') f[focusIdx].focus({ preventScroll: false });
}
function openPanel(sel: string) {
  panelStack.push(sel);
  $(sel).classList.add('show');
  input.menuMode = true; input.releasePointer();
  input.onNav = (d) => {
    const f = focusables();
    if (d === 'back') return backPanel();
    if (d === 'ok') { f[focusIdx]?.click(); audio.ui('ok'); return; }
    const el = f[focusIdx];
    if (el instanceof HTMLInputElement && el.type === 'range' && (d === 'left' || d === 'right')) {
      el.value = String(+el.value + (d === 'right' ? 1 : -1) * +el.step); el.dispatchEvent(new Event('input')); return;
    }
    if (el?.tagName === 'SELECT' && (d === 'left' || d === 'right')) {
      const s = el as HTMLSelectElement; s.selectedIndex = Math.max(0, Math.min(s.options.length - 1, s.selectedIndex + (d === 'right' ? 1 : -1))); s.dispatchEvent(new Event('change')); return;
    }
    setFocus(focusIdx + (d === 'down' || d === 'right' ? 1 : -1)); audio.ui('move');
  };
  setTimeout(() => setFocus(0), 30);
}
function backPanel() {
  const top = panelStack.pop();
  if (top) $(top).classList.remove('show');
  audio.ui('back');
  if (top === '#title-menu') { panelStack.push(top); $(top).classList.add('show'); return; }
  if (!panelStack.length) { input.menuMode = false; input.onNav = null; if (state === 'pause') resume(); }
  else setTimeout(() => setFocus(0), 30);
}
function closeAllPanels() { for (const p of panelStack) $(p).classList.remove('show'); panelStack = []; input.menuMode = false; input.onNav = null; }

function pause() {
  if (state !== 'play') return;
  state = 'pause';
  voices.stop();
  openPanel('#pause');
}
function resume() {
  closeAllPanels();
  state = 'play';
}

// boutons
$('#btn-resume').onclick = () => resume();
$('#btn-notebook').onclick = () => { renderNotebook('logs'); openPanel('#notebook'); };
$('#btn-options').onclick = () => openPanel('#options');
$('#btn-options-title').onclick = () => openPanel('#options');
$('#btn-controls').onclick = () => openPanel('#controls');
$('#btn-controls-title').onclick = () => openPanel('#controls');
$('#btn-quit').onclick = () => { closeAllPanels(); stopStory(); toTitle(); };
$$('.back').forEach((b) => (b.onclick = () => backPanel()));
$('#btn-continue').onclick = () => startGame(false);
$('#btn-new').onclick = () => { if (loadSave() && !confirm('Recommencer une nouvelle partie ? La progression actuelle sera effacée.')) return; startGame(true); };
$('#btn-end-continue').onclick = () => {
  closeAllPanels();
  if (zoneNum === 1) { goToZone2(); return; }
  toTitle();
};
function goToZone2() {
  save.flags.zone2 = true; save.cp = 'X'; save.objective = 'm10'; writeSave(save);
  location.hash = 'go'; location.reload();
}
$('#pausebtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); pause(); });

// carnet
$$('#notebook .tab').forEach((t) => (t.onclick = () => renderNotebook(t.dataset.tab as string)));
function renderNotebook(tab: string) {
  $$('#notebook .tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
  const body = $('#nb-body');
  body.innerHTML = '';
  const total = Object.keys(LOGS).length + Object.keys(HOLOS).length;
  $('#nb-progress').textContent = `Souvenirs retrouvés : ${found()} / ${total} (${Math.round((found() / total) * 100)} %)`;
  if (tab === 'logs' || tab === 'holos') {
    const all = tab === 'logs' ? Object.values(LOGS) : Object.values(HOLOS);
    for (const e of all) {
      const isFound = (tab === 'logs' ? save.logs : save.holos).includes(e.id);
      const d = document.createElement('div'); d.className = 'entry' + (isFound ? '' : ' locked');
      if (!isFound) { d.innerHTML = `<b>${e.secret ? '★ Secret' : '???'}</b><small>Non découvert</small>`; body.appendChild(d); continue; }
      const who = [...new Set(e.lines.map((l) => CREW[l.crew].first))].join(' & ');
      const multi = new Set(e.lines.map((l) => l.crew)).size > 1;
      const text = multi ? e.lines.map((l) => `<em>${CREW[l.crew].first} :</em> ${l.text}`).join('<br>') : e.lines.map((l) => l.text).join(' ');
      d.innerHTML = `<b>${e.secret ? '★ ' : ''}${e.title}</b><small>${who} · ${e.place} · ${e.day}</small><p>${text}</p>`;
      if (tab === 'logs') {
        const b = document.createElement('button'); b.className = 'f small'; b.textContent = '▶ Réécouter';
        b.onclick = () => { closeAllPanels(); state = 'play'; playLog(e.id); };
        d.appendChild(b);
      }
      body.appendChild(d);
    }
  } else if (tab === 'clues') {
    for (const c of Object.values(CLUES)) {
      const ok = save.clues.includes(c.id);
      const d = document.createElement('div'); d.className = 'entry' + (ok ? '' : ' locked');
      d.innerHTML = ok ? `<b>${c.secret ? '★ ' : ''}${c.title}</b><p>${c.text}</p>` : `<b>${c.secret ? '★ Secret' : '???'}</b><small>Examine le décor ou utilise le scanner pour révéler les indices.</small>`;
      body.appendChild(d);
    }
  } else if (tab === 'map') {
    const cv = document.createElement('canvas'); cv.width = 900; cv.height = 900; cv.className = 'map';
    body.appendChild(cv);
    drawMap(cv);
  } else if (tab === 'crew') {
    for (const c of Object.values(CREW).filter((c) => c.id !== 'inconnu')) {
      const d = document.createElement('div'); d.className = 'entry';
      d.innerHTML = `<b>${c.name}</b><small>${c.role}</small><p>${c.bio}</p>`;
      body.appendChild(d);
    }
  }
  setTimeout(() => setFocus(0), 30);
}
function drawMap(cv: HTMLCanvasElement) {
  const g = cv.getContext('2d')!;
  const rooms = Object.values(level.rooms);
  const { minX, maxX, minZ, maxZ } = level.mapBounds;
  const s = Math.min(cv.width / (maxX - minX), cv.height / (maxZ - minZ)) * 0.92;
  const ox = (cv.width - (maxX - minX) * s) / 2, oz = (cv.height - (maxZ - minZ) * s) / 2;
  const X = (x: number) => ox + (x - minX) * s, Z = (z: number) => oz + (z - minZ) * s;
  g.fillStyle = '#050a10'; g.fillRect(0, 0, cv.width, cv.height);
  g.strokeStyle = 'rgba(95,214,255,0.08)';
  for (let x = minX; x <= maxX; x += 2) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), cv.height); g.stroke(); }
  for (let z = minZ; z <= maxZ; z += 2) { g.beginPath(); g.moveTo(0, Z(z)); g.lineTo(cv.width, Z(z)); g.stroke(); }
  for (const r of rooms) {
    const sp = r.spec;
    const vis = save.visited.includes(sp.id);
    if (!vis) continue;
    g.fillStyle = level.current === sp.id ? 'rgba(95,214,255,0.22)' : 'rgba(95,214,255,0.09)';
    g.strokeStyle = 'rgba(140,220,255,0.85)'; g.lineWidth = 2;
    g.fillRect(X(sp.x0), Z(sp.z0), (sp.x1 - sp.x0) * s, (sp.z1 - sp.z0) * s);
    g.strokeRect(X(sp.x0), Z(sp.z0), (sp.x1 - sp.x0) * s, (sp.z1 - sp.z0) * s);
    if (!/^D\d/.test(sp.id)) { g.fillStyle = '#bfe9ff'; g.font = '600 15px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.fillText(ROOMS[sp.id].toUpperCase(), X((sp.x0 + sp.x1) / 2), Z((sp.z0 + sp.z1) / 2)); }
  }
  const op = level.objectivePos[objective];
  if (op) { g.fillStyle = '#ffd36a'; g.save(); g.translate(X(op.x), Z(op.z)); g.rotate(Math.PI / 4); g.fillRect(-7, -7, 14, 14); g.restore(); }
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(X(player.pos.x), Z(player.pos.z), 8, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(player.pos.x), Z(player.pos.z));
  g.lineTo(X(player.pos.x + Math.sin(player.yaw) * 1.4), Z(player.pos.z + Math.cos(player.yaw) * 1.4)); g.stroke();
}

// options
function bindOptions() {
  const qs = $<HTMLSelectElement>('#o-preset');
  for (const p of Object.values(PRESETS)) { const o = document.createElement('option'); o.value = p.id; o.textContent = p.label; qs.appendChild(o); }
  qs.value = q.id;
  qs.onchange = () => { saveQuality(qs.value as PresetId); localStorage.removeItem('dernier-signal:options'); $('#o-reload').hidden = false; };
  const range = (id: string, key: keyof Options, apply: (v: number) => void) => {
    const el = $<HTMLInputElement>(id); el.value = String(opts[key]);
    el.oninput = () => { (opts[key] as number) = +el.value; apply(+el.value); saveOptions(opts); };
  };
  const toggle = (id: string, key: keyof Options, apply: (v: boolean) => void, reload = false) => {
    const el = $<HTMLInputElement>(id); el.checked = !!opts[key];
    el.onchange = () => { (opts[key] as boolean) = el.checked; apply(el.checked); saveOptions(opts); if (reload) $('#o-reload').hidden = false; };
  };
  range('#o-res', 'resScale', (v) => { renderer.setPixelRatio(basePR * v); onResize(); });
  range('#o-particles', 'particles', () => { $('#o-reload').hidden = false; });
  range('#o-music', 'music', (v) => audio.setVolumes({ music: v }));
  range('#o-sfx', 'sfx', (v) => audio.setVolumes({ sfx: v }));
  range('#o-sens', 'sensitivity', (v) => (input.sensitivity = v));
  range('#o-speech', 'speech', (v) => (voices.speed = v));
  toggle('#o-bloom', 'bloom', (v) => (post.bloom.blendMode.opacity.value = v ? 1 : 0));
  toggle('#o-vol', 'volumetric', () => {}, true);
  toggle('#o-fps', 'fps', (v) => ($('#fps').hidden = !v));
  toggle('#o-invert', 'invertY', (v) => (input.invertY = v));
  toggle('#o-voices', 'voices', () => {});
  const sh = $<HTMLSelectElement>('#o-shadows'); sh.value = opts.shadows;
  sh.onchange = () => { opts.shadows = sh.value as 'low' | 'high'; saveOptions(opts); const s = player.headlamp.shadow; s.mapSize.setScalar(opts.shadows === 'low' ? 512 : (q.id === 'equilibre' || q.id === 'econome') ? 1024 : 2048); s.map?.dispose(); s.map = null as unknown as THREE.WebGLRenderTarget; };
  $('#o-reload').onclick = () => location.reload();
  $('#o-reset').onclick = () => { if (confirm('Effacer la sauvegarde ?')) { clearSave(); location.reload(); } };
}
bindOptions();

function refreshHints() {
  $$('[data-hint]').forEach((e) => (e.textContent = hud.icon(e.dataset.hint as string)));
}

// ---------- écran titre ----------
let titleT = 0;
function toTitle() {
  state = 'title';
  if (z1) { level.current = 'E'; z1.shutter.open = 1; }
  $('#hud').classList.remove('show'); $('#touch').classList.remove('show');
  $('#btn-continue').hidden = !loadSave();
  $('#title').classList.add('show');
  openPanel('#title-menu');
}

function restoreFromSave() {
  api.flags = save.flags;
  player.hasJetpack = !!save.flags.jetpack;
  player.lampOn = !!save.flags.lamp && !save.flags.lampOff;
  player.hasBoots = !!save.flags.boots;
  if (z1) z1.shutter.open = save.flags.shutter ? 1 : 0;
  level.applyFlags();
  if (z1 && save.flags.power) applyPower();
  if (z2) { audio.setPowered(!!save.flags.reactor); envTarget = 0.12; }
  endShown = !!save.flags[zoneNum === 2 ? 'zone2done' : 'zone1done'];
  objective = (save.objective as ObjectiveKey) in OBJECTIVES ? (save.objective as ObjectiveKey) : 'init';
  hud.setObjective(OBJECTIVES[objective]);
  refreshUnlocks();
}

async function startGame(fresh: boolean) {
  audio.unlock();
  if (fresh) { clearSave(); location.hash = 'new'; location.reload(); return; }
  if (zoneNum === 1 && save.flags.zone1done) { goToZone2(); return; }
  closeAllPanels();
  $('#title').classList.remove('show');
  restoreFromSave();
  respawn();
  audio.startAmbience('station');
  audio.setPowered(!!save.flags[z2 ? 'reactor' : 'power']);
  $('#hud').classList.add('show'); $('#touch').classList.add('show');
  refreshHints();
  if (z1 && save.cp === 'A' && !save.flags.prologue) await intro();
  else robotEyes.eyePower = 1;
  if (z2 && !save.flags.z2intro) dockingIntro();
  if (state !== 'cinematic') state = 'play';
}

async function intro() {
  // Prologue : écran noir, diagnostic, puis vue subjective floue → nette ; les yeux s'allument et se reflètent dans la vitre.
  state = 'intro';
  player.controllable = false;
  robotEyes.eyePower = 0;
  const boot = $('#boot');
  boot.classList.add('show');
  hud.setObjective(OBJECTIVES.init);
  const lines = ['R-12 · UNITÉ DE MAINTENANCE', 'SÉQUENCE DE RÉACTIVATION…', 'ÉNERGIE INTERNE ············ 63 %', 'SERVO GENOU GAUCHE ········· USURE', 'LIAISON STATION ············ AUCUNE RÉPONSE', 'ÉQUIPAGE DÉTECTÉ ··········· 0', 'ORDRE ACTIF : PRENDRE SOIN DE LA STATION'];
  const box = $('#boot .lines'); box.innerHTML = '';
  audio.beep('boot');
  for (const l of lines) {
    const d = document.createElement('div'); d.textContent = l; box.appendChild(d);
    audio.ui('move');
    await new Promise((r) => setTimeout(r, l.includes('ORDRE') ? 1400 : 650));
  }
  // vue subjective : depuis la tête du robot, face à la vitre du poste de recharge
  prologueT = 0;
  state = 'intro';
  canvas.style.filter = 'blur(14px) brightness(0.6)';
  boot.classList.add('fade');
  await new Promise((r) => setTimeout(r, 1400));
  boot.classList.remove('show', 'fade');
  await new Promise((r) => setTimeout(r, 5200));
  canvas.style.filter = '';
  z1?.openCradle();
  save.flags.prologue = true;
  // la caméra recule : vue à la troisième personne
  const head = player.pos.clone().add(new THREE.Vector3(0, 0.92, 0));
  cinematic([{ pos: [head.x, head.y, head.z - 0.15], look: [0, 0.9, 6], to: [0, 1.9, 5.2], lookTo: [0, 0.8, 8.5], dur: 3.2, fov: 62 }], () => {
    tp.snap(player.pos, 0);
    setObjective('m1');
    hud.toast('Commandes', input.device === 'touch' ? 'Joystick à gauche pour bouger · glisse à droite pour regarder' : input.device === 'gamepad' ? 'Stick gauche : bouger · stick droit : caméra' : 'ZQSD / WASD : bouger · souris : caméra (clic pour capturer)');
    audio.beep('question', player.pos);
    writeSave(save);
  });
}
let prologueT = -1;

/** Mission 10 · L'amarrage : la navette arrive de travers contre l'épave, éclairée par les orages de la planète. */
function dockingIntro() {
  if (!z2) return;
  save.flags.z2intro = true;
  z2.dockT = 0;
  player.robot.visible = false;
  setObjective('m10');
  cinematic([
    { pos: [70, 30, 70], look: [24, 4, 8], to: [55, 18, 50], lookTo: [20, 0, 6], dur: 4.5, fov: 50 },
    { pos: [30, 4, -4], look: [22, 1, 8], to: [28, 3, -2], lookTo: [22, 1.5, 6], dur: 2.5, fov: 55, shake: 0.6 },
  ], () => {
    player.robot.visible = true;
    hud.toast('Apesanteur', input.device === 'touch' ? 'Boutons ▲ ▼ pour monter et descendre' : input.device === 'gamepad' ? 'Gâchettes : monter / descendre' : 'Maj : monter · Ctrl : descendre');
    writeSave(save);
  });
}

// ---------- alertes & radiations ----------
let alertTxt: string | null = null;
function setAlert(txt: string | null) {
  if (txt === alertTxt) return;
  alertTxt = txt;
  const e = $('#alert'); e.textContent = txt ?? ''; e.classList.toggle('show', !!txt);
  if (txt) audio.beep('alert');
}
let radV = 0;
function setRadiation(v: number) {
  if (Math.abs(v - radV) < 0.01) return;
  radV = v; $('#rad').style.opacity = String(Math.min(1, v * 1.2));
}

// ---------- boucle ----------
let envTarget = 0.06;
let soundCheck = 0;
function onResize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w / h < 1 ? 72 : 62; camera.updateProjectionMatrix();
  post.setSize(w, h);
}
addEventListener('resize', onResize);
const timer = new THREE.Timer();
let t = 0;

function frame() {
  requestAnimationFrame(frame);
  timer.update();
  const dt = Math.min(timer.getDelta(), 1 / 20);
  fps.tick(dt);
  step(dt);
  post.render(dt);
  input.endFrame();
}

function step(dt: number) {
  t += dt;
  input.update(dt);
  // la manette ne compte pas comme un « geste » pour Safari : on tente quand même de relancer le son
  if (input.padPressed && !audio.running) audio.ensure();
  soundCheck -= dt;
  if (soundCheck <= 0) { soundCheck = 0.5; updateSoundHint(); }

  if (state === 'title') {
    titleT += dt;
    // caméra qui dérive lentement dans la baie d'observation, face à la planète
    level.titleCamera(titleT, camera);
    level.update(dt, t, camera.position, () => false, false);
  } else {
    if (state === 'play') {
      if (input.wasPressed('pause')) pause();
      else if (input.wasPressed('map') && save.flags.notebook) { renderNotebook('map'); state = 'pause'; openPanel('#notebook'); }
      else {
        if (input.wasPressed('interact') && nearest) { nearest.act(); audio.servo(player.pos); }
        else if (input.wasPressed('interact') && story) { story.skip(); audio.ui('move'); }
        if (input.wasPressed('scan')) doScan();
        if (input.wasPressed('lamp')) toggleLamp();
      }
    }
    const playing = state === 'play' || state === 'intro' || state === 'cinematic';
    if (playing || state === 'reboot') {
      if (state === 'cinematic') updateCinematic(dt);
      else if (state === 'intro' && prologueT >= 0) {
        // vue subjective du prologue : la netteté revient, les yeux s'allument et se reflètent
        prologueT += dt;
        const k = Math.min(1, prologueT / 5);
        canvas.style.filter = `blur(${(14 * (1 - k)).toFixed(1)}px) brightness(${(0.6 + 0.4 * k).toFixed(2)})`;
        robotEyes.eyePower = THREE.MathUtils.clamp((prologueT - 1.5) / 1.2, 0, 1) * (prologueT < 2.2 && Math.sin(prologueT * 40) > 0 ? 0.3 : 1);
        if (z1) { const rm = z1.eyeReflection.userData.mat as THREE.MeshBasicMaterial; rm.opacity = robotEyes.eyePower * 0.55; }
        const hp = player.pos.clone().add(new THREE.Vector3(0, 0.92, 0));
        camera.position.set(hp.x + Math.sin(prologueT * 0.5) * 0.02, hp.y + Math.sin(prologueT * 0.8) * 0.01, hp.z - 0.15);
        camera.lookAt(Math.sin(prologueT * 0.3) * 0.3, 1.0 + Math.sin(prologueT * 0.4) * 0.08, hp.z - 4);
      } else if (state !== 'reboot') tp.update(dt, input.look, player.pos, player.body.vel, player.visUp, level.ph, t);
      player.external.copy(level.external);
      player.env = level.env(player.pos);
      document.body.classList.toggle('zerog', player.env.zeroG);
      player.robot.visible = !(state === 'intro' && prologueT >= 0 && prologueT < 6.6);
      player.update(dt, t, input, tp.frame, tp.yaw, tp.forward(), level.ph, audio);
      if (z1 && player.pos.y < -8) kill('Chute');
      level.update(dt, t, player.pos, (box) => {
        const b = new THREE.Box3().setFromCenterAndSize(player.pos.clone().addScaledVector(player.up, 0.5), new THREE.Vector3(0.6, 0.6, 0.6).addScaledVector(new THREE.Vector3(Math.abs(player.up.x), Math.abs(player.up.y), Math.abs(player.up.z)), 0.4));
        return b.intersectsBox(box);
      });
      if (state === 'play') updateInteract(); else hud.setPrompt(null);
    }
    if (state === 'reboot') {
      rebootT -= dt;
      if (rebootT < 1.1 && rebootT + dt >= 1.1) respawn();
      if (rebootT <= 0) { $('#reboot').classList.remove('show'); state = 'play'; }
    }
    if (state === 'play') save.playTime += state === 'play' ? dt : 0;
    const head = player.robot.j.head.getWorldPosition(new THREE.Vector3());
    hud.update(dt, camera, state === 'play' ? objectiveTarget() : null, player.pos, { has: player.hasJetpack, energy: player.energy, active: player.jetting }, head);
  }
  scene.environmentIntensity += (envTarget - scene.environmentIntensity) * Math.min(1, dt);
  hemi.intensity = 0.1 + scene.environmentIntensity * 0.3;
  sky.position.copy(camera.position);
  if (z2) sky.planet.visible = z2.descentT < 10;
  sky.update(t);
  audio.updateListener(camera);
}

/** Marqueur : position de l'objectif courant (certaines missions changent de cible selon l'avancée). */
function objectiveTarget() {
  if (objective === 'm2') return level.objectivePos.m2 ?? null;
  return level.objectivePos[objective] ?? null;
}

// ---------- démarrage ----------
async function boot() {
  onResize();
  const tm = (window as unknown as { __timing: Record<string, number> }).__timing;
  let _t = performance.now();
  const lt = $('#loader .msg');
  (window as unknown as { __stage?: (s: string) => void }).__stage?.('Téléchargement des textures');
  const prog = setInterval(() => { const p = textureProgress(); lt.textContent = `Chargement de la station… ${Math.round((p.loaded / Math.max(1, p.total)) * 100)} %`; }, 120);
  await texturesReady();
  clearInterval(prog);
  tm.textures = performance.now() - _t; _t = performance.now();
  // compilation des shaders avant d'afficher (évite les saccades)
  level.current = z1 ? 'E' : 'X';
  for (const r of Object.values(level.rooms)) r.group.visible = true;
  (window as unknown as { __stage?: (s: string) => void }).__stage?.('Préparation des effets graphiques');
  await new Promise((r) => requestAnimationFrame(r));
  unifyScene(scene);
  // compiler pour la vraie cible (tampon HDR linéaire du post-traitement), sinon tout serait recompilé
  const rtProbe = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  renderer.setRenderTarget(rtProbe);
  // rendre visibles un instant les objets cachés (flammes, hologrammes, arcs…) pour les précompiler aussi
  const hidden: THREE.Object3D[] = [];
  scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  await renderer.compileAsync(scene, camera);
  for (const o of hidden) o.visible = false;
  renderer.setRenderTarget(null); rtProbe.dispose();
  // deux images de préchauffage (post-traitement) cachées sous l'écran de chargement
  step(1 / 60); post.render(1 / 60); step(1 / 60); post.render(1 / 60);
  tm.compile = performance.now() - _t; tm.total = performance.now();
  $('#loader').classList.add('done');
  frame();
  // lancement réussi après quelques secondes de rendu stable
  setTimeout(bootSucceeded, 4000);
  if (recoveredFromCrash) setTimeout(() => hud.toast('Mode économe activé', 'Le lancement précédent n\'a pas abouti. Tu peux remonter la qualité dans Options.'), 1500);
  let ambienceStarted = false;
  // chaque toucher / touche relance le son s'il a été coupé (connexion d'une manette, appel, veille…)
  const wake = () => {
    audio.ensure();
    if (!ambienceStarted && audio.ctx) { ambienceStarted = true; if (state === 'title') audio.startAmbience('menu'); }
  };
  addEventListener('pointerdown', wake, true); addEventListener('keydown', wake, true); addEventListener('touchend', wake, true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') audio.ensure(); });
  if (location.hash === '#go') { history.replaceState(null, '', location.pathname); toTitleThen(true); }
  else if (location.hash === '#new') { history.replaceState(null, '', location.pathname); save = newSave(); api.flags = save.flags; writeSave(save); toTitleThen(true); }
  else toTitle();
}
function toTitleThen(fresh: boolean) {
  toTitle();
  if (fresh) {
    // après un rechargement « nouvelle partie », un geste est requis pour le son (Safari)
    $('#tap').classList.add('show');
    const go = () => { $('#tap').classList.remove('show'); removeEventListener('pointerdown', go); removeEventListener('keydown', go); startGame(false); };
    addEventListener('pointerdown', go); addEventListener('keydown', go);
  }
}
// outils de test automatisé : simulation accélérée sans rendu
const simulate = (sec: number, keys: string[] = []) => {
  const k = (input as unknown as { keys: Set<string> }).keys;
  keys.forEach((c) => k.add(c));
  for (let i = 0; i < sec * 30; i++) { step(1 / 30); input.endFrame(); }
  keys.forEach((c) => k.delete(c));
};
const press = (b: string) => { (input as unknown as { pressed: Set<string> }).pressed.add(b); step(1 / 30); input.endFrame(); };
(window as unknown as { __game: unknown }).__game = { zone: zoneNum, goToZone2, level, player, save: () => save, state: () => state, tp, kill, startGame, simulate, press, input, renderer, setPrologue: (v: number) => { prologueT = v; state = 'intro'; } };
boot().catch((e) => { $('#loader').textContent = 'Erreur : ' + e; console.error(e); });
