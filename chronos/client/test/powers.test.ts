import { describe, expect, it } from "vitest";
import type { ActsDef, CharacterDef, ExtrasDef, WorldLayout } from "@chronos/shared";
import layoutJson from "../data/packs/medieval/layout.json";
import charactersJson from "../data/packs/medieval/characters.json";
import extrasJson from "../data/packs/medieval/extras.json";
import actsJson from "../data/packs/medieval/acts.json";
import consequencesJson from "../data/packs/medieval/consequences.json";
import powersJson from "../data/powers.json";
import { createAgentSystem } from "../src/sim/agents";
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
const data = powersJson as unknown as PowersData;

function world(hour = 10) {
  const clock = new WorldClock(24, hour);
  const sys = createAgentSystem(layout, collision, characters, extrasJson as unknown as ExtrasDef, SEED, clock);
  const social = new SocialSystem(sys, acts, characters, SEED);
  const props = new PropSystem(layout, collision);
  const powers = new PowerSystem(data, sys, props, social, clock);
  const cons = new ConsequenceSystem(consequencesJson as unknown as ConsequencesDef, sys, social, acts, clock);
  const player = { x: 0, z: 14, facing: Math.PI, speed: 0, hidden: false };
  let coins = 10;
  powers.captureExtra = () => ({ coins });
  powers.restoreExtra = (e) => (coins = (e as { coins: number }).coins);
  powers.movePlayer = (x, z, f) => Object.assign(player, { x, z, facing: f });
  let arrests = 0;
  cons.onArrest = () => arrests++;
  const ctx = (): CastContext => ({ player, aimX: 0, aimZ: -1, daylight: clock.daylight });
  const get = (id: string) => sys.agents.find((a) => a.id === id)!;
  /** Runs real seconds of simulation at 10 Hz. */
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 10); i++) {
      clock.advance(0.1);
      sys.step(0.1, clock, player.hidden ? null : player);
      props.step(0.1, clock.totalMinutes, sys.agents, powers.timeFactorAt);
      powers.update(0.1, ctx());
      player.hidden = powers.cloaked;
      social.step(clock.totalMinutes);
      cons.step(player);
    }
  };
  return { clock, sys, social, props, powers, cons, player, ctx, get, run, coins: () => coins, setCoins: (n: number) => (coins = n), arrests: () => arrests };
}

describe("powers data", () => {
  it("defines the three J5 powers with a hero and a dark branch each, and V2 placeholders", () => {
    const active = data.powers.filter((p) => p.enabled).map((p) => p.id);
    expect(active).toEqual(["time_control", "telekinesis", "shadow"]);
    for (const p of data.powers.filter((x) => x.enabled)) {
      expect(p.abilities.some((a) => a.path === "hero"), p.id).toBe(true);
      expect(p.abilities.some((a) => a.path === "dark"), p.id).toBe(true);
      expect(acts.acts[p.witnessAct!], p.id).toBeTruthy();
      for (const a of p.abilities) if (a.act) expect(acts.acts[a.act], a.id).toBeTruthy();
    }
    for (const id of ["summon_dead", "possession", "portals", "beast_mastery"]) expect(data.powers.find((p) => p.id === id)?.enabled, id).toBe(false);
  });
});

describe("energy, costs and cooldowns", () => {
  it("spends energy, enforces the cooldown and recharges over time", () => {
    const w = world();
    expect(w.powers.cast("slow", w.ctx()).ok).toBe(true);
    expect(w.powers.energy).toBe(80);
    expect(w.powers.cast("slow", w.ctx())).toMatchObject({ ok: false, reason: "cooldown" });
    w.run(9);
    expect(w.powers.energy).toBe(100);
    expect(w.powers.cast("slow", w.ctx()).ok).toBe(true);
  });

  it("refuses to cast without enough energy", () => {
    const w = world();
    w.powers.energy = 10;
    expect(w.powers.cast("freeze", w.ctx())).toMatchObject({ ok: false, reason: "energy" });
    expect(w.powers.energy).toBe(10);
  });

  it("keeps branch abilities locked until the player's deeds unlock them", () => {
    const w = world();
    expect(w.powers.cast("time_loop", w.ctx())).toMatchObject({ ok: false, reason: "locked" });
    w.social.moral.dark = 3;
    expect(w.powers.updateUnlocks().map((a) => a.id).sort()).toEqual(["crush", "light_fingers", "time_loop"]);
    expect(w.powers.updateUnlocks()).toEqual([]);
    w.social.moral.hero = 3;
    expect(w.powers.updateUnlocks().map((a) => a.id).sort()).toEqual(["guardian_stasis", "helping_hand", "watcher"]);
    // The hero upgrade changes how the base ability works, from data alone.
    expect(w.powers.resolved("freeze")).toMatchObject({ duration: 6, effects: [{ primitive: "freezeTargets", maxTargets: 8 }] });
  });

  it("refuses disabled and unknown powers", () => {
    const w = world();
    expect(w.powers.cast("nope", w.ctx()).reason).toBe("unknown");
  });
});

