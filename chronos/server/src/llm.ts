import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { DialogueReplySchema, type DialogueReply } from "@chronos/shared";
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

/** The only thing the proxy needs from a model: one structured dialogue reply. */
export interface DialogueLlm {
  readonly kind: "ai" | "mock";
  dialogue(system: string, user: string, route: RouteConfig, timeoutMs: number): Promise<LlmResult>;
}

/** Models that support server-side refusal fallbacks (see Anthropic docs). */
const FALLBACK_MODELS = /^claude-(opus-5|sonnet-5-5|fable-5)/;

export class AnthropicLlm implements DialogueLlm {
  readonly kind = "ai" as const;
  // Reads ANTHROPIC_API_KEY from the environment. The key never leaves this process.
  private readonly client = new Anthropic({ maxRetries: 1 });

  async dialogue(system: string, user: string, route: RouteConfig, timeoutMs: number): Promise<LlmResult> {
    const withFallback = FALLBACK_MODELS.test(route.model);
    try {
      const response = await this.client.beta.messages.parse(
        {
          model: route.model,
          max_tokens: route.maxTokens,
          // The stable prefix (world bible + rules + character sheet) is cached between calls.
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: user }],
          output_config: { effort: route.effort, format: betaZodOutputFormat(DialogueReplySchema) },
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
      return { reply: response.parsed_output, usage, model: response.model };
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
}
