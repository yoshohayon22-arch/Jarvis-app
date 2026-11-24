import * as THREE from 'three';

// Collisions simples et robustes : le niveau est fait de boîtes alignées (AABB).

export type Surface = 'metal' | 'grate' | 'concrete';

export interface Collider {
  box: THREE.Box3;
  enabled: boolean;
  surface: Surface;
  tag?: string;
  /** Faux = ne bloque pas la caméra (ex. petits objets). */
  camera: boolean;
}

export interface Trigger {
  box: THREE.Box3;
  inside: boolean;
  enabled: boolean;
  onEnter?: () => void;
  onExit?: () => void;
  onStay?: (dt: number) => void;
}

const _b = new THREE.Box3();
const _bPrev = new THREE.Box3();
const EPS = 1e-4;
/** Chevauchement strict (deux boîtes qui se touchent ne se chevauchent pas). */
export function overlaps(a: THREE.Box3, b: THREE.Box3) {
  return a.min.x < b.max.x - EPS && a.max.x > b.min.x + EPS && a.min.y < b.max.y - EPS && a.max.y > b.min.y + EPS && a.min.z < b.max.z - EPS && a.max.z > b.min.z + EPS;
}
const _inv = new THREE.Vector3();

export class Physics {
  colliders: Collider[] = [];
  triggers: Trigger[] = [];

  add(min: [number, number, number], max: [number, number, number], o: Partial<Collider> = {}): Collider {
    const c: Collider = {
      box: new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)),
      enabled: true, surface: 'metal', camera: true, ...o,
    };
    this.colliders.push(c);
    return c;
  }
  /** Boîte centrée. */
  addCentered(c: [number, number, number], size: [number, number, number], o: Partial<Collider> = {}) {
    return this.add([c[0] - size[0] / 2, c[1] - size[1] / 2, c[2] - size[2] / 2], [c[0] + size[0] / 2, c[1] + size[1] / 2, c[2] + size[2] / 2], o);
  }
  trigger(min: [number, number, number], max: [number, number, number], t: Partial<Trigger> = {}): Trigger {
    const tr: Trigger = { box: new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)), inside: false, enabled: true, ...t };
    this.triggers.push(tr);
    return tr;
  }

  updateTriggers(p: THREE.Vector3, dt: number) {
    for (const t of this.triggers) {
      if (!t.enabled) { t.inside = false; continue; }
      const inside = t.box.containsPoint(p);
      if (inside && !t.inside) t.onEnter?.();
      if (!inside && t.inside) t.onExit?.();
      if (inside) t.onStay?.(dt);
      t.inside = inside;
    }
  }

  /** Lancer de rayon contre les boîtes (caméra, interactions). */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, forCamera = false): { dist: number; collider: Collider } | null {
    _inv.set(1 / dir.x, 1 / dir.y, 1 / dir.z);
    let best: { dist: number; collider: Collider } | null = null;
    for (const c of this.colliders) {
      if (!c.enabled || (forCamera && !c.camera)) continue;
      const b = c.box;
      let t1 = (b.min.x - origin.x) * _inv.x, t2 = (b.max.x - origin.x) * _inv.x;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      t1 = (b.min.y - origin.y) * _inv.y; t2 = (b.max.y - origin.y) * _inv.y;
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      t1 = (b.min.z - origin.z) * _inv.z; t2 = (b.max.z - origin.z) * _inv.z;
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmax >= Math.max(tmin, 0) && tmin < maxDist) {
        const d = Math.max(tmin, 0);
        if (!best || d < best.dist) best = { dist: d, collider: c };
      }
    }
    return best;
  }
}

export type Axis = 'x' | 'y' | 'z';
const AX: Axis[] = ['x', 'y', 'z'];

/**
 * Corps du joueur : boîte alignée. Le « haut » peut être n'importe lequel des 6 axes
 * (sol, plafond avec la gravité inversée, murs avec les bottes magnétiques).
 * `pos` est le point des pieds.
 */
export class Body {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  radius = 0.27;
  height = 1.05;
  grounded = false;
  ground: Collider | null = null;
  stepHeight = 0.28;
  hitCeiling = false;
  /** Axe et sens du « haut » (gravité = -haut). */
  upAxis: Axis = 'y';
  upSign = 1;
  /** Dernier contact latéral (pour passer d'une surface à une autre avec les bottes). */
  lateralHit: { collider: Collider; axis: Axis; dir: number } | null = null;

  get up() { const v = new THREE.Vector3(); v[this.upAxis] = this.upSign; return v; }

  boxAt(p: THREE.Vector3, out: THREE.Box3) {
    for (const a of AX) {
      if (a === this.upAxis) {
        const lo = this.upSign > 0 ? p[a] : p[a] - this.height, hi = this.upSign > 0 ? p[a] + this.height : p[a];
        out.min[a] = lo; out.max[a] = hi;
      } else { out.min[a] = p[a] - this.radius; out.max[a] = p[a] + this.radius; }
    }
    return out;
  }

