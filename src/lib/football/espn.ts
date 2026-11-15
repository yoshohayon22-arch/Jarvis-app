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
    const row: StandingRow = { rank: n("rank"), teamId: text(obj(entry.team).id), team: text(obj(entry.team).displayName), played: n("gamesPlayed"), wins: n("wins"), draws: n("ties"), losses: n("losses"), diff: text(stats.get("pointDifferential")?.displayValue), goalsFor: n("pointsFor"), goalsAgainst: n("pointsAgainst"), points: n("points"), note: text(obj(entry.note).description) };
    if (row.team && [row.rank, row.played, row.wins, row.draws, row.losses, row.points].every(Number.isFinite)) rows.push(row);
  }
  return rows.sort((a, b) => a.rank - b.rank);
}

