import { describe, expect, it } from 'vitest'
import { countUpValue, easeOutCubic } from './motion'

describe('Compteur animé', () => {
  it('part de la valeur de départ et arrive exactement à la valeur finale', () => {
    expect(countUpValue(0, 2310, 0)).toBe(0)
    expect(countUpValue(0, 2310, 1)).toBe(2310)
    expect(countUpValue(2000, 2310, 2)).toBe(2310) // au-delà de la durée : valeur finale
  })
  it('ralentit à l’arrivée (plus de la moitié du chemin à mi-temps)', () => {
    expect(countUpValue(0, 100, 0.5)).toBeGreaterThan(50)
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875)
  })
})
