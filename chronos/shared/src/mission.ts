import { z } from "zod";

/** Hard limits the game enforces on any mission, whoever wrote it. */
export const MISSION_LIMITS = {
  titleMax: 70,
  textMax: 320,
  stepTextMax: 160,
  stepsMin: 1,
  stepsMax: 4,
  goldMax: 200,
  reputationMax: 25,
  timeLimitMinHours: 2,
  timeLimitMaxHours: 48,
  /** How many times the game asks the model again before using a local template. */
  regenerations: 2,
  digestEvents: 10,
  activeMax: 3,
} as const;

export const MISSION_INTENTS = ["investigate", "protect", "infiltrate"] as const;
export type MissionIntent = (typeof MISSION_INTENTS)[number];

/**
 * What the player can be asked to do. Every type is something the simulation can
 * observe by itself (a position, an entry in the world log, a power state).
 * - talk: speak with `targetId`
 * - goto: reach `placeId`
 * - echo: use the Echo of the Past at `placeId` (reveals the staged scene)
 * - protect: keep `targetId` safe from the culprit until the danger passes
 * - infiltrate: reach `placeId` unrecognized (shadow or false face)
 * - act: do `actId` to `targetId`
 */
export const STEP_TYPES = ["talk", "goto", "echo", "protect", "infiltrate", "act"] as const;
export type StepType = (typeof STEP_TYPES)[number];

/** Acts a mission may ask for (a closed list: the model cannot invent verbs). */
export const MISSION_ACTS = ["give_alms", "pickpocket", "intimidate", "assault"] as const;

const FACTION_KEYS = ["villagers", "royal_guard", "thieves_guild", "mages_order"] as const;

export const MissionStepSchema = z.object({
  type: z.enum(STEP_TYPES),
  /** What the journal shows for this step. */
  text: z.string(),
  /** Character id, or "" when the step has no target. */
  targetId: z.string(),
  /** Place id, or "" when the step has no place. */
  placeId: z.string(),
  /** Act id for "act" steps, otherwise "". */
  actId: z.string(),
});
export type MissionStep = z.infer<typeof MissionStepSchema>;

/** One of the two ways a mission can end. The player picks by doing, not from a menu. */
export const MissionOutcomeSchema = z.object({
  label: z.string(),
  type: z.enum(["talk", "act"]),
  targetId: z.string(),
  actId: z.string(),
  /** Shown in the journal once chosen. */
  epilogue: z.string(),
  gold: z.number(),
  reputation: z.object({ villagers: z.number(), royal_guard: z.number(), thieves_guild: z.number(), mages_order: z.number() }),
});
export type MissionOutcome = z.infer<typeof MissionOutcomeSchema>;

/**
 * A mission as *proposed* (by the model or by a local template). Nothing here
 * touches the world until `validateMission` accepts it.
 */
export const MissionProposalSchema = z.object({
  intent: z.enum(MISSION_INTENTS),
  title: z.string(),
  summary: z.string(),
  giverId: z.string(),
  /** What the giver says when offering the job. */
  briefing: z.string(),
  /** investigate: who did it · protect: who threatens · infiltrate: who must not notice ("" if nobody in particular). */
  culpritId: z.string(),
  /** investigate: who was robbed · protect: who is in danger · infiltrate: "". */
  victimId: z.string(),
  /** investigate: where it happened · infiltrate: where to get in · protect: "". */
  placeId: z.string(),
  steps: z.array(MissionStepSchema),
  hero: MissionOutcomeSchema,
  dark: MissionOutcomeSchema,
  timeLimitHours: z.number(),
});
export type MissionProposal = z.infer<typeof MissionProposalSchema>;

export interface MissionCharacter {
  id: string;
  name: string;
  role: string;
  faction: string;
  /** Key characters can give missions and be talked to at length. */
  key: boolean;
  /** False while jailed: cannot give or take part. */
  available: boolean;
}

