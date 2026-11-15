import { describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { StepCounter, ambienceMix, musicFor, spatial, speechPattern } from "../src/audio/mix";

const base = { daylight: 1, crowdNear: 0, tavernDistance: 100, hour: 12, outside: false };

describe("ambience mix", () => {
  it("is birdsong by day and crickets by night", () => {
    const day = ambienceMix(base);
    const night = ambienceMix({ ...base, daylight: 0, hour: 2 });
    expect(day.birds).toBeGreaterThan(0.2);
    expect(day.night).toBe(0);
    expect(night.night).toBeGreaterThan(0.4);
    expect(night.birds).toBe(0);
  });
  it("grows a crowd murmur with the number of people around, quieter at night", () => {
    expect(ambienceMix(base).crowd).toBe(0);
    const busy = ambienceMix({ ...base, crowdNear: 20 }).crowd;
    expect(busy).toBeGreaterThan(0.5);
    expect(ambienceMix({ ...base, crowdNear: 20, daylight: 0 }).crowd).toBeLessThan(busy / 2);
  });
  it("lets the tavern be heard from the street, louder in the evening, silent when closed", () => {
    expect(ambienceMix({ ...base, tavernDistance: 4, hour: 20 }).pub).toBeGreaterThan(ambienceMix({ ...base, tavernDistance: 4, hour: 12 }).pub);
    expect(ambienceMix({ ...base, tavernDistance: 40, hour: 20 }).pub).toBe(0);
    expect(ambienceMix({ ...base, tavernDistance: 4, hour: 5 }).pub).toBe(0);
  });
  it("never leaves the 0–1 range", () => {
    for (const v of Object.values(ambienceMix({ daylight: 3, crowdNear: 500, tavernDistance: -5, hour: 20, outside: true }))) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("music", () => {
  it("follows place and time", () => {
    expect(musicFor(base)).toBe("market");
    expect(musicFor({ ...base, tavernDistance: 8, hour: 21, daylight: 0.1 })).toBe("inn");
    expect(musicFor({ ...base, daylight: 0, hour: 3 })).toBe("explore");
    expect(musicFor({ ...base, outside: true })).toBe("explore");
  });
});

describe("spatial sound", () => {
  it("fades with distance and pans to the side the sound comes from", () => {
    expect(spatial(0, 0, 1, 0)).toEqual({ gain: 1, pan: 0 });
    const right = spatial(10, 0, 1, 0);
    const left = spatial(-10, 0, 1, 0);
    expect(right.pan).toBeGreaterThan(0.5);
    expect(left.pan).toBeLessThan(-0.5);
    expect(right.gain).toBeLessThan(1);
    expect(spatial(0, 40, 1, 0).gain).toBe(0);
    expect(spatial(0, 10, 1, 0).pan).toBeCloseTo(0);
  });
});

describe("footsteps", () => {
  it("counts one step per stride, longer strides when running", () => {
    const walk = new StepCounter(0.8);
    let steps = 0;
    for (let i = 0; i < 100; i++) steps += walk.advance(0.1, false);
    expect(steps).toBe(12);
    const run = new StepCounter(0.8);
    let rsteps = 0;
    for (let i = 0; i < 100; i++) rsteps += run.advance(0.1, true);
    expect(rsteps).toBeLessThan(steps);
    expect(new StepCounter().advance(0, false)).toBe(0);
  });
});

describe("speech blips", () => {
  it("lasts longer for longer lines, is bounded and repeatable", () => {
    const short = speechPattern("Bonjour.", 1);
    const long = speechPattern("Je ne t'ai jamais vu par ici, étranger, et je n'aime pas beaucoup ta façon de regarder ma bourse.", 1);
    expect(long.length).toBeGreaterThan(short.length);
    expect(long.length).toBeLessThanOrEqual(7);
    expect(speechPattern("Bonjour.", 1)).toEqual(short);
    for (const b of long) expect(b.index).toBeGreaterThanOrEqual(1), expect(b.index).toBeLessThanOrEqual(4);
  });
});

describe("audio files", () => {
  const dir = new URL("../public/assets/audio/", import.meta.url);
  const has = (n: string) => existsSync(new URL(`${n}.ogg`, dir));
  it("ships every sound the game asks for", () => {
    const names = [
      ...[1, 2, 3, 4, 5, 6].flatMap((i) => [`step_stone_${i}`, `step_soft_${i}`, `hit_${i}`, `hurt_m_${i}`]),
      ...[1, 2, 3, 4].flatMap((i) => [`swish_${i}`, `spell_${i}`, ...["male_standard", "male_deep", "female_standard", "female_light"].map((v) => `voice_${v}_${i}`)]),
      "hurt_f_1", "hurt_f_2", "coins", "coins_2", "ui_open", "ui_close", "ui_click", "door", "cloth", "draw", "chime", "chime_2", "chain", "wood", "lock", "stones",
      "amb_day", "amb_birds", "amb_night", "amb_crowd", "amb_pub", "music_market", "music_inn", "music_explore",
    ];
    for (const n of names) expect(has(n), n).toBe(true);
    expect(readdirSync(dir).filter((f) => f.endsWith(".ogg")).length).toBe(names.length);
  });
});

import { AutoQuality } from "../src/render/quality";

describe("automatic quality", () => {
  const feed = (t: AutoQuality, fps: number, seconds: number, level: "minimal" | "low" | "high") => {
    const acts = [];
    for (let i = 0; i < seconds * fps; i++) {
      const a = t.frame(1 / fps, level);
      if (a) acts.push(a);
    }
    return acts;
  };
  it("leaves a fluid game alone", () => {
    expect(feed(new AutoQuality(), 60, 30, "low")).toEqual([]);
  });
  it("steps the preset down when the frame rate stays low, after a warm-up", () => {
    const t = new AutoQuality();
    expect(feed(t, 15, 4, "high")).toEqual([]); // still loading: no verdict yet
    expect(feed(t, 15, 6, "high")[0]).toEqual({ level: "low" });
  });
  it("then lowers the resolution, down to a floor, and never raises anything", () => {
    const t = new AutoQuality();
    const acts = feed(t, 12, 120, "minimal");
    expect(acts.map((a) => a.scale)).toEqual([0.85, 0.7, 0.55]);
    expect(feed(t, 90, 60, "minimal")).toEqual([]);
    expect(t.scale).toBe(0.55);
  });
});
