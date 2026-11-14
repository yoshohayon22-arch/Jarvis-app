import { describe, expect, it } from "vitest";
import type { ActsDef, CharacterDef, ExtrasDef, WorldLayout } from "@chronos/shared";
import layoutJson from "../data/packs/medieval/layout.json";
import charactersJson from "../data/packs/medieval/characters.json";
import extrasJson from "../data/packs/medieval/extras.json";
import actsJson from "../data/packs/medieval/acts.json";
import consequencesJson from "../data/packs/medieval/consequences.json";
import powersJson from "../data/powers.json";
import { createAgentSystem } from "../src/sim/agents";
import { AmbientSystem, type AmbientDef } from "../src/sim/ambient";
import { WorldClock } from "../src/sim/clock";
import { ConsequenceSystem, type ConsequencesDef } from "../src/sim/consequences";
import { PropSystem } from "../src/sim/physics";
import { PowerSystem, type CastContext, type PowersData } from "../src/sim/powers";
import { expandLayout } from "../src/sim/scenery";
import { PLAYER_ID, SocialSystem } from "../src/sim/social";
import { buildCollisionWorld } from "../src/sim/worldColliders";

const SEED = 20261112;
const layout = expandLayout(layoutJson as unknown as WorldLayout, SEED);
const collision = buildCollisionWorld(layout);
const characters = (charactersJson as unknown as { characters: CharacterDef[] }).characters;
const acts = actsJson as unknown as ActsDef;
const consDef = consequencesJson as unknown as ConsequencesDef & { ambient: AmbientDef };

function world(hour = 10) {
  const clock = new WorldClock(24, hour);
  const sys = createAgentSystem(layout, collision, characters, extrasJson as unknown as ExtrasDef, SEED, clock);
  const social = new SocialSystem(sys, acts, characters, SEED);
  const props = new PropSystem(layout, collision);
  const powers = new PowerSystem(powersJson as unknown as PowersData, sys, props, social, clock);
  const cons = new ConsequenceSystem(consDef, sys, social, acts, clock);
  const ambient = new AmbientSystem(sys, social, consDef.ambient, clock, SEED);
  const player = { x: 0, z: 14, facing: Math.PI, speed: 0 };
  powers.movePlayer = (x, z, f) => Object.assign(player, { x, z, facing: f });
  const ctx = (): CastContext => ({ player, aimX: 0, aimZ: -1, daylight: clock.daylight });
  const get = (id: string) => sys.agents.find((a) => a.id === id)!;
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 10); i++) {
      clock.advance(0.1);
      sys.step(0.1, clock, powers.cloaked ? null : player);
      props.step(0.1, clock.totalMinutes, sys.agents, powers.timeFactorAt);
      powers.update(0.1, ctx());
      social.step(clock.totalMinutes);
      ambient.step();
      cons.step({ x: player.x, z: player.z, hidden: powers.unrecognizable });
    }
  };
  /**
   * Moves someone to an empty corner of the Bas-Fonds, standing still with their back
   * to the south, and puts the player right behind them (the way to study and imitate unseen).
   */
  const isolate = (id: string, dist = 2) => {
    const a = get(id);
    Object.assign(a, { x: -52, z: 46, prevX: -52, prevZ: 46, mode: "acting", path: [], pathIndex: 0, insideOf: null, facing: Math.PI, nextThinkAt: clock.totalMinutes + 1e6 });
    player.x = a.x;
    player.z = a.z + dist;
    return a;
  };
  /** Stands just south of someone, looking at them. */
  const face = (id: string, dist = 2) => {
    const a = get(id);
    player.x = a.x;
    player.z = a.z + dist;
    return a;
  };
  /** Acts as the game does: under whatever face the player currently wears. */
  const act = (actId: string, targetId: string) =>
    social.commit(actId, get(targetId), { actorId: PLAYER_ID, apparentActorId: powers.apparentId, x: player.x, z: player.z, daylight: clock.daylight, hidden: powers.cloaked }, clock.totalMinutes);
  return { clock, sys, social, props, powers, cons, ambient, player, ctx, get, run, face, act, isolate };
}