describe("time control", () => {
  it("slows everyone inside the bubble, but not people outside", () => {
    const w = world();
    const walkers = () => w.sys.agents.filter((a) => a.mode === "moving" && !a.insideOf);
    w.player.x = 0;
    w.player.z = 4;
    w.powers.cast("slow", w.ctx());
    w.run(0.3);
    const inside = w.sys.agents.filter((a) => !a.insideOf && Math.hypot(a.x, a.z - 4) < 8);
    const outside = w.sys.agents.filter((a) => !a.insideOf && Math.hypot(a.x, a.z - 4) > 12);
    expect(inside.length).toBeGreaterThan(2);
    expect(inside.every((a) => a.timeFactor === 0.25)).toBe(true);
    expect(outside.every((a) => a.timeFactor === 1)).toBe(true);
    expect(walkers().length).toBeGreaterThan(0);
    w.run(7);
    expect(w.sys.agents.every((a) => a.timeFactor === 1)).toBe(true);
  });

  it("freezes the nearest people for a few seconds", () => {
    const w = world();
    w.player.x = 0;
    w.player.z = 4;
    w.powers.cast("freeze", w.ctx());
    w.run(0.2);
    const frozen = w.sys.agents.filter((a) => a.timeFactor === 0);
    expect(frozen.length).toBe(3);
    const before = frozen.map((a) => [a.x, a.z]);
    w.run(2);
    expect(frozen.map((a) => [a.x, a.z])).toEqual(before);
    w.run(3);
    expect(w.sys.agents.every((a) => a.timeFactor > 0)).toBe(true);
  });

  it("rewinds a crime: positions, memories, reputations and coins are as before", () => {
    const w = world();
    const aldric = w.get("aldric");
    w.player.x = aldric.x + 1;
    w.player.z = aldric.z;
    w.run(1);
    const repBefore = { ...w.social.reputation.factions };
    const pos = [aldric.x, aldric.z];
    w.setCoins(14); // loot of the theft we are about to undo
    w.social.commit("assault", aldric, { actorId: PLAYER_ID, x: w.player.x, z: w.player.z, daylight: 1 }, w.clock.totalMinutes);
    w.run(2); // he flees, witnesses remember
    expect(w.social.reputation.factions.villagers).toBeLessThan(0);
    expect(Math.hypot(aldric.x - pos[0]!, aldric.z - pos[1]!)).toBeGreaterThan(2);
    expect(w.social.moral.dark).toBe(1);
    w.setCoins(14);

    expect(w.powers.cast("rewind", w.ctx()).ok).toBe(true);
    expect(Math.hypot(aldric.x - pos[0]!, aldric.z - pos[1]!)).toBeLessThan(0.5);
    expect(w.social.memory.of("aldric").filter((m) => m.claim.act === "assault")).toEqual([]);
    // Only the (small) unease at seeing time bend remains, not the hatred of the assault.
    expect(w.social.reputation.opinion("aldric")).toBeGreaterThan(-6);
    expect(w.social.moral.dark).toBe(0);
    const assault = w.social.log.events.find((e) => e.act === "assault")!;
    expect(assault.undone).toBe(true);
    // The fold leaves a trace in the world log (for Echo of the Past)…
    expect(w.social.log.events.some((e) => e.act === "time_fold")).toBe(true);
    // …and bending time in public is itself witnessed.
    expect(w.social.log.events.some((e) => e.act === "power_time" && !e.undone)).toBe(true);
    expect(w.social.reputation.factions.villagers).toBeGreaterThan(repBefore.villagers - 3);
  });

  it("does not rewind what is far away", () => {
    const w = world();
    w.run(3);
    const far = w.sys.agents.find((a) => !a.insideOf && a.mode === "moving" && Math.hypot(a.x - w.player.x, a.z - w.player.z) > 25)!;
    const pos = [far.x, far.z];
    w.powers.cast("rewind", w.ctx());
    expect([far.x, far.z]).toEqual(pos);
  });

  it("dark path: traps someone in a loop that drags them back", () => {
    const w = world();
    w.social.moral.dark = 3;
    w.powers.updateUnlocks();
    const aimed = w.get("pip");
    w.player.x = aimed.x;
    w.player.z = aimed.z + 3;
    expect(w.powers.cast("time_loop", w.ctx()).ok).toBe(true);
    const event = w.social.log.events.at(-1)!;
    expect(event.act).toBe("time_torment");
    // The victim is whoever stood in the line of aim (possibly someone closer than Pip).
    const pip = w.get(event.targetId!);
    const start = [pip.x, pip.z];
    let resets = 0;
    let wasAway = false;
    for (let i = 0; i < 60; i++) {
      w.run(0.1);
      const d = Math.hypot(pip.x - start[0]!, pip.z - start[1]!);
      if (d > 0.8) wasAway = true;
      if (wasAway && d < 0.3) {
        resets++;
        wasAway = false;
      }
    }
    expect(resets).toBeGreaterThanOrEqual(2);
    expect(w.social.reputation.opinion(pip.id)).toBeLessThan(-30);
  });
});

