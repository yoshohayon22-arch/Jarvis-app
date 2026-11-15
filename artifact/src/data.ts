/**
 * Accès aux données depuis l'artefact.
 * Une page d'artefact ne peut pas appeler Internet directement : elle passe par le connecteur
 * Firecrawl de la personne qui la regarde (capacité « mcp »), qui va lire l'adresse publique demandée.
 * Chaque lecture consomme un crédit Firecrawl : les réponses sont donc gardées en cache.
 */
import { createJudaism } from "@/lib/judaisme/core";
import type { CalendarPayload, StudyPayload, StudySection } from "@/lib/judaisme/types";
import { METEOALARM_FEED, parseAlerts } from "@/lib/meteo/alerts";
import { fetchAirQuality, fetchForecast, type JsonLoader } from "@/lib/meteo/open-meteo";
import type { AirQuality, AlertsPayload, Forecast } from "@/lib/meteo/types";
import { decodeEntities, parseFeed } from "@/lib/rss/parse";
import { REAL_MADRID_PATTERN, sourcesForTab, type NewsTab } from "@/lib/rss/sources";
import type { Article, NewsPayload, SourceStatus } from "@/lib/rss/types";
import { store } from "./dom";

const SERVER = "Firecrawl";
const TOOL = "firecrawl_scrape";
const MINUTE = 60 * 1000;

interface McpError {
  code?: string;
  message?: string;
  retryable?: boolean;
  retryAfterMs?: number;
}
interface Mcp {
  callTool(server: string, tool: string, input?: unknown, options?: unknown): Promise<{ payload?: unknown }>;
}
declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> };
  }
}

/** Erreur avec un message déjà rédigé pour l'utilisateur, et le code d'origine pour adapter l'affichage. */
export class DataError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

const mcpPromise: Promise<Mcp | null> = window.claude ? (window.claude.use("mcp") as Promise<Mcp | null>).catch(() => null) : Promise.resolve(null);

function explain(error: McpError): DataError {
  const code = error.code ?? "upstream_error";
  switch (code) {
    case "server_not_connected":
    case "selection_required":
    case "server_not_found":
      return new DataError("Le connecteur Firecrawl n'est pas disponible. Ajoute-le dans claude.ai : Réglages → Connecteurs.", code);
    case "needs_reauth":
      return new DataError("Le connecteur Firecrawl doit être reconnecté dans claude.ai : Réglages → Connecteurs.", code);
    case "not_in_manifest":
    case "approval_required":
    case "consent_required":
    case "not_granted":
      return new DataError("Tu n'as pas autorisé Firecrawl pour cette page. Autorise-le pour afficher les données en direct.", code);
    case "blocked_by_policy":
      return new DataError("L'utilisation de Firecrawl depuis cette page est bloquée par les règles de ton organisation.", code);
    case "server_unavailable":
    case "rate_limited":
      return new DataError("Firecrawl ne répond pas pour le moment. Réessaie dans un instant.", code);
    case "tool_error":
      return new DataError("la source n'a pas pu être lue", code);
    default:
      return new DataError("lecture impossible pour le moment", code);
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Lit le contenu brut d'une adresse publique via Firecrawl. */
async function readUrl(url: string, retried = false): Promise<string> {
  const mcp = await mcpPromise;
  if (!mcp) throw new DataError("Les données en direct ne sont disponibles que dans Claude, avec le connecteur Firecrawl.", "no_mcp");
  try {
    const result = await mcp.callTool(
      SERVER,
      TOOL,
      {
        url,
        formats: ["rawHtml"],
        maxAge: 10 * MINUTE,
        objective: "Afficher des données publiques (météo, titres de presse) dans un tableau de bord personnel.",
      },
      { cache: { staleTime: 10 * MINUTE, gcTime: 60 * MINUTE } },
    );
    const payload = result.payload as { rawHtml?: unknown } | string | undefined;
    const raw = typeof payload === "string" ? payload : payload?.rawHtml;
    if (typeof raw !== "string" || !raw.trim()) throw { code: "tool_error" };
    return raw;
  } catch (e) {
    const error = (e ?? {}) as McpError;
    // Une seule nouvelle tentative, uniquement si le connecteur l'indique (lecture sans effet de bord).
    if (error.retryable && !retried) {
      await wait(Math.min(error.retryAfterMs ?? 1500, 8000) + Math.random() * 500);
      return readUrl(url, true);
    }
    throw e instanceof DataError ? e : explain(error);
  }
}

/** Certaines réponses JSON reviennent enveloppées dans une page HTML (<pre>…</pre>) : on en extrait le texte. */
function unwrapJson(raw: string): string {
  const text = raw.trim();
  if (text.startsWith("{") || text.startsWith("[")) return text;
  const pre = text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  return decodeEntities(pre ? pre[1] : text.replace(/<[^>]+>/g, ""));
}

const loadJson: JsonLoader = async <T>(url: string): Promise<T> => {
  let data: (T & { error?: boolean; reason?: string }) | null = null;
  try {
    data = JSON.parse(unwrapJson(await readUrl(url)));
  } catch (e) {
    if (e instanceof DataError) throw e;
    throw new DataError("réponse illisible de la source", "parse");
  }
  if (!data || data.error) throw new DataError(data?.reason ?? "réponse vide de la source", "source");
  return data;
};

// ---------- Cache local (affichage immédiat, économie de crédits) ----------
export interface Cached<T> {
  data: T;
  at: number;
}

export async function cachedLoad<T>(key: string, ttlMs: number, load: () => Promise<T>, force = false): Promise<Cached<T>> {
  const hit = store.get<Cached<T>>(`dash-cache:${key}`);
  if (!force && hit && Date.now() - hit.at < ttlMs) return hit;
  const fresh = { data: await load(), at: Date.now() };
  store.set(`dash-cache:${key}`, fresh);
  return fresh;
}

/** Au démarrage : retire du stockage les réponses de plus de 2 jours (les clés datées s'accumuleraient sinon). */
try {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith("dash-cache:")) continue;
    const entry = store.get<Cached<unknown>>(key);
    if (!entry || Date.now() - entry.at > 48 * 60 * MINUTE) localStorage.removeItem(key);
  }
} catch {
  // Stockage indisponible.
}

