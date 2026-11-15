/**
 * Calculs nutritionnels — fonctions pures, sans effet de bord.
 *
 * Références :
 * - Mifflin MD, St Jeor ST et al. (1990), Am J Clin Nutr 51:241-247 (métabolisme de base).
 * - Facteurs d'activité classiques (FAO/OMS, Harris-Benedict révisé) : 1,2 à 1,9.
 * - ISSN Position Stand (2017) : protéines 1,4–2,0 g/kg pour les personnes actives.
 * - Règle empirique : 1 kg de masse grasse ≈ 7 700 kcal.
 */
import type {
  ActivityLevel,
  GoalMode,
  Macros,
  NutritionTargets,
  ProfileSettings,
  Sex,
} from './types'

/** Énergie approximative contenue dans 1 kg de tissu adipeux. */
export const KCAL_PER_KG = 7700

/** Planchers caloriques de sécurité, jamais franchis. */
export const CALORIE_FLOOR: Record<Sex, number> = { homme: 1500, femme: 1200 }

export const DEFICIT_MIN = 300
export const DEFICIT_MAX = 500
export const SURPLUS_MIN = 250
export const SURPLUS_MAX = 400
export const SURPLUS_DEFAULT = 300

/** Perte visée : 0,5 % du poids par semaine. */
export const TARGET_WEEKLY_LOSS_RATIO = 0.005

/** En dessous de cet écart (kg) entre poids actuel et cible, on considère l'objectif atteint. */
export const GOAL_TOLERANCE_KG = 0.5

export interface ActivityLevelInfo {
  level: ActivityLevel
  factor: number
  label: string
  example: string
}

/** Les 5 niveaux d'activité, avec un exemple concret pour aider à choisir. */
export const ACTIVITY_LEVELS: readonly ActivityLevelInfo[] = [
  {
    level: 1,
    factor: 1.2,
    label: 'Sédentaire',
    example: 'Travail de bureau, peu de marche, pas de sport.',
  },
  {
    level: 2,
    factor: 1.375,
    label: 'Légèrement actif',
    example: '1 à 3 séances légères par semaine, ou environ 30 min de marche par jour.',
  },
  {
    level: 3,
    factor: 1.55,
    label: 'Modérément actif',
    example: '3 à 5 séances de sport par semaine (course, fitness, vélo).',
  },
  {
    level: 4,
    factor: 1.725,
    label: 'Très actif',
    example: '6 à 7 séances par semaine, ou métier physique (chantier, livraison à vélo).',
  },
  {
    level: 5,
    factor: 1.9,
    label: 'Extrêmement actif',
    example: 'Entraînement 2 fois par jour, ou métier très physique + sport régulier.',
  },
]

/** Arrondit à la dizaine la plus proche (pratique pour afficher des kcal). */
export function roundTo10(value: number): number {
  return Math.round(value / 10) * 10
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Métabolisme de base (kcal/jour) selon Mifflin-St Jeor.
 * Homme : 10·kg + 6,25·cm − 5·âge + 5
 * Femme : 10·kg + 6,25·cm − 5·âge − 161
 */
export function computeBmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'homme' ? base + 5 : base - 161
}

export function activityFactor(level: ActivityLevel): number {
  const info = ACTIVITY_LEVELS.find((a) => a.level === level)
  if (!info) throw new Error(`Niveau d'activité inconnu : ${level}`)
  return info.factor
}

/** Dépense énergétique totale (TDEE) = métabolisme de base × facteur d'activité. */
export function computeTdee(bmr: number, level: ActivityLevel): number {
  return bmr * activityFactor(level)
}

/** Indice de masse corporelle : kg / m². */
export function computeBmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return weightKg / (m * m)
}

/** Poids (kg) correspondant à un IMC donné pour une taille donnée. */
export function weightForBmi(bmi: number, heightCm: number): number {
  const m = heightCm / 100
  return bmi * m * m
}

/** Détermine l'objectif à partir du poids actuel et du poids cible. */
export function determineGoal(
  currentKg: number,
  targetKg: number,
  maintenanceMode = false,
): GoalMode {
  if (maintenanceMode) return 'maintien'
  const diff = targetKg - currentKg
  if (Math.abs(diff) < GOAL_TOLERANCE_KG) return 'maintien'
  return diff < 0 ? 'perte' : 'prise'
}

/**
 * Déficit journalier pour perdre ~0,5 % du poids par semaine,
 * borné entre 300 et 500 kcal/jour.
 * Exemple : 80 kg → 0,4 kg/sem → 0,4 × 7700 / 7 = 440 kcal/jour.
 */
export function computeDeficit(weightKg: number): number {
  const ideal = (weightKg * TARGET_WEEKLY_LOSS_RATIO * KCAL_PER_KG) / 7
  return clamp(ideal, DEFICIT_MIN, DEFICIT_MAX)
}

/** Surplus journalier pour une prise de poids, borné entre 250 et 400 kcal/jour. */
export function computeSurplus(requested: number = SURPLUS_DEFAULT): number {
  return clamp(requested, SURPLUS_MIN, SURPLUS_MAX)
}

/**
 * Poids de référence pour les protéines et les lipides.
 * Si l'IMC est ≥ 30, on utilise le poids correspondant à un IMC de 25 :
 * sinon on obtiendrait des quantités irréalistes (ex. 240 g de protéines à 120 kg).
 */
export function referenceWeight(weightKg: number, heightCm: number): number {
  if (computeBmi(weightKg, heightCm) >= 30) return weightForBmi(25, heightCm)
  return weightKg
}

