import { describe, expect, it } from "vitest";
import type { ActsDef, CharacterDef, ExtrasDef, WorldLayout } from "@chronos/shared";
import layoutJson from "../data/packs/medieval/layout.json";
import charactersJson from "../data/packs/medieval/characters.json";
import extrasJson from "../data/packs/medieval/extras.json";
import actsJson from "../data/packs/medieval/acts.json";
import consequencesJson from "../data/packs/medieval/consequences.json";
import missionsJson from "../data/packs/medieval/missions.json";
import powersJson from "../data/powers.json";
import { SAVE_VERSION, applySave, captureSave, checkSave, type SaveGame, type SaveWorld } from "../src/save/saveGame";
import { AUTO_SLOTS, MANUAL_SLOT, MemoryBackend, SaveStore } from "../src/save/store";
import { createAgentSystem } from "../src/sim/agents";
import { AmbientSystem, type AmbientDef } from "../src/sim/ambient";
import { WorldClock } from "../src/sim/clock";
import { ConsequenceSystem, type ConsequencesDef } from "../src/sim/consequences";
import { MissionSystem, type MissionsDef } from "../src/sim/missions";
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

function world(seed = SEED) {
  const clock = new WorldClock(24, 10);
  const agents = createAgentSystem(layout, collision, characters, extrasJson as unknown as ExtrasDef, seed, clock);
  const social = new SocialSystem(agents, acts, characters, seed);
  const props = new PropSystem(layout, collision);
  const powers = new PowerSystem(powersJson as unknown as PowersData, agents, props, social, clock);
  const consequences = new ConsequenceSystem(consDef, agents, social, acts, clock);
  const ambient = new AmbientSystem(agents, social, consDef.ambient, clock, seed);
  const missions = new MissionSystem(agents, social, clock, missionsJson as unknown as MissionsDef, seed);
  const player = { x: 0, z: 14, facing: Math.PI, speed: 0 };
  const w: SaveWorld = { packId: "medieval", seed, clock, agents, social, props, powers, consequences, ambient, missions };
  const ctx = (): CastContext => ({ player, aimX: 0, aimZ: -1, daylight: clock.daylight });
  const run = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 10); i++) {
      clock.advance(0.1);
      agents.step(0.1, clock, player);
      props.step(0.1, clock.totalMinutes, agents.agents, powers.timeFactorAt);
      powers.update(0.1, ctx());
      social.step(clock.totalMinutes);
      ambient.step();
      missions.step({ x: player.x, z: player.z, unrecognizable: powers.unrecognizable, hidden: powers.cloaked });
      consequences.step({ x: player.x, z: player.z, hidden: powers.unrecognizable });
    }
  };
  const get = (id: string) => agents.agents.find((a) => a.id === id)!;
  const act = (actId: string, id: string) => social.commit(actId, get(id), { actorId: PLAYER_ID, x: player.x, z: player.z, daylight: 1 }, clock.totalMinutes);
  /** A compact fingerprint of everything that matters. */
  const digest = () =>
    JSON.stringify({
      t: Math.round(clock.totalMinutes * 1000),
      agents: agents.agents.map((a) => [a.id, Math.round(a.x * 1000), Math.round(a.z * 1000), a.mode, a.activity, a.insideOf]),
      events: social.log.events.map((e) => [e.id, e.act, e.actorId, e.targetId, e.witnessIds.length]),
      rep: social.reputation.factions,
      opinions: [...social.reputation.opinions].length,
      memories: [...social.memory.memories].map(([k, v]) => [k, v.length]),
      feed: social.feed.length,
      energy: Math.round(powers.energy * 100),
      wanted: consequences.wantedLevel,
      terror: [...consequences.terror],
      missions: missions.missions.map((m) => [m.id, m.status, m.stepIndex]),
    });
  return { w, clock, agents, social, powers, consequences, missions, player, ctx, run, get, act, digest };
}

/** A world with some history: crimes, rumors, a power used, a mission running. */
function lived() {
  const a = world();
  a.run(5);
  a.player.x = a.get("aldric").x + 1;
  a.player.z = a.get("aldric").z;
  a.act("assault", "aldric");
  a.act("pickpocket", "aldric");
  a.act("give_alms", "garn");
  a.powers.cast("slow", a.ctx());
  a.missions.accept(a.missions.fromTemplate("investigate", "hadrien")!, "template");
  a.social.reputation.adjust("royal_guard", -35);
  a.run(60);
  return a;
}

