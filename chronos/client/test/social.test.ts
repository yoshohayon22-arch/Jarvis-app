import { describe, expect, it } from "vitest";
import type { ActsDef, CharacterDef, ExtrasDef, WorldLayout } from "@chronos/shared";
import layoutJson from "../data/packs/medieval/layout.json";
import charactersJson from "../data/packs/medieval/characters.json";
import extrasJson from "../data/packs/medieval/extras.json";
import actsJson from "../data/packs/medieval/acts.json";
import { createAgentSystem, type Agent } from "../src/sim/agents";
import { WorldClock } from "../src/sim/clock";
import { expandLayout } from "../src/sim/scenery";
import {
  EventLog, MEMORY, MemoryStore, PLAYER_ID, Reputation, SocialSystem, memoryWeight, perceives, retell, segmentHitsBox,
  tellable, type Memory,
} from "../src/sim/social";
import { buildCollisionWorld } from "../src/sim/worldColliders";

const SEED = 20261112;
const layout = expandLayout(layoutJson as unknown as WorldLayout, SEED);
const collision = buildCollisionWorld(layout);
const characters = (charactersJson as unknown as { characters: CharacterDef[] }).characters;
const extras = extrasJson as unknown as ExtrasDef;
const acts = actsJson as unknown as ActsDef;

function world(hour: number) {
  const clock = new WorldClock(24, hour);
  const sys = createAgentSystem(layout, collision, characters, extras, SEED, clock);
  const social = new SocialSystem(sys, acts, characters, SEED);
  const get = (id: string) => sys.agents.find((a) => a.id === id)!;
  const run = (gameHours: number) => {
    const ticks = Math.round((gameHours * 60) / clock.gameMinutesPerRealSecond / clock.timeScale / 0.1);
    for (let i = 0; i < ticks; i++) {
      clock.advance(0.1);
      sys.step(0.1, clock);
      social.step(clock.totalMinutes);
    }
  };
  return { clock, sys, social, get, run };
}
const mem = (over: Partial<Memory> = {}): Memory => ({
  eventId: 1, t: 0, kind: "witnessed", from: null, hops: 0, confidence: 1, importance: 0.8,
  claim: { actorId: PLAYER_ID, act: "assault", targetId: "aldric", districtId: "market", severity: 1 },
  ...over,
});

describe("event log", () => {
  it("stores events and answers location/time/actor queries", () => {
    const log = new EventLog();
    const base = { act: "pickpocket", actorId: PLAYER_ID, apparentActorId: PLAYER_ID, targetId: "aldric", districtId: "market", importance: 0.5, tags: [], witnessIds: [] };
    log.add({ ...base, t: 10, x: 0, z: 0 });
    log.add({ ...base, t: 50, x: 40, z: 0, districtId: "artisans" });
    log.add({ ...base, t: 90, x: 1, z: 1, actorId: "pip" });
    expect(log.query({ near: { x: 0, z: 0, radius: 5 } }).map((e) => e.id)).toEqual([1, 3]);
    expect(log.query({ since: 40, until: 60 }).map((e) => e.id)).toEqual([2]);
    expect(log.query({ actorId: "pip" }).length).toBe(1);
    log.events[0]!.undone = true;
    expect(log.query({}).length).toBe(2);
    expect(log.query({ includeUndone: true }).length).toBe(3);
  });

  it("is bounded", () => {
    const log = new EventLog(10);
    for (let i = 0; i < 25; i++) log.add({ t: i, act: "x", actorId: "a", apparentActorId: "a", targetId: null, x: 0, z: 0, districtId: null, importance: 0, tags: [], witnessIds: [] });
    expect(log.events.length).toBe(10);
    expect(log.events[0]!.id).toBe(16);
  });
});

