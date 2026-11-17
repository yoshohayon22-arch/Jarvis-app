import { describe, expect, it } from 'vitest'
import { INGREDIENT_MAP, RECIPES } from './catalog'
import { parseDefaultProfile, seedDefaultProfile } from './default-profile'
import { activeTechnique } from './techniques'
import { emptyAppData } from '../storage/storage'

// Données fictives (les vraies vivent dans .env.preview.local, hors du dépôt).
const SPEC = JSON.stringify({
  name: 'Test',
  settings: {
    sex: 'femme', age: 50, heightCm: 160, startWeightKg: 60, targetWeightKg: 57, activityLevel: 2,
    mealsPerDay: 2, technique: 'jeune-16-8', mealsBeforeFasting: 3,
    restrictions: ['casher'], kosher: { waitAfterMeatHours: 4 },
    shabbat: { enabled: true }, lowBudget: true, batch: { enabled: true, sessionDays: [6] },
  },
})
const catalog = { recipes: RECIPES, ingredients: INGREDIENT_MAP }
const now = new Date('2026-11-17T09:00:00')

describe('Profil de base', () => {
  it('lit le JSON et complète les réglages manquants avec les valeurs par défaut', () => {
    const spec = parseDefaultProfile(SPEC)!
    expect(spec.name).toBe('Test')
    expect(spec.settings.kosher).toEqual({ waitAfterMeatHours: 4, separateFishAndMeat: true, waitAfterMilk: false })
    expect(spec.settings.shabbat).toEqual({ enabled: true, festiveMeals: true, noCookingSaturday: true })
    expect(spec.settings.dislikedFoods).toEqual([])
  })

  it('refuse un profil absent, illisible ou hors des garde-fous santé', () => {
    expect(parseDefaultProfile(undefined)).toBeNull()
    expect(parseDefaultProfile('pas du json')).toBeNull()
    expect(parseDefaultProfile(JSON.stringify({ settings: {} }))).toBeNull()
    const s = JSON.parse(SPEC)
    expect(parseDefaultProfile(JSON.stringify({ ...s, settings: { ...s.settings, age: 16 } }))).toBeNull()
    // Poids cible sous un IMC de 18,5 (160 cm → 47,4 kg minimum)
    expect(parseDefaultProfile(JSON.stringify({ ...s, settings: { ...s.settings, targetWeightKg: 45 } }))).toBeNull()
  })

  it('crée le profil avec son menu de la semaine quand l’application est vide', () => {
    const data = seedDefaultProfile(emptyAppData(), parseDefaultProfile(SPEC), catalog, now)
    expect(data.profiles).toHaveLength(1)
    expect(data.introSeen).toBe(true)
    const p = data.profiles[0]
    expect(data.activeProfileId).toBe(p.id)
    expect(p.weighIns).toEqual([{ date: '2026-11-17', kg: 60 }])
    expect(activeTechnique(p.settings)).toBe('jeune-16-8')
    expect(p.menu?.days).toHaveLength(7)
    for (const d of p.menu!.days) expect(d.meals.map((m) => m.slot)).toEqual(['dejeuner', 'diner'])
    expect(p.menu?.batch).not.toBeNull()
  })

  it('ne touche jamais à des données existantes', () => {
    const once = seedDefaultProfile(emptyAppData(), parseDefaultProfile(SPEC), catalog, now)
    expect(seedDefaultProfile(once, parseDefaultProfile(SPEC), catalog, now)).toBe(once)
    expect(seedDefaultProfile(emptyAppData(), null, catalog, now).profiles).toHaveLength(0)
  })
})
