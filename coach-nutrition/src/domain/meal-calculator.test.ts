import { describe, expect, it } from 'vitest'
import { INGREDIENT_MAP, PRICES } from './catalog'
import { analyzeMeal, gapPercent, mealTips, slotTargets, slotsFor } from './meal-calculator'
import type { DietProfile } from './restrictions'

const profile = (over: Partial<DietProfile & { lowBudget: boolean }> = {}) => ({
  restrictions: [],
  kosher: { waitAfterMeatHours: 6 as const, separateFishAndMeat: true },
  dislikedFoods: [],
  lowBudget: false,
  ...over,
})

describe('Calculateur de repas', () => {
  it('additionne les valeurs des ingrédients au gramme près', () => {
    // 100 g de riz long (355 kcal/100 g) + 150 g de poulet (110 kcal/100 g)
    const a = analyzeMeal(
      [{ ingredientId: 'riz-long', grams: 100 }, { ingredientId: 'poulet-emince', grams: 150 }],
      INGREDIENT_MAP, PRICES.items, profile(),
    )
    expect(a.totals.kcal).toBe(355 + 165)
    expect(a.totals.protein).toBeCloseTo(7 + 34.5, 1)
    expect(a.totals.priceChf).toBeGreaterThan(0)
    expect(a.lines).toHaveLength(2)
    expect(a.kashrut).toBe('bassari')
  })

  it('ignore les lignes vides ou à 0 g', () => {
    const a = analyzeMeal([{ ingredientId: 'riz-long', grams: 0 }, { ingredientId: 'inconnu', grams: 50 }], INGREDIENT_MAP, PRICES.items, profile())
    expect(a.totals.kcal).toBe(0)
    expect(a.lines).toHaveLength(0)
  })

  it('signale viande + lait pour un profil casher', () => {
    const a = analyzeMeal(
      [{ ingredientId: 'boeuf-hache', grams: 120 }, { ingredientId: 'gruyere', grams: 30 }],
      INGREDIENT_MAP, PRICES.items, profile({ restrictions: ['casher'] }),
    )
    expect(a.kashrut).toBe('non-casher')
    expect(a.conflicts).toContain('casher')
  })

  it('signale porc et alcool pour un profil halal, et les aliments détestés', () => {
    const a = analyzeMeal(
      [{ ingredientId: 'jambon-cuit', grams: 50 }, { ingredientId: 'champignons-paris', grams: 100 }],
      INGREDIENT_MAP, PRICES.items, profile({ restrictions: ['halal'], dislikedFoods: ['champignons'] }),
    )
    expect(a.conflicts).toEqual(['halal', 'n’aime pas : champignons'])
  })

  it('le mode petit budget utilise les prix les moins chers', () => {
    const items = [{ ingredientId: 'pates', grams: 100 }]
    const normal = analyzeMeal(items, INGREDIENT_MAP, PRICES.items, profile())
    const cheap = analyzeMeal(items, INGREDIENT_MAP, PRICES.items, profile({ lowBudget: true }))
    expect(cheap.totals.priceChf).toBeLessThanOrEqual(normal.totals.priceChf)
  })
})

describe('Besoins du repas', () => {
  const day = { kcal: 2000, proteinG: 150, fatG: 60, carbsG: 210 }
  it('applique la part du créneau', () => {
    expect(slotTargets(day, 3, 'dejeuner')).toMatchObject({ share: 0.4, kcal: 800, proteinG: 60 })
    expect(slotTargets(day, 4, 'collation-apres-midi')).toMatchObject({ kcal: 200 })
  })
  it('propose les créneaux du profil', () => {
    expect(slotsFor(3)).toEqual(['petit-dej', 'dejeuner', 'diner'])
  })
  it('donne des conseils bienveillants', () => {
    const target = slotTargets(day, 3, 'dejeuner')
    expect(mealTips({ kcal: 500, protein: 20, fat: 15, carbs: 60, priceChf: 3 }, target).join(' ')).toMatch(/Il manque environ 300 kcal.*Protéines un peu justes/)
    expect(mealTips({ kcal: 800, protein: 60, fat: 25, carbs: 80, priceChf: 3 }, target)[0]).toMatch(/bien équilibré/)
    expect(gapPercent(880, 800)).toBe(10)
  })
})
