/** Données « Vie juive » mises en forme pour l'affichage (sources : Hebcal et Sefaria). */

export interface CalendarPayload {
  /** Date hébraïque du moment (elle change au coucher du soleil). */
  hebrewDate: { text: string; hebrew: string; afterSunset: boolean };
  shabbat: {
    candles: string | null;
    havdalah: string | null;
    parasha: string | null;
    parashaHebrew: string | null;
    candleMinutes: number;
  };
  zmanim: { key: string; label: string; time: string; main: boolean }[];
  holidays: { title: string; hebrew: string | null; date: string; hebrewDate: string | null }[];
  fetchedAt: string;
}

export interface Verse {
  /** Numéro du verset / paragraphe dans sa section. */
  n: number;
  hebrew: string;
  translation: string;
}

export interface StudyText {
  /** Référence Sefaria, ex. « Psalms 29-34 ». */
  ref: string;
  hebrewRef: string;
  sections: { number: number | null; verses: Verse[] }[];
  /** Traduction retenue (français si disponible, sinon anglais), ou null si aucune. */
  translation: { language: "fr" | "en"; title: string } | null;
  hebrewVersion: string | null;
  /** Lien vers le texte original sur Sefaria. */
  url: string;
}

export type StudySection = "paracha" | "tehilim" | "halakha" | "rambam";

export interface StudyPayload {
  section: StudySection;
  /** Titre lisible, ex. « Parachah Vayétzé » ou « Psaumes 29-34 ». */
  title: string;
  hebrewTitle: string | null;
  /** Mot utilisé pour numéroter les sections du texte (« Chapitre », « Psaume », « Siman »). */
  sectionLabel: string;
  text: StudyText;
  /** Paracha : montées (aliyot) et haftara, avec leur référence. */
  extras: { label: string; ref: string; url: string }[];
  /** D'où vient le programme du jour. */
  scheduleSource: string;
  fetchedAt: string;
}
