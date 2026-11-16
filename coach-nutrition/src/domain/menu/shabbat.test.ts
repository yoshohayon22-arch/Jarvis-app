import { describe, expect, it } from 'vitest'
import { INGREDIENT_MAP, RECIPES } from '../catalog'
import { computeTargets } from '../nutrition'
import { canFollow, isRecipeAllowed, mealKashrut } from '../restrictions'
import { DEFAULT_SETTINGS } from '../../storage/migrations'
import type { DayOfWeek, ProfileSettings } from '../types'
import { daySummary, generateWeek, KCAL_TOLERANCE, planLookup, replaceMeal, type GeneratorContext } from './generator'
import { allowedOnShabbat, dayShares, effectiveSessionDays, festiveTag, FRIDAY, SATURDAY } from './shabbat'
import { KCAL_SHARE, SLOT_HOUR, SLOTS_BY_COUNT } from './slots'
import { shoppingReminders } from '../restrictions'

const SHABBAT = { enabled: true, festiveMeals: true, noCookingSaturday: true }

function ctx(s: Partial<ProfileSettings>, seed = 1): GeneratorContext {
  const settings = { ...DEFAULT_SETTINGS, sex: 'homme', age: 34, heightCm: 178, targetWeightKg: 78, activityLevel: 3, mealsPerDay: 3, restrictions: ['casher'], shabbat: SHABBAT, ...s } as ProfileSettings
  const t = computeTargets(settings, 86)
  return { settings, targets: { kcal: t.targetKcal, proteinG: t.macros.proteinG, fatG: t.macros.fatG, carbsG: t.macros.carbsG }, recipes: RECIPES, ingredients: INGREDIENT_MAP, weekStart: '2026-11-16', seed, now: new Date('2026-11-16T10:00:00Z') }
}