describe("echo of the past", () => {
  it("is enabled from data, with hero and dark branches", () => {
    const data = powersJson as unknown as PowersData;
    for (const id of ["echo", "false_face"]) {
      const p = data.powers.find((x) => x.id === id)!;
      expect(p.enabled, id).toBe(true);
      expect(p.abilities.some((a) => a.path === "hero") && p.abilities.some((a) => a.path === "dark"), id).toBe(true);
    }
  });

  it("finds nothing where nothing happened, and costs nothing then", () => {
    const w = world(3);
    w.player.x = -60;
    w.player.z = 40;
    expect(w.powers.cast("echo", w.ctx())).toMatchObject({ ok: false, reason: "nothing_here" });
    expect(w.powers.energy).toBe(100);
  });

  it("replays what the world log holds about a place, most recent first, within its radius", () => {
    const w = world();
    w.face("aldric");
    w.act("pickpocket", "aldric");
    w.run(1);
    w.act("assault", "aldric");
    w.run(1);
    // Something far away must not show up.
    const far = w.get("margaux");
    w.social.commit("assault", far, { actorId: PLAYER_ID, x: far.x, z: far.z, daylight: 1 }, w.clock.totalMinutes);
    expect(Math.hypot(far.x - w.player.x, far.z - w.player.z)).toBeGreaterThan(14);
    expect(w.powers.cast("echo", w.ctx()).ok).toBe(true);
    const v = w.powers.lastEcho;
    expect(v.map((x) => x.act)).toEqual(["assault", "pickpocket"]);
    expect(v[0]).toMatchObject({ actorId: PLAYER_ID, targetId: "aldric", undone: false, masked: false, fold: false });
    expect(v[0]!.age).toBeGreaterThan(0);
    expect(v[0]!.age).toBeLessThan(v[1]!.age);
    // Calling up ghosts in the market is itself witnessed.
    expect(w.social.log.events.at(-1)!.act).toBe("power_echo");
  });

  it("shows erased moments and the fold left by a rewind", () => {
    const w = world();
    w.face("aldric");
    w.run(1);
    w.act("assault", "aldric");
    w.run(1);
    expect(w.powers.cast("rewind", w.ctx()).ok).toBe(true);
    w.run(1);
    w.powers.cast("echo", w.ctx());
    const v = w.powers.lastEcho;
    expect(v.some((x) => x.fold)).toBe(true);
    expect(v.find((x) => x.act === "assault")).toMatchObject({ undone: true });
  });

  it("unmasks an impostor: the echo shows who really did it", () => {
    const w = world();
    const pip = w.isolate("pip");
    w.run(4); // observe Pip from close by, behind his back
    expect(w.powers.cast("disguise", w.ctx()).ok).toBe(true);
    expect(w.powers.disguise?.agentId).toBe("pip");
    w.face("aldric");
    w.act("assault", "aldric");
    expect(w.social.memory.of("aldric")[0]!.claim.actorId).toBe(pip.id); // everyone blames Pip…
    w.powers.dropDisguise();
    w.run(8);
    w.powers.cast("echo", w.ctx());
    const vision = w.powers.lastEcho.find((x) => x.act === "assault")!;
    expect(vision).toMatchObject({ actorId: PLAYER_ID, apparentActorId: "pip", masked: true }); // …but the past does not lie
  });

  it("hero branch names the witnesses; dark branch turns others' crimes and secrets into leverage", () => {
    const w = world();
    const thief = w.get("thief_1");
    const victim = w.face("merchant_1");
    w.social.commit("pickpocket", victim, { actorId: thief.id, x: victim.x, z: victim.z, daylight: 1 }, w.clock.totalMinutes);
    w.social.commit("secret_meeting", w.get("sylve"), { actorId: "odon", x: victim.x, z: victim.z + 1, daylight: 1 }, w.clock.totalMinutes);
    w.powers.cast("echo", w.ctx());
    expect(w.powers.lastEcho.every((x) => x.witnessIds.length === 0)).toBe(true);
    expect(w.powers.leverage.size).toBe(0);

    w.social.moral.hero = 3;
    w.social.moral.dark = 3;
    w.powers.updateUnlocks();
    w.run(7);
    w.powers.cast("echo", w.ctx());
    expect(w.powers.lastEcho.find((x) => x.act === "pickpocket")!.witnessIds.length).toBeGreaterThan(0);
    expect([...w.powers.leverage].sort()).toEqual(["odon", "sylve", thief.id].sort());
  });
});

