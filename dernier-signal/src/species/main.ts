import * as THREE from 'three';
import '../ui/base.css';
import '../atelier/atelier.css';
import './species.css';
import { loadQuality, saveQuality, PRESETS, bootSucceeded, type PresetId } from '../core/quality';
import { createRenderer, Post, FpsMeter } from '../core/post';
import { loadHDRI, texturesReady, setMaxAnisotropy } from '../core/textures';
import { setMaterialRes } from '../robots/materials';
import { createFloor } from '../fx/floor';
import { LightCone, Dust } from '../fx/volumetric';
import { Pedestal, createBackdrop } from '../atelier/studio';
import { PadNav, PadReader, hidePadFocusOnPointer } from '../ui/padnav';
import { DESIGNS, type Creature, type Design } from './designs';
import type { Action, Emotion } from './rig';

// Atelier des espèces : propositions de Vaëls et de meutes, à choisir comme le robot.

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
const q = loadQuality();
setMaterialRes(q.textureRes);
const canvas = $<HTMLCanvasElement>('#c');
const renderer = createRenderer(canvas, q);
setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030405);
scene.fog = new THREE.FogExp2(0x05070a, 0.035);
const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 80);
const post = new Post(renderer, scene, camera, q);

// éclairage de studio
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
scene.add(new THREE.HemisphereLight(0x9fb4d8, 0x1a1410, 0.35));
scene.add(createBackdrop());
const floor = createFloor(34, q.textureRes, { enabled: q.reflections !== 'off', width: 512, height: 512 });
scene.add(floor.group);
const dust = new Dust(Math.round(800 * q.particles), new THREE.Box3(new THREE.Vector3(-6, 0.1, -2), new THREE.Vector3(6, 4.5, 2.5)));
scene.add(dust);

// ---------- présentoirs ----------
interface Slot { d: Design; c: Creature | null; ped: Pedestal; spin: { a: number; v: number; auto: number }; x: number; z: number; spot: THREE.SpotLight; cone?: LightCone }
let tab: 'vael' | 'meute' = 'vael';
const slots: Record<'vael' | 'meute', Slot[]> = { vael: [], meute: [] };
for (const kind of ['vael', 'meute'] as const) {
  const list = DESIGNS.filter((d) => d.kind === kind);
  const xs = list.length === 4 ? [-3.9, -1.3, 1.3, 3.9] : [-2.3, 0, 2.3];
  list.forEach((d, i) => {
    const ped = new Pedestal(d.letter); ped.scale.setScalar(kind === 'vael' ? 1.35 : 1.45);
    const x = xs[i], z = Math.abs(x) > 3 ? -0.5 : 0.1;
    ped.position.set(x, 0, z); ped.rotation.y = -x * 0.05; ped.visible = false;
    scene.add(ped);
    const spot = new THREE.SpotLight(0xe8f2ff, 40, 10, 0.32, 0.7, 2);
    spot.position.set(x, 5.2, z + 1.2); spot.target.position.set(x, 0.8, z); spot.visible = false;
    scene.add(spot, spot.target);
    let cone: LightCone | undefined;
    if (q.volumetric) { cone = new LightCone(new THREE.Vector3(0, 5.2, 1.2), new THREE.Vector3(0, 0, 0), 2, 0x9cc8ff, 0.04); cone.position.set(x, 5.2, z + 1.2); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, -5.2, -1.2).normalize()); cone.visible = false; scene.add(cone); }
    slots[kind].push({ d, c: null, ped, spin: { a: -x * 0.08, v: 0, auto: 0.12 }, x, z, spot, cone });
  });
}
const cur = () => slots[tab];

let action: Action = 'repos';
let emotion: Emotion = 'calme';
let focused = -1;

