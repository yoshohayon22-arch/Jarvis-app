import type { Agent } from "../agents";
import type { DynamicProp } from "../physics";

export interface Frame {
  /** Game minute of the snapshot. */
  t: number;
  agents: Agent[];
  props: DynamicProp[];
  player: { x: number; z: number; facing: number };
  extra: unknown;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * Ring buffer of recent world snapshots, the raw material of "rewind".
 * Only a few seconds are kept: rewinding is local and short by design.
 */
export class History {
  private frames: Frame[] = [];

  constructor(
    /** Game minutes kept. */
    readonly span: number,
    /** Game minutes between snapshots. */
    readonly interval: number,
  ) {}

  record(t: number, agents: readonly Agent[], props: readonly DynamicProp[], player: Frame["player"], extra: unknown): void {
    let last = this.frames[this.frames.length - 1];
    // The clock moved backwards (debug time jump, loaded save): older "future" frames are meaningless.
    if (last && t < last.t) {
      this.frames = [];
      last = undefined;
    }
    if (last && t - last.t < this.interval) return;
    this.frames.push({ t, agents: clone(agents) as Agent[], props: clone(props) as DynamicProp[], player: { ...player }, extra: clone(extra ?? null) });
    while (this.frames.length > 0 && t - (this.frames[0] as Frame).t > this.span) this.frames.shift();
  }

  /** Oldest frame not older than `t` (i.e. the state `window` ago), or null if nothing is recorded. */
  frameAt(t: number): Frame | null {
    for (const f of this.frames) if (f.t >= t) return f;
    return this.frames[this.frames.length - 1] ?? null;
  }

  clear(): void {
    this.frames = [];
  }

  get length(): number {
    return this.frames.length;
  }
}