describe("memory", () => {
  it("fades with time, slower for grudge-holders and for important events", () => {
    const m = mem();
    expect(memoryWeight(m, 0, 0.5)).toBeCloseTo(0.8, 5);
    const day = 1440;
    expect(memoryWeight(m, day, 0)).toBeLessThan(memoryWeight(m, day, 1));
    expect(memoryWeight(mem({ importance: 0.2 }), day, 0.5)).toBeLessThan(memoryWeight(m, day, 0.5));
    expect(memoryWeight(m, 3 * day, 0.2)).toBeLessThan(memoryWeight(m, day, 0.2));
  });

  it("forgets unimportant memories and keeps important ones", () => {
    const store = new MemoryStore();
    store.add("a", mem({ eventId: 1, importance: 0.2 }));
    store.add("a", mem({ eventId: 2, importance: 0.9 }));
    store.consolidate(1.9 * 1440, () => 0, () => -10);
    expect(store.of("a").map((m) => m.eventId)).toEqual([2]);
  });

  it("does not record the same event twice", () => {
    const store = new MemoryStore();
    expect(store.add("a", mem())).toBe(true);
    expect(store.add("a", mem({ kind: "heard" }))).toBe(false);
    expect(store.of("a").length).toBe(1);
  });

  it("summarizes old important memories into a lasting impression", () => {
    const store = new MemoryStore();
    store.add("a", mem({ eventId: 1 }));
    store.add("a", mem({ eventId: 2, claim: { ...mem().claim, act: "pickpocket" } }));
    store.add("a", mem({ eventId: 3, t: 3 * 1440 })); // recent: stays a memory
    store.consolidate((MEMORY.summarizeAfterDays + 1.5) * 1440, () => 1, () => -12);
    expect(store.of("a").map((m) => m.eventId)).toEqual([3]);
    const s = store.summariesOf("a");
    expect(s.length).toBe(1);
    expect(s[0]).toMatchObject({ about: PLAYER_ID, count: 2, sentiment: -24, acts: { assault: 1, pickpocket: 1 } });
  });

  it("returns the most relevant memories about someone", () => {
    const store = new MemoryStore();
    store.add("a", mem({ eventId: 1, importance: 0.3 }));
    store.add("a", mem({ eventId: 2, importance: 0.9 }));
    store.add("a", mem({ eventId: 3, claim: { ...mem().claim, actorId: "pip" } }));
    expect(store.relevant("a", PLAYER_ID, 10, 0.5, 1)[0]!.eventId).toBe(2);
    expect(store.relevant("a", PLAYER_ID, 10, 0.5, 5).length).toBe(2);
  });
});

describe("perception", () => {
  it("detects walls between two points", () => {
    const box = { minX: 0, maxX: 2, minZ: -5, maxZ: 5, height: 4 };
    expect(segmentHitsBox(-3, 0, 5, 0, box)).toBe(true);
    expect(segmentHitsBox(-3, 8, 5, 8, box)).toBe(false);
    expect(segmentHitsBox(-3, 0, -1, 0, box)).toBe(false);
  });

  it("depends on distance, daylight, facing, walls, sleep and invisibility", () => {
    const { get } = world(10);
    const o = { ...get("brann"), x: 0, z: 30, facing: 0, insideOf: null, activity: "work" as const } as Agent; // open ground in lowtown
    const empty = { boxes: [], circles: [], rings: [], boundsRadius: 500 };
    expect(perceives(o, 0, 45, empty, { daylight: 1 })).toBe(true); // 15 m ahead by day
    expect(perceives(o, 0, 45, empty, { daylight: 0 })).toBe(false); // too far at night
    expect(perceives(o, 0, 37, empty, { daylight: 0 })).toBe(true);
    expect(perceives(o, 0, 15, empty, { daylight: 1 })).toBe(false); // behind, out of earshot
    expect(perceives(o, 0, 27, empty, { daylight: 1 })).toBe(true); // behind but close: heard
    const wall = { ...empty, boxes: [{ minX: -5, maxX: 5, minZ: 34, maxZ: 35, height: 4 }] };
    expect(perceives(o, 0, 40, wall, { daylight: 1 })).toBe(false);
    expect(perceives({ ...o, activity: "sleep" }, 0, 33, empty, { daylight: 1 })).toBe(false);
    expect(perceives({ ...o, insideOf: "forge" }, 0, 33, empty, { daylight: 1 })).toBe(false);
    expect(perceives(o, 0, 33, empty, { daylight: 1, actorHidden: true })).toBe(false);
  });
});

