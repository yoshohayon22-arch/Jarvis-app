/**
 * Suivi du poids — fonctions pures.
 *
 * Le poids varie de 0,5 à 2 kg d'un jour à l'autre (eau, sel, glucides, transit).
 * On raisonne donc sur la MOYENNE MOBILE SUR 7 JOURS : la moyenne des pesées des 7 derniers
 * jours (fenêtre calendaire), qui lisse ces variations et révèle la vraie tendance.
 */
import { addDays } from './nutrition'
import type { WeighIn } from './types'

export interface TrendPoint {
  date: string
  kg: number
  /** Moyenne des pesées des 7 jours se terminant à cette date. */
  avg7: number
}

const sortByDate = (w: WeighIn[]) => [...w].sort((a, b) => a.date.localeCompare(b.date))

/** Moyenne des pesées dont la date est dans les 7 jours se terminant à `date` (inclus). */
export function average7(weighIns: WeighIn[], date: string): number | null {
  const from = addDays(date, -6)
  const inWindow = weighIns.filter((w) => w.date >= from && w.date <= date)
  if (inWindow.length === 0) return null
  return inWindow.reduce((s, w) => s + w.kg, 0) / inWindow.length
}

/** Courbe : chaque pesée avec sa moyenne mobile sur 7 jours. */
export function trendSeries(weighIns: WeighIn[]): TrendPoint[] {
  const sorted = sortByDate(weighIns)
  return sorted.map((w) => ({ date: w.date, kg: w.kg, avg7: Math.round(average7(sorted, w.date)! * 100) / 100 }))
}

/** Poids de tendance actuel (moyenne mobile à la dernière pesée), ou null sans pesée. */
export function trendWeight(weighIns: WeighIn[]): number | null {
  const s = trendSeries(weighIns)
  return s.length ? s[s.length - 1].avg7 : null
}

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

/**
 * Tendance en kg par semaine : pente de la droite de régression (moindres carrés) sur les
 * pesées des 21 derniers jours. Il faut au moins 3 pesées étalées sur 7 jours ou plus.
 */
export function weeklyTrend(weighIns: WeighIn[], today: string): number | null {
  const recent = sortByDate(weighIns).filter((w) => w.date >= addDays(today, -20) && w.date <= today)
  if (recent.length < 3 || daysBetween(recent[0].date, recent[recent.length - 1].date) < 7) return null
  const xs = recent.map((w) => daysBetween(recent[0].date, w.date))
  const ys = recent.map((w) => w.kg)
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length
  const my = ys.reduce((s, y) => s + y, 0) / ys.length
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0)
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0)
  if (den === 0) return null
  return Math.round(((num / den) * 7) * 100) / 100
}

/**
 * Variations des deux dernières semaines, mesurées sur les moyennes mobiles :
 * [semaine d'avant, semaine dernière] en kg (négatif = perte). null si les données manquent.
 */
export function lastTwoWeeksChanges(weighIns: WeighIn[], today: string): [number, number] | null {
  const a0 = average7(weighIns, today)
  const a7 = average7(weighIns, addDays(today, -7))
  const a14 = average7(weighIns, addDays(today, -14))
  if (a0 === null || a7 === null || a14 === null) return null
  return [a7 - a14, a0 - a7]
}

/**
 * Garde-fou : perte supérieure à 1 % du poids par semaine pendant 2 semaines consécutives.
 * Au-delà, on perd davantage de muscle et d'eau que de graisse : on conseille de ralentir.
 */
export function isLosingTooFast(weighIns: WeighIn[], today: string): boolean {
  const changes = lastTwoWeeksChanges(weighIns, today)
  const ref = average7(weighIns, addDays(today, -14))
  if (!changes || ref === null) return false
  return changes.every((c) => -c > ref * 0.01)
}

/** Plateau : poids stable (moins de 0,3 kg d'écart sur la moyenne) depuis 2 semaines. */
export const PLATEAU_KG = 0.3

export function isPlateau(weighIns: WeighIn[], today: string): boolean {
  const sorted = sortByDate(weighIns)
  if (sorted.length < 4) return false
  // Il faut des pesées qui couvrent vraiment les deux semaines.
  if (daysBetween(sorted[0].date, today) < 14) return false
  const a0 = average7(sorted, today)
  const a14 = average7(sorted, addDays(today, -14))
  if (a0 === null || a14 === null) return false
  return Math.abs(a0 - a14) < PLATEAU_KG
}

/** Nombre de pesées d'affilée, sans trou de plus de 7 jours entre deux pesées. */
export function weighInStreak(weighIns: WeighIn[], today: string): number {
  const sorted = sortByDate(weighIns).filter((w) => w.date <= today)
  if (sorted.length === 0 || daysBetween(sorted[sorted.length - 1].date, today) > 7) return 0
  let streak = 1
  for (let i = sorted.length - 1; i > 0; i--) {
    if (daysBetween(sorted[i - 1].date, sorted[i].date) > 7) break
    streak++
  }
  return streak
}

/** Jours depuis la dernière pesée (null s'il n'y en a aucune). */
export function daysSinceLastWeighIn(weighIns: WeighIn[], today: string): number | null {
  const sorted = sortByDate(weighIns)
  return sorted.length ? daysBetween(sorted[sorted.length - 1].date, today) : null
}

/** Objectif atteint (à 0,3 kg près, sur le poids de tendance) dans le sens voulu. */
export function goalReached(startKg: number, trendKg: number, targetKg: number): boolean {
  if (Math.abs(startKg - targetKg) < 0.5) return false // pas d'objectif de changement
  return startKg > targetKg ? trendKg <= targetKg + 0.3 : trendKg >= targetKg - 0.3
}

/**
 * Date estimée au rythme réellement observé (tendance hebdomadaire).
 * null si la tendance va dans le mauvais sens ou est trop faible pour conclure.
 */
export function projectedDate(trendKg: number, targetKg: number, kgPerWeek: number | null, today: string): string | null {
  if (kgPerWeek === null || Math.abs(kgPerWeek) < 0.05) return null
  const remaining = targetKg - trendKg
  if (Math.sign(remaining) !== Math.sign(kgPerWeek)) return null
  const weeks = remaining / kgPerWeek
  if (weeks > 260) return null // plus de 5 ans : pas une estimation utile
  return addDays(today, Math.ceil(weeks * 7))
}

/**
 * Résumé des dernières semaines pour la carte « Mon suivi » de l'accueil :
 * points de la moyenne mobile sur la période, et variation de cette moyenne.
 */
export function recentSummary(
  weighIns: WeighIn[],
  today: string,
  days = 28,
): { points: TrendPoint[]; changeKg: number | null } {
  const from = addDays(today, -days)
  const points = trendSeries(weighIns).filter((p) => p.date >= from && p.date <= today)
  const changeKg = points.length >= 2 ? Math.round((points[points.length - 1].avg7 - points[0].avg7) * 10) / 10 : null
  return { points, changeKg }
}