// ---------- Météo ----------
export const loadForecast = (force: boolean): Promise<Cached<Forecast>> => cachedLoad("previsions", 20 * MINUTE, () => fetchForecast(loadJson), force);
export const loadAir = (force: boolean): Promise<Cached<AirQuality>> => cachedLoad("air", 30 * MINUTE, () => fetchAirQuality(loadJson), force);
export const loadAlerts = (force: boolean): Promise<Cached<AlertsPayload>> =>
  cachedLoad("alertes", 30 * MINUTE, async () => parseAlerts(await loadJson(METEOALARM_FEED)), force);

// ---------- Presse ----------
const PER_SOURCE = 10;
const maxAge = (tab: NewsTab) => (tab === "cours" ? 60 : 3) * 24 * 60 * MINUTE;

async function fetchNews(tab: NewsTab): Promise<NewsPayload> {
  const sources = sourcesForTab(tab);
  const results = await Promise.allSettled(sources.map(async (s) => parseFeed(await readUrl(s.url), 30)));
  // Si toutes les lectures échouent pour la même raison (connecteur absent ou non autorisé), c'est un problème de page.
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failures.length === results.length && failures[0]?.reason instanceof DataError && failures[0].reason.code !== "tool_error") {
    throw failures[0].reason;
  }

  const now = Date.now();
  const articles: Article[] = [];
  const statuses: SourceStatus[] = sources.map((source, i) => {
    const result = results[i];
    if (result.status === "rejected") {
      const reason = result.reason instanceof Error ? result.reason.message : "lecture impossible";
      return { id: source.id, name: source.name, group: source.group, ok: false, count: 0, error: reason };
    }
    const onlyReal = tab === "real" && source.tab !== "real";
    const recent = result.value
      .filter((item) => !item.publishedAt || now - new Date(item.publishedAt).getTime() < maxAge(tab))
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

export const loadNews = (tab: NewsTab, force: boolean): Promise<Cached<NewsPayload>> => cachedLoad(`presse-${tab}`, 30 * MINUTE, () => fetchNews(tab), force);
export const newsSourceCount = (tab: NewsTab) => sourcesForTab(tab).length;

// ---------- Vie juive (Hebcal et Sefaria, lus via Firecrawl) ----------
const judaism = createJudaism(loadJson, async (key, ttlMs, load) => (await cachedLoad(key, ttlMs, load)).data);

/** Les lecteurs gèrent leur propre cache par source ; `force` vide ce cache avant de relire. */
function forget(prefixes: string[]): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (prefixes.some((p) => key.startsWith(`dash-cache:${p}`))) localStorage.removeItem(key);
    }
  } catch {
    // Stockage indisponible : rien à vider.
  }
}

export async function loadCalendar(candleMinutes: number, force: boolean): Promise<Cached<CalendarPayload>> {
  if (force) forget(["hebcal:calendrier"]);
  const data = await judaism.getCalendar(candleMinutes);
  return { data, at: new Date(data.fetchedAt).getTime() };
}

export async function loadStudy(section: StudySection, chapters: 1 | 3, force: boolean): Promise<Cached<StudyPayload>> {
  if (force) forget(["hebcal:etude", "hebcal:paracha", "sefaria:"]);
  const data = await judaism.loadStudy(section, chapters);
  return { data, at: Date.now() };
}