  move(ph: Physics, dt: number) {
    const wasGrounded = this.grounded;
    this.grounded = false; this.hitCeiling = false; this.lateralHit = null;
    const d = this.vel.clone().multiplyScalar(dt);
    const steps = Math.max(1, Math.ceil(d.length() / 0.2));
    d.divideScalar(steps);
    const lat = AX.filter((a) => a !== this.upAxis);
    for (let s = 0; s < steps; s++) {
      for (const a of lat) this.axis(ph, a, d[a], wasGrounded);
      this.axis(ph, this.upAxis, d[this.upAxis], wasGrounded);
    }
    // collage à la surface (descente de marches)
    const u = this.upAxis, us = this.upSign;
    if (!this.grounded && wasGrounded && this.vel[u] * us <= 0) {
      const probe = this.pos.clone(); probe[u] -= us * this.stepHeight;
      this.boxAt(probe, _b);
      let best = -Infinity, hit: Collider | null = null;
      for (const c of ph.colliders) {
        if (!c.enabled || !overlaps(c.box, _b)) continue;
        const surf = us > 0 ? c.box.max[u] : -c.box.min[u];
        if (surf <= us * this.pos[u] + 0.01 && surf > best) { best = surf; hit = c; }
      }
      if (hit) { this.pos[u] = us * best; this.grounded = true; this.ground = hit; this.vel[u] = 0; }
    }
  }

  private axis(ph: Physics, a: Axis, delta: number, wasGrounded: boolean) {
    if (delta === 0 && a !== this.upAxis) return;
    const prev = this.boxAt(this.pos, _bPrev);
    this.pos[a] += delta;
    this.boxAt(this.pos, _b);
    const u = this.upAxis, us = this.upSign;
    for (const c of ph.colliders) {
      if (!c.enabled || !overlaps(c.box, _b)) continue;
      if (a === u) {
        if (delta * us <= 0) { // on tombe vers la surface
          this.pos[a] = us > 0 ? c.box.max[a] : c.box.min[a];
          this.grounded = true; this.ground = c;
          if (this.vel[a] * us < 0) this.vel[a] = 0;
        } else {
          this.pos[a] = us > 0 ? c.box.min[a] - this.height - 1e-3 : c.box.max[a] + this.height + 1e-3;
          this.hitCeiling = true;
          if (this.vel[a] * us > 0) this.vel[a] = 0;
        }
      } else {
        // marche : monter si l'obstacle est bas
        const rise = us > 0 ? c.box.max[u] - this.pos[u] : this.pos[u] - c.box.min[u];
        if (rise > 0 && rise <= this.stepHeight && (wasGrounded || this.vel[u] * us <= 0) && this.free(ph, us > 0 ? c.box.max[u] + 1e-3 : c.box.min[u] - 1e-3)) {
          this.pos[u] = us > 0 ? c.box.max[u] + 1e-3 : c.box.min[u] - 1e-3;
          continue;
        }
        // déjà enfoncé avant ce pas : ne jamais « éjecter » de l'autre côté d'un grand bloc
        if (overlaps(c.box, prev)) continue;
        if (delta > 0) this.pos[a] = c.box.min[a] - this.radius - 1e-4;
        else this.pos[a] = c.box.max[a] + this.radius + 1e-4;
        this.vel[a] = 0;
        this.lateralHit = { collider: c, axis: a, dir: Math.sign(delta) };
      }
      this.boxAt(this.pos, _b);
    }
  }

  private free(ph: Physics, upCoord: number) {
    const p = this.pos.clone(); p[this.upAxis] = upCoord;
    const b = this.boxAt(p, new THREE.Box3());
    return !ph.colliders.some((c) => c.enabled && overlaps(c.box, b));
  }

  /** Vrai si la boîte placée à `p` avec ce « haut » est libre. */
  fits(ph: Physics, p: THREE.Vector3, axis: Axis, sign: number) {
    const sa = this.upAxis, ss = this.upSign;
    this.upAxis = axis; this.upSign = sign;
    const b = this.boxAt(p, new THREE.Box3());
    this.upAxis = sa; this.upSign = ss;
    return !ph.colliders.some((c) => c.enabled && overlaps(c.box, b));
  }

  /** Change le « haut » en gardant les pieds au même endroit. */
  setUp(axis: Axis, sign: number) { this.upAxis = axis; this.upSign = sign; }
  /** Change la verticale en gardant la boîte au même endroit (bascule autour du centre). */
  reorient(axis: Axis, sign: number) {
    const c = this.pos.clone().addScaledVector(this.up, this.height / 2);
    this.setUp(axis, sign);
    this.pos.copy(c).addScaledVector(this.up, -this.height / 2);
  }
}
