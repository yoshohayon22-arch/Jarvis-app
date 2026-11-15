import { describe, expect, it } from 'vitest'
import { INGREDIENT_MAP, RECIPES, type Recipe } from '../catalog'
import { computeTargets } from '../nutrition'
import { canFollow, isRecipeAllowed, mealKashrut, recipeTags } from '../restrictions'
import { DEFAULT_SETTINGS } from '../../storage/migrations'
import type { ProfileSettings, WeekPlan } from '../types'
import {
  daySummary,
  generateWeek,
  KCAL_TOLERANCE,
  MAX_USES_PER_WEEK,
  mondayOf,
  planningWeekStart,
  refitPortions,
  targetsChanged,
  replaceMeal,
  toggleLock,
  weekSummary,
  type GeneratorContext,
} from './generator'
import { SLOT_HOUR } from './slots'

const byId = new Map<string, Recipe>(RECIPES.map((r) => [r.id, r]))

function context(s: Partial<ProfileSettings>, weightKg: number, seed = 1): GeneratorContext {
  const settings = { ...DEFAULT_SETTINGS, ...s } as ProfileSettings
  const t = computeTargets(settings, weightKg)
  return {
    settings,
    targets: { kcal: t.targetKcal, proteinG: t.macros.proteinG, fatG: t.macros.fatG, carbsG: t.macros.carbsG },
    recipes: RECIPES,
    ingredients: INGREDIENT_MAP,
    weekStart: '2026-11-16',
    seed,
    now: new Date('2026-11-15T10:00:00Z'),
  }
}

const PROFILES: Record<string, [Partial<ProfileSettings>, number]> = {
  'homme, perte, 3 repas': [{ sex: 'homme', age: 34, heightCm: 180, targetWeightKg: 75, activityLevel: 3, mealsPerDay: 3 }, 80],
  'femme au plancher 1200 kcal, 5 repas': [{ sex: 'femme', age: 60, heightCm: 155, targetWeightKg: 47, activityLevel: 1, mealsPerDay: 5 }, 50],
  'casher + sans gluten, 4 repas': [{ sex: 'femme', age: 32, heightCm: 165, targetWeightKg: 62, activityLevel: 3, mealsPerDay: 4, restrictions: ['casher', 'sans-gluten'], dislikedFoods: ['champignons'] }, 68],
  'halal, prise de masse, 5 repas': [{ sex: 'homme', age: 25, heightCm: 175, targetWeightKg: 70, activityLevel: 4, mealsPerDay: 5, restrictions: ['halal'] }, 64],
  'végétarien petit budget, 4 repas': [{ sex: 'femme', age: 40, heightCm: 170, targetWeightKg: 65, activityLevel: 2, mealsPerDay: 4, restrictions: ['vegetarien'], lowBudget: true }, 72],
  'homme IMC 39, 4 repas': [{ sex: 'homme', age: 45, heightCm: 175, targetWeightKg: 95, activityLevel: 2, mealsPerDay: 4 }, 120],
}
const SEEDS = [1, 7, 2026]

const plans: { name: string; ctx: GeneratorContext; plan: WeekPlan }[] = []
for (const [name, [s, w]] of Object.entries(PROFILES)) {
  for (const seed of SEEDS) {
    const ctx = context(s, w, seed)
    plans.push({ name: `${name} (graine ${seed})`, ctx, plan: generateWeek(ctx) })
  }
}

describe('Générateur de menu — structure', () => {
  it('7 jours consécutifs à partir du lundi, avec le bon nombre de repas', () => {
    for (const { name, ctx, plan } of plans) {
      expect(plan.days, name).toHaveLength(7)
      expect(plan.days[0].date).toBe('2026-11-16')
      expect(plan.days[6].date).toBe('2026-11-22')
      for (const d of plan.days) expect(d.meals, name).toHaveLength(ctx.settings.mealsPerDay)
    }
  })
  it('est reproductible : même graine → même menu', () => {
    const ctx = context(PROFILES['homme, perte, 3 repas'][0], 80, 99)
    expect(generateWeek(ctx).days).toEqual(generateWeek(ctx).days)
  })
  it('trouve le lundi de la semaine', () => {
    expect(mondayOf('2026-11-15')).toBe('2026-11-09') // dimanche
    expect(mondayOf('2026-11-16')).toBe('2026-11-16') // lundi
    expect(mondayOf('2026-11-19')).toBe('2026-11-16')
  })
})

