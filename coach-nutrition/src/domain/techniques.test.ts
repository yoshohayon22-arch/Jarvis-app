import { describe, expect, it } from 'vitest'
import { INGREDIENT_MAP, RECIPES, type Recipe } from './catalog'
import { computeTargets } from './nutrition'
import { isRecipeAllowed } from './restrictions'
import { DEFAULT_SETTINGS } from '../storage/migrations'
import type { ProfileSettings, TechniqueId, WeekPlan } from './types'
import { daySummary, generateWeek, KCAL_TOLERANCE, planLookup, type GeneratorContext } from './menu/generator'
import {
  activeTechnique,
  adaptedMeals,
  fitsTechnique,
  hasRedMeat,
  momentOfSlot,
  plateShares,
  proteinShare,
  TECHNIQUES,
  withTechnique,
} from './techniques'

const byId = new Map(RECIPES.map((r) => [r.id, r]))
const recipe = (id: string) => byId.get(id)!

function ctx(s: Partial<ProfileSettings>, seed = 1): GeneratorContext {
  const settings = { ...DEFAULT_SETTINGS, sex: 'femme', age: 36, heightCm: 168, targetWeightKg: 62, activityLevel: 3, ...s } as ProfileSettings
  const t = computeTargets(settings, 70)
  return { settings, targets: { kcal: t.targetKcal, proteinG: t.macros.proteinG, fatG: t.macros.fatG, carbsG: t.macros.carbsG }, recipes: RECIPES, ingredients: INGREDIENT_MAP, weekStart: '2026-11-16', seed, now: new Date('2026-11-15T10:00:00Z') }
}

/** Part des repas concernés par la technique qui la respectent, sur plusieurs semaines. */
function fitRate(technique: TechniqueId | null, judge: TechniqueId, s: Partial<ProfileSettings> = {}) {
  let fit = 0
  let total = 0
  for (const seed of [1, 2, 3, 4]) {
    const plan = generateWeek(ctx({ ...s, technique }, seed))
    const t = TECHNIQUES.find((x) => x.id === judge)!
    for (const d of plan.days) for (const m of d.meals) {
      const moment = momentOfSlot(m.slot)
      if (!t.moments.includes(moment)) continue
      total++
      if (fitsTechnique(recipe(m.recipeId), judge, moment, INGREDIENT_MAP)) fit++
    }
  }
  return fit / total
}

const kcalOk = (plan: WeekPlan) =>
  plan.days.every((d) => Math.abs(daySummary(d, planLookup(plan, RECIPES), false).kcal / plan.targets.kcal - 1) <= KCAL_TOLERANCE + 1e-9)

describe('Fiches des techniques', () => {
  it('4 techniques, chacune avec principe, conseils, effet sur le menu et source', () => {
    expect(TECHNIQUES.map((t) => t.id)).toEqual(['assiette', 'mediterraneen', 'proteines', 'jeune-16-8'])
    for (const t of TECHNIQUES) {
      expect(t.principle.length).toBeGreaterThan(80)
      expect(t.why.length).toBeGreaterThanOrEqual(2)
      expect(t.tips.length).toBeGreaterThanOrEqual(3)
      expect(t.effect).toBeTruthy()
      expect(t.source).toBeTruthy()
    }
  })
  it('l’assiette suit le modèle officiel suisse (2/5, 2/5, 1/5)', () => {
    expect(TECHNIQUES[0].tagline).toContain('2/5 de légumes et fruits, 2/5 de féculents, 1/5 de protéines')
  })
  it('le jeûne mentionne ses contre-indications, sans culpabiliser', () => {
    const j = TECHNIQUES.find((t) => t.id === 'jeune-16-8')!
    expect(j.caution).toMatch(/grossesse/)
    expect(j.caution).toMatch(/troubles du comportement alimentaire/)
    expect(j.tips.join(' ')).toMatch(/pas un échec/)
  })
})

