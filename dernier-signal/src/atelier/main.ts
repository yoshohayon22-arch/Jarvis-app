import * as THREE from 'three';
import '../ui/base.css';
import './atelier.css';
import { loadQuality, saveQuality, PRESETS, bootSucceeded, type PresetId } from '../core/quality';
import { createRenderer, Post, FpsMeter } from '../core/post';
import { loadHDRI, texturesReady, setMaxAnisotropy } from '../core/textures';
import { setMaterialRes } from '../robots/materials';
import { createFloor, resizeReflector } from '../fx/floor';
import { LightCone, Dust } from '../fx/volumetric';
import { Pedestal, createBackdrop } from './studio';
import { Robot, ACTION_LABELS, type ActionId } from '../robots/Robot';
import { CompactRobot } from '../robots/compact';
import { HaloRobot } from '../robots/halo';
import { OrbeRobot } from '../robots/orbe';
import { PadNav, PadReader, hidePadFocusOnPointer } from '../ui/padnav';

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
const q = loadQuality();
setMaterialRes(q.textureRes);

// ---------- rendu ----------
const canvas = $<HTMLCanvasElement>('#c');
const renderer = createRenderer(canvas, q);
setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030405);
scene.fog = new THREE.FogExp2(0x05070a, 0.045);
const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 60);
const post = new Post(renderer, scene, camera, q);

// ---------- éclairage de studio ----------
const key = new THREE.DirectionalLight(0xfff0e0, 2.4);
key.position.set(-4.5, 7, 6);
key.castShadow = true;
key.shadow.mapSize.setScalar(q.shadowMap);
key.shadow.camera.left = -5.5; key.shadow.camera.right = 5.5; key.shadow.camera.top = 3.5; key.shadow.camera.bottom = -2.5;
key.shadow.camera.near = 2; key.shadow.camera.far = 20;
key.shadow.bias = -0.0002; key.shadow.normalBias = 0.015; key.shadow.radius = 3;
scene.add(key);
const rim = new THREE.SpotLight(0x4fd2ff, 90, 25, 0.42, 0.8, 1.2);
rim.position.set(0.8, 3.2, -8);
rim.target.position.set(0, 1.1, 0);
scene.add(rim, rim.target);
const fill = new THREE.DirectionalLight(0x9fb4d8, 0.35);
fill.position.set(7, 2, 3);
scene.add(fill);

// La police doit être prête avant de dessiner les marquages sur les robots.
await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
await Promise.all([document.fonts.load('600 40px "Barlow Condensed"'), document.fonts.load('700 40px "Barlow Condensed"')]).catch(() => {});
const robots: Robot[] = [new CompactRobot('pixel'), new CompactRobot('rouille'), new HaloRobot(), new OrbeRobot()];
const pedestals: Pedestal[] = [];
const letters = ['A', 'B', 'C', 'D'];
const cones: LightCone[] = [];
const spots: THREE.SpotLight[] = [];
// Disposition : en ligne (paysage) ou en grille 2×2 (portrait).
const ROW = { x: [-3.3, -1.1, 1.1, 3.3], z: [-0.35, 0.15, 0.15, -0.35] };
const GRID = { x: [-0.82, 0.82, -1.95, 1.95], z: [-1.7, -1.7, 0.7, 0.7] };
let layout = ROW;
const X = [...ROW.x], Z = [...ROW.z];
robots.forEach((r, i) => {
  const p = new Pedestal(letters[i]);
  scene.add(p);
  pedestals.push(p);
  r.position.y = 0.017;
  p.turntable.add(r);
  r.enableLight(q.robotLights);
  scene.add(r.wave);
  const spot = new THREE.SpotLight(0xe8f2ff, 30, 9, 0.3, 0.7, 2);
  scene.add(spot, spot.target);
  spots.push(spot);
  if (q.volumetric) {
    const cone = new LightCone(new THREE.Vector3(0, 4.6, 0.9), new THREE.Vector3(0, 0, 0), 1.55, 0x9cc8ff, 0.05);
    scene.add(cone); cones.push(cone);
  }
});
function placePedestals(l: typeof ROW) {
  layout = l;
  robots.forEach((r, i) => {
    X[i] = l.x[i]; Z[i] = l.z[i];
    const p = pedestals[i];
    p.position.set(X[i], 0, Z[i]);
    p.rotation.y = l === ROW ? -X[i] * 0.06 : -X[i] * 0.12;
    r.rotation.y = 0.35 * Math.sign(-X[i]);
    r.wave.position.set(X[i], p.topY, Z[i]);
    spots[i].position.set(X[i] * 1.03, 4.6, Z[i] + 0.9);
    spots[i].target.position.set(X[i], 0.5, Z[i]);
    if (cones[i]) {
      const from = spots[i].position, to = new THREE.Vector3(X[i], 0, Z[i]);
      cones[i].position.copy(from);
      cones[i].quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
    }
  });
}
placePedestals(ROW);
const dust = new Dust(Math.round(900 * q.particles), new THREE.Box3(new THREE.Vector3(-5, 0.1, -2), new THREE.Vector3(5, 4.2, 2.5)));
scene.add(dust);
scene.add(createBackdrop());

