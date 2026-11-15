/**
 * Types métier partagés par toute l'application.
 * Aucune dépendance à React ici : ces types décrivent uniquement les données.
 */
import type { Recipe } from './catalog'

export type Sex = 'homme' | 'femme'

/** Niveau d'activité de 1 (sédentaire) à 5 (très actif). */
export type ActivityLevel = 1 | 2 | 3 | 4 | 5

export type MealsPerDay = 3 | 4 | 5

export type Restriction =
  | 'casher'
  | 'halal'
  | 'vegetarien'
  | 'sans-gluten'
  | 'sans-lactose'
  | 'sans-arachides'

/** Délai d'attente (en heures) après un repas bassari avant de consommer du lait. */
export type KosherWaitHours = 0 | 1 | 3 | 6

export type GoalMode = 'perte' | 'prise' | 'maintien'

/** Jour de la semaine : 0 = lundi … 6 = dimanche (la semaine commence le lundi en Suisse). */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface KosherOptions {
  /** Heures d'attente après un repas bassari avant un repas ou une collation halavi. */
  waitAfterMeatHours: KosherWaitHours
  /** Ne jamais mélanger poisson et viande dans un même plat. */
  separateFishAndMeat: boolean
}

export interface BatchSettings {
  enabled: boolean
  /** Jours des sessions de cuisine (1 à 3 sessions). */
  sessionDays: DayOfWeek[]
}

/** Paramètres saisis par l'utilisateur lors de l'onboarding (modifiables ensuite). */
export interface ProfileSettings {
  sex: Sex
  age: number
  heightCm: number
  /** Poids au moment de la création du profil (point de départ du suivi). */
  startWeightKg: number
  targetWeightKg: number
  activityLevel: ActivityLevel
  mealsPerDay: MealsPerDay
  restrictions: Restriction[]
  kosher: KosherOptions
  /** Aliments détestés, en texte libre (ex. « coriandre », « champignons »). */
  dislikedFoods: string[]
  /** Budget hebdomadaire en CHF, facultatif. */
  weeklyBudgetChf: number | null
  lowBudget: boolean
  batch: BatchSettings
  /** Surplus calorique choisi pour une prise de poids (250 à 400 kcal). */
  gainSurplusKcal: number
  /** Passe à « maintien » une fois l'objectif atteint. */
  maintenanceMode: boolean
}

export interface WeighIn {
  /** Date au format AAAA-MM-JJ. */
  date: string
  kg: number
}

/** Créneaux de repas dans la journée, dans l'ordre chronologique. */
export type MealSlot = 'petit-dej' | 'collation-matin' | 'dejeuner' | 'collation-apres-midi' | 'diner'

export interface PlannedMeal {
  slot: MealSlot
  recipeId: string
  /** Nombre de portions de la recette (ex. 1,3) pour atteindre les besoins. */
  portions: number
  /** Plat verrouillé : conservé lors d'une régénération du menu. */
  locked: boolean
}

export interface DayPlan {
  /** Date AAAA-MM-JJ. */
  date: string
  meals: PlannedMeal[]
}

/** Session de batch cooking : on cuisine `cookDate` pour les jours `days` (indices 0 = lundi). */
export interface BatchSession {
  cookDate: string
  days: number[]
  /** Bases cuisinées en grande quantité (céréale, protéine, légumes, sauce). */
  baseIds: string[]
  /** Identifiant du bowl qui combine ces bases. */
  bowlId: string
}

/** Menu de la semaine (lundi → dimanche). */
export interface WeekPlan {
  weekStart: string
  createdAt: string
  /** Graine du hasard : même graine + mêmes réglages = même menu. */
  seed: number
  /** Cibles utilisées lors de la génération (pour détecter un changement de besoins). */
  targets: { kcal: number; proteinG: number; fatG: number; carbsG: number }
  lowBudget: boolean
  days: DayPlan[]
  /** Organisation batch cooking (null si le batch cooking n'est pas activé). */
  batch: { sessions: BatchSession[] } | null
  /** Recettes « assemblées » propres à ce menu (bowls de batch cooking). */
  bowls: Recipe[]
}

export interface Profile {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  settings: ProfileSettings
  weighIns: WeighIn[]
  /** Menu de la semaine en cours (null tant qu'aucun menu n'a été généré). */
  menu: WeekPlan | null
  /** Cases cochées dans les listes de courses (par identifiant de liste). */
  shoppingChecks: Record<string, string[]>
}

/** Données complètes de l'application, telles que stockées dans le navigateur. */
export interface AppData {
  schemaVersion: number
  activeProfileId: string | null
  profiles: Profile[]
}

export interface Macros {
  proteinG: number
  fatG: number
  carbsG: number
}

/** Résultat complet du calcul des besoins. */
export interface NutritionTargets {
  bmr: number
  tdee: number
  goal: GoalMode
  /** Écart appliqué au TDEE (négatif = déficit, positif = surplus). */
  adjustmentKcal: number
  targetKcal: number
  /** Vrai si le plancher de sécurité (1500 / 1200 kcal) a été appliqué. */
  floorApplied: boolean
  macros: Macros
  /** Variation de poids attendue par semaine, en kg (négative = perte). */
  expectedWeeklyChangeKg: number
  /** Date estimée d'atteinte de l'objectif (AAAA-MM-JJ), ou null si non pertinent. */
  estimatedGoalDate: string | null
  /** Poids de référence utilisé pour les protéines et les lipides. */
  referenceWeightKg: number
}
