import * as THREE from 'three';
import '../ui/base.css';
import '../atelier/atelier.css';
import './species.css';
import { loadQuality, saveQuality, PRESETS, bootSucceeded, type PresetId } from '../core/quality';
import { createRenderer, Post, FpsMeter } from '../core/post';
import { texturesReady, setMaxAnisotropy } from '../core/textures';
import { setMaterialRes } from '../robots/materials';
import { createFloor } from '../fx/floor';
import { LightCone, Dust } from '../fx/volumetric';
import { Pedestal, createBackdrop } from '../atelier/studio';
import { PadNav, PadReader, hidePadFocusOnPointer } from '../ui/padnav';
import { DESIGNS, type Creature } from './designs';
import type { Action, Emotion } from './rig';
import { buildPerson, KIND_PROPS, type Person } from '../people/cast';
import { FACES, type Face } from '../people/asset';
import { Lighting, LIGHTS, type LightId } from '../people/lights';

// Atelier des personnages : humains en acier, Vaëls en cuivre, souvenirs en or (et les meutes).

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
const q = loadQuality();
setMaterialRes(q.textureRes);
const canvas = $<HTMLCanvasElement>('#c');
const renderer = createRenderer(canvas, q);
setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030405);
scene.fog = new THREE.FogExp2(0x05070a, 0.035);
const camera = new THREE.PerspectiveCamera(34, 1, 0.03, 80);
const post = new Post(renderer, scene, camera, q);

// ---------- éclairage ----------
const key = new THREE.DirectionalLight(0xfff0e0, 2.2);
key.position.set(-5, 8, 7); key.castShadow = true;
key.shadow.mapSize.setScalar(Math.min(q.shadowMap, 2048));
Object.assign(key.shadow.camera, { left: -7, right: 7, top: 4, bottom: -1, near: 2, far: 24 });
key.shadow.bias = -0.0002; key.shadow.normalBias = 0.02;
scene.add(key);
const rim = new THREE.SpotLight(0x5fd8ff, 140, 30, 0.5, 0.8, 1.2);
rim.position.set(0.5, 4, -9); rim.target.position.set(0, 1.2, 0);
scene.add(rim, rim.target);
const rim2 = new THREE.SpotLight(0xffa070, 60, 30, 0.5, 0.8, 1.2);
rim2.position.set(-6, 3, -6); rim2.target.position.set(0, 1, 0);
scene.add(rim2, rim2.target);
const hemi = new THREE.HemisphereLight(0x9fb4d8, 0x1a1410, 0.35);
scene.add(hemi);
const backdrop = createBackdrop();
scene.add(backdrop);
const floor = createFloor(34, q.textureRes, { enabled: q.reflections !== 'off', width: 512, height: 512 });
scene.add(floor.group);
const dust = new Dust(Math.round(800 * q.particles), new THREE.Box3(new THREE.Vector3(-6, 0.1, -2), new THREE.Vector3(6, 4.5, 2.5)));
scene.add(dust);

