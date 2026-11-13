import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Price } from "./config.js";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** Cost in USD of one call, from token counts and a per-million-token price. */
export function costUsd(u: Usage, p: Price): number {
  return (u.inputTokens * p.input + u.outputTokens * p.output + u.cacheReadTokens * p.cacheRead + u.cacheWriteTokens * p.cacheWrite) / 1e6;
}

interface State {
  day: string;
  spentUsd: number;
  calls: number;
  cacheHits: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

const fresh = (day: string): State => ({ day, spentUsd: 0, calls: 0, cacheHits: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 });

/**
 * Daily spend tracker with a hard limit. Persisted to disk so restarting the
 * proxy does not reset the budget. `now` is injectable for tests.
 */
export class Budget {
  private state: State;

  constructor(
    readonly dailyLimitUsd: number,
    private readonly file: string | null = null,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.state = fresh(this.today());
    if (file && existsSync(file)) {
      try {
        const saved = JSON.parse(readFileSync(file, "utf8")) as State;
        if (saved.day === this.today()) this.state = { ...fresh(saved.day), ...saved };
      } catch {
        /* corrupt file: start fresh */
      }
    }
  }

  private today(): string {
    return this.now().toISOString().slice(0, 10);
  }

  private roll(): void {
    if (this.state.day !== this.today()) this.state = fresh(this.today());
  }

  get exceeded(): boolean {
    this.roll();
    return this.state.spentUsd >= this.dailyLimitUsd;
  }

  record(usage: Usage, price: Price): number {
    this.roll();
    const cost = costUsd(usage, price);
    const s = this.state;
    s.spentUsd += cost;
    s.calls++;
    s.inputTokens += usage.inputTokens;
    s.outputTokens += usage.outputTokens;
    s.cacheReadTokens += usage.cacheReadTokens;
    this.persist();
    return cost;
  }

  recordCacheHit(): void {
    this.roll();
    this.state.cacheHits++;
  }

  snapshot(): Readonly<State> {
    this.roll();
    return { ...this.state };
  }

  private persist(): void {
    if (!this.file) return;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify(this.state));
    } catch {
      /* best effort */
    }
  }
}