/** The closed world a mission must fit in. Built by the game, never by the model. */
export interface MissionWorld {
  characters: MissionCharacter[];
  places: { id: string; name: string }[];
  /** Missions already running or done (no duplicates). */
  taken: { giverId: string; title: string; active: boolean }[];
}

/** Sent to the proxy: a compact, bounded picture of the world plus the closed lists. */
export const MissionRequestSchema = z.object({
  intent: z.enum(MISSION_INTENTS),
  giverId: z.string().min(1).max(40),
  attempt: z.number().int().min(0).max(MISSION_LIMITS.regenerations),
  /** Validation errors of the previous attempt, sent back so the model can fix them. */
  previousErrors: z.array(z.string().max(200)).max(8),
  digest: z.object({
    time: z.string().max(40),
    reputations: z.object({ villagers: z.number(), royal_guard: z.number(), thieves_guild: z.number(), mages_order: z.number() }),
    recentEvents: z.array(z.string().max(200)).max(MISSION_LIMITS.digestEvents),
    tensions: z.array(z.string().max(120)).max(6),
  }),
  allowed: z.object({
    characters: z.array(z.object({ id: z.string().max(40), name: z.string().max(60), role: z.string().max(80), faction: z.string().max(40) })).max(40),
    places: z.array(z.object({ id: z.string().max(40), name: z.string().max(60) })).max(40),
    takenTitles: z.array(z.string().max(MISSION_LIMITS.titleMax)).max(12),
  }),
});
export type MissionRequest = z.infer<typeof MissionRequestSchema>;

export interface MissionResponse {
  mission: MissionProposal;
  source: "ai" | "mock";
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; costUsd: number };
}

const REQUIRED_STEP: Record<MissionIntent, StepType> = { investigate: "echo", protect: "protect", infiltrate: "infiltrate" };

/**
 * The rules every mission must pass before it exists in the game. Returns the
 * list of problems (empty = accepted). Pure: same input, same verdict.
 */
