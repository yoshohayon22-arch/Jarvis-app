import * as THREE from 'three';
import { readPad, type NavEvent, type NavDir } from '../ui/padnav';

// Commandes unifiées : clavier + souris, manette (Xbox / PlayStation), écran tactile.
// Le dernier mode utilisé détermine les icônes d'aide affichées.

export type Device = 'keyboard' | 'gamepad' | 'touch';
type Btn = 'jump' | 'interact' | 'scan' | 'pause' | 'up' | 'down' | 'map' | 'lamp';

export class Input {
  move = new THREE.Vector2();      // x : droite, y : avant
  look = new THREE.Vector2();      // radians à appliquer ce frame (x : lacet, y : tangage)
  held = new Set<Btn>();
  private pressed = new Set<Btn>();
  device: Device;
  onDevice: ((d: Device) => void)[] = [];
  enabled = true;
  /** Navigation dans les menus (manette / flèches). */
  onNav: ((e: NavEvent) => void) | null = null;
  /** Défilement des textes de menu (stick droit), en pixels. */
  onScroll: ((dy: number) => void) | null = null;
  menuMode = false;
  /** Vrai pendant la trame où un bouton de manette vient d'être pressé. */
  padPressed = false;

  private keys = new Set<string>();
  private mouse = new THREE.Vector2();
  private padPrev: boolean[] = [];
  private padNavCooldown = 0;
  private padNavDir: NavDir | null = null;
  private padBlock: boolean[] = [];
  private touchLook = new THREE.Vector2();
  private joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  private lookTouch = { id: -1, x: 0, y: 0 };
  sensitivity = 1;
  invertY = false;
  private touchRoot: HTMLElement;

