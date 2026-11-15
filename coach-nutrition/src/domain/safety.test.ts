import { describe, expect, it } from 'vitest'
import { checkAge, checkHeight, checkTargetWeight, checkWeight } from './safety'

describe('Âge minimum', () => {
  it('refuse en dessous de 18 ans avec un renvoi vers un professionnel', () => {
    const r = checkAge(16)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('parle à un médecin ou à un diététicien')
  })
  it('accepte à partir de 18 ans', () => {
    expect(checkAge(18).ok).toBe(true)
    expect(checkAge(45).ok).toBe(true)
  })
  it('refuse une saisie vide', () => {
    expect(checkAge(Number.NaN).ok).toBe(false)
  })
})

describe('Poids cible et IMC', () => {
  it('refuse un poids cible donnant un IMC < 18,5 et propose un minimum', () => {
    // 170 cm : IMC 18,5 ↔ 53,5 kg
    const r = checkTargetWeight(50, 170)
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/18,5/)
    expect(r.message).toMatch(/53,5/)
  })
  it('accepte un poids cible avec IMC ≥ 18,5', () => {
    expect(checkTargetWeight(54, 170).ok).toBe(true)
  })
  it('n’emploie aucun mot culpabilisant', () => {
    const r = checkTargetWeight(45, 170)
    expect(r.message).not.toMatch(/échec|interdit|mauvais|faute/i)
  })
})

describe('Bornes de saisie', () => {
  it('vérifie la taille et le poids', () => {
    expect(checkHeight(175).ok).toBe(true)
    expect(checkHeight(80).ok).toBe(false)
    expect(checkWeight(70).ok).toBe(true)
    expect(checkWeight(10).ok).toBe(false)
  })
})
