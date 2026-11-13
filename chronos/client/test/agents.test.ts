import { beforeAll, describe, expect, it } from "vitest";
import type { CharacterDef, ExtrasDef, WorldLayout } from "@chronos/shared";
import layoutJson from "../data/packs/medieval/layout.json";
import charactersJson from "../data/packs/medieval/characters.json";
import extrasJson from "../data/packs/medieval/extras.json";
import visualsJson from "../data/packs/medieval/visuals.json";
import { AGENT_TUNING, AgentSystem, Places, createAgentSystem, createPopulation } from "../src/sim/agents";
import { blockAt, shiftSchedule, validateSchedule } from "../src/sim/agents/schedule";
import { WorldClock } from "../src/sim/clock";
import { isFree } from "../src/sim/nav/grid";
import { expandLayout } from "../src/sim/scenery";
import { buildCollisionWorld } from "../src/sim/worldColliders";

const SEED = 20261112;
const layout = expandLayout(layoutJson as unknown as WorldLayout, SEED);
const collision = buildCollisionWorld(layout);
const characters = (charactersJson as unknown as { characters: CharacterDef[] }).characters;
const extras = extrasJson as unknown as ExtrasDef;
const places = new Places(layout, collision);

const make = (hour: number) => {
  const clock = new WorldClock(24, hour);
  return { clock, sys: createAgentSystem(layout, collision, characters, extras, SEED, clock) };
};
/** Runs the simulation for a number of game hours at 10 Hz. */
function run(sys: AgentSystem, clock: WorldClock, gameHours: number, onTick?: () => void): void {
  const ticks = Math.round((gameHours * 60) / (clock.gameMinutesPerRealSecond * clock.timeScale) / 0.1);
  for (let i = 0; i < ticks; i++) {
    clock.advance(0.1);
    sys.step(0.1, clock);
    onTick?.();
  }
}

describe("schedules", () => {
  const s = [
    { from: 6, do: "work" as const, at: "work" },
    { from: 12, do: "eat" as const, at: "home" },
    { from: 22, do: "sleep" as const, at: "home" },
  ];
  it("finds the active block, wrapping past midnight", () => {
    expect(blockAt(s, 7).do).toBe("work");
    expect(blockAt(s, 12).do).toBe("eat");
    expect(blockAt(s, 23.5).do).toBe("sleep");
    expect(blockAt(s, 3).do).toBe("sleep");
  });
  it("shifts and keeps blocks sorted within the day", () => {
    const shifted = shiftSchedule(s, 150); // +2.5 h pushes 22:00 past midnight
    expect(shifted.map((b) => b.from)).toEqual([0.5, 8.5, 14.5]);
    expect(validateSchedule(shifted)).toEqual([]);
  });
});

describe("pack population data", () => {
  it("has ~12 key characters and about a hundred extras", () => {
    expect(characters.length).toBe(12);
    const n = extras.archetypes.reduce((a, b) => a + b.count, 0);
    expect(n).toBeGreaterThanOrEqual(95);
    expect(n).toBeLessThanOrEqual(110);
  });

  it("covers the four factions", () => {
    const f = new Set([...characters.map((c) => c.faction), ...extras.archetypes.map((a) => a.faction)]);
    expect([...f].sort()).toEqual(["mages_order", "royal_guard", "thieves_guild", "villagers"]);
  });

  it("gives every key character a complete sheet", () => {
    const ids = new Set(characters.map((c) => c.id));
    for (const c of characters) {
      expect(c.bio.length, c.id).toBeGreaterThan(20);
      expect(c.goals.length, c.id).toBeGreaterThan(0);
      expect(c.inventory.length, c.id).toBeGreaterThan(0);
      expect(c.relations.length, c.id).toBeGreaterThan(0);
      for (const r of c.relations) expect(ids.has(r.to), `${c.id} → ${r.to}`).toBe(true);
      for (const v of Object.values(c.traits)) expect(v >= 0 && v <= 1).toBe(true);
    }
  });

  it("references only existing places, homes and looks", () => {
    const looks = new Set(Object.keys((visualsJson as unknown as { looks: object }).looks));
    const check = (owner: string, home: string, schedule: { at: string }[], work: string[], lk: string[]) => {
      expect(places.buildings.has(home), `${owner} home ${home}`).toBe(true);
      for (const b of schedule) expect(places.checkRef(b.at), `${owner}: ${b.at}`).toBeNull();
      for (const w of work) expect(places.checkRef(w), `${owner}: ${w}`).toBeNull();
      for (const l of lk) expect(looks.has(l), `${owner} look ${l}`).toBe(true);
    };
    for (const c of characters) {
      check(c.id, c.home, c.schedule, [], [c.look]);
      expect(validateSchedule(c.schedule), c.id).toEqual([]);
    }
    for (const a of extras.archetypes) {
      for (const h of a.homes) check(a.id, h, a.schedule, a.work, a.looks);
      expect(validateSchedule(a.schedule), a.id).toEqual([]);
    }
  });

  it("puts every spot, route point and entrance on walkable ground", () => {
    for (const s of layout.spots) expect(places.nav.nearestFree(s.pos[0], s.pos[1], 2), s.id).toBeGreaterThanOrEqual(0);
    for (const r of layout.routes) for (const p of r.points) expect(places.nav.isWalkable(p[0], p[1]), `${r.id} ${p}`).toBe(true);
    for (const [id, e] of places.entrances) expect(places.nav.isWalkable(e.x, e.z), id).toBe(true);
  });

  it("can reach every entrance and spot from the market square", () => {
    for (const [id, e] of places.entrances) expect(places.nav.findPath(0, 8, e.x, e.z), id).not.toBeNull();
    for (const s of layout.spots) expect(places.nav.findPath(0, 8, s.pos[0], s.pos[1]), s.id).not.toBeNull();
  });

  it("generates the same population for the same seed", () => {
    expect(createPopulation(characters, extras, 7)).toEqual(createPopulation(characters, extras, 7));
    expect(createPopulation(characters, extras, 7)).not.toEqual(createPopulation(characters, extras, 8));
  });
});