describe("save games", () => {
  it("captures a save that passes its own schema and survives JSON", () => {
    const a = lived();
    const save = captureSave(a.w, { x: a.player.x, z: a.player.z, facing: 0, coins: 7 }, [["garn", { key: "k", text: "Tu te souviens…" }]], 1234);
    expect(checkSave(save, a.w)).toBeNull();
    expect(checkSave(JSON.parse(JSON.stringify(save)), a.w)).toBeNull();
    expect(save).toMatchObject({ version: SAVE_VERSION, packId: "medieval", seed: SEED, savedAt: 1234, label: a.clock.format() });
    expect(save.social.events.length).toBeGreaterThan(3);
    expect(save.missions.missions).toHaveLength(1);
  });

  it("restores the world exactly: a loaded game then plays out the same as the original", { timeout: 60000 }, () => {
    const a = lived();
    const save = JSON.parse(JSON.stringify(captureSave(a.w, { x: a.player.x, z: a.player.z, facing: 0, coins: 7 }))) as SaveGame;
    const b = world();
    expect(b.digest()).not.toBe(a.digest());
    const p = applySave(save, b.w);
    Object.assign(b.player, { x: p.x, z: p.z });
    expect(p.coins).toBe(7);
    expect(b.digest()).toBe(a.digest());
    // Same future, including rumors, schedules and the guard's hunt.
    a.run(90);
    b.run(90);
    expect(b.digest()).toBe(a.digest());
    expect(b.social.log.events.length).toBe(a.social.log.events.length);
  });

  it("keeps reputations, memories, unlocked powers, flags and missions", () => {
    const a = lived();
    a.social.moral.dark = 3;
    a.powers.updateUnlocks();
    const save = captureSave(a.w, { x: 0, z: 0, facing: 0, coins: 0 });
    const b = world();
    applySave(save, b.w);
    expect(b.social.reputation.factions).toEqual(a.social.reputation.factions);
    expect(b.social.topMemoryAbout(b.get("aldric"), PLAYER_ID, b.clock.totalMinutes)).toEqual(a.social.topMemoryAbout(a.get("aldric"), PLAYER_ID, a.clock.totalMinutes));
    expect([...b.powers.unlocked].sort()).toEqual([...a.powers.unlocked].sort());
    expect(b.powers.unlocked.has("time_loop")).toBe(true);
    expect(b.missions.active[0]!.proposal.title).toBe(a.missions.active[0]!.proposal.title);
    expect(b.missions.offerOf("hadrien")).toBeNull();
    // A save is a copy: changing the loaded world does not touch the save.
    b.social.reputation.adjust("villagers", 50);
    expect(save.social.reputation.factions.villagers).toBe(a.social.reputation.factions.villagers);
  });

  it("refuses broken, foreign or outdated saves without touching the world", () => {
    const a = lived();
    const good = captureSave(a.w, { x: 0, z: 0, facing: 0, coins: 0 });
    const b = world();
    const before = b.digest();
    expect(checkSave(null, b.w)).toMatch(/illisible/);
    expect(checkSave("{}", b.w)).toMatch(/illisible/);
    expect(checkSave({ ...good, version: 99 }, b.w)).toMatch(/version/);
    expect(checkSave({ ...good, packId: "ancient" }, b.w)).toMatch(/autre époque/);
    expect(checkSave({ ...good, seed: 1 }, b.w)).toMatch(/autre monde/);
    expect(checkSave({ ...good, agents: good.agents.slice(1) }, b.w)).toMatch(/habitants/);
    expect(checkSave({ ...good, player: { x: Number.NaN, z: 0, facing: 0, coins: 0 } }, b.w)).toMatch(/illisible/);
    expect(checkSave({ ...good, social: { ...good.social, events: "none" } }, b.w)).toMatch(/illisible/);
    expect(b.digest()).toBe(before);
  });
});

describe("save slots", () => {
  const fake = (savedAt: number, label = "x"): SaveGame => ({ savedAt, label }) as SaveGame;

  it("rotates three autosaves, overwriting the oldest, and keeps the manual slot apart", async () => {
    const store = new SaveStore(new MemoryBackend());
    expect(await store.latest()).toBeNull();
    await store.saveManual(fake(5, "manuel"));
    const used: string[] = [];
    for (const t of [10, 20, 30, 40, 50]) used.push(await store.saveAuto(fake(t, `auto ${t}`)));
    expect(used.slice(0, 3).sort()).toEqual([...AUTO_SLOTS]);
    expect(used[3]).toBe(used[0]);
    expect(used[4]).toBe(used[1]);
    const list = await store.list();
    expect(list.map((s) => s.savedAt)).toEqual([50, 40, 30, 5]);
    expect((await store.latest())!.label).toBe("auto 50");
    expect(list.find((s) => s.slot === MANUAL_SLOT)!.label).toBe("manuel");
    await store.delete(MANUAL_SLOT);
    expect(await store.list()).toHaveLength(3);
  });

  it("ignores garbage found in storage", async () => {
    const backend = new MemoryBackend();
    backend.data.set("auto-0", "not a save");
    backend.data.set("manual", { savedAt: 3, label: "ok" });
    expect((await new SaveStore(backend).list()).map((s) => s.slot)).toEqual(["manual"]);
  });
});