describe("reputation", () => {
  const rep = () => new Reputation(acts);
  const { get } = world(10);
  const claim = (act: string, targetId: string | null = "aldric") => ({ actorId: PLAYER_ID, act, targetId, districtId: "market", severity: 1 });

  it("moves each faction according to who learns of the act", () => {
    const r = rep();
    r.inform(get("merchant_1"), claim("pickpocket"), 1, 1, "villagers");
    r.inform(get("guard_day_1"), claim("pickpocket"), 1, 1, "villagers");
    r.inform(get("thief_1"), claim("pickpocket"), 1, 1, "villagers");
    expect(r.factions.villagers).toBeLessThan(0);
    expect(r.factions.royal_guard).toBeLessThan(0);
    expect(r.factions.thieves_guild).toBeGreaterThan(0);
    expect(r.factions.mages_order).toBe(0);
  });

  it("gives the victim a much stronger personal opinion", () => {
    const r = rep();
    r.inform(get("aldric"), claim("pickpocket"), 1, 1, "villagers");
    r.inform(get("merchant_1"), claim("pickpocket"), 1, 1, "villagers");
    expect(r.opinion("aldric")).toBe(acts.acts.pickpocket!.target);
    expect(r.opinion("aldric")).toBeLessThan(r.opinion("merchant_1"));
  });

  it("weighs hearsay less than first-hand knowledge", () => {
    const a = rep();
    const b = rep();
    a.inform(get("merchant_1"), claim("assault"), 1, acts.tuning.witnessWeight, "villagers");
    b.inform(get("merchant_1"), claim("assault"), 1, acts.tuning.rumorWeight, "villagers");
    expect(Math.abs(b.factions.villagers)).toBeLessThan(Math.abs(a.factions.villagers));
  });

  it("caps what a single event can do to a faction, however many people know", () => {
    const r = rep();
    for (let i = 1; i <= 14; i++) r.inform(get(`merchant_${i}`), claim("assault"), 7, 1, "villagers");
    const cap = Math.abs(acts.acts.assault!.opinion.villagers) * acts.tuning.eventCap;
    expect(Math.abs(r.factions.villagers)).toBeLessThanOrEqual(cap + 1e-9);
    // A second, separate event can push further.
    for (let i = 1; i <= 14; i++) r.inform(get(`merchant_${i}`), claim("assault"), 8, 1, "villagers");
    expect(Math.abs(r.factions.villagers)).toBeGreaterThan(cap);
  });

  it("stays within -100..100", () => {
    const r = rep();
    for (let e = 0; e < 60; e++) for (let i = 1; i <= 14; i++) r.inform(get(`merchant_${i}`), claim("assault"), e, 1, "villagers");
    expect(r.factions.villagers).toBe(-100);
    r.adjust("villagers", 500);
    expect(r.factions.villagers).toBe(100);
    expect(r.opinion("merchant_1")).toBeGreaterThanOrEqual(-100);
  });

  it("describes the player from the four reputations, with no single good/evil gauge", () => {
    const r = rep();
    expect(r.portrait()).toMatch(/inconnu/);
    r.adjust("villagers", 60);
    r.adjust("royal_guard", -60);
    expect(r.portrait()).toBe("Héros du peuple, ennemi de la garde.");
  });

  it("only changes personal opinions when someone else is blamed", () => {
    const r = rep();
    r.inform(get("merchant_1"), { ...claim("assault"), actorId: "pip" }, 1, 1, "villagers");
    expect(r.factions.villagers).toBe(0);
    expect(r.opinion("merchant_1", "pip")).toBeLessThan(0);
    expect(r.opinion("merchant_1")).toBe(0);
  });
});

describe("rumors", () => {
  it("waits before a story is repeated", () => {
    expect(tellable(mem({ t: 100 }), 110, acts.tuning.retellDelay)).toBe(false);
    expect(tellable(mem({ t: 100 }), 100 + acts.tuning.retellDelay, acts.tuning.retellDelay)).toBe(true);
  });

  it("loses confidence and counts hops with each retelling", () => {
    const { get } = world(10);
    const second = retell(mem(), get("garn"), 50, acts, () => 0.999, []);
    const third = retell(second, get("brann"), 90, acts, () => 0.999, []);
    expect(second).toMatchObject({ kind: "heard", from: "garn", hops: 1, t: 50 });
    expect(third.hops).toBe(2);
    expect(third.confidence).toBeCloseTo(acts.tuning.hopConfidence ** 2, 6);
    expect(third.claim).toEqual(mem().claim); // faithful when the dice say so
  });

  it("can distort the story: exaggeration, lost place, wrong culprit", () => {
    const { get } = world(10);
    const d = retell(mem(), get("garn"), 50, acts, () => 0, [get("pip")]);
    expect(d.claim.severity).toBeGreaterThan(1);
    expect(d.claim.districtId).toBeNull();
    expect(d.claim.actorId).toBe("pip");
  });
});