// ---------- présentoirs ----------
type Kind = 'humain' | 'vael' | 'souvenir' | 'meute';
type Shown = Person | Creature;
interface Slot { c: Shown | null; ped: Pedestal; spin: { a: number; v: number; auto: number }; x: number; z: number; spot: THREE.SpotLight; cone?: LightCone }
const KINDS: Kind[] = ['humain', 'vael', 'souvenir', 'meute'];
const MEUTES = DESIGNS.filter((d) => d.kind === 'meute');
const LETTERS: Record<Kind, string[]> = { humain: ['H', 'F', 'E', 'A'], vael: ['R', 'H', 'E', 'N'], souvenir: ['I', 'T', 'N', 'K'], meute: MEUTES.map((d) => d.letter) };
const PED_NAMES: Record<string, string[]> = { humain: ['HOMME', 'FEMME', 'ENFANT', 'ANCIEN'], vael: ['RACINES', 'HAUTEURS', 'EAUX', 'NOMADES'], souvenir: ['ILSE', 'TOMÁS', 'NAOMI', 'KENJI'] };
let tab: Kind = 'humain';
const prop: Record<Kind, number> = { humain: 0, vael: 0, souvenir: 0, meute: 0 };
const built: Record<Kind, number> = { humain: -1, vael: -1, souvenir: -1, meute: -1 };
const slots = {} as Record<Kind, Slot[]>;
for (const kind of KINDS) {
  const n = kind === 'meute' ? MEUTES.length : 4;
  const xs = n === 4 ? [-3.9, -1.3, 1.3, 3.9] : [-2.3, 0, 2.3];
  slots[kind] = [];
  for (let i = 0; i < n; i++) {
    const ped = new Pedestal(LETTERS[kind][i], kind === 'meute' ? undefined : PED_NAMES[kind][i]); ped.scale.setScalar(kind === 'meute' ? 1.45 : 1.35);
    const x = xs[i], z = Math.abs(x) > 3 ? -0.5 : 0.1;
    ped.position.set(x, 0, z); ped.rotation.y = -x * 0.05; ped.visible = false;
    scene.add(ped);
    const spot = new THREE.SpotLight(0xe8f2ff, 40, 10, 0.32, 0.7, 2);
    spot.position.set(x, 5.2, z + 1.2); spot.target.position.set(x, 0.8, z); spot.visible = false;
    scene.add(spot, spot.target);
    let cone: LightCone | undefined;
    if (q.volumetric) { cone = new LightCone(new THREE.Vector3(0, 5.2, 1.2), new THREE.Vector3(0, 0, 0), 2, 0x9cc8ff, 0.04); cone.position.set(x, 5.2, z + 1.2); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, -5.2, -1.2).normalize()); cone.visible = false; scene.add(cone); }
    slots[kind].push({ c: null, ped, spin: { a: -x * 0.08, v: 0, auto: 0.12 }, x, z, spot, cone });
  }
}
const cur = () => slots[tab];
const isPerson = (c: Shown | null): c is Person => !!c && 'fig' in c;

const lighting = new Lighting(renderer, scene, { key, rim, rim2, hemi, backdrop, spots: () => cur().map((s) => s.spot) }, q.particles);

let action: Action = 'repos';
let emotion: Emotion = 'calme';
let focused = -1;
let faceMode = false;
let expr: Face | null = null;
let talking = false;

function disposeShown(c: Shown) {
  c.group.removeFromParent();
  c.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
  });
}

const look = () => (faceMode ? camera.position : undefined);
async function buildTab(kind: Kind) {
  const list = slots[kind];
  if (built[kind] === prop[kind]) return;
  for (const s of list) if (s.c) { disposeShown(s.c); s.c = null; }
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    $('#loader .msg').textContent = 'Façonnage…';
    await new Promise((r) => setTimeout(r, 20));
    const t0 = performance.now();
    s.c = kind === 'meute' ? await MEUTES[i].build() : await buildPerson(kind, prop[kind], i, look);
    console.info(kind, i, Math.round(performance.now() - t0) + ' ms');
    s.ped.turntable.add(s.c.group);
    s.c.group.scale.setScalar(1 / s.ped.scale.x);
    s.c.group.position.y = 0.012;
  }
  built[kind] = prop[kind];
}
function applyWet() {
  for (const s of cur()) if (isPerson(s.c)) for (const m of s.c.mats) { const u = m.userData.metal; if (u) u.uWet.value = lighting.wetness; }
}

function showTab(kind: Kind) {
  tab = kind; focused = -1; faceMode = false; expr = null;
  for (const k of KINDS) for (const s of slots[k]) { const v = k === kind; s.ped.visible = v; s.spot.visible = v; if (s.cone) s.cone.visible = v; }
  if (kind === 'meute' && emotion !== 'calme' && emotion !== 'menace') emotion = 'calme';
  if (kind !== 'meute' && emotion === 'menace') emotion = 'calme';
  lighting.set(lighting.id).then(applyWet);
  renderUI(); layoutCamera();
}

async function switchTo(kind: Kind, p?: number) {
  if (p !== undefined) prop[kind] = p;
  $('#loader').classList.remove('done');
  try { await buildTab(kind); } finally { $('#loader').classList.add('done'); }
  showTab(kind);
  if (kind === 'souvenir') replayAll();
}
function replayAll() { for (const s of cur()) if (isPerson(s.c)) s.c.replay?.(); }

