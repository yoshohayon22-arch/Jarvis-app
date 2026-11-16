/**
 * Brouillon du formulaire d'onboarding / d'édition de profil.
 * Les nombres sont gardés en texte pendant la saisie (on accepte « 72,5 »),
 * puis convertis et validés par des fonctions pures.
 */
import type {
  ActivityLevel,
  DayOfWeek,
  KosherWaitHours,
  MealsPerDay,
  ProfileSettings,
  Restriction,
  Sex,
} from '../../domain/types'
import { checkAge, checkHeight, checkTargetWeight, checkWeight } from '../../domain/safety'
import { DEFAULT_SETTINGS } from '../../storage/migrations'
import { GOAL_TOLERANCE_KG } from '../../domain/nutrition'

export interface Draft {
  name: string
  sex: Sex | null
  age: string
  heightCm: string
  weightKg: string
  targetWeightKg: string
  activityLevel: ActivityLevel | null
  mealsPerDay: MealsPerDay
  restrictions: Restriction[]
  kosherWait: KosherWaitHours
  kosherWaitAfterMilk: boolean
  separateFishAndMeat: boolean
  shabbat: boolean
  shabbatFestive: boolean
  shabbatNoCooking: boolean
  dislikedFoods: string[]
  weeklyBudgetChf: string
  lowBudget: boolean
  batchEnabled: boolean
  batchDays: DayOfWeek[]
}

export const STEP_IDS = [
  'identite',
  'mensurations',
  'objectif',
  'activite',
  'repas',
  'restrictions',
  'organisation',
  'recapitulatif',
] as const
export type StepId = (typeof STEP_IDS)[number]

export type DraftErrors = Partial<Record<keyof Draft, string>>

export function emptyDraft(): Draft {
  return {
    name: '',
    sex: null,
    age: '',
    heightCm: '',
    weightKg: '',
    targetWeightKg: '',
    activityLevel: null,
    mealsPerDay: 3,
    restrictions: [],
    kosherWait: DEFAULT_SETTINGS.kosher.waitAfterMeatHours,
    kosherWaitAfterMilk: DEFAULT_SETTINGS.kosher.waitAfterMilk ?? false,
    separateFishAndMeat: DEFAULT_SETTINGS.kosher.separateFishAndMeat,
    shabbat: DEFAULT_SETTINGS.shabbat.enabled,
    shabbatFestive: DEFAULT_SETTINGS.shabbat.festiveMeals,
    shabbatNoCooking: DEFAULT_SETTINGS.shabbat.noCookingSaturday,
    dislikedFoods: [],
    weeklyBudgetChf: '',
    lowBudget: false,
    batchEnabled: false,
    batchDays: [6],
  }
}

/** Convertit « 72,5 » ou « 72.5 » en nombre ; NaN si vide ou invalide. */
export function parseNumber(text: string): number {
  const cleaned = text.trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '' || !/^-?\d*\.?\d+$/.test(cleaned)) return Number.NaN
  return Number(cleaned)
}

/** Affiche un nombre « à la suisse romande » (virgule décimale). */
function fmt(n: number): string {
  return String(n).replace('.', ',')
}

/** Valide les champs d'une étape donnée. Une étape sans erreur renvoie un objet vide. */
export function validateStep(step: StepId, d: Draft): DraftErrors {
  const e: DraftErrors = {}
  switch (step) {
    case 'identite': {
      if (!d.name.trim()) e.name = 'Choisis un nom pour ce profil (ex. ton prénom).'
      if (!d.sex) e.sex = 'Sélectionne une option : la formule de calcul en dépend.'
      const age = checkAge(parseNumber(d.age))
      if (!age.ok) e.age = age.message
      break
    }
    case 'mensurations': {
      const h = checkHeight(parseNumber(d.heightCm))
      if (!h.ok) e.heightCm = h.message
      const w = checkWeight(parseNumber(d.weightKg))
      if (!w.ok) e.weightKg = w.message
      break
    }
    case 'objectif': {
      const height = parseNumber(d.heightCm)
      const t = checkTargetWeight(parseNumber(d.targetWeightKg), height)
      if (!t.ok) e.targetWeightKg = t.message
      break
    }
    case 'activite':
      if (!d.activityLevel) e.activityLevel = 'Choisis le niveau qui te ressemble le plus.'
      break
    case 'organisation': {
      if (d.weeklyBudgetChf.trim() !== '') {
        const b = parseNumber(d.weeklyBudgetChf)
        if (!Number.isFinite(b) || b < 20 || b > 1000) {
          e.weeklyBudgetChf = 'Indique un budget entre 20 et 1000 CHF, ou laisse vide.'
        }
      }
      if (d.batchEnabled && (d.batchDays.length < 1 || d.batchDays.length > 3)) {
        e.batchDays = 'Choisis entre 1 et 3 jours de cuisine.'
      }
      break
    }
    default:
      break
  }
  return e
}

