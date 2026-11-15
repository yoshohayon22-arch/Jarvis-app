/**
 * Outils de motion design.
 * - useReducedMotion : respecte le réglage « réduire les animations » du système.
 * - useCountUp : fait défiler un nombre jusqu'à sa valeur (calories, coûts).
 */
import { useEffect, useRef, useState } from 'react'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Courbe d'accélération douce (ralentit à l'arrivée). */
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/**
 * Valeur intermédiaire d'une animation de compteur, de `from` à `to`, à l'instant `t` (0 → 1).
 * Fonction pure, testée.
 */
export function countUpValue(from: number, to: number, t: number): number {
  const k = easeOutCubic(Math.min(1, Math.max(0, t)))
  return from + (to - from) * k
}

/**
 * Nombre qui défile vers sa valeur (800 ms) : depuis 0 au premier affichage, puis depuis
 * l'ancienne valeur quand elle change. Sans animation si le système le demande.
 */
export function useCountUp(value: number, duration = 800): number {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  /** Dernière valeur réellement affichée : point de départ si l'animation est interrompue. */
  const current = useRef(0)
  const still = prefersReducedMotion() || typeof requestAnimationFrame === 'undefined'
  useEffect(() => {
    if (still) {
      from.current = value
      return
    }
    const start = performance.now()
    const origin = from.current
    let frame = 0
    const tick = (now: number) => {
      const t = (now - start) / duration
      current.current = countUpValue(origin, value, t)
      setShown(current.current)
      if (t < 1) frame = requestAnimationFrame(tick)
      else from.current = current.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      // On repart de ce qui est affiché (et non de la valeur finale) : pas de saut.
      from.current = current.current
    }
  }, [value, duration, still])
  // Sans animation : on affiche directement la valeur.
  return still ? value : shown
}
