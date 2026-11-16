/**
 * Coach basé sur des règles (sans IA) — fonctions pures.
 *
 * Chaque situation a au moins 3 formulations ; on en choisit une selon la date pour varier
 * d'un jour à l'autre sans changer à chaque rechargement de la page.
 * Ton : court, concret, positif. Jamais de « échec », jamais de culpabilisation.
 */
import { formatKg } from '../lib/format'
import {
  daysSinceLastWeighIn,
  goalReached,
  isLosingTooFast,
  isPlateau,
  lastTwoWeeksChanges,
  trendWeight,
  weighInStreak,
} from './tracking'
import type { ProfileSettings, WeighIn } from './types'

export type CoachSituation =
  | 'trop-rapide'
  | 'objectif-atteint'
  | 'rappel-pesee'
  | 'plateau'
  | 'regularite'
  | 'progression'
  | 'maintien'
  | 'bienvenue'

export interface CoachMessage {
  situation: CoachSituation
  tone: 'info' | 'success' | 'attention'
  title: string
  text: string
  /** Action proposée sous le message. */
  action?: 'peser' | 'maintien' | 'recalcul'
}

interface Vars {
  name: string
  days: number
  streak: number
  lostKg: string
  targetKg: string
}

type Template = (v: Vars) => string

/** Textes : au moins 3 versions par situation. */
export const MESSAGES: Record<CoachSituation, { title: string; tone: CoachMessage['tone']; action?: CoachMessage['action']; variants: Template[] }> = {
  'trop-rapide': {
    title: 'On ralentit un peu ?',
    tone: 'attention',
    variants: [
      () => 'Tu perds plus de 1 % de ton poids par semaine depuis 2 semaines. C’est beaucoup : à ce rythme, le corps puise aussi dans ses muscles. Ajoute une collation (yaourt, fruit, poignée d’amandes) ou un peu plus de féculents.',
      () => 'Bravo pour l’énergie, mais la descente est rapide : plus de 1 % par semaine, deux semaines de suite. Un rythme plus doux protège tes muscles et ton moral. Augmente tes portions de 150 à 200 kcal par jour.',
      () => 'Ton corps va un peu trop vite. Pour garder ta force et éviter la fatigue, vise plutôt 0,5 % par semaine : ajoute un féculent au dîner ou une collation protéinée l’après-midi.',
    ],
  },
  'objectif-atteint': {
    title: 'Objectif atteint, bravo !',
    tone: 'success',
    action: 'maintien',
    variants: [
      (v) => `Tu as atteint ${v.targetKg}, ${v.name} ! C’est le fruit de ta régularité. On passe au plan de maintien : tes calories remontent au niveau de ta dépense.`,
      (v) => `${v.targetKg}, c’est fait ! Prends le temps de savourer. Prochaine étape : stabiliser ce poids avec un plan de maintien, plus souple.`,
      (v) => `Félicitations ${v.name} : objectif atteint ! Le maintien est une nouvelle aventure : on garde les bonnes habitudes et on remonte doucement les portions.`,
    ],
  },
  'rappel-pesee': {
    title: 'Petite pesée ?',
    tone: 'info',
    action: 'peser',
    variants: [
      (v) => `Ta dernière pesée date de ${v.days} jours. Une pesée rapide, le matin à jeun, permet de recalculer ta tendance et ta date d’objectif.`,
      (v) => `Cela fait ${v.days} jours sans pesée. Pas de souci : monte sur la balance demain matin, c’est l’affaire de 10 secondes.`,
      () => 'On n’a pas de nouvelles de la balance depuis plus d’une semaine. Une pesée suffit pour remettre ta courbe à jour.',
    ],
  },
  plateau: {
    title: 'Un plateau, c’est normal',
    tone: 'info',
    action: 'recalcul',
    variants: [
      () => 'Ton poids est stable depuis 2 semaines. Trois pistes : peser tes portions quelques jours (huile, fromage, féculents), ajouter 2 000 pas par jour, et recalculer tes besoins avec ton poids actuel.',
      () => 'Deux semaines de stabilité : le corps s’adapte, c’est classique. Vérifie les « petits extras » (sauces, boissons, grignotage), bouge un peu plus au quotidien, et mets à jour tes besoins.',
      () => 'La balance fait une pause. Avant de changer quoi que ce soit : dors-tu assez ? Ensuite, contrôle les portions avec une balance de cuisine et ajoute une marche de 20 minutes. Tu peux aussi recalculer tes besoins.',
    ],
  },
  regularite: {
    title: 'Belle régularité !',
    tone: 'success',
    variants: [
      (v) => `${v.streak} pesées d’affilée : c’est exactement ce qui rend le suivi fiable. Continue comme ça !`,
      (v) => `Déjà ${v.streak} pesées sans interruption. La régularité bat la perfection, et tu le prouves.`,
      (v) => `${v.streak} pesées de suite, chapeau ! Ta courbe est précise grâce à toi.`,
    ],
  },
  progression: {
    title: 'Ça avance',
    tone: 'success',
    variants: [
      (v) => `Déjà ${v.lostKg} de chemin parcouru sur ta tendance. Chaque semaine compte, même les plus lentes.`,
      (v) => `${v.lostKg} en moins sur la moyenne de 7 jours : la tendance va dans le bon sens. Garde le cap.`,
      (v) => `Tendance encourageante : ${v.lostKg} depuis le départ. Les petits pas réguliers font les grands résultats.`,
    ],
  },
  maintien: {
    title: 'Mode maintien',
    tone: 'info',
    variants: [
      () => 'En maintien, une variation de ±1 kg autour de ton poids est normale. Continue de te peser une ou deux fois par semaine.',
      () => 'Ton plan vise désormais la stabilité. Si la moyenne bouge de plus d’1 kg sur 2 semaines, on ajustera les portions.',
      () => 'Le maintien, c’est la liberté retrouvée avec de bons repères. Garde tes repas types et profite !',
    ],
  },
  bienvenue: {
    title: 'Bienvenue !',
    tone: 'info',
    action: 'peser',
    variants: [
      () => 'Pèse-toi une à deux fois par semaine, le matin, dans les mêmes conditions : c’est la tendance qui compte, pas le chiffre d’un jour.',
      () => 'Pour un suivi fiable : même balance, même moment (le matin, à jeun), une à deux fois par semaine. Le reste, on s’en occupe.',
      () => 'Ton plan est prêt. Première mission : une pesée le matin à jeun, puis une à deux par semaine. La courbe fera le reste.',
    ],
  },
}

