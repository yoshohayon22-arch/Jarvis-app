/**
 * État global de l'application : données de tous les profils + profil actif.
 * Chaque modification est immédiatement sauvegardée via la couche storage.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AppData, Profile } from '../domain/types'
import { storage as defaultStorage, type Storage } from '../storage/storage'

interface AppDataContextValue {
  data: AppData
  activeProfile: Profile | null
  /** Applique une transformation pure aux données puis sauvegarde. */
  update: (fn: (data: AppData) => AppData) => void
  /** Remplace toutes les données (import d'un fichier). */
  replaceAll: (data: AppData) => void
  clearAll: () => void
  storage: Storage
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({
  children,
  storage = defaultStorage,
}: {
  children: ReactNode
  storage?: Storage
}) {
  const [data, setData] = useState<AppData>(() => storage.load())

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
    }),
    [data, update, replaceAll, clearAll, storage],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData doit être utilisé dans <AppDataProvider>')
  return ctx
}
