/**
 * Suivi d'étude : tu coches ce que tu as lu (paracha, Tehilim, Halakha, Rambam) et la page compte ta série.
 * Le chabbat ne casse pas une série quotidienne (on n'utilise pas l'écran ce jour-là) : le samedi est neutre.
 * La paracha se compte par semaine. Les marques sont enregistrées dans l'espace privé de la page.
 */
import type { StudySection } from "@/lib/judaisme/types";
import { h, icon } from "./dom";
import { liveList } from "./store";

interface Jour {
  id: string;
  paracha: boolean;
  tehilim: boolean;
  halakha: boolean;
  rambam: boolean;
}
export const SECTIONS: StudySection[] = ["paracha", "tehilim", "halakha", "rambam"];
export const lectures = liveList<Jour>("etude", "jours", (id, d) => (/^\d{4}-\d{2}-\d{2}$/.test(id) ? { id, paracha: d.paracha === true, tehilim: d.tehilim === true, halakha: d.halakha === true, rambam: d.rambam === true } : null));

const TZ = "Europe/Zurich";
export const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const shift = (key: string, days: number) => new Date(Date.parse(`${key}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();
/** Dimanche de la semaine d'une date (la semaine de lecture va du dimanche au chabbat). */
const weekOf = (key: string) => shift(key, -weekdayOf(key));
const letter = new Intl.DateTimeFormat("fr-CH", { weekday: "narrow", timeZone: "UTC" });

export function isDone(section: StudySection, key = todayKey()): boolean {
  return lectures.items.find((j) => j.id === key)?.[section] === true;
}

/** Nombre de jours (ou de semaines pour la paracha) d'affilée, jusqu'à aujourd'hui. */
export function streak(section: StudySection): number {
  const done = new Set(lectures.items.filter((j) => j[section]).map((j) => j.id));
  const today = todayKey();
  let count = 0;
  if (section === "paracha") {
    const weeks = new Set([...done].map(weekOf));
    // La semaine en cours ne casse pas la série tant qu'elle n'est pas finie.
    let week = weeks.has(weekOf(today)) ? weekOf(today) : shift(weekOf(today), -7);
    while (weeks.has(week)) {
      count++;
      week = shift(week, -7);
    }
    return count;
  }
  // Aujourd'hui pas encore lu : la série court jusqu'à hier.
  let day = done.has(today) ? today : shift(today, -1);
  for (let guard = 0; guard < 3660; guard++) {
    if (done.has(day)) count++;
    else if (weekdayOf(day) !== 6) break;
    day = shift(day, -1);
  }
  return count;
}

/** Bandeau de suivi d'un onglet d'étude : bouton « lu », série en cours et les sept derniers jours. */
export function tracker(section: StudySection): HTMLElement {
  lectures.start();
  const box = h("div", { class: "tracker" });
  const status = h("p", { class: "note keep", role: "status" });

  const toggle = async (): Promise<void> => {
    const key = todayKey();
    const current = lectures.items.find((j) => j.id === key) ?? { id: key, paracha: false, tehilim: false, halakha: false, rambam: false };
    const next = { ...current, [section]: !current[section] };
    try {
      // Un jour sans aucune lecture cochée n'a pas besoin d'être gardé.
      await (SECTIONS.some((s) => next[s]) ? lectures.save(next) : lectures.remove(key));
      status.textContent = next[section] ? "Lecture notée pour aujourd'hui." : "Marque retirée.";
    } catch (e) {
      status.textContent = e instanceof Error ? e.message : "L'enregistrement a échoué.";
    }
  };

  const render = () => {
    if (lectures.status === "indisponible") return box.replaceChildren(h("p", { class: "note" }, "Suivi d'étude indisponible dans cette vue (stockage de la page inaccessible)."));
    if (lectures.status !== "pret") return box.replaceChildren();
    const today = todayKey();
    const done = isDone(section);
    const n = streak(section);
    const unit = section === "paracha" ? (n > 1 ? "semaines" : "semaine") : n > 1 ? "jours" : "jour";
    const days = Array.from({ length: 7 }, (_, i) => shift(today, i - 6));
    box.replaceChildren(
      h("button", { class: `btn${done ? " primary" : ""}`, type: "button", "aria-pressed": String(done), onclick: () => void toggle() }, icon("circle-check"), done ? "Lu aujourd'hui" : "Marquer comme lu"),
      h("p", { class: "streak" }, icon("flame", "ic ic-sm"), h("strong", { class: "num" }, String(n)), ` ${unit} d'affilée`),
      h(
        "ol",
        { class: "week", "aria-label": "Sept derniers jours" },
        ...days.map((key) => {
          const read = isDone(section, key);
          const shabbat = weekdayOf(key) === 6;
          return h("li", { class: `${read ? "read" : ""}${shabbat && !read ? " rest" : ""}${key === today ? " today" : ""}`, title: `${key.slice(8)}.${key.slice(5, 7)} : ${read ? "lu" : shabbat ? "chabbat" : "pas lu"}` }, letter.format(new Date(`${key}T12:00:00Z`)).toUpperCase(), h("span", { class: "sr-only" }, read ? " lu" : shabbat ? " chabbat" : " pas lu"));
        }),
      ),
      status,
    );
  };
  const stop = lectures.onChange(() => (box.isConnected ? render() : stop()));
  // Le bandeau est créé avant d'être placé dans la page : on attend un instant avant le premier rendu.
  setTimeout(render, 0);
  return box;
}
