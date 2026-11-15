import { describe, expect, it } from 'vitest'
import { createMemoryBackend, createStorage, ImportError, STORAGE_KEY } from './storage'
import { DEFAULT_SETTINGS } from './migrations'
import { addProfile, createProfile, removeProfile, upsertWeighIn, latestWeight } from '../domain/profiles'
import type { AppData } from '../domain/types'

function sampleData(): AppData {
  const now = new Date('2026-01-01T10:00:00Z')
  let data: AppData = { schemaVersion: 1, activeProfileId: null, profiles: [] }
  data = addProfile(data, createProfile('Alex', { ...DEFAULT_SETTINGS, startWeightKg: 80 }, now, 'a'))
  data = addProfile(data, createProfile('Sam', DEFAULT_SETTINGS, now, 'b'))
  return data
}

describe('Stockage', () => {
  it('renvoie des données vides au premier lancement', () => {
    const s = createStorage(createMemoryBackend())
    expect(s.load()).toEqual({ schemaVersion: 1, activeProfileId: null, profiles: [] })
  })

  it('sauvegarde puis relit à l’identique', () => {
    const s = createStorage(createMemoryBackend())
    const data = sampleData()
    s.save(data)
    expect(s.load()).toEqual(data)
  })

  it('export → import redonne exactement les mêmes données', () => {
    const s = createStorage(createMemoryBackend())
    const data = sampleData()
    const json = s.exportJson(data, new Date('2026-02-01T00:00:00Z'))
    expect(JSON.parse(json).app).toBe('coach-nutrition')
    expect(s.importJson(json)).toEqual(data)
  })

  it('refuse un fichier invalide avec un message lisible', () => {
    const s = createStorage(createMemoryBackend())
    expect(() => s.importJson('pas du json')).toThrow(ImportError)
    expect(() => s.importJson('{"foo": 1}')).toThrow(ImportError)
    expect(() => s.importJson('{"schemaVersion": 99, "profiles": []}')).toThrow(/plus récente/)
  })

  it('complète les champs manquants d’un ancien fichier', () => {
    const s = createStorage(createMemoryBackend())
    const partial = {
      schemaVersion: 1,
      activeProfileId: 'x',
      profiles: [{ id: 'x', name: 'Ancien', createdAt: '', updatedAt: '', settings: { sex: 'homme' } }],
    }
    const data = s.importJson(JSON.stringify(partial))
    expect(data.profiles[0].settings.kosher.separateFishAndMeat).toBe(true)
    expect(data.profiles[0].settings.sex).toBe('homme')
    expect(data.profiles[0].weighIns).toEqual([])
  })

  it('met de côté des données corrompues au lieu de les perdre', () => {
    const backend = createMemoryBackend({ [STORAGE_KEY]: '{corrompu' })
    const s = createStorage(backend)
    expect(s.load().profiles).toEqual([])
    // les données d'origine restent récupérables : une copie de sauvegarde existe
    expect(backend.read(STORAGE_KEY)).toBe('{corrompu')
  })

  it('« Tout effacer » supprime les données', () => {
    const s = createStorage(createMemoryBackend())
    s.save(sampleData())
    s.clearAll()
    expect(s.load().profiles).toHaveLength(0)
  })
})

describe('Profils multiples', () => {
  it('le dernier profil ajouté devient actif, la suppression bascule sur un autre', () => {
    const data = sampleData()
    expect(data.activeProfileId).toBe('b')
    const after = removeProfile(data, 'b')
    expect(after.activeProfileId).toBe('a')
    expect(after.profiles).toHaveLength(1)
  })

  it('une pesée du même jour remplace la précédente, les pesées restent triées', () => {
    let data = sampleData()
    data = upsertWeighIn(data, 'a', { date: '2026-01-10', kg: 79 })
    data = upsertWeighIn(data, 'a', { date: '2026-01-05', kg: 79.5 })
    data = upsertWeighIn(data, 'a', { date: '2026-01-10', kg: 78.8 })
    const a = data.profiles.find((p) => p.id === 'a')!
    expect(a.weighIns.map((w) => w.date)).toEqual(['2026-01-01', '2026-01-05', '2026-01-10'])
    expect(latestWeight(a)).toBe(78.8)
  })
})
