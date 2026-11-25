// Navigation des menus à la manette (et aux flèches du clavier), commune à toutes les pages.
// Déplacement « spatial » : la croix ou le stick va vers le bouton le plus proche dans la
// direction choisie (grilles, onglets, listes). A valide, B revient, LB / RB changent
// d'onglet, le stick droit fait défiler les textes longs.

// ---------- lecture sûre de la manette ----------
// Selon l'endroit où tourne le jeu (application Claude, Safari, cadre d'une autre page), la lecture
// peut être refusée ou rester vide : on ne plante jamais, et on garde la raison pour l'afficher.
const seen = new Map<number, Gamepad>();
export const padState = { api: typeof navigator !== 'undefined' && 'getGamepads' in navigator, blocked: '', events: 0, name: '', buttons: 0, lastPress: '' };
if (typeof window !== 'undefined') {
  addEventListener('gamepadconnected', (e) => { const g = (e as GamepadEvent).gamepad; seen.set(g.index, g); padState.events++; padState.name = g.id; });
  addEventListener('gamepaddisconnected', (e) => { seen.delete((e as GamepadEvent).gamepad.index); });
}
let announced = false, warned = false;
/** Petit message en bas de l'écran (connexion de la manette). */
function badge(text: string, ms = 3500) {
  injectStyle();
  let b = document.getElementById('padbadge');
  if (!b) { b = document.createElement('div'); b.id = 'padbadge'; document.body.appendChild(b); }
  b.textContent = text; b.classList.add('show');
  clearTimeout((b as unknown as { _t: number })._t);
  (b as unknown as { _t: number })._t = window.setTimeout(() => b!.classList.remove('show'), ms);
}
/** Affiche l'état de la manette dans un élément, tant qu'il est à l'écran. */
export function bindPadStatus(el: HTMLElement) {
  const tick = () => { if (el.getClientRects().length) el.textContent = padStatus(); };
  setInterval(tick, 400); tick();
}
/** La première manette branchée, ou null. */
export function readPad(): Gamepad | null {
  let list: (Gamepad | null)[] = [];
  try { list = padState.api ? [...navigator.getGamepads()] : []; padState.blocked = ''; }
  catch (e) { padState.blocked = (e as Error).name || 'refus'; }
  let gp = list.find((p) => p && p.connected) ?? null;
  if (!gp && padState.blocked) gp = [...seen.values()].find((p) => p.connected) ?? null; // repli : objet reçu à la connexion
  if (gp && !announced) { announced = true; badge('🎮 Manette détectée : ' + gp.id.slice(0, 40)); }
  if (!gp && padState.blocked && !warned) { warned = true; badge('🎮 La page qui affiche le jeu refuse l’accès à la manette (' + padState.blocked + ')', 7000); }
  if (gp) {
    padState.name = gp.id; padState.buttons = gp.buttons.length;
    const i = gp.buttons.findIndex((b) => b.pressed);
    if (i >= 0) padState.lastPress = 'bouton ' + i;
  }
  return gp;
}
/** Texte lisible sur l'état de la manette (pour les menus). */
export function padStatus(): string {
  if (!padState.api) return 'Manette : ce navigateur ne donne pas accès aux manettes.';
  const gp = readPad();
  if (padState.blocked && !gp) return `Manette : accès refusé par la page qui affiche le jeu (${padState.blocked}).`;
  if (!gp) return padState.events ? 'Manette : connectée puis perdue. Appuie sur un bouton.' : 'Manette : rien de détecté. Appuie sur un bouton de la manette (A ou ✕).';
  return `Manette détectée : ${gp.id.slice(0, 48)} · ${gp.buttons.length} boutons${padState.lastPress ? ' · dernier appui : ' + padState.lastPress : ''}`;
}

export type NavDir = 'up' | 'down' | 'left' | 'right';
export type NavEvent = NavDir | 'ok' | 'back' | 'prev' | 'next';

const SEL = 'button:not([disabled]), a[href], input:not([disabled]):not([type=hidden]), select:not([disabled]), [data-pad]';

