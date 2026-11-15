import "server-only";

import { cleanText } from "@/lib/rss/parse";
import { cached } from "@/lib/server-cache";
import type { StudyText, Verse } from "./types";

/** Sefaria (API publique, sans clé) : programme d'étude quotidien et textes avec traduction. */
const BASE = "https://www.sefaria.org";
const HOUR = 60 * 60 * 1000;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store", signal: AbortSignal.timeout(15000) }).catch((e: unknown) => {
    throw new Error(e instanceof Error && e.name === "TimeoutError" ? "Sefaria n'a pas répondu en 15 secondes" : "Sefaria est injoignable");
  });
  if (!res.ok) throw new Error(`Sefaria a répondu ${res.status}`);
  return (await res.json()) as T;
}

export const sefariaUrl = (ref: string) => `${BASE}/${encodeURIComponent(ref.replace(/ /g, "_")).replace(/%2C/g, ",").replace(/%3A/g, ".")}?lang=bi`;

export interface CalendarItem {
  title: string;
  display: string;
  hebrewDisplay: string | null;
  ref: string;
  aliyot: string[];
}

/** Programme du jour selon le calendrier d'étude de Sefaria (diaspora). */
async function loadCalendars(): Promise<Record<string, CalendarItem>> {
  const data = await get<{
    calendar_items: { title: { en: string }; displayValue?: { en?: string; he?: string }; ref?: string; extraDetails?: { aliyot?: string[] } }[];
  }>("/api/calendars?diaspora=1&timezone=Europe/Zurich");
  const out: Record<string, CalendarItem> = {};
  for (const item of data.calendar_items) {
    if (!item.ref) continue;
    out[item.title.en] = {
      title: item.title.en,
      display: item.displayValue?.en ?? item.ref,
      hebrewDisplay: item.displayValue?.he ?? null,
      ref: item.ref,
      aliyot: item.extraDetails?.aliyot ?? [],
    };
  }
  return out;
}

export const getSefariaCalendars = () => cached("sefaria:calendrier", HOUR, loadCalendars);

type Nested = string | Nested[];

/** Retire les notes de bas de page puis toute mise en forme HTML. */
function clean(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return cleanText(raw.replace(/<sup[^>]*class="footnote-marker"[^>]*>[\s\S]*?<\/sup>/gi, "").replace(/<i[^>]*class="footnote"[^>]*>[\s\S]*?<\/i>/gi, ""));
}

/** Met un texte Sefaria (une ou plusieurs sections) sous forme de liste de sections de versets. */
function toSections(text: Nested | undefined): string[][] {
  if (!Array.isArray(text)) return typeof text === "string" ? [[text]] : [];
  if (text.every((x) => typeof x === "string")) return [text as string[]];
  return (text as Nested[]).map((section) => (Array.isArray(section) ? (section.flat(3) as string[]) : [section as string]));
}

interface ApiVersion {
  language: string;
  actualLanguage?: string;
  versionTitle: string;
  text: Nested;
}

async function loadText(ref: string): Promise<StudyText> {
  const data = await get<{
    ref: string;
    heRef: string;
    sections?: (string | number)[];
    versions: ApiVersion[];
  }>(`/api/v3/texts/${encodeURIComponent(ref)}?version=hebrew&version=french&version=english`);

  const lang = (v: ApiVersion) => v.actualLanguage ?? v.language;
  const hebrew = data.versions.find((v) => lang(v) === "he");
  const french = data.versions.find((v) => lang(v) === "fr");
  const english = data.versions.find((v) => lang(v) === "en");
  const translation = french ?? english ?? null;

  const he = toSections(hebrew?.text);
  const tr = toSections(translation?.text);
  const count = Math.max(he.length, tr.length);
  const firstSection = Number(data.sections?.[0]);
  const firstVerse = Number(data.sections?.[1]);

  const sections = Array.from({ length: count }, (_, s) => {
    const heVerses = he[s] ?? [];
    const trVerses = tr[s] ?? [];
    // La première section peut commencer en cours de chapitre (ex. Genèse 28:10) : on garde les vrais numéros.
    const start = s === 0 && Number.isFinite(firstVerse) ? firstVerse : 1;
    const verses: Verse[] = Array.from({ length: Math.max(heVerses.length, trVerses.length) }, (_, i) => ({
      n: start + i,
      hebrew: clean(heVerses[i]),
      translation: clean(trVerses[i]),
    })).filter((v) => v.hebrew || v.translation);
    return { number: Number.isFinite(firstSection) ? firstSection + s : null, verses };
  }).filter((s) => s.verses.length);

  if (!sections.length) throw new Error("Sefaria n'a renvoyé aucun texte pour cette référence");

  return {
    ref: data.ref,
    hebrewRef: data.heRef,
    sections,
    translation: translation ? { language: lang(translation) === "fr" ? "fr" : "en", title: translation.versionTitle.replace(/\s*\[fr\]$/, "") } : null,
    hebrewVersion: hebrew?.versionTitle ?? null,
    url: sefariaUrl(data.ref),
  };
}

/** Texte d'une référence, gardé 12 heures (les textes ne changent pas). */
export const getText = (ref: string) => cached(`sefaria:texte:${ref}`, 12 * HOUR, () => loadText(ref));
