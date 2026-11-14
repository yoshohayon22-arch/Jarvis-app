import { describe, expect, it } from "vitest";
import { createPlayer, PLAYER_TUNING, playerSpeed, stepPlayer, type PlayerInput } from "../src/sim/player";
import type { CollisionWorld } from "../src/sim/collision";

const empty: CollisionWorld = { boxes: [], circles: [], rings: [], boundsRadius: 1000 };
const idle: PlayerInput = { moveX: 0, moveZ: 0, run: false, dodge: false };
const DT = 1 / 60;

function run(p: ReturnType<typeof createPlayer>, input: PlayerInput, seconds: number, world = empty) {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepPlayer(p, input, world, DT);
}

describe("player controller", () => {
  it("walks toward the input direction at walk speed", () => {
    const p = createPlayer(0, 0, 0);
    run(p, { ...idle, moveZ: -1 }, 2);
    expect(playerSpeed(p)).toBeCloseTo(PLAYER_TUNING.walkSpeed, 1);
    expect(p.z).toBeLessThan(-5);
    expect(p.state).toBe("walk");
    // Facing north (-z) means facing angle ≈ ±PI.
    expect(Math.abs(Math.cos(p.facing) + 1)).toBeLessThan(0.01);
  });

  it("runs faster than it walks", () => {
    const a = createPlayer(0, 0, 0);
    const b = createPlayer(0, 0, 0);
    run(a, { ...idle, moveX: 1 }, 2);
    run(b, { ...idle, moveX: 1, run: true }, 2);
    expect(b.x).toBeGreaterThan(a.x * 1.8);
    expect(b.state).toBe("run");
  });

  it("decelerates to a stop when input is released", () => {
    const p = createPlayer(0, 0, 0);
    run(p, { ...idle, moveX: 1, run: true }, 1);
    run(p, idle, 1);
    expect(playerSpeed(p)).toBe(0);
    expect(p.state).toBe("idle");
  });

  it("normalizes diagonal input", () => {
    const p = createPlayer(0, 0, 0);
    run(p, { ...idle, moveX: 1, moveZ: 1 }, 2);
    expect(playerSpeed(p)).toBeCloseTo(PLAYER_TUNING.walkSpeed, 1);
  });

  it("dodges with a burst then respects the cooldown", () => {
    const p = createPlayer(0, 0, 0);
    stepPlayer(p, { ...idle, dodge: true }, empty, DT);
    expect(p.state).toBe("dodge");
    run(p, idle, PLAYER_TUNING.dodgeDuration + 0.05);
    expect(p.state).not.toBe("dodge");
    // Dodged forward (+z, facing 0) by roughly speed * duration.
    expect(p.z).toBeGreaterThan(PLAYER_TUNING.dodgeSpeed * PLAYER_TUNING.dodgeDuration * 0.8);
    stepPlayer(p, { ...idle, dodge: true }, empty, DT);
    expect(p.state).not.toBe("dodge"); // still cooling down
  });

  it("cannot walk through a wall", () => {
    const wall: CollisionWorld = { ...empty, boxes: [{ minX: 2, maxX: 3, minZ: -10, maxZ: 10, height: 4 }] };
    const p = createPlayer(0, 0, 0);
    run(p, { ...idle, moveX: 1, run: true }, 3, wall);
    expect(p.x).toBeLessThanOrEqual(2 - PLAYER_TUNING.radius + 1e-6);
  });

  it("slides along a wall when moving diagonally into it", () => {
    const wall: CollisionWorld = { ...empty, boxes: [{ minX: 2, maxX: 3, minZ: -50, maxZ: 50, height: 4 }] };
    const p = createPlayer(0, 0, 0);
    run(p, { ...idle, moveX: 1, moveZ: 1 }, 3, wall);
    expect(p.z).toBeGreaterThan(4);
  });

  it("is deterministic", () => {
    const a = createPlayer(1, 2, 0.3);
    const b = createPlayer(1, 2, 0.3);
    const inputs: PlayerInput[] = [
      { moveX: 1, moveZ: 0.2, run: true, dodge: false },
      { moveX: -0.5, moveZ: 1, run: false, dodge: true },
      idle,
    ];
    for (let i = 0; i < 600; i++) {
      const inp = inputs[i % 3]!;
      stepPlayer(a, inp, empty, DT);
      stepPlayer(b, inp, empty, DT);
    }
    expect(a).toEqual(b);
  });
});
