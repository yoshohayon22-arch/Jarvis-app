import "server-only";

import { cached } from "@/lib/server-cache";
import type { CalendarPayload } from "./types";

/**
 * Hebcal (API publique, sans clé) pour Genève : date hébraïque, chabbat, zmanim, fêtes et programmes d'étude.
 * Les horaires sont calculés (écart possible de 1 à 2 minutes avec ceux de ta communauté).
 */
const GENEVA = "geonameid=2660646";
const BASE = "https://www.hebcal.com";
const MINUTE = 60 * 1000;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store", signal: AbortSignal.timeout(10000) }).catch((e: unknown) => {
    throw new Error(e instanceof Error && e.name === "TimeoutError" ? "Hebcal n'a pas répondu en 10 secondes" : "Hebcal est injoignable");
  });
  if (!res.ok) throw new Error(`Hebcal a répondu ${res.status}`);
  return (await res.json()) as T;
}

/** Date du jour à Genève, au format AAAA-MM-JJ. */
export function todayInGeneva(offsetDays = 0): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(Date.now() + offsetDays * 86400000),
  );
  return parts;
}

const ZMANIM: [string, string, boolean][] = [
  ["alotHaShachar", "Aube (alot hacha'har)", true],
  ["misheyakir", "Michéyakir (talit et téfilines)", false],
  ["sunrise", "Lever du soleil (nets)", true],
  ["sofZmanShmaMGA", "Fin du Chéma (Magen Avraham)", false],
  ["sofZmanShma", "Fin du Chéma (Gra)", true],
  ["sofZmanTfilla", "Fin de la téfila (Gra)", false],
  ["chatzot", "Midi solaire (hatsot)", true],
  ["minchaGedola", "Min'ha guédola", false],
  ["minchaKetana", "Min'ha kétana", false],
  ["plagHaMincha", "Plag hamin'ha", false],
  ["sunset", "Coucher du soleil (chkia)", true],
  ["tzeit7083deg", "Sortie des étoiles (tsét hakokhavim)", true],
  ["tzeit72min", "Sortie des étoiles selon Rabbénou Tam (72 min)", false],
];

interface HebcalItem {
  title: string;
  date: string;
  category: string;
  hebrew?: string;
  hdate?: string;
  link?: string;
  memo?: string;
}

async function loadCalendar(candleMinutes: number): Promise<CalendarPayload> {
  const today = todayInGeneva();
  const [zmanim, shabbat, holidays] = await Promise.all([
    get<{ times: Record<string, string> }>(`/zmanim?cfg=json&${GENEVA}&date=${today}`),
    get<{ items: HebcalItem[] }>(`/shabbat?cfg=json&${GENEVA}&b=${candleMinutes}&M=on&lg=fr`),
    get<{ items: HebcalItem[] }>(`/hebcal?cfg=json&v=1&maj=on&min=on&mod=on&nx=on&ss=on&i=off&lg=fr&start=${today}&end=${todayInGeneva(200)}`),
  ]);

  // Le jour hébraïque commence au coucher du soleil : après la chkia, on demande la date du lendemain soir (gs=on).
  const sunset = zmanim.times.sunset ? new Date(zmanim.times.sunset).getTime() : null;
  const afterSunset = sunset != null && Date.now() > sunset;
  const converted = await get<{ hd: number; hm: string; hy: number; hebrew: string }>(
    `/converter?cfg=json&date=${today}&g2h=1&strict=1&lg=fr${afterSunset ? "&gs=on" : ""}`,
  );

  const candles = shabbat.items.find((i) => i.category === "candles");
  const havdalah = shabbat.items.find((i) => i.category === "havdalah");
  const parasha = shabbat.items.find((i) => i.category === "parashat");

  // Fêtes à venir : une ligne par fête (les 8 jours de Hanouka, par exemple, ne comptent qu'une fois).
  const seen = new Set<string>();
  const upcoming: CalendarPayload["holidays"] = [];
  for (const item of holidays.items) {
    const base = item.title.split(":")[0].replace(/\s+(I{1,3}|IV|V|VI{0,3}|\d+)$/u, "").trim();
    if (seen.has(base)) continue;
    seen.add(base);
    upcoming.push({ title: item.title.includes(":") ? base : item.title, hebrew: item.hebrew ?? null, date: item.date.slice(0, 10), hebrewDate: item.hdate ?? null });
    if (upcoming.length >= 10) break;
  }

  return {
    hebrewDate: { text: `${converted.hd} ${converted.hm} ${converted.hy}`, hebrew: converted.hebrew, afterSunset },
    shabbat: {
      candles: candles?.date ?? null,
      havdalah: havdalah?.date ?? null,
      parasha: parasha?.title ?? null,
      parashaHebrew: parasha?.hebrew ?? null,
      candleMinutes,
    },
    zmanim: ZMANIM.filter(([key]) => zmanim.times[key]).map(([key, label, main]) => ({ key, label, time: zmanim.times[key], main })),
    holidays: upcoming,
    fetchedAt: new Date().toISOString(),
  };
}

export const getCalendar = (candleMinutes: number) => cached(`hebcal:calendrier:${candleMinutes}:${todayInGeneva()}`, 15 * MINUTE, () => loadCalendar(candleMinutes));

export interface LearningItem {
  title: string;
  hebrew: string | null;
  /** Référence Sefaria extraite du lien fourni par Hebcal. */
  ref: string;
}

/** Programmes d'étude du jour selon Hebcal : Tehilim (cycle mensuel), Rambam 1 ou 3 chapitres. */
async function loadLearning(): Promise<Record<string, LearningItem>> {
  const today = todayInGeneva();
  const data = await get<{ items: HebcalItem[] }>(`/hebcal?cfg=json&v=1&start=${today}&end=${today}&dps=on&dr1=on&dr3=on&lg=fr`);
  const out: Record<string, LearningItem> = {};
  for (const item of data.items) {
    const path = item.link?.match(/sefaria\.org\/([^?]+)/)?.[1];
    if (!path) continue;
    out[item.category] = { title: item.title, hebrew: item.hebrew ?? null, ref: decodeURIComponent(path) };
  }
  return out;
}

export const getLearning = () => cached(`hebcal:etude:${todayInGeneva()}`, 30 * MINUTE, loadLearning);

/** Paracha de la semaine (diaspora) selon Hebcal, avec son nom en français. */
export const getParashaName = () =>
  cached(`hebcal:paracha:${todayInGeneva()}`, 60 * MINUTE, async () => {
    const data = await get<{ items: HebcalItem[] }>(`/shabbat?cfg=json&${GENEVA}&M=on&lg=fr`);
    const item = data.items.find((i) => i.category === "parashat");
    return item ? { title: item.title, hebrew: item.hebrew ?? null } : null;
  });