// ---------- interface ----------
const LABEL_A: Record<Action, string> = { repos: 'Repos', marche: 'Marche', course: 'Course' };
const LABEL_E: Record<Emotion, string> = { calme: 'Calme', colere: 'Colère', joie: 'Joie', tristesse: 'Tristesse', respect: 'Respect', menace: 'Menace' };
const LABEL_EV: Record<Emotion, string> = { calme: 'Calme · bleu', colere: 'Colère · rouge', joie: 'Joie · or', tristesse: 'Tristesse · violet', respect: 'Respect · blanc', menace: 'Menace · rouge' };
const LABEL_F: Record<Face, string> = { neutre: 'Neutre', sourire: 'Sourire', colere: 'Colère', tristesse: 'Tristesse', peur: 'Peur', surprise: 'Surprise', degout: 'Dégoût', reflexion: 'Réflexion' };
const TAB_LABEL: Record<Kind, string> = { humain: 'Humains', vael: 'Vaëls', souvenir: 'Souvenirs', meute: 'Meutes' };
function chips(el: HTMLElement, items: [string, string][], on: string, pick: (v: string) => void) {
  el.innerHTML = '';
  for (const [v, l] of items) {
    const b = document.createElement('button'); b.className = 'chip' + (v === on ? ' on' : ''); b.textContent = l;
    b.onclick = () => { pick(v); renderUI(); };
    el.appendChild(b);
  }
}
function renderUI() {
  chips($('#tabs'), KINDS.map((k) => [k, TAB_LABEL[k]]), tab, (v) => { if (v !== tab) switchTo(v as Kind); });
  const props = tab === 'meute' ? [] : KIND_PROPS[tab];
  chips($('#props'), props.map((p, i) => [String(i), `${i + 1} · ${p.name}`]), String(prop[tab]), (v) => { if (+v !== prop[tab]) switchTo(tab, +v); });
  chips($('#lights'), LIGHTS.map((l) => [l.id, l.label]), lighting.id, (v) => { lighting.set(v as LightId).then(() => { applyWet(); renderUI(); }); });
  const cards = $('#cards'); cards.innerHTML = '';
  cur().forEach((s, i) => {
    const b = document.createElement('button'); b.className = 'card' + (i === focused ? ' on' : '');
    const c = s.c;
    const name = tab === 'meute' ? MEUTES[i].name : isPerson(c) ? c.name : '…';
    const sub = tab === 'meute' ? MEUTES[i].people.split(' · ')[0] : isPerson(c) ? c.sub : '';
    b.innerHTML = `<span class="letter">${LETTERS[tab][i]}</span><span class="name">${name}<small>${sub}</small></span>`;
    b.onclick = () => focus(focused === i ? -1 : i);
    cards.appendChild(b);
  });
  chips($('#act'), (['repos', 'marche', 'course'] as Action[]).map((a) => [a, LABEL_A[a]]), action, (v) => (action = v as Action));
  const emos: Emotion[] = tab === 'meute' ? ['calme', 'menace'] : ['calme', 'colere', 'joie', 'tristesse', 'respect'];
  chips($('#emo'), emos.map((e) => [e, tab === 'vael' ? LABEL_EV[e] : LABEL_E[e]]), emotion, (v) => { emotion = v as Emotion; expr = null; });
  $('#actionsWrap').style.display = faceMode ? 'none' : '';
  // panneau de la proposition choisie
  const p = $('#panel');
  const s = focused >= 0 ? cur()[focused] : null;
  if (s) {
    if (tab === 'meute') {
      const d = MEUTES[focused];
      $('#p-title').textContent = d.name; $('#p-people').textContent = d.people; $('#p-text').textContent = d.text;
      const img = $<HTMLImageElement>('#p-img'); img.src = import.meta.env.BASE_URL + 'assets/species/concepts/' + d.concept; img.hidden = false;
    } else if (isPerson(s.c)) {
      $('#p-title').textContent = s.c.name;
      $('#p-people').textContent = `${TAB_LABEL[tab]} · proposition ${prop[tab] + 1} : ${KIND_PROPS[tab][prop[tab]].name}`;
      $('#p-text').textContent = s.c.text;
      $<HTMLImageElement>('#p-img').hidden = true;
    }
  }
  const person = s && isPerson(s.c) ? s.c : null;
  $('#faceBtn').hidden = !person; $('#faceBtn').textContent = faceMode ? '← Corps entier' : 'Gros plan du visage';
  $('#ageRow').hidden = !(person && person.setAge);
  if (person?.age !== undefined) $<HTMLInputElement>('#age').value = String(Math.round(person.age * 100));
  $('#replayBtn').hidden = !(person && person.replay);
  $('#faceRow').hidden = !(person && faceMode);
  if (person && faceMode) {
    chips($('#faces'), (['neutre', ...FACES] as Face[]).map((f) => [f, LABEL_F[f]]), expr ?? '', (v) => { expr = v as Face; });
    const tb = document.createElement('button'); tb.className = 'chip' + (talking ? ' on' : ''); tb.textContent = talking ? 'Parle…' : 'Parler';
    tb.onclick = () => { talking = !talking; renderUI(); };
    $('#faces').appendChild(tb);
  }
  p.classList.toggle('show', focused >= 0);
  p.classList.toggle('face', faceMode);
}
function focus(i: number) { focused = i; faceMode = false; expr = null; talking = false; renderUI(); layoutCamera(); }
$('#back').onclick = () => focus(-1);
$('#faceBtn').onclick = () => { faceMode = !faceMode; if (!faceMode) { expr = null; talking = false; } renderUI(); layoutCamera(); };
$('#replayBtn').onclick = () => { const c = cur()[focused]?.c; if (isPerson(c)) c.replay?.(); };
$<HTMLInputElement>('#age').oninput = (e) => { const c = cur()[focused]?.c; if (isPerson(c) && c.setAge) c.setAge(+(e.target as HTMLInputElement).value / 100); };
const qsel = $<HTMLSelectElement>('#quality');
for (const p of Object.values(PRESETS)) { const o = document.createElement('option'); o.value = p.id; o.textContent = p.label; qsel.appendChild(o); }
qsel.value = q.id;
qsel.onchange = () => { saveQuality(qsel.value as PresetId); bootSucceeded(); location.reload(); };
const fps = new FpsMeter($('#fps'));

