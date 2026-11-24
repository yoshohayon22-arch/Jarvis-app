import * as THREE from 'three';
import type { Device } from '../game/input';

// Interface en jeu : zone + objectif, marqueur en losange avec distance, jauge du jetpack,
// invite d'interaction, sous-titres, notifications, étiquettes de scan.

const ICONS: Record<Device, Record<string, string>> = {
  keyboard: { interact: 'E', jump: 'Espace', scan: 'F', pause: 'Échap', lamp: 'L' },
  gamepad: { interact: 'B / ○', jump: 'A / ✕', scan: 'X / □', pause: 'Start', lamp: 'Y / △' },
  touch: { interact: 'Interagir', jump: 'Saut', scan: 'Scan', pause: '❚❚', lamp: 'Lampe' },
};

export class Hud {
  device: Device = 'keyboard';
  private $ = (s: string) => document.querySelector(s) as HTMLElement;
  private marker = this.$('#marker');
  private markerDist = this.$('#marker .dist');
  private gauge = this.$('#gauge');
  private gaugeArc = this.$('#gauge .arc') as unknown as SVGCircleElement;
  private prompt = this.$('#prompt');
  private subs = this.$('#subs');
  private toastEl = this.$('#toast');
  private labels = this.$('#labels');
  private scanLabels: { el: HTMLElement; pos: THREE.Vector3; until: number }[] = [];
  private toastT = 0;

  setZone(name: string, room: string) {
    this.$('#zone .name').textContent = name;
    this.$('#zone .room').textContent = room;
  }
  setObjective(text: string) {
    const o = this.$('#objective');
    o.classList.remove('new'); void o.offsetWidth; o.classList.add('new');
    this.$('#objective .txt').textContent = text;
  }
  icon(action: string) { return ICONS[this.device][action] ?? action; }

  setPrompt(label: string | null, verb = '') {
    if (!label) { this.prompt.classList.remove('show'); return; }
    this.prompt.innerHTML = `<span class="key">${this.icon('interact')}</span><span><b>${verb}</b><small>${label}</small></span>`;
    this.prompt.classList.add('show');
  }

  subtitle(speaker: string | null, text = '') {
    if (!speaker) { this.subs.classList.remove('show'); return; }
    this.subs.innerHTML = `<b>${speaker}</b>${text}`;
    this.subs.classList.add('show');
  }

  toast(title: string, sub = '') {
    this.toastEl.innerHTML = `<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}`;
    this.toastEl.classList.add('show');
    this.toastT = 4.2;
  }

  scanLabel(text: string, pos: THREE.Vector3, found: boolean) {
    const el = document.createElement('div');
    el.className = 'slabel' + (found ? ' found' : '');
    el.innerHTML = `<i></i><span>${text}</span>`;
    this.labels.appendChild(el);
    this.scanLabels.push({ el, pos: pos.clone(), until: performance.now() + 6500 });
  }

  update(dt: number, cam: THREE.PerspectiveCamera, objective: THREE.Vector3 | null, player: THREE.Vector3, jet: { has: boolean; energy: number; active: boolean }, robotHead: THREE.Vector3) {
    const w = window.innerWidth, h = window.innerHeight;
    // marqueur d'objectif
    if (objective) {
      const p = objective.clone().project(cam);
      const behind = p.z > 1;
      let x = (p.x * 0.5 + 0.5) * w, y = (-p.y * 0.5 + 0.5) * h;
      if (behind) { x = w - x; y = h - 40; }
      const m = 46;
      const off = x < m || x > w - m || y < m || y > h - m || behind;
      x = Math.max(m, Math.min(w - m, x)); y = Math.max(m + 40, Math.min(h - m - 70, y));
      this.marker.style.transform = `translate(${x}px, ${y}px)`;
      this.marker.classList.toggle('edge', off);
      this.markerDist.textContent = `${Math.round(objective.distanceTo(player))} m`;
      this.marker.classList.add('show');
    } else this.marker.classList.remove('show');
    // jauge jetpack près du robot
    const showG = jet.has && (jet.energy < 0.999 || jet.active);
    this.gauge.classList.toggle('show', showG);
    if (showG) {
      const p = robotHead.clone().project(cam);
      this.gauge.style.transform = `translate(${(p.x * 0.5 + 0.5) * w + 46}px, ${(-p.y * 0.5 + 0.5) * h - 10}px)`;
      const C = 2 * Math.PI * 16;
      this.gaugeArc.style.strokeDasharray = `${C * jet.energy} ${C}`;
      this.gauge.classList.toggle('low', jet.energy < 0.25);
    }
    // étiquettes de scan
    const now = performance.now();
    this.scanLabels = this.scanLabels.filter((s) => {
      if (now > s.until) { s.el.remove(); return false; }
      const p = s.pos.clone().project(cam);
      const vis = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
      s.el.style.opacity = vis ? String(Math.min(1, (s.until - now) / 800)) : '0';
      s.el.style.transform = `translate(${(p.x * 0.5 + 0.5) * w}px, ${(-p.y * 0.5 + 0.5) * h}px)`;
      return true;
    });
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toastEl.classList.remove('show'); }
  }
}
