// Sauvegardes de l'acte 2 : 5 emplacements + une sauvegarde automatique, stockés sur l'appareil.
// Charger une sauvegarde recopie son contenu dans l'état courant, puis recharge la page.
import { ask } from '../ui/padnav';

export const CURRENT = 'dernier-signal:vallee';   // heure, jour, position de R-12
export const CIV = 'dernier-signal:civ';           // simulation de la civilisation
const SLOT = (i: number) => `dernier-signal:a2:slot${i}`;
const AUTO = 'dernier-signal:a2:auto';
export const SLOTS = 5;

export interface Act2Save {
  v: 1; savedAt: number; reason: string;
  hour: number; day: number;
  pos?: [number, number, number]; yaw?: number;
  civ: string | null;
}

export interface SaveSource { snapshot: () => Omit<Act2Save, 'v' | 'savedAt' | 'reason' | 'civ'> }

function get(key: string): Act2Save | null { try { const j = localStorage.getItem(key); return j ? JSON.parse(j) : null; } catch { return null; } }
function put(key: string, s: Act2Save) { try { localStorage.setItem(key, JSON.stringify(s)); return true; } catch { return false; } }

export function make(src: SaveSource, reason: string): Act2Save {
  let civ: string | null = null;
  try { civ = localStorage.getItem(CIV); } catch { /* */ }
  return { v: 1, savedAt: Date.now(), reason, civ, ...src.snapshot() };
}
export function saveTo(i: number, src: SaveSource) { return put(SLOT(i), make(src, 'manuelle')); }
/** Sauvegarde automatique (régulière, et à chaque grande décision). */
export function autosave(src: SaveSource, reason = 'régulière') { return put(AUTO, make(src, reason)); }
export function read(i: number | 'auto') { return get(i === 'auto' ? AUTO : SLOT(i)); }

/** Vrai pendant le chargement d'une sauvegarde (la page ne doit pas réécrire l'état en partant). */
export let loading = false;
/** Recopie une sauvegarde dans l'état courant, puis recharge le jeu. */
export function load(s: Act2Save) {
  loading = true;
  try {
    localStorage.setItem(CURRENT, JSON.stringify({ hour: s.hour, day: s.day, pos: s.pos, yaw: s.yaw }));
    if (s.civ) localStorage.setItem(CIV, s.civ); else localStorage.removeItem(CIV);
  } catch { /* */ }
  location.reload();
}

function describe(s: Act2Save | null) {
  if (!s) return '<em>Vide</em>';
  const hh = Math.floor(s.hour), mm = Math.floor((s.hour - hh) * 60);
  const d = new Date(s.savedAt);
  const when = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `<b>Jour ${s.day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</b><small>Enregistrée le ${when}</small>`;
}

/** Écran « Sauvegardes » (dans la pause et au QG). */
export class SavePanel {
  el: HTMLElement;
  onClose: () => void = () => {};
  constructor(private src: SaveSource) {
    this.el = document.createElement('div');
    this.el.id = 'vsaves'; this.el.hidden = true;
    document.body.appendChild(this.el);
  }
  get isOpen() { return !this.el.hidden; }
  open() { this.el.hidden = false; this.render(); }
  close() { this.el.hidden = true; this.onClose(); }
  render() {
    const rows: string[] = [];
    const a = read('auto');
    rows.push(`<div class="srow"><span class="sn">Auto</span><span class="si">${describe(a)}</span><span class="sb">${a ? '<button data-load="auto">Charger</button>' : ''}</span></div>`);
    for (let i = 1; i <= SLOTS; i++) {
      const s = read(i);
      rows.push(`<div class="srow"><span class="sn">${i}</span><span class="si">${describe(s)}</span><span class="sb"><button data-save="${i}">Sauvegarder</button>${s ? `<button data-load="${i}">Charger</button>` : ''}</span></div>`);
    }
    this.el.innerHTML = `<div class="sp"><h2>Sauvegardes</h2><p class="note">Stockées sur cet appareil. La sauvegarde automatique se fait toutes les 2 minutes et à chaque grande décision.</p>${rows.join('')}<button class="back pad-back">Retour</button></div>`;
    this.el.querySelector<HTMLElement>('.back')!.onclick = () => this.close();
    this.el.querySelectorAll<HTMLElement>('[data-save]').forEach((b) => b.onclick = async () => {
      const i = +b.dataset.save!;
      if (read(i) && !(await ask(`Remplacer la sauvegarde ${i} ?`, 'Remplacer'))) return;
      saveTo(i, this.src); this.render();
      const again = this.el.querySelector<HTMLElement>(`[data-save="${i}"]`); again?.classList.add('done');
    });
    this.el.querySelectorAll<HTMLElement>('[data-load]').forEach((b) => b.onclick = async () => {
      const k = b.dataset.load!;
      const s = read(k === 'auto' ? 'auto' : +k);
      if (!s) return;
      if (await ask('Charger cette sauvegarde ? La partie en cours non sauvegardée sera perdue.', 'Charger')) load(s);
    });
  }
}

// ---------- options de l'acte 2 ----------
export interface Act2Options { subs: 'petite' | 'moyenne' | 'grande'; voice: boolean; thoughts: boolean }
const OPT = 'dernier-signal:a2:options';
export function loadOptions(): Act2Options {
  const d: Act2Options = { subs: 'moyenne', voice: true, thoughts: true };
  try { return { ...d, ...JSON.parse(localStorage.getItem(OPT) ?? '{}') }; } catch { return d; }
}
export function saveOptions(o: Act2Options) { try { localStorage.setItem(OPT, JSON.stringify(o)); } catch { /* */ } }
export function applyOptions(o: Act2Options) {
  document.body.style.setProperty('--subs-scale', String({ petite: 0.85, moyenne: 1, grande: 1.3 }[o.subs]));
}