let styled = false;
function injectStyle() {
  if (styled) return; styled = true;
  const s = document.createElement('style');
  s.textContent = `
  body.padnav .pad-focus { outline: 3px solid #ffd36a !important; outline-offset: 3px; box-shadow: 0 0 0 6px rgba(255,211,106,.22), 0 0 18px rgba(255,211,106,.35) !important; }
  #padbadge { position: fixed; left: 50%; bottom: max(18px, env(safe-area-inset-bottom)); transform: translate(-50%, 20px); z-index: 10000; padding: 9px 16px; border-radius: 10px; background: rgba(6,14,22,.9); border: 1px solid rgba(255,211,106,.6); color: #ffe9b0; font: 600 15px Barlow, system-ui, sans-serif; opacity: 0; pointer-events: none; transition: .35s; max-width: calc(100vw - 32px); text-align: center; }
  #padbadge.show { opacity: 1; transform: translate(-50%, 0); }
  .padstatus { margin: 12px 0 0; font: 14px/1.4 Barlow, system-ui, sans-serif; color: #ffd36a; }
  .askbox { position: fixed; inset: 0; z-index: 9999; display: none; align-items: center; justify-content: center; background: rgba(2,6,10,.62); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
  .askbox.show { display: flex; }
  .askbox .in { max-width: min(480px, calc(100vw - 32px)); padding: 24px 26px; border: 1px solid rgba(140,220,255,.45); border-radius: 14px; background: rgba(6,14,22,.94); color: #e8f4fa; font: 17px/1.45 Barlow, system-ui, sans-serif; text-align: center; }
  .askbox p { margin: 0 0 18px; }
  .askbox .row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  .askbox button { min-width: 130px; padding: 11px 18px; border-radius: 10px; border: 1px solid rgba(140,220,255,.5); background: rgba(95,214,255,.12); color: inherit; font: 600 17px "Barlow Condensed", sans-serif; letter-spacing: .05em; text-transform: uppercase; cursor: pointer; }
  .askbox button.yes { background: rgba(255,120,90,.2); border-color: rgba(255,150,120,.7); }
  `;
  document.head.appendChild(s);
}

function visible(el: HTMLElement) {
  if (!el.getClientRects().length) return false;
  if (el.closest('[hidden], #touch')) return false;
  const cs = getComputedStyle(el);
  // les menus fermés en fondu restent dans la page, mais ne reçoivent plus le doigt
  if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') return false;
  // panneau effacé (transparent) : ses boutons ne comptent pas
  for (let e: HTMLElement | null = el; e && e !== document.body; e = e.parentElement) if (+getComputedStyle(e).opacity < 0.05) return false;
  return true;
}

export interface PadNavOptions {
  /** Le conteneur actif (menu ouvert), ou null quand aucun menu n'est ouvert. */
  root: () => HTMLElement | null;
  /** Retour (B / Échap). Par défaut : clique le bouton Fermer / Retour du menu. */
  back?: (root: HTMLElement) => void;
  sound?: (k: 'move' | 'ok' | 'back') => void;
  /** Classe ajoutée à l'élément sélectionné (en plus de pad-focus). */
  focusClass?: string;
}

export class PadNav {
  current: HTMLElement | null = null;
  private lastRoot: HTMLElement | null = null;
  constructor(private o: PadNavOptions) { injectStyle(); }

  items(root = this.o.root()) {
    if (!root) return [];
    return [...root.querySelectorAll<HTMLElement>(SEL)].filter(visible);
  }

  /** À appeler à chaque image : garde une sélection valide quand le menu change. */
  refresh() {
    const root = this.o.root();
    if (root !== this.lastRoot) { this.lastRoot = root; this.set(null); }
    if (!root) return;
    if (this.current && root.contains(this.current) && visible(this.current)) { this.key = keyOf(this.current); return; }
    // contenu redessiné (onglet, bouton cliqué) : on retrouve le même bouton s'il existe encore
    const same = this.key ? this.items(root).find((e) => keyOf(e) === this.key) : undefined;
    this.current = null;
    this.set(same ?? this.first(root));
  }
  private key = '';
  private label: HTMLElement | null = null;

  /** Sélectionne le premier élément du menu (après un changement de contenu). */
  reset() { const r = this.o.root(); this.set(r ? this.first(r) : null); }

  private first(root: HTMLElement) {
    const it = this.items(root);
    return it.find((e) => e.classList.contains('pad-first')) ?? it.find((e) => !e.matches('.tabs button, .tab, .close, .hx, .back')) ?? it[0] ?? null;
  }

