import "server-only";

import { cached } from "@/lib/server-cache";
import type { CulturePayload, WikiPage } from "./types";

interface RawWikiPage {
  titles?: { normalized?: string };
  description?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
  namespace?: { id?: number };
}

/** Ne garde que de vrais articles (pas les pages spéciales), avec un lien vers fr.wikipedia.org. */
function wikiPage(raw: RawWikiPage | undefined): WikiPage | null {
  const title = raw?.titles?.normalized;
  const url = raw?.content_urls?.desktop?.page;
  if (!raw || typeof title !== "string" || typeof url !== "string" || !/^https:\/\/fr\.wikipedia\.org\//.test(url)) return null;
  if ((raw.namespace?.id ?? 0) !== 0 || /^(Wikipédia|Spécial|Portail|Fichier|Aide|Catégorie):/.test(title)) return null;
  return { title: title.slice(0, 160), description: String(raw.description ?? "").slice(0, 200), extract: String(raw.extract ?? "").slice(0, 600), url };
}

type Featured = { tfa?: RawWikiPage; mostread?: { articles?: RawWikiPage[] }; onthisday?: { year?: number; text?: string; pages?: RawWikiPage[] }[] };
const pages = (raw: RawWikiPage[] | undefined) => (Array.isArray(raw) ? raw : []).map(wikiPage).filter((p): p is WikiPage => p !== null).slice(0, 10);

async function featured(date: string): Promise<Featured> {
  const res = await fetch(`https://fr.wikipedia.org/api/rest_v1/feed/featured/${date.replace(/-/g, "/")}`, {
    headers: { "User-Agent": "DashboardPerso/1.0 (tableau de bord personnel)", Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  }).catch((e: unknown) => {
    throw new Error(e instanceof Error && e.name === "TimeoutError" ? "pas de réponse de Wikipédia en 10 secondes" : "Wikipédia injoignable");
  });
  if (!res.ok) throw new Error(`Wikipédia a répondu ${res.status}`);
  return (await res.json()) as Featured;
}

/** Sélection du jour de Wikipédia (éphéméride, article du jour, articles les plus lus). Gardée 1 heure côté serveur. */
export function loadCulture(): Promise<CulturePayload> {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());
  return cached(`culture:${date}`, 60 * 60 * 1000, async () => {
    const raw = await featured(date);
    let mostRead = pages(raw.mostread?.articles);
    if (!mostRead.length) {
      // En début de journée, le classement n'est pas encore publié : on reprend celui de la veille.
      const previous = new Date(Date.parse(`${date}T12:00:00Z`) - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      mostRead = pages((await featured(previous).catch(() => ({}) as Featured)).mostread?.articles);
    }
    return {
      date,
      onThisDay: (Array.isArray(raw.onthisday) ? raw.onthisday : [])
        .filter((e) => typeof e?.text === "string" && e.text.trim())
        .map((e) => ({ year: typeof e.year === "number" ? e.year : null, text: String(e.text).slice(0, 400), page: (e.pages ?? []).map(wikiPage).find(Boolean) ?? null })),
      featured: wikiPage(raw.tfa),
      mostRead,
      fetchedAt: new Date().toISOString(),
    };
  });
}
