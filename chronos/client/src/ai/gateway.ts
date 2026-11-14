import {
  DIALOGUE_LIMITS,
  DialogueReplySchema,
  sanitizeReply,
  type BudgetStatus,
  type DialogueReply,
  type DialogueRequest,
  type MissionRequest,
} from "@chronos/shared";

export type ReplySource = "ai" | "cache" | "mock" | "local";

export interface GatewayReply {
  reply: DialogueReply;
  source: ReplySource;
  /** Why the local fallback was used (shown in debug). */
  reason?: string;
  costUsd?: number;
}

export interface GatewayStats {
  aiReplies: number;
  cachedReplies: number;
  localReplies: number;
  sessionCostUsd: number;
  lastReason: string;
  missionCalls: number;
}

export type MissionDraft = { ok: true; mission: unknown; source: "ai" | "mock"; costUsd: number } | { ok: false; reason: string };

const REASONS: Record<string, string> = {
  no_api_key: "pas de clé API sur le serveur",
  budget_exceeded: "budget IA du jour atteint",
  rate_limited: "trop de requêtes",
  network: "serveur IA injoignable",
  timeout: "réponse trop lente",
  invalid: "réponse IA invalide",
};

/**
 * The game's only door to the AI. It never throws: on any failure it reports
 * why and returns a local line, so the game stays fully playable offline.
 */
export class AiGateway {
  readonly stats: GatewayStats = { aiReplies: 0, cachedReplies: 0, localReplies: 0, sessionCostUsd: 0, lastReason: "", missionCalls: 0 };

  constructor(
    private readonly base = "/api",
    private readonly timeoutMs = 25_000,
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {}

  async dialogue(req: DialogueRequest, secretCount: number, fallback: () => DialogueReply): Promise<GatewayReply> {
    const local = (code: string): GatewayReply => {
      this.stats.localReplies++;
      this.stats.lastReason = REASONS[code] ?? code;
      return { reply: fallback(), source: "local", reason: this.stats.lastReason };
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(`${this.base}/dialogue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: ctrl.signal,
      });
      const body = (await res.json().catch(() => null)) as { reply?: unknown; source?: string; error?: string; usage?: { costUsd?: number } } | null;
      if (!res.ok || !body) return local(body?.error ?? "network");
      // Never trust the wire: validate again and bound every proposal.
      const parsed = DialogueReplySchema.safeParse(body.reply);
      if (!parsed.success || !parsed.data.line.trim()) return local("invalid");
      const reply = sanitizeReply(parsed.data, secretCount, req.context.opinion >= DIALOGUE_LIMITS.secretTrust);
      const source: ReplySource = body.source === "cache" ? "cache" : body.source === "mock" ? "mock" : "ai";
      if (source === "cache") this.stats.cachedReplies++;
      else this.stats.aiReplies++;
      const cost = typeof body.usage?.costUsd === "number" ? body.usage.costUsd : 0;
      this.stats.sessionCostUsd += cost;
      this.stats.lastReason = "";
      return { reply, source, costUsd: cost };
    } catch (e) {
      return local((e as Error).name === "AbortError" ? "timeout" : "network");
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Asks the proxy for a mission proposal. Returns the raw draft: the caller
   * validates it against the live world (and may ask again with the errors).
   */
  async mission(req: MissionRequest): Promise<MissionDraft> {
    const fail = (code: string): MissionDraft => {
      this.stats.lastReason = REASONS[code] ?? code;
      return { ok: false, reason: this.stats.lastReason };
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs * 2);
    try {
      const res = await this.fetchFn(`${this.base}/mission`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req), signal: ctrl.signal });
      const body = (await res.json().catch(() => null)) as { mission?: unknown; source?: string; error?: string; usage?: { costUsd?: number } } | null;
      if (!res.ok || !body) return fail(body?.error ?? "network");
      const costUsd = typeof body.usage?.costUsd === "number" ? body.usage.costUsd : 0;
      this.stats.missionCalls++;
      this.stats.sessionCostUsd += costUsd;
      this.stats.lastReason = "";
      return { ok: true, mission: body.mission, source: body.source === "mock" ? "mock" : "ai", costUsd };
    } catch (e) {
      return fail((e as Error).name === "AbortError" ? "timeout" : "network");
    } finally {
      clearTimeout(timer);
    }
  }

  async budget(): Promise<BudgetStatus | null> {
    try {
      const res = await this.fetchFn(`${this.base}/budget`);
      return res.ok ? ((await res.json()) as BudgetStatus) : null;
    } catch {
      return null;
    }
  }
}
