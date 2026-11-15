/**
 * Couche de stockage de l'application.
 *
 * Tout le reste du code passe par ce module, jamais directement par localStorage :
 * le jour où on voudra une vraie base de données, il suffira d'écrire un nouvel
 * adaptateur qui respecte l'interface `StorageBackend`.
 */
import type { AppData } from '../domain/types'
import { CURRENT_SCHEMA_VERSION, migrate } from './migrations'

/** Clé unique utilisée dans le navigateur. */
export const STORAGE_KEY = 'coach-nutrition:data'

/** Ce qu'un « moteur » de stockage doit savoir faire. */
export interface StorageBackend {
  read(key: string): string | null
  write(key: string, value: string): void
  remove(key: string): void
}

/** Adaptateur localStorage (avec repli en mémoire si le navigateur le bloque). */
export function createLocalStorageBackend(): StorageBackend {
  const memory = new Map<string, string>()
  const ls = (() => {
    try {
      const probe = '__coach_probe__'
      window.localStorage.setItem(probe, probe)
      window.localStorage.removeItem(probe)
      return window.localStorage
    } catch {
      return null // navigation privée stricte, cookies bloqués…
    }
  })()
  return {
    read: (key) => (ls ? ls.getItem(key) : (memory.get(key) ?? null)),
    write: (key, value) => (ls ? ls.setItem(key, value) : memory.set(key, value)) as void,
    remove: (key) => (ls ? ls.removeItem(key) : memory.delete(key)) as void,
  }
}

/** Adaptateur en mémoire, utilisé pour les tests. */
export function createMemoryBackend(initial: Record<string, string> = {}): StorageBackend {
  const memory = new Map(Object.entries(initial))
  return {
    read: (key) => memory.get(key) ?? null,
    write: (key, value) => void memory.set(key, value),
    remove: (key) => void memory.delete(key),
  }
}

export function emptyAppData(): AppData {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, activeProfileId: null, profiles: [] }
}

/** Erreur lisible renvoyée quand un fichier importé n'est pas valide. */
export class ImportError extends Error {}

/**
 * Vérifie qu'un objet inconnu ressemble bien à nos données, puis le migre
 * vers la version actuelle du schéma.
 */
export function parseAppData(raw: unknown): AppData {
  if (typeof raw !== 'object' || raw === null) {
    throw new ImportError('Le fichier ne contient pas de données reconnues.')
  }
  const obj = raw as Record<string, unknown>
  // Le fichier d'export enveloppe les données : { app, exportedAt, data }
  const data = (obj.app === 'coach-nutrition' && obj.data ? obj.data : obj) as Record<string, unknown>

  if (typeof data.schemaVersion !== 'number' || !Array.isArray(data.profiles)) {
    throw new ImportError('Ce fichier ne semble pas venir de Coach Nutrition.')
  }
  if (data.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new ImportError(
      'Ce fichier vient d’une version plus récente de l’app. Mets la page à jour puis réessaie.',
    )
  }
  for (const p of data.profiles as unknown[]) {
    const prof = p as Record<string, unknown>
    if (typeof prof?.id !== 'string' || typeof prof?.name !== 'string' || typeof prof?.settings !== 'object') {
      throw new ImportError('Un des profils du fichier est incomplet.')
    }
  }
  const migrated = migrate(data as unknown as AppData)
  // Si le profil actif n'existe pas, on prend le premier.
  if (!migrated.profiles.some((p) => p.id === migrated.activeProfileId)) {
    migrated.activeProfileId = migrated.profiles[0]?.id ?? null
  }
  return migrated
}

export interface Storage {
  load(): AppData
  save(data: AppData): void
  /** Contenu du fichier « Exporter mes données » (JSON lisible). */
  exportJson(data: AppData, now?: Date): string
  /** Lit un fichier importé ; lève une ImportError si invalide. */
  importJson(json: string): AppData
  clearAll(): void
}

export function createStorage(backend: StorageBackend): Storage {
  return {
    load() {
      const raw = backend.read(STORAGE_KEY)
      if (!raw) return emptyAppData()
      try {
        return parseAppData(JSON.parse(raw))
      } catch {
        // Données corrompues : on ne les écrase pas, on les met de côté pour pouvoir les récupérer.
        backend.write(`${STORAGE_KEY}:backup-${Date.now()}`, raw)
        return emptyAppData()
      }
    },
    save(data) {
      backend.write(STORAGE_KEY, JSON.stringify(data))
    },
    exportJson(data, now = new Date()) {
      return JSON.stringify({ app: 'coach-nutrition', exportedAt: now.toISOString(), data }, null, 2)
    },
    importJson(json) {
      let parsed: unknown
      try {
        parsed = JSON.parse(json)
      } catch {
        throw new ImportError('Le fichier n’est pas un JSON valide.')
      }
      return parseAppData(parsed)
    },
    clearAll() {
      backend.remove(STORAGE_KEY)
    },
  }
}

/** Instance utilisée par l'application. */
export const storage = createStorage(
  typeof window !== 'undefined' ? createLocalStorageBackend() : createMemoryBackend(),
)
