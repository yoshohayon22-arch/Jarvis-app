// Prototype du mode gouverneur (étape 2 du document « civilisation »).
import * as THREE from 'three';
import './gov.css';
import { loadQuality, isTouchDevice, bootSucceeded, gpuBlockedHelp, watchContextLoss } from '../core/quality';
import { acquireContext, createRenderer, Post } from '../core/post';
import { texturesReady } from '../core/textures';
import { setMaterialRes } from '../robots/materials';
import { CompactRobot } from '../robots/compact';
import { BUILDINGS, DECISIONS, GROUPS, LATER, RES, RES_ORDER, SUMMARY_SLIDES, type BuildingId, type GroupId, type Line } from './content';
import { Sim, BEACON, clamp } from './sim';
import { World, heightAt } from './world';
import { PadNav, PadReader, padStatus, ask, askOpen, askRoot, askCancel, hidePadFocusOnPointer } from '../ui/padnav';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const $$ = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];
const SAVE = 'dernier-signal:civ';

// ---------- rendu ----------
const q = loadQuality();
setMaterialRes(q.textureRes);
const touch = isTouchDevice();
const acq = await acquireContext(touch, () => {});
if ('error' in acq) { $('#loader .msg').textContent = 'La 3D est bloquée'; const e = $('#loader .err'); e.style.display = 'block'; e.textContent = gpuBlockedHelp() + '  —  Diagnostic : ' + acq.error; await new Promise(() => {}); }
const { canvas, gl } = acq as { canvas: HTMLCanvasElement; gl: WebGL2RenderingContext };
const renderer = createRenderer(canvas, q, gl);
watchContextLoss(canvas, (msg) => { $('#loader').classList.remove('done'); $('#loader .msg').textContent = msg; });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
renderer.shadowMap.enabled = q.id !== 'econome';
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02040a);
scene.fog = new THREE.Fog(0x02040a, 70, 230);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 1500);
const post = new Post(renderer, scene, camera, q);
if (post.ao) { post.ao.configuration.aoRadius = 1.2; post.ao.configuration.intensity = 2; }
const world = new World(scene, q.id !== 'econome');

// R-12 près de la balise
const r12 = new CompactRobot('rouille');
r12.gameMode = true;
r12.position.set(BEACON.x + 4, heightAt(4, 5), BEACON.z + 5); r12.rotation.y = -2.4;
scene.add(r12);
r12.setAction('idle');

// ---------- caméra du gouverneur ----------
const cam = { target: new THREE.Vector3(0, 0, 2), dist: 48, yaw: 0.35, goalDist: 48 };
function placeCamera() {
  cam.dist += (cam.goalDist - cam.dist) * 0.2;
  const pitch = THREE.MathUtils.lerp(0.72, 1.12, (cam.dist - 18) / 100);
  cam.target.x = clamp(cam.target.x, -72, 72); cam.target.z = clamp(cam.target.z, -72, 72);
  cam.target.y = heightAt(cam.target.x, cam.target.z);
  camera.position.set(cam.target.x + Math.sin(cam.yaw) * Math.cos(pitch) * cam.dist, cam.target.y + Math.sin(pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * Math.cos(pitch) * cam.dist);
  camera.lookAt(cam.target);
  camera.updateMatrixWorld();
}
function pan(dx: number, dy: number) {
  const k = cam.dist * 0.0021;
  const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
  const fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
  cam.target.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k);
}
const zoom = (f: number) => { cam.goalDist = clamp(cam.goalDist * f, 18, 120); };

// ---------- état ----------
let sim: Sim;
let speed = 1, lastSpeed = 1;
let acc = 0;
let modal = false;
let placing: { def: BuildingId; ghost: THREE.Group; x: number; z: number; rot: number } | null = null;
let selected: number | null = null;
let bilanShown = false;
const HOUR = 5; // secondes réelles par heure de jeu à ×1

function save() { try { localStorage.setItem(SAVE, JSON.stringify(sim)); } catch { /* */ } }
function hasSave() { try { return !!localStorage.getItem(SAVE); } catch { return false; } }

// ---------- interface ----------
function setSpeed(s: number) {
  speed = s; if (s > 0) lastSpeed = s;
  $$('.sp').forEach((b) => b.classList.toggle('on', +b.dataset.s! === s));
}
$$('.sp').forEach((b) => b.addEventListener('click', () => setSpeed(+b.dataset.s!)));