const floor = createFloor(30, q.textureRes, { enabled: q.reflections !== 'off', width: 512, height: 512 });
scene.add(floor.group);

// ---------- caméra ----------
const camPos = new THREE.Vector3(0, 1.8, 9);
const camLook = new THREE.Vector3(0, 0.6, 0);
const wantPos = camPos.clone();
const wantLook = camLook.clone();
let focused = -1;
let overviewYaw = 0;

function layoutCamera() {
  const a = camera.aspect;
  if (focused < 0 && layout === GRID) {
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfovTan = Math.tan(vfov / 2) * a;
    const dist = Math.max(6.5, 2.75 / hfovTan);
    wantPos.set(Math.sin(overviewYaw) * dist, 2.4 + dist * 0.12, 0.3 + Math.cos(overviewYaw) * dist);
    wantLook.set(0, 0.35, -0.2);
  } else if (focused < 0) {
    const halfW = 4.6;
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfovTan = Math.tan(vfov / 2) * a;
    const dist = Math.max(7.5, halfW / hfovTan);
    wantPos.set(Math.sin(overviewYaw) * dist, 1.55 + dist * 0.06, Math.cos(overviewYaw) * dist);
    wantLook.set(0, 0.55, 0);
  } else {
    const p = pedestals[focused].position;
    const dist = a < 1 ? 4.6 : 3.4;
    wantPos.set(p.x + Math.sin(-X[focused] * 0.06) * dist * 0.2, 1.3, p.z + dist);
    if (layout === GRID) {
      // rangée du fond : viser en diagonale pour ne pas être masqué par la rangée de devant
      wantPos.x = p.x * 0.5; wantPos.z = p.z + 4.4; wantPos.y = 1.5;
    }
    // décaler légèrement pour laisser la place au panneau (paysage)
    const side = a > 1.2 ? 0.45 : 0;
    wantPos.x += side; 
    wantLook.set(p.x + side, a < 1 ? 0.45 : 0.62, p.z);
  }
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 40 : 34;
  camera.updateProjectionMatrix();
  const want = w / h < 0.9 ? GRID : ROW;
  if (want !== layout) placePedestals(want);
  post.setSize(w, h);
  const pr = renderer.getPixelRatio();
  resizeReflector(floor.reflector, Math.round(w * pr * q.reflectionScale), Math.round(h * pr * q.reflectionScale));
  layoutCamera();
}
window.addEventListener('resize', resize);

// ---------- interface ----------
const cards = $('#cards');
robots.forEach((r, i) => {
  const b = document.createElement('button');
  b.className = 'card';
  b.innerHTML = `<span class="letter">${letters[i]}</span><span class="name">${r.title.split('· ')[1]}</span>`;
  b.onclick = () => focus(focused === i ? -1 : i);
  cards.appendChild(b);
});
const panel = $('#panel');
const actionsEl = $('#actions');
function renderActions() {
  actionsEl.innerHTML = '';
  const list: ActionId[] = focused >= 0 ? robots[focused].actions : ['idle', 'walk', 'jump', 'jetpack', 'float', 'scan'];
  const current = focused >= 0 ? robots[focused].action : robots[0].action;
  for (const a of list) {
    const b = document.createElement('button');
    b.className = 'chip' + (a === current ? ' on' : '');
    b.textContent = ACTION_LABELS[a];
    b.onclick = () => {
      if (focused >= 0) robots[focused].setAction(a);
      else robots.forEach((r, i) => r.setAction(a === 'roll' && i !== 3 ? 'walk' : a));
      renderActions();
    };
    actionsEl.appendChild(b);
  }
}
function focus(i: number) {
  focused = i;
  document.body.classList.toggle('focused', i >= 0);
  [...cards.children].forEach((c, k) => c.classList.toggle('on', k === i));
  if (i >= 0) {
    $('#p-title').textContent = robots[i].title;
    $('#p-text').textContent = robots[i].tagline;
    $('#choose').textContent = chosen === robots[i].rid ? '✓ Design retenu' : 'Choisir ce design';
  }
  panel.classList.toggle('show', i >= 0);
  renderActions();
  layoutCamera();
}
$('#back').onclick = () => focus(-1);

let chosen = '';
try { chosen = localStorage.getItem('dernier-signal:robot') ?? ''; } catch { /* */ }
$('#choose').onclick = () => {
  if (focused < 0) return;
  chosen = robots[focused].rid;
  try { localStorage.setItem('dernier-signal:robot', chosen); } catch { /* */ }
  $('#choose').textContent = '✓ Design retenu';
  toast(`${robots[focused].title} retenu. Écris-le à Claude dans la conversation pour valider.`);
};
function toast(msg: string) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout((t as unknown as { _h: number })._h);
  (t as unknown as { _h: number })._h = window.setTimeout(() => t.classList.remove('show'), 4200);
}

