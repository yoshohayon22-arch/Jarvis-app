/**
 * Football : matchs et classements lus sur l'API publique d'ESPN (sans clé), via Firecrawl.
 * Lecture tolérante : un match ou une ligne de classement incomplets sont ignorés plutôt qu'affichés de travers.
 */
import { cachedLoad, DataError, loadJson, type Cached } from "./data";
import { h, icon } from "./dom";
import { asyncSection, card, emptyState, sourceNote, timeFmt } from "./views";

const ESPN = "https://site.api.espn.com/apis";
const SOURCE = "ESPN (lu via Firecrawl)";
const REAL = "86";
const TEN_MINUTES = 10 * 60 * 1000;

export interface Match {
  id: string;
  /** Date ISO du coup d'envoi. */
  date: string;
  competition: string;
  home: string;
  away: string;
  homeId: string;
  awayId: string;
  homeScore: number | null;
  awayScore: number | null;
  state: "pre" | "in" | "post";
  /** Minute affichée pendant le match (ex. « 67' »), ou mention de fin. */
  clock: string;
  venue: string;
}

export interface StandingRow {
  rank: number;
  teamId: string;
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  diff: string;
  points: number;
  note: string;
}

const COMPETITIONS: Record<string, string> = { "esp.1": "LaLiga", "uefa.champions": "Ligue des champions", "esp.super_cup": "Supercoupe d'Espagne", "esp.copa_del_rey": "Coupe du Roi", "eng.1": "Premier League", "fra.1": "Ligue 1", "ita.1": "Serie A", "ger.1": "Bundesliga" };

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const text = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

function score(raw: unknown): number | null {
  const value = typeof raw === "object" && raw ? text(obj(raw).displayValue) : text(raw);
  return /^\d+$/.test(value) ? Number(value) : null;
}

/** Transforme une liste d'« events » ESPN (calendrier d'équipe ou tableau des scores) en matchs. */
export function parseMatches(events: unknown, fallbackCompetition = ""): Match[] {
  const out: Match[] = [];
  for (const event of arr(events)) {
    const competition = obj(arr(event.competitions)[0]);
    const teams = arr(competition.competitors);
    const home = teams.find((t) => t.homeAway === "home");
    const away = teams.find((t) => t.homeAway === "away");
    const date = text(event.date);
    const status = obj(obj(competition.status ?? event.status).type);
    const state = status.state === "in" ? "in" : status.state === "post" ? "post" : "pre";
    const homeName = text(obj(home?.team).displayName);
    const awayName = text(obj(away?.team).displayName);
    if (!home || !away || !homeName || !awayName || Number.isNaN(Date.parse(date))) continue;
    const league = obj(event.league);
    const played = state !== "pre";
    out.push({
      id: text(event.id),
      date: new Date(date).toISOString(),
      competition: COMPETITIONS[text(league.slug)] ?? (text(league.name) || fallbackCompetition),
      home: homeName,
      away: awayName,
      homeId: text(obj(home.team).id),
      awayId: text(obj(away.team).id),
      // Avant le coup d'envoi, ESPN renvoie parfois « 0 » : ce n'est pas un score.
      homeScore: played ? score(home.score) : null,
      awayScore: played ? score(away.score) : null,
      state,
      clock: state === "in" ? text(obj(competition.status ?? event.status).displayClock) : "",
      venue: text(obj(competition.venue ?? event.venue).fullName),
    });
  }
  return out;
}

export function parseStandings(raw: unknown): StandingRow[] {
  const entries = arr(obj(obj(arr(obj(raw).children)[0]).standings).entries);
  const rows: StandingRow[] = [];
  for (const entry of entries) {
    const stats = new Map(arr(entry.stats).map((s) => [text(s.name), s]));
    const n = (name: string) => {
      const value = stats.get(name)?.value;
      return typeof value === "number" && Number.isFinite(value) ? value : NaN;
    };
    const row: StandingRow = { rank: n("rank"), teamId: text(obj(entry.team).id), team: text(obj(entry.team).displayName), played: n("gamesPlayed"), wins: n("wins"), draws: n("ties"), losses: n("losses"), diff: text(stats.get("pointDifferential")?.displayValue), points: n("points"), note: text(obj(entry.note).description) };
    if (row.team && [row.rank, row.played, row.wins, row.draws, row.losses, row.points].every(Number.isFinite)) rows.push(row);
  }
  return rows.sort((a, b) => a.rank - b.rank);
}

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
  const slots = Array.from({ length: 4 }, () => h("div", { class: "slot" }));

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

  return { slots, refresh: (force) => void Promise.all([next(force), results(force), liga(force), europe(force)]) };
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