function renderTop() {
  $('#res').innerHTML = RES_ORDER.map((r) => {
    const v = sim.res[r], d = sim.delta[r];
    const ds = Math.abs(d) < 0.05 ? '' : `<small class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d.toFixed(1)}/h</small>`;
    return `<div class="rs${sim.shortage[r] ? ' short' : ''}" title="${RES[r].label}"><span class="i">${RES[r].icon}</span><b>${Math.floor(v)}</b>${ds}</div>`;
  }).join('');
  const h = Math.floor(sim.hour);
  $('#clock .day').textContent = `Jour ${sim.day} · ${String(h).padStart(2, '0')} h`;
  $('#clock .season').textContent = `${sim.season} · ${sim.isDay ? 'jour' : 'nuit'}`;
  ($('.meter.peace b')).style.width = `${sim.paix}%`;
  ($('.meter.tension b')).style.width = `${sim.tension}%`;
  const next = sim.nextCouncil();
  const cb = $('.sb[data-p="council"]');
  cb.querySelector('small')!.textContent = next ? `jour ${next.day}` : 'aucun';
  cb.classList.toggle('alert', !!sim.dueDecision() || sim.laterQueue.length > 0);
  if (selected !== null) renderInfo();
}

let buildTab: GroupId | 'commun' = 'forges';
function renderBuild() {
  $$('.bt').forEach((b) => b.classList.toggle('on', b.dataset.g === buildTab));
  const items = (Object.values(BUILDINGS)).filter((d) => d.group === buildTab);
  const cost = (c: Partial<Record<string, number>>) => Object.entries(c).map(([r, v]) => `${RES[r as keyof typeof RES].icon} ${v}`).join('  ');
  $('#buildbar .items').innerHTML = items.map((d) => {
    const ok = sim.canAfford(d.id) && sim.unlocked(d.id);
    return `<button class="bi${ok ? '' : ' no'}${placing?.def === d.id ? ' sel' : ''}" data-b="${d.id}"><b>${d.name}</b><small>${cost(d.cost)}</small><small>${sim.unlocked(d.id) ? d.desc : '🔒 ' + d.unlock}</small></button>`;
  }).join('');
  $$('#buildbar .bi').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.b as BuildingId;
    if (!sim.unlocked(id)) { note(BUILDINGS[id].name + ' verrouillé', BUILDINGS[id].unlock); return; }
    if (!sim.canAfford(id)) { note('Ressources insuffisantes', BUILDINGS[id].name); return; }
    startPlacing(id);
  }));
}
$$('.bt').forEach((b) => b.addEventListener('click', () => { buildTab = b.dataset.g as GroupId; renderBuild(); }));

function note(text: string, sub?: string, crisis = false) {
  const n = document.createElement('div'); n.className = 'note' + (crisis ? ' crisis' : '');
  n.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
  $('#notes').prepend(n);
  setTimeout(() => n.remove(), crisis ? 9000 : 6000);
  while ($('#notes').children.length > 4) $('#notes').lastElementChild!.remove();
}

// ---------- placement ----------
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x7dffb2, transparent: true, opacity: 0.45, depthWrite: false });
function startPlacing(def: BuildingId) {
  cancelPlacing();
  const ghost = world.makeBuilding(def);
  ghost.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = ghostMat; m.castShadow = false; } if ((o as THREE.Light).isLight) o.visible = false; });
  const ring = new THREE.Mesh(new THREE.RingGeometry(BUILDINGS[def].size * 0.5, BUILDINGS[def].size * 0.5 + 0.25, 40), ghostMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; ghost.add(ring);
  scene.add(ghost);
  placing = { def, ghost, x: cam.target.x, z: cam.target.z, rot: 0 };
  $('#buildbar').hidden = true; $('#placebar').hidden = false;
  closeInfo();
  movePlacing(cam.target.x, cam.target.z);
  renderBuild();
}
function movePlacing(x: number, z: number) {
  if (!placing) return;
  placing.x = Math.round(x * 2) / 2; placing.z = Math.round(z * 2) / 2;
  placing.ghost.position.set(placing.x, heightAt(placing.x, placing.z), placing.z);
  placing.ghost.rotation.y = placing.rot;
  const issue = sim.placementIssue(placing.def, placing.x, placing.z);
  const grove = sim.inGrove(placing.x, placing.z) && BUILDINGS[placing.def].group !== 'racines';
  ghostMat.color.set(issue ? 0xff5a40 : grove ? 0xffb040 : 0x7dffb2);
  const m = $('#placebar .msg');
  m.textContent = issue ?? (grove ? 'Forêt sacrée des Racines : ils le prendront mal' : `${BUILDINGS[placing.def].name} · touchez le terrain pour déplacer`);
  m.classList.toggle('bad', !!issue || grove);
  ($<HTMLButtonElement>('#placebar .ok')).disabled = !!issue;
}
function confirmPlacing() {
  if (!placing || sim.placementIssue(placing.def, placing.x, placing.z) || !sim.canAfford(placing.def)) return;
  sim.build(placing.def, placing.x, placing.z, placing.rot);
  note(`Construction lancée : ${BUILDINGS[placing.def].name}`);
  cancelPlacing(); save(); renderTop();
}
function cancelPlacing() {
  if (!placing) return;
  placing.ghost.removeFromParent(); placing = null;
  $('#buildbar').hidden = false; $('#placebar').hidden = true;
  renderBuild();
}
$('#placebar .ok').addEventListener('click', confirmPlacing);
$('#placebar .cancel').addEventListener('click', cancelPlacing);
$('#placebar .rot').addEventListener('click', () => { if (placing) { placing.rot += Math.PI / 4; movePlacing(placing.x, placing.z); } });

