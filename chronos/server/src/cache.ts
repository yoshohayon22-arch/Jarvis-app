import { createHash } from "node:crypto";

/** Stable hash of a JSON-serializable value (keys sorted so equal requests hash equally). */
export function hashKey(value: unknown): string {
  const norm = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(norm)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])]))
        : typeof v === "string"
          ? v.trim().toLowerCase().replace(/\s+/g, " ")
          : v;
  return createHash("sha256").update(JSON.stringify(norm(value))).digest("hex");
}

/** Small in-memory TTL + LRU cache for model replies. */
export class ResponseCache<T> {
  private readonly map = new Map<string, { value: T; expires: number }>();

  constructor(
    private readonly maxEntries = 500,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): T | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.expires <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency.
    this.map.delete(key);
    this.map.set(key, e);
    return e.value;
  }

  set(key: string, value: T, ttlSeconds: number): void {
    if (ttlSeconds <= 0) return;
    this.map.delete(key);
    this.map.set(key, { value, expires: this.now() + ttlSeconds * 1000 });
    while (this.map.size > this.maxEntries) this.map.delete(this.map.keys().next().value as string);
  }

  get size(): number {
    return this.map.size;
  }
}
