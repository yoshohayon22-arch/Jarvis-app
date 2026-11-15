/**
 * Vie juive : lecture de Hebcal et de Sefaria (API publiques, sans clé).
 * Ce module ne sait ni « aller chercher » ni « mettre en cache » : on lui fournit ces deux fonctions.
 * Le site les branche sur son serveur (fetch + cache mémoire), l'artefact sur un connecteur (cache local).
 * Les horaires sont calculés pour Genève (écart possible de 1 à 2 minutes avec ceux de ta communauté).
 */
import { cleanText } from "@/lib/rss/parse";
import type {
  CalendarPayload,
  StudyPayload,
  StudySection,
  StudyText,
  Verse,
} from "./types";

/** Va chercher un JSON à une adresse complète. */
export type JsonGet = <T>(url: string) => Promise<T>;
/** Garde le résultat de `load` pendant `ttlMs` sous la clé `key`. */
export type Cache = <T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
) => Promise<T>;

const HEBCAL = "https://www.hebcal.com";
const SEFARIA = "https://www.sefaria.org";
const GENEVA = "geonameid=2660646";
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Date du jour à Genève, au format AAAA-MM-JJ. */
export function todayInGeneva(offsetDays = 0): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 86400000));
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

export interface LearningItem {
  title: string;
  hebrew: string | null;
  /** Référence Sefaria extraite du lien fourni par Hebcal. */
  ref: string;
}

export interface CalendarItem {
  title: string;
  display: string;
  hebrewDisplay: string | null;
  ref: string;
  aliyot: string[];
}

export const sefariaUrl = (ref: string) =>
  `${SEFARIA}/${encodeURIComponent(ref.replace(/ /g, "_")).replace(/%2C/g, ",").replace(/%3A/g, ".")}?lang=bi`;

/** Traduit les noms de livres les plus courants des références Sefaria (le reste est laissé tel quel). */
function frenchRef(display: string): string {
  return display
    .replace(/^Psalms/, "Psaumes")
    .replace(/^Genesis/, "Genèse")
    .replace(/^Exodus/, "Exode")
    .replace(/^Leviticus/, "Lévitique")
    .replace(/^Numbers/, "Nombres")
    .replace(/^Deuteronomy/, "Deutéronome")
    .replace(/^Mishneh Torah, /, "Michné Torah, ")
    .replace(/^Shulchan Arukh, Orach Chayim/, "Choul'han Aroukh, Ora'h 'Haïm")
    .replace(/^Shulchan Arukh, Yoreh De'ah/, "Choul'han Aroukh, Yoré Déa")
    .replace(/^Shulchan Arukh/, "Choul'han Aroukh");
}

type Nested = string | Nested[];

/** Retire les notes de bas de page puis toute mise en forme HTML. */
function clean(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return cleanText(
    raw
      .replace(/<sup[^>]*class="footnote-marker"[^>]*>[\s\S]*?<\/sup>/gi, "")
      .replace(/<i[^>]*class="footnote"[^>]*>[\s\S]*?<\/i>/gi, ""),
  );
}

/** Met un texte Sefaria (une ou plusieurs sections) sous forme de liste de sections de versets. */
function toSections(text: Nested | undefined): string[][] {
  if (!Array.isArray(text)) return typeof text === "string" ? [[text]] : [];
  if (text.every((x) => typeof x === "string")) return [text as string[]];
  return (text as Nested[]).map((section) =>
    Array.isArray(section)
      ? (section.flat(3) as string[])
      : [section as string],
  );
}

interface ApiVersion {
  language: string;
  actualLanguage?: string;
  versionTitle: string;
  text: Nested;
}

/** Met en forme la réponse « texte » de Sefaria. */
function toStudyText(data: {
  ref: string;
  heRef: string;
  sections?: (string | number)[];
  versions: ApiVersion[];
}): StudyText {
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
    const verses: Verse[] = Array.from(
      { length: Math.max(heVerses.length, trVerses.length) },
      (_, i) => ({
        n: start + i,
        hebrew: clean(heVerses[i]),
        translation: clean(trVerses[i]),
      }),
    ).filter((v) => v.hebrew || v.translation);
    return {
      number: Number.isFinite(firstSection) ? firstSection + s : null,
      verses,
    };
  }).filter((s) => s.verses.length);

  if (!sections.length)
    throw new Error("Sefaria n'a renvoyé aucun texte pour cette référence");

  return {
    ref: data.ref,
    hebrewRef: data.heRef,
    sections,
    translation: translation
      ? {
          language: lang(translation) === "fr" ? "fr" : "en",
          title: translation.versionTitle.replace(/\s*\[fr\]$/, ""),
        }
      : null,
    hebrewVersion: hebrew?.versionTitle ?? null,
    url: sefariaUrl(data.ref),
  };
}