// ---------- sélection d'un bâtiment ----------
function renderInfo() {
  const b = sim.buildings.find((x) => x.id === selected);
  if (!b) return closeInfo();
  const d = BUILDINGS[b.def];
  const owner = d.group === 'commun' ? 'Bâtiment commun' : GROUPS[d.group].name;
  const status = b.progress < 1 ? `En construction · ${Math.round(b.progress * 100)} %` : b.damaged ? '⚠ Endommagé' : b.paused ? 'En pause' : d.workers ? `Travailleurs : ${b.staffed} / ${d.workers}` : d.capacity ? `Habitants : ${sim.citizens.filter((c) => c.home === b.id).length} / ${d.capacity}` : 'En service';
  let actions = '';
  if (b.progress >= 1 && b.damaged) actions += `<button data-a="repair">Réparer (⚙ 5)</button>`;
  if (b.progress >= 1 && !b.damaged && d.workers) actions += `<button data-a="pause">${b.paused ? 'Reprendre le travail' : 'Mettre en pause'}</button>`;
  if (b.def === 'abri' && b.progress >= 1) actions += `<button data-a="forge">Construire un Forgé (⚙ 15, ⚡ 10)</button>`;
  $('#info').innerHTML = `<h3>${d.name}</h3><p>${owner}</p><p>${status}</p><p>${d.desc}</p><div class="row">${actions}<button data-a="close">Fermer</button></div>`;
  $('#info').hidden = false;
  $$('#info button').forEach((btn) => btn.addEventListener('click', () => {
    const a = btn.dataset.a;
    if (a === 'repair' && !sim.repair(b)) note('Pas assez de métal');
    if (a === 'pause') b.paused = !b.paused;
    if (a === 'forge') { if (!sim.buildForge()) note('Impossible', sim.pop('forges') >= sim.capacity('forges') ? 'Plus de place : construisez un autre abri.' : 'Il faut 15 métal et 10 énergie.'); flushNotes(); }
    if (a === 'close') return closeInfo();
    renderInfo(); renderTop();
  }));
}
function closeInfo() { selected = null; $('#info').hidden = true; }

