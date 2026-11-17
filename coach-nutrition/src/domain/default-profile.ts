/**
 * Profil de base : créé automatiquement quand l'application ne contient encore aucun profil,
 * pour ne pas tout ressaisir à chaque ouverture de l'aperçu personnel.
 *
 * Les données personnelles ne sont PAS dans le code (le dépôt est public) : elles viennent de la
 * variable de build VITE_DEFAULT_PROFILE, définie dans `.env.local` (ignoré par git), au format JSON :
 *   VITE_DEFAULT_PROFILE={"name":"Prénom","settings":{"sex":"femme","age":40,...}}
 * Sans cette variable (ex. site public Netlify), rien n'est créé : l'onboarding s'affiche normalement.
 *
 * Les mêmes garde-fous que l'onboarding s'appliquent : âge ≥ 18 ans, taille et poids plausibles,
 * poids cible avec un IMC ≥ 18,5. Sinon, le profil n'est pas créé.
 */
import type { Ingredient, Recipe } from './catalog'
import { generateWeek, planningWeekStart } from './menu/generator'
import { computeTargets, todayIso } from './nutrition'
import { addProfile, createProfile, setMenu } from './profiles'
import { checkAge, checkHeight, checkTargetWeight, checkWeight } from './safety'
import type { AppData, ProfileSettings } from './types'
import { DEFAULT_SETTINGS } from '../storage/migrations'

export interface DefaultProfileSpec {
  name: string
  settings: ProfileSettings
}

/**
 * Lit et valide la description du profil de base (JSON). Renvoie null si elle est absente,
 * illisible ou hors des garde-fous santé.
 */
export function parseDefaultProfile(raw: string | undefined | null): DefaultProfileSpec | null {
  if (!raw || !raw.trim()) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const { name, settings } = parsed as { name?: unknown; settings?: unknown }
  if (typeof name !== 'string' || !name.trim() || !settings || typeof settings !== 'object') return null
  const s = settings as Partial<ProfileSettings>
  const merged: ProfileSettings = {
    ...DEFAULT_SETTINGS,
    ...s,
    kosher: { ...DEFAULT_SETTINGS.kosher, ...s.kosher },
    shabbat: { ...DEFAULT_SETTINGS.shabbat, ...s.shabbat },
    batch: { ...DEFAULT_SETTINGS.batch, ...s.batch },
  }
  const checks = [checkAge(merged.age), checkHeight(merged.heightCm), checkWeight(merged.startWeightKg), checkTargetWeight(merged.targetWeightKg, merged.heightCm)]
  if (checks.some((c) => !c.ok)) return null
  return { name: name.trim(), settings: merged }
}

/**
 * Ajoute le profil de base (et son menu de la semaine) si l'application n'a encore aucun profil.
 * Ne touche jamais à des données existantes.
 */
export function seedDefaultProfile(
  data: AppData,
  spec: DefaultProfileSpec | null,
  catalog: { recipes: Recipe[]; ingredients: ReadonlyMap<string, Ingredient> },
  now: Date = new Date(),
): AppData {
  if (!spec || data.profiles.length > 0) return data
  const profile = createProfile(spec.name, spec.settings, now)
  let next: AppData = { ...addProfile(data, profile), introSeen: true }
  // Menu de la semaine prêt dès l'ouverture (si les restrictions le permettent).
  try {
    const t = computeTargets(spec.settings, spec.settings.startWeightKg)
    const menu = generateWeek({
      settings: spec.settings,
      targets: { kcal: t.targetKcal, proteinG: t.macros.proteinG, fatG: t.macros.fatG, carbsG: t.macros.carbsG },
      recipes: catalog.recipes,
      ingredients: catalog.ingredients,
      weekStart: planningWeekStart(todayIso(now)),
      seed: now.getTime() % 1_000_000_000,
      now,
    })
    next = setMenu(next, profile.id, menu)
  } catch {
    // Pas de menu possible : le profil est quand même créé, le menu se générera depuis l'écran Menu.
  }
  return next
}
