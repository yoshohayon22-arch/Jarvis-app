import { describe, expect, it } from 'vitest'
import { INGREDIENT_MAP, RECIPES } from './catalog'
import { isRecipeAllowed, mealKashrut } from './restrictions'
import { momentShare, QUICK_MINUTES, suggestMeals } from './meal-ideas'

const profile = (over = {}) => ({
  restrictions: [] as ('casher' | 'halal' | 'vegetarien')[],
  kosher: { waitAfterMeatHours: 6 as const, separateFishAndMeat: true },
  dislikedFoods: [] as string[],
  lowBudget: false,
  mealsPerDay: 3 as const,
  ...over,
})

describe('Juste un repas', () => {
  it('propose 3 idées différentes pour le moment choisi', () => {
    const ideas = suggestMeals(RECIPES, INGREDIENT_MAP, profile(), 2200, { moment: 'diner', adapt: true }, 1)
    expect(ideas).toHaveLength(3)
    expect(new Set(ideas.map((i) => i.recipe.id)).size).toBe(3)
    for (const i of ideas) expect(i.recipe.mealTypes.some((m) => m === 'dejeuner' || m === 'diner')).toBe(true)
  })

  it('respecte toujours les restrictions et les aliments détestés', () => {
    const p = profile({ restrictions: ['casher', 'vegetarien'], dislikedFoods: ['champignons'] })
    for (let seed = 1; seed <= 30; seed++) {
      for (const moment of ['petit-dej', 'dejeuner', 'diner', 'collation'] as const) {
        for (const idea of suggestMeals(RECIPES, INGREDIENT_MAP, p, 2000, { moment, adapt: false }, seed)) {
          expect(isRecipeAllowed(idea.recipe, p, INGREDIENT_MAP), idea.recipe.id).toBe(true)
          expect(mealKashrut([idea.recipe], INGREDIENT_MAP)).not.toBe('non-casher')
        }
      }
    }
  })

  it('« rapide » et « petit budget » filtrent les recettes', () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (const i of suggestMeals(RECIPES, INGREDIENT_MAP, profile(), 2000, { moment: 'dejeuner', quick: true, cheap: true, adapt: false }, seed)) {
        expect(i.recipe.prepMin + i.recipe.cookMin).toBeLessThanOrEqual(QUICK_MINUTES)
        expect(i.recipe.tags).toContain('petit-budget')
      }
    }
  })

  it('les recettes qui utilisent ce que j’ai passent devant', () => {
    const ideas = suggestMeals(RECIPES, INGREDIENT_MAP, profile(), 2000, { moment: 'diner', have: ['lentilles-corail'], adapt: false }, 4)
    expect(ideas[0].uses).toContain('lentilles-corail')
  })

  it('change d’idées quand on redemande (graine différente)', () => {
    const a = suggestMeals(RECIPES, INGREDIENT_MAP, profile(), 2000, { moment: 'diner', adapt: false }, 1).map((i) => i.recipe.id)
    const b = suggestMeals(RECIPES, INGREDIENT_MAP, profile(), 2000, { moment: 'diner', adapt: false }, 2).map((i) => i.recipe.id)
    expect(a).not.toEqual(b)
  })

  it('adapte la portion aux besoins du repas, ou garde une portion normale', () => {
    const [adapted] = suggestMeals(RECIPES, INGREDIENT_MAP, profile(), 2400, { moment: 'dejeuner', adapt: true }, 3)
    const target = 2400 * momentShare('dejeuner', 3)
    expect(Math.abs(adapted.kcal - target) / target).toBeLessThan(0.35) // portion bornée entre 0,5 et 2
    const [normal] = suggestMeals(RECIPES, INGREDIENT_MAP, profile(), 2400, { moment: 'dejeuner', adapt: false }, 3)
    expect(normal.portions).toBe(1)
  })

  it('sait répondre même avec 2 repas par jour (collation demandée quand même)', () => {
    expect(momentShare('collation', 2)).toBe(0.1)
    expect(suggestMeals(RECIPES, INGREDIENT_MAP, profile({ mealsPerDay: 2 }), 2000, { moment: 'collation', adapt: true }, 1)).toHaveLength(3)
  })
})
