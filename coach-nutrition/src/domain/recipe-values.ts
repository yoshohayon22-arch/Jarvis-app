/**
 * Calcul des valeurs nutritionnelles et du coût d'une recette à partir de ses ingrédients.
 * Fonctions pures : on leur passe les données, elles ne lisent aucun fichier.
 */
import type { Ingredient, MealType, PriceEntry, Recipe } from './catalog'

export interface RecipeValues {
  kcal: number
  protein: number
  fat: number
  carbs: number
  /** Prix « normal » par portion (moyenne des produits standard). */
  priceChf: number
  /** Prix par portion en achetant les produits les moins chers (mode petit budget). */
  priceBudgetChf: number
}

/** Prix d'un gramme (ou ml) d'ingrédient. `mode` choisit standard ou petit budget. */
export function pricePerGram(
  ingredient: Ingredient,
  entries: PriceEntry[] | undefined,
  mode: 'standard' | 'budget',
): number {
  if (!entries || entries.length === 0) {
    throw new Error(`Aucun prix pour l'ingrédient ${ingredient.id}`)
  }
  // Pour les ingrédients à la pièce, le prix est par pièce : on le ramène au gramme.
  const gramsPerUnit = ingredient.unit === 'piece' ? (ingredient.gramsPerPiece ?? 1) : 1
  const perGram = (e: PriceEntry) => e.priceChf / (e.packageSize * gramsPerUnit)
  if (mode === 'budget') return Math.min(...entries.map(perGram))
  const standard = entries.filter((e) => !e.budgetLine)
  const pool = standard.length > 0 ? standard : entries
  return pool.reduce((sum, e) => sum + perGram(e), 0) / pool.length
}

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

export function computeRecipeValues(
  recipe: Pick<Recipe, 'ingredients' | 'servings'>,
  ingredients: ReadonlyMap<string, Ingredient>,
  prices: Record<string, PriceEntry[]>,
): RecipeValues {
  let kcal = 0
  let protein = 0
  let fat = 0
  let carbs = 0
  let price = 0
  let budget = 0
  for (const { id, grams } of recipe.ingredients) {
    const ing = ingredients.get(id)
    if (!ing) throw new Error(`Ingrédient inconnu : ${id}`)
    const f = grams / 100
    kcal += ing.per100g.kcal * f
    protein += ing.per100g.protein * f
    fat += ing.per100g.fat * f
    carbs += ing.per100g.carbs * f
    price += pricePerGram(ing, prices[id], 'standard') * grams
    budget += pricePerGram(ing, prices[id], 'budget') * grams
  }
  const s = recipe.servings
  return {
    kcal: Math.round(kcal / s),
    protein: round1(protein / s),
    fat: round1(fat / s),
    carbs: round1(carbs / s),
    priceChf: round2(price / s),
    priceBudgetChf: round2(budget / s),
  }
}

/**
 * Seuil (CHF par portion, prix petit budget) en dessous duquel une recette reçoit le tag « petit-budget ».
 * Repères : un petit-déjeuner à 1.00 au plus, un plat à 2.20 au plus, une collation à 0.70 au plus.
 */
export const LOW_BUDGET_THRESHOLD: Record<MealType, number> = {
  'petit-dej': 1.0,
  dejeuner: 2.2,
  diner: 2.2,
  collation: 0.7,
  base: 0.8,
}

export function isLowBudget(recipe: Pick<Recipe, 'mealTypes'>, values: RecipeValues): boolean {
  const threshold = Math.max(...recipe.mealTypes.map((m) => LOW_BUDGET_THRESHOLD[m]))
  return values.priceBudgetChf <= threshold
}
