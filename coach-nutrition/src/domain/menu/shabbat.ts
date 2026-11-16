/**
 * Shabbat — règles du générateur de menu (fonctions pures).
 *
 * - Repas de fête : vendredi soir (« shabbat-soir » : poulet rôti, soupe de poulet, saumon, avec challah)
 *   et samedi midi (« shabbat-midi » : cholent, dafina, assiette froide). Ces repas reçoivent une part
 *   plus grande des calories du jour ; les autres repas de la journée sont allégés d'autant.
 * - Pas de cuisson le samedi : uniquement des plats sans cuisson ou préparés la veille
 *   (« prepare-veille » : servis froids ou gardés au chaud sur la plata), ou les bowls du batch.
 * - Pas de session de batch cooking le samedi dans ce cas.
 * La semaine commence le lundi : vendredi = jour 4, samedi = jour 5.
 */
import type { Recipe } from '../catalog'
import type { DayOfWeek, MealSlot, ProfileSettings } from '../types'

export const FRIDAY = 4
export const SATURDAY = 5
/** Part des calories ajoutée au repas de fête (prise sur les autres repas du jour). */
export const FESTIVE_EXTRA_SHARE = 0.1
/** Avec 2 repas par jour (jeûne intermittent), les repas sont déjà copieux : bonus réduit. */
export const FESTIVE_EXTRA_SHARE_TWO_MEALS = 0.05

type ShabbatSettings = Pick<ProfileSettings, 'shabbat'>

const on = (s: ShabbatSettings) => s.shabbat?.enabled === true

/** Tag de recette attendu pour un repas de fête, ou null si ce repas n'en est pas un. */
export function festiveTag(s: ShabbatSettings, dayIndex: number, slot: MealSlot): 'shabbat-soir' | 'shabbat-midi' | null {
  if (!on(s) || !s.shabbat.festiveMeals) return null
  if (dayIndex === FRIDAY && slot === 'diner') return 'shabbat-soir'
  if (dayIndex === SATURDAY && slot === 'dejeuner') return 'shabbat-midi'
  return null
}

/** Le plat peut-il être servi ce jour-là ? (samedi sans cuisson : préparé la veille ou sans cuisson) */
export function allowedOnShabbat(recipe: Recipe, s: ShabbatSettings, dayIndex: number): boolean {
  if (!on(s) || !s.shabbat.noCookingSaturday || dayIndex !== SATURDAY) return true
  return recipe.cookMin === 0 || recipe.tags.includes('prepare-veille') || Boolean(recipe.components)
}

/**
 * Part des calories de chaque créneau pour un jour donné : le repas de fête prend
 * FESTIVE_EXTRA_SHARE de plus, retiré proportionnellement aux autres repas.
 */
export function dayShares(
  base: Partial<Record<MealSlot, number>>,
  slots: MealSlot[],
  s: ShabbatSettings,
  dayIndex: number,
): Record<MealSlot, number> {
  const out = {} as Record<MealSlot, number>
  const festive = slots.find((slot) => festiveTag(s, dayIndex, slot))
  const extra = slots.length <= 2 ? FESTIVE_EXTRA_SHARE_TWO_MEALS : FESTIVE_EXTRA_SHARE
  const others = slots.filter((slot) => slot !== festive)
  const othersTotal = others.reduce((sum, slot) => sum + (base[slot] ?? 0), 0) || 1
  for (const slot of slots) {
    const b = base[slot] ?? 0
    if (!festive) out[slot] = b
    else if (slot === festive) out[slot] = b + extra
    else out[slot] = b - (extra * b) / othersTotal
  }
  return out
}

/** Jours de batch cooking réellement utilisés (pas le samedi si on ne cuisine pas pendant Shabbat). */
export function effectiveSessionDays(s: Pick<ProfileSettings, 'shabbat' | 'batch'>): DayOfWeek[] {
  if (on(s) && s.shabbat.noCookingSaturday) return s.batch.sessionDays.filter((d) => d !== SATURDAY)
  return s.batch.sessionDays
}

/** Libellé affiché à côté d'un repas de Shabbat. */
export function shabbatLabel(s: ShabbatSettings, dayIndex: number, slot: MealSlot): string | null {
  const tag = festiveTag(s, dayIndex, slot)
  if (tag === 'shabbat-soir') return 'Repas de Shabbat'
  if (tag === 'shabbat-midi') return 'Déjeuner de Shabbat'
  if (on(s) && s.shabbat.noCookingSaturday && dayIndex === SATURDAY) return 'Préparé la veille'
  return null
}