export function validateMission(raw: unknown, world: MissionWorld, expected?: { intent?: MissionIntent; giverId?: string }): string[] {
  const parsed = MissionProposalSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues.slice(0, 6).map((i) => `schema: ${i.path.join(".")} ${i.message}`);
  const m = parsed.data;
  const L = MISSION_LIMITS;
  const errors: string[] = [];
  const chars = new Map(world.characters.map((c) => [c.id, c]));
  const places = new Set(world.places.map((p) => p.id));
  const text = (label: string, v: string, max: number) => {
    if (v.trim().length === 0) errors.push(`${label} is empty`);
    else if (v.length > max) errors.push(`${label} is longer than ${max} characters`);
  };
  const character = (label: string, id: string): MissionCharacter | null => {
    const c = chars.get(id);
    if (!c) errors.push(`${label} "${id}" is not an allowed character id`);
    else if (!c.available) errors.push(`${label} "${id}" is not available right now`);
    return c ?? null;
  };
  const place = (label: string, id: string) => {
    if (!places.has(id)) errors.push(`${label} "${id}" is not an allowed place id`);
  };

  if (expected?.intent && m.intent !== expected.intent) errors.push(`intent must be "${expected.intent}"`);
  if (expected?.giverId && m.giverId !== expected.giverId) errors.push(`giverId must be "${expected.giverId}"`);
  text("title", m.title, L.titleMax);
  text("summary", m.summary, L.textMax);
  text("briefing", m.briefing, L.textMax);
  const giver = character("giverId", m.giverId);
  if (giver && !giver.key) errors.push(`giverId "${m.giverId}" cannot give missions`);
  const title = m.title.trim().toLowerCase();
  if (world.taken.some((t) => t.title.trim().toLowerCase() === title)) errors.push("a mission with this title already exists");
  if (world.taken.some((t) => t.active && t.giverId === m.giverId)) errors.push(`"${m.giverId}" already has a mission in progress`);

  // Roles each intent needs.
  if (m.intent === "investigate" || m.intent === "protect") {
    const culprit = character("culpritId", m.culpritId);
    character("victimId", m.victimId);
    if (m.culpritId === m.victimId) errors.push("culpritId and victimId must differ");
    if (m.culpritId === m.giverId) errors.push("the giver cannot be the culprit");
    if (m.intent === "protect" && culprit?.faction === "royal_guard") errors.push("a guard cannot be the aggressor of a protect mission");
  } else {
    if (m.culpritId !== "") character("culpritId", m.culpritId);
    if (m.victimId !== "") errors.push('victimId must be "" for an infiltrate mission');
  }
  if (m.intent === "investigate" || m.intent === "infiltrate") place("placeId", m.placeId);
  else if (m.placeId !== "") errors.push('placeId must be "" for a protect mission');

  // Steps.
  if (m.steps.length < L.stepsMin || m.steps.length > L.stepsMax) errors.push(`steps must hold ${L.stepsMin} to ${L.stepsMax} entries`);
  const required = REQUIRED_STEP[m.intent];
  if (m.steps.filter((s) => s.type === required).length !== 1) errors.push(`a "${m.intent}" mission needs exactly one "${required}" step`);
  for (const other of Object.values(REQUIRED_STEP)) {
    if (other !== required && m.steps.some((s) => s.type === other)) errors.push(`a "${m.intent}" mission cannot contain a "${other}" step`);
  }
  m.steps.forEach((s, i) => {
    const at = `steps[${i}]`;
    text(`${at}.text`, s.text, L.stepTextMax);
    const needsTarget = s.type === "talk" || s.type === "protect" || s.type === "act";
    const needsPlace = s.type === "goto" || s.type === "echo" || s.type === "infiltrate";
    if (needsTarget) character(`${at}.targetId`, s.targetId);
    else if (s.targetId !== "") errors.push(`${at}.targetId must be "" for a "${s.type}" step`);
    if (needsPlace) place(`${at}.placeId`, s.placeId);
    else if (s.placeId !== "") errors.push(`${at}.placeId must be "" for a "${s.type}" step`);
    if (s.type === "act") {
      if (!(MISSION_ACTS as readonly string[]).includes(s.actId)) errors.push(`${at}.actId "${s.actId}" is not an allowed act`);
      if (s.targetId === m.giverId) errors.push(`${at}: the giver cannot be the target of an act`);
    } else if (s.actId !== "") errors.push(`${at}.actId must be "" for a "${s.type}" step`);
    if (s.type === "talk" && chars.get(s.targetId) && !chars.get(s.targetId)!.key) errors.push(`${at}.targetId "${s.targetId}" cannot hold a conversation`);
    if (s.type === "echo" && s.placeId !== m.placeId) errors.push(`${at}.placeId must be the mission's placeId (where the scene happened)`);
    if (s.type === "infiltrate" && s.placeId !== m.placeId) errors.push(`${at}.placeId must be the mission's placeId`);
    if (s.type === "protect" && s.targetId !== m.victimId) errors.push(`${at}.targetId must be the mission's victimId`);
  });

  // The two endings.
  for (const [name, o] of [["hero", m.hero], ["dark", m.dark]] as const) {
    text(`${name}.label`, o.label, L.stepTextMax);
    text(`${name}.epilogue`, o.epilogue, L.textMax);
    const target = character(`${name}.targetId`, o.targetId);
    if (o.type === "talk") {
      if (target && !target.key) errors.push(`${name}.targetId "${o.targetId}" cannot hold a conversation`);
      if (o.actId !== "") errors.push(`${name}.actId must be "" for a "talk" ending`);
    } else {
      if (!(MISSION_ACTS as readonly string[]).includes(o.actId)) errors.push(`${name}.actId "${o.actId}" is not an allowed act`);
      if (o.targetId === m.giverId) errors.push(`${name}: the giver cannot be the target of an act`);
    }
    if (!Number.isFinite(o.gold) || o.gold < 0 || o.gold > L.goldMax || !Number.isInteger(o.gold)) errors.push(`${name}.gold must be an integer from 0 to ${L.goldMax}`);
    for (const f of FACTION_KEYS) {
      const v = o.reputation[f];
      if (!Number.isFinite(v) || Math.abs(v) > L.reputationMax) errors.push(`${name}.reputation.${f} must be between -${L.reputationMax} and ${L.reputationMax}`);
    }
  }
  if (m.hero.type === m.dark.type && m.hero.targetId === m.dark.targetId && m.hero.actId === m.dark.actId) errors.push("hero and dark endings must be different things to do");
  if (m.hero.type === "act" && (m.hero.actId === "assault" || m.hero.actId === "pickpocket" || m.hero.actId === "intimidate")) errors.push("the hero ending cannot be a crime");
  if (!Number.isFinite(m.timeLimitHours) || m.timeLimitHours < L.timeLimitMinHours || m.timeLimitHours > L.timeLimitMaxHours)
    errors.push(`timeLimitHours must be between ${L.timeLimitMinHours} and ${L.timeLimitMaxHours}`);
  // The staged scene must still be within the Echo's reach (one day) when the player gets there.
  if (m.intent === "investigate" && m.timeLimitHours > 20) errors.push("timeLimitHours must be at most 20 for an investigate mission");
  return errors;
}