/** Assemble les lecteurs à partir d'un moyen d'aller chercher les données et d'un cache. */
export function createJudaism(get: JsonGet, cache: Cache) {
  const hebcal = <T>(path: string) => get<T>(`${HEBCAL}${path}`);
  const sefaria = <T>(path: string) => get<T>(`${SEFARIA}${path}`);

  async function loadCalendar(candleMinutes: number): Promise<CalendarPayload> {
    const today = todayInGeneva();
    const [zmanim, shabbat, holidays] = await Promise.all([
      hebcal<{ times: Record<string, string> }>(
        `/zmanim?cfg=json&${GENEVA}&date=${today}`,
      ),
      hebcal<{ items: HebcalItem[] }>(
        `/shabbat?cfg=json&${GENEVA}&b=${candleMinutes}&M=on&lg=fr`,
      ),
      hebcal<{ items: HebcalItem[] }>(
        `/hebcal?cfg=json&v=1&maj=on&min=on&mod=on&nx=on&ss=on&i=off&lg=fr&start=${today}&end=${todayInGeneva(200)}`,
      ),
    ]);

    // Le jour hébraïque commence au coucher du soleil : après la chkia, on demande la date du lendemain soir (gs=on).
    const sunset = zmanim.times.sunset
      ? new Date(zmanim.times.sunset).getTime()
      : null;
    const afterSunset = sunset != null && Date.now() > sunset;
    const converted = await hebcal<{
      hd: number;
      hm: string;
      hy: number;
      hebrew: string;
    }>(
      `/converter?cfg=json&date=${today}&g2h=1&strict=1&lg=fr${afterSunset ? "&gs=on" : ""}`,
    );

    const candles = shabbat.items.find((i) => i.category === "candles");
    const havdalah = shabbat.items.find((i) => i.category === "havdalah");
    const parasha = shabbat.items.find((i) => i.category === "parashat");

    // Fêtes à venir : une ligne par fête (les 8 jours de Hanouka, par exemple, ne comptent qu'une fois).
    const seen = new Set<string>();
    const upcoming: CalendarPayload["holidays"] = [];
    for (const item of holidays.items) {
      const base = item.title
        .split(":")[0]
        .replace(/\s+(I{1,3}|IV|V|VI{0,3}|\d+)$/u, "")
        .trim();
      if (seen.has(base)) continue;
      seen.add(base);
      upcoming.push({
        title: item.title.includes(":") ? base : item.title,
        hebrew: item.hebrew ?? null,
        date: item.date.slice(0, 10),
        hebrewDate: item.hdate ?? null,
      });
      if (upcoming.length >= 10) break;
    }

    return {
      hebrewDate: {
        text: `${converted.hd} ${converted.hm} ${converted.hy}`,
        hebrew: converted.hebrew,
        afterSunset,
      },
      shabbat: {
        candles: candles?.date ?? null,
        havdalah: havdalah?.date ?? null,
        parasha: parasha?.title ?? null,
        parashaHebrew: parasha?.hebrew ?? null,
        candleMinutes,
      },
      zmanim: ZMANIM.filter(([key]) => zmanim.times[key]).map(
        ([key, label, main]) => ({ key, label, time: zmanim.times[key], main }),
      ),
      holidays: upcoming,
      fetchedAt: new Date().toISOString(),
    };
  }

  /** Programmes d'étude du jour selon Hebcal : Tehilim (cycle mensuel), Rambam 1 ou 3 chapitres. */
  async function loadLearning(): Promise<Record<string, LearningItem>> {
    const today = todayInGeneva();
    const data = await hebcal<{ items: HebcalItem[] }>(
      `/hebcal?cfg=json&v=1&start=${today}&end=${today}&dps=on&dr1=on&dr3=on&lg=fr`,
    );
    const out: Record<string, LearningItem> = {};
    for (const item of data.items) {
      const path = item.link?.match(/sefaria\.org\/([^?]+)/)?.[1];
      if (!path) continue;
      out[item.category] = {
        title: item.title,
        hebrew: item.hebrew ?? null,
        ref: decodeURIComponent(path),
      };
    }
    return out;
  }

  /** Programme du jour selon le calendrier d'étude de Sefaria (diaspora). */
  async function loadCalendars(): Promise<Record<string, CalendarItem>> {
    const data = await sefaria<{
      calendar_items: {
        title: { en: string };
        displayValue?: { en?: string; he?: string };
        ref?: string;
        extraDetails?: { aliyot?: string[] };
      }[];
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

  const getCalendar = (candleMinutes: number) =>
    cache(
      `hebcal:calendrier:${candleMinutes}:${todayInGeneva()}`,
      15 * MINUTE,
      () => loadCalendar(candleMinutes),
    );
  const getLearning = () =>
    cache(`hebcal:etude:${todayInGeneva()}`, 30 * MINUTE, loadLearning);
  const getSefariaCalendars = () =>
    cache(`sefaria:calendrier:${todayInGeneva()}`, HOUR, loadCalendars);
  /** Paracha de la semaine (diaspora) selon Hebcal, avec son nom en français. */
  const getParashaName = () =>
    cache(`hebcal:paracha:${todayInGeneva()}`, HOUR, async () => {
      const data = await hebcal<{ items: HebcalItem[] }>(
        `/shabbat?cfg=json&${GENEVA}&M=on&lg=fr`,
      );
      const item = data.items.find((i) => i.category === "parashat");
      return item ? { title: item.title, hebrew: item.hebrew ?? null } : null;
    });
  /** Texte d'une référence, gardé 12 heures (les textes ne changent pas). */
  const getText = (ref: string) =>
    cache(`sefaria:texte:${ref}`, 12 * HOUR, async () =>
      toStudyText(
        await sefaria(
          `/api/v3/texts/${encodeURIComponent(ref)}?version=hebrew&version=french&version=english`,
        ),
      ),
    );

  /** Programme du jour et texte pour un onglet d'étude. */
  async function loadStudy(
    section: StudySection,
    rambamChapters: 1 | 3,
  ): Promise<StudyPayload> {
    const fetchedAt = new Date().toISOString();

    if (section === "paracha") {
      const [calendars, name] = await Promise.all([
        getSefariaCalendars(),
        getParashaName(),
      ]);
      const parasha = calendars["Parashat Hashavua"];
      if (!parasha)
        throw new Error(
          "le calendrier Sefaria n'indique pas de paracha cette semaine",
        );
      const haftarah = calendars["Haftarah"];
      const extras = [
        ...parasha.aliyot.map((ref, i) => ({
          label: i < 7 ? `${i + 1}${i === 0 ? "re" : "e"} montée` : "Maftir",
          ref: frenchRef(ref),
          url: sefariaUrl(ref),
        })),
        ...(haftarah
          ? [
              {
                label: "Haftara",
                ref: haftarah.ref,
                url: sefariaUrl(haftarah.ref),
              },
            ]
          : []),
      ];
      return {
        section,
        title: name?.title ?? `Paracha ${parasha.display}`,
        hebrewTitle: name?.hebrew ?? parasha.hebrewDisplay,
        sectionLabel: "Chapitre",
        text: await getText(parasha.ref),
        extras,
        scheduleSource: "Hebcal (paracha de diaspora) et calendrier Sefaria",
        fetchedAt,
      };
    }

    if (section === "halakha") {
      const item = (await getSefariaCalendars())["Halakhah Yomit"];
      if (!item)
        throw new Error(
          "le calendrier Sefaria n'indique pas de halakha du jour",
        );
      return {
        section,
        title: frenchRef(item.ref),
        hebrewTitle: item.hebrewDisplay,
        sectionLabel: "Siman",
        text: await getText(item.ref),
        extras: [],
        scheduleSource: "calendrier Sefaria (Halakhah Yomit)",
        fetchedAt,
      };
    }

    const learning = await getLearning();
    const key =
      section === "tehilim"
        ? "dailyPsalms"
        : rambamChapters === 3
          ? "dailyRambam3"
          : "dailyRambam1";
    const item = learning[key];
    if (!item)
      throw new Error("Hebcal n'indique pas de programme pour aujourd'hui");
    const text = await getText(item.ref);
    return {
      section,
      title: frenchRef(text.ref),
      hebrewTitle: item.hebrew,
      sectionLabel: section === "tehilim" ? "Psaume" : "Chapitre",
      text,
      extras: [],
      scheduleSource:
        section === "tehilim"
          ? "Hebcal (cycle mensuel des Tehilim)"
          : `Hebcal (Rambam quotidien, ${rambamChapters} chapitre${rambamChapters > 1 ? "s" : ""})`,
      fetchedAt,
    };
  }

  return { getCalendar, loadStudy };
}
