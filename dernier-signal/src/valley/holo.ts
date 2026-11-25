// Écran holographique de gouverneur, projeté au-dessus de la console du cockpit.
// Version 3D (toujours visible, animée) + panneau interactif quand R-12 l'utilise.
import * as THREE from 'three';
import { U } from './atmosphere';
import { Sim } from '../gov/sim';
import { GROUPS, RES, RES_ORDER, DECISIONS, type GroupId } from '../gov/content';

const CIV = 'dernier-signal:civ';
export const ERAS = ['Survie', 'Fondation', 'Expansion', 'Unité ou rupture'];
export const OBJECTIVES = [
  { t: 'Gagner la confiance du Clan des Racines', s: 'Les Vaëls observent la capsule depuis l\'orée de la forêt.' },
  { t: 'Remettre l\'atelier de la soute en état', s: 'Pour construire les premiers Forgés.' },
  { t: 'Explorer la plaine de la balise', s: 'Les ruines s\'éclairent quand R-12 passe.' },
];

export function loadCiv() {
  try { const j = localStorage.getItem(CIV); if (j) return Sim.load(j); } catch { /* */ }
  return Sim.fresh();
}

export class Holo3D extends THREE.Group {
  private tex: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private mat: THREE.ShaderMaterial;
  private rings: THREE.Mesh[] = [];
  open = 0;
  constructor(private sim: Sim) {
    super();
    const c = document.createElement('canvas'); c.width = 1024; c.height = 620;
    this.ctx = c.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: this.tex }, uTime: U.uTime, uOpen: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */ `
        uniform sampler2D map; uniform float uTime, uOpen; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        float h(float x){ return fract(sin(x * 91.7) * 43758.5); }
        void main(){
          vec2 uv = vUv;
          uv.x += (h(floor(uv.y * 60.0) + floor(uTime * 12.0)) - 0.5) * 0.004 * step(0.92, h(floor(uTime * 3.0)));
          vec4 c = texture2D(map, uv);
          float scan = 0.82 + 0.18 * sin(uv.y * 620.0 - uTime * 6.0);
          float sweep = smoothstep(0.03, 0.0, abs(fract(uTime * 0.25) - uv.y)) * 0.6;
          float edge = smoothstep(0.0, 0.03, uv.x) * smoothstep(1.0, 0.97, uv.x) * smoothstep(0.0, 0.04, uv.y) * smoothstep(1.0, 0.96, uv.y);
          float reveal = smoothstep(uOpen * 1.15, uOpen * 1.15 - 0.15, 1.0 - uv.y);
          float flick = 0.9 + 0.1 * sin(uTime * 37.0) * sin(uTime * 5.3);
          vec3 col = (c.rgb * 1.6 + vec3(0.15, 0.7, 0.85) * (0.05 + sweep * c.a)) * scan * flick;
          float a = (c.a * 0.95 + 0.06) * edge * reveal;
          gl_FragColor = vec4(col * a * 2.2, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    // écran légèrement courbe
    const g = new THREE.PlaneGeometry(1.9, 1.15, 24, 1);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, -x * x * 0.12); }
    g.computeVertexNormals();
    const panel = new THREE.Mesh(g, this.mat); panel.position.y = 0.1; panel.renderOrder = 5; this.add(panel);
    // faisceau du projecteur
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.32, 1.0, 32, 1, true), new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uTime; varying vec2 vUv; void main(){ float a = (1.0 - vUv.y) * 0.18 + 0.03; a *= 0.7 + 0.3 * sin(vUv.x * 60.0 + uTime * 2.0); gl_FragColor = vec4(vec3(0.2, 0.85, 1.0) * a, 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    beam.position.y = -0.55; this.add(beam);
    for (let k = 0; k < 3; k++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.5 + k * 0.12, 0.006, 4, 64, Math.PI * (1.2 + k * 0.3)), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 2.0), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      r.rotation.x = Math.PI / 2; r.position.y = -0.95 + k * 0.05; this.add(r); this.rings.push(r);
    }
  }
  /** Redessine l'écran (4 fois par seconde suffit). */
  draw(t: number, hour: number, day: number) {
    const g = this.ctx, s = this.sim, W = 1024, H = 620;
    g.clearRect(0, 0, W, H);
    g.strokeStyle = 'rgba(120,230,255,0.9)'; g.lineWidth = 3; g.strokeRect(6, 6, W - 12, H - 12);
    g.fillStyle = 'rgba(120,230,255,1)'; g.font = '600 34px "Barlow Condensed", sans-serif';
    g.fillText('R-12 · GOUVERNEUR', 30, 52);
    g.textAlign = 'right'; g.fillText(`JOUR ${day} · ${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`, W - 30, 52); g.textAlign = 'left';
    g.font = '500 24px "Barlow Condensed", sans-serif'; g.fillStyle = 'rgba(160,240,255,0.8)';
    g.fillText(`ÈRE 1 · ${ERAS[0].toUpperCase()}`, 30, 88);
    // ressources : barres animées
    RES_ORDER.forEach((r, i) => {
      const y = 130 + i * 52, v = s.res[r], w = Math.min(1, v / 120) * 330;
      g.fillStyle = 'rgba(120,230,255,0.25)'; g.fillRect(150, y - 18, 330, 20);
      g.fillStyle = s.shortage[r] ? 'rgba(255,120,90,1)' : 'rgba(120,230,255,1)'; g.fillRect(150, y - 18, w * (0.97 + 0.03 * Math.sin(t * 3 + i)), 20);
      g.font = '500 24px "Barlow Condensed", sans-serif'; g.fillText(RES[r].label, 30, y); g.textAlign = 'right'; g.fillText(String(Math.floor(v)), 540, y); g.textAlign = 'left';
    });
    // relations : deux groupes reliés
    const cx = 760, cy = 230;
    const nodes: [GroupId, number, number][] = [['forges', cx - 120, cy], ['racines', cx + 120, cy]];
    const trust = s.mutual() / 100;
    g.strokeStyle = `rgba(${trust > 0.5 ? '120,255,180' : '255,180,90'},0.9)`; g.lineWidth = 2 + trust * 8; g.setLineDash([14, 10]); g.lineDashOffset = -t * 30;
    g.beginPath(); g.moveTo(nodes[0][1], cy); g.lineTo(nodes[1][1], cy); g.stroke(); g.setLineDash([]);
    for (const [id, x, y] of nodes) {
      g.strokeStyle = GROUPS[id].color; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 46 + Math.sin(t * 2 + x) * 2, 0, Math.PI * 2); g.stroke();
      g.fillStyle = GROUPS[id].color; g.textAlign = 'center'; g.font = '600 24px "Barlow Condensed", sans-serif'; g.fillText(GROUPS[id].short.toUpperCase(), x, y + 8);
      g.font = '500 20px "Barlow Condensed", sans-serif'; g.fillText(`loyauté ${Math.round(s.loyal[id])}`, x, y + 76); g.textAlign = 'left';
    }
    g.fillStyle = 'rgba(160,240,255,0.85)'; g.font = '500 22px "Barlow Condensed", sans-serif'; g.textAlign = 'center';
    g.fillText(`CONFIANCE ${Math.round(s.mutual())} · PAIX ${Math.round(s.paix)} · TENSION ${Math.round(s.tension)}`, cx, cy + 128); g.textAlign = 'left';
    // objectif
    g.strokeStyle = 'rgba(255,211,106,0.9)'; g.lineWidth = 2; g.strokeRect(600, 420, 390, 150);
    g.fillStyle = 'rgba(255,211,106,1)'; g.font = '600 22px "Barlow Condensed", sans-serif'; g.fillText('OBJECTIF', 620, 452);
    g.fillStyle = 'rgba(255,230,170,1)'; g.font = '500 24px "Barlow Condensed", sans-serif';
    wrap(g, OBJECTIVES[0].t, 620, 490, 350, 28);
    g.fillStyle = 'rgba(160,240,255,0.7)'; g.font = '500 20px "Barlow Condensed", sans-serif'; g.fillText('Interagir pour ouvrir', 30, 590);
    this.tex.needsUpdate = true;
  }
  update(dt: number, t: number, near: boolean) {
    this.open += ((near ? 1 : 0.55) - this.open) * Math.min(1, dt * 2.5);
    this.mat.uniforms.uOpen.value = this.open;
    this.rings.forEach((r, i) => (r.rotation.z = t * (0.4 + i * 0.25) * (i % 2 ? -1 : 1)));
    this.children[0].position.y = 0.1 + Math.sin(t * 1.2) * 0.015;
  }
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, lh: number) {
  const words = text.split(' '); let line = '';
  for (const wd of words) { const t2 = line ? line + ' ' + wd : wd; if (g.measureText(t2).width > w && line) { g.fillText(line, x, y); y += lh; line = wd; } else line = t2; }
  if (line) g.fillText(line, x, y);
}

/** Panneau interactif (même contenu, lisible au doigt). */
export class HoloPanel {
  el: HTMLElement;
  private tab = 'res';
  onClose: () => void = () => {};
  constructor(private sim: Sim, private time: { get: () => { hour: number; day: number; speed: number }; setSpeed: (s: number) => void; skip: (h: number) => void }) {
    this.el = document.createElement('div'); this.el.id = 'holo'; this.el.hidden = true;
    this.el.innerHTML = `<div class="hp"><div class="hh"><b>R-12 · GOUVERNEUR</b><span class="ht"></span><button class="hx" aria-label="Fermer">✕</button></div>
      <div class="tabs">${[['res', 'Ressources'], ['rel', 'Relations'], ['pop', 'Habitants'], ['obj', 'Objectifs'], ['time', 'Temps'], ['cons', 'Conseil']].map(([k, l]) => `<button data-t="${k}">${l}</button>`).join('')}</div>
      <div class="hb"></div><div class="scan"></div></div>`;
    document.body.appendChild(this.el);
    this.el.querySelector('.hx')!.addEventListener('click', () => this.close());
    this.el.querySelectorAll<HTMLElement>('.tabs button').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.t!; this.render(); }));
  }
  get isOpen() { return !this.el.hidden; }
  open() { this.el.hidden = false; this.el.classList.remove('in'); void this.el.offsetWidth; this.el.classList.add('in'); this.render(); }
  close() { this.el.hidden = true; this.onClose(); }
  render() {
    const s = this.sim, T = this.time.get();
    this.el.querySelectorAll<HTMLElement>('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === this.tab));
    this.el.querySelector('.ht')!.textContent = `Jour ${T.day} · ${String(Math.floor(T.hour)).padStart(2, '0')}:${String(Math.floor((T.hour % 1) * 60)).padStart(2, '0')} · Ère 1 · ${ERAS[0]}`;
    const bar = (v: number, col = '#7ae6ff') => `<i class="bar"><b style="width:${Math.max(0, Math.min(100, v))}%;background:${col}"></b></i>`;
    let h = '';
    if (this.tab === 'res') h = RES_ORDER.map((r, i) => `<div class="row" style="--d:${i}"><span>${RES[r].icon} ${RES[r].label}</span>${bar(Math.min(100, s.res[r] / 1.2), s.shortage[r] ? '#ff8a6a' : undefined)}<em>${Math.floor(s.res[r])}</em></div>`).join('');
    else if (this.tab === 'rel') h = (['forges', 'racines'] as GroupId[]).map((g, i) => { const o: GroupId = g === 'forges' ? 'racines' : 'forges'; const r = s.rel[g]; return `<div class="card" style="--d:${i}"><b style="color:${GROUPS[g].color}">${GROUPS[g].short} → ${GROUPS[o].short}</b><div class="row"><span>Confiance</span>${bar(r.confiance, '#7dffb0')}<em>${Math.round(r.confiance)}</em></div><div class="row"><span>Peur</span>${bar(r.peur, '#b08cff')}<em>${Math.round(r.peur)}</em></div><div class="row"><span>Rancune</span>${bar(r.rancune, '#ff7a5a')}<em>${Math.round(r.rancune)}</em></div><div class="row"><span>Dette</span>${bar(r.dette, '#ffd36a')}<em>${Math.round(r.dette)}</em></div><div class="row"><span>Loyauté envers R-12</span>${bar(s.loyal[g], GROUPS[g].color)}<em>${Math.round(s.loyal[g])}</em></div></div>`; }).join('') + `<div class="row" style="--d:2"><span>Paix</span>${bar(s.paix, '#7ae6ff')}<em>${Math.round(s.paix)}</em></div><div class="row" style="--d:3"><span>Tension</span>${bar(s.tension, '#ff8a5a')}<em>${Math.round(s.tension)}</em></div>`;
    else if (this.tab === 'pop') h = (['racines', 'forges'] as GroupId[]).map((g, i) => { const L = GROUPS[g].leader; const ppl = s.citizens.filter((c) => c.group === g).map((c) => c.name).join(', '); return `<div class="card" style="--d:${i}"><b style="color:${GROUPS[g].color}">${GROUPS[g].name}</b><p><strong>${L.name}</strong>, ${L.title.toLowerCase()}. ${L.trait}</p><p><em>Objectif</em> ${L.goal}</p><p><em>Limite</em> ${L.limit}</p><p><em>Habitants</em> ${ppl || '—'}</p></div>`; }).join('');
    else if (this.tab === 'obj') h = `<div class="card" style="--d:0"><b>Ère 1 · ${ERAS[0]}</b><p>Feux, abris de fortune, méfiance. La capsule est le seul abri solide de la vallée.</p></div>` + OBJECTIVES.map((o, i) => `<div class="card obj" style="--d:${i + 1}"><b>◆ ${o.t}</b><p>${o.s}</p></div>`).join('');
    else if (this.tab === 'time') h = `<div class="card" style="--d:0"><b>Vitesse du temps</b><div class="btns">${[[0, '❚❚ Pause'], [1, '×1'], [2, '×2'], [4, '×4']].map(([v, l]) => `<button data-s="${v}" class="${T.speed === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="card" style="--d:1"><b>Avancer</b><div class="btns"><button data-k="1">+1 heure</button><button data-k="6">+6 heures</button><button data-k="m">Jusqu'au matin</button></div><p>La recharge complète (salle de recharge) arrivera à l'étape suivante.</p></div>`;
    else if (this.tab === 'cons') { const n = DECISIONS.find((d) => !s.decisions[d.id]); h = `<div class="card" style="--d:0"><b>Conseil</b><p>${n ? `Question en attente : « ${n.title} ».` : 'Aucune question en attente.'}</p><p>Les chefs ne vivent pas encore dans la vallée : le conseil pourra être convoqué ici, devant la capsule, quand les habitants arriveront (étape suivante).</p><button class="wide" disabled>Convoquer le conseil</button></div>`; }
    const hb = this.el.querySelector('.hb')!; hb.innerHTML = h;
    hb.querySelectorAll<HTMLElement>('[data-s]').forEach((b) => b.addEventListener('click', () => { this.time.setSpeed(+b.dataset.s!); this.render(); }));
    hb.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.k!; const cur = this.time.get().hour; this.time.skip(k === 'm' ? ((7 - cur + 24) % 24 || 24) : +k); this.render(); }));
  }
}
