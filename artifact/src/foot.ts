/**
 * Football : matchs et classements lus sur l'API publique d'ESPN (sans clé), via Firecrawl.
 */
import { cachedLoad, DataError, loadJson, type Cached } from "./data";
import { ESPN_API as ESPN, ESPN_REAL_MADRID as REAL, parseMatches, parseRoster, parseStandings, POSITION_LABELS, type Match, type RosterPlayer, type StandingRow } from "@/lib/football/espn";
import { h, icon } from "./dom";
import { sections, teamBadge } from "./layout";
import { asyncSection, card, emptyState, errorCard, realNewsSlot, skeleton, sourceNote, timeFmt } from "./views";

const SOURCE = "ESPN (lu via Firecrawl)";
const TEN_MINUTES = 10 * 60 * 1000;
type Raw = Record<string, unknown>;

async function events(url: string, competition = ""): Promise<Match[]> {
  const raw = await loadJson<Raw>(url);
  if (!Array.isArray(raw.events)) throw new DataError("réponse inattendue d'ESPN", "tool_error");
  return parseMatches(raw.events, competition);
}

const loadUpcoming = (force: boolean) => cachedLoad("foot-avenir", TEN_MINUTES, () => events(`${ESPN}/site/v2/sports/soccer/all/teams/${REAL}/schedule?fixture=true`), force);
const loadResults = (force: boolean) =>
  cachedLoad(
    "foot-resultats",
    TEN_MINUTES,
    async () => {
      const lists = await Promise.allSettled([events(`${ESPN}/site/v2/sports/soccer/esp.1/teams/${REAL}/schedule`, "LaLiga"), events(`${ESPN}/site/v2/sports/soccer/uefa.champions/teams/${REAL}/schedule`, "Ligue des champions")]);
      const ok = lists.filter((l): l is PromiseFulfilledResult<Match[]> => l.status === "fulfilled");
      if (!ok.length) throw (lists[0] as PromiseRejectedResult).reason;
      return { matches: ok.flatMap((l) => l.value).sort((a, b) => b.date.localeCompare(a.date)), partial: ok.length < lists.length };
    },
    force,
  );
const loadTable = (league: string, force: boolean) =>
  cachedLoad(
    `foot-classement-${league}`,
    TEN_MINUTES,
    async () => {
      const rows = parseStandings(await loadJson<Raw>(`${ESPN}/v2/sports/soccer/${league}/standings`));
      if (!rows.length) throw new DataError("classement vide ou illisible", "tool_error");
      return rows;
    },
    force,
  );

const loadRoster = (force: boolean) =>
  cachedLoad(
    "foot-effectif",
    6 * 60 * 60 * 1000,
    async () => {
      const players = parseRoster(await loadJson<Raw>(`${ESPN}/site/v2/sports/soccer/esp.1/teams/${REAL}/roster`));
      if (!players.length) throw new DataError("effectif vide ou illisible", "tool_error");
      return players;
    },
    force,
  );

// ---------- Affichage ----------
const TZ = "Europe/Zurich";
const weekdayFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: TZ, weekday: "short" });
const weekdayLong = new Intl.DateTimeFormat("fr-CH", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const dayFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: TZ, day: "2-digit", month: "2-digit" });
const isoDay = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const day = (iso: string) => `${weekdayFmt.format(new Date(iso)).replace(".", "")} ${dayFmt.format(new Date(iso)).replace(/\.$/, "")}`;
const hour = (iso: string) => timeFmt.format(new Date(iso));
const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

function countdown(iso: string, now: number): string {
  const minutes = Math.round((Date.parse(iso) - now) / 60000);
  if (minutes < 0) return "";
  if (minutes < 90) return relative.format(minutes, "minute");
  if (minutes < 36 * 60) return relative.format(Math.round(minutes / 60), "hour");
  return relative.format(Math.round(minutes / 1440), "day");
}

const known = (m: Match) => m.homeScore !== null && m.awayScore !== null;
const liveBadge = (m: Match) => h("span", { class: "live" }, h("span", { class: "dot" }), `En direct${m.clock ? ` · ${m.clock}` : ""}`);