async function buildTab(kind: 'vael' | 'meute') {
  const list = slots[kind];
  for (const s of list) {
    if (s.c) continue;
    $('#loader .msg').textContent = `Façonnage : ${s.d.name}…`;
    await new Promise((r) => setTimeout(r, 30));
    const t0 = performance.now();
    s.c = await s.d.build();
    console.info(s.d.id, Math.round(performance.now() - t0) + ' ms', s.c.body.mesh.geometry.attributes.position.count + ' sommets');
    s.c.group.position.y = s.ped.topY * s.ped.scale.y - 0.01;
    s.ped.turntable.add(s.c.group);
    s.c.group.scale.setScalar(1 / s.ped.scale.x);
    s.c.group.position.y = 0.012;
  }
}

function showTab(kind: 'vael' | 'meute') {
  tab = kind; focused = -1;
  for (const k of ['vael', 'meute'] as const) for (const s of slots[k]) { const v = k === kind; s.ped.visible = v; s.spot.visible = v; if (s.cone) s.cone.visible = v; }
  if (kind === 'meute' && emotion !== 'calme' && emotion !== 'menace') emotion = 'calme';
  if (kind === 'vael' && emotion === 'menace') emotion = 'calme';
  renderUI(); layoutCamera();
}

// ---------- interface ----------
const LABEL_A: Record<Action, string> = { repos: 'Repos', marche: 'Marche', course: 'Course' };
const LABEL_E: Record<Emotion, string> = { calme: 'Calme · bleu', colere: 'Colère · rouge', joie: 'Joie · or', tristesse: 'Tristesse · violet', respect: 'Respect · blanc', menace: 'Menace · rouge' };
function chips(el: HTMLElement, items: [string, string][], on: string, pick: (v: string) => void) {
  el.innerHTML = '';
  for (const [v, l] of items) {
    const b = document.createElement('button'); b.className = 'chip' + (v === on ? ' on' : ''); b.textContent = l;
    b.onclick = () => { pick(v); renderUI(); };
    el.appendChild(b);
  }
}
function renderUI() {
  $$('#tabs .chip').forEach((b) => b.classList.toggle('on', b.dataset.k === tab));
  const cards = $('#cards'); cards.innerHTML = '';
  cur().forEach((s, i) => {
    const b = document.createElement('button'); b.className = 'card' + (i === focused ? ' on' : '');
    b.innerHTML = `<span class="letter">${s.d.letter}</span><span class="name">${s.d.name}<small>${s.d.people.split(' · ')[0]}</small></span>`;
    b.onclick = () => focus(focused === i ? -1 : i);
    cards.appendChild(b);
  });
  chips($('#act'), (['repos', 'marche', 'course'] as Action[]).map((a) => [a, LABEL_A[a]]), action, (v) => (action = v as Action));
  const emos: Emotion[] = tab === 'vael' ? ['calme', 'colere', 'joie', 'tristesse', 'respect'] : ['calme', 'menace'];
  chips($('#emo'), emos.map((e) => [e, LABEL_E[e]]), emotion, (v) => (emotion = v as Emotion));
  const p = $('#panel');
  if (focused >= 0) {
    const d = cur()[focused].d;
    $('#p-title').textContent = d.name;
    $('#p-people').textContent = d.people;
    $('#p-text').textContent = d.text;
    $<HTMLImageElement>('#p-img').src = import.meta.env.BASE_URL + 'assets/species/concepts/' + d.concept;
  }
  p.classList.toggle('show', focused >= 0);
}
const $$ = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];
function focus(i: number) { focused = i; renderUI(); layoutCamera(); }
$('#back').onclick = () => focus(-1);
$$('#tabs .chip').forEach((b) => (b.onclick = async () => { const k = b.dataset.k as 'vael' | 'meute'; if (k === tab) return; $('#loader').classList.remove('done'); await buildTab(k); $('#loader').classList.add('done'); showTab(k); }));
const qsel = $<HTMLSelectElement>('#quality');
for (const p of Object.values(PRESETS)) { const o = document.createElement('option'); o.value = p.id; o.textContent = p.label; qsel.appendChild(o); }
qsel.value = q.id;
qsel.onchange = () => { saveQuality(qsel.value as PresetId); bootSucceeded(); location.reload(); };
const fps = new FpsMeter($('#fps'));

