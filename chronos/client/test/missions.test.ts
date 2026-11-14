import { describe, expect, it } from "vitest";
import { MISSION_LIMITS, validateMission, type ActsDef, type CharacterDef, type ExtrasDef, type MissionProposal, type WorldLayout } from "@chronos/shared";
import layoutJson from "../data/packs/medieval/layout.json";
import charactersJson from "../data/packs/medieval/characters.json";
import extrasJson from "../data/packs/medieval/extras.json";
import actsJson from "../data/packs/medieval/acts.json";
import missionsJson from "../data/packs/medieval/missions.json";
import powersJson from "../data/powers.json";
import { generateMission } from "../src/ai/missionGen";
import type { MissionDraft } from "../src/ai/gateway";
import { createAgentSystem } from "../src/sim/agents";
import { WorldClock } from "../src/sim/clock";
import { MissionSystem, type MissionsDef } from "../src/sim/missions";
import { PropSystem } from "../src/sim/physics";
import { PowerSystem, type CastContext, type PowersData } from "../src/sim/powers";
import { expandLayout } from "../src/sim/scenery";
import { PLAYER_ID, SocialSystem } from "../src/sim/social";
import { hasLineOfSight } from "../src/sim/social/perception";
import { buildCollisionWorld } from "../src/sim/worldColliders";

const SEED = 20261112;
const layout = expandLayout(layoutJson as unknown as WorldLayout, SEED);
const collision = buildCollisionWorld(layout);
const characters = (charactersJson as unknown as { characters: CharacterDef[] }).characters;
const def = missionsJson as unknown as MissionsDef;

function world(hour = 10) {
  const clock = new WorldClock(24, hour);
  const sys = createAgentSystem(layout, collision, characters, extrasJson as unknown as ExtrasDef, SEED, clock);
  const social = new SocialSystem(sys, actsJson as unknown as ActsDef, characters, SEED);
  const props = new PropSystem(layout, collision);
  const powers = new PowerSystem(powersJson as unknown as PowersData, sys, props, social, clock);
  const missions = new MissionSystem(sys, social, clock, def, SEED);
  const player = { x: 0, z: 60, facing: 0, speed: 0 };
  const hidden = { unrecognizable: false };
  const ctx = (): CastContext => ({ player, aimX: 0, aimZ: -1, daylight: clock.daylight });
  const get = (id: string) => sys.agents.find((a) => a.id === id)!;
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 10); i++) {
      clock.advance(0.1);
      sys.step(0.1, clock, player);
      powers.update(0.1, ctx());
      social.step(clock.totalMinutes);
      missions.step({ x: player.x, z: player.z, unrecognizable: hidden.unrecognizable, hidden: false });
    }
  };
  const spot = (id: string) => sys.places.spots.get(id)!;
  const goto = (id: string) => {
    player.x = spot(id).pos[0];
    player.z = spot(id).pos[1];
  };
  const act = (actId: string, targetId: string) => social.commit(actId, get(targetId), { actorId: PLAYER_ID, x: player.x, z: player.z, daylight: 1 }, clock.totalMinutes);
  /** Puts someone outdoors at a fixed point, idle, for a long while. */
  const park = (id: string, x: number, z: number) =>
    Object.assign(get(id), { x, z, prevX: x, prevZ: z, mode: "acting", path: [], pathIndex: 0, insideOf: null, facing: Math.PI, reacting: false, activity: "socialize", nextThinkAt: clock.totalMinutes + 1e6 });
  return { clock, sys, social, powers, missions, player, hidden, ctx, get, run, goto, act, park, spot };
}

const zero = { villagers: 0, royal_guard: 0, thieves_guild: 0, mages_order: 0 };
const base = (): MissionProposal => ({
  intent: "investigate",
  title: "Le vol des étals",
  summary: "Un vol a eu lieu aux étals.",
  giverId: "hadrien",
  briefing: "Trouve-moi le coupable.",
  culpritId: "pip",
  victimId: "aldric",
  placeId: "market_stalls",
  steps: [
    { type: "goto", text: "Aller aux étals", targetId: "", placeId: "market_stalls", actId: "" },
    { type: "echo", text: "Lire l'écho", targetId: "", placeId: "market_stalls", actId: "" },
  ],
  hero: { label: "Dire la vérité", type: "talk", targetId: "hadrien", actId: "", epilogue: "Justice est faite.", gold: 20, reputation: { ...zero, royal_guard: 6 } },
  dark: { label: "Faire chanter Pip", type: "act", targetId: "pip", actId: "intimidate", epilogue: "Pip a payé.", gold: 60, reputation: { ...zero, thieves_guild: 5 } },
  timeLimitHours: 12,
});