function outcome(m: Match, teamId: string): ["V" | "N" | "D", string] | null {
  if (!known(m)) return null;
  const mine = m.homeId === teamId ? m.homeScore! : m.awayScore!;
  const theirs = m.homeId === teamId ? m.awayScore! : m.homeScore!;
  return mine > theirs ? ["V", "Victoire"] : mine < theirs ? ["D", "Défaite"] : ["N", "Nul"];
}
function formDot(m: Match, teamId: string): HTMLElement | null {
  const result = outcome(m, teamId);
  return result ? h("span", { class: `form form-${result[0].toLowerCase()}`, title: `${result[1]} : ${m.home} ${m.homeScore} – ${m.awayScore} ${m.away}` }, result[0], h("span", { class: "sr-only" }, ` (${result[1]})`)) : null;
}

/** Une ligne de match : pastilles et noms des deux équipes, score ou heure au centre. */
function matchRow(m: Match, teamId?: string, showCompetition = true): HTMLElement {
  const center = m.state === "pre" ? h("span", { class: "match-time num" }, hour(m.date)) : h("strong", { class: `match-score num${m.state === "in" ? " is-live" : ""}` }, known(m) ? `${m.homeScore} – ${m.awayScore}` : "–");
  return h(
    "li",
    { class: `match${m.state === "in" ? " live-row" : ""}` },
    h(
      "div",
      { class: "match-line" },
      h("span", { class: "side" }, h("span", { class: "team-name" }, m.home), teamBadge(m.homeAbbr || m.home, m.homeColor)),
      center,
      h("span", { class: "side away" }, teamBadge(m.awayAbbr || m.away, m.awayColor), h("span", { class: "team-name" }, m.away)),
    ),
    h("p", { class: "meta center" }, m.state === "in" ? liveBadge(m) : h("span", { class: "cap" }, m.state === "post" ? `${day(m.date)} · terminé` : day(m.date)), showCompetition && m.competition ? h("span", { class: "pill" }, m.competition) : null, teamId && m.state === "post" ? formDot(m, teamId) : null),
  );
}

function table(rows: StandingRow[], highlight: string, full: boolean): HTMLElement {
  const mine = rows.findIndex((r) => r.teamId === highlight);
  const shown = full ? rows : rows.filter((r, i) => i < 5 || Math.abs(i - mine) <= 1);
  return h(
    "div",
    { class: "table-wrap" },
    h(
      "table",
      null,
      h("thead", null, h("tr", null, ...["#", "Équipe", "J", "V", "N", "D", "Diff.", "Pts"].map((label, i) => h("th", { scope: "col", class: i > 1 ? "right" : "" }, label)))),
      h(
        "tbody",
        null,
        ...shown.map((r) =>
          h(
            "tr",
            { class: r.teamId === highlight ? "mine" : "" },
            h("td", null, String(r.rank)),
            h("th", { scope: "row" }, r.team),
            ...[r.played, r.wins, r.draws, r.losses, r.diff, r.points].map((v, i) => h("td", { class: "right" }, i === 5 ? h("strong", null, String(v)) : String(v))),
          ),
        ),
      ),
    ),
  );
}

