/**
 * Lecture de l'API publique d'ESPN (sans clé) : matchs et classements de football.
 * Fonctions pures, partagées par le site (serveur) et par la version artefact.
 * Lecture tolérante : un match ou une ligne de classement incomplets sont ignorés plutôt qu'affichés de travers.
 */
export const ESPN_API = "https://site.api.espn.com/apis";
export const ESPN_REAL_MADRID = "86";

export interface Match {
  id: string;
  /** Date ISO du coup d'envoi. */
  date: string;
  competition: string;
  /** Identifiant ESPN de la compétition (ex. « esp.1 »), nécessaire pour lire le détail du match. */
  league: string;
  home: string;
  away: string;
  homeId: string;
  awayId: string;
  /** Sigle (ex. « RMA ») et couleur du club quand ESPN les fournit. */
  homeAbbr: string;
  awayAbbr: string;
  homeColor: string;
  awayColor: string;
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
  goalsFor: number;
  goalsAgainst: number;
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
export function parseMatches(events: unknown, fallbackCompetition = "", fallbackLeague = ""): Match[] {
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
      league: text(league.slug) || fallbackLeague,
      home: homeName,
      away: awayName,
      homeId: text(obj(home.team).id),
      awayId: text(obj(away.team).id),
      homeAbbr: text(obj(home.team).abbreviation),
      awayAbbr: text(obj(away.team).abbreviation),
      homeColor: text(obj(home.team).color),
      awayColor: text(obj(away.team).color),
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
    const row: StandingRow = { rank: n("rank"), teamId: text(obj(entry.team).id), team: text(obj(entry.team).displayName), played: n("gamesPlayed"), wins: n("wins"), draws: n("ties"), losses: n("losses"), diff: text(stats.get("pointDifferential")?.displayValue), goalsFor: n("pointsFor"), goalsAgainst: n("pointsAgainst"), points: n("points"), note: text(obj(entry.note).description) };
    if (row.team && [row.rank, row.played, row.wins, row.draws, row.losses, row.points].every(Number.isFinite)) rows.push(row);
  }
  return rows.sort((a, b) => a.rank - b.rank);
}


export interface RosterPlayer {
  name: string;
  /** Poste tel que donné par ESPN (Goalkeeper, Defender, Midfielder, Forward). */
  position: string;
  nationality: string | null;
  /** aaaa-mm-jj */
  dateOfBirth: string | null;
  appearances: number | null;
  goals: number;
  assists: number | null;
}

export const POSITION_LABELS: Record<string, string> = { Goalkeeper: "Gardien", Defender: "Défenseur", Midfielder: "Milieu", Forward: "Attaquant" };

