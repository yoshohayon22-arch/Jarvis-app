/** Libellés et options du formulaire de profil (textes affichés à l'utilisateur). */
import type { DayOfWeek, KosherWaitHours, MealsPerDay, Restriction } from '../../domain/types'
import type { StepId } from './draft'

export const STEP_TITLES: Record<StepId, { title: string; subtitle: string }> = {
  identite: { title: 'Faisons connaissance', subtitle: 'Quelques infos pour personnaliser tes calculs.' },
  mensurations: { title: 'Taille et poids', subtitle: 'Ton point de départ, sans jugement.' },
  objectif: { title: 'Ton objectif', subtitle: 'Le poids que tu aimerais atteindre.' },
  activite: { title: 'Ton niveau d’activité', subtitle: 'Choisis ce qui ressemble à ta semaine type.' },
  repas: { title: 'Tes repas', subtitle: 'Combien de fois manges-tu par jour ?' },
  restrictions: { title: 'Ce que tu manges', subtitle: 'Restrictions et aliments que tu n’aimes pas.' },
  organisation: { title: 'Budget et organisation', subtitle: 'Pour adapter le menu à ton quotidien.' },
  recapitulatif: { title: 'Tes besoins', subtitle: 'Voici ce que l’on te propose.' },
}

export const RESTRICTION_OPTIONS: { value: Restriction; label: string; description: string }[] = [
  {
    value: 'casher',
    label: 'Casher',
    description: 'Pas de porc, lapin ni fruits de mer ; jamais viande et lait dans le même repas.',
  },
  {
    value: 'halal',
    label: 'Halal',
    description: 'Pas de porc ni dérivés (gélatine, saindoux), pas d’alcool même en cuisine.',
  },
  { value: 'vegetarien', label: 'Végétarien', description: 'Ni viande ni poisson.' },
  { value: 'sans-gluten', label: 'Sans gluten', description: 'Blé, orge, seigle, épeautre exclus.' },
  { value: 'sans-lactose', label: 'Sans lactose', description: 'Lait et produits laitiers classiques exclus.' },
  { value: 'sans-arachides', label: 'Sans arachides', description: 'Cacahuètes et dérivés exclus.' },
]

export const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 0, label: 'Lundi' },
  { value: 1, label: 'Mardi' },
  { value: 2, label: 'Mercredi' },
  { value: 3, label: 'Jeudi' },
  { value: 4, label: 'Vendredi' },
  { value: 5, label: 'Samedi' },
  { value: 6, label: 'Dimanche' },
]

export const MEAL_OPTIONS: { value: MealsPerDay; label: string; description: string }[] = [
  { value: 3, label: '3 repas', description: 'Petit-déjeuner, déjeuner, dîner.' },
  { value: 4, label: '4 repas', description: '3 repas + 1 collation.' },
  { value: 5, label: '5 repas', description: '3 repas + 2 collations.' },
]

export const KOSHER_WAIT_OPTIONS: { value: KosherWaitHours; label: string; description: string }[] = [
  { value: 0, label: 'Aucun délai', description: 'Seulement : pas de mélange dans le même repas.' },
  { value: 1, label: '1 heure', description: 'Tradition néerlandaise.' },
  { value: 3, label: '3 heures', description: 'Tradition allemande.' },
  { value: 6, label: '6 heures', description: 'Tradition la plus répandue.' },
]
