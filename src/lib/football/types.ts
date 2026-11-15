/** Données Real Madrid mises en forme pour l'affichage (source : football-data.org). */

export interface TeamRef {
  id: number;
  name: string;
  crest: string | null;
}

export interface Match {
  id: number;
  utcDate: string;
  /** false quand l'heure du coup d'envoi n'est pas encore fixée. */
  timeConfirmed: boolean;
  status: "a-venir" | "en-cours" | "termine" | "reporte";
  competition: string;
  competitionCode: string;
  matchday: number | null;
  home: TeamRef;
  away: TeamRef;
  homeScore: number | null;
  awayScore: number | null;
  /** Résultat du point de vue du Real : V, N ou D (matchs terminés). */
  outcome: "V" | "N" | "D" | null;
}

export interface StandingRow {
  position: number;
  team: TeamRef;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface Scorer {
  name: string;
  team: TeamRef;
  played: number | null;
  goals: number;
  assists: number | null;
  penalties: number | null;
}

export interface SquadPlayer {
  name: string;
  position: string;
  nationality: string | null;
  dateOfBirth: string | null;
}

/** Une partie des données : soit la valeur, soit la raison de son absence. */
export type Part<T> = { ok: true; data: T; fetchedAt: string } | { ok: false; error: string };

export interface RealMadridPayload {
  matches: Part<{ live: Match | null; upcoming: Match[]; recent: Match[] }>;
  laliga: Part<{ matchday: number | null; table: StandingRow[] }>;
  championsLeague: Part<{ matchday: number | null; table: StandingRow[] }>;
  scorers: Part<Scorer[]>;
  squad: Part<{ coach: string | null; venue: string | null; players: SquadPlayer[] }>;
}

export const REAL_MADRID_ID = 86;
