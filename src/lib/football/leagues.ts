import type { Match } from "./espn";
import type { Part } from "./types";

/** Compétitions suivies dans l'onglet « Matchs de la journée » (identifiants ESPN). */
export const MATCH_LEAGUES: [string, string][] = [
  ["esp.1", "LaLiga"],
  ["uefa.champions", "Ligue des champions"],
  ["eng.1", "Premier League"],
  ["fra.1", "Ligue 1"],
  ["ita.1", "Serie A"],
  ["ger.1", "Bundesliga"],
];

export interface MatchdayPayload {
  leagues: { slug: string; name: string; matches: Part<Match[]> }[];
}
