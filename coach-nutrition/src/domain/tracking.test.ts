import { describe, expect, it } from 'vitest'
import { addDays } from './nutrition'
import {
  average7,
  daysSinceLastWeighIn,
  goalReached,
  isLosingTooFast,
  isPlateau,
  projectedDate,
  recentSummary,
  trendSeries,
  trendWeight,
  weeklyTrend,
  weighInStreak,
} from './tracking'
import { coachMessages, FAQ, MESSAGES, pickVariant } from './coach'
import { DEFAULT_SETTINGS } from '../storage/migrations'
import type { ProfileSettings, WeighIn } from './types'

const TODAY = '2026-11-15'

/** Série de pesées quotidiennes : poids de départ, variation par jour, bruit alterné ±. */
function series(days: number, startKg: number, perDay: number, noise = 0, end = TODAY): WeighIn[] {
  return Array.from({ length: days }, (_, i) => ({
    date: addDays(end, i - days + 1),
    kg: Math.round((startKg + perDay * i + (i % 2 ? noise : -noise)) * 10) / 10,
  }))
}

describe('Moyenne mobile sur 7 jours', () => {
  it('fait la moyenne des pesées des 7 derniers jours calendaires', () => {
    const w: WeighIn[] = [
      { date: '2026-11-01', kg: 80 },
      { date: '2026-11-05', kg: 79 },
      { date: '2026-11-07', kg: 78 },
      { date: '2026-11-09', kg: 77 }, // le 01/11 sort de la fenêtre (03 → 09)
    ]
    expect(average7(w, '2026-11-07')).toBeCloseTo(79)
    expect(average7(w, '2026-11-09')).toBeCloseTo(78)
    expect(average7(w, '2026-10-20')).toBeNull()
  })
  it('lisse les variations d’eau', () => {
    const w = series(14, 80, 0, 0.8) // 79,2 / 80,8 en alternance
    const s = trendSeries(w)
    const raw = Math.max(...w.map((x) => x.kg)) - Math.min(...w.map((x) => x.kg))
    const smooth = Math.max(...s.slice(6).map((x) => x.avg7)) - Math.min(...s.slice(6).map((x) => x.avg7))
    expect(smooth).toBeLessThan(raw / 3)
    expect(trendWeight(w)).toBeCloseTo(80, 0)
  })
})

describe('Tendance par semaine', () => {
  it('mesure la pente (perte de 0,5 kg/semaine)', () => {
    expect(weeklyTrend(series(21, 80, -0.5 / 7), TODAY)).toBeCloseTo(-0.5, 1)
  })
  it('null sans données suffisantes', () => {
    expect(weeklyTrend(series(3, 80, -0.1), TODAY)).toBeNull()
  })
  it('projette la date au rythme observé', () => {
    expect(projectedDate(80, 78, -0.5, TODAY)).toBe(addDays(TODAY, 28))
    expect(projectedDate(80, 78, 0.2, TODAY)).toBeNull() // mauvais sens
  })
})

describe('Garde-fous', () => {
  it('perte > 1 %/semaine pendant 2 semaines → trop rapide', () => {
    // 80 kg, −1,2 kg par semaine = 1,5 %/semaine
    expect(isLosingTooFast(series(21, 80, -1.2 / 7), TODAY)).toBe(true)
    // −0,5 kg par semaine : rythme visé
    expect(isLosingTooFast(series(21, 80, -0.5 / 7), TODAY)).toBe(false)
  })
  it('une seule semaine rapide ne suffit pas', () => {
    const w = [...series(14, 80, 0, 0, addDays(TODAY, -7)), ...series(7, 78.8, -1.2 / 7)]
    expect(isLosingTooFast(w, TODAY)).toBe(false)
  })
  it('plateau : poids stable 2 semaines', () => {
    expect(isPlateau(series(16, 80, 0, 0.6), TODAY)).toBe(true)
    expect(isPlateau(series(16, 80, -0.07), TODAY)).toBe(false)
    expect(isPlateau(series(5, 80, 0), TODAY)).toBe(false) // pas assez de recul
  })
  it('objectif atteint dans le bon sens', () => {
    expect(goalReached(80, 75.2, 75)).toBe(true)
    expect(goalReached(80, 76, 75)).toBe(false)
    expect(goalReached(60, 64.8, 65)).toBe(true)
  })
})