describe('Générateur de menu — calories et macros', () => {
  it('chaque jour reste dans ±5 % des calories visées, pour tous les profils', () => {
    for (const { name, ctx, plan } of plans) {
      plan.days.forEach((d, i) => {
        const kcal = daySummary(d, byId, plan.lowBudget).kcal
        const err = kcal / ctx.targets.kcal - 1
        expect(Math.abs(err), `${name}, jour ${i + 1} : ${Math.round(kcal)} kcal pour ${ctx.targets.kcal}`).toBeLessThanOrEqual(KCAL_TOLERANCE)
      })
    }
  })

  it('les macros de la semaine sont proches des cibles (profils omnivores)', () => {
    for (const { name, ctx, plan } of plans.filter((p) => !p.ctx.settings.restrictions.includes('vegetarien'))) {
      const w = weekSummary(plan, byId)
      expect(Math.abs(w.protein / ctx.targets.proteinG - 1), `${name} protéines`).toBeLessThanOrEqual(0.07)
      expect(Math.abs(w.fat / ctx.targets.fatG - 1), `${name} lipides`).toBeLessThanOrEqual(0.1)
      expect(Math.abs(w.carbs / ctx.targets.carbsG - 1), `${name} glucides`).toBeLessThanOrEqual(0.1)
    }
  })

  it('portions raisonnables (entre 0,5 et 3,2 portions)', () => {
    for (const { plan } of plans) {
      for (const d of plan.days) for (const m of d.meals) {
        expect(m.portions).toBeGreaterThanOrEqual(0.5)
        expect(m.portions).toBeLessThanOrEqual(3.2)
      }
    }
  })
})

describe('Générateur de menu — restrictions', () => {
  it('ne propose que des recettes autorisées pour le profil', () => {
    for (const { name, ctx, plan } of plans) {
      for (const d of plan.days) for (const m of d.meals) {
        expect(isRecipeAllowed(byId.get(m.recipeId)!, ctx.settings, INGREDIENT_MAP), `${name} : ${m.recipeId}`).toBe(true)
      }
    }
  })

  it('un menu casher ne contient jamais de viande et de lait dans le même repas', () => {
    for (const { name, plan } of plans.filter((p) => p.ctx.settings.restrictions.includes('casher'))) {
      for (const d of plan.days) for (const m of d.meals) {
        const recipe = byId.get(m.recipeId)!
        expect(mealKashrut([recipe], INGREDIENT_MAP), `${name} ${d.date} ${m.slot}`).not.toBe('non-casher')
        const t = recipeTags(recipe, INGREDIENT_MAP)
        expect((t.has('viande') || t.has('volaille')) && t.has('lait'), `${name} ${m.recipeId}`).toBe(false)
      }
    }
  })

  it('casher : respecte le délai d’attente après un repas bassari, y compris du dîner au petit-déjeuner', () => {
    for (const wait of [6, 3, 1] as const) {
      for (const seed of SEEDS) {
        const ctx = context({ ...PROFILES['casher + sans gluten, 4 repas'][0], mealsPerDay: 5, kosher: { waitAfterMeatHours: wait, separateFishAndMeat: true } }, 68, seed)
        const plan = generateWeek(ctx)
        const sequence = plan.days.flatMap((d, di) => d.meals.map((m) => ({ hour: SLOT_HOUR[m.slot] + di * 24, kashrut: byId.get(m.recipeId)!.kashrut })))
        for (let i = 1; i < sequence.length; i++) {
          const gap = sequence[i].hour - sequence[i - 1].hour
          expect(canFollow(sequence[i - 1].kashrut, sequence[i].kashrut, gap, wait), `délai ${wait} h, repas ${i}`).toBe(true)
        }
      }
    }
  })

  it('halal : jamais de porc, d’alcool ni de dérivés', () => {
    for (const { plan } of plans.filter((p) => p.ctx.settings.restrictions.includes('halal'))) {
      for (const d of plan.days) for (const m of d.meals) {
        const t = recipeTags(byId.get(m.recipeId)!, INGREDIENT_MAP)
        expect(t.has('porc') || t.has('alcool') || t.has('gelatine-porcine') || t.has('saindoux')).toBe(false)
      }
    }
  })
})

describe('Générateur de menu — variété', () => {
  it('jamais deux fois la même recette le même jour', () => {
    for (const { name, plan } of plans) {
      for (const d of plan.days) {
        const ids = d.meals.map((m) => m.recipeId)
        expect(new Set(ids).size, `${name} ${d.date}`).toBe(ids.length)
      }
    }
  })
  it('au maximum 3 fois la même recette par semaine (hors batch)', () => {
    for (const { name, plan } of plans) {
      const count = new Map<string, number>()
      plan.days.forEach((d) => d.meals.forEach((m) => count.set(m.recipeId, (count.get(m.recipeId) ?? 0) + 1)))
      for (const [id, n] of count) expect(n, `${name} : ${id}`).toBeLessThanOrEqual(MAX_USES_PER_WEEK)
    }
  })
  it('les plats de batch peuvent revenir plus souvent si le batch cooking est activé', () => {
    const ctx = context({ ...PROFILES['homme, perte, 3 repas'][0], batch: { enabled: true, sessionDays: [6] } }, 80)
    const plan = generateWeek(ctx)
    const count = new Map<string, number>()
    plan.days.forEach((d) => d.meals.forEach((m) => count.set(m.recipeId, (count.get(m.recipeId) ?? 0) + 1)))
    for (const [id, n] of count) {
      if (n > MAX_USES_PER_WEEK) expect(byId.get(id)!.tags).toContain('batch-friendly')
    }
  })
})

