/**
 * Recalcule les valeurs de chaque recette dans src/data/recipes.json :
 *  - kcal et macros par portion (depuis ingredients.json)
 *  - prix par portion, standard et petit budget (depuis prices.json)
 *  - tag « petit-budget » et liste des régimes compatibles
 *
 * À lancer après toute modification des recettes, des ingrédients ou des prix :
 *   npm run recipes:update
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { computeRecipeValues, isLowBudget } from '../src/domain/recipe-values.ts'
import { compatibleDiets, computeKashrut } from '../src/domain/restrictions.ts'
import type { Ingredient, PricesFile, Recipe } from '../src/domain/catalog.ts'

const dir = new URL('../src/data/', import.meta.url)
const read = <T,>(f: string): T => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as T

const { ingredients } = read<{ ingredients: Ingredient[] }>('ingredients.json')
const prices = read<PricesFile>('prices.json')
const recipes = read<Recipe[]>('recipes.json')
const ingMap = new Map(ingredients.map((i) => [i.id, i]))

let warnings = 0
const updated = recipes.map((r) => {
  const values = computeRecipeValues(r, ingMap, prices.items)
  const kashrut = computeKashrut(r, ingMap)
  if (kashrut !== r.kashrut) {
    console.warn(`⚠ ${r.id} : kashrut déclaré « ${r.kashrut} », calculé « ${kashrut} » → corrigé`)
    warnings++
  }
  const tags = r.tags.filter((t) => t !== 'petit-budget')
  if (isLowBudget(r, values)) tags.push('petit-budget')
  // On réécrit les clés dans un ordre stable et lisible.
  return {
    id: r.id,
    name: r.name,
    mealTypes: r.mealTypes,
    servings: r.servings,
    prepMin: r.prepMin,
    cookMin: r.cookMin,
    ingredients: r.ingredients,
    steps: r.steps,
    kashrut,
    tags,
    season: r.season,
    fridgeDays: r.fridgeDays,
    freezerMonths: r.freezerMonths,
    ...(r.batchRole ? { batchRole: r.batchRole } : {}),
    perServing: values,
    compatibleWith: compatibleDiets(r, ingMap),
  }
})

writeFileSync(new URL('recipes.json', dir), JSON.stringify(updated, null, 2) + '\n')
console.log(`${updated.length} recettes mises à jour${warnings ? `, ${warnings} correction(s) casher` : ''}.`)
