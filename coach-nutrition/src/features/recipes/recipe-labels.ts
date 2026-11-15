/** Libellés d'affichage liés aux recettes. */
import type { Ingredient, Kashrut, MealType } from '../../domain/catalog'
import type { Restriction } from '../../domain/types'

export const MEAL_LABELS: Record<MealType, string> = {
  'petit-dej': 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
  collation: 'Collation',
  base: 'Base batch',
}

export const KASHRUT_LABELS: Record<Kashrut, string> = {
  bassari: 'Bassari (viande)',
  halavi: 'Halavi (lait)',
  parve: 'Parvé (neutre)',
  'non-casher': 'Non casher',
}

export const DIET_LABELS: Record<Restriction, string> = {
  casher: 'Casher',
  halal: 'Halal',
  vegetarien: 'Végétarien',
  'sans-gluten': 'Sans gluten',
  'sans-lactose': 'Sans lactose',
  'sans-arachides': 'Sans arachides',
}

/** « 110 g d'œufs » → « 2 œufs (110 g) » ; « 250 g de lait » → « 250 ml ». */
export function formatQuantity(ingredient: Ingredient, grams: number): string {
  if (ingredient.unit === 'piece' && ingredient.gramsPerPiece) {
    const pieces = Math.round((grams / ingredient.gramsPerPiece) * 2) / 2 // à la demi-pièce près
    return `${pieces.toLocaleString('fr-CH')} pce (${Math.round(grams)} g)`
  }
  return `${Math.round(grams)} ${ingredient.unit === 'ml' ? 'ml' : 'g'}`
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** [10,11,12,1,2] → « oct. à févr. » ; 12 mois → « toute l’année ». */
export function formatSeason(months: number[]): string {
  if (months.length >= 12) return 'Toute l’année'
  return `${MONTHS[months[0] - 1]} à ${MONTHS[months[months.length - 1] - 1]}`
}
