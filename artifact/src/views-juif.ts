/** Vues « Vie juive » de la version artefact : calendrier, textes d'étude, cours. */
import type { CalendarPayload, StudyPayload, StudySection } from "@/lib/judaisme/types";
import type { Article } from "@/lib/rss/types";
import { loadCalendar, loadNews, loadStudy } from "./data";
import { h, icon, store } from "./dom";
import { sections } from "./layout";
import { tracker } from "./suivi";
import { card, dateFmt, emptyState, errorCard, skeleton, sourceNote, timeFmt } from "./views";

const longDate = new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", weekday: "long", day: "numeric", month: "long" });
const time = (iso: string) => timeFmt.format(new Date(iso));
const SOURCE = "Hebcal · horaires calculés pour Genève (lu via Firecrawl)";
const CANDLE_CHOICES = [18, 20, 22, 30, 40];

function refreshBar(text: string, onRefresh: () => void): HTMLElement {
  return h(
    "div",
    { class: "toolbar" },
    h("p", { class: "note" }, text),
    h("button", { class: "btn", type: "button", onclick: onRefresh }, icon("refresh-cw"), h("span", { class: "btn-label" }, "Actualiser")),
  );
}

function choice(label: string, active: boolean, onclick: () => void): HTMLElement {
  return h("button", { class: `chip${active ? " on" : ""}`, type: "button", role: "radio", "aria-checked": String(active), onclick }, label);
}