// ---------- panneaux ----------
function openPanel(kind: string) {
  if (kind === 'council') {
    const due = sim.dueDecision();
    if (due || sim.laterQueue.length) { checkCouncil(true); return; }
    const next = sim.nextCouncil();
    showPanel('Conseil', `<p>${next ? `Prochaine réunion : jour ${next.day}, à 9 h · « ${next.title} »` : 'Le conseil n\'a plus de question pour ce prototype.'}</p>
      <h3>Décisions prises</h3>${sim.history.filter((h) => h.includes(' · ')).map((h) => `<p class="hist">${h}</p>`).join('') || '<p class="hist">Aucune pour l\'instant.</p>'}`);
  } else if (kind === 'relations') {
    const bar = (v: number, col: string) => `<div class="bar"><b style="width:${v}%;background:${col}"></b><span>${Math.round(v)}</span></div>`;
    const row = (g: GroupId, o: GroupId) => `<tr><td class="gname" style="color:${GROUPS[g].color}">${GROUPS[g].short} → ${GROUPS[o].short}</td><td>${bar(sim.rel[g].confiance, '#7dffb2')}</td><td>${bar(sim.rel[g].peur, '#b08cff')}</td><td>${bar(sim.rel[g].rancune, '#ff7a5a')}</td><td>${bar(sim.rel[g].dette, '#ffd36a')}</td></tr>`;
    const loy = (g: GroupId) => `<tr><td class="gname" style="color:${GROUPS[g].color}">${GROUPS[g].name}</td><td>${bar(sim.loyal[g], GROUPS[g].color)}</td><td>${bar(sim.moral[g], '#e8f1f6')}</td><td>${sim.pop(g)} / ${sim.capacity(g)}</td></tr>`;
    showPanel('Relations', `<table class="reltable"><tr><th>Ce que ressent…</th><th>Confiance</th><th>Peur</th><th>Rancune</th><th>Dette</th></tr>${row('forges', 'racines')}${row('racines', 'forges')}</table>
      <table class="reltable" style="margin-top:14px"><tr><th>Groupe</th><th>Loyauté envers R-12</th><th>Moral</th><th>Population</th></tr>${loy('forges')}${loy('racines')}</table>
      <p class="hist">Paix ${Math.round(sim.paix)} · Tension ${Math.round(sim.tension)}. Si la tension reste au-dessus de 70, des incidents éclatent. Si la loyauté tombe sous 15, le groupe arrête de travailler.</p>
      <p class="hist">Confiance mutuelle : ${Math.round(sim.mutual())} (55 débloque le Feu commun).</p>`);
  } else if (kind === 'leaders') {
    const card = (g: GroupId) => { const L = GROUPS[g].leader; return `<div class="leader"><div class="face${g === 'racines' ? ' vael' : ''}" style="--c:${faceColor(g)}"></div><div><b>${L.name}</b> · <em>${L.title}</em><p>${L.trait}</p><p><em>Objectif</em> ${L.goal}</p><p><em>Limite</em> ${L.limit}</p><p><em>Humeur</em> ${mood(g)}</p><button data-gift="${g}">Offrir un cristal (◆ 1)</button></div></div>`; };
    showPanel('Chefs', card('forges') + card('racines'));
    $$('[data-gift]').forEach((b) => b.addEventListener('click', () => { const g = b.dataset.gift as GroupId; if (sim.gift(g)) { note(`${GROUPS[g].leader.name} accepte le cristal`, 'Loyauté et moral en hausse.'); openPanel('leaders'); renderTop(); } else note('Pas de cristal'); }));
  } else if (kind === 'menu') {
    showPanel('Menu', `<p class="hist">Prototype du mode gouverneur · Jour ${sim.day}</p>
      <button class="act" data-m="save">Sauvegarder</button> <button class="act" data-m="new">Nouvelle fondation</button> <button class="act" data-m="title">Écran titre du jeu</button>
      <h3>Commandes</h3><p class="hist">Doigt : glisser pour déplacer la vue, pincer pour zoomer, tourner à deux doigts pour pivoter, toucher un bâtiment pour le gérer.</p>
      <p class="hist">Souris : glisser (déplacer), clic droit glissé (pivoter), molette (zoom). Clavier : ZQSD / WASD, R et T pour pivoter, Espace pour la pause, 1 à 4 pour la vitesse.</p>
      <p class="hist" style="color:#ffd36a">${padStatus()}</p>
      <p class="hist">Manette : stick gauche (déplacer), stick droit (pivoter, zoomer), A (choisir au centre), B (annuler), LB / RB (bâtiments), Y (tourner le bâtiment à placer, sinon relations), gâchettes (vitesse), X (conseil), Select (chefs), Start (menu). Dans les fenêtres : croix ou stick pour choisir, A pour valider, B pour fermer, stick droit pour faire défiler.</p>`);
    $$('[data-m]').forEach((b) => b.addEventListener('click', () => {
      const m = b.dataset.m;
      if (m === 'save') { save(); note('Partie sauvegardée'); }
      if (m === 'new') ask('Recommencer une nouvelle fondation ? La civilisation actuelle sera effacée.', 'Recommencer').then((ok) => { if (ok) { localStorage.removeItem(SAVE); location.hash = 'new'; location.reload(); } });
      if (m === 'title') { save(); location.href = 'index.html'; }
    }));
  }
}
function showPanel(title: string, html: string) {
  $('#panel h2').textContent = title; $('#panel .body').innerHTML = html; $('#panel').hidden = false;
}
$('#panel .close').addEventListener('click', () => ($('#panel').hidden = true));
$$('.sb').forEach((b) => b.addEventListener('click', () => openPanel(b.dataset.p!)));

function emotion(g: GroupId) {
  // -1 colère … 0 calme … +1 joie
  const r = sim.rel[g];
  const anger = (r.rancune * 1.2 + sim.tension * 0.6 - 40) / 50;
  const joy = (sim.moral[g] + sim.paix - 120) / 40;
  return anger > 0 ? -Math.min(1, anger) : Math.max(0, Math.min(1, joy));
}
function faceColor(g: GroupId) {
  if (g === 'forges') return GROUPS.forges.color;
  const e = emotion(g);
  return e < -0.3 ? '#ff5a40' : e > 0.4 ? '#ffc040' : '#4fb6ff';
}
function mood(g: GroupId) {
  const e = emotion(g);
  return e < -0.5 ? 'en colère' : e < -0.1 ? 'tendu' : e > 0.4 ? 'confiant' : 'calme';
}