describe("social system (acts → witnesses → rumors → reputations)", () => {
  it("does nothing to reputations when nobody sees the act", () => {
    const { social, get, clock } = world(3); // dead of night
    const pip = get("pip");
    const r = social.commit("pickpocket", pip, { actorId: PLAYER_ID, x: 80, z: 80, daylight: 0, targetNotices: false }, clock.totalMinutes);
    expect(r.witnesses.length).toBe(0);
    expect(social.reputation.factions).toEqual({ villagers: 0, royal_guard: 0, thieves_guild: 0, mages_order: 0 });
    expect(social.log.events.length).toBe(1); // …but the world remembers (Echo of the Past)
  });

  it("creates memories for the victim and the witnesses of a public act", () => {
    const { social, get, clock, sys } = world(10);
    const aldric = get("aldric");
    const r = social.commit("assault", aldric, { actorId: PLAYER_ID, x: aldric.x, z: aldric.z, daylight: 1 }, clock.totalMinutes);
    expect(r.witnesses.length).toBeGreaterThan(3);
    expect(social.memory.of("aldric")[0]).toMatchObject({ kind: "suffered", confidence: 1, hops: 0 });
    for (const w of r.witnesses) expect(social.memory.knows(w.id, r.event.id)).toBe(true);
    expect(social.reputation.factions.villagers).toBeLessThan(0);
    expect(social.reputation.opinion("aldric")).toBeLessThanOrEqual(-40);
    // Visible reactions: the victim runs, witnesses show alarm.
    expect(aldric.hurry).toBe(true);
    expect(aldric.emote).toBe("!");
    expect(r.witnesses.every((w) => w.emote !== "")).toBe(true);
    expect(sys.agents.filter((a) => a.reacting).length).toBeGreaterThan(0);
  });

  it("spreads by word of mouth to people who were not there, with delay and weaker confidence", () => {
    const { social, get, clock, run } = world(10);
    const aldric = get("aldric");
    const r = social.commit("assault", aldric, { actorId: PLAYER_ID, x: aldric.x, z: aldric.z, daylight: 1 }, clock.totalMinutes);
    const first = social.informed.get(r.event.id)!;
    const repBefore = social.reputation.factions.villagers;
    run(0.2); // 12 game minutes: too early to retell
    expect(social.informed.get(r.event.id)).toBe(first);
    run(12); // through lunch at the tavern and the evening
    const after = social.informed.get(r.event.id)!;
    expect(after).toBeGreaterThan(first + 10);
    const heard = [...social.memory.memories.values()].flat().filter((m) => m.eventId === r.event.id && m.kind === "heard");
    expect(heard.length).toBe(after - first);
    expect(heard.every((m) => m.confidence < 1 && m.hops >= 1 && m.from !== null)).toBe(true);
    expect(heard.some((m) => m.hops >= 2)).toBe(true);
    expect(social.reputation.factions.villagers).toBeLessThanOrEqual(repBefore);
  });

  it("blames the imitated person when the act is committed under a false face", () => {
    const { social, get, clock } = world(10);
    const aldric = get("aldric");
    const r = social.commit("assault", aldric, { actorId: PLAYER_ID, apparentActorId: "pip", x: aldric.x, z: aldric.z, daylight: 1 }, clock.totalMinutes);
    expect(r.event.actorId).toBe(PLAYER_ID); // ground truth kept in the log
    expect(social.memory.of("aldric")[0]!.claim.actorId).toBe("pip");
    expect(social.reputation.factions.villagers).toBe(0);
    expect(social.reputation.opinion("aldric", "pip")).toBeLessThan(0);
  });

  it("rewards kindness", () => {
    const { social, get, clock } = world(10);
    const margaux = get("margaux");
    social.commit("give_alms", margaux, { actorId: PLAYER_ID, x: margaux.x, z: margaux.z, daylight: 1 }, clock.totalMinutes);
    expect(social.reputation.opinion("margaux")).toBeGreaterThan(0);
    expect(social.reputation.factions.villagers).toBeGreaterThan(0);
  });

  it("is deterministic", () => {
    const play = () => {
      const w = world(10);
      const aldric = w.get("aldric");
      w.social.commit("assault", aldric, { actorId: PLAYER_ID, x: aldric.x, z: aldric.z, daylight: 1 }, w.clock.totalMinutes);
      w.run(6);
      return { rep: w.social.reputation.factions, informed: [...w.social.informed], mem: [...w.social.memory.memories] };
    };
    expect(play()).toEqual(play());
  });
});
