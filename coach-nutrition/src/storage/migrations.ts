/**
 * Migrations du schéma de données.
 *
 * À chaque changement de structure, on incrémente CURRENT_SCHEMA_VERSION et on ajoute
 * une étape dans MIGRATIONS. Ainsi, un ancien fichier exporté ou d'anciennes données
 * dans le navigateur restent toujours lisibles.
 */
import type { AppData, ProfileSettings } from '../domain/types'

export const CURRENT_SCHEMA_VERSION = 1

/** Valeurs par défaut des réglages, utilisées pour compléter des données anciennes ou partielles. */
export const DEFAULT_SETTINGS: ProfileSettings = {
  sex: 'femme',
  age: 30,
  heightCm: 170,
  startWeightKg: 70,
  targetWeightKg: 65,
  activityLevel: 2,
  mealsPerDay: 3,
  restrictions: [],
  kosher: { waitAfterMeatHours: 3, separateFishAndMeat: true },
  dislikedFoods: [],
  weeklyBudgetChf: null,
  lowBudget: false,
  batch: { enabled: false, sessionDays: [6] },
  gainSurplusKcal: 300,
  maintenanceMode: false,
}

type Migration = (data: AppData) => AppData

/** MIGRATIONS[n] fait passer les données de la version n à la version n + 1. */
const MIGRATIONS: Record<number, Migration> = {
  // Exemple pour plus tard :
  // 1: (d) => ({ ...d, schemaVersion: 2, profiles: d.profiles.map(...) }),
}

/** Complète les champs manquants d'un profil avec les valeurs par défaut. */
function normalize(data: AppData): AppData {
  return {
    ...data,
    profiles: data.profiles.map((p) => ({
      ...p,
      weighIns: Array.isArray(p.weighIns) ? p.weighIns : [],
      menu: p.menu ? { ...p.menu, batch: p.menu.batch ?? null, bowls: p.menu.bowls ?? [] } : null,
      shoppingChecks: p.shoppingChecks ?? {},
      settings: {
        ...DEFAULT_SETTINGS,
        ...p.settings,
        kosher: { ...DEFAULT_SETTINGS.kosher, ...p.settings?.kosher },
        batch: { ...DEFAULT_SETTINGS.batch, ...p.settings?.batch },
      },
    })),
  }
}

export function migrate(data: AppData): AppData {
  let current = { ...data }
  while (current.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[current.schemaVersion]
    if (!step) throw new Error(`Migration manquante depuis la version ${current.schemaVersion}`)
    current = step(current)
  }
  return normalize(current)
}