// ---------- conseil et souvenirs ----------
const WHO: Record<string, string> = { forges: 'Ancre', racines: 'Ysalé', r12: 'R-12', narr: '', ilse: 'Ilse Varga' };
function showMemory(lines: Line[]) {
  return new Promise<void>((resolve) => {
    const m = $('#memory'); m.hidden = false;
    let i = 0, timer = 0;
    const show = () => {
      if (i >= lines.length) { m.hidden = true; resolve(); return; }
      const l = lines[i++];
      if (l.who === 'narr' && i === 1) { $('#memory .tag').textContent = l.text; return show(); }
      $('#memory .txt').textContent = (l.who === 'ilse' ? 'Ilse : ' : '') + l.text;
      clearTimeout(timer); timer = window.setTimeout(show, 2500 + l.text.length * 45);
    };
    ($('#memory .skip')).onclick = () => { clearTimeout(timer); i = lines.length; show(); };
    m.onclick = (e) => { if (e.target === m || (e.target as HTMLElement).classList.contains('txt')) { clearTimeout(timer); show(); } };
    show();
  });
}
function playLines(lines: Line[]) {
  return new Promise<void>((resolve) => {
    const c = $('#council');
    let i = 0;
    const next = () => {
      if (i >= lines.length) { resolve(); return; }
      const l = lines[i++];
      $$('#council .seat').forEach((s) => s.classList.remove('speak'));
      if (l.who === 'forges') $('#council .seat.left').classList.add('speak');
      if (l.who === 'racines') $('#council .seat.right').classList.add('speak');
      if (l.who === 'r12') $('#council .seat.center').classList.add('speak');
      const who = $('#council .who'); who.textContent = WHO[l.who] || 'Récit';
      who.style.color = l.who === 'forges' ? GROUPS.forges.color : l.who === 'racines' ? faceColor('racines') : '#c9d6de';
      $('#council .line').textContent = l.text;
    };
    ($('#council .dialog')).onclick = next;
    c.hidden = false;
    next();
  });
}
function setupSeats(title: string) {
  const c = $('#council');
  c.querySelector('.ctitle')!.textContent = title;
  const L = c.querySelector('.seat.left')!, R = c.querySelector('.seat.right')!;
  L.querySelector('b')!.textContent = 'Ancre'; L.querySelector('small')!.textContent = 'Forgés';
  (L.querySelector('.face') as HTMLElement).style.setProperty('--c', faceColor('forges'));
  R.querySelector('b')!.textContent = 'Ysalé'; R.querySelector('small')!.textContent = 'Clan des Racines';
  const rf = R.querySelector('.face') as HTMLElement; rf.classList.add('vael'); rf.style.setProperty('--c', faceColor('racines'));
  $('#council .options').hidden = true; ($('#council .dialog')).hidden = false;
}
async function runDecision(id: string) {
  const d = DECISIONS.find((x) => x.id === id)!;
  modal = true; const prev = speed; setSpeed(0);
  if (d.memory) await showMemory(d.memory);
  setupSeats(`Conseil · ${d.title}`);
  await playLines(d.intro);
  const opts = $('#council .options');
  opts.innerHTML = d.options.map((o) => `<button class="opt" data-o="${o.id}"><b>${o.label}</b><small>${o.hint}</small></button>`).join('');
  opts.hidden = false; ($('#council .dialog')).hidden = true;
  $$('#council .seat').forEach((s) => s.classList.remove('speak'));
  const chosen = await new Promise<string>((res) => $$('#council .opt').forEach((b) => b.addEventListener('click', () => res(b.dataset.o!))));
  const o = d.options.find((x) => x.id === chosen)!;
  sim.choose(d.id, chosen);
  opts.hidden = true; ($('#council .dialog')).hidden = false;
  (($('#council .seat.right .face'))).style.setProperty('--c', faceColor('racines'));
  const reply = o.reply.map((l) => l.text === '__veille__' ? { who: l.who, text: sim.flags.veille ? 'Nous acceptons. Pas parce que tu l\'ordonnes : parce que nous le voulons. Le clan aura chaud.' : 'Ils obéiront. Mais tu leur as pris quelque chose, ce soir. Je ne sais pas encore quoi.' } : l);
  await playLines([...reply, { who: 'narr', text: 'Le conseil se sépare. Les conséquences de ce choix ne sont peut-être pas toutes visibles aujourd\'hui.' }]);
  $('#council').hidden = true;
  modal = false; setSpeed(prev || lastSpeed);
  save(); renderTop(); renderBuild(); flushNotes();
}
async function runLater(key: string) {
  const L = LATER[key];
  modal = true; const prev = speed; setSpeed(0);
  setupSeats(L.title);
  await playLines(L.lines);
  sim.applyLater(key);
  $('#council').hidden = true;
  modal = false; setSpeed(prev || lastSpeed);
  save(); renderTop(); flushNotes();
}
let councilWait = 0;
function checkCouncil(now = false) {
  if (modal) return;
  if (sim.laterQueue.length) { const k = sim.laterQueue.shift()!; if (now) runLater(k); else { note(LATER[k].title, 'Une conséquence d\'un ancien choix…', true); councilWait = 1.5; pendingLater = k; } return; }
  const d = sim.dueDecision();
  if (d) { if (now) runDecision(d.id); else if (!pendingDecision) { pendingDecision = d.id; councilWait = 1.5; note('Le conseil se réunit', d.title); } }
}
let pendingDecision: string | null = null, pendingLater: string | null = null;