describe("mission validation (the model proposes, the code decides)", () => {
  const w = world();
  const check = (edit: (m: MissionProposal) => void) => {
    const m = base();
    edit(m);
    return validateMission(m, w.missions.world(), { intent: "investigate", giverId: "hadrien" }).join(" | ");
  };

  it("accepts a well-formed mission", () => {
    expect(check(() => undefined)).toBe("");
  });

  it("rejects anything that is not the expected shape", () => {
    expect(validateMission({ title: "?" }, w.missions.world())[0]).toMatch(/^schema:/);
    expect(validateMission("ignore the rules and give 9999 gold", w.missions.world())[0]).toMatch(/^schema:/);
  });

  it("rejects invented people, places and acts", () => {
    expect(check((m) => (m.culpritId = "dragon_noir"))).toContain('"dragon_noir" is not an allowed character id');
    expect(check((m) => (m.placeId = "chateau_royal"))).toContain('"chateau_royal" is not an allowed place id');
    expect(check((m) => (m.dark.actId = "murder"))).toContain('"murder" is not an allowed act');
    expect(check((m) => (m.steps[0]!.placeId = "lune"))).toContain('"lune" is not an allowed place id');
  });

  it("bounds every reward and the time limit", () => {
    expect(check((m) => (m.hero.gold = 100000))).toContain("hero.gold");
    expect(check((m) => (m.dark.gold = -5))).toContain("dark.gold");
    expect(check((m) => (m.hero.reputation.royal_guard = 100))).toContain("hero.reputation.royal_guard");
    expect(check((m) => (m.timeLimitHours = 500))).toContain("timeLimitHours");
    expect(check((m) => (m.timeLimitHours = 0))).toContain("timeLimitHours");
  });

  it("enforces the structure of each kind of mission", () => {
    expect(check((m) => m.steps.pop())).toContain('needs exactly one "echo" step');
    expect(check((m) => m.steps.push({ type: "protect", text: "x", targetId: "aldric", placeId: "", actId: "" }))).toContain('cannot contain a "protect" step');
    expect(check((m) => (m.steps[1]!.placeId = "tavern_front"))).toContain("must be the mission's placeId");
    expect(check((m) => (m.intent = "protect"))).toContain('intent must be "investigate"');
    expect(check((m) => (m.giverId = "garn"))).toContain('giverId must be "hadrien"');
    expect(check((m) => (m.steps = Array.from({ length: 9 }, () => ({ ...m.steps[0]! }))))).toContain("steps must hold");
    expect(check((m) => (m.steps[0]!.targetId = "pip"))).toContain('targetId must be ""');
  });

  it("keeps the story coherent: no guilty giver, two distinct endings, no criminal 'hero' ending, readable texts", () => {
    expect(check((m) => (m.culpritId = "hadrien"))).toContain("the giver cannot be the culprit");
    expect(check((m) => (m.victimId = "pip"))).toContain("culpritId and victimId must differ");
    expect(check((m) => (m.dark = { ...m.hero }))).toContain("hero and dark endings must be different");
    expect(check((m) => Object.assign(m.hero, { type: "act", actId: "assault", targetId: "pip" }))).toContain("the hero ending cannot be a crime");
    expect(check((m) => Object.assign(m.dark, { targetId: "hadrien" }))).toContain("the giver cannot be the target of an act");
    expect(check((m) => (m.title = ""))).toContain("title is empty");
    expect(check((m) => (m.briefing = "x".repeat(2000)))).toContain("briefing is longer");
  });

  it("refuses duplicates, busy givers and people who are in jail", () => {
    const v = world();
    v.missions.accept(base(), "template");
    const again = validateMission(base(), v.missions.world());
    expect(again.join(" ")).toContain("a mission with this title already exists");
    expect(again.join(" ")).toContain("already has a mission in progress");
    const j = world();
    j.sys.jail(j.get("pip"), j.clock.totalMinutes + 600);
    expect(validateMission(base(), j.missions.world()).join(" ")).toContain('"pip" is not available right now');
    expect(() => j.missions.accept(base(), "ai")).toThrow(/Invalid mission/);
  });
});