  constructor(canvas: HTMLCanvasElement, touchRoot: HTMLElement) {
    this.touchRoot = touchRoot;
    const iPadOS = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
    this.device = iPadOS || /iPad|iPhone|Android/.test(navigator.userAgent) ? 'touch' : 'keyboard';

    window.addEventListener('keydown', (e) => {
      if (e.repeat) { return; }
      this.setDevice('keyboard');
      this.keys.add(e.code);
      const b = this.keyBtn(e.code);
      // dans un menu, les touches servent seulement au menu (sinon Échap fermerait puis rouvrirait la pause)
      if (b && !this.menuMode) { this.held.add(b); this.pressed.add(b); }
      if (this.menuMode && this.onNav) {
        const nav = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', Escape: 'back', PageUp: 'prev', PageDown: 'next' } as const)[e.code as 'ArrowUp'];
        if (nav) { document.body.classList.add('padnav'); this.onNav(nav); e.preventDefault(); }
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code) && !this.menuMode) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const b = this.keyBtn(e.code);
      if (b) this.held.delete(b);
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.held.clear(); });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.mouse.x += e.movementX; this.mouse.y += e.movementY;
        this.setDevice('keyboard');
      }
    });
    canvas.addEventListener('mousedown', () => {
      this.setDevice('keyboard');
      if (this.enabled && !this.menuMode && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
    });
    window.addEventListener('gamepadconnected', () => this.setDevice('gamepad'));
    this.setupTouch();
  }

  private keyBtn(code: string): Btn | null {
    switch (code) {
      case 'Space': return 'jump';
      case 'KeyE': return 'interact';
      case 'KeyF': return 'scan';
      case 'Escape': case 'KeyP': return 'pause';
      case 'ShiftLeft': case 'ShiftRight': return 'up';
      case 'ControlLeft': case 'ControlRight': return 'down';
      case 'KeyM': case 'Tab': return 'map';
      case 'KeyL': return 'lamp';
    }
    return null;
  }

  setDevice(d: Device) {
    if (d === this.device) return;
    this.device = d;
    document.body.dataset.device = d;
    document.body.classList.toggle('padnav', d === 'gamepad');
    for (const f of this.onDevice) f(d);
  }

  wasPressed(b: Btn) { return this.pressed.has(b); }

  // ---------- tactile ----------
  private setupTouch() {
    const root = this.touchRoot;
    const stick = root.querySelector('.stick') as HTMLElement;
    const knob = root.querySelector('.knob') as HTMLElement;
    const btns = root.querySelectorAll<HTMLElement>('[data-btn]');
    btns.forEach((el) => {
      const b = el.dataset.btn as Btn;
      el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.setDevice('touch'); this.held.add(b); this.pressed.add(b); el.classList.add('down'); el.setPointerCapture(e.pointerId); });
      const up = () => { this.held.delete(b); el.classList.remove('down'); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
    const zone = root.querySelector('.zone') as HTMLElement;
    zone.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      this.setDevice('touch');
      zone.setPointerCapture(e.pointerId);
      const w = window.innerWidth;
      if (e.clientX < w * 0.42 && this.joy.id < 0) {
        this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
        stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px';
        stick.classList.add('active');
      } else if (this.lookTouch.id < 0) {
        this.lookTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joy.id) {
        const R = 56;
        let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
        const l = Math.hypot(dx, dy);
        if (l > R) { dx *= R / l; dy *= R / l; }
        this.joy.x = dx / R; this.joy.y = dy / R;
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (e.pointerId === this.lookTouch.id) {
        this.touchLook.x += e.clientX - this.lookTouch.x;
        this.touchLook.y += e.clientY - this.lookTouch.y;
        this.lookTouch.x = e.clientX; this.lookTouch.y = e.clientY;
      }
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === this.joy.id) {
        this.joy.id = -1; this.joy.x = this.joy.y = 0; knob.style.transform = ''; stick.classList.remove('active');
      }
      if (e.pointerId === this.lookTouch.id) this.lookTouch.id = -1;
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  }

  // ---------- trame ----------
  update(dt: number) {
    this.move.set(0, 0);
    this.look.set(0, 0);
    if (!this.menuMode) {
      // clavier (codes physiques : ZQSD en AZERTY = WASD en QWERTY)
      const k = this.keys;
      if (k.has('KeyW') || k.has('ArrowUp')) this.move.y += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) this.move.y -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) this.move.x += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) this.move.x -= 1;
      if (this.move.lengthSq() > 1) this.move.normalize();
      this.look.x += this.mouse.x * 0.0024 * this.sensitivity;
      this.look.y += this.mouse.y * 0.0024 * this.sensitivity;
      // tactile
      if (this.joy.id >= 0) {
        const l = Math.hypot(this.joy.x, this.joy.y);
        if (l > 0.12) this.move.set(this.joy.x, -this.joy.y).multiplyScalar(Math.min(1, (l - 0.12) / 0.75) / l);
      }
      this.look.x += this.touchLook.x * 0.0055 * this.sensitivity;
      this.look.y += this.touchLook.y * 0.0045 * this.sensitivity;
    }
    this.mouse.set(0, 0); this.touchLook.set(0, 0);
    this.pollGamepad(dt);
    if (this.invertY) this.look.y *= -1;
  }

  private pollGamepad(dt: number) {
    const gp = readPad();
    if (!gp) return;
    const dz = (v: number) => (Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84);
    const lx = dz(gp.axes[0] ?? 0), ly = dz(gp.axes[1] ?? 0), rx = dz(gp.axes[2] ?? 0), ry = dz(gp.axes[3] ?? 0);
    const b = (i: number) => !!gp.buttons[i]?.pressed;
    const any = lx || ly || rx || ry || gp.buttons.some((x) => x.pressed);
    if (any) this.setDevice('gamepad');
    this.padPressed = gp.buttons.some((x, i) => x.pressed && !this.padPrev[i]);
    if (this.device !== 'gamepad') { this.padPrev = gp.buttons.map((x) => x.pressed); return; }
    if (!this.menuMode) {
      if (lx || ly) { this.move.set(lx, -ly); if (this.move.lengthSq() > 1) this.move.normalize(); }
      this.look.x += rx * Math.abs(rx) * 3.0 * dt * this.sensitivity;
      this.look.y += ry * Math.abs(ry) * 2.2 * dt * this.sensitivity;
    }
    const map: [number, Btn][] = [[0, 'jump'], [1, 'interact'], [2, 'scan'], [3, 'lamp'], [9, 'pause'], [8, 'map'], [7, 'up'], [6, 'down'], [5, 'up'], [4, 'down']];
    const menu = this.menuMode;
    for (const [i, name] of map) {
      const now = b(i), was = this.padPrev[i];
      // un bouton appuyé dans un menu ne compte pour le jeu qu'après avoir été relâché
      if (now && menu) this.padBlock[i] = true;
      if (!now) this.padBlock[i] = false;
      if (this.padBlock[i]) continue;
      if (now && !was) this.pressed.add(name);
      if (now) this.held.add(name);
      else if (was) this.held.delete(name);
    }
    if (menu && this.onNav) {
      const edge = (i: number) => b(i) && !this.padPrev[i];
      if (edge(0)) this.onNav('ok');
      if (edge(1) || edge(9)) this.onNav('back');
      if (edge(4)) this.onNav('prev');
      if (edge(5)) this.onNav('next');
      const dirs: [boolean, NavDir][] = [[b(12) || ly < -0.55, 'up'], [b(13) || ly > 0.55, 'down'], [b(14) || lx < -0.55, 'left'], [b(15) || lx > 0.55, 'right']];
      const d = dirs.find(([v]) => v)?.[1] ?? null;
      this.padNavCooldown -= dt;
      // première impulsion immédiate, puis répétition si on maintient
      if (d !== this.padNavDir) { this.padNavDir = d; if (d) { this.onNav(d); this.padNavCooldown = 0.38; } }
      else if (d && this.padNavCooldown <= 0) { this.onNav(d); this.padNavCooldown = 0.13; }
      if (ry) this.onScroll?.(ry * Math.abs(ry) * 900 * dt);
    }
    this.padPrev = gp.buttons.map((x) => x.pressed);
  }

  rumble(strong = 0.5, weak = 0.3, ms = 120) {
    const gp = readPad() as (Gamepad & { vibrationActuator?: { playEffect: (t: string, o: object) => Promise<unknown> } }) | undefined;
    gp?.vibrationActuator?.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
  }

  endFrame() { this.pressed.clear(); this.padPressed = false; }
  releasePointer() { if (document.pointerLockElement) document.exitPointerLock(); }
}
