/**
 * Petite pluie de feuilles pour célébrer un moment fort (objectif atteint, plan de maintien).
 * Purement décorative (aria-hidden) ; masquée si le système demande moins d'animations.
 */
import { useMemo } from 'react'

const COLORS = ['#34d37f', '#07964f', '#a7f3c8', '#fcb94d', '#12b862']

export function Celebrate({ count = 18, seed = 1 }: { count?: number; seed?: number }) {
  // Positions pseudo-aléatoires mais stables (pas de saut au re-rendu).
  const leaves = useMemo(() => {
    let s = seed * 9301 + 49297
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    return Array.from({ length: count }, (_, i) => ({
      dx: `${Math.round((rnd() - 0.5) * 420)}px`,
      dy: `${Math.round(120 + rnd() * 220)}px`,
      rot: `${Math.round((rnd() - 0.5) * 720)}deg`,
      delay: `${Math.round(rnd() * 250)}ms`,
      size: 8 + Math.round(rnd() * 8),
      color: COLORS[i % COLORS.length],
    }))
  }, [count, seed])
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {leaves.map((l, i) => (
        <svg
          key={i}
          className="leaf"
          width={l.size}
          height={l.size}
          viewBox="0 0 10 10"
          style={{ ['--dx' as string]: l.dx, ['--dy' as string]: l.dy, ['--rot' as string]: l.rot, animationDelay: l.delay }}
        >
          <path d="M5 0 C9 2 9 8 5 10 C1 8 1 2 5 0Z" fill={l.color} />
        </svg>
      ))}
    </div>
  )
}
