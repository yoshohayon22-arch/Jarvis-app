import { z } from "zod";

/** Limits enforced on both sides of the proxy. */
export const DIALOGUE_LIMITS = {
  playerTextMax: 300,
  lineMax: 420,
  historyTurns: 6,
  memoriesMax: 4,
  /** An NPC may nudge its own opinion of the player by at most this much per reply… */
  relationshipDeltaMax: 5,
  /** …and this much over a whole conversation. */
  relationshipPerConversation: 12,
  /** Opinion needed before a character's secrets are even sent to the model. */
  secretTrust: 25,
} as const;

export const EMOTIONS = ["neutral", "friendly", "amused", "wary", "angry", "afraid", "sad"] as const;
export const INTENTS = ["chat", "inform", "refuse", "warn", "call_guard", "end"] as const;

/**
 * What the model returns. The model only *proposes*: the game validates and
 * applies (or ignores) each proposal with its own bounds.
 */
export const DialogueReplySchema = z.object({
  line: z.string(),
  emotion: z.enum(EMOTIONS),
  intent: z.enum(INTENTS),
  /** Proposed change of this character's opinion of the player (the game clamps it). */
  relationshipDelta: z.number(),
  /** Index of a secret the character chooses to reveal, or -1. */
  revealSecret: z.number(),
});
export type DialogueReply = z.infer<typeof DialogueReplySchema>;

/** What the game sends to the proxy. Everything is bounded server-side. */
export const DialogueRequestSchema = z.object({
  characterId: z.string().min(1).max(40),
  playerText: z.string().min(1).max(DIALOGUE_LIMITS.playerTextMax),
  history: z
    .array(z.object({ speaker: z.enum(["player", "npc"]), text: z.string().max(DIALOGUE_LIMITS.lineMax) }))
    .max(DIALOGUE_LIMITS.historyTurns * 2),
  context: z.object({
    opinion: z.number().min(-100).max(100),
    factionReputation: z.number().min(-100).max(100),
    memories: z.array(z.string().max(200)).max(DIALOGUE_LIMITS.memoriesMax),
    scene: z.object({
      time: z.string().max(40),
      place: z.string().max(80),
      activity: z.string().max(80),
      bystanders: z.number().int().min(0).max(200),
      guardNearby: z.boolean(),
    }),
  }),
});
export type DialogueRequest = z.infer<typeof DialogueRequestSchema>;

export interface DialogueResponse {
  reply: DialogueReply;
  source: "ai" | "cache" | "mock";
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; costUsd: number };
}

export interface BudgetStatus {
  mode: "ai" | "mock" | "no_key";
  model: string;
  calls: number;
  cacheHits: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  spentTodayUsd: number;
  dailyLimitUsd: number;
  exceeded: boolean;
}

/** Bounds a model reply to what the game accepts. Never throws on a schema-valid reply. */
export function sanitizeReply(reply: DialogueReply, secretCount: number, secretsAllowed: boolean): DialogueReply {
  const L = DIALOGUE_LIMITS;
  const delta = Number.isFinite(reply.relationshipDelta) ? Math.round(reply.relationshipDelta) : 0;
  const idx = Number.isInteger(reply.revealSecret) ? reply.revealSecret : -1;
  return {
    line: reply.line.replace(/\s+/g, " ").trim().slice(0, L.lineMax),
    emotion: reply.emotion,
    intent: reply.intent,
    relationshipDelta: Math.max(-L.relationshipDeltaMax, Math.min(L.relationshipDeltaMax, delta)),
    revealSecret: secretsAllowed && idx >= 0 && idx < secretCount ? idx : -1,
  };
}