describe('Remplacer et verrouiller', () => {
  const ctx = context(PROFILES['casher + sans gluten, 4 repas'][0], 68, 5)
  const plan = generateWeek(ctx)

  it('« remplacer ce plat » propose une autre recette compatible et garde la journée dans ±5 %', () => {
    for (let variant = 0; variant < 5; variant++) {
      const next = replaceMeal(plan, ctx, 2, 'dejeuner', variant)
      const before = plan.days[2].meals.find((m) => m.slot === 'dejeuner')!.recipeId
      const after = next.days[2].meals.find((m) => m.slot === 'dejeuner')!.recipeId
      expect(after).not.toBe(before)
      expect(isRecipeAllowed(byId.get(after)!, ctx.settings, INGREDIENT_MAP)).toBe(true)
      const kcal = daySummary(next.days[2], byId, next.lowBudget).kcal
      expect(Math.abs(kcal / ctx.targets.kcal - 1)).toBeLessThanOrEqual(KCAL_TOLERANCE)
      // Les autres jours ne bougent pas.
      expect(next.days[0]).toEqual(plan.days[0])
    }
  })

  it('les plats verrouillés sont conservés lors d’une régénération', () => {
    let locked = toggleLock(plan, 0, 'diner')
    locked = toggleLock(locked, 4, 'petit-dej')
    const regenerated = generateWeek({ ...ctx, seed: 777 }, { previous: locked })
    expect(regenerated.days[0].meals.find((m) => m.slot === 'diner')!.recipeId).toBe(plan.days[0].meals.find((m) => m.slot === 'diner')!.recipeId)
    expect(regenerated.days[4].meals.find((m) => m.slot === 'petit-dej')!.recipeId).toBe(plan.days[4].meals.find((m) => m.slot === 'petit-dej')!.recipeId)
    expect(regenerated.days[0].meals.find((m) => m.slot === 'diner')!.locked).toBe(true)
    // Le reste du menu a changé.
    expect(regenerated.days.flatMap((d) => d.meals.map((m) => m.recipeId))).not.toEqual(plan.days.flatMap((d) => d.meals.map((m) => m.recipeId)))
  })
})

describe('Petit budget', () => {
  it('le mode petit budget coûte nettement moins cher que le mode normal', () => {
    for (const seed of SEEDS) {
      const base = PROFILES['homme, perte, 3 repas'][0]
      const normal = generateWeek(context({ ...base, lowBudget: false }, 80, seed))
      const budget = generateWeek(context({ ...base, lowBudget: true }, 80, seed))
      const cNormal = weekSummary({ ...normal, lowBudget: true }, byId).costChf // même grille de prix pour comparer
      const cBudget = weekSummary(budget, byId).costChf
      expect(cBudget, `graine ${seed}`).toBeLessThan(cNormal * 0.85)
    }
  })

  it('respecte le budget hebdomadaire quand il est réaliste', () => {
    const ctx = context({ ...PROFILES['homme, perte, 3 repas'][0], lowBudget: true, weeklyBudgetChf: 60 }, 80)
    const w = weekSummary(generateWeek(ctx), byId)
    expect(w.costChf).toBeLessThanOrEqual(60)
    expect(w.costPerDayChf).toBeCloseTo(w.costChf / 7, 1)
  })
})

describe('Adapter le menu à de nouveaux besoins', () => {
  it('garde les plats et réajuste les portions dans ±5 %', () => {
    const ctx = context(PROFILES['homme, perte, 3 repas'][0], 80, 3)
    const plan = generateWeek(ctx)
    const newCtx = { ...ctx, targets: { ...ctx.targets, kcal: ctx.targets.kcal - 200 } }
    const refit = refitPortions(plan, newCtx)
    expect(refit.days.map((d) => d.meals.map((m) => m.recipeId))).toEqual(plan.days.map((d) => d.meals.map((m) => m.recipeId)))
    for (const d of refit.days) {
      expect(Math.abs(daySummary(d, byId, refit.lowBudget).kcal / newCtx.targets.kcal - 1)).toBeLessThanOrEqual(KCAL_TOLERANCE)
    }
    expect(targetsChanged(plan, newCtx.targets)).toBe(true)
    expect(targetsChanged(plan, ctx.targets)).toBe(false)
  })
  it('planifie la semaine suivante à partir du samedi', () => {
    expect(planningWeekStart('2026-11-18')).toBe('2026-11-16') // mercredi
    expect(planningWeekStart('2026-11-21')).toBe('2026-11-23') // samedi
    expect(planningWeekStart('2026-11-15')).toBe('2026-11-16') // dimanche
  })
})
