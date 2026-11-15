import { describe, expect, it } from 'vitest'
import { INGREDIENT_MAP, PRICES, RECIPES, type PriceEntry } from './catalog'
import { computeTargets } from './nutrition'
import { DEFAULT_SETTINGS } from '../storage/migrations'
import type { DayOfWeek, ProfileSettings } from './types'
import { generateWeek, planLookup } from './menu/generator'
import { aggregateIngredients, bestPurchase, buildShoppingLists, formatAmount, listToText, toPurchaseUnits } from './shopping'

const entry = (priceChf: number, packageSize: number, budgetLine = false): PriceEntry => ({
  store: 'Migros', label: `Test ${packageSize}`, priceChf, packageSize, budgetLine, source: 'estimation',
})

describe('Arrondi aux conditionnements', () => {
  it('choisit la combinaison la moins chère qui couvre le besoin', () => {
    // 1,3 kg de riz : 1 kg à 2.10 + 500 g à 1.50 (3.60) plutôt que 2 × 1 kg (4.20)
    const p = bestPurchase(1300, [entry(2.1, 1000), entry(1.5, 500)])
    expect(p.map((x) => [x.entry.packageSize, x.count])).toEqual([[1000, 1], [500, 1]])
  })
  it('prend 2 grands paquets s’ils coûtent moins cher que le mélange', () => {
    const p = bestPurchase(1300, [entry(1.3, 1000), entry(1.5, 500)])
    expect(p).toEqual([{ count: 2, entry: entry(1.3, 1000), priceChf: 2.6 }]) // 2.60 < 1.30 + 1.50
  })
  it('couvre toujours au moins le besoin', () => {
    for (const need of [1, 250, 499, 501, 999, 2600]) {
      const p = bestPurchase(need, [entry(1.2, 500), entry(2.0, 1000)])
      expect(p.reduce((s, x) => s + x.count * x.entry.packageSize, 0)).toBeGreaterThanOrEqual(need)
    }
  })
  it('au poids (vrac, coupe) : on paie la quantité prise, au moins 100 g', () => {
    const cheese = { ...entry(17, 1000), byWeight: true }
    const p = bestPurchase(20, [cheese, entry(5.2, 250)])
    expect(p[0].quantity).toBe(100)
    expect(p[0].priceChf).toBe(1.7)
    // Pour une grosse quantité, le paquet peut redevenir plus intéressant.
    const big = bestPurchase(240, [{ ...entry(22, 1000), byWeight: true }, entry(4.5, 250)])
    expect(big[0].entry.byWeight).toBeUndefined()
  })
  it('les œufs se comptent en pièces (boîtes de 6 ou 10)', () => {
    const eggs = INGREDIENT_MAP.get('oeufs')!
    expect(toPurchaseUnits(eggs, 330)).toBe(6) // 6 × 55 g
    expect(toPurchaseUnits(eggs, 340)).toBe(7)
    const p = bestPurchase(7, PRICES.items.oeufs)
    expect(p.reduce((s, x) => s + x.count * x.entry.packageSize, 0)).toBeGreaterThanOrEqual(7)
  })
  it('formate les quantités', () => {
    expect(formatAmount(INGREDIENT_MAP.get('riz-long')!, 1250)).toBe('1,3 kg')
    expect(formatAmount(INGREDIENT_MAP.get('lait')!, 750)).toBe('750 ml')
    expect(formatAmount(INGREDIENT_MAP.get('oeufs')!, 6)).toBe('6 pièces')
  })
})

function plan(s: Partial<ProfileSettings>, sessions?: DayOfWeek[]) {
  const settings = {
    ...DEFAULT_SETTINGS, sex: 'femme', age: 35, heightCm: 168, targetWeightKg: 62, activityLevel: 3, mealsPerDay: 4, ...s,
    batch: sessions ? { enabled: true, sessionDays: sessions } : { enabled: false, sessionDays: [6] },
  } as ProfileSettings
  const t = computeTargets(settings, 70)
  const p = generateWeek({ settings, targets: { kcal: t.targetKcal, proteinG: t.macros.proteinG, fatG: t.macros.fatG, carbsG: t.macros.carbsG }, recipes: RECIPES, ingredients: INGREDIENT_MAP, weekStart: '2026-11-16', seed: 3 })
  return { settings, plan: p, byId: planLookup(p, RECIPES) }
}