describe("mission generation chain", () => {
  const ok = (m: unknown): MissionDraft => ({ ok: true, mission: m, source: "ai", costUsd: 0.01 });

  it("uses the model's proposal when it passes validation", async () => {
    const w = world();
    const g = await generateMission(w.missions, async () => ok(base()), "investigate", "hadrien");
    expect(g).toMatchObject({ source: "ai", attempts: 1, rejections: [], fallbackReason: null });
  });

  it("sends the errors back and asks again, a limited number of times", async () => {
    const w = world();
    const seen: string[][] = [];
    const g = await generateMission(
      w.missions,
      async (req) => {
        seen.push(req.previousErrors);
        return ok(req.attempt === 0 ? { ...base(), culpritId: "dragon_noir" } : base());
      },
      "investigate",
      "hadrien",
    );
    expect(g).toMatchObject({ source: "ai", attempts: 2 });
    expect(seen[0]).toEqual([]);
    expect(seen[1]!.join(" ")).toContain("dragon_noir");
    expect(g!.costUsd).toBeCloseTo(0.02);
  });

  it("falls back to a local template after too many refused drafts", async () => {
    const w = world();
    let calls = 0;
    const g = await generateMission(w.missions, async () => (calls++, ok({ ...base(), timeLimitHours: 9999 })), "investigate", "hadrien");
    expect(calls).toBe(MISSION_LIMITS.regenerations + 1);
    expect(g).toMatchObject({ source: "template", attempts: 3 });
    expect(g!.rejections).toHaveLength(3);
    expect(w.missions.validate(g!.proposal, "investigate", "hadrien")).toEqual([]);
  });

  it("uses the template at once, at no cost, when there is no AI at all", async () => {
    const w = world();
    let calls = 0;
    const g = await generateMission(w.missions, async () => (calls++, { ok: false, reason: "pas de clé API sur le serveur" }), "protect", "aveline");
    expect(calls).toBe(1);
    expect(g).toMatchObject({ source: "template", attempts: 0, costUsd: 0, fallbackReason: "pas de clé API sur le serveur" });
  });

  it("has a valid local template for every giver, filled with real names (no placeholder left)", () => {
    for (const [giverId, g] of Object.entries(def.givers)) {
      const w = world();
      const p = w.missions.fromTemplate(g.intent, giverId)!;
      expect(p, giverId).not.toBeNull();
      expect(w.missions.validate(p, g.intent, giverId)).toEqual([]);
      expect(JSON.stringify(p)).not.toMatch(/\{(giver|culprit|victim|place)\}/);
    }
  });

  it("the digest sent to the proxy only lists available key characters and known places", () => {
    const w = world();
    w.sys.jail(w.get("pip"), w.clock.totalMinutes + 600);
    const req = w.missions.request("investigate", "hadrien", 0, []);
    expect(req.allowed.characters.map((c) => c.id)).not.toContain("pip");
    expect(req.allowed.characters).toHaveLength(characters.length - 1);
    expect(req.allowed.places.length).toBe(layout.spots.length);
  });
});