function flushNotes() { for (const n of sim.notes.splice(0)) note(n.text, n.sub, n.crisis); }

// ---------- résumé et bilan ----------
function playSummary() {
  return new Promise<void>((resolve) => {
    const s = $('#summary'); s.hidden = false;
    $('#summary .dots').innerHTML = SUMMARY_SLIDES.map(() => '<i></i>').join('');
    let i = 0, timer = 0;
    const end = () => { clearTimeout(timer); s.hidden = true; resolve(); };
    const show = () => {
      if (i >= SUMMARY_SLIDES.length) return end();
      const p = $('#summary .slide'); p.style.opacity = '0';
      setTimeout(() => { p.textContent = SUMMARY_SLIDES[i]; p.style.opacity = '1'; $$('#summary .dots i').forEach((d, k) => d.classList.toggle('on', k === i)); i++; }, 300);
      timer = window.setTimeout(show, 5000);
    };
    ($('#summary .skip')).onclick = end;
    s.onclick = (e) => { if (e.target === s || (e.target as HTMLElement).classList.contains('slide')) { clearTimeout(timer); show(); } };
    show();
  });
}
function showBilan() {
  bilanShown = true; sim.flags.bilan = true; modal = true; setSpeed(0);
  const b = $('#bilan'); b.hidden = false;
  b.innerHTML = `<small>Récapitulatif · Jour ${sim.day}</small><h1 style="font-size:clamp(34px,6vw,56px)">Bilan</h1>
    <div class="stats"><div><b>${sim.pop('forges')}</b>Forgés</div><div><b>${sim.pop('racines')}</b>Vaëls</div><div><b>${sim.buildings.length}</b>bâtiments</div>
    <div><b>${Math.round(sim.paix)}</b>paix</div><div><b>${Math.round(sim.tension)}</b>tension</div><div><b>${Math.round(sim.mutual())}</b>confiance mutuelle</div></div>
    <div class="hist">${sim.history.filter((h) => h.includes(' · ')).map((h) => `<p>${h}</p>`).join('')}</div>
    <p>La vallée continue de vivre : il n'y a pas de fin. Dis-moi ce qui t'a amusé ou ennuyé.</p>
    <div class="col"><button class="gbtn primary" id="b-cont">Continuer à gouverner</button><a class="gbtn ghost" href="index.html">Écran titre</a></div>`;
  $('#b-cont').onclick = () => { b.hidden = true; modal = false; setSpeed(1); };
  save();
}

// ---------- entrées : doigt, souris, clavier, manette ----------
const ptrs = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
let pinch: { d: number; a: number; mx: number; my: number } | null = null;
let rotating = false;
const ray = new THREE.Raycaster();
function groundAt(cx: number, cy: number) {
  ray.setFromCamera(new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
  return ray.intersectObject(world.terrain, false)[0]?.point ?? null;
}
function pickBuilding(cx: number, cy: number) {
  ray.setFromCamera(new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
  world.root.updateMatrixWorld();
  const hits = ray.intersectObjects([...world.buildingMeshes.values()], true);
  const shown = (o: THREE.Object3D | null) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  for (const h of hits) { if (!shown(h.object)) continue; let o: THREE.Object3D | null = h.object; while (o && o.userData.id === undefined) o = o.parent; if (o) return o.userData.id as number; }
  return null;
}
function tapAt(cx: number, cy: number) {
  if (modal) return;
  if (placing) { const p = groundAt(cx, cy); if (p) movePlacing(p.x, p.z); return; }
  const id = pickBuilding(cx, cy);
  if (id !== null) { selected = id; renderInfo(); } else closeInfo();
}
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
  rotating = e.pointerType === 'mouse' && (e.button === 2 || e.shiftKey);
  document.body.classList.remove('pad');
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
});
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) { if (placing && e.pointerType === 'mouse') { const g = groundAt(e.clientX, e.clientY); if (g) movePlacing(g.x, g.z); } return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 2 && pinch) {
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    zoom(pinch.d / Math.max(1, d)); cam.dist = cam.goalDist;
    cam.yaw -= ang - pinch.a;
    pan(mx - pinch.mx, my - pinch.my);
    pinch = { d, a: ang, mx, my };
    return;
  }
  if (rotating) { cam.yaw -= dx * 0.006; return; }
  if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) pan(dx, dy);
});
const up = (e: PointerEvent) => {
  const p = ptrs.get(e.pointerId);
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (p && !rotating && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 8 && performance.now() - p.t < 400 && ptrs.size === 0) tapAt(e.clientX, e.clientY);
  rotating = false;
};
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });

const keys = new Set<string>();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (modal) return;
  if (e.code === 'Space') { setSpeed(speed ? 0 : lastSpeed); e.preventDefault(); }
  if (/^Digit[1-4]$/.test(e.code)) setSpeed([1, 2, 4, 4][+e.code.slice(5) - 1]);
  if (e.code === 'Escape') { if (placing) cancelPlacing(); else if (!$('#panel').hidden) $('#panel').hidden = true; else closeInfo(); }
  if (e.code === 'Enter') confirmPlacing();
});
addEventListener('keyup', (e) => keys.delete(e.code));

let buildCursor = 0;
const pad = new PadReader();
hidePadFocusOnPointer();
// menus et fenêtres à la manette : la croix ou le stick choisit, A valide, B ferme
function navRoot(): HTMLElement | null {
  const a = askRoot(); if (a) return a;
  if (!$('#bilan').hidden) return $('#bilan');
  if (!$('#summary').hidden) return $('#summary');
  if (!$('#memory').hidden) return $('#memory');
  if (!$('#council').hidden) return $('#council .options').hidden ? $('#council') : $('#council .options');
  if (!$('#start').hidden) return $('#start');
  if (!$('#panel').hidden) return $('#panel');
  if (!$('#info').hidden) return $('#info');
  return null;
}
const nav = new PadNav({
  root: navRoot,
  back: (root) => {
    if (askOpen()) askCancel();
    else if (root.id === 'panel') $('#panel').hidden = true;
    else if (root.id === 'info') closeInfo();
    else if (root.id === 'memory' || root.id === 'summary') root.querySelector<HTMLElement>('.skip')?.click();
  },
});
function pollPad(dt: number) {
  const root = navRoot();
  const { down, ax } = pad.read(dt, root ? (e) => nav.handle(e) : undefined);
  if (!pad.gp) return;
  if (ax.some((v) => v) || down.size) document.body.classList.add('pad');
  if (root) { nav.refresh(); if (ax[3]) nav.scroll(ax[3] * Math.abs(ax[3]) * 900 * dt); return; }
  nav.set(null);
  if (!sim) return;
  const pressed = (i: number) => down.has(i);
  if (!modal) {
    pan(-ax[0] * 900 * dt, -ax[1] * 900 * dt);
    cam.yaw -= ax[2] * 1.8 * dt; zoom(Math.exp(ax[3] * 1.2 * dt));
    if (placing) movePlacing(cam.target.x, cam.target.z);
  }
  if (modal) return;
  if (pressed(0)) { if (placing) confirmPlacing(); else tapAt(innerWidth / 2, innerHeight / 2); }
  if (pressed(1) && placing) cancelPlacing();
  if (pressed(2)) openPanel('council');
  if (pressed(3)) { if (placing) { placing.rot += Math.PI / 4; movePlacing(placing.x, placing.z); } else openPanel('relations'); }
  if (pressed(8)) openPanel('leaders');
  const ids = (Object.keys(BUILDINGS) as BuildingId[]);
  if (pressed(4) || pressed(5)) { buildCursor = (buildCursor + (pressed(5) ? 1 : ids.length - 1)) % ids.length; const id = ids[buildCursor]; buildTab = BUILDINGS[id].group; if (placing) cancelPlacing(); if (sim.unlocked(id) && sim.canAfford(id)) startPlacing(id); else { renderBuild(); note(BUILDINGS[id].name, sim.unlocked(id) ? 'Ressources insuffisantes' : BUILDINGS[id].unlock); } }
  if (pressed(6)) setSpeed(speed === 4 ? 2 : speed === 2 ? 1 : 0);
  if (pressed(7)) setSpeed(speed === 0 ? 1 : speed === 1 ? 2 : 4);
  if (pressed(9)) openPanel('menu');
}