describe("telekinesis", () => {
  const nearBarrel = (w: ReturnType<typeof world>) => {
    const prop = w.props.props.find((p) => p.kind === "barrel")!;
    w.player.x = prop.x;
    w.player.z = prop.z + 4;
    return prop;
  };

  it("lifts the aimed object, carries it, then throws it", () => {
    const w = world(3); // night: nobody around to hit
    nearBarrel(w);
    expect(w.powers.cast("grab", w.ctx()).ok).toBe(true);
    const prop = (w.powers.holding as { prop: (typeof w.props.props)[number] }).prop; // the nearest one in the line of aim
    const start = [prop.x, prop.z];
    w.run(1);
    expect(prop.held).toBe(true);
    expect(prop.y).toBeGreaterThan(1.2);
    expect(Math.hypot(prop.x - w.player.x, prop.z - (w.player.z - 2.4))).toBeLessThan(0.3);
    const energy = w.powers.energy;
    w.run(1);
    expect(w.powers.energy).toBeLessThan(energy); // holding drains
    w.player.z += 30; // open ground to the south
    w.player.x = 30;
    w.run(1);
    expect(w.powers.cast("grab", { ...w.ctx(), aimX: 1, aimZ: 0 }).ok).toBe(true);
    expect(prop.held).toBe(false);
    w.run(3);
    expect(prop.y).toBe(0);
    expect(Math.hypot(prop.x - start[0]!, prop.z - start[1]!)).toBeGreaterThan(8);
    expect(Math.hypot(prop.vx, prop.vz)).toBe(0);
  });

  it("fails cleanly when nothing is in range", () => {
    const w = world(3);
    w.player.x = -60;
    w.player.z = 40;
    expect(w.powers.cast("grab", w.ctx())).toMatchObject({ ok: false, reason: "no_target" });
    expect(w.powers.energy).toBe(100);
  });

  it("combines with time: a frozen object stores the push and releases it on thaw", () => {
    const w = world(3);
    const prop = nearBarrel(w);
    w.powers.cast("freeze", w.ctx());
    const start = [prop.x, prop.z];
    w.props.impulse(prop, 9, 2, 0, w.clock.totalMinutes);
    w.run(2);
    expect([prop.x, prop.z]).toEqual(start); // still frozen in place
    expect(prop.pendingVx).toBe(9);
    w.run(4);
    expect(prop.x - start[0]!).toBeGreaterThan(2); // thawed: the stored push fired
    expect(prop.pendingVx).toBe(0);
  });

  it("a thrown object that hits someone is an assault with consequences", () => {
    const w = world();
    const aldric = w.get("aldric");
    const prop = w.props.props[0]!;
    Object.assign(prop, { x: aldric.x - 2, y: 1, z: aldric.z, vx: 12, vy: 0, vz: 0 });
    w.run(0.5);
    const e = w.social.log.events.find((x) => x.act === "tk_strike")!;
    expect(e.targetId).toBe("aldric");
    expect(w.social.reputation.opinion("aldric")).toBeLessThan(-30);
    expect(w.cons.terror.get("market")).toBeGreaterThan(0);
  });

  it("shoves the aimed person away", () => {
    const w = world();
    const brann = w.get("brann");
    w.player.x = brann.x;
    w.player.z = brann.z + 3;
    const z0 = brann.z;
    expect(w.powers.cast("shove", w.ctx()).ok).toBe(true);
    w.run(1.5);
    expect(brann.held).toBe(false);
    expect(brann.y).toBe(0);
    expect(Math.hypot(brann.x - w.player.x, brann.z - w.player.z)).toBeGreaterThan(4);
    expect(brann.z).toBeLessThan(z0 + 0.5);
    expect(w.social.log.events.some((e) => e.act === "tk_shove" && e.targetId === "brann")).toBe(true);
  });

  it("only lifts people once a branch allows it: gently (hero) or to throw them (dark)", () => {
    const hero = world();
    const near = hero.get("margaux");
    hero.player.x = near.x;
    hero.player.z = near.z + 3;
    hero.props.props.forEach((p) => (p.x = 500)); // no object in the way
    expect(hero.powers.cast("grab", hero.ctx()).reason).toBe("no_target");
    hero.social.moral.hero = 3;
    hero.powers.updateUnlocks();
    expect(hero.powers.cast("grab", hero.ctx()).ok).toBe(true);
    const m = (hero.powers.holding as { agent: ReturnType<typeof hero.get> }).agent;
    hero.run(1);
    expect(m.held).toBe(true);
    expect(m.y).toBeGreaterThan(1);
    hero.powers.cast("grab", hero.ctx());
    hero.run(0.5);
    expect(m).toMatchObject({ held: false, y: 0 });
    expect(hero.social.log.events.some((e) => e.act === "tk_crush")).toBe(false);

    const dark = world();
    const victim = dark.get("aldric");
    dark.player.x = victim.x;
    dark.player.z = victim.z + 3;
    dark.props.props.forEach((p) => (p.x = 500));
    dark.social.moral.dark = 3;
    dark.powers.updateUnlocks();
    dark.powers.cast("grab", dark.ctx());
    const a = (dark.powers.holding as { agent: ReturnType<typeof dark.get> }).agent;
    dark.run(1);
    dark.powers.cast("grab", dark.ctx());
    dark.run(3);
    expect(a).toMatchObject({ held: false, y: 0 });
    expect(dark.social.log.events.some((e) => e.act === "tk_crush" && e.targetId === a.id)).toBe(true);
  });
});