/** Protéines visées (g/kg) selon l'objectif : plus élevées en déficit pour préserver le muscle. */
export const PROTEIN_G_PER_KG: Record<GoalMode, number> = {
  perte: 2.0,
  prise: 1.8,
  maintien: 1.6,
}
export const PROTEIN_MIN_G_PER_KG = 1.6
export const FAT_MIN_G_PER_KG = 0.8
/** Les lipides représentent au moins 20 % des calories (hormones, vitamines liposolubles). */
export const FAT_MIN_RATIO = 0.2

/**
 * Répartition des macronutriments.
 * - Protéines : 1,6 à 2,0 g/kg (poids de référence)
 * - Lipides : au moins 0,8 g/kg ET au moins 20 % des calories
 * - Glucides : le reste
 * Si les calories sont trop basses pour tout caser, on réduit d'abord les lipides
 * vers leur minimum, puis les protéines vers 1,6 g/kg ; les glucides ne sont jamais négatifs.
 */
export function computeMacros(targetKcal: number, refWeightKg: number, goal: GoalMode): Macros {
  let proteinG = refWeightKg * PROTEIN_G_PER_KG[goal]
  const fatMinG = refWeightKg * FAT_MIN_G_PER_KG
  let fatG = Math.max(fatMinG, (targetKcal * FAT_MIN_RATIO) / 9)

  let remaining = targetKcal - proteinG * 4 - fatG * 9
  if (remaining < 0) {
    // 1) on ramène les lipides au minimum par kg
    fatG = fatMinG
    remaining = targetKcal - proteinG * 4 - fatG * 9
  }
  if (remaining < 0) {
    // 2) on ramène les protéines au minimum de la fourchette
    proteinG = Math.max(refWeightKg * PROTEIN_MIN_G_PER_KG, (targetKcal - fatG * 9) / 4)
    remaining = targetKcal - proteinG * 4 - fatG * 9
  }
  const carbsG = Math.max(0, remaining / 4)

  return {
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    carbsG: Math.round(carbsG),
  }
}

/** Calories apportées par une répartition de macros (4 / 9 / 4 kcal par gramme). */
export function macrosToKcal(m: Macros): number {
  return m.proteinG * 4 + m.fatG * 9 + m.carbsG * 4
}

/** Ajoute un nombre de jours à une date AAAA-MM-JJ (en UTC pour éviter les décalages d'heure d'été). */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + Math.round(days))
  return d.toISOString().slice(0, 10)
}

/** Date du jour au format AAAA-MM-JJ, dans le fuseau local. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** En dessous de cet écart journalier (kcal), on ne peut pas estimer de date fiable. */
export const MIN_DELTA_FOR_ESTIMATE = 50

/**
 * Date estimée pour atteindre l'objectif :
 * jours = |poids cible − poids actuel| × 7700 / écart calorique journalier.
 * Retourne null si l'écart journalier est trop faible pour une estimation fiable.
 */
export function estimateGoalDate(
  currentKg: number,
  targetKg: number,
  dailyDeltaKcal: number,
  fromDate: string,
): string | null {
  const delta = Math.abs(dailyDeltaKcal)
  if (delta < MIN_DELTA_FOR_ESTIMATE) return null
  const days = (Math.abs(targetKg - currentKg) * KCAL_PER_KG) / delta
  return addDays(fromDate, Math.ceil(days))
}

/**
 * Calcul complet des besoins à partir du profil et du poids actuel.
 * `currentWeightKg` est le poids de tendance (moyenne mobile) si disponible :
 * c'est lui qu'on utilise à chaque nouvelle pesée pour recalculer la date estimée.
 */
export function computeTargets(
  settings: Pick<
    ProfileSettings,
    | 'sex'
    | 'age'
    | 'heightCm'
    | 'targetWeightKg'
    | 'activityLevel'
    | 'gainSurplusKcal'
    | 'maintenanceMode'
  >,
  currentWeightKg: number,
  fromDate: string = todayIso(),
): NutritionTargets {
  const { sex, age, heightCm, targetWeightKg, activityLevel } = settings
  const bmr = computeBmr(sex, currentWeightKg, heightCm, age)
  const tdee = computeTdee(bmr, activityLevel)
  const goal = determineGoal(currentWeightKg, targetWeightKg, settings.maintenanceMode)

  let rawTarget = tdee
  if (goal === 'perte') rawTarget = tdee - computeDeficit(currentWeightKg)
  if (goal === 'prise') rawTarget = tdee + computeSurplus(settings.gainSurplusKcal)

  // Garde-fou : jamais sous le plancher de sécurité.
  const floor = CALORIE_FLOOR[sex]
  const floorApplied = rawTarget < floor
  const targetKcal = roundTo10(Math.max(rawTarget, floor))

  // Écart réel après arrondi et plancher (c'est lui qui détermine la vitesse).
  const adjustmentKcal = Math.round(targetKcal - tdee)
  const expectedWeeklyChangeKg =
    goal === 'maintien' ? 0 : Math.round(((adjustmentKcal * 7) / KCAL_PER_KG) * 100) / 100

  const refWeightKg = referenceWeight(currentWeightKg, heightCm)
  const macros = computeMacros(targetKcal, refWeightKg, goal)

  // Si le plancher annule le déficit, l'écart peut changer de signe : pas d'estimation possible.
  const deltaHasRightSign =
    (goal === 'perte' && adjustmentKcal < 0) || (goal === 'prise' && adjustmentKcal > 0)
  const estimatedGoalDate =
    goal !== 'maintien' && deltaHasRightSign
      ? estimateGoalDate(currentWeightKg, targetWeightKg, adjustmentKcal, fromDate)
      : null

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    goal,
    adjustmentKcal,
    targetKcal,
    floorApplied,
    macros,
    expectedWeeklyChangeKg,
    estimatedGoalDate,
    referenceWeightKg: Math.round(refWeightKg * 10) / 10,
  }
}
