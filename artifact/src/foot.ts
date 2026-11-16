/**
 * Football : matchs et classements lus sur l'API publique d'ESPN (sans clé), via Firecrawl.
 */
import { cachedLoad, DataError, loadJson, type Cached } from "./data";
import { ESPN_API as ESPN, ESPN_REAL_MADRID as REAL, parseMatches, parseRoster, parseStandings, POSITION_LABELS, type Match, type RosterPlayer, type StandingRow } from "@/lib/football/espn";
import { h, icon } from "./dom";
import { asyncSection, card, emptyState, sourceNote, timeFmt } from "./views";

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
const weekdayFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", weekday: "short" });
const dayFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit" });
const when = (iso: string) => `${weekdayFmt.format(new Date(iso)).replace(".", "")} ${dayFmt.format(new Date(iso)).replace(/\.$/, "")} à ${timeFmt.format(new Date(iso))}`;
const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

function countdown(iso: string, now: number): string {
  const minutes = Math.round((Date.parse(iso) - now) / 60000);
  if (minutes < 0) return "";
  if (minutes < 90) return relative.format(minutes, "minute");
  if (minutes < 36 * 60) return relative.format(Math.round(minutes / 60), "hour");
  return relative.format(Math.round(minutes / 1440), "day");
}

function scoreLine(m: Match): HTMLElement {
  const known = m.homeScore !== null && m.awayScore !== null;
  return h("p", { class: "score" }, h("span", { class: "team" }, m.home), h("strong", { class: "num" }, known ? `${m.homeScore} – ${m.awayScore}` : "–"), h("span", { class: "team right" }, m.away));
}

const liveBadge = (m: Match) => h("span", { class: "live" }, h("span", { class: "dot" }), `En direct${m.clock ? ` · ${m.clock}` : ""}`);

function resultTag(m: Match, teamId: string): HTMLElement | null {
  if (m.homeScore === null || m.awayScore === null) return null;
  const mine = m.homeId === teamId ? m.homeScore : m.awayScore;
  const theirs = m.homeId === teamId ? m.awayScore : m.homeScore;
  const [letter, label] = mine > theirs ? ["V", "Victoire"] : mine < theirs ? ["D", "Défaite"] : ["N", "Nul"];
  return h("span", { class: `pill result${letter === "V" ? " cat-urgent" : ""}`, title: label }, letter, h("span", { class: "sr-only" }, ` (${label})`));
}

