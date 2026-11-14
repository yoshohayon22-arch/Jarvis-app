import type { CharacterDef, ExtrasDef } from "@chronos/shared";
import { SeededRng } from "../../core/rng";
import { shiftSchedule } from "./schedule";
import type { Agent } from "./types";

function baseAgent(index: number, seed: number): Pick<
  Agent,
  | "index" | "x" | "z" | "prevX" | "prevZ" | "facing" | "needs" | "activity" | "place" | "override" | "mode" | "anim"
  | "insideOf" | "emote" | "emoteUntil" | "hurry" | "reacting" | "y" | "frozenUntil" | "timeFactor" | "held" | "pursuing" | "jailedUntil" | "path" | "pathIndex" | "targetX" | "targetZ" | "enterOnArrival" | "routeIndex" | "nextThinkAt" | "stuckTime" | "rng"
> {
  return {
    index,
    x: 0,
    z: 0,
    prevX: 0,
    prevZ: 0,
    facing: 0,
    needs: { hunger: 0, energy: 0, social: 0 },
    activity: "sleep",
    place: "",
    override: false,
    mode: "acting",
    anim: "idle",
    insideOf: null,
    path: [],
    pathIndex: 0,
    targetX: 0,
    targetZ: 0,
    enterOnArrival: null,
    routeIndex: 0,
    nextThinkAt: 0,
    stuckTime: 0,
    emote: "",
    emoteUntil: 0,
    hurry: false,
    reacting: false,
    y: 0,
    frozenUntil: 0,
    timeFactor: 1,
    held: false,
    pursuing: false,
    jailedUntil: 0,
    rng: (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0,
  };
}

/**
 * Builds the whole population from pack data: key characters first, then
 * extras generated deterministically from their archetypes.
 */
export function createPopulation(characters: readonly CharacterDef[], extras: ExtrasDef, seed: number): Agent[] {
  const agents: Agent[] = [];
  const rng = new SeededRng(seed ^ 0x51ed270b);

  for (const c of characters) {
    const firstWork = c.schedule.find((b) => b.do === "work");
    agents.push({
      ...baseAgent(agents.length, seed),
      id: c.id,
      key: true,
      name: c.name,
      role: c.role,
      archetype: "key",
      faction: c.faction,
      look: c.look,
      tint: c.tint,
      scale: c.scale,
      walkSpeed: c.speed,
      traits: { ...c.traits },
      home: c.home,
      work: firstWork ? firstWork.at : `building:${c.home}`,
      schedule: c.schedule.map((b) => ({ ...b })),
    });
  }

  const feminine = new Set(extras.feminineLooks);
  const usedNames = new Map<string, number>();
  for (const a of extras.archetypes) {
    for (let i = 0; i < a.count; i++) {
      const look = rng.pick(a.looks);
      const isF = feminine.has(look);
      const first = rng.pick(isF ? extras.names.f : extras.names.m);
      const n = (usedNames.get(first) ?? 0) + 1;
      usedNames.set(first, n);
      const g = () => rng.range(0.25, 0.75);
      agents.push({
        ...baseAgent(agents.length, seed),
        id: `${a.id}_${i + 1}`,
        key: false,
        name: first,
        role: isF ? a.labelF : a.label,
        archetype: a.id,
        faction: a.faction,
        look,
        tint: rng.pick(a.tints),
        scale: rng.range(a.scale[0], a.scale[1]),
        walkSpeed: rng.range(a.speed[0], a.speed[1]),
        traits: { sociable: g(), brave: g(), honest: g(), greedy: g(), gossip: g(), grudge: g(), devout: g() },
        home: rng.pick(a.homes),
        // Spread work places evenly so no spot is empty or crowded.
        work: a.work[i % a.work.length] as string,
        schedule: shiftSchedule(a.schedule, rng.range(-a.jitter, a.jitter)),
      });
    }
  }
  // Everyone starts the day in a slightly different state.
  for (const a of agents) a.needs = { hunger: rng.range(0.1, 0.4), energy: rng.range(0.05, 0.3), social: rng.range(0.1, 0.5) };
  return agents;
}