describe("false face", () => {
  it("requires observing the person from close by first", () => {
    const w = world();
    w.isolate("pip", 6); // too far to study
    w.run(4);
    expect(w.powers.cast("disguise", w.ctx())).toMatchObject({ ok: false, reason: "not_studied" });
    expect(w.powers.studyLeft("pip")).toBeGreaterThan(0);
    w.isolate("pip", 2);
    w.run(3.5);
    expect(w.powers.studyLeft("pip")).toBe(0);
    expect(w.powers.cast("disguise", w.ctx()).ok).toBe(true);
    expect(w.powers.disguise!.agentId).toBe("pip");
    expect(w.powers.apparentId).toBe("pip");
    // Changing face in public was seen (as Kael, before the mask settled).
    const e = w.social.log.events.find((x) => x.act === "power_face")!;
    expect(e.apparentActorId).toBe(PLAYER_ID);
  });

  it("picks the learnt face in a crowd, even with a stranger standing closer", () => {
    const w = world();
    const pip = w.isolate("pip", 2);
    w.run(3.5);
    // A stranger steps in between, slightly off the aim line; the player backs off.
    const stranger = w.sys.agents.find((a) => !a.key && a.id !== "pip")!;
    Object.assign(stranger, { x: pip.x + 0.5, z: pip.z + 2, prevX: pip.x + 0.5, prevZ: pip.z + 2, mode: "acting", path: [], pathIndex: 0, insideOf: null, facing: Math.PI, nextThinkAt: w.clock.totalMinutes + 1e6 });
    w.player.z = pip.z + 5;
    expect(w.powers.studyLeft(stranger.id)).toBeGreaterThan(0);
    expect(w.powers.cast("disguise", w.ctx()).ok).toBe(true);
    expect(w.powers.disguise!.agentId).toBe("pip");
  });

  it("can be dropped at will, and wears off", () => {
    const w = world(3);
    const g = w.sys.agents.find((a) => !a.insideOf)!;
    w.isolate(g.id);
    w.run(4);
    expect(w.powers.cast("disguise", w.ctx()).ok).toBe(true);
    w.player.x = 300; // away from anyone who could see through it
    w.powers.cast("disguise", w.ctx());
    expect(w.powers.disguise).toBeNull();
    w.powers.energy = 100;
    w.isolate(g.id);
    w.run(9);
    expect(w.powers.cast("disguise", w.ctx()).ok).toBe(true);
    w.player.x = 300;
    w.run(55);
    expect(w.powers.disguise).not.toBeNull();
    w.run(8);
    expect(w.powers.disguise).toBeNull();
  });

  it("attributes acts to the imitated person in memories, rumors and opinions — not in the world log", () => {
    const w = world();
    w.isolate("pip");
    w.run(4);
    w.powers.cast("disguise", w.ctx());
    w.face("aldric");
    const r = w.act("pickpocket", "aldric");
    expect(r.event).toMatchObject({ actorId: PLAYER_ID, apparentActorId: "pip" });
    for (const witness of r.witnesses) expect(w.social.memory.of(witness.id).at(-1)!.claim.actorId).toBe("pip");
    expect(w.social.reputation.opinion("aldric", "pip")).toBeLessThan(0);
    expect(w.social.reputation.opinion("aldric", PLAYER_ID)).toBeGreaterThan(-10);
    // The player's own choices still count toward the dark path.
    expect(w.social.moral.dark).toBe(1);
  });

  it("is seen through by someone close to the imitated person", () => {
    const w = world();
    w.isolate("brann");
    w.run(4);
    w.player.z += 5; // step back out of earshot before changing face, or he would turn around
    expect(w.powers.cast("disguise", w.ctx()).ok).toBe(true);
    w.run(0.3);
    expect(w.powers.disguise).not.toBeNull(); // Brann has his back turned
    const garn = w.face("garn", 3); // Brann's old friend
    garn.facing = Math.PI; // back turned: still fooled
    garn.nextThinkAt = w.clock.totalMinutes + 1e6;
    w.run(0.3);
    expect(w.powers.disguise).not.toBeNull();
    garn.facing = 0; // he turns around and looks at "Brann"
    w.run(0.3);
    expect(w.powers.disguise).toBeNull();
    expect(w.powers.spottedBy).toBe("garn");
    const e = w.social.log.events.find((x) => x.act === "impersonation")!;
    expect(e).toMatchObject({ actorId: PLAYER_ID, apparentActorId: PLAYER_ID, targetId: "brann" });
    expect(w.social.reputation.opinion("garn")).toBeLessThan(0);
  });

  it("makes the imitated person turn around if they hear the change happen right behind them", () => {
    const w = world();
    const pip = w.isolate("pip");
    w.run(4);
    w.powers.cast("disguise", w.ctx()); // 2 m behind him: he hears it, turns, and sees his own face
    w.run(0.3);
    expect(w.powers.disguise).toBeNull();
    expect(w.powers.spottedBy).toBe(pip.id);
  });

  it("is seen through by the person themself", () => {
    const w = world();
    const pip = w.isolate("pip");
    w.run(4);
    w.player.z += 5; // out of earshot
    w.powers.cast("disguise", w.ctx());
    w.run(0.3);
    expect(w.powers.disguise).not.toBeNull();
    pip.facing = 0; // Pip turns around and faces his double
    w.run(0.3);
    expect(w.powers.disguise).toBeNull();
    expect(w.social.reputation.opinion("pip")).toBeLessThan(-20);
  });

  it("hides a wanted player from the guard", () => {
    const w = world();
    w.social.reputation.adjust("royal_guard", -45);
    w.isolate("merchant_1");
    w.run(4);
    expect(w.powers.cast("disguise", w.ctx()).ok).toBe(true);
    const guard = w.sys.agents.find((a) => a.faction === "royal_guard" && !a.insideOf)!;
    w.player.x = guard.x + 4;
    w.player.z = guard.z;
    w.run(4);
    expect(w.cons.wantedLevel).toBe(1);
    expect(w.sys.agents.some((a) => a.pursuing)).toBe(false);
  });

  it("gets the imitated person arrested in the player's place", { timeout: 30000 }, () => {
    const w = world();
    const pip = w.isolate("pip");
    w.run(4);
    expect(w.powers.cast("disguise", w.ctx()).ok).toBe(true);
    pip.nextThinkAt = 0; // Pip goes back to his day
    w.face("aldric");
    expect(w.act("assault", "aldric").witnesses.length).toBeGreaterThan(0);
    w.face("merchant_2");
    w.act("assault", "merchant_2");
    expect(pip.jailedUntil).toBeGreaterThan(w.clock.totalMinutes);
    expect(w.cons.notices.some((n) => n.kind === "framed" && /Pip/.test(n.text))).toBe(true);
    w.powers.dropDisguise();
    w.player.x = 300;
    w.clock.timeScale = 20;
    w.run(8); // time for Pip to be walked to the barracks
    expect(pip.insideOf).toBe("barracks");
    // Released the next day, he goes back to his life.
    w.run(60);
    expect(pip.jailedUntil).toBeLessThan(w.clock.totalMinutes);
    expect(pip.insideOf === "barracks" && pip.activity === "sleep" && pip.override).toBe(false);
  });
});