// ---------- caméra ----------
const camPos = new THREE.Vector3(0, 2, 11), camLook = new THREE.Vector3(0, 1, 0);
const wantPos = camPos.clone(), wantLook = camLook.clone();
let yaw = 0;
const tmpV = new THREE.Vector3();
function tall() { return tab === 'vael' ? 2.2 : tab === 'meute' ? 0.9 : 1.8; }
function layoutCamera() {
  const a = camera.aspect, h = tall();
  if (focused < 0) {
    const halfW = cur().length === 4 ? 5.2 : 3.4;
    const hfovTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * a;
    const dist = Math.max(tab === 'meute' ? 5.5 : 8 * h / 2, halfW / hfovTan);
    wantPos.set(Math.sin(yaw) * dist, h * 0.95 + dist * 0.05, Math.cos(yaw) * dist);
    wantLook.set(0, tab === 'meute' ? 0.45 : h * 0.55, 0);
  } else if (!faceMode) {
    const s = cur()[focused];
    const dist = (a < 1 ? 6.2 : 4.9) * (h / 2.1);
    const side = a > 1.2 ? h * 0.42 : 0;
    wantPos.set(s.x + side + Math.sin(yaw) * dist * 0.3, h * 0.72, s.z + dist);
    wantLook.set(s.x + side, a < 1 ? h * 0.38 : h * 0.5, s.z);
  }
}
function faceCamera(dt: number) {
  const s = cur()[focused], c = s?.c;
  if (!isPerson(c)) return;
  s.spin.auto = 0;
  s.spin.a += (s.x * 0.05 + yaw * 1.5 - s.spin.a) * (1 - Math.exp(-dt * 4));
  c.eyeWorld(tmpV);
  const a = camera.aspect;
  const d = a < 1 ? 0.95 : 0.62;
  wantLook.copy(tmpV).add(new THREE.Vector3(a > 1.2 ? 0.09 : 0, a < 1 ? -0.07 : -0.02, 0));
  wantPos.set(wantLook.x, tmpV.y + 0.02, tmpV.z + d);
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w / h < 1 ? 42 : 34; camera.updateProjectionMatrix();
  post.setSize(w, h); layoutCamera();
}
addEventListener('resize', resize);

