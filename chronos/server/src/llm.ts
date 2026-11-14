import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { DialogueReplySchema, MissionProposalSchema, type DialogueReply, type MissionProposal, type MissionRequest } from "@chronos/shared";
import type { Usage } from "./budget.js";
import type { RouteConfig } from "./config.js";

export interface LlmResult {
  reply: DialogueReply;
  usage: Usage;
  model: string;
}

export class LlmError extends Error {
  constructor(
    readonly code: "refused" | "truncated" | "invalid_output" | "rate_limited" | "upstream" | "network",
    message: string,
  ) {
    super(message);
  }
}

export interface MissionLlmResult {
  mission: MissionProposal;
  usage: Usage;
  model: string;
}

/** All the proxy needs from a model: one structured dialogue reply, or one structured mission proposal. */
export interface DialogueLlm {
  readonly kind: "ai" | "mock";
  dialogue(system: string, user: string, route: RouteConfig, timeoutMs: number): Promise<LlmResult>;
  mission(system: string, user: string, route: RouteConfig, timeoutMs: number, req: MissionRequest): Promise<MissionLlmResult>;
}

/** Models that support server-side refusal fallbacks (see Anthropic docs). */
const FALLBACK_MODELS = /^claude-(opus-5|sonnet-5-5|fable-5)/;

export class AnthropicLlm implements DialogueLlm {
  readonly kind = "ai" as const;
  // Reads ANTHROPIC_API_KEY from the environment. The key never leaves this process.
  private readonly client = new Anthropic({ maxRetries: 1 });

  async dialogue(system: string, user: string, route: RouteConfig, timeoutMs: number): Promise<LlmResult> {
    const r = await this.structured(DialogueReplySchema, system, user, route, timeoutMs);
    return { reply: r.output, usage: r.usage, model: r.model };
  }

  async mission(system: string, user: string, route: RouteConfig, timeoutMs: number): Promise<MissionLlmResult> {
    const r = await this.structured(MissionProposalSchema, system, user, route, timeoutMs);
    return { mission: r.output, usage: r.usage, model: r.model };
  }

  /** One call, one schema-constrained answer. */
  private async structured<S extends z.ZodType>(schema: S, system: string, user: string, route: RouteConfig, timeoutMs: number): Promise<{ output: z.infer<S>; usage: Usage; model: string }> {
    const withFallback = FALLBACK_MODELS.test(route.model);
    try {
      const response = await this.client.beta.messages.parse(
        {
          model: route.model,
          max_tokens: route.maxTokens,
          // The stable prefix (world bible + rules + character sheet) is cached between calls.
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: user }],
          output_config: { effort: route.effort, format: betaZodOutputFormat(schema) },
          ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        },
        { timeout: timeoutMs },
      );
      const u = response.usage;
      const usage: Usage = {
        inputTokens: u.input_tokens,
        outputTokens: u.output_tokens,
        cacheReadTokens: u.cache_read_input_tokens ?? 0,
        cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
      };
      // Usage is billed even when the reply is unusable: attach it to the error path too.
      if (response.stop_reason === "refusal") throw Object.assign(new LlmError("refused", "model declined"), { usage, model: response.model });
      if (response.stop_reason === "max_tokens") throw Object.assign(new LlmError("truncated", "output hit max_tokens"), { usage, model: response.model });
      if (!response.parsed_output) throw Object.assign(new LlmError("invalid_output", "no parsed output"), { usage, model: response.model });
      return { output: response.parsed_output as z.infer<S>, usage, model: response.model };
    } catch (e) {
      if (e instanceof LlmError) throw e;
      if (e instanceof Anthropic.RateLimitError) throw new LlmError("rate_limited", "upstream rate limit");
      if (e instanceof Anthropic.APIConnectionError) throw new LlmError("network", "cannot reach the API");
      if (e instanceof Anthropic.APIError) throw new LlmError("upstream", `API error ${e.status ?? ""}`.trim());
      throw new LlmError("invalid_output", "unparseable model output");
    }
  }
}

/**
 * Offline stand-in used for development and tests (CHRONOS_MOCK=1). Costs nothing
 * and makes the whole pipeline (validation, cache, budget counters) testable.
 */