/** A parameterized local mission: "{giver}", "{culprit}", "{victim}", "{place}" are filled with real names. */
export interface MissionTemplate {
  intent: MissionIntent;
  title: string;
  summary: string;
  briefing: string;
  steps: { type: StepType; text: string; target?: "giver" | "culprit" | "victim"; place?: boolean; actId?: string }[];
  hero: Omit<MissionOutcome, "targetId"> & { target: "giver" | "culprit" | "victim" };
  dark: Omit<MissionOutcome, "targetId"> & { target: "giver" | "culprit" | "victim" };
  timeLimitHours: number;
}

export interface TemplateCast {
  giverId: string;
  culpritId: string;
  victimId: string;
  placeId: string;
}

/** Fills a local template with real ids and names. The result still goes through `validateMission`. */
export function fillTemplate(t: MissionTemplate, cast: TemplateCast, world: MissionWorld): MissionProposal {
  const name = (id: string) => world.characters.find((c) => c.id === id)?.name ?? id;
  const placeName = world.places.find((p) => p.id === cast.placeId)?.name ?? cast.placeId;
  const fill = (s: string) =>
    s.replaceAll("{giver}", name(cast.giverId)).replaceAll("{culprit}", name(cast.culpritId)).replaceAll("{victim}", name(cast.victimId)).replaceAll("{place}", placeName);
  const who = (r: "giver" | "culprit" | "victim" | undefined) => (r === "giver" ? cast.giverId : r === "culprit" ? cast.culpritId : r === "victim" ? cast.victimId : "");
  const outcome = (o: MissionTemplate["hero"]): MissionOutcome => ({
    label: fill(o.label),
    type: o.type,
    targetId: who(o.target),
    actId: o.actId,
    epilogue: fill(o.epilogue),
    gold: o.gold,
    reputation: { ...o.reputation },
  });
  return {
    intent: t.intent,
    title: fill(t.title),
    summary: fill(t.summary),
    giverId: cast.giverId,
    briefing: fill(t.briefing),
    culpritId: cast.culpritId,
    victimId: t.intent === "infiltrate" ? "" : cast.victimId,
    placeId: t.intent === "protect" ? "" : cast.placeId,
    steps: t.steps.map((s) => ({ type: s.type, text: fill(s.text), targetId: who(s.target), placeId: s.place ? cast.placeId : "", actId: s.actId ?? "" })),
    hero: outcome(t.hero),
    dark: outcome(t.dark),
    timeLimitHours: t.timeLimitHours,
  };
}
