import { describe, expect, it } from 'vitest'
import {
  CALORIE_FLOOR,
  computeBmi,
  computeBmr,
  computeDeficit,
  computeMacros,
  computeSurplus,
  computeTargets,
  computeTdee,
  determineGoal,
  estimateGoalDate,
  macrosToKcal,
  referenceWeight,
  weightForBmi,
  addDays,
} from './nutrition'
import type { ProfileSettings } from './types'

/** Profil de base réutilisé dans les tests (homme 30 ans, 180 cm, modérément actif). */
const base: Pick<
  ProfileSettings,
  'sex' | 'age' | 'heightCm' | 'targetWeightKg' | 'activityLevel' | 'gainSurplusKcal' | 'maintenanceMode'
> = {
  sex: 'homme',
  age: 30,
  heightCm: 180,
  targetWeightKg: 75,
  activityLevel: 3,
  gainSurplusKcal: 300,
  maintenanceMode: false,
}

describe('Métabolisme de base (Mifflin-St Jeor)', () => {
  it('calcule le BMR d’un homme', () => {
    // 10×80 + 6,25×180 − 5×30 + 5 = 1780
    expect(computeBmr('homme', 80, 180, 30)).toBe(1780)
  })
  it('calcule le BMR d’une femme', () => {
    // 10×60 + 6,25×165 − 5×30 − 161 = 1320,25
    expect(computeBmr('femme', 60, 165, 30)).toBeCloseTo(1320.25)
  })
  it('l’écart homme/femme est de 166 kcal à paramètres égaux', () => {
    expect(computeBmr('homme', 70, 170, 40) - computeBmr('femme', 70, 170, 40)).toBe(166)
  })
})

describe('Dépense totale (TDEE)', () => {
  it('applique les 5 facteurs d’activité', () => {
    expect(computeTdee(1000, 1)).toBeCloseTo(1200)
    expect(computeTdee(1000, 2)).toBeCloseTo(1375)
    expect(computeTdee(1000, 3)).toBeCloseTo(1550)
    expect(computeTdee(1000, 4)).toBeCloseTo(1725)
    expect(computeTdee(1000, 5)).toBeCloseTo(1900)
  })
})

describe('IMC', () => {
  it('calcule l’IMC et le poids pour un IMC donné', () => {
    expect(computeBmi(70, 175)).toBeCloseTo(22.86, 2)
    expect(weightForBmi(25, 175)).toBeCloseTo(76.5625)
  })
})

describe('Déficit et surplus', () => {
  it('vise 0,5 % du poids par semaine (80 kg → 440 kcal/j)', () => {
    expect(computeDeficit(80)).toBeCloseTo(440)
  })
  it('ne descend jamais sous 300 kcal de déficit', () => {
    expect(computeDeficit(50)).toBe(300)
  })
  it('ne dépasse jamais 500 kcal de déficit', () => {
    expect(computeDeficit(130)).toBe(500)
  })
  it('borne le surplus entre 250 et 400 kcal', () => {
    expect(computeSurplus(100)).toBe(250)
    expect(computeSurplus(320)).toBe(320)
    expect(computeSurplus(900)).toBe(400)
    expect(computeSurplus()).toBe(300)
  })
})

describe('Objectif', () => {
  it('détecte perte, prise et maintien', () => {
    expect(determineGoal(80, 75)).toBe('perte')
    expect(determineGoal(60, 65)).toBe('prise')
    expect(determineGoal(70, 70.3)).toBe('maintien')
    expect(determineGoal(80, 75, true)).toBe('maintien')
  })
})

describe('Poids de référence', () => {
  it('utilise le poids réel si IMC < 30', () => {
    expect(referenceWeight(80, 180)).toBe(80)
  })
  it('utilise le poids à IMC 25 si IMC ≥ 30', () => {
    // 120 kg / 1,75 m → IMC 39 → référence 76,56 kg
    expect(referenceWeight(120, 175)).toBeCloseTo(76.5625)
  })
})

describe('Macros', () => {
  it('respecte protéines 1,6–2 g/kg et lipides ≥ 0,8 g/kg', () => {
    const m = computeMacros(2300, 80, 'perte')
    expect(m.proteinG).toBe(160) // 2,0 g/kg
    expect(m.fatG).toBeGreaterThanOrEqual(64) // 0,8 g/kg
    expect(m.fatG * 9).toBeGreaterThanOrEqual(2300 * 0.2 - 9) // ≥ 20 % des kcal
    expect(m.carbsG).toBeGreaterThan(0)
  })
  it('la somme des macros retombe sur les calories visées (± arrondis)', () => {
    for (const kcal of [1200, 1500, 2000, 2800, 3500]) {
      const m = computeMacros(kcal, 70, 'maintien')
      expect(Math.abs(macrosToKcal(m) - kcal)).toBeLessThanOrEqual(15)
    }
  })
  it('n’a jamais de glucides négatifs même avec des calories très basses', () => {
    const m = computeMacros(1200, 100, 'perte')
    expect(m.carbsG).toBeGreaterThanOrEqual(0)
    expect(m.proteinG).toBeGreaterThanOrEqual(160) // jamais sous 1,6 g/kg
    expect(m.fatG).toBeGreaterThanOrEqual(80)
  })
})