describe("time jumps", () => {
  it("keeps rewinding and consequences working after the clock is set back", () => {
    const w = world(11);
    w.run(2);
    w.clock.totalMinutes = 10 * 60; // debug "set hour" to earlier the same day
    w.sys.settle(w.clock);
    w.run(2);
    expect(w.powers.history.length).toBeGreaterThan(3);
    w.social.reputation.adjust("royal_guard", -45);
    w.player.x = 300; // nobody around: just check the rules are evaluated again
    w.run(1.5);
    expect(w.cons.wantedLevel).toBe(1);
    const aldric = w.get("aldric");
    w.player.x = aldric.x + 1;
    w.player.z = aldric.z;
    w.run(1);
    w.social.commit("assault", aldric, { actorId: PLAYER_ID, x: w.player.x, z: w.player.z, daylight: 1 }, w.clock.totalMinutes);
    w.run(0.5);
    expect(w.powers.cast("rewind", w.ctx()).ok).toBe(true);
    expect(w.social.log.events.find((e) => e.act === "assault")!.undone).toBe(true);
  });
});

describe("shadow", () => {
  it("hides acts from witnesses while cloaked, and drains energy until it drops", () => {
    const w = world();
    const aldric = w.get("aldric");
    w.player.x = aldric.x + 1;
    w.player.z = aldric.z;
    expect(w.powers.cast("cloak", w.ctx()).ok).toBe(true);
    expect(w.powers.cloaked).toBe(true);
    // Vanishing in the middle of the market was seen.
    expect(w.social.log.events.at(-1)!.act).toBe("power_shadow");
    expect(w.social.log.events.at(-1)!.witnessIds.length).toBeGreaterThan(0);
    const r = w.social.commit("pickpocket", aldric, { actorId: PLAYER_ID, x: w.player.x, z: w.player.z, daylight: 1, hidden: true, targetNotices: false }, w.clock.totalMinutes);
    expect(r.witnesses.length).toBe(0);
    w.player.speed = 3;
    w.run(20);
    expect(w.powers.cloaked).toBe(false); // out of energy
    expect(w.powers.energy).toBeLessThan(30);
  });

  it("hero path: standing still barely drains; dark path: doubles theft loot", () => {
    const w = world(3);
    w.social.moral.hero = 3;
    w.social.moral.dark = 3;
    w.powers.updateUnlocks();
    w.powers.cast("cloak", w.ctx());
    expect(w.powers.theftMultiplier).toBe(2);
    w.player.speed = 0;
    w.run(10);
    expect(w.powers.energy).toBeGreaterThan(70);
    w.powers.reveal();
    expect(w.powers.theftMultiplier).toBe(1);
  });
});

