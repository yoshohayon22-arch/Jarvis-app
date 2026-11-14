import type { CharacterDef, ExtrasDef, WorldLayout } from "@chronos/shared";
import type { WorldClock } from "../clock";
import type { CollisionWorld } from "../collision";
import { Places } from "./places";
import { createPopulation } from "./population";
import { AgentSystem } from "./system";

export * from "./types";
export { AgentSystem, AGENT_TUNING } from "./system";
export { Places } from "./places";
export { createPopulation } from "./population";

/** Builds the inhabitants of a pack and places them according to the current time. */
export function createAgentSystem(
  layout: WorldLayout,
  collision: CollisionWorld,
  characters: readonly CharacterDef[],
  extras: ExtrasDef,
  seed: number,
  clock: WorldClock,
): AgentSystem {
  const system = new AgentSystem(createPopulation(characters, extras, seed), new Places(layout, collision));
  system.settle(clock);
  return system;
}