describe('Liste de courses de la semaine', () => {
  const { settings, plan: p, byId } = plan({ restrictions: ['casher'] })
  const [list] = buildShoppingLists(p, byId, INGREDIENT_MAP, PRICES.items, settings.restrictions)

  it('une seule liste sans batch, qui couvre tous les ingrédients du menu', () => {
    expect(buildShoppingLists(p, byId, INGREDIENT_MAP, PRICES.items, [])).toHaveLength(1)
    const needed = aggregateIngredients(p.days.flatMap((d) => d.meals), byId)
    const listed = [...list.aisles.flatMap((a) => a.items), ...list.pantry]
    expect(listed.map((i) => i.ingredient.id).sort()).toEqual([...needed.keys()].sort())
    for (const item of listed) {
      expect(item.neededGrams).toBeCloseTo(needed.get(item.ingredient.id)!, 5)
      const bought = item.purchases.reduce((s, x) => s + (x.quantity ?? x.count * x.entry.packageSize), 0)
      expect(bought + item.fromStock, item.ingredient.id).toBeGreaterThanOrEqual(item.neededUnits)
    }
  })

  it('classée par rayon, produits de placard à part et hors total', () => {
    const aisles = list.aisles.map((a) => a.aisle)
    expect(aisles[0]).toBe('fruits-legumes')
    expect(list.aisles.flatMap((a) => a.items).every((i) => !i.pantry)).toBe(true)
    expect(list.pantry.every((i) => i.ingredient.aisle === 'condiments' || ['farine-ble', 'levure-seche', 'miel', 'cacao-poudre'].includes(i.ingredient.id))).toBe(true)
    const sum = list.aisles.flatMap((a) => a.items).reduce((s, i) => s + i.totalChf, 0)
    expect(list.totalChf).toBeCloseTo(sum, 2)
  })

  it('rappelle la certification casher', () => {
    expect(list.reminders.join(' ')).toMatch(/certification casher/)
  })

  it('version texte avec cases à cocher', () => {
    const someId = list.aisles[0].items[0].ingredient.id
    const txt = listToText(list, [someId])
    expect(txt).toContain('☑')
    expect(txt).toContain('☐')
    expect(txt).toMatch(/Total estimé : CHF \d+\.\d\d/)
  })

  it('le mode petit budget achète moins cher', () => {
    const normal = buildShoppingLists({ ...p, lowBudget: false }, byId, INGREDIENT_MAP, PRICES.items, [])[0]
    const cheap = buildShoppingLists({ ...p, lowBudget: true }, byId, INGREDIENT_MAP, PRICES.items, [])[0]
    expect(cheap.totalChf).toBeLessThan(normal.totalChf)
  })
})

describe('Liste de courses avec batch cooking', () => {
  it('une liste par session, qui couvre les repas de ses jours', () => {
    const { plan: p, byId } = plan({}, [6, 2])
    const lists = buildShoppingLists(p, byId, INGREDIENT_MAP, PRICES.items, [])
    expect(lists).toHaveLength(p.batch!.sessions.length)
    p.batch!.sessions.forEach((s, i) => {
      const needed = aggregateIngredients(s.days.flatMap((d) => p.days[d].meals), byId)
      const listed = [...lists[i].aisles.flatMap((a) => a.items), ...lists[i].pantry]
      expect(listed.length).toBe(needed.size)
      expect(lists[i].title).toBe(`Courses pour la session ${i + 1}`)
    })
  })

  it('les restes d’une session (riz, carottes…) servent à la suivante et ne sont pas rachetés', () => {
    const { plan: p, byId } = plan({}, [6, 2])
    const [l1, l2] = buildShoppingLists(p, byId, INGREDIENT_MAP, PRICES.items, [])
    const items1 = new Map([...l1.aisles.flatMap((a) => a.items), ...l1.pantry].map((i) => [i.ingredient.id, i]))
    const items2 = [...l2.aisles.flatMap((a) => a.items), ...l2.pantry]
    expect(items1.size).toBeGreaterThan(0)
    for (const it2 of items2) {
      const it1 = items1.get(it2.ingredient.id)
      if (!it1) {
        expect(it2.fromStock).toBe(0)
        continue
      }
      const bought1 = it1.purchases.reduce((s, x) => s + (x.quantity ?? x.count * x.entry.packageSize), 0)
      const leftover = Math.max(0, bought1 + it1.fromStock - it1.neededUnits)
      const keeps = it2.ingredient.aisle === 'epicerie' || it2.ingredient.aisle === 'conserves' || ['carottes', 'oignons', 'pommes-de-terre'].includes(it2.ingredient.id)
      if (keeps) expect(it2.fromStock, it2.ingredient.id).toBeCloseTo(Math.min(leftover, it2.neededUnits), 5)
    }
    expect(items2.some((i) => i.fromStock > 0)).toBe(true)
  })
})
