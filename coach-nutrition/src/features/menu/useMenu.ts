/**
 * Accès au menu du profil actif + actions (générer, remplacer, verrouiller, adapter).
 * Toute la logique est dans domain/menu ; ce hook ne fait que relier l'état React.
 */
import { useMemo } from 'react'
import { INGREDIENT_MAP, RECIPES, RECIPE_MAP } from '../../domain/catalog'
import { computeTargets, todayIso } from '../../domain/nutrition'
import { referenceWeightFor, setMenu, updateProfile } from '../../domain/profiles'
import {
  generateWeek,
  planLookup,
  planningWeekStart,
  refitPortions,
  replaceMeal,
  targetsChanged,
  toggleLock,
  weekSummary,
  type GeneratorContext,
} from '../../domain/menu/generator'
import type { MealSlot } from '../../domain/types'
import { useAppData } from '../../state/AppDataContext'

export function useMenu() {
  const { activeProfile, update } = useAppData()

  const ctx = useMemo<GeneratorContext | null>(() => {
    if (!activeProfile) return null
    const t = computeTargets(activeProfile.settings, referenceWeightFor(activeProfile))
    return {
      settings: activeProfile.settings,
      targets: { kcal: t.targetKcal, proteinG: t.macros.proteinG, fatG: t.macros.fatG, carbsG: t.macros.carbsG },
      recipes: RECIPES,
      ingredients: INGREDIENT_MAP,
      weekStart: planningWeekStart(todayIso()),
      seed: 1,
    }
  }, [activeProfile])

  const plan = activeProfile?.menu ?? null
  const recipes = useMemo(() => (plan ? planLookup(plan, RECIPE_MAP.values()) : RECIPE_MAP), [plan])
  const summary = useMemo(() => (plan ? weekSummary(plan, recipes) : null), [plan, recipes])

  const save = (fn: (p: NonNullable<typeof plan>) => NonNullable<typeof plan>) => {
    if (!activeProfile || !plan) return
    update((d) => setMenu(d, activeProfile.id, fn(plan)))
  }

  return {
    ctx,
    plan,
    summary,
    /** Recettes du catalogue + bowls du menu. */
    recipes,
    /** Les besoins ont changé depuis la génération du menu. */
    stale: Boolean(plan && ctx && (targetsChanged(plan, ctx.targets) || plan.lowBudget !== ctx.settings.lowBudget)),
    /** Génère un nouveau menu (en gardant les plats verrouillés). */
    generate: () => {
      if (!activeProfile || !ctx) return
      const seed = Math.floor(Math.random() * 1_000_000_000)
      // On garde les verrous seulement si l'ancien menu porte sur la même semaine.
      const previous = plan && plan.weekStart === ctx.weekStart ? plan : null
      // Les plats du menu actuel (non verrouillés) sont évités : le nouveau menu change vraiment.
      const avoid = plan ? plan.days.flatMap((d) => d.meals.filter((m) => !m.locked).map((m) => m.recipeId)) : []
      const next = generateWeek({ ...ctx, seed }, { previous, avoid })
      update((d) => setMenu(d, activeProfile.id, next))
    },
    replace: (dayIndex: number, slot: MealSlot, variant: number) => ctx && save((p) => replaceMeal(p, ctx, dayIndex, slot, variant)),
    toggleLock: (dayIndex: number, slot: MealSlot) => save((p) => toggleLock(p, dayIndex, slot)),
    refit: () => ctx && save((p) => refitPortions(p, ctx)),
    /** Active / désactive le mode petit budget (réglage du profil). */
    setLowBudget: (lowBudget: boolean) => {
      if (!activeProfile) return
      update((d) => updateProfile(d, activeProfile.id, { settings: { ...activeProfile.settings, lowBudget } }))
    },
  }
}
