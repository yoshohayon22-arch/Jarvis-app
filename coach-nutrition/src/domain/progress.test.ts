import { describe, expect, it } from 'vitest'
import { progressPercent } from './progress'

describe('% du chemin parcouru', () => {
  it('perte : 80 → 75, actuel 77,5 = 50 %', () => expect(progressPercent(80, 77.5, 75)).toBe(50))
  it('prise : 60 → 66, actuel 63 = 50 %', () => expect(progressPercent(60, 63, 66)).toBe(50))
  it('reste entre 0 et 100 %', () => {
    expect(progressPercent(80, 82, 75)).toBe(0)
    expect(progressPercent(80, 73, 75)).toBe(100)
  })
})