/** Choix stable d'une variante selon le jour (change chaque jour, pas à chaque rechargement). */
export function pickVariant(situation: CoachSituation, today: string, count: number): number {
  let h = 0
  for (const ch of `${situation}:${today}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % count
}

function message(situation: CoachSituation, today: string, vars: Vars): CoachMessage {
  const def = MESSAGES[situation]
  const variant = def.variants[pickVariant(situation, today, def.variants.length)]
  return { situation, tone: def.tone, title: def.title, text: variant(vars), action: def.action }
}

/**
 * Messages du coach, du plus important au moins important.
 * Priorités : sécurité (trop rapide) > objectif atteint > rappel de pesée > plateau > encouragements.
 */
export function coachMessages(name: string, settings: ProfileSettings, weighIns: WeighIn[], today: string): CoachMessage[] {
  const out: CoachMessage[] = []
  const trend = trendWeight(weighIns) ?? settings.startWeightKg
  const since = daysSinceLastWeighIn(weighIns, today)
  const streak = weighInStreak(weighIns, today)
  const change = trend - settings.startWeightKg
  const vars: Vars = {
    name,
    days: since ?? 0,
    streak,
    lostKg: formatKg(Math.abs(change)),
    targetKg: formatKg(settings.targetWeightKg),
  }
  const losing = settings.targetWeightKg < settings.startWeightKg

  if (isLosingTooFast(weighIns, today)) out.push(message('trop-rapide', today, vars))
  if (!settings.maintenanceMode && goalReached(settings.startWeightKg, trend, settings.targetWeightKg)) {
    out.push(message('objectif-atteint', today, vars))
  }
  if (since !== null && since > 7) out.push(message('rappel-pesee', today, vars))
  if (!settings.maintenanceMode && isPlateau(weighIns, today)) out.push(message('plateau', today, vars))
  if (streak >= 3) out.push(message('regularite', today, vars))
  const goodDirection = losing ? change <= -0.3 : change >= 0.3
  if (!settings.maintenanceMode && goodDirection) out.push(message('progression', today, vars))
  if (settings.maintenanceMode) out.push(message('maintien', today, vars))
  if (out.length === 0) out.push(message('bienvenue', today, vars))
  return out
}

/** Le maintien dérive-t-il (> 1 kg sur 2 semaines) ? Utile pour l'écran Suivi. */
export function maintenanceDrift(weighIns: WeighIn[], today: string): number | null {
  const c = lastTwoWeeksChanges(weighIns, today)
  return c ? c[0] + c[1] : null
}

export interface FaqEntry {
  q: string
  a: string
}

/** Petite FAQ intégrée. */
export const FAQ: FaqEntry[] = [
  {
    q: 'Pourquoi mon poids monte d’un jour à l’autre ?',
    a: 'Le poids varie facilement de 0,5 à 2 kg en 24 h : eau retenue après un repas salé ou riche en glucides, transit, cycle menstruel, entraînement intense, sommeil. Ce n’est pas de la graisse. C’est pour cela que l’app affiche une moyenne sur 7 jours : c’est elle qui montre la vraie tendance.',
  },
  {
    q: 'Combien de protéines dois-je manger ?',
    a: 'Pour une personne active, entre 1,6 et 2 g par kg de poids corporel et par jour (plutôt 2 g en perte de poids, pour préserver les muscles). Si ton IMC dépasse 30, l’app calcule sur le poids correspondant à un IMC de 25, plus réaliste. Répartis-les sur tes repas : œufs, séré, yaourt grec, légumineuses, tofu, poisson, viande.',
  },
  {
    q: 'À quelle fréquence me peser ?',
    a: 'Une à deux fois par semaine suffit, ou tous les jours si cela ne te stresse pas (la moyenne sera encore plus précise). Toujours dans les mêmes conditions : le matin, à jeun, après être passé aux toilettes, avec la même balance.',
  },
  {
    q: 'Que faire après un repas de fête ou un écart ?',
    a: 'Rien de spécial : reprends simplement ton menu au repas suivant, sans sauter de repas ni « compenser ». Un repas copieux fait monter la balance surtout à cause de l’eau et du sel ; cela redescend en 2 à 3 jours.',
  },
  {
    q: 'Pourquoi l’app ne descend-elle pas sous 1 200 ou 1 500 kcal ?',
    a: 'En dessous de 1 200 kcal par jour pour une femme et 1 500 kcal pour un homme, il devient très difficile de couvrir ses besoins en vitamines, minéraux et protéines, et la fatigue s’installe. Si tes besoins sont bas, mieux vaut bouger un peu plus que manger encore moins.',
  },
  {
    q: 'Qu’est-ce qu’un plateau et comment en sortir ?',
    a: 'Un plateau, c’est un poids stable pendant 2 semaines ou plus malgré tes efforts. C’est fréquent : en maigrissant, tes besoins baissent. Vérifie les portions (une balance de cuisine aide), ajoute de l’activité au quotidien (marche, escaliers), soigne ton sommeil, et recalcule tes besoins avec ton poids actuel.',
  },
  {
    q: 'Combien de temps se gardent les plats du batch cooking ?',
    a: 'En général 3 à 4 jours au frigo (moins pour le poisson), et 2 à 3 mois au congélateur pour les plats mijotés. L’app ne prévoit jamais un plat au-delà de sa durée de conservation : sinon, elle t’indique de le congeler et de le sortir la veille. Refroidis vite, ferme bien les boîtes et note la date dessus.',
  },
  {
    q: 'Le jeûne intermittent, c’est pour moi ?',
    a: 'Le 16:8 (2 repas entre 12 h et 20 h) aide certaines personnes à mieux contrôler leurs apports, mais il ne fait pas maigrir plus qu’un autre rythme à calories égales. Choisis-le s’il te convient au quotidien. Il est déconseillé en cas de grossesse, de diabète traité, d’antécédents de troubles alimentaires, ou chez les sportifs avec des entraînements le matin : demande l’avis d’un professionnel.',
  },
  {
    q: 'Faut-il boire beaucoup d’eau ?',
    a: 'Environ 1,5 à 2 litres par jour en temps normal, davantage avec le sport ou la chaleur. Une urine claire est un bon repère. L’eau du robinet suisse est d’excellente qualité.',
  },
]
