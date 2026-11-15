/**
 * Calculateur de repas « fait maison » — fonctions pures.
 * On compose un repas à partir d'ingrédients (en grammes) et on obtient ses calories, ses macros,
 * son prix, son classement casher et les éventuels conflits avec les restrictions du profil,
 * comparés aux besoins prévus pour ce repas.
 */
import type { Ingredient, Kashrut, PriceEntry } from './catalog'
import { computeRecipeValues } from './recipe-values'
import { computeKashrut, exclusionReasons, type DietProfile } from './restrictions'
import { KCAL_SHARE, SLOTS_BY_COUNT } from './menu/slots'
import type { MealSlot, MealsPerDay } from './types'

export interface MealItem {
  ingredientId: string
  grams: number
}

export interface MealTotals {
  kcal: number
  protein: number
  fat: number
  carbs: number
  priceChf: number
}

export interface MealAnalysis {
  totals: MealTotals
  /** Détail par ingrédient (même ordre que la saisie). */
  lines: (MealTotals & { ingredientId: string; grams: number })[]
  kashrut: Kashrut
  /** Conflits avec le profil (ex. « halal », « n’aime pas : champignons »). Vide = tout est compatible. */
  conflicts: string[]
}

export interface DayTargets {
  kcal: number
  proteinG: number
  fatG: number
  carbsG: number
}

/** Besoins d'un repas : la part de ce créneau dans la journée (ex. 35 % pour le déjeuner sur 4 repas). */
export function slotTargets(day: DayTargets, mealsPerDay: MealsPerDay, slot: MealSlot): DayTargets & { share: number } {
  const share = KCAL_SHARE[mealsPerDay][slot] ?? 0
  return {
    share,
    kcal: Math.round(day.kcal * share),
    proteinG: Math.round(day.proteinG * share),
    fatG: Math.round(day.fatG * share),
    carbsG: Math.round(day.carbsG * share),
  }
}

/** Créneaux disponibles selon le nombre de repas par jour. */
export const slotsFor = (mealsPerDay: MealsPerDay) => SLOTS_BY_COUNT[mealsPerDay]

export function analyzeMeal(
  items: MealItem[],
  ingredients: ReadonlyMap<string, Ingredient>,
  prices: Record<string, PriceEntry[]>,
  profile: DietProfile & { lowBudget: boolean },
): MealAnalysis {
  const valid = items.filter((i) => i.grams > 0 && ingredients.has(i.ingredientId))
  const lines = valid.map((i) => {
    const v = computeRecipeValues({ servings: 1, ingredients: [{ id: i.ingredientId, grams: i.grams }] }, ingredients, prices)
    return {
      ingredientId: i.ingredientId,
      grams: i.grams,
      kcal: v.kcal,
      protein: v.protein,
      fat: v.fat,
      carbs: v.carbs,
      priceChf: profile.lowBudget ? v.priceBudgetChf : v.priceChf,
    }
  })
  const sum = (k: keyof MealTotals) => Math.round(lines.reduce((s, l) => s + l[k], 0) * 100) / 100
  const recipeLike = { ingredients: valid.map((i) => ({ id: i.ingredientId, grams: i.grams })) }
  return {
    totals: { kcal: Math.round(sum('kcal')), protein: sum('protein'), fat: sum('fat'), carbs: sum('carbs'), priceChf: sum('priceChf') },
    lines,
    kashrut: computeKashrut(recipeLike, ingredients),
    conflicts: exclusionReasons(recipeLike, profile, ingredients),
  }
}

/** Écart relatif arrondi en % (ex. −12 pour 12 % en dessous). */
export const gapPercent = (value: number, target: number) => (target > 0 ? Math.round((value / target - 1) * 100) : 0)

/**
 * Conseils simples et bienveillants pour rapprocher le repas de sa cible.
 * Seuils : ±10 % sur les calories, protéines sous 85 % de la cible.
 */
export function mealTips(totals: MealTotals, target: DayTargets): string[] {
  const tips: string[] = []
  const kcalGap = gapPercent(totals.kcal, target.kcal)
  if (totals.kcal === 0) return tips
  if (kcalGap < -10) tips.push(`Il manque environ ${target.kcal - totals.kcal} kcal : ajoute un féculent, du pain ou un fruit.`)
  if (kcalGap > 10) tips.push(`Environ ${totals.kcal - target.kcal} kcal au-dessus : réduis un peu la portion de féculents ou de matières grasses, ou allège le repas suivant.`)
  if (totals.protein < target.proteinG * 0.85) {
    tips.push(`Protéines un peu justes (${Math.round(totals.protein)} g sur ${target.proteinG} g) : ajoute œufs, séré, yaourt grec, légumineuses, tofu, poisson ou viande.`)
  }
  if (tips.length === 0) tips.push('Repas bien équilibré pour ce moment de la journée. Bravo !')
  return tips
}
