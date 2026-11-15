import "server-only";

import { cached } from "@/lib/server-cache";
import { ESPN_API, ESPN_REAL_MADRID, parseMatches, parseStandings, type Match as EspnMatch } from "./espn";
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

/**
 * football-data.org (API v4, plan gratuit) : 10 requêtes par minute, scores en différé.
 * Chaque appel est mis en cache côté serveur pour rester très en dessous de cette limite.
 * Le jeton est lu dans FOOTBALL_DATA_TOKEN (variable serveur) et n'est jamais envoyé au navigateur.
 */
const API = "https://api.football-data.org/v4";
const MINUTE = 60 * 1000;

async function api<T>(path: string): Promise<T> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("jeton football-data.org non configuré sur le serveur");
  const res = await fetch(`${API}${path}`, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  }).catch((e: unknown) => {
    throw new Error(e instanceof Error && e.name === "TimeoutError" ? "pas de réponse en 10 secondes" : "service injoignable");
  });
  if (res.status === 429) throw new Error("limite de 10 requêtes par minute atteinte, réessaie dans une minute");
  if (res.status === 403) throw new Error("donnée non incluse dans le plan gratuit");
  if (!res.ok) throw new Error(`football-data.org a répondu ${res.status}`);
  return (await res.json()) as T;
}

interface ApiTeam {
  id: number;
  name: string;
  shortName?: string | null;
  crest?: string | null;
}
const team = (t: ApiTeam): TeamRef => ({ id: t.id, name: t.shortName || t.name, crest: t.crest ?? null });

async function part<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<Part<T>> {
  try {
    const { data, fetchedAt } = await cached(key, ttlMs, async () => ({ data: await load(), fetchedAt: new Date().toISOString() }));
    return { ok: true, data, fetchedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "erreur inconnue" };
  }
}

// ---------- Buteurs ----------
async function loadScorers(): Promise<Scorer[]> {
  const data = await api<{
    scorers: { player: { name: string }; team: ApiTeam; playedMatches?: number | null; goals: number; assists?: number | null; penalties?: number | null }[];
  }>("/competitions/PD/scorers?limit=30");
  return data.scorers.map((s) => ({
    name: s.player.name,
    team: team(s.team),
    played: s.playedMatches ?? null,
    goals: s.goals,
    assists: s.assists ?? null,
    penalties: s.penalties ?? null,
  }));
}

// ---------- Effectif ----------
const POSITIONS: Record<string, string> = {
  Goalkeeper: "Gardien",
  Defence: "Défenseur",
  "Centre-Back": "Défenseur central",
  "Left-Back": "Arrière gauche",
  "Right-Back": "Arrière droit",
  Midfield: "Milieu",
  "Defensive Midfield": "Milieu défensif",
  "Central Midfield": "Milieu central",
  "Attacking Midfield": "Milieu offensif",
  Offence: "Attaquant",
  "Centre-Forward": "Avant-centre",
  "Left Winger": "Ailier gauche",
  "Right Winger": "Ailier droit",
};

async function loadSquad() {
  const data = await api<{
    venue?: string | null;
    coach?: { name?: string | null } | null;
    squad: { name: string; position?: string | null; nationality?: string | null; dateOfBirth?: string | null }[];
  }>(`/teams/${REAL_MADRID_ID}`);
  const players: SquadPlayer[] = data.squad.map((p) => ({
    name: p.name,
    position: p.position ? (POSITIONS[p.position] ?? p.position) : "Poste non précisé",
    nationality: p.nationality ?? null,
    dateOfBirth: p.dateOfBirth ?? null,
  }));
  return { coach: data.coach?.name ?? null, venue: data.venue ?? null, players };
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

/**
 * Matchs et classements : ESPN (aucun jeton nécessaire).
 * Buteurs et effectif : football-data.org, seulement si FOOTBALL_DATA_TOKEN est configuré.
 */
export async function loadRealMadrid(): Promise<RealMadridPayload> {
  const [matches, laliga, championsLeague, scorers, squad] = await Promise.all([
    part("espn:matchs", 1 * MINUTE, loadEspnMatches),
    part("espn:laliga", 10 * MINUTE, () => loadEspnStandings("esp.1")),
    part("espn:ldc", 10 * MINUTE, () => loadEspnStandings("uefa.champions")),
    part("foot:buteurs", 30 * MINUTE, loadScorers),
    part("foot:effectif", 12 * 60 * MINUTE, loadSquad),
  ]);
  return { matches, laliga, championsLeague, scorers, squad };
}