  set(el: HTMLElement | null) {
    if (this.current === el) return;
    this.label?.classList.remove('pad-focus'); this.label = null;
    if (this.current) { this.current.classList.remove('pad-focus'); if (this.o.focusClass) this.current.classList.remove(this.o.focusClass); }
    this.current = el;
    this.key = el ? keyOf(el) : '';
    if (el) {
      el.classList.add('pad-focus'); if (this.o.focusClass) el.classList.add(this.o.focusClass);
      this.label = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.closest('label') : null; this.label?.classList.add('pad-focus');
      el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
  }

  handle(e: NavEvent) {
    const root = this.o.root();
    if (!root) return;
    this.refresh();
    if (e === 'back') { this.o.sound?.('back'); (this.o.back ?? defaultBack)(root); return; }
    if (e === 'ok') { this.ok(); return; }
    if (e === 'prev' || e === 'next') { this.tab(root, e === 'next' ? 1 : -1); return; }
    if (this.adjust(e)) return;
    const next = pick(this.items(root), this.current, e);
    if (next && next !== this.current) { this.set(next); this.o.sound?.('move'); }
  }

  private ok() {
    const el = this.current;
    if (!el) return;
    this.o.sound?.('ok');
    if (el instanceof HTMLSelectElement) { stepSelect(el, 1, true); return; }
    if (el instanceof HTMLInputElement && el.type === 'range') return;
    el.click();
  }

  /** Curseurs et listes déroulantes : gauche / droite changent la valeur. */
  private adjust(d: NavDir) {
    const el = this.current;
    if (d !== 'left' && d !== 'right') return false;
    const k = d === 'right' ? 1 : -1;
    if (el instanceof HTMLInputElement && el.type === 'range') {
      const st = +el.step || 1, v = Math.min(+el.max, Math.max(+el.min, +el.value + k * st));
      // en butée, la croix passe au réglage voisin (grilles d'options à deux colonnes)
      if (v === +el.value) return false;
      el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      this.o.sound?.('move');
      return true;
    }
    if (el instanceof HTMLSelectElement) { if (!stepSelect(el, k, false)) return false; this.o.sound?.('move'); return true; }
    return false;
  }

  private tab(root: HTMLElement, k: number) {
    const tabs = [...root.querySelectorAll<HTMLElement>('.tabs button, button.tab')].filter(visible);
    if (tabs.length < 2) return;
    let i = tabs.findIndex((t) => t.classList.contains('on'));
    if (i < 0) i = 0;
    const t = tabs[(i + k + tabs.length) % tabs.length];
    t.click(); this.o.sound?.('move');
    requestAnimationFrame(() => this.reset());
  }

  /** Défilement d'un texte long (stick droit). */
  scroll(dy: number) {
    const root = this.o.root();
    if (!root || !dy) return;
    let el: HTMLElement | null = this.current ?? root;
    while (el && el !== root.parentElement) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) { el.scrollTop += dy; return; }
      el = el.parentElement;
    }
    const inner = [...root.querySelectorAll<HTMLElement>('*')].find((e) => e.scrollHeight > e.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
    (inner ?? root).scrollTop += dy;
  }
}

/** Zone occupée à l'écran : une case à cocher compte avec son libellé. */
function box(el: HTMLElement) {
  const l = el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio') ? el.closest('label') : null;
  return (l ?? el).getBoundingClientRect();
}

function keyOf(e: HTMLElement) {
  return e.tagName + '|' + e.id + '|' + JSON.stringify(e.dataset) + '|' + (e.textContent ?? '').trim().slice(0, 40);
}

function defaultBack(root: HTMLElement) {
  const b = [...root.querySelectorAll<HTMLElement>('[data-pad-back], .back, .close, .hx, .no, .cancel, .skip')].find(visible);
  b?.click();
}

