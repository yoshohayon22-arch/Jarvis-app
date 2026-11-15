/**
 * Garde-fous santé — fonctions pures.
 * Les messages sont bienveillants : jamais de « échec », jamais culpabilisants.
 */
import { computeBmi, weightForBmi } from './nutrition'

export const MIN_AGE = 18
export const MIN_HEALTHY_BMI = 18.5

/** Bornes de saisie raisonnables pour éviter les fautes de frappe. */
export const LIMITS = {
  age: { min: 18, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 300 },
} as const

export interface SafetyCheck {
  ok: boolean
  /** Message à afficher si `ok` est faux. */
  message?: string
}

export function checkAge(age: number): SafetyCheck {
  if (!Number.isFinite(age) || age <= 0) {
    return { ok: false, message: 'Indique ton âge pour qu’on puisse calculer tes besoins.' }
  }
  if (age < MIN_AGE) {
    return {
      ok: false,
      message:
        'Cette app est conçue pour les adultes. Avant 18 ans, les besoins changent beaucoup avec la croissance : parle à un médecin ou à un diététicien, il pourra t’accompagner au mieux.',
    }
  }
  if (age > LIMITS.age.max) {
    return { ok: false, message: `Vérifie l’âge saisi (maximum ${LIMITS.age.max} ans).` }
  }
  return { ok: true }
}

export function checkHeight(heightCm: number): SafetyCheck {
  if (!Number.isFinite(heightCm) || heightCm < LIMITS.heightCm.min || heightCm > LIMITS.heightCm.max) {
    return {
      ok: false,
      message: `Indique ta taille en centimètres (entre ${LIMITS.heightCm.min} et ${LIMITS.heightCm.max}).`,
    }
  }
  return { ok: true }
}

export function checkWeight(weightKg: number): SafetyCheck {
  if (!Number.isFinite(weightKg) || weightKg < LIMITS.weightKg.min || weightKg > LIMITS.weightKg.max) {
    return {
      ok: false,
      message: `Indique un poids en kilos (entre ${LIMITS.weightKg.min} et ${LIMITS.weightKg.max}).`,
    }
  }
  return { ok: true }
}

/**
 * Refuse un poids cible qui donnerait un IMC inférieur à 18,5,
 * en expliquant pourquoi et en proposant le poids minimum conseillé.
 */
export function checkTargetWeight(targetKg: number, heightCm: number): SafetyCheck {
  const basic = checkWeight(targetKg)
  if (!basic.ok) return basic
  const bmi = computeBmi(targetKg, heightCm)
  if (bmi < MIN_HEALTHY_BMI) {
    const minKg = Math.ceil(weightForBmi(MIN_HEALTHY_BMI, heightCm) * 10) / 10
    return {
      ok: false,
      message: `Ce poids correspondrait à un IMC de ${bmi.toFixed(1)}, en dessous de 18,5 : à ce niveau, le corps manque souvent d’énergie et de réserves (fatigue, immunité, os). Pour ta taille, on te propose de viser au minimum ${minKg.toLocaleString('fr-CH')} kg. Si tu as une raison particulière, un médecin ou un diététicien pourra en parler avec toi.`,
    }
  }
  return { ok: true }
}

/** Mention affichée en permanence en pied de page. */
export const HEALTH_DISCLAIMER =
  'Cette application donne des repères généraux et ne remplace pas l’avis d’un médecin ou d’un diététicien.'
