import {
  DIALOGUE_LIMITS,
  DialogueRequestSchema,
  DialogueReplySchema,
  MissionProposalSchema,
  MissionRequestSchema,
  sanitizeReply,
  type BudgetStatus,
  type DialogueResponse,
  type MissionResponse,
} from "@chronos/shared";
import { Budget, type Usage } from "./budget.js";
import { ResponseCache, hashKey } from "./cache.js";
import type { ServerConfig } from "./config.js";
import { LlmError, type DialogueLlm } from "./llm.js";
import type { ServerPack } from "./pack.js";
import { buildMissionPrompt } from "./missionPrompt.js";
import { buildDialoguePrompt } from "./prompt.js";
import { RateLimiter } from "./rateLimit.js";

export interface AppResult {
  status: number;
  body: unknown;
}

const err = (status: number, error: string, detail?: string): AppResult => ({ status, body: detail ? { error, detail } : { error } });

/**
 * The proxy's logic, independent from HTTP so it can be unit tested.
 * Every guardrail lives here: validation, rate limit, budget, cache, output bounds.
 */
export class ChronosApp {
  readonly cache = new ResponseCache<DialogueResponse["reply"]>();
  readonly limiter: RateLimiter;

  constructor(
    readonly config: ServerConfig,
    readonly pack: ServerPack,
    /** null when no API key is configured: every AI route answers 503 and the game falls back to local lines. */
    readonly llm: DialogueLlm | null,
    readonly budget: Budget,
  ) {
    this.limiter = new RateLimiter(config.rateLimit.perMinute);
  }

  status(): BudgetStatus {
    const s = this.budget.snapshot();
    return {
      mode: this.llm ? this.llm.kind : "no_key",
      model: this.llm?.kind === "mock" ? "mock" : this.config.routes.dialogue.model,
      calls: s.calls,
      cacheHits: s.cacheHits,
      inputTokens: s.inputTokens,
      outputTokens: s.outputTokens,
      cacheReadTokens: s.cacheReadTokens,
      spentTodayUsd: Math.round(s.spentUsd * 1e4) / 1e4,
      dailyLimitUsd: this.budget.dailyLimitUsd,
      exceeded: this.budget.exceeded,
    };
  }

  async dialogue(raw: unknown, clientId: string): Promise<AppResult> {
    if (!this.limiter.allow(clientId)) return err(429, "rate_limited");
    const parsed = DialogueRequestSchema.safeParse(raw);
    if (!parsed.success) return err(400, "invalid_request", parsed.error.issues[0]?.message);
    const req = parsed.data;
    const character = this.pack.characters.get(req.characterId);
    if (!character) return err(404, "unknown_character");
    if (!this.llm) return err(503, "no_api_key");

    const route = this.config.routes.dialogue;
    const prompt = buildDialoguePrompt(this.pack.lore, character, req);
    const secrets = character.secrets?.length ?? 0;

    // Identical question in an identical situation → same answer, no spend.
    const key = hashKey({ m: route.model, c: req.characterId, p: prompt.user });
    const hit = this.cache.get(key);
    if (hit) {
      this.budget.recordCacheHit();
      return { status: 200, body: { reply: hit, source: "cache" } satisfies DialogueResponse };
    }
    if (this.budget.exceeded) return err(402, "budget_exceeded");

    const price = this.config.pricesPerMTok[route.model] ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    try {
      const result = await this.llm.dialogue(prompt.system, prompt.user, route, this.config.requestTimeoutMs);
      const cost = this.llm.kind === "mock" ? 0 : this.budget.record(result.usage, price);
      // Defense in depth: re-validate, then bound everything the model proposed.
      const checked = DialogueReplySchema.safeParse(result.reply);
      if (!checked.success || checked.data.line.trim().length === 0) return err(502, "invalid_model_output");
      const reply = sanitizeReply(checked.data, secrets, prompt.secretsIncluded);
      this.cache.set(key, reply, route.cacheTtlSeconds);
      const body: DialogueResponse = {
        reply,
        source: this.llm.kind,
        usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cacheReadTokens: result.usage.cacheReadTokens, costUsd: cost },
      };
      return { status: 200, body };
    } catch (e) {
      if (e instanceof LlmError) {
        const usage = (e as LlmError & { usage?: Usage }).usage;
        if (usage) this.budget.record(usage, price);
        return err(e.code === "rate_limited" ? 429 : 502, `model_${e.code}`);
      }
      return err(500, "internal_error");
    }
  }

  /**
   * Asks the model for a mission *proposal*. The proxy checks its shape; the game
   * then validates it against the live world and may come back with the errors.
   * Never cached: a mission is written for the world as it is now.
   */
  async mission(raw: unknown, clientId: string): Promise<AppResult> {
    if (!this.limiter.allow(clientId)) return err(429, "rate_limited");
    const parsed = MissionRequestSchema.safeParse(raw);
    if (!parsed.success) return err(400, "invalid_request", parsed.error.issues[0]?.message);
    const req = parsed.data;
    const giver = this.pack.characters.get(req.giverId);
    if (!giver) return err(404, "unknown_character");
    if (!this.llm) return err(503, "no_api_key");
    if (this.budget.exceeded) return err(402, "budget_exceeded");

    const route = this.config.routes.mission;
    const prompt = buildMissionPrompt(this.pack.lore, giver, req);
    const price = this.config.pricesPerMTok[route.model] ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    try {
      const result = await this.llm.mission(prompt.system, prompt.user, route, this.config.requestTimeoutMs * 2, req);
      const cost = this.llm.kind === "mock" ? 0 : this.budget.record(result.usage, price);
      const checked = MissionProposalSchema.safeParse(result.mission);
      if (!checked.success) return err(502, "invalid_model_output");
      const body: MissionResponse = {
        mission: checked.data,
        source: this.llm.kind,
        usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cacheReadTokens: result.usage.cacheReadTokens, costUsd: cost },
      };
      return { status: 200, body };
    } catch (e) {
      if (e instanceof LlmError) {
        const usage = (e as LlmError & { usage?: Usage }).usage;
        if (usage) this.budget.record(usage, price);
        return err(e.code === "rate_limited" ? 429 : 502, `model_${e.code}`);
      }
      return err(500, "internal_error");
    }
  }
}

export { DIALOGUE_LIMITS };