describe("daily life", () => {
  it("has most people asleep indoors at 3 am, with a night watch outside", () => {
    const { sys } = make(3);
    const c = sys.counts();
    expect(c.inside).toBeGreaterThan(sys.agents.length * 0.75);
    const outside = sys.agents.filter((a) => !a.insideOf);
    expect(outside.some((a) => a.faction === "royal_guard")).toBe(true);
  });

  it("fills the streets by mid-morning", () => {
    const { sys } = make(10);
    expect(sys.counts().outside).toBeGreaterThan(sys.agents.length * 0.7);
    const brann = sys.agents.find((a) => a.id === "brann")!;
    expect(brann.activity).toBe("work");
    expect(Math.hypot(brann.x - 34, brann.z - 3.8)).toBeLessThan(2.5);
  });

  it("walks people to where their schedule sends them", () => {
    const { sys, clock } = make(11.5);
    clock.timeScale = 1;
    const brann = sys.agents.find((a) => a.id === "brann")!;
    expect(brann.insideOf).toBeNull();
    run(sys, clock, 1.3); // forge → tavern for lunch at noon
    expect(brann.activity).toBe("eat");
    expect(brann.insideOf).toBe("tavern");
  });

  it("keeps walking inhabitants out of walls and buildings for a whole morning", () => {
    const { sys, clock } = make(5);
    let checks = 0;
    let tick = 0;
    run(sys, clock, 4, () => {
      if (++tick % 25 !== 0) return;
      for (const a of sys.agents) {
        if (a.insideOf) continue;
        checks++;
        expect(isFree(collision, a.x, a.z, AGENT_TUNING.radius - 0.12), `${a.id} at ${a.x.toFixed(1)},${a.z.toFixed(1)}`).toBe(true);
      }
    });
    expect(checks).toBeGreaterThan(1000);
  });

  it("does not leave anyone stuck on the way for hours", () => {
    const { sys, clock } = make(5);
    const movingSince = new Map<string, number>();
    let worst = 0;
    run(sys, clock, 6, () => {
      for (const a of sys.agents) {
        if (a.mode === "moving" && a.activity !== "patrol" && a.activity !== "wander") {
          const since = movingSince.get(a.id) ?? clock.totalMinutes;
          movingSince.set(a.id, since);
          worst = Math.max(worst, clock.totalMinutes - since);
        } else movingSince.delete(a.id);
      }
    });
    // Longest commute (village edge to the fields) is well under 3 game hours.
    expect(worst).toBeLessThan(180);
  });

  it("lets an urgent need override the schedule, then returns to it", () => {
    const { sys, clock } = make(9);
    const aldric = sys.agents.find((a) => a.id === "aldric")!;
    aldric.needs.hunger = 0.97;
    run(sys, clock, 0.25);
    expect(aldric.activity).toBe("eat");
    expect(aldric.override).toBe(true);
    run(sys, clock, 1.5);
    expect(aldric.needs.hunger).toBeLessThan(AGENT_TUNING.satisfied + 0.1);
    expect(aldric.activity).toBe("work");
  });

  it("keeps needs within bounds over two full days", () => {
    const { sys, clock } = make(6);
    clock.timeScale = 20;
    run(sys, clock, 48);
    for (const a of sys.agents) {
      for (const v of Object.values(a.needs)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    // Schedules include meals and sleep, so nobody should end up starving or exhausted.
    const starving = sys.agents.filter((a) => a.needs.hunger > 0.95 || a.needs.energy > 0.95);
    expect(starving.length).toBeLessThan(sys.agents.length * 0.05);
  });

  it("is deterministic over 1000 ticks", () => {
    const a = make(7.5);
    const b = make(7.5);
    for (let i = 0; i < 1000; i++) {
      a.clock.advance(0.1);
      b.clock.advance(0.1);
      const player = { x: Math.sin(i / 50) * 10, z: 8 };
      a.sys.step(0.1, a.clock, player);
      b.sys.step(0.1, b.clock, player);
    }
    expect(a.sys.agents).toEqual(b.sys.agents);
  });
});
