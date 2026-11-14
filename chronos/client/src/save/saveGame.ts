import { z } from "zod";
import type { AgentSystem, Agent } from "../sim/agents";
import type { AmbientSave, AmbientSystem } from "../sim/ambient";
import type { WorldClock } from "../sim/clock";
import type { ConsequenceSystem, ConsequencesSave } from "../sim/consequences";
import type { MissionSystem, MissionsSave } from "../sim/missions";
import type { DynamicProp, PropSystem } from "../sim/physics";
import type { PowerSystem } from "../sim/powers";
import type { PowersSave } from "../sim/powers/engine";
import type { SocialSave, SocialSystem } from "../sim/social";

export const SAVE_VERSION = 1;

/** The systems a save covers. Rendering holds no state of its own: it redraws from these. */
export interface SaveWorld {
  packId: string;
  seed: number;
  clock: WorldClock;
  agents: AgentSystem;
  social: SocialSystem;
  props: PropSystem;
  powers: PowerSystem;
  consequences: ConsequenceSystem;
  ambient: AmbientSystem;
  missions: MissionSystem;
}

export interface PlayerSave {
  x: number;
  z: number;
  facing: number;
  coins: number;
}

export interface SaveGame {
  version: number;
  packId: string;
  seed: number;
  /** Real time of the save (ms since epoch) and a label for the menu ("Jour 2, 10:05"). */
  savedAt: number;
  label: string;
  totalMinutes: number;
  player: PlayerSave;
  agents: Agent[];
  props: DynamicProp[];
  social: SocialSave;
  powers: PowersSave;
  consequences: ConsequencesSave;
  ambient: AmbientSave;
  missions: MissionsSave;
  /** AI memory summaries already paid for (character id → summary). */
  aiSummaries: [string, { key: string; text: string }][];
}

const num = z.number().finite();
const entries = <K extends z.ZodType, V extends z.ZodType>(k: K, v: V) => z.array(z.tuple([k, v]));

/**
 * Shape check for anything read back from storage. A save is data from outside
 * the running game: it is validated like any other input before being applied.
 */
export const SaveGameSchema = z.object({
  version: z.literal(SAVE_VERSION),
  packId: z.string(),
  seed: num,
  savedAt: num,
  label: z.string().max(80),
  totalMinutes: num.min(0),
  player: z.object({ x: num, z: num, facing: num, coins: num.min(0) }),
  agents: z.array(z.looseObject({ id: z.string(), x: num, z: num, facing: num, mode: z.string(), activity: z.string() })).min(1),
  props: z.array(z.looseObject({ id: num, x: num, y: num, z: num })),
  social: z.looseObject({
    events: z.array(z.looseObject({ id: num, t: num, act: z.string(), actorId: z.string(), apparentActorId: z.string() })),
    nextEventId: num,
    memories: entries(z.string(), z.array(z.unknown())),
    reputation: z.looseObject({ factions: z.object({ villagers: num, royal_guard: num, thieves_guild: num, mages_order: num }), opinions: entries(z.string(), num) }),
    feed: z.array(z.looseObject({ text: z.string() })),
    rng: num,
    moral: z.object({ hero: num, dark: num }),
  }),
  powers: z.looseObject({ energy: num, unlocked: z.array(z.string()), studied: entries(z.string(), num), leverage: z.array(z.string()) }),
  consequences: z.looseObject({ wantedLevel: num, terror: entries(z.string(), num), flags: z.array(z.string()) }),
  ambient: z.looseObject({ rng: num }),
  missions: z.looseObject({ missions: z.array(z.looseObject({ id: num, status: z.string(), proposal: z.looseObject({ title: z.string(), giverId: z.string() }) })), nextId: num, rng: num }),
  aiSummaries: entries(z.string(), z.object({ key: z.string(), text: z.string().max(600) })),
});

export function captureSave(w: SaveWorld, player: PlayerSave, aiSummaries: SaveGame["aiSummaries"] = [], savedAt = Date.now()): SaveGame {
  return {
    version: SAVE_VERSION,
    packId: w.packId,
    seed: w.seed,
    savedAt,
    label: w.clock.format(),
    totalMinutes: w.clock.totalMinutes,
    player: { ...player },
    agents: w.agents.save(),
    props: w.props.save(),
    social: w.social.save(),
    powers: w.powers.save(),
    consequences: w.consequences.save(),
    ambient: w.ambient.save(),
    missions: w.missions.save(),
    aiSummaries: structuredClone(aiSummaries),
  };
}

/** Why a stored save cannot be used, or null when it can. Never throws. */
export function checkSave(raw: unknown, w: Pick<SaveWorld, "packId" | "seed" | "agents">): string | null {
  const parsed = SaveGameSchema.safeParse(raw);
  if (!parsed.success) {
    const v = (raw as { version?: unknown } | null)?.version;
    if (typeof v === "number" && v !== SAVE_VERSION) return `version de sauvegarde ${v} non prise en charge`;
    return `sauvegarde illisible (${parsed.error.issues[0]?.path.join(".") ?? "format"})`;
  }
  const s = parsed.data;
  if (s.packId !== w.packId) return "cette sauvegarde vient d'une autre époque";
  if (s.seed !== w.seed) return "cette sauvegarde vient d'un autre monde";
  const ids = new Set(s.agents.map((a) => a.id));
  if (ids.size !== w.agents.agents.length || w.agents.agents.some((a) => !ids.has(a.id))) return "les habitants de cette sauvegarde ne correspondent plus au village";
  return null;
}

/**
 * Replaces the running world with a save. Call `checkSave` first; returns the
 * player part (the caller owns the player and the purse).
 */
export function applySave(save: SaveGame, w: SaveWorld): PlayerSave {
  w.clock.totalMinutes = save.totalMinutes;
  w.agents.load(save.agents, save.totalMinutes);
  w.props.load(save.props);
  w.social.load(save.social);
  w.powers.load(save.powers);
  w.consequences.load(save.consequences);
  w.ambient.load(save.ambient);
  w.missions.load(save.missions);
  return { ...save.player };
}