describe('Règles du Shabbat', () => {
  it('repère les repas de fête : vendredi soir et samedi midi', () => {
    const s = { shabbat: SHABBAT }
    expect(festiveTag(s, FRIDAY, 'diner')).toBe('shabbat-soir')
    expect(festiveTag(s, SATURDAY, 'dejeuner')).toBe('shabbat-midi')
    expect(festiveTag(s, FRIDAY, 'dejeuner')).toBeNull()
    expect(festiveTag({ shabbat: { ...SHABBAT, enabled: false } }, FRIDAY, 'diner')).toBeNull()
  })
  it('le repas de fête reçoit 10 % de plus, pris sur les autres repas (total inchangé)', () => {
    const slots = SLOTS_BY_COUNT[3]
    const sh = dayShares(KCAL_SHARE[3], slots, { shabbat: SHABBAT }, FRIDAY)
    expect(sh.diner).toBeCloseTo(0.45)
    expect(Object.values(sh).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
    expect(dayShares(KCAL_SHARE[3], slots, { shabbat: SHABBAT }, 1)).toEqual(KCAL_SHARE[3])
    // Jeûne intermittent : +5 % seulement
    expect(dayShares(KCAL_SHARE[2], SLOTS_BY_COUNT[2], { shabbat: SHABBAT }, FRIDAY).diner).toBeCloseTo(0.6)
  })
  it('samedi sans cuisson : seulement des plats préparés la veille ou sans cuisson', () => {
    const s = { shabbat: SHABBAT }
    const porridge = RECIPES.find((r) => r.id === 'porridge-pomme-cannelle')!
    const overnight = RECIPES.find((r) => r.id === 'overnight-oats-baies')!
    const cholent = RECIPES.find((r) => r.id === 'cholent')!
    expect(allowedOnShabbat(porridge, s, SATURDAY)).toBe(false)
    expect(allowedOnShabbat(porridge, s, FRIDAY)).toBe(true)
    expect(allowedOnShabbat(overnight, s, SATURDAY)).toBe(true)
    expect(allowedOnShabbat(cholent, s, SATURDAY)).toBe(true)
  })
  it('pas de session de batch le samedi', () => {
    expect(effectiveSessionDays({ shabbat: SHABBAT, batch: { enabled: true, sessionDays: [5, 2] as DayOfWeek[] } })).toEqual([2])
  })
  it('rappel Shabbat dans la liste de courses', () => {
    expect(shoppingReminders(['casher'], true).join(' ')).toMatch(/challah.*kiddouch/)
  })
})

describe('Menu avec Shabbat', () => {
  const PROFILES: [string, Partial<ProfileSettings>][] = [
    ['casher, 3 repas', {}],
    ['casher, 4 repas, délai 6 h', { mealsPerDay: 4, kosher: { waitAfterMeatHours: 6, separateFishAndMeat: true } }],
    ['casher végétarien, 5 repas', { mealsPerDay: 5, restrictions: ['casher', 'vegetarien'] }],
    ['casher, jeûne intermittent (2 repas)', { mealsPerDay: 2 }],
    ['casher + batch vendredi', { batch: { enabled: true, sessionDays: [4, 5] as DayOfWeek[] } }],
  ]
  for (const [name, s] of PROFILES) {
    for (const seed of [1, 5]) {
      const c = ctx(s, seed)
      const plan = generateWeek(c)
      const byId = planLookup(plan, RECIPES)
      const recipeAt = (day: number, slot: string) => byId.get(plan.days[day].meals.find((m) => m.slot === slot)!.recipeId)!

      it(`${name} (graine ${seed}) : repas de fête traditionnels`, () => {
        const friday = recipeAt(FRIDAY, 'diner')
        const saturday = recipeAt(SATURDAY, 'dejeuner')
        expect(friday.tags, friday.id).toContain('shabbat-soir')
        expect(saturday.tags, saturday.id).toContain('shabbat-midi')
      })

      it(`${name} (graine ${seed}) : rien n’est cuisiné le samedi`, () => {
        for (const m of plan.days[SATURDAY].meals) {
          expect(allowedOnShabbat(byId.get(m.recipeId)!, c.settings, SATURDAY), m.recipeId).toBe(true)
        }
      })

      it(`${name} (graine ${seed}) : calories à ±5 %, casher et délai respectés`, () => {
        for (const d of plan.days) {
          expect(Math.abs(daySummary(d, byId, plan.lowBudget).kcal / c.targets.kcal - 1)).toBeLessThanOrEqual(KCAL_TOLERANCE)
          for (const m of d.meals) {
            const r = byId.get(m.recipeId)!
            expect(isRecipeAllowed(r, c.settings, INGREDIENT_MAP), r.id).toBe(true)
            expect(mealKashrut([r], INGREDIENT_MAP)).not.toBe('non-casher')
          }
        }
        const seq = plan.days.flatMap((d, i) => d.meals.map((m) => ({ h: SLOT_HOUR[m.slot] + 24 * i, k: byId.get(m.recipeId)!.kashrut })))
        for (let i = 1; i < seq.length; i++) expect(canFollow(seq[i - 1].k, seq[i].k, seq[i].h - seq[i - 1].h, c.settings.kosher.waitAfterMeatHours)).toBe(true)
      })
    }
  }

  it('le repas de Shabbat est le plus copieux du vendredi', () => {
    const c = ctx({}, 3)
    const plan = generateWeek(c)
    const byId = planLookup(plan, RECIPES)
    const kcal = plan.days[FRIDAY].meals.map((m) => ({ slot: m.slot, k: byId.get(m.recipeId)!.perServing.kcal * m.portions }))
    const dinner = kcal.find((x) => x.slot === 'diner')!.k
    expect(dinner).toBe(Math.max(...kcal.map((x) => x.k)))
  })

  it('« remplacer » le repas de Shabbat propose un autre plat traditionnel', () => {
    const c = ctx({}, 2)
    const plan = generateWeek(c)
    const next = replaceMeal(plan, c, FRIDAY, 'diner', 1)
    const byId = planLookup(next, RECIPES)
    const r = byId.get(next.days[FRIDAY].meals.find((m) => m.slot === 'diner')!.recipeId)!
    expect(r.tags).toContain('shabbat-soir')
  })
})

describe('Jeûne intermittent (2 repas)', () => {
  it('déjeuner + dîner seulement, calories à ±5 % chaque jour', () => {
    for (const seed of [1, 4, 9]) {
      const c = ctx({ mealsPerDay: 2, restrictions: [], shabbat: { ...SHABBAT, enabled: false } }, seed)
      const plan = generateWeek(c)
      const byId = planLookup(plan, RECIPES)
      for (const d of plan.days) {
        expect(d.meals.map((m) => m.slot)).toEqual(['dejeuner', 'diner'])
        expect(Math.abs(daySummary(d, byId, plan.lowBudget).kcal / c.targets.kcal - 1)).toBeLessThanOrEqual(KCAL_TOLERANCE)
      }
    }
  })
})

describe('Délai de 4 heures entre lait et viande', () => {
  it('viande → lait : 4 h minimum', () => {
    expect(canFollow('bassari', 'halavi', 3.5, 4)).toBe(false) // déjeuner 12h30 → collation 16h
    expect(canFollow('bassari', 'halavi', 4, 4)).toBe(true)
  })
  it('lait → viande : seulement si l’option est activée', () => {
    expect(canFollow('halavi', 'bassari', 2.5, 4)).toBe(true)
    expect(canFollow('halavi', 'bassari', 2.5, 4, true)).toBe(false) // collation 10h → déjeuner 12h30
    expect(canFollow('halavi', 'bassari', 5, 4, true)).toBe(true) // petit-déjeuner 7h30 → déjeuner 12h30
  })
  for (const waitAfterMilk of [false, true]) {
    for (const seed of [1, 3, 8]) {
      it(`menu de 5 repas, délai 4 h${waitAfterMilk ? ' dans les deux sens' : ''} (graine ${seed})`, () => {
        const c = ctx({ mealsPerDay: 5, kosher: { waitAfterMeatHours: 4, separateFishAndMeat: true, waitAfterMilk } }, seed)
        const plan = generateWeek(c)
        const byId = planLookup(plan, RECIPES)
        const seq = plan.days.flatMap((d, i) => d.meals.map((m) => ({ h: SLOT_HOUR[m.slot] + 24 * i, k: byId.get(m.recipeId)!.kashrut, id: m.recipeId })))
        for (let i = 1; i < seq.length; i++) {
          expect(canFollow(seq[i - 1].k, seq[i].k, seq[i].h - seq[i - 1].h, 4, waitAfterMilk), `${seq[i - 1].id} → ${seq[i].id}`).toBe(true)
        }
        for (const d of plan.days) {
          expect(Math.abs(daySummary(d, byId, plan.lowBudget).kcal / c.targets.kcal - 1)).toBeLessThanOrEqual(KCAL_TOLERANCE)
        }
      })
    }
  }
})