// ---------- caméra ----------
const camPos = new THREE.Vector3(0, 2, 11), camLook = new THREE.Vector3(0, 1, 0);
const wantPos = camPos.clone(), wantLook = camLook.clone();
let yaw = 0;
function layoutCamera() {
  const a = camera.aspect;
  if (focused < 0) {
    const halfW = tab === 'vael' ? 5.2 : 3.4;
    const hfovTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * a;
    const dist = Math.max(tab === 'vael' ? 8 : 5.5, halfW / hfovTan);
    wantPos.set(Math.sin(yaw) * dist, (tab === 'vael' ? 1.9 : 1.5) + dist * 0.05, Math.cos(yaw) * dist);
    wantLook.set(0, tab === 'vael' ? 1.05 : 0.45, 0);
  } else {
    const s = cur()[focused];
    const tall = tab === 'vael';
    const dist = (a < 1 ? 6.2 : 4.9) * (tall ? 1 : 0.62);
    const side = a > 1.2 ? (tall ? 0.95 : 0.6) : 0;
    wantPos.set(s.x + side + Math.sin(yaw) * dist * 0.3, tall ? 1.45 : 0.95, s.z + dist);
    wantLook.set(s.x + side, tall ? (a < 1 ? 0.75 : 1.05) : 0.42, s.z);
  }
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
  if (focused >= 0) { const s = cur()[focused].spin; s.a += dx * 0.01; s.auto = 0; }
  else { yaw = THREE.MathUtils.clamp(yaw - dx * 0.002, -0.35, 0.35); layoutCamera(); }
});
canvas.addEventListener('pointerup', () => { drag = null; });

// ---------- manette ----------
const pad = new PadReader();
hidePadFocusOnPointer();
const nav = new PadNav({ root: () => document.body, back: () => { if (focused >= 0) focus(-1); } });
function pollPad(dt: number) {
  const { ax } = pad.read(dt, (e) => {
    if (e === 'prev' || e === 'next') { const n = cur().length; focus(((focused < 0 ? (e === 'next' ? -1 : 0) : focused) + (e === 'next' ? 1 : -1) + n) % n); return; }
    nav.handle(e);
  });
  if (!pad.gp) return;
  nav.refresh();
  if (ax[2]) { if (focused >= 0) { const s = cur()[focused].spin; s.a += ax[2] * 2.4 * dt; s.auto = 0; } else { yaw = THREE.MathUtils.clamp(yaw - ax[2] * 0.6 * dt, -0.35, 0.35); layoutCamera(); } }
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
  cur().forEach((s, i) => {
    if (!s.c) return;
    if (!drag || focused !== i) { s.spin.auto = Math.min(0.12, s.spin.auto + dt * 0.03); s.spin.a += s.spin.auto * dt * (focused === i ? 1 : 0.6); }
    s.ped.turntable.rotation.y = s.spin.a;
    s.c.update(dt, t + i * 3.7, action, emotion);
    s.ped.setFocus(focused === i ? 1 : 0, t);
  });
  dust.update(t);
  const k = 1 - Math.pow(0.003, dt);
  camPos.lerp(wantPos, k); camLook.lerp(wantLook, k);
  camera.position.copy(camPos); camera.lookAt(camLook);
  post.render(dt);
  requestAnimationFrame(frame);
}

async function start() {
  resize();
  const env = await loadHDRI(renderer, 'studio_small_09');
  scene.environment = env; scene.environmentIntensity = 0.35;
  await texturesReady();
  await buildTab('vael');
  showTab('vael');
  renderer.compile(scene, camera);
  $('#loader').classList.add('done');
  frame();
  setTimeout(bootSucceeded, 4000);
}
(window as unknown as { __species: unknown }).__species = { slots, focus, showTab, buildTab, set: (a: Action, e: Emotion) => { action = a; emotion = e; renderUI(); }, camera, render: () => post.render(1 / 60) };
start().catch((e) => { $('#loader .msg').textContent = 'Erreur : ' + e; console.error(e); });
