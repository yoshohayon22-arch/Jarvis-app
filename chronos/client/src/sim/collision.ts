/**
 * 2D collision on the ground plane (x, z). The V1 village is flat, so every
 * blocker is an axis-aligned box, a circle (trees, lanterns, barrels) or the
 * circular palisade with gate openings.
 */

export interface Aabb {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  /** Height of the blocker, used by camera ray tests. */
  height: number;
}

export interface CircleCollider {
  x: number;
  z: number;
  r: number;
  height: number;
}

export interface RingCollider {
  radius: number;
  thickness: number;
  height: number;
  /** Gate centers (radians, atan2(z, x)) and their half-width in meters. */
  gates: { angle: number; halfWidth: number }[];
}

export interface CollisionWorld {
  boxes: Aabb[];
  circles: CircleCollider[];
  rings: RingCollider[];
  /** Hard boundary of the playable area (circle centered on origin). */
  boundsRadius: number;
}

export interface Vec2 {
  x: number;
  z: number;
}

const EPS = 1e-6;

/** Pushes a circle out of an AABB. Returns true if a correction was applied. */
export function resolveCircleAabb(p: Vec2, r: number, b: Aabb): boolean {
  const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
  let dx = p.x - cx;
  let dz = p.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;

  if (d2 > EPS) {
    const d = Math.sqrt(d2);
    const push = r - d;
    p.x += (dx / d) * push;
    p.z += (dz / d) * push;
    return true;
  }
  // Center is inside the box: exit through the nearest face.
  const left = p.x - b.minX;
  const right = b.maxX - p.x;
  const top = p.z - b.minZ;
  const bottom = b.maxZ - p.z;
  const m = Math.min(left, right, top, bottom);
  if (m === left) p.x = b.minX - r;
  else if (m === right) p.x = b.maxX + r;
  else if (m === top) p.z = b.minZ - r;
  else p.z = b.maxZ + r;
  dx = dz = 0;
  return true;
}

export function resolveCircleCircle(p: Vec2, r: number, c: CircleCollider): boolean {
  const dx = p.x - c.x;
  const dz = p.z - c.z;
  const min = r + c.r;
  const d2 = dx * dx + dz * dz;
  if (d2 >= min * min) return false;
  const d = Math.sqrt(d2);
  if (d < EPS) {
    p.x = c.x + min;
    return true;
  }
  p.x = c.x + (dx / d) * min;
  p.z = c.z + (dz / d) * min;
  return true;
}

export function isInGate(ring: RingCollider, x: number, z: number): boolean {
  const a = Math.atan2(z, x);
  for (const g of ring.gates) {
    let d = Math.abs(a - g.angle) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d * ring.radius < g.halfWidth) return true;
  }
  return false;
}

export function resolveCircleRing(p: Vec2, r: number, ring: RingCollider): boolean {
  const d = Math.hypot(p.x, p.z);
  const half = ring.thickness / 2;
  if (Math.abs(d - ring.radius) >= half + r) return false;
  if (isInGate(ring, p.x, p.z)) return false;
  if (d < EPS) return false;
  const target = d <= ring.radius ? ring.radius - half - r : ring.radius + half + r;
  p.x = (p.x / d) * target;
  p.z = (p.z / d) * target;
  return true;
}

/** Resolves all collisions for a moving circle. Iterates to settle in corners. */
export function resolveAll(world: CollisionWorld, p: Vec2, r: number, iterations = 3): void {
  for (let i = 0; i < iterations; i++) {
    let hit = false;
    for (const b of world.boxes) hit = resolveCircleAabb(p, r, b) || hit;
    for (const c of world.circles) hit = resolveCircleCircle(p, r, c) || hit;
    for (const ring of world.rings) hit = resolveCircleRing(p, r, ring) || hit;
    const d = Math.hypot(p.x, p.z);
    const max = world.boundsRadius - r;
    if (d > max) {
      p.x = (p.x / d) * max;
      p.z = (p.z / d) * max;
      hit = true;
    }
    if (!hit) break;
  }
}

/**
 * Ray against a box in 3D (box spans y = 0..height). Returns the distance
 * along the normalized direction, or Infinity.
 */
export function rayAabb(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  b: Aabb,
): number {
  let tmin = -Infinity;
  let tmax = Infinity;
  const axes: [number, number, number, number][] = [
    [ox, dx, b.minX, b.maxX],
    [oy, dy, 0, b.height],
    [oz, dz, b.minZ, b.maxZ],
  ];
  for (const [o, d, mn, mx] of axes) {
    if (Math.abs(d) < EPS) {
      if (o < mn || o > mx) return Infinity;
    } else {
      let t1 = (mn - o) / d;
      let t2 = (mx - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  if (tmax < 0) return Infinity;
  return tmin >= 0 ? tmin : 0;
}