describe('Classement des recettes', () => {
  it('calcule les proportions de l’assiette (féculents secs comptés cuits)', () => {
    const s = plateShares(recipe('saumon-pdt-brocoli'), INGREDIENT_MAP)
    expect(s.vegetables + s.starch + s.protein).toBeCloseTo(1)
    expect(s.vegetables).toBeGreaterThan(0.25)
    expect(s.starch).toBeGreaterThan(0.25)
    // Le riz sec compte 2,5 fois : un bowl riz-haricots n'est pas « surtout légumes ».
    expect(plateShares(recipe('bowl-mexicain'), INGREDIENT_MAP).starch).toBeGreaterThan(0.4)
  })
  it('assiette équilibrée : un plat avec beaucoup de légumes, un féculent et une protéine', () => {
    expect(fitsTechnique(recipe('couscous-legumes'), 'assiette', 'repas', INGREDIENT_MAP)).toBe(true)
    expect(fitsTechnique(recipe('alplermagronen'), 'assiette', 'repas', INGREDIENT_MAP)).toBe(false)
    expect(fitsTechnique(recipe('porridge-pomme-cannelle'), 'assiette', 'petit-dej', INGREDIENT_MAP)).toBe(true)
  })
  it('méditerranéen : jamais de viande rouge ni de charcuterie', () => {
    for (const r of RECIPES.filter((x) => x.mealTypes.includes('dejeuner'))) {
      if (hasRedMeat(r)) expect(fitsTechnique(r, 'mediterraneen', 'repas', INGREDIENT_MAP), r.id).toBe(false)
    }
    expect(fitsTechnique(recipe('saumon-teriyaki-riz'), 'mediterraneen', 'repas', INGREDIENT_MAP)).toBe(true)
    expect(fitsTechnique(recipe('papet-vaudois'), 'mediterraneen', 'repas', INGREDIENT_MAP)).toBe(false)
  })
  it('riche en protéines : au moins 28 % des calories en protéines pour un plat', () => {
    for (const r of RECIPES.filter((x) => x.mealTypes.includes('dejeuner'))) {
      expect(fitsTechnique(r, 'proteines', 'repas', INGREDIENT_MAP)).toBe(proteinShare(r) >= 0.28)
    }
  })
  it('chaque technique a assez de recettes pour varier une semaine', () => {
    const count = (id: TechniqueId, moment: 'petit-dej' | 'repas' | 'collation') =>
      RECIPES.filter((r) => !r.mealTypes.includes('base') && r.mealTypes.includes(moment === 'repas' ? 'dejeuner' : moment) && fitsTechnique(r, id, moment, INGREDIENT_MAP)).length
    expect(count('assiette', 'repas')).toBeGreaterThanOrEqual(25)
    expect(count('assiette', 'petit-dej')).toBeGreaterThanOrEqual(12)
    expect(count('mediterraneen', 'repas')).toBeGreaterThanOrEqual(40)
    expect(count('proteines', 'repas')).toBeGreaterThanOrEqual(15)
    expect(count('proteines', 'petit-dej')).toBeGreaterThanOrEqual(7)
    expect(count('jeune-16-8', 'repas')).toBeGreaterThanOrEqual(25)
  })
})

describe('Repas adaptés', () => {
  it('respectent la technique et les restrictions du profil, et changent avec la graine', () => {
    const p = { restrictions: ['casher', 'vegetarien'] as ProfileSettings['restrictions'], kosher: DEFAULT_SETTINGS.kosher, dislikedFoods: [] }
    const allowed = (r: Recipe) => isRecipeAllowed(r, p, INGREDIENT_MAP)
    for (const t of TECHNIQUES) {
      for (const moment of t.moments) {
        const meals = adaptedMeals(RECIPES, t.id, moment, INGREDIENT_MAP, allowed, 1)
        for (const r of meals) {
          expect(allowed(r), r.id).toBe(true)
          expect(fitsTechnique(r, t.id, moment, INGREDIENT_MAP), r.id).toBe(true)
        }
      }
    }
    const a = adaptedMeals(RECIPES, 'assiette', 'repas', INGREDIENT_MAP, () => true, 1).map((r) => r.id)
    const b = adaptedMeals(RECIPES, 'assiette', 'repas', INGREDIENT_MAP, () => true, 2).map((r) => r.id)
    expect(a).toHaveLength(3)
    expect(a).not.toEqual(b)
  })
})