/** Onglet Real Madrid : l'essentiel en haut, puis quatre sous-sections (Matchs, Classements, Équipe, Actus). */
export function realMadridView(root: HTMLElement): void {
  const hero = h("div", { class: "slot" });
  const slots = Array.from({ length: 6 }, () => h("div", { class: "slot" }));
  const news = realNewsSlot();

  // --- L'essentiel : prochain match, forme récente, places au classement ---
  async function runHero(force: boolean): Promise<void> {
    if (!hero.firstChild) hero.replaceChildren(skeleton(2));
    const [upcoming, played, liga, europe] = await Promise.allSettled([loadUpcoming(force), loadResults(force), loadTable("esp.1", force), loadTable("uefa.champions", force)]);
    if (upcoming.status === "rejected" && played.status === "rejected") return hero.replaceChildren(errorCard("Real Madrid", upcoming.reason, SOURCE, () => void runHero(true)));
    const coming = upcoming.status === "fulfilled" ? upcoming.value.data.filter((m) => m.state !== "post").sort((a, b) => a.date.localeCompare(b.date)) : [];
    const next = coming[0];
    const last = played.status === "fulfilled" ? played.value.data.matches.filter((m) => m.state === "post").slice(0, 5) : [];
    const place = (r: PromiseSettledResult<Cached<StandingRow[]>>, label: string) => {
      const mine = r.status === "fulfilled" ? r.value.data.find((x) => x.teamId === REAL) : undefined;
      return h("div", { class: "kpi" }, h("dt", null, label), h("dd", null, mine ? h("span", { class: "kpi-value num" }, `${mine.rank}ᵉ`) : h("span", { class: "kpi-value" }, "–"), mine ? h("span", { class: "muted" }, ` ${mine.points} pts`) : null));
    };
    hero.replaceChildren(
      h(
        "section",
        { class: "hero", "aria-label": "L'essentiel" },
        next
          ? h(
              "div",
              { class: "hero-main" },
              h("p", { class: "eyebrow" }, next.state === "in" ? liveBadge(next) : "Prochain match", h("span", { class: "pill" }, next.competition)),
              h(
                "div",
                { class: "versus" },
                h("div", { class: "versus-team" }, teamBadge(next.homeAbbr || next.home, next.homeColor), h("span", null, next.home)),
                h("strong", { class: "versus-mid num" }, next.state === "in" && known(next) ? `${next.homeScore} – ${next.awayScore}` : hour(next.date)),
                h("div", { class: "versus-team" }, teamBadge(next.awayAbbr || next.away, next.awayColor), h("span", null, next.away)),
              ),
              h("p", { class: "muted center cap" }, next.state === "in" ? "Score mis à jour toutes les 10 minutes environ" : `${weekdayLong.format(new Date(next.date))} · ${countdown(next.date, Date.now())}${next.venue ? ` · ${next.venue}` : ""}`),
            )
          : h("div", { class: "hero-main" }, emptyState("Pas de match annoncé", "ESPN n'annonce aucun match à venir pour le Real Madrid.")),
        h(
          "dl",
          { class: "kpis" },
          place(liga, "LaLiga"),
          place(europe, "Ligue des champions"),
          h("div", { class: "kpi" }, h("dt", null, "Forme (5 derniers)"), h("dd", { class: "forms" }, ...(last.length ? [...last].reverse().map((m) => formDot(m, REAL)) : ["–"]))),
        ),
      ),
    );
  }

  // --- Matchs ---
  const next = asyncSection(slots[0], "À venir", SOURCE, loadUpcoming, ({ data, at }: Cached<Match[]>) => {
    const coming = data.filter((m) => m.state !== "post").sort((a, b) => a.date.localeCompare(b.date));
    return card(
      "À venir",
      [coming.length ? h("ul", { class: "matches" }, ...coming.slice(0, 5).map((m) => matchRow(m))) : emptyState("Pas encore de données", "ESPN n'annonce aucun match à venir."), h("p", { class: "note" }, "Heures de Genève. Pendant un match, le score peut avoir jusqu'à 10 minutes de retard."), sourceNote(SOURCE, at)],
      { badge: coming.length ? `${coming.length} matchs` : undefined, detail: coming.length > 5 ? () => [h("ul", { class: "matches" }, ...coming.slice(5, 45).map((m) => matchRow(m)))] : undefined },
    );
  });
  const results = asyncSection(slots[1], "Résultats", SOURCE, loadResults, ({ data, at }) => {
    const played = data.matches.filter((m) => m.state === "post");
    return card(
      "Résultats",
      [
        played.length ? h("ul", { class: "matches" }, ...played.slice(0, 5).map((m) => matchRow(m, REAL))) : emptyState("Pas encore de données", "Aucun match joué cette saison d'après ESPN."),
        data.partial ? h("p", { class: "note keep" }, "Une des deux compétitions n'a pas pu être lue : la liste est incomplète.") : null,
        h("p", { class: "note" }, "LaLiga et Ligue des champions uniquement (les coupes ne sont pas incluses)."),
        sourceNote(SOURCE, at),
      ],
      { detail: played.length > 5 ? () => [h("ul", { class: "matches" }, ...played.slice(5, 60).map((m) => matchRow(m, REAL)))] : undefined },
    );
  });

  // --- Classements ---
  const standing = (slot: HTMLElement, league: string, title: string) =>
    asyncSection(slot, title, SOURCE, (force) => loadTable(league, force), ({ data, at }: Cached<StandingRow[]>) => {
      const mine = data.find((r) => r.teamId === REAL);
      return card(title, [mine ? h("p", null, h("span", { class: "big-2 num" }, `${mine.rank}ᵉ`), h("span", { class: "muted" }, ` · ${mine.points} points en ${mine.played} matchs`)) : h("p", { class: "muted" }, "Le Real Madrid n'apparaît pas dans ce classement."), table(data, REAL, false), sourceNote(SOURCE, at)], {
        badge: `${data.length} équipes`,
        detail: () => [table(data, REAL, true)],
      });
    });
  const liga = standing(slots[2], "esp.1", "LaLiga");
  const europe = standing(slots[3], "uefa.champions", "Ligue des champions");

  // --- Équipe ---
  const scorers = asyncSection(slots[4], "Buteurs en LaLiga", SOURCE, loadRoster, ({ data, at }: Cached<RosterPlayer[]>) => {
    const list = data.filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals || (b.assists ?? 0) - (a.assists ?? 0));
    const max = list[0]?.goals ?? 1;
    // Barres à l'échelle : la plus longue correspond au meilleur buteur.
    const row = (p: RosterPlayer) =>
      h(
        "li",
        { class: "scorer" },
        h("div", { class: "meter-head" }, h("span", null, p.name), h("span", { class: "num" }, `${p.goals} but${p.goals > 1 ? "s" : ""}${p.assists ? ` · ${p.assists} p.d.` : ""}`)),
        h("div", { class: "bar", "aria-hidden": "true" }, h("span", { class: "bar-fill", style: `width:${((p.goals / max) * 100).toFixed(1)}%` })),
      );
    return card("Buteurs en LaLiga", [list.length ? h("ul", { class: "meters" }, ...list.slice(0, 6).map(row)) : emptyState("Pas encore de données", "Aucun but enregistré cette saison d'après ESPN."), h("p", { class: "note" }, "p.d. : passes décisives."), sourceNote(SOURCE, at)], {
      detail: list.length > 6 ? () => [h("ul", { class: "meters" }, ...list.slice(6).map(row))] : undefined,
    });
  });
  const squad = asyncSection(slots[5], "Effectif", SOURCE, loadRoster, ({ data, at }: Cached<RosterPlayer[]>) => {
    const groups = ["Goalkeeper", "Defender", "Midfielder", "Forward"].map((position) => ({ position, players: data.filter((p) => p.position === position).sort((a, b) => a.name.localeCompare(b.name)) }));
    return card(
      "Effectif",
      [
        h("div", { class: "squad" }, ...groups.filter((g) => g.players.length).map((g) => h("div", null, h("h3", { class: "eyebrow" }, `${POSITION_LABELS[g.position]}s · ${g.players.length}`), h("p", { class: "squad-names" }, g.players.map((p) => p.name).join(" · "))))),
        h("p", { class: "note" }, "Entraîneur, blessures et suspensions : non fournis de façon fiable par cette source."),
        sourceNote(SOURCE, at),
      ],
      { badge: `${data.length} joueurs` },
    );
  });

  const refresh = (force: boolean) => void Promise.all([runHero(force), next(force), results(force), liga(force), europe(force), scorers(force), squad(force), news.run(force)]);
  root.append(
    h("div", { class: "page-head" }, h("button", { class: "icon-btn boxed", type: "button", "aria-label": "Actualiser", onclick: () => refresh(true) }, icon("refresh-cw"))),
    hero,
    sections("real", [
      { id: "matchs", label: "Matchs", nodes: [h("div", { class: "grid two" }, slots[0], slots[1])] },
      { id: "classements", label: "Classements", nodes: [h("div", { class: "grid two" }, slots[2], slots[3])] },
      { id: "equipe", label: "Équipe", nodes: [h("div", { class: "grid two" }, slots[4], slots[5])] },
      { id: "actus", label: "Actus", nodes: [news.slot] },
    ]),
    h("p", { class: "note" }, `Matchs, classements et effectif : ESPN, 6 lectures gardées 10 minutes. Actus : ${news.count} flux gardés 30 minutes. Une lecture = 1 crédit Firecrawl.`),
  );
  refresh(false);
}

