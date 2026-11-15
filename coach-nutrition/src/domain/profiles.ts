/**
 * Opérations pures sur les profils (création, mise à jour, suppression, pesées).
 * Elles renvoient toujours une nouvelle copie des données, sans rien modifier sur place.
 */
import type { AppData, Profile, ProfileSettings, WeekPlan, WeighIn } from './types'
import { todayIso } from './nutrition'

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createProfile(
  name: string,
  settings: ProfileSettings,
  now: Date = new Date(),
  id: string = newId(),
): Profile {
  const iso = now.toISOString()
  return {
    id,
    name: name.trim() || 'Mon profil',
    createdAt: iso,
    updatedAt: iso,
    settings,
    // La première pesée est le poids de départ saisi à l'onboarding.
    weighIns: [{ date: todayIso(now), kg: settings.startWeightKg }],
    menu: null,
    shoppingChecks: {},
  }
}

export function addProfile(data: AppData, profile: Profile): AppData {
  return { ...data, profiles: [...data.profiles, profile], activeProfileId: profile.id }
}

export function updateProfile(
  data: AppData,
  id: string,
  patch: { name?: string; settings?: ProfileSettings },
  now: Date = new Date(),
): AppData {
  return {
    ...data,
    profiles: data.profiles.map((p) =>
      p.id === id
        ? {
            ...p,
            name: patch.name?.trim() || p.name,
            settings: patch.settings ?? p.settings,
            updatedAt: now.toISOString(),
          }
        : p,
    ),
  }
}

export function removeProfile(data: AppData, id: string): AppData {
  const profiles = data.profiles.filter((p) => p.id !== id)
  const activeProfileId =
    data.activeProfileId === id ? (profiles[0]?.id ?? null) : data.activeProfileId
  return { ...data, profiles, activeProfileId }
}

export function setActiveProfile(data: AppData, id: string): AppData {
  if (!data.profiles.some((p) => p.id === id)) return data
  return { ...data, activeProfileId: id }
}

/** Ajoute ou remplace la pesée d'une date donnée, puis trie par date. */
export function upsertWeighIn(data: AppData, profileId: string, entry: WeighIn): AppData {
  return {
    ...data,
    profiles: data.profiles.map((p) => {
      if (p.id !== profileId) return p
      const others = p.weighIns.filter((w) => w.date !== entry.date)
      const weighIns = [...others, entry].sort((a, b) => a.date.localeCompare(b.date))
      return { ...p, weighIns }
    }),
  }
}

/** Dernier poids connu, ou le poids de départ s'il n'y a aucune pesée. */
export function latestWeight(profile: Profile): number {
  const last = profile.weighIns[profile.weighIns.length - 1]
  return last ? last.kg : profile.settings.startWeightKg
}

/** Enregistre (ou efface) le menu de la semaine d'un profil. */
export function setMenu(data: AppData, profileId: string, menu: WeekPlan | null): AppData {
  return {
    ...data,
    profiles: data.profiles.map((p) => (p.id === profileId ? { ...p, menu } : p)),
  }
}

/** Coche / décoche un article d'une liste de courses. */
export function toggleShoppingCheck(data: AppData, profileId: string, listId: string, itemId: string): AppData {
  return {
    ...data,
    profiles: data.profiles.map((p) => {
      if (p.id !== profileId) return p
      const current = p.shoppingChecks[listId] ?? []
      const next = current.includes(itemId) ? current.filter((x) => x !== itemId) : [...current, itemId]
      return { ...p, shoppingChecks: { ...p.shoppingChecks, [listId]: next } }
    }),
  }
}
