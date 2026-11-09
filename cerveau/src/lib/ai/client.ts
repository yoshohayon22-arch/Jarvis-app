// Client Anthropic — côté serveur uniquement. La clé vient de .env.local (ANTHROPIC_API_KEY).
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export const MODEL = process.env.CERVEAU_MODEL || "claude-sonnet-5-5";

export const isMock = () => process.env.CERVEAU_MOCK_AI === "1";
export const hasKey = () => !!process.env.ANTHROPIC_API_KEY;
export const aiAvailable = () => !isMock() && hasKey();

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ timeout: 120_000, maxRetries: 2 });
  return client;
}

export class AIError extends Error {}

type Content = Anthropic.Beta.BetaContentBlockParam[] | string;

/**
 * Appel avec sortie JSON structurée (schéma strict généré depuis zod),
 * validée par zod, avec un nouvel essai en cas de JSON invalide.
 */
export async function structuredCall<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  content: Content;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<S>> {
  if (!aiAvailable()) throw new AIError("IA indisponible : ajoute ANTHROPIC_API_KEY dans .env.local");
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const content: Content =
      attempt === 0
        ? opts.content
        : [
            ...(typeof opts.content === "string" ? [{ type: "text" as const, text: opts.content }] : opts.content),
            {
              type: "text" as const,
              text: `Ta réponse précédente était invalide (${lastError}). Renvoie un JSON strictement conforme au schéma.`,
            },
          ];
    try {
      const res = await getClient().beta.messages.parse({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 8000,
        system: opts.system,
        messages: [{ role: "user", content }],
        output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      if (res.stop_reason === "refusal") throw new AIError("L'IA a refusé de traiter ce contenu.");
      if (res.stop_reason === "max_tokens") {
        lastError = "réponse coupée (max_tokens)";
        continue;
      }
      // Double validation : le SDK parse, on revalide avec zod pour être sûr.
      const check = opts.schema.safeParse(res.parsed_output);
      if (check.success) return check.data;
      lastError = check.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
    } catch (e) {
      if (e instanceof AIError) throw e;
      if (e instanceof Anthropic.AuthenticationError) throw new AIError("Clé API Anthropic invalide (ANTHROPIC_API_KEY).");
      if (e instanceof Anthropic.APIError) {
        throw new AIError(`Erreur de l'API Anthropic (${e.status ?? "réseau"}) : ${e.message}`);
      }
      // Sinon : JSON illisible / non conforme → on réessaie une fois.
      lastError = e instanceof Error ? e.message.slice(0, 300) : String(e);
    }
  }
  throw new AIError(`Réponse de l'IA invalide après 2 essais : ${lastError}`);
}