// ---------- Onglet Matchs ----------
const LEAGUES: [string, string][] = [
  ["esp.1", "LaLiga"],
  ["uefa.champions", "Ligue des champions"],
  ["eng.1", "Premier League"],
  ["fra.1", "Ligue 1"],
  ["ita.1", "Serie A"],
  ["ger.1", "Bundesliga"],
];

/** Onglet Matchs de la journée : tous les matchs regroupés par jour, avec un filtre par compétition. */
export function matchsView(root: HTMLElement): void {
  const content = h("div", { class: "stack" });
  let filter = "toutes";
  let results: PromiseSettledResult<Cached<Match[]>>[] = [];

  function render(): void {
    const ok = results.flatMap((r, i) => (r.status === "fulfilled" ? [{ name: LEAGUES[i][1], ...r.value }] : []));
    const failed = LEAGUES.filter((_, i) => results[i]?.status === "rejected").map(([, name]) => name);
    if (!ok.length) return content.replaceChildren(errorCard("Matchs", results[0]?.status === "rejected" ? results[0].reason : null, SOURCE, () => void load(true)));
    const all = ok.flatMap((l) => l.data.map((m) => ({ ...m, competition: l.name }))).filter((m) => filter === "toutes" || m.competition === filter);
    const live = all.filter((m) => m.state === "in");
    const days = new Map<string, Match[]>();
    for (const m of [...all].sort((a, b) => a.date.localeCompare(b.date))) days.set(isoDay.format(new Date(m.date)), [...(days.get(isoDay.format(new Date(m.date))) ?? []), m]);
    const today = isoDay.format(new Date());
    const tomorrow = isoDay.format(new Date(Date.now() + 86_400_000));
    const chip = (id: string, label: string) => h("button", { class: `chip${filter === id ? " on" : ""}`, type: "button", "aria-pressed": String(filter === id), onclick: () => ((filter = id), render()) }, label);
    const nodes: (Node | null)[] = [
      h("div", { class: "chips", role: "group", "aria-label": "Filtrer par compétition" }, chip("toutes", "Toutes"), ...ok.filter((l) => l.data.length).map((l) => chip(l.name, l.name))),
      live.length ? h("section", { class: "hero" }, h("p", { class: "eyebrow" }, h("span", { class: "live" }, h("span", { class: "dot" }), `${live.length} match${live.length > 1 ? "s" : ""} en direct`)), h("ul", { class: "matches" }, ...live.map((m) => matchRow(m)))) : null,
      days.size
        ? h(
            "div",
            { class: "grid two" },
            ...[...days].map(([key, list]) => {
              const label = key === today ? "Aujourd'hui" : key === tomorrow ? "Demain" : weekdayLong.format(new Date(list[0].date));
              return card(label.charAt(0).toUpperCase() + label.slice(1), [h("ul", { class: "matches" }, ...list.map((m) => matchRow(m, undefined, filter === "toutes")))], { badge: `${list.length} match${list.length > 1 ? "s" : ""}` });
            }),
          )
        : h("div", { class: "card" }, emptyState("Pas encore de données", "ESPN n'affiche aucun match pour la journée en cours de ces compétitions.")),
      failed.length ? h("p", { class: "note keep" }, `Indisponibles pour le moment : ${failed.join(", ")}.`) : null,
      sourceNote(SOURCE, Math.min(...ok.map((l) => l.at))),
      h("p", { class: "note" }, `Journée en cours de ${LEAGUES.length} compétitions : ${LEAGUES.length} lectures (= ${LEAGUES.length} crédits Firecrawl), gardées 10 minutes. Heures de Genève.`),
      h("p", { class: "note" }, "Chaînes TV : aucune source publique et fiable n'indique la chaîne de diffusion en Suisse (ESPN ne donne que les chaînes américaines), elles ne sont donc pas affichées."),
    ];
    content.replaceChildren(...nodes.filter((n): n is Node => n !== null));
  }

  async function load(force: boolean): Promise<void> {
    if (!results.length) content.replaceChildren(h("div", { class: "grid two" }, skeleton(), skeleton()));
    results = await Promise.allSettled(LEAGUES.map(([slug, name]) => cachedLoad(`foot-journee-${slug}`, TEN_MINUTES, () => events(`${ESPN}/site/v2/sports/soccer/${slug}/scoreboard`, name), force)));
    if (root.isConnected) render();
  }
  root.append(h("div", { class: "page-head" }, h("button", { class: "icon-btn boxed", type: "button", "aria-label": "Actualiser", onclick: () => void load(true) }, icon("refresh-cw"))), content);
  void load(false);
}