describe('Appliquer une technique au profil', () => {
  const base = { ...DEFAULT_SETTINGS, mealsPerDay: 4 } as ProfileSettings
  it('le jeûne 16:8 passe à 2 repas et rétablit le nombre d’avant quand on le retire', () => {
    const on = withTechnique(base, 'jeune-16-8')
    expect(on.mealsPerDay).toBe(2)
    expect(activeTechnique(on)).toBe('jeune-16-8')
    const off = withTechnique(on, null)
    expect(off.mealsPerDay).toBe(4)
    expect(activeTechnique(off)).toBeNull()
    // Passer du jeûne à une autre technique rétablit aussi les repas.
    expect(withTechnique(on, 'mediterraneen').mealsPerDay).toBe(4)
  })
  it('le jeûne n’est plus actif si on repasse à 3 repas dans le profil', () => {
    expect(activeTechnique({ technique: 'jeune-16-8', mealsPerDay: 3 })).toBeNull()
  })
  it('les autres techniques ne touchent pas au nombre de repas', () => {
    expect(withTechnique(base, 'assiette').mealsPerDay).toBe(4)
  })
})

describe('Effet sur le menu de la semaine', () => {
  it('assiette équilibrée : nettement plus de repas qui respectent les proportions', () => {
    const without = fitRate(null, 'assiette')
    const withT = fitRate('assiette', 'assiette')
    expect(withT).toBeGreaterThan(without + 0.2)
    expect(withT).toBeGreaterThanOrEqual(0.6)
  })
  it('riche en protéines : plus de repas riches en protéines', () => {
    expect(fitRate('proteines', 'proteines')).toBeGreaterThan(fitRate(null, 'proteines') + 0.15)
  })
  it('méditerranéen : viande rouge au plus 1 fois par semaine, majorité de plats méditerranéens', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const plan = generateWeek(ctx({ technique: 'mediterraneen' }, seed))
      const mains = plan.days.flatMap((d) => d.meals.filter((m) => m.slot === 'dejeuner' || m.slot === 'diner'))
      expect(mains.filter((m) => hasRedMeat(recipe(m.recipeId))).length).toBeLessThanOrEqual(1)
    }
    expect(fitRate('mediterraneen', 'mediterraneen')).toBeGreaterThanOrEqual(0.75)
  })
  it('jeûne 16:8 : 2 repas par jour, copieux', () => {
    const plan = generateWeek(ctx(withTechnique({ ...DEFAULT_SETTINGS, sex: 'femme', age: 36, heightCm: 168, targetWeightKg: 62, activityLevel: 3 } as ProfileSettings, 'jeune-16-8')))
    expect(plan.technique).toBe('jeune-16-8')
    for (const d of plan.days) expect(d.meals.map((m) => m.slot)).toEqual(['dejeuner', 'diner'])
  })
  it('les calories restent dans ±5 % chaque jour, quelle que soit la technique, même avec des restrictions', () => {
    for (const t of TECHNIQUES) {
      for (const s of [{}, { restrictions: ['casher', 'sans-gluten'] }, { restrictions: ['vegetarien'], mealsPerDay: 4 }] as Partial<ProfileSettings>[]) {
        const settings = withTechnique({ ...DEFAULT_SETTINGS, sex: 'femme', age: 36, heightCm: 168, targetWeightKg: 62, activityLevel: 3, ...s } as ProfileSettings, t.id)
        const plan = generateWeek(ctx(settings, 7))
        expect(kcalOk(plan), `${t.id} ${JSON.stringify(s)}`).toBe(true)
        expect(plan.technique).toBe(t.id)
      }
    }
  })
})