/** Valide toutes les étapes d'un coup (utile pour l'édition du profil sur une seule page). */
export function validateAll(d: Draft): DraftErrors {
  return STEP_IDS.reduce<DraftErrors>((acc, s) => ({ ...acc, ...validateStep(s, d) }), {})
}

/** Le brouillon est-il assez complet pour calculer les besoins ? */
export function isComputable(d: Draft): boolean {
  return (['identite', 'mensurations', 'objectif', 'activite'] as const).every(
    (s) => Object.keys(validateStep(s, d)).length === 0,
  )
}

/** Transforme un brouillon validé en réglages de profil. */
export function draftToSettings(d: Draft, previous?: ProfileSettings): ProfileSettings {
  const budget = parseNumber(d.weeklyBudgetChf)
  const startWeightKg = previous?.startWeightKg ?? parseNumber(d.weightKg)
  const targetWeightKg = parseNumber(d.targetWeightKg)
  return {
    ...(previous ?? DEFAULT_SETTINGS),
    sex: d.sex ?? 'femme',
    age: Math.round(parseNumber(d.age)),
    heightCm: parseNumber(d.heightCm),
    startWeightKg,
    targetWeightKg,
    activityLevel: d.activityLevel ?? 2,
    mealsPerDay: d.mealsPerDay,
    restrictions: d.restrictions,
    kosher: { waitAfterMeatHours: d.kosherWait, separateFishAndMeat: d.separateFishAndMeat, waitAfterMilk: d.kosherWaitAfterMilk },
    shabbat: { enabled: d.shabbat, festiveMeals: d.shabbatFestive, noCookingSaturday: d.shabbatNoCooking },
    dislikedFoods: d.dislikedFoods,
    weeklyBudgetChf: Number.isFinite(budget) ? budget : null,
    lowBudget: d.lowBudget,
    batch: { enabled: d.batchEnabled, sessionDays: [...d.batchDays].sort((a, b) => a - b) },
    // Si l'objectif change, on quitte le mode maintien.
    maintenanceMode:
      previous?.maintenanceMode === true && previous.targetWeightKg === targetWeightKg
        ? true
        : false,
  }
}

/** Pré-remplit le brouillon depuis un profil existant (écran Profil). */
export function settingsToDraft(name: string, s: ProfileSettings, currentWeightKg: number): Draft {
  return {
    name,
    sex: s.sex,
    age: String(s.age),
    heightCm: fmt(s.heightCm),
    weightKg: fmt(currentWeightKg),
    targetWeightKg: fmt(s.targetWeightKg),
    activityLevel: s.activityLevel,
    mealsPerDay: s.mealsPerDay,
    restrictions: s.restrictions,
    kosherWait: s.kosher.waitAfterMeatHours,
    kosherWaitAfterMilk: s.kosher.waitAfterMilk ?? false,
    separateFishAndMeat: s.kosher.separateFishAndMeat,
    shabbat: s.shabbat.enabled,
    shabbatFestive: s.shabbat.festiveMeals,
    shabbatNoCooking: s.shabbat.noCookingSaturday,
    dislikedFoods: s.dislikedFoods,
    weeklyBudgetChf: s.weeklyBudgetChf == null ? '' : fmt(s.weeklyBudgetChf),
    lowBudget: s.lowBudget,
    batchEnabled: s.batch.enabled,
    batchDays: s.batch.sessionDays,
  }
}

/** Texte d'aide qui décrit l'objectif en direct pendant la saisie. */
export function describeGoal(d: Draft): string | null {
  const w = parseNumber(d.weightKg)
  const t = parseNumber(d.targetWeightKg)
  if (!Number.isFinite(w) || !Number.isFinite(t)) return null
  const diff = Math.round((t - w) * 10) / 10
  if (Math.abs(diff) < GOAL_TOLERANCE_KG) return 'Objectif : maintenir ton poids actuel.'
  return diff < 0
    ? `Objectif : perdre ${fmt(Math.abs(diff))} kg, à un rythme doux.`
    : `Objectif : prendre ${fmt(diff)} kg, progressivement.`
}