export class MockLlm implements DialogueLlm {
  readonly kind = "mock" as const;
  calls = 0;

  async dialogue(_system: string, user: string): Promise<LlmResult> {
    this.calls++;
    const said = /<joueur>(.*?)<\/joueur>/s.exec(user)?.[1] ?? "";
    const hostile = /tu le détestes|tu te méfies/.test(user);
    return {
      reply: {
        line: hostile ? `(simulation) Je n'aime pas ta façon de demander « ${said.slice(0, 40)} ».` : `(simulation) Tu me parles de « ${said.slice(0, 40)} » ? Voilà qui est curieux.`,
        emotion: hostile ? "wary" : "amused",
        intent: "chat",
        relationshipDelta: hostile ? -1 : 1,
        revealSecret: -1,
      },
      usage: { inputTokens: Math.ceil(user.length / 4), outputTokens: 40, cacheReadTokens: 0, cacheWriteTokens: 0 },
      model: "mock",
    };
  }

  /** Set to make the first attempt invalid (unknown id), to exercise the game's regeneration loop. */
  flaky = process.env.CHRONOS_MOCK_FLAKY === "1";
  missionCalls = 0;

  async mission(_system: string, user: string, _route: RouteConfig, _timeoutMs: number, req: MissionRequest): Promise<MissionLlmResult> {
    this.missionCalls++;
    const chars = req.allowed.characters;
    const name = (id: string) => chars.find((c) => c.id === id)?.name ?? id;
    const others = chars.filter((c) => c.id !== req.giverId);
    const culprit = (req.intent === "infiltrate" ? others.find((c) => c.faction === "royal_guard") : others.find((c) => c.faction === "thieves_guild")) ?? others[0];
    const victim = others.find((c) => c.faction === "villagers" && c.id !== culprit?.id) ?? others[1];
    const place = req.allowed.places[(req.giverId.length + req.intent.length) % Math.max(1, req.allowed.places.length)];
    const c = culprit?.id ?? "";
    const v = victim?.id ?? "";
    const p = place?.id ?? "";
    const zero = { villagers: 0, royal_guard: 0, thieves_guild: 0, mages_order: 0 };
    const step = (type: MissionProposal["steps"][number]["type"], text: string, targetId = "", placeId = "") => ({ type, text, targetId, placeId, actId: "" });
    const steps =
      req.intent === "investigate"
        ? [step("goto", `Se rendre ${place?.name}`, "", p), step("echo", `Utiliser l'Écho du passé ${place?.name}`, "", p)]
        : req.intent === "protect"
          ? [step("protect", `Protéger ${name(v)} de ${name(c)}`, v)]
          : [step("infiltrate", `Atteindre ${place?.name} sans être reconnu`, "", p)];
    const mission: MissionProposal = {
      intent: req.intent,
      title: `(simulation) ${req.intent === "investigate" ? `Le vol ${place?.name}` : req.intent === "protect" ? `Menace sur ${name(v)}` : `Des yeux ${place?.name}`}`,
      summary: `(simulation) Mission proposée par ${name(req.giverId)}.`,
      giverId: req.giverId,
      briefing: `(simulation) J'ai du travail pour toi, Kael.`,
      culpritId: c,
      victimId: req.intent === "infiltrate" ? "" : v,
      placeId: req.intent === "protect" ? "" : p,
      steps,
      hero: { label: `Tout dire à ${name(req.giverId)}`, type: "talk", targetId: req.giverId, actId: "", epilogue: "(simulation) Tu as fait ce qui était juste.", gold: 20, reputation: { ...zero, villagers: 6 } },
      dark: { label: `Faire chanter ${name(c)}`, type: "act", targetId: c, actId: "intimidate", epilogue: "(simulation) Tu en as tiré profit.", gold: 60, reputation: { ...zero, thieves_guild: 5 } },
      timeLimitHours: 12,
    };
    // A deliberately broken first draft: the game must catch it and ask again.
    if (this.flaky && req.attempt === 0) mission.culpritId = "dragon_noir";
    return { mission, usage: { inputTokens: Math.ceil(user.length / 4), outputTokens: 400, cacheReadTokens: 0, cacheWriteTokens: 0 }, model: "mock" };
  }
}
