import { isInGate, type CollisionWorld } from "../collision";

/**
 * Walkability grid + A* for inhabitants. The village is small (200 m), so a
 * 1 m grid with 8-way A* and line-of-sight smoothing is plenty and stays
 * fully deterministic.
 */
export class NavGrid {
  readonly size: number;
  readonly cell: number;
  readonly origin: number;
  readonly blocked: Uint8Array;
  // Scratch buffers reused across searches.
  private readonly g: Float32Array;
  private readonly came: Int32Array;
  private readonly stamp: Uint32Array;
  private readonly closed: Uint32Array;
  private searchId = 0;

  constructor(world: CollisionWorld, extent: number, cell = 1, readonly agentRadius = 0.45) {
    this.cell = cell;
    this.size = Math.round(extent / cell);
    this.origin = -extent / 2;
    const n = this.size * this.size;
    this.blocked = new Uint8Array(n);
    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    for (let j = 0; j < this.size; j++)
      for (let i = 0; i < this.size; i++)
        this.blocked[j * this.size + i] = isFree(world, this.cx(i), this.cx(j), agentRadius) ? 0 : 1;
  }

  /** World coordinate of the center of cell index i (same for x and z). */
  cx(i: number): number {
    return this.origin + (i + 0.5) * this.cell;
  }

  cellOf(v: number): number {
    return Math.max(0, Math.min(this.size - 1, Math.floor((v - this.origin) / this.cell)));
  }

  isWalkable(x: number, z: number): boolean {
    return this.blocked[this.cellOf(z) * this.size + this.cellOf(x)] === 0;
  }

  /** Nearest walkable cell (index) to a point, searching outward in rings. */
  nearestFree(x: number, z: number, maxRing = 12): number {
    const ci = this.cellOf(x);
    const cj = this.cellOf(z);
    let best = -1;
    let bestD = Infinity;
    for (let r = 0; r <= maxRing; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = ci + di;
          const j = cj + dj;
          if (i < 0 || j < 0 || i >= this.size || j >= this.size) continue;
          const idx = j * this.size + i;
          if (this.blocked[idx]) continue;
          const d = (this.cx(i) - x) ** 2 + (this.cx(j) - z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = idx;
          }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** Straight walkable line between two points (sampled). */
  lineOfSight(x0: number, z0: number, x1: number, z1: number): boolean {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.ceil(d / (this.cell * 0.4)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      if (!this.isWalkable(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false;
    }
    return true;
  }

  /**
   * Path from (sx, sz) to (tx, tz) as a flat [x0, z0, x1, z1, ...] list of waypoints
   * (excluding the start). Returns null when no path exists.
   */
  findPath(sx: number, sz: number, tx: number, tz: number): number[] | null {
    const start = this.nearestFree(sx, sz);
    const goal = this.nearestFree(tx, tz);
    if (start < 0 || goal < 0) return null;
    const N = this.size;
    const id = ++this.searchId;
    const { g, came, stamp, closed, blocked } = this;
    const gi = goal % N;
    const gj = (goal / N) | 0;
    const h = (idx: number) => {
      const dx = Math.abs((idx % N) - gi);
      const dz = Math.abs(((idx / N) | 0) - gj);
      return Math.max(dx, dz) + 0.41421356 * Math.min(dx, dz);
    };
    const heap = new MinHeap();
    g[start] = 0;
    came[start] = -1;
    stamp[start] = id;
    heap.push(start, h(start));
    let found = false;
    while (heap.length > 0) {
      const cur = heap.pop();
      if (cur === goal) {
        found = true;
        break;
      }
      if (closed[cur] === id) continue;
      closed[cur] = id;
      const ci = cur % N;
      const cj = (cur / N) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (di === 0 && dj === 0) continue;
          const ni = ci + di;
          const nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
          const nb = nj * N + ni;
          if (blocked[nb] || closed[nb] === id) continue;
          // No cutting corners between two blocked cells.
          if (di !== 0 && dj !== 0 && (blocked[cj * N + ni] || blocked[nj * N + ci])) continue;
          const cost = (g[cur] as number) + (di !== 0 && dj !== 0 ? 1.41421356 : 1);
          if (stamp[nb] !== id || cost < (g[nb] as number)) {
            g[nb] = cost;
            came[nb] = cur;
            stamp[nb] = id;
            heap.push(nb, cost + h(nb));
          }
        }
      }
    }
    if (!found) return null;

    // Reconstruct, then smooth with line-of-sight checks (string pulling).
    const cells: number[] = [];
    for (let c = goal; c !== -1; c = came[c] as number) cells.push(c);
    cells.reverse();
    const pts: [number, number][] = cells.map((c) => [this.cx(c % N), this.cx((c / N) | 0)]);
    pts[0] = [this.isWalkable(sx, sz) ? sx : (pts[0] as [number, number])[0], this.isWalkable(sx, sz) ? sz : (pts[0] as [number, number])[1]];
    if (this.isWalkable(tx, tz)) pts.push([tx, tz]);
    const out: number[] = [];
    let anchor = 0;
    while (anchor < pts.length - 1) {
      let next = pts.length - 1;
      const a = pts[anchor] as [number, number];
      while (next > anchor + 1) {
        const b = pts[next] as [number, number];
        if (this.lineOfSight(a[0], a[1], b[0], b[1])) break;
        next--;
      }
      const p = pts[next] as [number, number];
      out.push(p[0], p[1]);
      anchor = next;
    }
    return out;
  }
}

/** True when a circle of radius r at (x, z) touches no blocker. */
export function isFree(world: CollisionWorld, x: number, z: number, r: number): boolean {
  const d = Math.hypot(x, z);
  if (d > world.boundsRadius - r) return false;
  for (const b of world.boxes) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return false;
  }
  for (const c of world.circles) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2) return false;
  for (const ring of world.rings)
    if (Math.abs(d - ring.radius) < ring.thickness / 2 + r && !isInGate(ring, x, z)) return false;
  return true;
}

/** Binary min-heap keyed by priority; ties broken by insertion order for determinism. */
class MinHeap {
  private ids: number[] = [];
  private pri: number[] = [];
  private seq: number[] = [];
  private counter = 0;

  get length(): number {
    return this.ids.length;
  }

  private less(a: number, b: number): boolean {
    const pa = this.pri[a] as number;
    const pb = this.pri[b] as number;
    return pa < pb || (pa === pb && (this.seq[a] as number) < (this.seq[b] as number));
  }

  private swap(a: number, b: number): void {
    [this.ids[a], this.ids[b]] = [this.ids[b] as number, this.ids[a] as number];
    [this.pri[a], this.pri[b]] = [this.pri[b] as number, this.pri[a] as number];
    [this.seq[a], this.seq[b]] = [this.seq[b] as number, this.seq[a] as number];
  }

  push(id: number, priority: number): void {
    this.ids.push(id);
    this.pri.push(priority);
    this.seq.push(this.counter++);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): number {
    const top = this.ids[0] as number;
    const last = this.ids.length - 1;
    this.swap(0, last);
    this.ids.pop();
    this.pri.pop();
    this.seq.pop();
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < this.ids.length && this.less(l, m)) m = l;
      if (r < this.ids.length && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }
}
