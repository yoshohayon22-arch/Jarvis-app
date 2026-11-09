// Neurone oublié du jour : un projet / une idée non touché depuis longtemps, bien connecté.
import { db, kvGet, kvSet } from "./db";
import { aiAvailable, structuredCall } from "./ai/client";
import { FORGOTTEN_SYSTEM } from "./ai/prompts";
import { ForgottenSchema } from "./ai/schemas";
import { getNodeDetail } from "./repo";
import type { ForgottenResult, NodeType } from "./types";

const MIN_DAYS = 21;

function localDay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function pickCandidate(day: string, exclude: string[] = []) {
  const rows = db()
    .prepare(
      `SELECT n.id, n.title, n.type, n.last_activity_at,
              (SELECT COUNT(*) FROM edges e WHERE e.source_id = n.id OR e.target_id = n.id) AS degree
       FROM nodes n WHERE n.type IN ('projet','idee')`,
    )
    .all() as { id: string; title: string; type: NodeType; last_activity_at: string; degree: number }[];
  const now = Date.now();
  const scored = rows
    .filter((r) => !exclude.includes(r.id))
    .map((r) => {
      const days = (now - Date.parse(r.last_activity_at)) / 86_400_000;
      return { ...r, days, score: days * (1 + Math.log(1 + r.degree)) };
    });
  if (!scored.length) return null;
  const old = scored.filter((r) => r.days >= MIN_DAYS);
  const pool = (old.length ? old : scored).sort((a, b) => b.score - a.score).slice(0, 7);
  // Tirage déterministe du jour parmi les meilleurs candidats.
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

export async function forgottenOfTheDay(opts: { refresh?: boolean } = {}): Promise<ForgottenResult> {
  const day = localDay();
  const cacheKey = `forgotten:${day}`;
  const cached = kvGet(cacheKey);
  if (cached && !opts.refresh) {
    const parsed = JSON.parse(cached) as ForgottenResult;
    if (!parsed.node || getNodeDetail(parsed.node.id)) return parsed;
  }
  const prevId = cached ? (JSON.parse(cached) as ForgottenResult).node?.id : undefined;
  const c = pickCandidate(day + (opts.refresh ? String(Date.now()) : ""), prevId && opts.refresh ? [prevId] : []);
  if (!c) return { node: null, sentence: "Ajoute des projets et des idées : je t'en ressortirai un chaque jour." };

  const detail = getNodeDetail(c.id)!;
  const daysSince = Math.floor(c.days);
  let sentence =
    daysSince >= MIN_DAYS
      ? `Tu n'as pas touché à « ${c.title} » depuis ${daysSince} jours. Un petit pas aujourd'hui ?`
      : `Rien n'est encore vraiment oublié… mais « ${c.title} » mérite peut-être un nouveau pas aujourd'hui.`;
  if (aiAvailable()) {
    try {
      const out = await structuredCall({
        schema: ForgottenSchema,
        system: FORGOTTEN_SYSTEM,
        effort: "low",
        maxTokens: 2000,
        content: `Neurone : ${c.title} (${c.type}), pas touché depuis ${daysSince} jours.
Résumé : ${detail.node.summary || "(aucun)"}
Tags : ${detail.node.tags.join(", ") || "(aucun)"}
Connexions : ${detail.connections.map((x) => `${x.edge.label} ${x.other.title}`).join(" ; ") || "(aucune)"}
Sources : ${detail.sources.map((s) => `« ${s.raw_text.slice(0, 200)} »`).join(" ; ") || "(aucune)"}`,
      });
      sentence = out.phrase;
    } catch {
      /* phrase par défaut */
    }
  }
  const result: ForgottenResult = { node: { id: c.id, title: c.title, type: c.type, daysSince }, sentence };
  kvSet(cacheKey, JSON.stringify(result));
  return result;
}