describe("life of its own (ambient events)", () => {
  it("logs thieves' pickpockets and the corrupt guard's night meeting, deterministically", { timeout: 60000 }, () => {
    const play = () => {
      const w = world(9);
      w.player.x = 300;
      w.clock.timeScale = 30;
      w.run(60 * 0.8 * 2); // about 40 game hours
      return w;
    };
    const w = play();
    const thefts = w.social.log.events.filter((e) => e.act === "pickpocket");
    expect(thefts.length).toBeGreaterThan(1);
    for (const e of thefts) {
      expect(w.get(e.actorId).faction).toBe("thieves_guild");
      expect(w.get(e.targetId!).faction).toBe("villagers");
    }
    const meetings = w.social.log.events.filter((e) => e.act === "secret_meeting");
    expect(meetings.some((e) => e.actorId === "odon" && e.targetId === "sylve")).toBe(true);
    // None of this touches the player's reputations.
    expect(w.social.reputation.factions).toEqual({ villagers: 0, royal_guard: 0, thieves_guild: 0, mages_order: 0 });
    expect(play().social.log.events.map((e) => [e.t, e.act, e.actorId, e.targetId])).toEqual(w.social.log.events.map((e) => [e.t, e.act, e.actorId, e.targetId]));
  });

  it("sends a real thief to jail when a guard sees the theft", () => {
    const w = world();
    const thief = w.get("thief_1");
    const guard = w.sys.agents.find((a) => a.faction === "royal_guard" && !a.insideOf)!;
    const victim = w.get("merchant_1");
    thief.x = guard.x + 2;
    thief.z = guard.z;
    guard.facing = Math.PI / 2; // looking east, at the thief
    w.social.commit("pickpocket", victim, { actorId: thief.id, x: thief.x, z: thief.z, daylight: 1 }, w.clock.totalMinutes);
    expect(thief.jailedUntil).toBeGreaterThan(w.clock.totalMinutes);
    expect(w.cons.notices.some((n) => n.kind === "framed")).toBe(false); // not the player's doing
  });
});
