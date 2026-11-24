import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import '../ui/base.css';
import '../ui/game.css';
import { loadQuality, saveQuality, PRESETS, isTouchDevice, type PresetId } from '../core/quality';
import { createRenderer, Post, FpsMeter } from '../core/post';
import { texturesReady, setMaxAnisotropy } from '../core/textures';
import { setMaterialRes } from '../robots/materials';
import { Input } from './input';
import { Player } from './player';
import { ThirdPersonCamera } from './camera';
import { Level, type GameApi, type ObjectiveKey, type Hologram } from '../world/level1';
import { Sky } from '../world/sky';
import { AudioEngine, Voices } from '../audio/audio';
import { Hud } from '../ui/hud';
import { PowerPuzzle } from '../ui/puzzle';
import { loadSave, writeSave, newSave, clearSave, loadOptions, saveOptions, type SaveData, type Options } from './save';
import { LOGS, HOLOS, CLUES, OBJECTIVES, ROOMS } from '../story/zone1';
import { CREW } from '../story/crew';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const $$ = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];

// ---------- réglages ----------
const q = loadQuality();
const opts: Options = loadOptions({ preset: q.id, resScale: 1, shadows: q.id === 'equilibre' ? 'low' : 'high', volumetric: q.volumetric, particles: q.particles, bloom: q.bloom, fps: false, music: 0.7, sfx: 0.9, sensitivity: 1, invertY: false, voices: true });
q.volumetric = opts.volumetric; q.particles = opts.particles; q.bloom = opts.bloom;
setMaterialRes(q.textureRes);
document.body.dataset.device = isTouchDevice() ? 'touch' : 'keyboard';

// ---------- rendu ----------
const canvas = $<HTMLCanvasElement>('#c');
const renderer = createRenderer(canvas, q);
const basePR = Math.min(window.devicePixelRatio || 1, q.pixelRatio);
renderer.setPixelRatio(basePR * opts.resScale);
setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x06090d, 0.05);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 1600);
const post = new Post(renderer, scene, camera, q);
if (post.ao) { post.ao.configuration.aoRadius = 0.6; post.ao.configuration.intensity = 3; }
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.06;
const hemi = new THREE.HemisphereLight(0x3a4c66, 0x0a0806, 0.12);
scene.add(hemi);
const sky = new Sky(new THREE.Color(0.1, 0.42, 0.75), q.particles);
scene.add(sky);

// ---------- systèmes ----------
const input = new Input(canvas, $('#touch'));
input.sensitivity = opts.sensitivity; input.invertY = opts.invertY;
const audio = new AudioEngine();
audio.setVolumes({ music: opts.music, sfx: opts.sfx });
const voices = new Voices();
const hud = new Hud();
hud.device = input.device;
input.onDevice.push((d) => { hud.device = d; refreshHints(); });
const puzzle = new PowerPuzzle($('#puzzle'));
const fps = new FpsMeter($('#fps'));
$('#fps').hidden = !opts.fps;

let save: SaveData = loadSave() ?? newSave();
type State = 'title' | 'play' | 'pause' | 'puzzle' | 'reboot' | 'intro';
let state: State = 'title';
let objective: ObjectiveKey = 'wake';
let endShown = false;

const api: GameApi = {
  flags: save.flags,
  playLog, playHolo, openPuzzle, gainJetpack, setObjective, checkpoint, kill, toast: (a, b) => hud.toast(a, b), enterRoom, clue, endOfSlice,
};
const level = new Level(scene, q, api, audio);
const player = new Player(scene, q);
if (opts.shadows === 'low') player.headlamp.shadow.mapSize.setScalar(512);
const tp = new ThirdPersonCamera(camera);

// ---------- histoire ----------
let story: { cancel: () => void } | null = null;
function stopStory() { story?.cancel(); story = null; voices.stop(); hud.subtitle(null); }

async function speakLines(lines: { crew: string; text: string }[], onLine?: (i: number) => void) {
  let cancelled = false;
  let cur: { cancel: () => void } | null = null;
  story = { cancel: () => { cancelled = true; cur?.cancel(); } };
  for (let i = 0; i < lines.length && !cancelled; i++) {
    const c = CREW[lines[i].crew];
    hud.subtitle(c.name, lines[i].text);
    onLine?.(i);
    if (opts.voices) { const s = voices.speak(lines[i].text, c.voice, c.voiceIndex, 1); cur = s; await s.done; }
    else await new Promise((r) => setTimeout(r, 900 + lines[i].text.length * 55));
    if (!cancelled) await new Promise((r) => setTimeout(r, 350));
  }
  if (!cancelled) hud.subtitle(null);
  return !cancelled;
}

