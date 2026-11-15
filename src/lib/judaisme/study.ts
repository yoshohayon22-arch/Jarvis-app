import "server-only";

import { getLearning, getParashaName } from "./hebcal";
import { getSefariaCalendars, getText, sefariaUrl } from "./sefaria";
import type { StudyPayload, StudySection } from "./types";

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

/** Programme du jour et texte pour un onglet d'étude. */
export async function loadStudy(section: StudySection, rambamChapters: 1 | 3): Promise<StudyPayload> {
  const fetchedAt = new Date().toISOString();

  if (section === "paracha") {
    const [calendars, name] = await Promise.all([getSefariaCalendars(), getParashaName()]);
    const parasha = calendars["Parashat Hashavua"];
    if (!parasha) throw new Error("le calendrier Sefaria n'indique pas de paracha cette semaine");
    const haftarah = calendars["Haftarah"];
    const extras = [
      ...parasha.aliyot.map((ref, i) => ({ label: i < 7 ? `${i + 1}${i === 0 ? "re" : "e"} montée` : "Maftir", ref: frenchRef(ref), url: sefariaUrl(ref) })),
      ...(haftarah ? [{ label: "Haftara", ref: haftarah.ref, url: sefariaUrl(haftarah.ref) }] : []),
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
    if (!item) throw new Error("le calendrier Sefaria n'indique pas de halakha du jour");
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
  const key = section === "tehilim" ? "dailyPsalms" : rambamChapters === 3 ? "dailyRambam3" : "dailyRambam1";
  const item = learning[key];
  if (!item) throw new Error("Hebcal n'indique pas de programme pour aujourd'hui");
  const text = await getText(item.ref);
  return {
    section,
    title: frenchRef(text.ref),
    hebrewTitle: item.hebrew,
    sectionLabel: section === "tehilim" ? "Psaume" : "Chapitre",
    text,
    extras: [],
    scheduleSource: section === "tehilim" ? "Hebcal (cycle mensuel des Tehilim)" : `Hebcal (Rambam quotidien, ${rambamChapters} chapitre${rambamChapters > 1 ? "s" : ""})`,
    fetchedAt,
  };
}
