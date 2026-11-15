/** Indicateurs de progression vers l'objectif — fonctions pures. */

/** Part du chemin parcouru entre le poids de départ et le poids cible (0 à 100 %). */
export function progressPercent(start: number, current: number, target: number): number {
  if (start === target) return 100
  const pct = ((start - current) / (start - target)) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
}
