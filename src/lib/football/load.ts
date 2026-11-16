import "server-only";

import { cached } from "@/lib/server-cache";
import { ESPN_API, ESPN_REAL_MADRID, parseMatches, parseRoster, parseStandings, POSITION_LABELS, type Match as EspnMatch } from "./espn";
import {
  REAL_MADRID_ID,
  type Match,
  type Part,
  type RealMadridPayload,
  type Scorer,
  type SquadPlayer,
  type StandingRow,
  type TeamRef,
} from "./types";

const MINUTE = 60 * 1000;

async function part<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<Part<T>> {
  try {
    const { data, fetchedAt } = await cached(key, ttlMs, async () => ({ data: await load(), fetchedAt: new Date().toISOString() }));
    return { ok: true, data, fetchedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "erreur inconnue" };
  }
}

// ---------- Matchs et classements : API publique d'ESPN (sans jeton) ----------
async function espn(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${ESPN_API}${path}`, { cache: "no-store", signal: AbortSignal.timeout(10000) }).catch((e: unknown) => {
    throw new Error(e instanceof Error && e.name === "TimeoutError" ? "pas de réponse d'ESPN en 10 secondes" : "ESPN injoignable");
  });
  if (!res.ok) throw new Error(`ESPN a répondu ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

const espnTeam = (id: string, name: string): TeamRef => ({ id: Number(id) || 0, name, crest: null });

function fromEspn(m: EspnMatch): Match {
  const known = m.homeScore !== null && m.awayScore !== null;
  const mine = m.homeId === ESPN_REAL_MADRID ? m.homeScore : m.awayScore;
  const theirs = m.homeId === ESPN_REAL_MADRID ? m.awayScore : m.homeScore;
  return {
    id: Number(m.id) || 0,
    utcDate: m.date,
    timeConfirmed: true,
    status: m.state === "in" ? "en-cours" : m.state === "post" ? "termine" : "a-venir",
    competition: m.competition,
    competitionCode: m.competition,
    matchday: null,
    home: espnTeam(m.homeId, m.home),
    away: espnTeam(m.awayId, m.away),
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    outcome: m.state !== "post" || !known ? null : mine! > theirs! ? "V" : mine! < theirs! ? "D" : "N",
  };
}

async function loadEspnMatches() {
  const schedule = async (path: string, name = "") => parseMatches((await espn(path)).events, name);
  const [upcoming, liga, europe] = await Promise.allSettled([
    schedule(`/site/v2/sports/soccer/all/teams/${ESPN_REAL_MADRID}/schedule?fixture=true`),
    schedule(`/site/v2/sports/soccer/esp.1/teams/${ESPN_REAL_MADRID}/schedule`, "LaLiga"),
    schedule(`/site/v2/sports/soccer/uefa.champions/teams/${ESPN_REAL_MADRID}/schedule`, "Ligue des champions"),
  ]);
  if (upcoming.status === "rejected" && liga.status === "rejected") throw upcoming.reason;
  const all = [upcoming, liga, europe].flatMap((r) => (r.status === "fulfilled" ? r.value : [])).map(fromEspn);
  const unique = [...new Map(all.map((m) => [m.id, m])).values()].sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  return {
    live: unique.find((m) => m.status === "en-cours") ?? null,
    upcoming: unique.filter((m) => m.status === "a-venir").slice(0, 6),
    recent: unique.filter((m) => m.status === "termine").slice(-6).reverse(),
  };
}

async function loadEspnStandings(league: string) {
  const rows = parseStandings(await espn(`/v2/sports/soccer/${league}/standings`));
  if (!rows.length) throw new Error("classement vide ou illisible");
  const table: StandingRow[] = rows.map((r) => ({
    position: r.rank,
    team: { ...espnTeam(r.teamId, r.team), id: r.teamId === ESPN_REAL_MADRID ? REAL_MADRID_ID : (Number(r.teamId) || 0) + 100000 },
    played: r.played,
    won: r.wins,
    draw: r.draws,
    lost: r.losses,
    goalsFor: Number.isFinite(r.goalsFor) ? r.goalsFor : 0,
    goalsAgainst: Number.isFinite(r.goalsAgainst) ? r.goalsAgainst : 0,
    goalDifference: Number(r.diff) || 0,
    points: r.points,
  }));
  return { matchday: null, table };
}

// ---------- Effectif et buteurs du club (fiche d'équipe ESPN) ----------
const loadRoster = () =>
  cached("espn:effectif", 60 * MINUTE, async () => {
    const players = parseRoster(await espn(`/site/v2/sports/soccer/esp.1/teams/${ESPN_REAL_MADRID}/roster`));
    if (!players.length) throw new Error("effectif vide ou illisible");
    return players;
  });

async function loadScorers(): Promise<Scorer[]> {
  const real = espnTeam(ESPN_REAL_MADRID, "Real Madrid");
  return (await loadRoster())
    .filter((p) => p.goals > 0)
    .map((p) => ({ name: p.name, team: real, played: p.appearances, goals: p.goals, assists: p.assists, penalties: null }))
    .sort((a, b) => b.goals - a.goals || (b.assists ?? 0) - (a.assists ?? 0));
}

async function loadSquad() {
  const players: SquadPlayer[] = (await loadRoster()).map((p) => ({ name: p.name, position: POSITION_LABELS[p.position] ?? (p.position || "Poste non précisé"), nationality: p.nationality, dateOfBirth: p.dateOfBirth }));
  // L'entraîneur et le stade ne sont pas repris : la fiche ESPN ne les donne pas de façon fiable.
  return { coach: null, venue: null, players };
}

/** Journée en cours d'une compétition (tableau des scores ESPN). */
export async function loadMatchday(league: string, name: string) {
  return part(`espn:journee:${league}`, 2 * MINUTE, async () => {
    const raw = await espn(`/site/v2/sports/soccer/${league}/scoreboard`);
    if (!Array.isArray(raw.events)) throw new Error("réponse inattendue d'ESPN");
    return parseMatches(raw.events, name).sort((a, b) => a.date.localeCompare(b.date));
  });
}

/** Toutes les données viennent de l'API publique d'ESPN : aucun jeton n'est nécessaire. */
export async function loadRealMadrid(): Promise<RealMadridPayload> {
  const [matches, laliga, championsLeague, scorers, squad] = await Promise.all([
    part("espn:matchs", 1 * MINUTE, loadEspnMatches),
    part("espn:laliga", 10 * MINUTE, () => loadEspnStandings("esp.1")),
    part("espn:ldc", 10 * MINUTE, () => loadEspnStandings("uefa.champions")),
    part("espn:buteurs", 30 * MINUTE, loadScorers),
    part("espn:effectif-vue", 60 * MINUTE, loadSquad),
  ]);
  return { matches, laliga, championsLeague, scorers, squad };
}
