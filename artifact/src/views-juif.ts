/** Vues « Vie juive » de la version artefact : calendrier, textes d'étude, cours. */
import type { CalendarPayload, StudyPayload, StudySection } from "@/lib/judaisme/types";
import type { Article } from "@/lib/rss/types";
import { loadCalendar, loadNews, loadStudy } from "./data";
import { h, icon, store } from "./dom";
import { card, dateFmt, emptyState, errorCard, skeleton, sourceNote, timeFmt } from "./views";

const longDate = new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", weekday: "long", day: "numeric", month: "long" });
const time = (iso: string) => timeFmt.format(new Date(iso));
const SOURCE = "Hebcal · horaires calculés pour Genève (lu via Firecrawl)";
const CANDLE_CHOICES = [18, 20, 22, 30, 40];

function refreshBar(text: string, onRefresh: () => void): HTMLElement {
  return h(
    "div",
    { class: "toolbar" },
    h("p", { class: "muted" }, text),
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
  const content = h("div", { class: "grid" });

  const row = (label: string, value: string) => h("li", { class: "kv" }, h("span", null, label), h("strong", { class: "num" }, value));
  const holiday = (x: CalendarPayload["holidays"][number]) =>
    h("li", { class: "kv" }, h("span", null, h("strong", null, x.title), x.hebrewDate ? h("span", { class: "muted" }, ` · ${x.hebrewDate}`) : null), h("span", { class: "muted num" }, dateFmt.format(new Date(`${x.date}T12:00:00Z`))));

  const render = (data: CalendarPayload, at: number) => {
    const now = new Date(at);
    const slot = (label: string, iso: string | null) =>
      h("div", { class: "tile-stat" }, h("dt", null, label), h("dd", { class: "big-2 num" }, iso ? time(iso) : "–"), h("dd", { class: "note cap" }, iso ? longDate.format(new Date(iso)) : "non communiqué"));
    content.replaceChildren(
      card("Aujourd'hui", [
        h("div", null, h("p", { class: "big-2" }, data.hebrewDate.text), h("p", { class: "hebrew muted", lang: "he", dir: "rtl" }, data.hebrewDate.hebrew)),
        h("p", { class: "cap" }, `${longDate.format(now)} · ${dateFmt.format(now)}`),
        data.hebrewDate.afterSunset ? h("p", { class: "note" }, "Le soleil est couché : la date hébraïque affichée est déjà celle du jour qui commence ce soir.") : null,
        sourceNote(SOURCE, at),
      ]),
      card(
        "Chabbat",
        [
          data.shabbat.candles || data.shabbat.havdalah
            ? h("dl", { class: "stats cols-2" }, slot("Allumage des bougies", data.shabbat.candles), slot("Havdala", data.shabbat.havdalah))
            : emptyState("Pas encore de données", "Hebcal n'indique pas d'horaire de chabbat pour cette semaine."),
          h("p", { id: "bougies-label" }, "Allumage avant le coucher du soleil"),
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
          h("p", { class: "note" }, "18 minutes par défaut. Choisis l'usage de ta communauté ; la havdala est calculée à la sortie des étoiles."),
          sourceNote(SOURCE, at),
        ],
        { badge: data.shabbat.parasha ?? undefined },
      ),
      card("Zmanim du jour", [h("ul", null, ...data.zmanim.filter((z) => z.main).map((z) => row(z.label, time(z.time)))), sourceNote(SOURCE, at)], {
        detail: () => [h("ul", { class: "sep" }, ...data.zmanim.map((z) => row(z.label, time(z.time)))), h("p", { class: "note" }, "Pour une question pratique sur un horaire, demande à ton rabbin.")],
      }),
      card(
        "Fêtes et dates à venir",
        [
          data.holidays.length ? h("ul", null, ...data.holidays.slice(0, 5).map(holiday)) : emptyState("Pas encore de données", "Hebcal n'annonce aucune fête dans les prochains mois."),
          h("p", { class: "note" }, "Les fêtes commencent la veille au soir de la date indiquée."),
          sourceNote("Hebcal (lu via Firecrawl)", at),
        ],
        { detail: data.holidays.length > 5 ? () => [h("ul", { class: "sep" }, ...data.holidays.slice(5).map(holiday))] : undefined },
      ),
    );
  };

  const run = async (force: boolean) => {
    content.replaceChildren(...Array.from({ length: 4 }, () => skeleton()));
    try {
      const { data, at } = await loadCalendar(minutes, force);
      render(data, at);
    } catch (e) {
      content.replaceChildren(errorCard("Calendrier hébraïque", e, "Hebcal", () => void run(true)));
    }
  };

  root.append(refreshBar("Horaires calculés pour Genève (écart possible de 1 à 2 minutes). Chaque lecture utilise 4 crédits Firecrawl, gardée 15 minutes.", () => void run(true)), content);
  void run(false);
}

// ---------- Paracha, Tehilim, Halakha, Rambam ----------
type Display = "les-deux" | "traduction" | "hebreu";

export function studyView(root: HTMLElement, section: StudySection): void {
  let chapters: 1 | 3 = store.get<number>("dash-rambam") === 3 ? 3 : 1;
  let display: Display = "les-deux";
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

    content.replaceChildren(
      h(
        "section",
        { class: "card" },
        h("div", null, h("h2", { class: "title-2" }, data.title), data.hebrewTitle ? h("p", { class: "hebrew muted left", lang: "he", dir: "rtl" }, data.hebrewTitle) : null),
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
        h("div", { class: "chips wrap", role: "radiogroup", "aria-label": "Affichage du texte" }, ...displays.map(([id, label]) => choice(label, display === id, () => ((display = id), render())))),
        ...text.sections.map((s) =>
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
                    showTr && v.translation ? h("p", { class: showHe ? "muted small-2" : "", lang: tr?.language ?? "" }, v.translation) : null,
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
