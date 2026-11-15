import "server-only";

import { cached } from "@/lib/server-cache";
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

// ---------- Matchs ----------
interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  competition: { name: string; code: string };
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score: { winner: string | null; fullTime: { home: number | null; away: number | null } };
}

const COMPETITION_NAMES: Record<string, string> = { PD: "LaLiga", CL: "Ligue des champions" };

function toMatch(m: ApiMatch): Match {
  const live = m.status === "IN_PLAY" || m.status === "PAUSED" || m.status === "LIVE";
  const finished = m.status === "FINISHED" || m.status === "AWARDED";
  const postponed = m.status === "POSTPONED" || m.status === "SUSPENDED" || m.status === "CANCELLED";
  const realIsHome = m.homeTeam.id === REAL_MADRID_ID;
  const winner = m.score.winner;
  return {
    id: m.id,
    utcDate: m.utcDate,
    timeConfirmed: m.status !== "SCHEDULED",
    status: live ? "en-cours" : finished ? "termine" : postponed ? "reporte" : "a-venir",
    competition: COMPETITION_NAMES[m.competition.code] ?? m.competition.name,
    competitionCode: m.competition.code,
    matchday: m.matchday,
    home: team(m.homeTeam),
    away: team(m.awayTeam),
    homeScore: m.score.fullTime.home,
    awayScore: m.score.fullTime.away,
    outcome: !finished || !winner ? null : winner === "DRAW" ? "N" : (winner === "HOME_TEAM") === realIsHome ? "V" : "D",
  };
}

const day = (offsetDays: number) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

async function loadMatches() {
  const data = await api<{ matches: ApiMatch[] }>(`/teams/${REAL_MADRID_ID}/matches?dateFrom=${day(-45)}&dateTo=${day(60)}`);
  const matches = data.matches.map(toMatch).sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  return {
    live: matches.find((m) => m.status === "en-cours") ?? null,
    upcoming: matches.filter((m) => m.status === "a-venir").slice(0, 6),
    recent: matches.filter((m) => m.status === "termine").slice(-6).reverse(),
  };
}

// ---------- Classements ----------
interface ApiStandings {
  season: { currentMatchday: number | null };
  standings: {
    type: string;
    table: {
      position: number;
      team: ApiTeam;
      playedGames: number;
      won: number;
      draw: number;
      lost: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDifference: number;
      points: number;
    }[];
  }[];
}

async function loadStandings(code: "PD" | "CL") {
  const data = await api<ApiStandings>(`/competitions/${code}/standings`);
  const total = data.standings.find((s) => s.type === "TOTAL") ?? data.standings[0];
  const table: StandingRow[] = (total?.table ?? []).map((r) => ({
    position: r.position,
    team: team(r.team),
    played: r.playedGames,
    won: r.won,
    draw: r.draw,
    lost: r.lost,
    goalsFor: r.goalsFor,
    goalsAgainst: r.goalsAgainst,
    goalDifference: r.goalDifference,
    points: r.points,
  }));
  return { matchday: data.season.currentMatchday, table };
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

export async function loadRealMadrid(): Promise<RealMadridPayload> {
  const [matches, laliga, championsLeague, scorers, squad] = await Promise.all([
    part("foot:matchs", 1 * MINUTE, loadMatches),
    part("foot:laliga", 10 * MINUTE, () => loadStandings("PD")),
    part("foot:ldc", 10 * MINUTE, () => loadStandings("CL")),
    part("foot:buteurs", 30 * MINUTE, loadScorers),
    part("foot:effectif", 12 * 60 * MINUTE, loadSquad),
  ]);
  return { matches, laliga, championsLeague, scorers, squad };
}
