/** Sliding-window limiter: at most `perMinute` requests per client per minute. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly perMinute: number,
    private readonly now: () => number = Date.now,
  ) {}

  allow(clientId: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(clientId) ?? []).filter((x) => t - x < 60_000);
    if (recent.length >= this.perMinute) {
      this.hits.set(clientId, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(clientId, recent);
    return true;
  }
}