/** Effectif d'une équipe (fiche « roster » d'ESPN), avec buts et passes décisives de la saison en championnat. */
export function parseRoster(raw: unknown): RosterPlayer[] {
  const stat = (athlete: Raw, name: string): number | null => {
    for (const category of arr(obj(obj(athlete.statistics).splits).categories)) {
      const value = arr(category.stats).find((s) => s.name === name)?.value;
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
    return null;
  };
  return arr(obj(raw).athletes)
    .filter((a) => typeof a.displayName === "string" && a.displayName)
    .map((a) => ({
      name: String(a.displayName),
      position: text(obj(a.position).displayName),
      nationality: typeof a.citizenship === "string" && a.citizenship ? a.citizenship : null,
      dateOfBirth: typeof a.dateOfBirth === "string" && !Number.isNaN(Date.parse(a.dateOfBirth)) ? new Date(a.dateOfBirth).toISOString().slice(0, 10) : null,
      appearances: stat(a, "appearances"),
      goals: stat(a, "totalGoals") ?? 0,
      assists: stat(a, "goalAssists"),
    }));
}

// ---------- Détail d'un match (résumé ESPN) ----------
export interface MatchEvent {
  minute: string;
  kind: "but" | "jaune" | "rouge" | "remplacement";
  /** « home » ou « away ». */
  side: "home" | "away" | "";
  /** But, carton : le joueur concerné. Remplacement : celui qui entre, puis celui qui sort. */
  players: string[];
  /** But contre son camp ou sur penalty, quand ESPN le précise. */
  detail: string;
}
export interface Lineup {
  side: "home" | "away";
  team: string;
  formation: string;
  starters: { name: string; jersey: string; position: string }[];
  subs: { name: string; jersey: string; cameOn: boolean }[];
}
export interface MatchStat {
  label: string;
  home: number;
  away: number;
  /** Vrai si la valeur est un pourcentage (possession, passes réussies). */
  percent: boolean;
}
export interface MatchSummary {
  events: MatchEvent[];
  lineups: Lineup[];
  stats: MatchStat[];
  venue: string;
  attendance: number | null;
}

const EVENT_KINDS: Record<string, MatchEvent["kind"]> = { goal: "but", "goal---header": "but", "goal---free-kick": "but", "penalty---scored": "but", "own-goal": "but", "yellow-card": "jaune", "red-card": "rouge", substitution: "remplacement" };
const STATS: [string, string, boolean][] = [
  ["possessionPct", "Possession", true],
  ["totalShots", "Tirs", false],
  ["shotsOnTarget", "Tirs cadrés", false],
  ["wonCorners", "Corners", false],
  ["foulsCommitted", "Fautes", false],
  ["offsides", "Hors-jeu", false],
  ["saves", "Arrêts du gardien", false],
  ["passPct", "Passes réussies", true],
];

export function parseSummary(raw: unknown): MatchSummary {
  const data = obj(raw);
  const competitors = arr(obj(arr(obj(data.header).competitions)[0]).competitors);
  const sideOf = (teamId: string): MatchEvent["side"] => (competitors.find((c) => text(obj(c.team).id) === teamId || text(c.id) === teamId)?.homeAway === "away" ? "away" : competitors.some((c) => text(obj(c.team).id) === teamId || text(c.id) === teamId) ? "home" : "");

  const events: MatchEvent[] = [];
  for (const e of arr(data.keyEvents)) {
    const slug = text(obj(e.type).type);
    const kind = EVENT_KINDS[slug] ?? (slug.startsWith("goal") || slug.includes("penalty---scored") ? "but" : undefined);
    const players = arr(e.participants).map((p) => text(obj(p.athlete).displayName)).filter(Boolean);
    if (!kind || !players.length) continue;
    events.push({ minute: text(obj(e.clock).displayValue), kind, side: sideOf(text(obj(e.team).id)), players, detail: slug === "own-goal" ? "contre son camp" : slug.includes("penalty") ? "penalty" : "" });
  }

  const lineups: Lineup[] = arr(data.rosters)
    .map((r) => {
      const players = arr(r.roster).filter((p) => text(obj(p.athlete).displayName));
      return {
        side: (r.homeAway === "away" ? "away" : "home") as Lineup["side"],
        team: text(obj(r.team).displayName),
        formation: text(r.formation),
        starters: players.filter((p) => p.starter === true).map((p) => ({ name: text(obj(p.athlete).displayName), jersey: text(p.jersey), position: text(obj(p.position).abbreviation) })),
        subs: players.filter((p) => p.starter !== true).map((p) => ({ name: text(obj(p.athlete).displayName), jersey: text(p.jersey), cameOn: p.subbedIn === true })),
      };
    })
    .filter((l) => l.starters.length > 0)
    .sort((a) => (a.side === "home" ? -1 : 1));

  const teams = arr(obj(data.boxscore).teams);
  const statOf = (side: string, name: string) => {
    const team = teams.find((t) => t.homeAway === side);
    const value = Number(text(arr(team?.statistics).find((s) => s.name === name)?.displayValue));
    return Number.isFinite(value) ? value : NaN;
  };
  const stats: MatchStat[] = [];
  for (const [name, label, percent] of STATS) {
    let home = statOf("home", name);
    let away = statOf("away", name);
    if (!Number.isFinite(home) || !Number.isFinite(away)) continue;
    // ESPN donne certains pourcentages sous forme de fraction (0,8 pour 80 %).
    if (percent && home <= 1 && away <= 1) [home, away] = [Math.round(home * 100), Math.round(away * 100)];
    stats.push({ label, home, away, percent });
  }
  const attendance = obj(data.gameInfo).attendance;
  return { events, lineups, stats, venue: text(obj(obj(data.gameInfo).venue).fullName), attendance: typeof attendance === "number" && attendance > 0 ? attendance : null };
}
