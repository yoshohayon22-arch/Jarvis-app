/**
 * État global de l'application : données de tous les profils + profil actif.
 * Chaque modification est immédiatement sauvegardée via la couche storage.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppData, Profile } from '../domain/types'
import { storage as defaultStorage, type Storage } from '../storage/storage'
import { parseDefaultProfile, seedDefaultProfile, type DefaultProfileSpec } from '../domain/default-profile'

/** Profil de base de l'aperçu personnel (variable de build, absente du site public). */
const ENV_DEFAULT_PROFILE = parseDefaultProfile(import.meta.env.VITE_DEFAULT_PROFILE)

interface AppDataContextValue {
  data: AppData
  activeProfile: Profile | null
  /** Applique une transformation pure aux données puis sauvegarde. */
  update: (fn: (data: AppData) => AppData) => void
  /** Remplace toutes les données (import d'un fichier). */
  replaceAll: (data: AppData) => void
  clearAll: () => void
  storage: Storage
  /** Vrai pendant la création du profil de base (quelques dixièmes de seconde). */
  seeding: boolean
  /** Un profil de base est configuré : il revient automatiquement si tout est effacé. */
  hasDefaultProfile: boolean
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({
  children,
  storage = defaultStorage,
  defaultProfile = ENV_DEFAULT_PROFILE,
}: {
  children: ReactNode
  storage?: Storage
  defaultProfile?: DefaultProfileSpec | null
}) {
  const [data, setData] = useState<AppData>(() => storage.load())
  const seeding = Boolean(defaultProfile) && data.profiles.length === 0

  // Aucun profil et un profil de base configuré : on le crée, avec son menu de la semaine.
  // Le catalogue de recettes est chargé à la demande pour ne pas alourdir le démarrage.
  useEffect(() => {
    if (!seeding) return
    let cancelled = false
    import('../domain/catalog').then(({ RECIPES, INGREDIENT_MAP }) => {
      if (cancelled) return
      setData((prev) => {
        const next = seedDefaultProfile(prev, defaultProfile ?? null, { recipes: RECIPES, ingredients: INGREDIENT_MAP })
        if (next !== prev) storage.save(next)
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [seeding, defaultProfile, storage])

  const update = useCallback(
    (fn: (d: AppData) => AppData) => {
      setData((prev) => {
        const next = fn(prev)
        storage.save(next)
        return next
      })
    },
    [storage],
  )

  const replaceAll = useCallback(
    (next: AppData) => {
      storage.save(next)
      setData(next)
    },
    [storage],
  )

  const clearAll = useCallback(() => {
    storage.clearAll()
    setData(storage.load())
  }, [storage])

  const value = useMemo<AppDataContextValue>(
    () => ({
      data,
      activeProfile: data.profiles.find((p) => p.id === data.activeProfileId) ?? null,
      update,
      replaceAll,
      clearAll,
      storage,
      seeding,
      hasDefaultProfile: Boolean(defaultProfile),
    }),
    [data, update, replaceAll, clearAll, storage, seeding, defaultProfile],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData doit être utilisé dans <AppDataProvider>')
  return ctx
}
