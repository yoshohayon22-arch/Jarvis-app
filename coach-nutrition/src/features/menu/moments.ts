/** Moments de la journée proposés pour « Juste un repas ». */
import type { IdeaMoment } from '../../domain/meal-ideas'

export const MOMENTS: { value: IdeaMoment; label: string }[] = [
  { value: 'petit-dej', label: 'Petit-déjeuner' },
  { value: 'dejeuner', label: 'Déjeuner' },
  { value: 'diner', label: 'Dîner' },
  { value: 'collation', label: 'Collation' },
]

/** Moment proposé par défaut selon l'heure. */
export function momentNow(): IdeaMoment {
  const h = new Date().getHours()
  if (h < 10) return 'petit-dej'
  if (h < 15) return 'dejeuner'
  if (h < 17) return 'collation'
  return 'diner'
}