describe('Régularité et rappel', () => {
  it('compte les pesées d’affilée sans trou de plus de 7 jours', () => {
    const w: WeighIn[] = [
      { date: '2026-10-01', kg: 80 },
      { date: '2026-10-20', kg: 79 },
      { date: '2026-10-27', kg: 79 },
      { date: '2026-11-03', kg: 78 },
      { date: '2026-11-10', kg: 78 },
    ]
    expect(weighInStreak(w, TODAY)).toBe(4)
    expect(weighInStreak(w, '2026-11-25')).toBe(0)
    expect(daysSinceLastWeighIn(w, TODAY)).toBe(5)
  })
})

describe('Coach', () => {
  const settings = { ...DEFAULT_SETTINGS, startWeightKg: 80, targetWeightKg: 75 } as ProfileSettings
  const situations = (w: WeighIn[], s: ProfileSettings = settings) => coachMessages('Alex', s, w, TODAY).map((m) => m.situation)

  it('au moins 3 versions par situation', () => {
    for (const def of Object.values(MESSAGES)) expect(def.variants.length).toBeGreaterThanOrEqual(3)
  })
  it('jamais de mot culpabilisant', () => {
    const vars = { name: 'Alex', days: 9, streak: 4, lostKg: '2 kg', targetKg: '75 kg' }
    const all = [...Object.values(MESSAGES).flatMap((d) => [d.title, ...d.variants.map((v) => v(vars))]), ...FAQ.flatMap((f) => [f.q, f.a])]
    for (const t of all) expect(t).not.toMatch(/échec|échoué|raté|mauvais|faute|honte|interdit|nul\b|triche/i)
  })
  it('varie selon le jour mais reste stable dans la journée', () => {
    const picks = new Set(Array.from({ length: 10 }, (_, i) => pickVariant('plateau', addDays(TODAY, i), 3)))
    expect(picks.size).toBeGreaterThan(1)
    expect(pickVariant('plateau', TODAY, 3)).toBe(pickVariant('plateau', TODAY, 3))
  })
  it('progression trop rapide en premier', () => {
    expect(situations(series(21, 80, -1.2 / 7))[0]).toBe('trop-rapide')
  })
  it('plateau → conseils et recalcul proposé', () => {
    const msgs = coachMessages('Alex', settings, series(16, 80, 0, 0.4), TODAY)
    const plateau = msgs.find((m) => m.situation === 'plateau')!
    expect(plateau.action).toBe('recalcul')
    expect(plateau.text).toMatch(/portions/)
  })
  it('objectif atteint → plan de maintien proposé', () => {
    const msgs = coachMessages('Alex', settings, series(10, 75.5, -0.05), TODAY)
    expect(msgs[0].situation).toBe('objectif-atteint')
    expect(msgs[0].action).toBe('maintien')
    expect(situations(series(10, 75.5, -0.05), { ...settings, maintenanceMode: true })).not.toContain('objectif-atteint')
  })
  it('rappel si aucune pesée depuis plus de 7 jours', () => {
    const w = [{ date: addDays(TODAY, -9), kg: 79 }]
    expect(situations(w)).toContain('rappel-pesee')
    expect(coachMessages('Alex', settings, w, TODAY).find((m) => m.situation === 'rappel-pesee')!.text).toMatch(/9 jours|plus d’une semaine/)
  })
  it('encourage la régularité', () => {
    expect(situations(series(5, 80, -0.05))).toContain('regularite')
  })
  it('message d’accueil au début', () => {
    expect(situations([{ date: TODAY, kg: 80 }])).toEqual(['bienvenue'])
  })
  it('FAQ avec les questions clés', () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(6)
    expect(FAQ.map((f) => f.q).join(' ')).toMatch(/monte d’un jour à l’autre/)
    expect(FAQ.map((f) => f.q).join(' ')).toMatch(/protéines/)
  })
})

describe('Résumé des 4 dernières semaines (accueil)', () => {
  it('ne garde que la période et mesure la variation de la moyenne', () => {
    const w = series(60, 85, -0.5 / 7)
    const { points, changeKg } = recentSummary(w, TODAY)
    expect(points[0].date >= addDays(TODAY, -28)).toBe(true)
    expect(changeKg).toBeCloseTo(-2, 0)
    expect(recentSummary([{ date: TODAY, kg: 80 }], TODAY).changeKg).toBeNull()
  })
})