function playLog(id: string) {
  stopStory();
  const L = LOGS[id];
  const isNew = !save.logs.includes(id);
  if (isNew) { save.logs.push(id); audio.discovery(); writeSave(save); }
  hud.toast(`${L.kind === 'audio' ? 'Journal audio' : 'Journal écrit'} · ${L.title}`, `${CREW[L.crew].name} — ${L.place}, ${L.day}${isNew ? ` · ${save.logs.length}/${Object.keys(LOGS).length}` : ''}`);
  audio.beep('ok', player.pos);
  speakLines(L.lines.map((text) => ({ crew: L.crew, text })));
}

function playHolo(id: string, holo: Hologram) {
  stopStory();
  const H = HOLOS[id];
  const isNew = !save.holos.includes(id);
  if (isNew) { save.holos.push(id); audio.discovery(); writeSave(save); }
  hud.toast(`Hologramme · ${H.title}`, `${H.place}, ${H.day}${isNew ? ` · ${save.holos.length}/${Object.keys(HOLOS).length}` : ''}`);
  holo.target = 1;
  audio.loop('holo', 'hum', holo.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0.15);
  setTimeout(() => {
    speakLines(H.lines, (i) => { const l = H.lines[i]; holo.people[l.crew]?.setGesture(l.gesture ?? 'none'); }).then(() => { holo.target = 0; audio.stopLoop('holo'); });
  }, 900);
}

function clue(id: string) {
  if (save.clues.includes(id)) return;
  save.clues.push(id);
  hud.toast(`Indice · ${CLUES[id].title}`, CLUES[id].text);
  audio.beep('question', player.pos);
  writeSave(save);
}

function setObjective(k: ObjectiveKey) {
  objective = k; save.objective = k;
  hud.setObjective(OBJECTIVES[k]);
  if (k !== 'wake') audio.beep('ok');
  writeSave(save);
}

const CP_ORDER = ['A', 'B', 'C', 'E', 'F'];
function checkpoint(id: string) {
  if (CP_ORDER.indexOf(id) < CP_ORDER.indexOf(save.cp)) return;
  if (id !== save.cp) { save.cp = id; writeSave(save); flashSaved(); }
}
function flashSaved() { const e = $('#saved'); e.classList.remove('show'); void e.offsetWidth; e.classList.add('show'); }

function enterRoom(id: string) {
  hud.setZone('Station Halcyon', ROOMS[id]);
  if (!save.visited.includes(id)) { save.visited.push(id); writeSave(save); }
  if (id === 'C' && objective === 'power') setObjective('route');
  if (id === 'D' && objective === 'quarters') setObjective('hangar');
  if (id === 'E' && objective === 'hangar') setObjective('jetpack');
  if (id === 'F' && objective === 'catwalk') setObjective('bay');
}

function openPuzzle() {
  if (state !== 'play') return;
  state = 'puzzle'; input.menuMode = true; input.releasePointer();
  input.onNav = (d) => puzzle.nav(d);
  audio.beep('question', player.pos);
  puzzle.show(() => {
    state = 'play'; input.menuMode = false; input.onNav = null;
    applyPower(true);
    hud.toast('Énergie rétablie', 'Secteurs A · B · C · D alimentés');
    setObjective('quarters');
    save.flags.power = true; writeSave(save);
  }, () => { state = 'play'; input.menuMode = false; input.onNav = null; }, (k) => audio.ui(k));
}

function applyPower(animated: boolean) {
  if (animated) level.restorePower();
  else { level.powered = true; level.doors.dCD.setState('closed'); for (const id of ['A', 'B', 'C', 'D']) level.setRoomLight(id, id === 'D' ? 0.85 : 1); }
  audio.setPowered(true);
  audio.loop('hum', 'hum', new THREE.Vector3(0, 2, -22.5), 0.12);
  envTarget = 0.32;
}