function stepSelect(s: HTMLSelectElement, k: number, wrap: boolean) {
  const n = s.options.length;
  let i = s.selectedIndex + k;
  if (wrap) i = (i + n) % n; else i = Math.max(0, Math.min(n - 1, i));
  if (i === s.selectedIndex) return false;
  s.selectedIndex = i; s.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

/** L'élément le plus proche dans une direction (avec retour au début en bout de liste). */
function pick(items: HTMLElement[], cur: HTMLElement | null, d: NavDir): HTMLElement | null {
  if (!items.length) return null;
  if (!cur || !items.includes(cur)) return items[0];
  const a = box(cur);
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  const vert = d === 'up' || d === 'down', sgn = d === 'down' || d === 'right' ? 1 : -1;
  let best: HTMLElement | null = null, bs = Infinity;
  for (const el of items) {
    if (el === cur) continue;
    const b = box(el);
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const main = (vert ? by - ay : bx - ax) * sgn;
    if (main < 4) continue;
    // écart latéral : nul si les deux boutons se chevauchent sur l'autre axe
    const lo = vert ? Math.max(a.left, b.left) : Math.max(a.top, b.top), hi = vert ? Math.min(a.right, b.right) : Math.min(a.bottom, b.bottom);
    const side = hi > lo ? 0 : Math.abs(vert ? bx - ax : by - ay);
    const sc = main + side * 2.5;
    if (sc < bs) { bs = sc; best = el; }
  }
  if (best) return best;
  // bout de liste : on repart de l'autre côté (verticalement seulement)
  if (!vert) return null;
  let far: HTMLElement | null = null, fs = -Infinity;
  for (const el of items) {
    const b = box(el);
    const main = ((b.top + b.height / 2) - ay) * -sgn, side = Math.abs(b.left + b.width / 2 - ax);
    const sc = main - side * 2.5;
    if (sc > fs) { fs = sc; far = el; }
  }
  return far;
}

/** Lecture simple de la manette pour les pages sans moteur de commandes (atelier, gestion). */
export class PadReader {
  private prev: boolean[] = [];
  private cool = 0;
  private dir: NavDir | null = null;
  active = false;
  gp: Gamepad | null = null;
  /** Appelé pour les événements de menu ; renvoie la liste des boutons pressés à cette image. */
  read(dt: number, nav?: (e: NavEvent) => void) {
    const gp = readPad();
    this.gp = gp;
    const down = new Set<number>();
    if (!gp) return { down, ax: [0, 0, 0, 0] };
    const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
    const ax = [0, 1, 2, 3].map((i) => dz(gp.axes[i] ?? 0));
    gp.buttons.forEach((b, i) => { if (b.pressed && !this.prev[i]) down.add(i); });
    if (down.size || ax.some((v) => v)) { this.active = true; document.body.classList.add('padnav'); }
    if (nav) {
      if (down.has(0)) nav('ok');
      if (down.has(1)) nav('back');
      if (down.has(4)) nav('prev');
      if (down.has(5)) nav('next');
      const b = (i: number) => !!gp.buttons[i]?.pressed;
      const dirs: [boolean, NavDir][] = [[b(12) || ax[1] < -0.55, 'up'], [b(13) || ax[1] > 0.55, 'down'], [b(14) || ax[0] < -0.55, 'left'], [b(15) || ax[0] > 0.55, 'right']];
      const d = dirs.find(([v]) => v)?.[1] ?? null;
      this.cool -= dt;
      if (d !== this.dir) { this.dir = d; if (d) { nav(d); this.cool = 0.38; } }
      else if (d && this.cool <= 0) { nav(d); this.cool = 0.13; }
    }
    this.prev = gp.buttons.map((x) => x.pressed);
    return { down, ax };
  }
}

/** Le pointeur ou le doigt cache la sélection de manette. */
export function hidePadFocusOnPointer() {
  addEventListener('pointerdown', () => document.body.classList.remove('padnav'), true);
}

// ---------- boîte de confirmation utilisable à la manette (remplace confirm()) ----------
let askEl: HTMLElement | null = null;
let askDone: ((v: boolean) => void) | null = null;
export function askOpen() { return !!askEl?.classList.contains('show'); }
export function askRoot() { return askOpen() ? askEl : null; }
export function askCancel() { askDone?.(false); }
export function ask(text: string, yes = 'Oui', no = 'Annuler', hooks: { open?: () => void; close?: () => void } = {}): Promise<boolean> {
  injectStyle();
  if (!askEl) {
    askEl = document.createElement('div'); askEl.id = 'ask'; askEl.className = 'askbox';
    askEl.innerHTML = '<div class="in"><p></p><div class="row"><button class="f no pad-first"></button><button class="f yes"></button></div></div>';
    document.body.appendChild(askEl);
  }
  const el = askEl;
  el.querySelector('p')!.textContent = text;
  el.querySelector<HTMLElement>('.yes')!.textContent = yes;
  el.querySelector<HTMLElement>('.no')!.textContent = no;
  askDone?.(false);
  el.classList.add('show');
  hooks.open?.();
  return new Promise((res) => {
    const done = (v: boolean) => { if (askDone !== done) return; askDone = null; el.classList.remove('show'); hooks.close?.(); res(v); };
    askDone = done;
    el.querySelector<HTMLElement>('.yes')!.onclick = () => done(true);
    el.querySelector<HTMLElement>('.no')!.onclick = () => done(false);
  });
}
