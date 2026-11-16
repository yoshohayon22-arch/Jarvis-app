/**
 * « Juste un repas » : des idées de repas ponctuelles, en dehors du menu de la semaine.
 * Fonctions pures : on respecte toujours les restrictions et les aliments détestés du profil,
 * puis on classe selon les envies (rapide, petit budget, ingrédients qu'on a déjà) avec une part
 * de hasard pour proposer autre chose à chaque demande.
 */
import type { Ingredient, Recipe } from './catalog'
import { createRng } from './menu/generator'
import { KCAL_SHARE } from './menu/slots'
import { isRecipeAllowed, type DietProfile } from './restrictions'
import type { MealSlot, MealsPerDay } from './types'

export type IdeaMoment = 'petit-dej' | 'dejeuner' | 'diner' | 'collation'

export interface IdeaQuery {
  moment: IdeaMoment
  /** 20 minutes au plus, préparation et cuisson comprises. */
  quick?: boolean
  /** Recettes marquées « petit budget ». */
  cheap?: boolean
  /** Ingrédients qu'on a sous la main : les recettes qui les utilisent passent devant. */
  have?: string[]
  /** Adapter la portion aux besoins du repas (sinon : 1 portion normale). */
  adapt: boolean
}

export interface MealIdea {
  recipe: Recipe
  portions: number
  kcal: number
  priceChf: number
  /** Ingrédients « que j'ai » utilisés par la recette. */
  uses: string[]
}

export const QUICK_MINUTES = 20

/** Part de la journée pour ce moment (repli si le créneau n'existe pas dans le profil). */
const DEFAULT_SHARE: Record<IdeaMoment, number> = { 'petit-dej': 0.25, dejeuner: 0.35, diner: 0.35, collation: 0.1 }

export function momentShare(moment: IdeaMoment, mealsPerDay: MealsPerDay): number {
  const slot: MealSlot = moment === 'collation' ? 'collation-apres-midi' : moment
  return KCAL_SHARE[mealsPerDay][slot] ?? DEFAULT_SHARE[moment]
}

const servesMoment = (r: Recipe, m: IdeaMoment) =>
  m === 'dejeuner' || m === 'diner' ? r.mealTypes.includes('dejeuner') || r.mealTypes.includes('diner') : r.mealTypes.includes(m)

export function suggestMeals(
  recipes: Recipe[],
  ingredients: ReadonlyMap<string, Ingredient>,
  profile: DietProfile & { lowBudget: boolean; mealsPerDay: MealsPerDay },
  dayKcal: number,
  q: IdeaQuery,
  seed: number,
  count = 3,
): MealIdea[] {
  const rng = createRng(seed)
  const month = new Date().getMonth() + 1
  const have = q.have ?? []
  const pool = recipes.filter(
    (r) =>
      !r.mealTypes.includes('base') &&
      servesMoment(r, q.moment) &&
      isRecipeAllowed(r, profile, ingredients) &&
      (!q.quick || r.prepMin + r.cookMin <= QUICK_MINUTES) &&
      (!q.cheap || r.tags.includes('petit-budget')),
  )
  const scored = pool.map((r) => {
    const uses = have.filter((id) => r.ingredients.some((i) => i.id === id))
    let score = uses.length * 3 + rng() * 2 // le hasard varie les idées d'une demande à l'autre
    if (r.season.includes(month)) score += 0.5
    return { r, uses, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const target = dayKcal * momentShare(q.moment, profile.mealsPerDay)
  return scored.slice(0, count).map(({ r, uses }) => {
    const portions = q.adapt ? Math.min(2, Math.max(0.5, Math.round((target / Math.max(1, r.perServing.kcal)) * 10) / 10)) : 1
    const price = profile.lowBudget ? r.perServing.priceBudgetChf : r.perServing.priceChf
    return { recipe: r, portions, kcal: Math.round(r.perServing.kcal * portions), priceChf: Math.round(price * portions * 100) / 100, uses }
  })
}
