/** Nombre qui défile jusqu'à sa valeur (calories, coûts). Annoncé une seule fois, à sa valeur finale. */
import { useCountUp } from '../lib/motion'

export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString('fr-CH'),
  className = '',
}: {
  value: number
  format?: (n: number) => string
  className?: string
}) {
  const shown = useCountUp(value)
  return (
    <span className={className}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}