// ---------- gestes ----------
let drag: { x: number; id: number; moved: number } | null = null;
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, id: e.pointerId, moved: 0 }; });
canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x; drag.x = e.clientX; drag.moved += Math.abs(dx);
  if (faceMode) { yaw = THREE.MathUtils.clamp(yaw + dx * 0.004, -0.9, 0.9); }
  else if (focused >= 0) { const s = cur()[focused].spin; s.a += dx * 0.01; s.auto = 0; }
  else { yaw = THREE.MathUtils.clamp(yaw - dx * 0.002, -0.35, 0.35); layoutCamera(); }
});
canvas.addEventListener('pointerup', () => { drag = null; });

// ---------- manette ----------
const pad = new PadReader();
hidePadFocusOnPointer();
const nav = new PadNav({ root: () => document.body, back: () => { if (faceMode) { faceMode = false; renderUI(); layoutCamera(); } else if (focused >= 0) focus(-1); } });
function pollPad(dt: number) {
  const { ax } = pad.read(dt, (e) => {
    if (e === 'prev' || e === 'next') { const n = cur().length; focus(((focused < 0 ? (e === 'next' ? -1 : 0) : focused) + (e === 'next' ? 1 : -1) + n) % n); return; }
    nav.handle(e);
  });
  if (!pad.gp) return;
  nav.refresh();
  if (ax[2]) {
    if (faceMode) yaw = THREE.MathUtils.clamp(yaw + ax[2] * 1.2 * dt, -0.9, 0.9);
    else if (focused >= 0) { const s = cur()[focused].spin; s.a += ax[2] * 2.4 * dt; s.auto = 0; }
    else { yaw = THREE.MathUtils.clamp(yaw - ax[2] * 0.6 * dt, -0.35, 0.35); layoutCamera(); }
  }
}

// ---------- boucle ----------
const timer = new THREE.Timer();
let t = 0;
function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 1 / 20);
  t += dt;
  fps.tick(dt);
  pollPad(dt);
  if (faceMode) faceCamera(dt);
  cur().forEach((s, i) => {
    const c = s.c;
    if (!c) return;
    if (!(faceMode && focused === i) && (!drag || focused !== i)) { s.spin.auto = Math.min(0.12, s.spin.auto + dt * 0.03); s.spin.a += s.spin.auto * dt * (focused === i ? 1 : 0.6); }
    s.ped.turntable.rotation.y = s.spin.a;
    if (isPerson(c)) {
      const me = focused === i;
      c.expr = me ? expr : null;
      c.setTalk(me && talking);
      c.update(dt, t + i * 3.7, faceMode && me ? 'repos' : action, emotion);
    } else c.update(dt, t + i * 3.7, action, emotion);
    s.ped.setFocus(focused === i ? 1 : 0, t);
  });
  lighting.update(t);
  dust.update(t);
  const k = 1 - Math.pow(faceMode ? 0.02 : 0.003, dt);
  camPos.lerp(wantPos, k); camLook.lerp(wantLook, k);
  camera.position.copy(camPos); camera.lookAt(camLook);
  post.render(dt);
  requestAnimationFrame(frame);
}

async function start() {
  resize();
  await lighting.set('studio');
  await texturesReady();
  await buildTab('humain');
  showTab('humain');
  renderer.compile(scene, camera);
  $('#loader').classList.add('done');
  frame();
  setTimeout(bootSucceeded, 4000);
  setTimeout(() => lighting.preload(), 3000);
}
(window as unknown as { __species: unknown }).__species = {
  slots, focus, switchTo, camera, lighting, render: () => post.render(1 / 60),
  set: (a: Action, e: Emotion) => { action = a; emotion = e; renderUI(); },
  face: (on: boolean, f?: Face, talk?: boolean) => { faceMode = on; expr = f ?? null; talking = !!talk; renderUI(); layoutCamera(); },
  appear: (v: number) => { for (const s of cur()) if (isPerson(s.c)) s.c.replay?.(v); },
  light: (id: LightId) => lighting.set(id).then(applyWet),
};
start().catch((e) => { $('#loader .msg').textContent = 'Erreur : ' + e; console.error(e); });
