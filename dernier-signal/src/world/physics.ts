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

/** Corps du joueur : cylindre approché par une boîte. */
export class Body {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  radius = 0.27;
  height = 1.05;
  grounded = false;
  ground: Collider | null = null;
  stepHeight = 0.28;
  hitCeiling = false;

  private boxAt(p: THREE.Vector3, out: THREE.Box3) {
    out.min.set(p.x - this.radius, p.y, p.z - this.radius);
    out.max.set(p.x + this.radius, p.y + this.height, p.z + this.radius);
    return out;
  }

  move(ph: Physics, dt: number) {
    const wasGrounded = this.grounded;
    this.grounded = false; this.hitCeiling = false;
    const d = this.vel.clone().multiplyScalar(dt);
    // sous-pas pour éviter de traverser les murs fins
    const steps = Math.max(1, Math.ceil(d.length() / 0.2));
    d.divideScalar(steps);
    for (let s = 0; s < steps; s++) {
      this.axis(ph, 'x', d.x, wasGrounded);
      this.axis(ph, 'z', d.z, wasGrounded);
      this.axis(ph, 'y', d.y, wasGrounded);
    }
    // collage au sol (descente de marches)
    if (!this.grounded && wasGrounded && this.vel.y <= 0) {
      const probe = this.pos.clone(); probe.y -= this.stepHeight;
      this.boxAt(probe, _b);
      let top = -Infinity, hit: Collider | null = null;
      for (const c of ph.colliders) if (c.enabled && overlaps(c.box, _b) && c.box.max.y <= this.pos.y + 0.01 && c.box.max.y > top) { top = c.box.max.y; hit = c; }
      if (hit) { this.pos.y = top; this.grounded = true; this.ground = hit; this.vel.y = 0; }
    }
  }

  private axis(ph: Physics, a: 'x' | 'y' | 'z', delta: number, wasGrounded: boolean) {
    if (delta === 0) {
      if (a !== 'y') return;
    }
    this.pos[a] += delta;
    this.boxAt(this.pos, _b);
    for (const c of ph.colliders) {
      if (!c.enabled || !overlaps(c.box, _b)) continue;
      if (a === 'y') {
        if (delta <= 0) { this.pos.y = c.box.max.y; this.grounded = true; this.ground = c; if (this.vel.y < 0) this.vel.y = 0; }
        else { this.pos.y = c.box.min.y - this.height - 1e-3; this.hitCeiling = true; if (this.vel.y > 0) this.vel.y = 0; }
      } else {
        // marche : monter si l'obstacle est bas
        const rise = c.box.max.y - this.pos.y;
        if (rise > 0 && rise <= this.stepHeight && (wasGrounded || this.vel.y <= 0) && this.free(ph, c.box.max.y + 1e-3)) {
          this.pos.y = c.box.max.y + 1e-3;
          continue;
        }
        if (delta > 0) this.pos[a] = c.box.min[a] - this.radius - 1e-4;
        else this.pos[a] = c.box.max[a] + this.radius + 1e-4;
        this.vel[a] = 0;
      }
      this.boxAt(this.pos, _b);
    }
  }

  private free(ph: Physics, y: number) {
    const p = this.pos.clone(); p.y = y;
    const b = this.boxAt(p, new THREE.Box3());
    return !ph.colliders.some((c) => c.enabled && overlaps(c.box, b));
  }
}