// ---------- boucle ----------
function onResize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  post.setSize(innerWidth, innerHeight);
}
addEventListener('resize', onResize);
const timer = new THREE.Timer();
let t = 0, uiAcc = 0, saveAcc = 0;
function frame() {
  requestAnimationFrame(frame);
  timer.update();
  const dt = Math.min(timer.getDelta(), 1 / 20);
  step(dt);
  post.render(dt);
}
function step(dt: number) {
  t += dt;
  if (sim) {
    // clavier
    if (!modal) {
      const kx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('KeyQ') || keys.has('ArrowLeft') ? 1 : 0);
      const ky = (keys.has('KeyW') || keys.has('KeyZ') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      if (kx || ky) pan(-kx * 700 * dt, ky * 700 * dt);
      if (keys.has('KeyR')) cam.yaw += 1.5 * dt; if (keys.has('KeyT')) cam.yaw -= 1.5 * dt;
      if (keys.has('Equal') || keys.has('NumpadAdd')) zoom(1 - dt); if (keys.has('Minus') || keys.has('NumpadSubtract')) zoom(1 + dt);
    }
    pollPad(dt);
    if (!modal && speed > 0) {
      acc += dt * speed;
      while (acc >= HOUR) {
        acc -= HOUR; sim.tick(); flushNotes();
        if (sim.res.eau < 6 && !sim.has('source') && !sim.flags.hintEau) { sim.flags.hintEau = true; note('L\'eau va manquer', 'Construisez une Source captée (onglet Racines). Les tuyaux coûtent 5 métal.'); }
        if (sim.res.energie < 6 && !sim.flags.hintEnergie) { sim.flags.hintEnergie = true; note('L\'énergie baisse', 'Un deuxième Générateur (onglet Forgés) soulagera les Forgés.'); }
        if (sim.day === 5 && sim.hour === 9 && !sim.flags.hintNuit) { sim.flags.hintNuit = true; note('La longue nuit approche', 'Dans deux jours, le soleil ne se lèvera plus pendant trois jours : les jardins s\'arrêteront. Faites des réserves de nourriture et d\'énergie.', true); }
        if (sim.day >= 10 && sim.hour >= 20 && !sim.flags.bilan && !bilanShown) showBilan();
        checkCouncil();
      }
      saveAcc += dt; if (saveAcc > 20) { saveAcc = 0; save(); }
    }
    if (councilWait > 0 && !modal) { councilWait -= dt; if (councilWait <= 0) { if (pendingLater) { const k = pendingLater; pendingLater = null; runLater(k); } else if (pendingDecision) { pendingDecision = null; checkCouncil(true); } } }
    uiAcc += dt; if (uiAcc > 0.3) { uiAcc = 0; renderTop(); if (!placing) renderBuildCheap(); }
    const hour = sim.hour + (speed > 0 && !modal ? acc / HOUR : 0);
    placeCamera();
    world.setTime(hour, sim.time < sim.longNightUntil, t, cam.target);
    world.syncBuildings(sim, t);
    world.syncAgents(sim, dt, t, modal ? 0 : speed, { forges: 0, racines: emotion('racines') });
    r12.update(dt, t);
  } else {
    pollPad(dt);
    // écran d'accueil : la caméra tourne lentement au-dessus de la vallée
    cam.yaw += dt * 0.04; placeCamera();
    world.setTime(21, false, t, cam.target);
    r12.update(dt, t);
  }
}
let lastAfford = '';
function renderBuildCheap() { const k = RES_ORDER.map((r) => Math.floor(sim.res[r])).join(',') + sim.mutual().toFixed(0); if (k !== lastAfford) { lastAfford = k; renderBuild(); } }

// ---------- démarrage ----------
function begin(s: Sim, fresh: boolean) {
  sim = s;
  $('#start').hidden = true; $('#ui').hidden = false;
  bilanShown = !!sim.flags.bilan;
  setSpeed(1); renderTop(); renderBuild();
  if (fresh) {
    save();
    setTimeout(() => note('Faire vivre les deux peuples', 'Gardez la paix et les réserves jusqu\'au 10e jour. Le conseil se réunit aux jours 2, 4 et 6.'), 600);
    setTimeout(() => note('Astuce', 'Touchez un bâtiment pour le gérer. L\'abri des Forgés permet d\'en construire de nouveaux.'), 7000);
  }
}
async function newFoundation() {
  $('#start').hidden = true;
  await playSummary();
  begin(Sim.fresh(), true);
}
function resume() {
  try { const j = localStorage.getItem(SAVE); if (j) return begin(Sim.load(j), false); } catch { /* */ }
  newFoundation();
}
$('#btn-found').addEventListener('click', async () => { if (hasSave() && !(await ask('Une civilisation existe déjà. La remplacer par une nouvelle fondation ?', 'Remplacer'))) return; localStorage.removeItem(SAVE); newFoundation(); });
$('#btn-resume').addEventListener('click', resume);
($('#btn-resume')).hidden = !hasSave();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && sim) save(); });

async function boot() {
  onResize();
  await texturesReady();
  placeCamera();
  await renderer.compileAsync(scene, camera).catch(() => {});
  step(1 / 60); post.render(1 / 60);
  $('#loader').classList.add('done');
  frame();
  setTimeout(bootSucceeded, 4000);
  const h = location.hash;
  if (h === '#new') { history.replaceState(null, '', location.pathname); localStorage.removeItem(SAVE); newFoundation(); }
  else if (h === '#resume') { history.replaceState(null, '', location.pathname); resume(); }
}
(window as unknown as { __gov: unknown }).__gov = { get sim() { return sim; }, step, setSpeed, openPanel, tapAt, startPlacing, confirmPlacing, movePlacing, world, cam, runDecision, newFoundation: () => begin(Sim.fresh(), true) };
boot().catch((e) => { $('#loader .msg').textContent = 'Erreur : ' + e; console.error(e); });
