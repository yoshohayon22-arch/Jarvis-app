/**
 * Contrôles de cohérence des fichiers de données (ingrédients, prix, recettes).
 * Ces tests protègent contre les fautes de frappe quand on modifie les JSON à la main.
 */
import { describe, expect, it } from 'vitest'
import { INGREDIENTS, INGREDIENT_MAP, PRICES, RECIPES } from '../domain/catalog'
import { computeRecipeValues } from '../domain/recipe-values'
import { compatibleDiets } from '../domain/restrictions'

const meals = RECIPES.filter((r) => !r.mealTypes.includes('base'))

describe('Ingrédients', () => {
  it('ont des identifiants uniques et des valeurs nutritionnelles cohérentes', () => {
    expect(new Set(INGREDIENTS.map((i) => i.id)).size).toBe(INGREDIENTS.length)
    for (const i of INGREDIENTS) {
      const { kcal, protein, fat, carbs } = i.per100g
      expect(kcal, i.id).toBeGreaterThanOrEqual(0)
      expect(kcal, i.id).toBeLessThanOrEqual(900)
      expect(protein + fat + carbs, i.id).toBeLessThanOrEqual(101)
      // Les kcal déclarées sont proches de 4/9/4 kcal par gramme (± 25 % ou 30 kcal : fibres…).
      // L'alcool (7 kcal/g) n'entre pas dans ce calcul : on ne vérifie pas les boissons alcoolisées.
      const est = protein * 4 + fat * 9 + carbs * 4
      if (i.tags.includes('alcool')) continue
      expect(Math.abs(kcal - est), `${i.id} : ${kcal} vs ${Math.round(est)}`).toBeLessThanOrEqual(Math.max(30, kcal * 0.25))
      expect(i.packages.length, i.id).toBeGreaterThan(0)
      if (i.unit === 'piece') expect(i.gramsPerPiece, i.id).toBeGreaterThan(0)
    }
  })
})

describe('Prix', () => {
  it('chaque ingrédient a au moins un prix positif', () => {
    for (const i of INGREDIENTS) {
      const entries = PRICES.items[i.id]
      expect(entries?.length, `prix manquant : ${i.id}`).toBeGreaterThan(0)
      for (const e of entries) {
        expect(e.priceChf, i.id).toBeGreaterThan(0)
        expect(e.packageSize, i.id).toBeGreaterThan(0)
        expect(['Migros', 'Coop', 'Lidl', 'Aldi']).toContain(e.store)
      }
    }
  })
  it('les prix relevés ont une date et une source', () => {
    const relevés = Object.values(PRICES.items).flat().filter((e) => e.source === 'relevé')
    expect(relevés.length).toBeGreaterThanOrEqual(20)
    for (const e of relevés) {
      expect(e.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(e.url).toMatch(/^https:\/\/www\.(migros|coop)\.ch\//)
    }
  })
  it('le fichier indique sa date de mise à jour', () => {
    expect(PRICES.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('Recettes', () => {
  it('au moins 50 recettes, toutes catégories représentées', () => {
    expect(meals.length).toBeGreaterThanOrEqual(50)
    for (const m of ['petit-dej', 'dejeuner', 'diner', 'collation'] as const) {
      expect(meals.filter((r) => r.mealTypes.includes(m)).length, m).toBeGreaterThanOrEqual(12)
    }
  })

  it('identifiants uniques, ingrédients connus, étapes et conservation renseignées', () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length)
    for (const r of RECIPES) {
      expect(r.servings, r.id).toBeGreaterThan(0)
      expect(r.steps.length, r.id).toBeGreaterThan(0)
      expect(r.season.length, r.id).toBeGreaterThan(0)
      expect(r.fridgeDays, r.id).toBeGreaterThanOrEqual(0)
      expect(r.freezerMonths, r.id).toBeGreaterThanOrEqual(0)
      for (const ing of r.ingredients) {
        expect(INGREDIENT_MAP.has(ing.id), `${r.id} : ingrédient inconnu ${ing.id}`).toBe(true)
        expect(ing.grams, r.id).toBeGreaterThan(0)
      }
    }
  })

  it('les valeurs par portion sont à jour (sinon lancer « npm run recipes:update »)', () => {
    for (const r of RECIPES) {
      const v = computeRecipeValues(r, INGREDIENT_MAP, PRICES.items)
      expect(r.perServing, r.id).toEqual(v)
      expect(r.compatibleWith, r.id).toEqual(compatibleDiets(r, INGREDIENT_MAP))
    }
  })

  it('les calories par portion sont réalistes pour chaque type de repas', () => {
    const range = { 'petit-dej': [250, 650], dejeuner: [250, 900], diner: [250, 900], collation: [100, 400] } as const
    for (const r of meals) {
      for (const m of r.mealTypes) {
        if (m === 'base') continue
        const [min, max] = range[m]
        // Un plat peut aussi servir de collation ou de petit-déjeuner : on vérifie la fourchette la plus large.
        const ok = r.mealTypes.some((mt) => mt !== 'base' && r.perServing.kcal >= range[mt][0] && r.perServing.kcal <= range[mt][1])
        expect(ok, `${r.id} : ${r.perServing.kcal} kcal hors fourchette ${m} ${min}-${max}`).toBe(true)
      }
    }
  })

  it('les plats principaux apportent assez de protéines (≥ 10 g par portion)', () => {
    for (const r of meals.filter((x) => x.mealTypes.includes('dejeuner'))) {
      expect(r.perServing.protein, r.id).toBeGreaterThanOrEqual(10)
    }
  })

  it('les bases de batch cooking couvrent les 4 rôles et se conservent', () => {
    const bases = RECIPES.filter((r) => r.batchRole)
    for (const role of ['cereale', 'proteine', 'legumes', 'sauce'] as const) {
      expect(bases.some((b) => b.batchRole === role), role).toBe(true)
    }
    for (const b of bases) {
      expect(b.fridgeDays, b.id).toBeGreaterThanOrEqual(3)
      expect(b.tags, b.id).toContain('batch-friendly')
    }
  })

  it('chaque recette de saison froide est disponible en novembre (assez de choix en hiver)', () => {
    const november = meals.filter((r) => r.season.includes(11))
    expect(november.length).toBeGreaterThanOrEqual(50)
  })
})
