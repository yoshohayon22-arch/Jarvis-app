import "server-only";

import { cached } from "@/lib/server-cache";
import { decodeFeed, parseFeed, type FeedItem } from "./parse";
import { REAL_MADRID_PATTERN, sourcesForTab, type NewsTab } from "./sources";
import type { Article, NewsPayload, SourceStatus } from "./types";

const PER_SOURCE = 12;
/** On ignore les articles de plus de 3 jours (certains flux gardent de vieux contenus en tête). */
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

const TEN_MINUTES = 10 * 60 * 1000;

/** Lit un flux RSS. Résultat gardé 10 minutes pour ménager les serveurs des journaux. */
function loadFeed(url: string): Promise<FeedItem[]> {
  return cached(`rss:${url}`, TEN_MINUTES, async () => {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DashboardPerso/1.0; lecteur RSS personnel)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    }).catch((e: unknown) => {
      const timeout = e instanceof Error && e.name === "TimeoutError";
      throw new Error(timeout ? "pas de réponse en 8 secondes" : "site injoignable");
    });
    if (!res.ok) throw new Error(`le site a répondu ${res.status}`);
    return parseFeed(decodeFeed(await res.arrayBuffer(), res.headers.get("content-type")), 30);
  });
}

export async function loadNews(tab: NewsTab): Promise<NewsPayload> {
  const sources = sourcesForTab(tab);
  const results = await Promise.allSettled(sources.map((s) => loadFeed(s.url)));
  const now = Date.now();

  const articles: Article[] = [];
  const statuses: SourceStatus[] = sources.map((source, i) => {
    const result = results[i];
    if (result.status === "rejected") {
      const reason = result.reason instanceof Error ? result.reason.message : "erreur inconnue";
      return { id: source.id, name: source.name, group: source.group, ok: false, count: 0, error: reason };
    }
    // Onglet Real Madrid : les sources foot généralistes ne gardent que les articles qui parlent du Real.
    const onlyReal = tab === "real" && source.tab !== "real";
    const recent = result.value
      .filter((item) => !item.publishedAt || now - new Date(item.publishedAt).getTime() < MAX_AGE_MS)
      .filter((item) => !onlyReal || REAL_MADRID_PATTERN.test(`${item.title} ${item.summary}`))
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .slice(0, PER_SOURCE);
    for (const item of recent) {
      articles.push({
        id: `${source.id}:${item.link}`,
        sourceId: source.id,
        sourceName: source.name,
        group: source.group,
        lang: source.lang,
        paywall: Boolean(source.paywall),
        title: item.title,
        link: item.link,
        summary: source.noSummary ? "" : item.summary,
        publishedAt: item.publishedAt,
      });
    }
    return { id: source.id, name: source.name, group: source.group, ok: true, count: recent.length };
  });

  articles.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  return { articles, sources: statuses, fetchedAt: new Date().toISOString() };
}