function gainJetpack() {
  save.flags.jetpack = true; player.hasJetpack = true;
  audio.discovery(); audio.beep('happy', player.pos); input.rumble(0.4, 0.6, 300);
  hud.toast('Module de propulsion installé', `Maintiens ${hud.icon('jump')} en l'air pour utiliser le jetpack`);
  setObjective('catwalk');
  writeSave(save);
}

function endOfSlice() {
  if (endShown) return;
  endShown = true;
  setObjective('end');
  audio.discovery();
  setTimeout(() => {
    const f = (a: number, b: number) => `${a} / ${b}`;
    $('#end-logs').textContent = f(save.logs.length, Object.keys(LOGS).length);
    $('#end-holos').textContent = f(save.holos.length, Object.keys(HOLOS).length);
    $('#end-clues').textContent = f(save.clues.length, Object.keys(CLUES).length);
    const total = Object.keys(LOGS).length + Object.keys(HOLOS).length;
    $('#end-pct').textContent = Math.round(((save.logs.length + save.holos.length) / total) * 100) + ' %';
    openPanel('#endcard');
  }, 6500);
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
  const cp = level.checkpoints[save.cp] ?? level.checkpoints.A;
  player.teleport(cp.pos, cp.yaw);
  tp.snap(cp.pos, cp.yaw + Math.PI);
  level.current = ({ A: 'A', B: 'B', C: 'C', E: 'E', F: 'F' } as Record<string, string>)[cp.id] ?? 'A';
  enterRoom(level.current);
}

