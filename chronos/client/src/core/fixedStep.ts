/**
 * Fixed-timestep accumulator. Simulation code always receives the same dt,
 * which keeps it deterministic regardless of the display frame rate.
 */
export class FixedStep {
  private acc = 0;

  constructor(
    readonly stepSeconds: number,
    /** Upper bound of steps per frame, prevents the "spiral of death" after a stall. */
    readonly maxStepsPerFrame = 8,
  ) {
    if (stepSeconds <= 0) throw new Error("stepSeconds must be > 0");
  }

  /**
   * Advances by a real elapsed time and runs `step` as many times as needed.
   * Returns the interpolation factor (0..1) between the last two states.
   */
  advance(dtSeconds: number, step: (dt: number) => void): number {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0) dtSeconds = 0;
    this.acc += Math.min(dtSeconds, this.stepSeconds * this.maxStepsPerFrame);
    let n = 0;
    // Small epsilon absorbs float drift (60 × 1/60 must give exactly one second of steps).
    while (this.acc >= this.stepSeconds - 1e-9 && n < this.maxStepsPerFrame) {
      step(this.stepSeconds);
      this.acc -= this.stepSeconds;
      n++;
    }
    if (n === this.maxStepsPerFrame && this.acc > this.stepSeconds) this.acc = 0;
    if (this.acc < 0) this.acc = 0;
    return this.acc / this.stepSeconds;
  }
}
