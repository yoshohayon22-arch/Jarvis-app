/**
 * Catalogue : ingrédients, prix et recettes (données locales en JSON).
 * Les fichiers JSON sont modifiables à la main ; ce module les type et les indexe.
 */
import ingredientsData from '../data/ingredients.json'
import pricesData from '../data/prices.json'
import recipesData from '../data/recipes.json'

/** Tags portés par un ingrédient (utilisés par les filtres de restriction). */
export type IngredientTag =
  | 'viande' // bœuf, veau, agneau
  | 'volaille'
  | 'porc'
  | 'lapin'
  | 'poisson' // poisson à nageoires et à écailles
  | 'poisson-sans-ecailles' // ex. silure, anguille (non casher)
  | 'fruits-de-mer'
  | 'lait' // produit laitier (classement casher halavi)
  | 'lactose'
  | 'gluten'
  | 'arachide'
  | 'fruits-a-coque'
  | 'soja'
  | 'sesame'
  | 'oeuf'
  | 'alcool'
  | 'gelatine-porcine'
  | 'saindoux'
  | 'cert-casher' // à acheter avec certification casher
  | 'cert-halal' // à acheter avec certification halal

export type Aisle =
  | 'fruits-legumes'
  | 'boucherie'
  | 'poissonnerie'
  | 'cremerie'
  | 'boulangerie'
  | 'epicerie'
  | 'conserves'
  | 'surgeles'
  | 'condiments'
  | 'petit-dej'
  | 'fruits-secs'

export interface Per100g {
  kcal: number
  protein: number
  fat: number
  carbs: number
}

export interface Ingredient {
  id: string
  name: string
  aisle: Aisle
  /** Unité d'achat : grammes, millilitres (densité ≈ 1) ou pièces. */
  unit: 'g' | 'ml' | 'piece'
  /** Pour les ingrédients à la pièce : poids moyen d'une pièce (partie comestible). */
  gramsPerPiece?: number
  per100g: Per100g
  tags: IngredientTag[]
  /** Conditionnements réels en magasin (dans l'unité d'achat). */
  packages: number[]
}

export interface PriceEntry {
  store: 'Migros' | 'Coop' | 'Lidl' | 'Aldi'
  label: string
  priceChf: number
  /** Taille du conditionnement, dans l'unité de l'ingrédient (g, ml ou pièces). */
  packageSize: number
  /** Ligne petit prix : M-Budget, Prix Garantie, marques Lidl/Aldi… */
  budgetLine: boolean
  source: 'estimation' | 'relevé'
  /** Vendu au poids (vrac, coupe) : on paie la quantité prise, au prorata du prix indiqué. */
  byWeight?: boolean
  checkedAt?: string
  url?: string
}

export type MealType = 'petit-dej' | 'dejeuner' | 'diner' | 'collation' | 'base'
export type Kashrut = 'bassari' | 'halavi' | 'parve' | 'non-casher'
export type BatchRole = 'cereale' | 'proteine' | 'legumes' | 'sauce'

export interface RecipeIngredient {
  id: string
  /** Quantité pour la recette entière (toutes portions), en grammes. */
  grams: number
}

export interface Recipe {
  id: string
  name: string
  mealTypes: MealType[]
  servings: number
  prepMin: number
  cookMin: number
  ingredients: RecipeIngredient[]
  steps: string[]
  /** Classement casher déclaré (vérifié par les tests contre les ingrédients). */
  kashrut: Kashrut
  /** Tags libres : batch-friendly, rapide, petit-budget… */
  tags: string[]
  /** Mois de saison (1 = janvier). */
  season: number[]
  fridgeDays: number
  /** 0 = ne se congèle pas. */
  freezerMonths: number
  batchRole?: BatchRole
  /** Pour un bowl de batch cooking : bases qui le composent et portions de chacune. */
  components?: { id: string; portions: number }[]
  /** Valeurs par portion — calculées par `npm run recipes:update`. */
  perServing: Per100g & { priceChf: number; priceBudgetChf: number }
  /** Régimes compatibles — calculés par `npm run recipes:update` (pour lecture humaine). */
  compatibleWith: string[]
}

export interface PricesFile {
  updatedAt: string
  note: string
  items: Record<string, PriceEntry[]>
}

export const AISLE_LABELS = ingredientsData.aisles as Record<Aisle, string>
export const INGREDIENTS = ingredientsData.ingredients as Ingredient[]
export const PRICES = pricesData as PricesFile
export const RECIPES = recipesData as unknown as Recipe[]

export const INGREDIENT_MAP: ReadonlyMap<string, Ingredient> = new Map(INGREDIENTS.map((i) => [i.id, i]))
export const RECIPE_MAP: ReadonlyMap<string, Recipe> = new Map(RECIPES.map((r) => [r.id, r]))

export function getIngredient(id: string): Ingredient {
  const ing = INGREDIENT_MAP.get(id)
  if (!ing) throw new Error(`Ingrédient inconnu : ${id}`)
  return ing
}