describe('Date estimée', () => {
  it('calcule le nombre de jours avec 7700 kcal/kg', () => {
    // 5 kg × 7700 / 440 = 87,5 → 88 jours
    expect(estimateGoalDate(80, 75, -440, '2026-01-01')).toBe(addDays('2026-01-01', 88))
    expect(addDays('2026-01-01', 88)).toBe('2026-03-30')
  })
  it('renvoie null si l’écart journalier est trop faible', () => {
    expect(estimateGoalDate(80, 75, -10, '2026-01-01')).toBeNull()
  })
})

describe('computeTargets — scénarios complets', () => {
  it('homme 80 kg → 75 kg, modérément actif', () => {
    const t = computeTargets(base, 80, '2026-01-01')
    expect(t.bmr).toBe(1780)
    expect(t.tdee).toBe(2759)
    expect(t.goal).toBe('perte')
    expect(t.targetKcal).toBe(2320)
    expect(t.floorApplied).toBe(false)
    expect(t.adjustmentKcal).toBeLessThanOrEqual(-300)
    expect(t.adjustmentKcal).toBeGreaterThanOrEqual(-500)
    expect(t.expectedWeeklyChangeKg).toBeCloseTo(-0.4, 1)
    expect(t.estimatedGoalDate).toBe('2026-03-30')
  })

  it('applique le plancher de 1200 kcal pour une femme', () => {
    // Femme 60 ans, 155 cm, 50 kg, sédentaire : TDEE ≈ 1209 kcal ; TDEE − 300 = 909 → plancher 1200
    const t = computeTargets(
      { ...base, sex: 'femme', age: 60, heightCm: 155, targetWeightKg: 47, activityLevel: 1 },
      50,
      '2026-01-01',
    )
    expect(t.targetKcal).toBe(CALORIE_FLOOR.femme)
    expect(t.floorApplied).toBe(true)
    // Le déficit réel devient trop faible : pas de date fiable, plutôt que d’en inventer une.
    expect(t.estimatedGoalDate).toBeNull()
  })

  it('applique le plancher de 1500 kcal pour un homme', () => {
    const t = computeTargets(
      { ...base, age: 75, heightCm: 160, targetWeightKg: 50, activityLevel: 1 },
      55,
      '2026-01-01',
    )
    expect(t.targetKcal).toBeGreaterThanOrEqual(CALORIE_FLOOR.homme)
    expect(t.floorApplied).toBe(true)
  })

  it('ne descend jamais sous les planchers, quel que soit le profil', () => {
    for (const sex of ['homme', 'femme'] as const) {
      for (const w of [40, 50, 60, 80, 120]) {
        for (const age of [18, 40, 70, 90]) {
          const t = computeTargets({ ...base, sex, age, heightCm: 150, targetWeightKg: 39 }, w)
          expect(t.targetKcal).toBeGreaterThanOrEqual(CALORIE_FLOOR[sex])
        }
      }
    }
  })

  it('prise de poids : surplus de 300 kcal par défaut', () => {
    const t = computeTargets(
      { ...base, age: 25, heightCm: 175, targetWeightKg: 66, activityLevel: 2 },
      60,
    )
    expect(t.goal).toBe('prise')
    expect(t.targetKcal).toBe(2460)
    expect(t.adjustmentKcal).toBeGreaterThanOrEqual(250)
    expect(t.adjustmentKcal).toBeLessThanOrEqual(400)
    expect(t.estimatedGoalDate).not.toBeNull()
  })

  it('maintien : calories = TDEE et pas de date estimée', () => {
    const t = computeTargets({ ...base, maintenanceMode: true }, 80)
    expect(t.goal).toBe('maintien')
    expect(Math.abs(t.targetKcal - t.tdee)).toBeLessThanOrEqual(5)
    expect(t.estimatedGoalDate).toBeNull()
    expect(t.expectedWeeklyChangeKg).toBe(0)
  })

  it('recalcule la date à chaque nouvelle pesée (poids plus bas → date plus proche)', () => {
    const before = computeTargets(base, 80, '2026-01-01')
    const after = computeTargets(base, 78, '2026-01-01')
    expect(after.estimatedGoalDate! < before.estimatedGoalDate!).toBe(true)
  })

  it('IMC ≥ 30 : protéines calculées sur le poids à IMC 25', () => {
    const t = computeTargets({ ...base, heightCm: 175, targetWeightKg: 90 }, 120)
    expect(t.referenceWeightKg).toBeCloseTo(76.6, 1)
    expect(t.macros.proteinG).toBe(153) // 76,56 × 2,0
  })
})