// qualité + compteur
const qsel = $<HTMLSelectElement>('#quality');
for (const p of Object.values(PRESETS)) {
  const o = document.createElement('option'); o.value = p.id; o.textContent = p.label; qsel.appendChild(o);
}
qsel.value = q.id;
qsel.onchange = () => { saveQuality(qsel.value as PresetId); bootSucceeded(); location.reload(); };
const fpsEl = $('#fps');
const fps = new FpsMeter(fpsEl);
let showFps = false;
try { showFps = localStorage.getItem('dernier-signal:fps') === '1'; } catch { /* */ }
fpsEl.hidden = !showFps;
$('#fpsbtn').onclick = () => {
  showFps = !showFps; fpsEl.hidden = !showFps;
  try { localStorage.setItem('dernier-signal:fps', showFps ? '1' : '0'); } catch { /* */ }
};

// ---------- gestes : tourner le robot / choisir ----------
const spin = robots.map(() => ({ angle: 0, vel: 0, auto: 0.16 }));
let drag: { x: number; y: number; t: number; moved: number; id: number } | null = null;
const ray = new THREE.Raycaster();
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, id: e.pointerId };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x;
  drag.moved += Math.abs(dx) + Math.abs(e.clientY - drag.y);
  drag.x = e.clientX; drag.y = e.clientY;
  if (focused >= 0) {
    const s = spin[focused];
    s.angle += dx * 0.011; s.vel = dx * 0.011 / Math.max(1 / 120, 1 / 60); s.auto = 0;
  } else {
    overviewYaw = THREE.MathUtils.clamp(overviewYaw - dx * 0.0025, -0.4, 0.4);
    layoutCamera();
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const tap = drag.moved < 8 && performance.now() - drag.t < 350;
  drag = null;
  if (!tap) return;
  const rect = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
  let best = -1, bestD = Infinity;
  pedestals.forEach((p, i) => {
    const box = new THREE.Box3().setFromCenterAndSize(p.position.clone().add(new THREE.Vector3(0, 0.65, 0)), new THREE.Vector3(1.3, 1.4, 1.3));
    const hit = ray.ray.intersectBox(box, new THREE.Vector3());
    if (hit) { const d = hit.distanceTo(camera.position); if (d < bestD) { bestD = d; best = i; } }
  });
  if (best >= 0 && best !== focused) focus(best);
});
canvas.addEventListener('pointercancel', () => { drag = null; });

// ---------- manette : choisir un robot, le faire tourner ----------
const pad = new PadReader();
hidePadFocusOnPointer();
const nav = new PadNav({ root: () => document.body, back: () => { if (focused >= 0) focus(-1); } });
function pollPad(dt: number) {
  const { ax } = pad.read(dt, (e) => {
    // LB / RB : robot précédent / suivant
    if (e === 'prev' || e === 'next') { focus(((focused < 0 ? (e === 'next' ? -1 : 0) : focused) + (e === 'next' ? 1 : -1) + robots.length) % robots.length); return; }
    nav.handle(e);
  });
  if (!pad.gp) return;
  nav.refresh();
  const rx = ax[2];
  if (!rx) return;
  if (focused >= 0) { const s = spin[focused]; s.angle += rx * 2.4 * dt; s.vel = 0; s.auto = 0; }
  else { overviewYaw = THREE.MathUtils.clamp(overviewYaw - rx * 0.6 * dt, -0.4, 0.4); layoutCamera(); }
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
  robots.forEach((r, i) => {
    const s = spin[i];
    if (!drag || focused !== i) {
      s.vel *= Math.pow(0.04, dt);
      s.auto = Math.min(0.16, s.auto + dt * 0.03);
      s.angle += (s.vel + s.auto) * dt;
    }
    pedestals[i].turntable.rotation.y = s.angle;
    r.focus += ((focused === i ? 1 : 0) - r.focus) * Math.min(1, dt * 4);
    pedestals[i].setFocus(r.focus, t);
    r.update(dt, t + i * 7.3);
    r.wave.update(dt, t, pedestals[i].topY);
  });
  for (const c of cones) c.update(t);
  dust.update(t);
  const k = 1 - Math.pow(0.0025, dt);
  camPos.lerp(wantPos, k); camLook.lerp(wantLook, k);
  camera.position.copy(camPos);
  camera.position.y += Math.sin(t * 0.3) * 0.02;
  camera.lookAt(camLook);
  post.render(dt);
  requestAnimationFrame(frame);
}

// ---------- démarrage ----------
async function start() {
  resize();
  const env = await loadHDRI(renderer, 'studio_small_09');
  scene.environment = env;
  scene.environmentIntensity = 0.32;
  await texturesReady();
  renderActions();
  renderer.compile(scene, camera);
  $('#loader').classList.add('done');
  frame();
  setTimeout(bootSucceeded, 4000);
}
start().catch((e) => { $('#loader').textContent = 'Erreur de chargement : ' + e; console.error(e); });