// ---------- interactions & scan ----------
let nearest: (typeof level.interact)[number] | null = null;
function updateInteract() {
  nearest = null;
  let best = Infinity;
  const p = player.pos.clone().add(new THREE.Vector3(0, 0.6, 0));
  for (const it of level.interact) {
    if (!it.enabled()) continue;
    const d = it.pos.distanceTo(p);
    if (d < it.r && d < best) { best = d; nearest = it; }
  }
  hud.setPrompt(nearest ? nearest.label : null, nearest?.verb);
}
function doScan() {
  if (!player.scan()) return;
  audio.scan();
  input.rumble(0.1, 0.3, 150);
  setTimeout(() => {
    const eye = player.pos.clone().add(new THREE.Vector3(0, 0.9, 0));
    const visible = (p: THREE.Vector3) => {
      const d = p.clone().sub(eye); const len = d.length();
      const hit = level.ph.raycast(eye, d.normalize(), len, true);
      return !hit || hit.dist > len - 0.6;
    };
    for (const s of level.scannables) {
      if (s.pos.distanceTo(player.pos) > 9.5 && s.id !== 'asterion') continue;
      if (!visible(s.pos)) continue;
      const found = s.clue ? save.clues.includes(s.clue) : false;
      hud.scanLabel(s.label, s.pos, found);
      if (s.clue) clue(s.clue);
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
$('#btn-end-continue').onclick = () => { closeAllPanels(); state = 'play'; };
$('#pausebtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); pause(); });

// carnet
$$('#notebook .tab').forEach((t) => (t.onclick = () => renderNotebook(t.dataset.tab as string)));
function renderNotebook(tab: string) {
  $$('#notebook .tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
  const body = $('#nb-body');
  body.innerHTML = '';
  const total = Object.keys(LOGS).length + Object.keys(HOLOS).length;
  $('#nb-progress').textContent = `Découverte : ${Math.round(((save.logs.length + save.holos.length) / total) * 100)} %`;
  if (tab === 'logs' || tab === 'holos') {
    const all = tab === 'logs' ? Object.values(LOGS) : Object.values(HOLOS);
    for (const e of all) {
      const found = (tab === 'logs' ? save.logs : save.holos).includes(e.id);
      const d = document.createElement('div'); d.className = 'entry' + (found ? '' : ' locked');
      if (!found) { d.innerHTML = `<b>???</b><small>Non découvert</small>`; body.appendChild(d); continue; }
      const who = 'crew' in e ? CREW[e.crew].name : e.lines.map((l) => CREW[l.crew].name.split(' ')[0]).filter((v, i, a) => a.indexOf(v) === i).join(' & ');
      const text = 'crew' in e ? e.lines.join(' ') : e.lines.map((l) => `<em>${CREW[l.crew].name.split(' ')[0]} :</em> ${l.text}`).join('<br>');
      d.innerHTML = `<b>${e.title}</b><small>${who} · ${e.place} · ${e.day}</small><p>${text}</p>`;
      if (tab === 'logs') {
        const b = document.createElement('button'); b.className = 'f small'; b.textContent = '▶ Réécouter';
        b.onclick = () => { closeAllPanels(); state = 'play'; playLog(e.id); };
        d.appendChild(b);
      }
      body.appendChild(d);
    }
  } else if (tab === 'clues') {
    for (const c of Object.values(CLUES)) {
      const found = save.clues.includes(c.id);
      const d = document.createElement('div'); d.className = 'entry' + (found ? '' : ' locked');
      d.innerHTML = found ? `<b>${c.title}</b><p>${c.text}</p>` : `<b>???</b><small>Utilise le scanner (${hud.icon('scan')}) pour révéler les indices.</small>`;
      body.appendChild(d);
    }
  } else if (tab === 'map') {
    const cv = document.createElement('canvas'); cv.width = 900; cv.height = 900; cv.className = 'map';
    body.appendChild(cv);
    drawMap(cv);
  } else if (tab === 'crew') {
    for (const c of Object.values(CREW)) {
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
  const minX = -8, maxX = 22, minZ = -60, maxZ = 12;
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
    g.fillStyle = '#bfe9ff'; g.font = '600 22px "Barlow Condensed", sans-serif'; g.textAlign = 'center';
    g.fillText(ROOMS[sp.id].toUpperCase(), X((sp.x0 + sp.x1) / 2), Z((sp.z0 + sp.z1) / 2));
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
  toggle('#o-bloom', 'bloom', (v) => (post.bloom.blendMode.opacity.value = v ? 1 : 0));
  toggle('#o-vol', 'volumetric', () => {}, true);
  toggle('#o-fps', 'fps', (v) => ($('#fps').hidden = !v));
  toggle('#o-invert', 'invertY', (v) => (input.invertY = v));
  toggle('#o-voices', 'voices', () => {});
  const sh = $<HTMLSelectElement>('#o-shadows'); sh.value = opts.shadows;
  sh.onchange = () => { opts.shadows = sh.value as 'low' | 'high'; saveOptions(opts); const s = player.headlamp.shadow; s.mapSize.setScalar(opts.shadows === 'low' ? 512 : q.id === 'equilibre' ? 1024 : 2048); s.map?.dispose(); s.map = null as unknown as THREE.WebGLRenderTarget; };
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
  level.current = 'F';
  $('#hud').classList.remove('show'); $('#touch').classList.remove('show');
  $('#btn-continue').hidden = !loadSave();
  $('#title').classList.add('show');
  openPanel('#title-menu');
}

function restoreFromSave() {
  Object.assign(api.flags, save.flags);
  player.hasJetpack = !!save.flags.jetpack;
  if (save.flags.doorA) { level.doors.dA.target = 0.42; level.doors.dA.open = 0.42; }
  if (save.flags.power) applyPower(false);
  endShown = save.cp === 'F';
  objective = (save.objective as ObjectiveKey) ?? 'wake';
  hud.setObjective(OBJECTIVES[objective]);
}

async function startGame(fresh: boolean) {
  audio.unlock();
  if (fresh) { clearSave(); location.hash = 'new'; location.reload(); return; }
  closeAllPanels();
  $('#title').classList.remove('show');
  restoreFromSave();
  respawn();
  audio.startAmbience('station');
  audio.setPowered(!!save.flags.power);
  $('#hud').classList.add('show'); $('#touch').classList.add('show');
  refreshHints();
  if (save.cp === 'A' && !save.flags.doorA) await intro();
  state = 'play';
}

async function intro() {
  state = 'intro';
  player.controllable = false;
  const boot = $('#boot');
  boot.classList.add('show');
  const lines = ['R-12 · UNITÉ DE MAINTENANCE', 'SÉQUENCE DE RÉACTIVATION…', 'ÉNERGIE INTERNE ············ 63 %', 'SERVO GENOU GAUCHE ········· USURE', 'LIAISON STATION ············ AUCUNE RÉPONSE', 'ÉQUIPAGE DÉTECTÉ ··········· 0', 'ORDRE ACTIF : PRENDRE SOIN DE LA STATION'];
  const box = $('#boot .lines'); box.innerHTML = '';
  audio.beep('boot');
  for (const l of lines) {
    const d = document.createElement('div'); d.textContent = l; box.appendChild(d);
    audio.ui('move');
    await new Promise((r) => setTimeout(r, l.includes('ORDRE') ? 1400 : 650));
  }
  boot.classList.add('fade');
  await new Promise((r) => setTimeout(r, 1400));
  boot.classList.remove('show', 'fade');
  player.controllable = true;
  setObjective('wake');
  hud.toast('Commandes', input.device === 'touch' ? 'Joystick à gauche pour bouger · glisse à droite pour regarder' : input.device === 'gamepad' ? 'Stick gauche : bouger · stick droit : caméra' : 'ZQSD / WASD : bouger · souris : caméra (clic pour capturer)');
  audio.beep('question', player.pos);
}

// ---------- boucle ----------
let envTarget = 0.06;
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

  if (state === 'title') {
    titleT += dt;
    // caméra qui dérive lentement dans la baie d'observation, face à la planète
    const a = titleT * 0.05;
    camera.position.set(12.3 + Math.sin(a) * 2.2, 5.0 + Math.sin(a * 0.7) * 0.3, -49.5 + Math.cos(a * 0.6) * 0.6);
    camera.lookAt(12.3 + Math.sin(a * 0.8) * 1.5, 5.6, -60);
    level.update(dt, t, camera.position, () => false, false);
  } else {
    if (state === 'play') {
      if (input.wasPressed('pause')) pause();
      else if (input.wasPressed('map')) { renderNotebook('map'); state = 'pause'; openPanel('#notebook'); }
      else {
        if (input.wasPressed('interact') && nearest) { nearest.act(); audio.servo(player.pos); }
        if (input.wasPressed('scan')) doScan();
      }
    }
    const playing = state === 'play' || state === 'intro';
    if (playing || state === 'reboot') {
      if (state !== 'reboot') tp.update(dt, input.look, player.pos, player.body.vel, level.ph, t);
      player.update(dt, t, input, tp.yaw, level.ph, audio);
      if (player.pos.y < -8) kill('Chute');
      level.update(dt, t, player.pos, (box) => {
        const b = new THREE.Box3(player.pos.clone().add(new THREE.Vector3(-0.25, 0, -0.25)), player.pos.clone().add(new THREE.Vector3(0.25, 1, 0.25)));
        return b.intersectsBox(box);
      });
      if (state === 'play') updateInteract(); else hud.setPrompt(null);
    }
    if (state === 'reboot') {
      rebootT -= dt;
      if (rebootT < 1.1 && rebootT + dt >= 1.1) respawn();
      if (rebootT <= 0) { $('#reboot').classList.remove('show'); state = 'play'; }
    }
    if (state === 'play' || state === 'pause' || state === 'puzzle') save.playTime += state === 'play' ? dt : 0;
    const head = player.robot.j.head.getWorldPosition(new THREE.Vector3());
    hud.update(dt, camera, state === 'play' ? level.objectivePos[objective] ?? null : null, player.pos, { has: player.hasJetpack, energy: player.energy, active: player.jetting }, head);
  }
  scene.environmentIntensity += (envTarget - scene.environmentIntensity) * Math.min(1, dt);
  hemi.intensity = 0.1 + scene.environmentIntensity * 0.3;
  sky.position.copy(camera.position);
  sky.update(t);
  audio.updateListener(camera);
}

// ---------- démarrage ----------
async function boot() {
  onResize();
  await texturesReady();
  // compilation des shaders avant d'afficher (évite les saccades)
  level.current = 'F';
  for (const r of Object.values(level.rooms)) r.group.visible = true;
  renderer.compile(scene, camera);
  $('#loader').classList.add('done');
  frame();
  const first = () => { audio.unlock(); audio.startAmbience('menu'); removeEventListener('pointerdown', first); removeEventListener('keydown', first); };
  addEventListener('pointerdown', first); addEventListener('keydown', first);
  if (location.hash === '#new') { history.replaceState(null, '', location.pathname); save = newSave(); api.flags = save.flags; writeSave(save); toTitleThen(true); }
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
(window as unknown as { __game: unknown }).__game = { level, player, save: () => save, state: () => state, tp, kill, startGame, simulate, press, input, puzzle, renderer };
boot().catch((e) => { $('#loader').textContent = 'Erreur : ' + e; console.error(e); });