function matchRow(m: Match, teamId?: string): HTMLElement {
  return h(
    "li",
    null,
    h("div", { class: "grow-2" }, scoreLine(m), h("p", { class: "meta" }, m.state === "in" ? liveBadge(m) : h("span", { class: "cap" }, when(m.date)), h("span", { class: "pill" }, m.competition))),
    teamId && m.state === "post" ? resultTag(m, teamId) : null,
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

/** Cartes « matchs et classements » de l'onglet Real Madrid. */
export function realMadridSections(): { slots: HTMLElement[]; refresh(force: boolean): void } {
  const slots = Array.from({ length: 6 }, () => h("div", { class: "slot" }));

  const next = asyncSection(slots[0], "Prochains matchs", SOURCE, loadUpcoming, ({ data, at }: Cached<Match[]>) => {
    const now = Date.now();
    const coming = data.filter((m) => m.state !== "post").sort((a, b) => a.date.localeCompare(b.date));
    const first = coming[0];
    if (!first) return card("Prochains matchs", [emptyState("Pas encore de données", "ESPN n'annonce aucun match à venir pour le Real Madrid."), sourceNote(SOURCE, at)]);
    return card(
      first.state === "in" ? "Match en cours" : "Prochain match",
      [
        scoreLine(first),
        h("p", { class: "meta" }, first.state === "in" ? liveBadge(first) : h("strong", { class: "cap" }, when(first.date)), first.state === "pre" ? h("span", null, countdown(first.date, now)) : null, h("span", { class: "pill" }, first.competition)),
        first.venue ? h("p", { class: "muted small-2" }, first.venue) : null,
        coming.length > 1 ? h("ul", { class: "expenses sep" }, ...coming.slice(1, 4).map((m) => matchRow(m))) : null,
        h("p", { class: "note" }, "Heures de Genève. Pendant un match, le score peut avoir jusqu'à 10 minutes de retard."),
        sourceNote(SOURCE, at),
      ],
      { detail: coming.length > 4 ? () => [h("ul", { class: "expenses" }, ...coming.slice(4, 40).map((m) => matchRow(m)))] : undefined },
    );
  });

  const results = asyncSection(slots[1], "Derniers résultats", SOURCE, loadResults, ({ data, at }) => {
    const played = data.matches.filter((m) => m.state === "post");
    return card(
      "Derniers résultats",
      [
        played.length ? h("ul", { class: "expenses" }, ...played.slice(0, 5).map((m) => matchRow(m, REAL))) : emptyState("Pas encore de données", "Aucun match joué cette saison d'après ESPN."),
        data.partial ? h("p", { class: "note" }, "Une des deux compétitions n'a pas pu être lue : la liste est incomplète.") : null,
        h("p", { class: "note" }, "LaLiga et Ligue des champions uniquement (les coupes ne sont pas incluses)."),
        sourceNote(SOURCE, at),
      ],
      { detail: played.length > 5 ? () => [h("ul", { class: "expenses" }, ...played.slice(5, 60).map((m) => matchRow(m, REAL)))] : undefined },
    );
  });

  const standing = (slot: HTMLElement, league: string, title: string) =>
    asyncSection(slot, title, SOURCE, (force) => loadTable(league, force), ({ data, at }: Cached<StandingRow[]>) => {
      const mine = data.find((r) => r.teamId === REAL);
      return card(
        title,
        [
          mine ? h("p", null, h("span", { class: "big-2 num" }, `${mine.rank}ᵉ`), h("span", { class: "muted" }, ` · ${mine.points} points en ${mine.played} matchs`)) : h("p", { class: "muted" }, "Le Real Madrid n'apparaît pas dans ce classement."),
          table(data, REAL, false),
          sourceNote(SOURCE, at),
        ],
        { badge: `${data.length} équipes`, detail: () => [table(data, REAL, true)] },
      );
    });
  const liga = standing(slots[2], "esp.1", "Classement LaLiga");
  const europe = standing(slots[3], "uefa.champions", "Classement Ligue des champions");

  const playerRow = (p: RosterPlayer, value: string) => h("li", null, h("div", { class: "grow-2" }, h("p", { class: "expense-title" }, p.name), h("p", { class: "meta" }, [POSITION_LABELS[p.position] ?? p.position, p.nationality].filter(Boolean).join(" · "))), value ? h("span", { class: "num" }, value) : null);
  const scorers = asyncSection(slots[4], "Buteurs du Real (LaLiga)", SOURCE, loadRoster, ({ data, at }: Cached<RosterPlayer[]>) => {
    const list = data.filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals || (b.assists ?? 0) - (a.assists ?? 0));
    const row = (p: RosterPlayer) => playerRow(p, `${p.goals} but${p.goals > 1 ? "s" : ""}${p.assists ? ` · ${p.assists} passe${p.assists > 1 ? "s" : ""} déc.` : ""}`);
    return card("Buteurs du Real (LaLiga)", [list.length ? h("ul", { class: "expenses" }, ...list.slice(0, 5).map(row)) : emptyState("Pas encore de données", "Aucun but enregistré cette saison d'après ESPN."), sourceNote(SOURCE, at)], {
      detail: list.length > 5 ? () => [h("ul", { class: "expenses" }, ...list.slice(5).map(row))] : undefined,
    });
  });
  const squad = asyncSection(slots[5], "Effectif", SOURCE, loadRoster, ({ data, at }: Cached<RosterPlayer[]>) => {
    const order = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
    const sorted = [...data].sort((a, b) => order.indexOf(a.position) - order.indexOf(b.position) || a.name.localeCompare(b.name));
    const count = (position: string) => data.filter((p) => p.position === position).length;
    return card(
      "Effectif",
      [h("p", null, h("span", { class: "big-2 num" }, String(data.length)), h("span", { class: "muted" }, ` joueurs · ${count("Goalkeeper")} gardiens, ${count("Defender")} défenseurs, ${count("Midfielder")} milieux, ${count("Forward")} attaquants`)), h("p", { class: "note" }, "Entraîneur, blessures et suspensions : non fournis de façon fiable par cette source."), sourceNote(SOURCE, at)],
      { detail: () => [h("ul", { class: "expenses" }, ...sorted.map((p) => playerRow(p, p.appearances ? `${p.appearances} match${p.appearances > 1 ? "s" : ""}` : "")))] },
    );
  });

  return { slots, refresh: (force) => void Promise.all([next(force), results(force), liga(force), europe(force), scorers(force), squad(force)]) };
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

export function matchsView(root: HTMLElement): void {
  const slots = LEAGUES.map(() => h("div", { class: "slot" }));
  const runs = LEAGUES.map(([slug, name], i) =>
    asyncSection(
      slots[i],
      name,
      SOURCE,
      (force) => cachedLoad(`foot-journee-${slug}`, TEN_MINUTES, () => events(`${ESPN}/site/v2/sports/soccer/${slug}/scoreboard`, name), force),
      ({ data, at }: Cached<Match[]>) => {
        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
        return card(
          name,
          [sorted.length ? h("ul", { class: "expenses" }, ...sorted.slice(0, 12).map((m) => matchRow({ ...m, competition: m.state === "post" ? "Terminé" : m.state === "in" ? "En cours" : "À venir" }))) : emptyState("Pas encore de données", "ESPN n'affiche aucun match pour la journée en cours."), sourceNote(SOURCE, at)],
          { badge: sorted.length ? `${sorted.length} match${sorted.length > 1 ? "s" : ""}` : undefined },
        );
      },
    ),
  );
  const refresh = (force: boolean) => void Promise.all(runs.map((run) => run(force)));
  root.append(
    h(
      "div",
      { class: "toolbar" },
      h("p", { class: "muted" }, `Journée en cours de ${LEAGUES.length} compétitions (${LEAGUES.length} lectures = ${LEAGUES.length} crédits Firecrawl, gardées 10 minutes). Heures de Genève.`),
      h("button", { class: "btn", type: "button", onclick: () => refresh(true) }, icon("refresh-cw"), h("span", { class: "btn-label" }, "Actualiser")),
    ),
    h("div", { class: "grid two" }, ...slots),
    h("div", { class: "card" }, emptyState("Chaînes TV : pas de données", "Je n'ai trouvé aucune source publique et fiable qui indique la chaîne de diffusion en Suisse. ESPN ne donne que les chaînes américaines : elles ne sont donc pas affichées.")),
  );
  refresh(false);
}