// ---------- Calendrier ----------
export function calendarView(root: HTMLElement): void {
  let minutes = store.get<number>("dash-bougies") ?? 18;
  if (!CANDLE_CHOICES.includes(minutes)) minutes = 18;
  let allTimes = store.get<boolean>("dash-zmanim-tous") === true;
  let last: { data: CalendarPayload; at: number } | null = null;
  const hero = h("div", { class: "slot" });
  const daySlot = h("div", { class: "slot" });
  const shabbatSlot = h("div", { class: "slot" });
  const holidaySlot = h("div", { class: "slot" });

  const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  const until = (iso: string, now: number) => {
    const minutesLeft = Math.round((Date.parse(iso) - now) / 60000);
    return minutesLeft < 90 ? relative.format(minutesLeft, "minute") : relative.format(Math.round(minutesLeft / 60), "hour");
  };
  const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());
  const daysTo = (date: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86_400_000);
  const shortLabel = (label: string) => label.replace(/\s*\(.*\)$/, "");

  const render = (data: CalendarPayload, at: number) => {
    last = { data, at };
    const now = Date.now();
    const times = [...data.zmanim].sort((a, b) => a.time.localeCompare(b.time));
    // Prochain horaire : d'abord parmi les principaux, sinon parmi tous.
    const future = (z: { time: string }) => Date.parse(z.time) > now;
    const next = times.filter((z) => z.main).find(future) ?? times.find(future);
    const nextHoliday = data.holidays.find((x) => daysTo(x.date) >= 0);
    const kpi = (label: string, value: string, sub: string) => h("div", { class: "kpi" }, h("dt", null, label), h("dd", null, h("span", { class: "kpi-value num" }, value)), sub ? h("dd", { class: "muted small cap" }, sub) : null);

    hero.replaceChildren(
      h(
        "section",
        { class: "hero", "aria-label": "L'essentiel" },
        h(
          "div",
          { class: "hero-main" },
          h("p", { class: "eyebrow" }, data.hebrewDate.afterSunset ? "Ce soir commence le" : "Aujourd'hui"),
          h("p", { class: "hero-title" }, data.hebrewDate.text),
          h("p", { class: "hebrew hero-hebrew", lang: "he", dir: "rtl" }, data.hebrewDate.hebrew),
          h("p", { class: "muted cap" }, longDate.format(new Date(at))),
          data.hebrewDate.afterSunset ? h("p", { class: "note" }, "Le soleil est couché : la date hébraïque affichée est déjà celle du jour qui commence ce soir.") : null,
        ),
        h(
          "dl",
          { class: "kpis" },
          next ? kpi("Prochain horaire", time(next.time), `${shortLabel(next.label)} · ${until(next.time, now)}`) : kpi("Prochain horaire", "–", "plus d'horaire aujourd'hui"),
          kpi("Allumage des bougies", data.shabbat.candles ? time(data.shabbat.candles) : "–", data.shabbat.candles ? longDate.format(new Date(data.shabbat.candles)) : "non communiqué"),
          kpi("Havdala", data.shabbat.havdalah ? time(data.shabbat.havdalah) : "–", data.shabbat.havdalah ? longDate.format(new Date(data.shabbat.havdalah)) : "non communiqué"),
          nextHoliday ? kpi("Prochaine date", daysTo(nextHoliday.date) === 0 ? "Aujourd'hui" : `${daysTo(nextHoliday.date)} j`, nextHoliday.title) : null,
        ),
      ),
    );

    // --- Horaires du jour : une frise, le prochain horaire mis en avant ---
    const shown = allTimes ? times : times.filter((z) => z.main);
    daySlot.replaceChildren(
      card("Horaires du jour", [
        h(
          "div",
          { class: "chips wrap", role: "radiogroup", "aria-label": "Horaires affichés" },
          choice("Principaux", !allTimes, () => ((allTimes = false), store.set("dash-zmanim-tous", false), render(data, at))),
          choice("Tous", allTimes, () => ((allTimes = true), store.set("dash-zmanim-tous", true), render(data, at))),
        ),
        h(
          "ol",
          { class: "timeline" },
          ...shown.map((z) => {
            const past = Date.parse(z.time) <= now;
            const isNext = z === shown.find(future);
            return h(
              "li",
              { class: `${past ? "past" : ""}${isNext ? " next" : ""}`, "aria-current": isNext ? "time" : null },
              h("span", { class: "tl-time num" }, time(z.time)),
              h("span", { class: "tl-dot", "aria-hidden": "true" }),
              h("span", { class: "tl-label" }, z.label, isNext ? h("span", { class: "pill" }, until(z.time, now)) : null, past ? h("span", { class: "sr-only" }, " (passé)") : null),
            );
          }),
        ),
        h("p", { class: "note" }, "Écart possible de 1 à 2 minutes. Pour une question pratique sur un horaire, demande à ton rabbin."),
        sourceNote(SOURCE, at),
      ]),
    );

    // --- Chabbat ---
    const slot = (label: string, iso: string | null) => h("div", { class: "tile-stat" }, h("dt", null, label), h("dd", { class: "big-2 num" }, iso ? time(iso) : "–"), h("dd", { class: "muted small cap" }, iso ? longDate.format(new Date(iso)) : "non communiqué"));
    shabbatSlot.replaceChildren(
      card(
        "Chabbat",
        [
          data.shabbat.parasha ? h("p", null, h("span", { class: "eyebrow" }, "Paracha de la semaine"), h("span", { class: "big-2" }, data.shabbat.parasha), data.shabbat.parashaHebrew ? h("span", { class: "hebrew muted", lang: "he", dir: "rtl" }, ` ${data.shabbat.parashaHebrew}`) : null) : null,
          data.shabbat.candles || data.shabbat.havdalah
            ? h("dl", { class: "stats cols-2" }, slot("Allumage des bougies", data.shabbat.candles), slot("Havdala", data.shabbat.havdalah))
            : emptyState("Pas encore de données", "Hebcal n'indique pas d'horaire de chabbat pour cette semaine."),
          h("p", { id: "bougies-label", class: "label" }, "Allumage avant le coucher du soleil"),
          h(
            "div",
            { class: "chips wrap", role: "radiogroup", "aria-labelledby": "bougies-label" },
            ...CANDLE_CHOICES.map((m) =>
              choice(`${m} min`, minutes === m, () => {
                minutes = m;
                store.set("dash-bougies", m);
                void run(false);
              }),
            ),
          ),
          h("a", { class: "text-link", href: "#paracha" }, "Lire la paracha", icon("book-open", "ic ic-sm")),
          h("p", { class: "note" }, "18 minutes par défaut. Choisis l'usage de ta communauté ; la havdala est calculée à la sortie des étoiles."),
          sourceNote(SOURCE, at),
        ],
      ),
    );

    // --- Fêtes ---
    const holiday = (x: CalendarPayload["holidays"][number]) => {
      const days = daysTo(x.date);
      return h(
        "li",
        { class: "holiday" },
        h("div", { class: "grow-2" }, h("p", { class: "expense-title" }, x.title, x.hebrew ? h("span", { class: "hebrew holiday-he muted", lang: "he", dir: "rtl" }, ` ${x.hebrew}`) : null), h("p", { class: "meta" }, h("span", { class: "cap" }, longDate.format(new Date(`${x.date}T12:00:00Z`))), x.hebrewDate ? h("span", null, x.hebrewDate) : null)),
        h("span", { class: `pill${days <= 7 ? " cat-urgent" : ""}` }, days === 0 ? "aujourd'hui" : days === 1 ? "demain" : `dans ${days} j`),
      );
    };
    const upcoming = data.holidays.filter((x) => daysTo(x.date) >= 0);
    holidaySlot.replaceChildren(
      card(
        "Fêtes et dates à venir",
        [
          upcoming.length ? h("ul", { class: "expenses" }, ...upcoming.slice(0, 8).map(holiday)) : emptyState("Pas encore de données", "Hebcal n'annonce aucune fête dans les prochains mois."),
          h("p", { class: "note" }, "Les fêtes commencent la veille au soir de la date indiquée."),
          sourceNote("Hebcal (lu via Firecrawl)", at),
        ],
        { badge: upcoming.length ? `${upcoming.length} dates` : undefined, detail: upcoming.length > 8 ? () => [h("ul", { class: "expenses" }, ...upcoming.slice(8).map(holiday))] : undefined },
      ),
    );
  };

  const run = async (force: boolean) => {
    if (!last) [hero, daySlot, shabbatSlot, holidaySlot].forEach((slot, i) => slot.replaceChildren(skeleton(i ? 3 : 2)));
    try {
      const { data, at } = await loadCalendar(minutes, force);
      render(data, at);
    } catch (e) {
      if (!last) {
        hero.replaceChildren(errorCard("Calendrier hébraïque", e, "Hebcal", () => void run(true)));
        [daySlot, shabbatSlot, holidaySlot].forEach((slot) => slot.replaceChildren());
      }
    }
  };

  root.append(
    h("div", { class: "page-head" }, h("button", { class: "icon-btn boxed", type: "button", "aria-label": "Actualiser", onclick: () => void run(true) }, icon("refresh-cw"))),
    hero,
    sections("calendrier", [
      { id: "jour", label: "Horaires du jour", nodes: [daySlot] },
      { id: "chabbat", label: "Chabbat", nodes: [shabbatSlot] },
      { id: "fetes", label: "Fêtes", nodes: [holidaySlot] },
    ]),
    h("p", { class: "note" }, "Horaires calculés pour Genève. Chaque lecture utilise 4 crédits Firecrawl, gardée 30 minutes."),
  );
  void run(false);
  // Le « prochain horaire » avance tout seul : on redessine chaque minute avec les données déjà chargées.
  const timer = setInterval(() => (root.isConnected ? last && render(last.data, last.at) : clearInterval(timer)), 60_000);
}