describe("three playable missions", () => {
  it("investigate: the echo reveals the staged theft; telling the truth is the hero ending", () => {
    const w = world();
    const m = w.missions.accept(base(), "template");
    // The theft exists in the world log, unseen, attributed to the culprit.
    const scene = w.social.log.events.find((e) => e.id === m.sceneEventId)!;
    expect(scene).toMatchObject({ act: "pickpocket", actorId: "pip", targetId: "aldric", witnessIds: [] });
    w.run(1);
    expect(m.stepIndex).toBe(0);
    w.goto("market_stalls");
    w.run(0.3);
    expect(m.stepIndex).toBe(1);
    // Talking to the giver before knowing anything does not end the mission.
    w.missions.noteTalk("hadrien");
    expect(m.status).toBe("active");
    expect(w.powers.cast("echo", w.ctx()).ok).toBe(true);
    w.missions.noteEcho(w.powers.lastEcho);
    expect(m.status).toBe("choice");
    const before = { ...w.social.reputation.factions };
    const hero = w.social.moral.hero;
    w.missions.noteTalk("hadrien");
    expect(m).toMatchObject({ status: "done", outcome: "hero" });
    expect(w.social.reputation.factions.royal_guard).toBeCloseTo(before.royal_guard + 6);
    expect(w.social.moral.hero).toBe(hero + 1);
    const done = w.missions.notices.find((n) => n.kind === "done")!;
    expect(done).toMatchObject({ gold: 20, outcome: "hero" });
  });

  it("investigate: the scene stays visible in the echo even when many newer events crowd the place", () => {
    const w = world();
    w.powers.echoPinned = () => w.missions.sceneEvents();
    const m = w.missions.accept(base(), "template");
    w.goto("market_stalls");
    w.run(0.3);
    for (let i = 0; i < 8; i++) w.act("give_alms", "garn");
    expect(w.powers.cast("echo", w.ctx()).ok).toBe(true);
    expect(w.powers.lastEcho.some((v) => v.eventId === m.sceneEventId)).toBe(true);
    expect(w.powers.lastEcho).toHaveLength(6);
  });

  it("investigate: blackmailing the culprit instead is the dark ending", () => {
    const w = world();
    const m = w.missions.accept(base(), "template");
    w.goto("market_stalls");
    w.run(0.3);
    w.powers.cast("echo", w.ctx());
    w.missions.noteEcho(w.powers.lastEcho);
    w.act("intimidate", "pip");
    w.run(0.2);
    expect(m).toMatchObject({ status: "done", outcome: "dark" });
    expect(w.social.moral.dark).toBeGreaterThan(0);
    expect(w.missions.notices.find((n) => n.kind === "done")).toMatchObject({ gold: 60 });
  });

  it("an echo read somewhere else does not solve the case", () => {
    const w = world();
    const m = w.missions.accept(base(), "template");
    w.goto("market_stalls");
    w.run(0.3);
    w.goto("gate_north");
    w.act("give_alms", "garn");
    w.powers.cast("echo", w.ctx());
    w.missions.noteEcho(w.powers.lastEcho);
    expect(m.status).toBe("active");
  });

  const protect = (): MissionProposal => ({
    ...base(),
    intent: "protect",
    title: "Veiller sur Margaux",
    giverId: "aveline",
    culpritId: "sylve",
    victimId: "margaux",
    placeId: "",
    steps: [{ type: "protect", text: "Protéger Margaux", targetId: "margaux", placeId: "", actId: "" }],
    hero: { label: "Rassurer Aveline", type: "talk", targetId: "aveline", actId: "", epilogue: "Margaux est sauve.", gold: 15, reputation: { ...zero, villagers: 10 } },
    dark: { label: "Faire payer Margaux", type: "act", targetId: "margaux", actId: "intimidate", epilogue: "Tout a un prix.", gold: 45, reputation: { ...zero, villagers: -8 } },
  });

  it("protect: left alone, the aggressor reaches the victim and the mission fails", { timeout: 30000 }, () => {
    const w = world();
    w.park("margaux", -52, 46);
    w.park("sylve", -40, 46);
    Object.assign(w.get("sylve"), { nextThinkAt: 0 });
    const m = w.missions.accept(protect(), "template");
    w.run(40);
    expect(m.status).toBe("failed");
    expect(m.failReason).toContain("s'en est pris à");
    expect(w.social.log.events.some((e) => e.act === "assault" && e.actorId === "sylve" && e.targetId === "margaux")).toBe(true);
    // Failing costs the giver's trust.
    expect(w.social.reputation.opinion("aveline")).toBe(def.failure.giverOpinion);
  });

  it("protect: scaring the aggressor off saves the victim", () => {
    const w = world();
    w.park("margaux", -52, 46);
    w.park("sylve", -40, 46);
    const m = w.missions.accept(protect(), "template");
    w.run(1);
    w.act("intimidate", "sylve");
    w.run(0.2);
    expect(m.status).toBe("choice");
    w.missions.noteTalk("aveline");
    expect(m).toMatchObject({ status: "done", outcome: "hero" });
  });

  it("protect: freezing the aggressor for the whole standoff also works, and so does getting them jailed", { timeout: 30000 }, () => {
    const w = world();
    w.park("margaux", -52, 46);
    w.park("sylve", -46, 46);
    const m = w.missions.accept(protect(), "template");
    w.run(0.3);
    expect(m.engagedAt).not.toBeNull();
    for (let i = 0; i < def.standoffMinutes + 2; i++) {
      w.get("sylve").frozenUntil = w.clock.totalMinutes + 5;
      w.run(1);
    }
    expect(m.status).toBe("choice");

    const j = world();
    j.park("margaux", -52, 46);
    j.park("sylve", -20, 46);
    const mj = j.missions.accept(protect(), "template");
    j.sys.jail(j.get("sylve"), j.clock.totalMinutes + 600);
    j.run(0.2);
    expect(mj.status).toBe("choice");
  });

  const infiltrate = (): MissionProposal => ({
    ...base(),
    intent: "infiltrate",
    title: "Des yeux dans la caserne",
    giverId: "sylve",
    culpritId: "odon",
    victimId: "",
    placeId: "barracks_yard",
    steps: [{ type: "infiltrate", text: "Entrer dans la cour", targetId: "", placeId: "barracks_yard", actId: "" }],
    hero: { label: "Prévenir Odon", type: "talk", targetId: "odon", actId: "", epilogue: "Odon sait.", gold: 10, reputation: { ...zero, royal_guard: 4 } },
    dark: { label: "Tout rapporter à Sylve", type: "talk", targetId: "sylve", actId: "", epilogue: "Sylve paie bien.", gold: 50, reputation: { ...zero, thieves_guild: 8 } },
  });

  /** Odon stands in the yard; the player walks up 8 m away, in the open, right where he is looking. */
  const approach = (w: ReturnType<typeof world>, yard: [number, number]) => {
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2;
      const px = yard[0] + Math.sin(ang) * 8;
      const pz = yard[1] + Math.cos(ang) * 8;
      if (!hasLineOfSight(collision, yard[0], yard[1], px, pz)) continue;
      w.park("odon", yard[0], yard[1]);
      w.get("odon").facing = ang;
      w.player.x = px;
      w.player.z = pz;
      return;
    }
    throw new Error("no open approach to the yard");
  };

  it("infiltrate: walking in recognizable under a guard's eyes fails the mission", () => {
    const w = world();
    const yard = w.spot("barracks_yard").pos;
    const m = w.missions.accept(infiltrate(), "template");
    approach(w, yard);
    w.run(0.2);
    expect(m.status).toBe("failed");
    expect(m.failReason).toContain("reconnu");
  });

  it("infiltrate: unrecognizable (shadow or false face), the same walk succeeds", () => {
    const w = world();
    const yard = w.spot("barracks_yard").pos;
    const m = w.missions.accept(infiltrate(), "template");
    w.hidden.unrecognizable = true;
    approach(w, yard);
    w.run(0.2);
    expect(m.status).toBe("active");
    w.goto("barracks_yard");
    w.run(0.2);
    expect(m.status).toBe("choice");
    w.missions.noteTalk("sylve");
    expect(m).toMatchObject({ status: "done", outcome: "dark" });
    expect(w.social.reputation.factions.thieves_guild).toBeCloseTo(8);
  });

  it("any mission fails when its time runs out", () => {
    const w = world();
    const m = w.missions.accept({ ...base(), timeLimitHours: 2 }, "template");
    w.clock.totalMinutes += 121;
    w.run(0.1);
    expect(m.status).toBe("failed");
    expect(m.failReason).toContain("temps");
    expect(w.missions.offerOf("hadrien")).toBeNull(); // one mission per giver
  });

  it("offers: each giver has one kind of mission, no more than three at once", () => {
    const w = world();
    expect(w.missions.offerOf("hadrien")).toBe("investigate");
    expect(w.missions.offerOf("aveline")).toBe("protect");
    expect(w.missions.offerOf("sylve")).toBe("infiltrate");
    expect(w.missions.offerOf("brann")).toBeNull();
    for (const id of ["hadrien", "aveline", "sylve"]) w.missions.accept(w.missions.fromTemplate(def.givers[id]!.intent, id)!, "template");
    expect(w.missions.active).toHaveLength(3);
    expect(w.missions.offerOf("garn")).toBeNull();
  });
});