describe("consequences", () => {
  it("guards chase and arrest a wanted player who lets himself be seen", () => {
    const w = world();
    w.social.reputation.adjust("royal_guard", -45);
    const guard = w.sys.agents.find((a) => a.faction === "royal_guard" && !a.insideOf)!;
    w.player.x = guard.x + 14;
    w.player.z = guard.z;
    w.run(1.2);
    expect(w.cons.wantedLevel).toBe(1);
    expect(w.cons.notices.some((n) => n.kind === "rule_on" && /recherche/.test(n.text))).toBe(true);
    expect(w.sys.agents.some((a) => a.pursuing)).toBe(true);
    expect(w.arrests()).toBe(0); // not caught yet: they have to reach him
    w.run(10);
    expect(w.arrests()).toBe(1);
    expect(w.social.reputation.factions.royal_guard).toBe(-20);
    expect(w.cons.wantedLevel).toBe(0);
    expect(w.sys.agents.some((a) => a.pursuing)).toBe(false);
  });

  it("an invisible player is neither seen nor caught", () => {
    const w = world();
    w.social.reputation.adjust("royal_guard", -45);
    const guard = w.sys.agents.find((a) => a.faction === "royal_guard" && !a.insideOf)!;
    w.player.x = guard.x + 3;
    w.player.z = guard.z;
    w.powers.energy = 1e6; // long cloak for the test
    w.powers.cloaked = true;
    w.player.hidden = true;
    w.run(6);
    expect(w.sys.agents.some((a) => a.pursuing)).toBe(false);
    expect(w.arrests()).toBe(0);
  });

  it("escalates to a general manhunt at very low reputation", () => {
    const w = world();
    w.social.reputation.adjust("royal_guard", -75);
    const guard = w.sys.agents.find((a) => a.faction === "royal_guard" && !a.insideOf)!;
    w.player.x = guard.x + 15;
    w.player.z = guard.z;
    w.run(1.5);
    expect(w.cons.wantedLevel).toBe(2);
    const outdoors = w.sys.agents.filter((a) => a.faction === "royal_guard" && !a.insideOf);
    expect(outdoors.every((a) => a.pursuing)).toBe(true);
  });

  it("terror empties a district, then it recovers", () => {
    const w = world();
    const outsideIn = (d: string) => w.sys.agents.filter((a) => !a.insideOf && a.faction !== "royal_guard" && w.sys.places.districtOf(a.place) === d).length;
    const before = outsideIn("market");
    expect(before).toBeGreaterThan(10);
    for (const id of ["aldric", "merchant_1", "merchant_2"]) {
      const a = w.get(id);
      w.social.commit("assault", a, { actorId: PLAYER_ID, x: a.x, z: a.z, daylight: 1 }, w.clock.totalMinutes);
    }
    w.run(1.5);
    expect(w.cons.terrorized.has("market")).toBe(true);
    expect(w.cons.notices.some((n) => n.kind === "district_terrorized")).toBe(true);
    w.player.x = 300; // leave them alone
    w.clock.timeScale = 20;
    w.run(6); // two game hours
    expect(outsideIn("market")).toBeLessThan(before * 0.3);
    // Days later the fear has faded and life returns.
    w.cons.terror.set("market", 0.2);
    w.run(1);
    expect(w.cons.terrorized.has("market")).toBe(false);
  });

  it("a betrayed ally denounces the player to the guard", () => {
    const w = world();
    const garn = w.get("garn");
    w.social.reputation.nudgeOpinion("garn", 40);
    w.run(1.5);
    expect(w.cons.allies.has("garn")).toBe(true);
    const guardBefore = w.social.reputation.factions.royal_guard;
    w.social.commit("assault", garn, { actorId: PLAYER_ID, x: 300, z: 300, daylight: 0 }, w.clock.totalMinutes); // unseen: only he knows
    w.social.reputation.nudgeOpinion("garn", -20);
    w.run(1.5);
    expect(w.cons.betrayers.has("garn")).toBe(true);
    expect(w.social.reputation.factions.royal_guard).toBeLessThan(guardBefore);
    expect(w.cons.notices.some((n) => n.kind === "betrayal" && /Garn/.test(n.text))).toBe(true);
    expect(w.social.feed.some((f) => /dénoncé/.test(f.text))).toBe(true);
  });

  it("turns reputations into world flags from pack rules", () => {
    const w = world();
    w.social.reputation.adjust("villagers", 60);
    w.social.reputation.adjust("thieves_guild", 50);
    w.run(1.5);
    expect([...w.cons.flags].sort()).toEqual(["guild_friend", "market_festive"]);
    w.social.reputation.adjust("villagers", -30);
    w.run(1.5);
    expect(w.cons.flags.has("market_festive")).toBe(false);
    expect(w.cons.notices.some((n) => n.kind === "rule_off")).toBe(true);
  });
});
