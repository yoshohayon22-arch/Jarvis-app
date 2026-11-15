import { describe, expect, it } from 'vitest'
import { draftToSettings, emptyDraft, isComputable, parseNumber, settingsToDraft, validateStep, type Draft } from './draft'

const filled: Draft = {
  ...emptyDraft(),
  name: 'Alex',
  sex: 'homme',
  age: '30',
  heightCm: '180',
  weightKg: '80,5',
  targetWeightKg: '75',
  activityLevel: 3,
}

describe('Saisie des nombres', () => {
  it('accepte la virgule et le point', () => {
    expect(parseNumber('72,5')).toBe(72.5)
    expect(parseNumber('72.5')).toBe(72.5)
    expect(parseNumber(' 80 ')).toBe(80)
    expect(parseNumber('')).toBeNaN()
    expect(parseNumber('abc')).toBeNaN()
  })
})

describe('Validation des étapes', () => {
  it('bloque l’étape identité avant 18 ans', () => {
    const e = validateStep('identite', { ...filled, age: '17' })
    expect(e.age).toContain('parle à un médecin ou à un diététicien')
  })
  it('bloque un poids cible sous IMC 18,5', () => {
    const e = validateStep('objectif', { ...filled, targetWeightKg: '55' })
    expect(e.targetWeightKg).toBeDefined()
  })
  it('budget facultatif mais vérifié s’il est rempli', () => {
    expect(validateStep('organisation', filled)).toEqual({})
    expect(validateStep('organisation', { ...filled, weeklyBudgetChf: '5' }).weeklyBudgetChf).toBeDefined()
  })
  it('batch : 1 à 3 jours', () => {
    expect(validateStep('organisation', { ...filled, batchEnabled: true, batchDays: [] }).batchDays).toBeDefined()
    expect(validateStep('organisation', { ...filled, batchEnabled: true, batchDays: [0, 2, 4, 6] }).batchDays).toBeDefined()
  })
  it('un brouillon complet est calculable', () => {
    expect(isComputable(filled)).toBe(true)
    expect(isComputable(emptyDraft())).toBe(false)
  })
})

describe('Conversion brouillon ↔ réglages', () => {
  it('aller-retour sans perte', () => {
    const s = draftToSettings({ ...filled, restrictions: ['casher'], weeklyBudgetChf: '120' })
    expect(s.startWeightKg).toBe(80.5)
    expect(s.weeklyBudgetChf).toBe(120)
    expect(s.restrictions).toEqual(['casher'])
    const back = settingsToDraft('Alex', s, 80.5)
    expect(back.weightKg).toBe('80,5')
    expect(draftToSettings(back, s)).toEqual(s)
  })
  it('conserve le poids de départ lors d’une modification du profil', () => {
    const s = draftToSettings(filled)
    const edited = draftToSettings({ ...filled, weightKg: '78' }, s)
    expect(edited.startWeightKg).toBe(80.5)
  })
})