// ---------- Paracha, Tehilim, Halakha, Rambam ----------
type Display = "les-deux" | "traduction" | "hebreu";

export function studyView(root: HTMLElement, section: StudySection): void {
  let chapters: 1 | 3 = store.get<number>("dash-rambam") === 3 ? 3 : 1;
  let display: Display = (store.get<Display>("dash-affichage") ?? "les-deux") as Display;
  if (!["les-deux", "traduction", "hebreu"].includes(display)) display = "les-deux";
  // Confort de lecture, mémorisé sur l'appareil : taille du texte (5 crans) et disposition.
  const SIZES = [0.85, 1, 1.15, 1.3, 1.5];
  let size = Math.min(SIZES.length - 1, Math.max(0, store.get<number>("dash-taille") ?? 1));
  let sideBySide = store.get<boolean>("dash-cote-a-cote") === true;
  let only: number | "tout" = "tout";
  let payload: StudyPayload | null = null;
  const content = h("div", { class: "stack reader" });

  const render = () => {
    if (!payload) return;
    const data = payload;
    const { text } = data;
    const tr = text.translation;
    const trLabel = tr ? `${tr.language === "fr" ? "traduction française" : "traduction anglaise"} « ${tr.title} »` : null;
    const showHe = display !== "traduction";
    const showTr = display !== "hebreu" && Boolean(tr);
    const multi = text.sections.length > 1;
    const displays: [Display, string][] = tr ? [["les-deux", "Les deux"], ["traduction", "Traduction"], ["hebreu", "Hébreu"]] : [["hebreu", "Hébreu"]];
    const numbered = text.sections.filter((x) => x.number != null);
    const visible = only === "tout" ? text.sections : text.sections.filter((x) => x.number === only);
    const both = showHe && showTr;
    content.style.setProperty("--reader-scale", String(SIZES[size]));
    content.classList.toggle("wide", both && sideBySide);
    const setDisplay = (id: Display) => ((display = id), store.set("dash-affichage", id), render());
    const resize = (delta: number) => ((size = Math.min(SIZES.length - 1, Math.max(0, size + delta))), store.set("dash-taille", size), render());

    content.replaceChildren(
      h(
        "section",
        { class: "hero" },
        h("div", { class: "hero-main" }, h("p", { class: "eyebrow" }, "Étude du jour"), h("h2", { class: "hero-title" }, data.title), data.hebrewTitle ? h("p", { class: "hebrew hero-hebrew", lang: "he", dir: "rtl" }, data.hebrewTitle) : null),
        h("a", { class: "text-link", href: text.url, target: "_blank", rel: "noopener noreferrer" }, "Lire sur Sefaria avec les commentaires", icon("external-link", "ic ic-sm")),
        tr?.language === "en" ? h("p", { class: "muted" }, "Sefaria n'a pas de traduction française pour ce passage : la traduction affichée est en anglais.") : null,
        !tr ? h("p", { class: "muted" }, "Sefaria ne propose pas de traduction pour ce passage : seul le texte hébreu est affiché.") : null,
        section === "halakha" || section === "rambam" ? h("p", { class: "callout" }, "Texte d'étude. Pour une question de halakha pratique, demande à un rabbin.") : null,
        sourceNote(`${data.scheduleSource} · texte : Sefaria (${[text.hebrewVersion, trLabel].filter(Boolean).join(" ; ")}), lus via Firecrawl`, data.fetchedAt),
      ),
      data.extras.length
        ? h(
            "section",
            { class: "card" },
            h("div", { class: "card-head" }, h("h2", null, "Montées et haftara")),
            h("ul", { class: "two-col" }, ...data.extras.map((e) => h("li", { class: "kv line" }, h("span", { class: "muted" }, e.label), h("a", { href: e.url, target: "_blank", rel: "noopener noreferrer" }, e.ref)))),
          )
        : "",
      h(
        "section",
        { class: "card" },
        h(
          "div",
          { class: "reader-tools" },
          h("div", { class: "chips wrap", role: "radiogroup", "aria-label": "Affichage du texte" }, ...displays.map(([id, label]) => choice(label, display === id, () => setDisplay(id)))),
          h(
            "div",
            { class: "row-actions" },
            both ? h("button", { class: `chip wide-only-flex${sideBySide ? " on" : ""}`, type: "button", "aria-pressed": String(sideBySide), onclick: () => ((sideBySide = !sideBySide), store.set("dash-cote-a-cote", sideBySide), render()) }, "Côte à côte") : null,
            h("button", { class: "icon-btn boxed", type: "button", "aria-label": "Réduire la taille du texte", disabled: size === 0, onclick: () => resize(-1) }, h("span", { class: "size-a small-a", "aria-hidden": "true" }, "A")),
            h("button", { class: "icon-btn boxed", type: "button", "aria-label": "Agrandir la taille du texte", disabled: size === SIZES.length - 1, onclick: () => resize(1) }, h("span", { class: "size-a big-a", "aria-hidden": "true" }, "A")),
          ),
        ),
        numbered.length > 1
          ? h(
              "div",
              { class: "chips", role: "radiogroup", "aria-label": `Choisir : ${data.sectionLabel.toLowerCase()}` },
              choice("Tout", only === "tout", () => ((only = "tout"), render())),
              ...numbered.map((x) => choice(`${data.sectionLabel} ${x.number}`, only === x.number, () => ((only = x.number as number), render()))),
            )
          : null,
        ...visible.map((s) =>
          h(
            "div",
            { class: "stack" },
            multi && s.number != null ? h("h3", { class: "muted section-title" }, `${data.sectionLabel} ${s.number}`) : null,
            h(
              "ol",
              { class: "verses" },
              ...s.verses.map((v) =>
                h(
                  "li",
                  null,
                  h("span", { class: "verse-n", "aria-hidden": "true" }, v.n),
                  h(
                    "div",
                    null,
                    showHe && v.hebrew ? h("p", { class: "hebrew", lang: "he", dir: "rtl" }, v.hebrew) : null,
                    showTr && v.translation ? h("p", { class: showHe ? "translation muted" : "translation", lang: tr?.language ?? "" }, v.translation) : null,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  };

  const run = async (force: boolean) => {
    content.replaceChildren(skeleton(4));
    try {
      payload = (await loadStudy(section, chapters, force)).data;
      only = "tout";
      render();
    } catch (e) {
      payload = null;
      content.replaceChildren(errorCard("Texte du jour", e, "Hebcal et Sefaria", () => void run(true)));
    }
  };

  const picker = h("div", { class: "chips wrap", role: "radiogroup", "aria-label": "Nombre de chapitres par jour" });
  const renderPicker = () =>
    picker.replaceChildren(
      ...([1, 3] as const).map((n) =>
        choice(`${n} chapitre${n > 1 ? "s" : ""} par jour`, chapters === n, () => {
          chapters = n;
          store.set("dash-rambam", n);
          renderPicker();
          void run(false);
        }),
      ),
    );
  renderPicker();

  root.append(
    refreshBar("Programme du jour et texte lus via Firecrawl (2 à 3 crédits), gardés plusieurs heures.", () => void run(true)),
    section === "rambam" ? picker : "",
    tracker(section),
    content,
  );
  void run(false);
}

// ---------- Cours Torah-Box ----------
export function coursView(root: HTMLElement): void {
  const content = h("div", { class: "stack" });
  const run = async (force: boolean) => {
    content.replaceChildren(h("div", { class: "grid" }, ...Array.from({ length: 6 }, () => skeleton(2))));
    try {
      const { data, at } = await loadNews("cours", force);
      const failed = data.sources.find((s) => !s.ok);
      const item = (v: Article) =>
        h(
          "article",
          { class: "card article" },
          h("p", { class: "meta" }, h("strong", null, "Torah-Box"), h("span", null, v.publishedAt ? dateFmt.format(new Date(v.publishedAt)) : "date inconnue")),
          h("h2", null, h("a", { href: v.link, target: "_blank", rel: "noopener noreferrer", lang: "fr" }, v.title)),
          h("p", { class: "note read" }, icon("external-link", "ic ic-xs"), "Regarder sur YouTube"),
        );
      content.replaceChildren(
        data.articles.length
          ? h("div", { class: "grid" }, ...data.articles.map(item))
          : h("div", { class: "card" }, emptyState("Aucun cours récent", failed ? `La chaîne YouTube de Torah-Box n'a pas pu être lue (${failed.error}).` : "Aucune vidéo publiée ces 60 derniers jours sur la chaîne.")),
        sourceNote("chaîne YouTube officielle de Torah-Box (flux public, lu via Firecrawl)", at),
      );
    } catch (e) {
      content.replaceChildren(errorCard("Cours", e, "chaîne YouTube de Torah-Box", () => void run(true)));
    }
  };
  root.append(refreshBar("Dernières vidéos de Torah-Box (1 crédit Firecrawl, gardé 30 minutes). Une page d'artefact ne peut pas intégrer de lecteur vidéo : chaque cours s'ouvre sur YouTube.", () => void run(true)), content);
  void run(false);
}
