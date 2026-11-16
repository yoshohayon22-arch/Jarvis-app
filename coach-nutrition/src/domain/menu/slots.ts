/** Créneaux de repas : ordre, horaires, part des calories, types de recettes acceptés. */
import type { MealType } from '../catalog'
import type { MealSlot, MealsPerDay } from '../types'

/** Créneaux utilisés selon le nombre de repas par jour. */
export const SLOTS_BY_COUNT: Record<MealsPerDay, MealSlot[]> = {
  2: ['dejeuner', 'diner'],
  3: ['petit-dej', 'dejeuner', 'diner'],
  4: ['petit-dej', 'dejeuner', 'collation-apres-midi', 'diner'],
  5: ['petit-dej', 'collation-matin', 'dejeuner', 'collation-apres-midi', 'diner'],
}

/**
 * Répartition des calories de la journée (repères classiques en nutrition du sport :
 * un déjeuner consistant, des collations légères autour de 10 %).
 */
export const KCAL_SHARE: Record<MealsPerDay, Partial<Record<MealSlot, number>>> = {
  2: { dejeuner: 0.45, diner: 0.55 },
  3: { 'petit-dej': 0.25, dejeuner: 0.4, diner: 0.35 },
  4: { 'petit-dej': 0.25, dejeuner: 0.35, 'collation-apres-midi': 0.1, diner: 0.3 },
  5: { 'petit-dej': 0.2, 'collation-matin': 0.1, dejeuner: 0.3, 'collation-apres-midi': 0.1, diner: 0.3 },
}

/** Heure habituelle de chaque créneau (pour le délai casher viande → lait). */
export const SLOT_HOUR: Record<MealSlot, number> = {
  'petit-dej': 7.5,
  'collation-matin': 10,
  dejeuner: 12.5,
  'collation-apres-midi': 16,
  diner: 19.5,
}

/** Type de recette accepté pour chaque créneau. */
export const SLOT_MEAL_TYPE: Record<MealSlot, MealType[]> = {
  'petit-dej': ['petit-dej'],
  'collation-matin': ['collation'],
  dejeuner: ['dejeuner'],
  'collation-apres-midi': ['collation'],
  diner: ['diner'],
}

export const SLOT_LABELS: Record<MealSlot, string> = {
  'petit-dej': 'Petit-déjeuner',
  'collation-matin': 'Collation du matin',
  dejeuner: 'Déjeuner',
  'collation-apres-midi': 'Collation',
  diner: 'Dîner',
}

/** Bornes de portions : on ne propose pas une demi-collation ni un triple dîner. */
export const PORTION_BOUNDS: Record<MealSlot, [number, number]> = {
  'petit-dej': [0.5, 1.8],
  'collation-matin': [0.5, 1.5],
  dejeuner: [0.5, 2],
  'collation-apres-midi': [0.5, 1.5],
  diner: [0.5, 2],
}
