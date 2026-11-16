/**
 * Techniques de nutrition reconnues : fiches explicatives, classement des recettes
 * (« ce plat respecte-t-il la technique ? ») et effet sur le générateur de menu.
 * Fonctions pures, testées dans techniques.test.ts.
 *
 * Sources des fiches :
 * - Assiette équilibrée : OSAV, Société Suisse de Nutrition SSN et Promotion Santé Suisse (oct. 2025),
 *   d'après les recommandations nutritionnelles suisses 2024 : 2/5 légumes et fruits, 2/5 féculents, 1/5 protéines.
 * - Méditerranéen : étude PREDIMED (Estruch et al., NEJM 2018).
 * - Protéines : méta-analyse Morton et al., Br J Sports Med 2018 (~1,6 g/kg/jour avec entraînement).
 * - Jeûne 16:8 : Liu et al., NEJM 2022 (perte de poids comparable à une simple réduction calorique).
 */
import type { Ingredient, Recipe } from './catalog'
import type { MealSlot, MealsPerDay, ProfileSettings, TechniqueId } from './types'

export type { TechniqueId }

/** Moments où la technique s'applique (« repas » = déjeuner et dîner). */
export type TechniqueMoment = 'petit-dej' | 'repas' | 'collation'

export interface Technique {
  id: TechniqueId
  name: string
  tagline: string
  principle: string
  why: string[]
  tips: string[]
  /** Précaution santé, affichée en évidence. */
  caution?: string
  /** Ce que « Appliquer à mon menu » change, en une phrase. */
  effect: string
  moments: TechniqueMoment[]
  source: string
}

export const TECHNIQUES: Technique[] = [
  {
    id: 'assiette',
    name: 'L’assiette équilibrée',
    tagline: '2/5 de légumes et fruits, 2/5 de féculents, 1/5 de protéines.',
    principle:
      'Le repère officiel suisse pour composer chaque repas principal, petit-déjeuner compris, sans rien peser : ' +
      'au moins un légume ou un fruit, un féculent (pommes de terre, pain, pâtes, riz, flocons…) et un aliment riche en protéines ' +
      '(produit laitier, œufs, tofu, légumineuses, viande ou poisson). Avec une boisson non sucrée.',
    why: [
      'Les légumes apportent du volume et des fibres pour peu de calories : on est rassasié plus longtemps.',
      'Aucun calcul : la méthode marche aussi au restaurant, à la cantine ou chez des amis.',
      'Aucun aliment interdit : c’est une question de proportions.',
    ],
    tips: [
      'Commence par servir les légumes, puis ajoute le reste.',
      'Les pommes de terre comptent comme féculent, pas comme légume.',
      'Préfère les céréales complètes, et des légumes colorés et de saison.',
      'Au petit-déjeuner, la part de légumes peut être un fruit.',
    ],
    effect: 'Le petit-déjeuner, le déjeuner et le dîner privilégient les recettes qui respectent ces proportions. Tes calories et tes protéines ne changent pas.',
    moments: ['petit-dej', 'repas'],
    source: 'OSAV, SSN et Promotion Santé Suisse, « L’assiette équilibrée » (2025).',
  },
  {
    id: 'mediterraneen',
    name: 'Alimentation méditerranéenne',
    tagline: 'Légumes, légumineuses, poisson et huile d’olive ; peu de viande rouge.',
    principle:
      'Inspirée des habitudes du sud de l’Europe : beaucoup de légumes, de fruits, de légumineuses et de céréales complètes, ' +
      'des noix, l’huile d’olive comme matière grasse principale, du poisson deux fois par semaine, ' +
      'la volaille, les œufs et les produits laitiers avec modération, et peu de viande rouge et de charcuterie.',
    why: [
      'C’est l’un des modèles alimentaires les plus étudiés : il est associé à moins de maladies cardiovasculaires.',
      'Facile à tenir sur la durée : rien n’est interdit, la cuisine reste gourmande.',
      'Les fibres des légumineuses et des légumes aident à la satiété.',
    ],
    tips: [
      'Cuisine à l’huile d’olive plutôt qu’au beurre ou à la crème.',
      'Deux repas de poisson par semaine (le thon et les sardines en boîte comptent).',
      'Viande rouge et charcuterie : une fois par semaine au plus.',
      'Une petite poignée de noix ou d’amandes fait une bonne collation.',
    ],
    effect: 'Le menu privilégie les plats aux légumes, légumineuses ou poisson ; bœuf, porc et charcuterie reviennent au plus une fois par semaine.',
    moments: ['repas'],
    source: 'Étude PREDIMED (Estruch et al., New England Journal of Medicine, 2018).',
  },
  {
    id: 'proteines',
    name: 'Riche en protéines',
    tagline: 'Une vraie source de protéines à chaque repas.',
    principle:
      'Les protéines sont le nutriment le plus rassasiant. Pendant une perte de poids, un apport élevé aide à préserver les muscles. ' +
      'Ton objectif quotidien est déjà calculé (1,6 à 2 g par kg) : cette technique le répartit sur toute la journée, ' +
      'avec environ 25 à 40 g par repas principal, et des protéines aussi au petit-déjeuner et en collation.',
    why: [
      'Moins de fringales entre les repas.',
      'Les muscles sont mieux préservés, surtout si tu fais aussi un peu de renforcement musculaire.',
      'Les protéines demandent plus d’énergie à digérer que les glucides ou les graisses.',
    ],
    tips: [
      'Au petit-déjeuner : séré, yaourt grec, cottage cheese ou œufs.',
      'En collation : un yaourt nature, du fromage frais, une poignée d’amandes.',
      'Alterne les sources : légumineuses, tofu, poisson, volaille, produits laitiers.',
    ],
    caution: 'En cas de maladie des reins, demande l’avis de ton médecin avant d’augmenter tes protéines.',
    effect: 'Tous les repas, petit-déjeuner et collations compris, privilégient les recettes riches en protéines. Ton objectif en grammes ne change pas : il est déjà élevé.',
    moments: ['petit-dej', 'repas', 'collation'],
    source: 'Morton et al., British Journal of Sports Medicine (2018).',
  },
  {
    id: 'jeune-16-8',
    name: 'Jeûne intermittent 16:8',
    tagline: 'Manger dans une fenêtre de 8 heures, par exemple de 12 h à 20 h.',
    principle:
      'On regroupe ses repas sur 8 heures et on jeûne 16 heures, nuit comprise, avec de l’eau, du thé ou du café sans sucre. ' +
      'Dans l’app, cela correspond à 2 repas par jour : un déjeuner et un dîner, plus copieux.',
    why: [
      'Une structure simple : moins de repas à préparer, pas de grignotage le matin.',
      'Les études montrent une perte de poids comparable à une réduction des calories classique : ' +
        'ce n’est pas plus efficace, mais certaines personnes le trouvent plus facile à tenir.',
    ],
    tips: [
      'Garde les mêmes calories : ce sont deux repas plus copieux, pas des repas sautés.',
      'Commence par 12 heures de jeûne, puis 14, avant de passer à 16.',
      'Bois beaucoup d’eau pendant le jeûne.',
      'Si tu te sens mal ou fatigué·e, reviens à 3 repas : ce n’est pas un échec.',
    ],
    caution:
      'Déconseillé pendant la grossesse ou l’allaitement, en cas de diabète traité, ou si tu as eu des troubles du comportement alimentaire. ' +
      'Parles-en d’abord à ton médecin.',
    effect: 'Ton menu passe à 2 repas par jour (déjeuner et dîner), avec des plats copieux et riches en protéines. En retirant la technique, tu retrouves ton nombre de repas habituel.',
    moments: ['repas'],
    source: 'Liu et al., New England Journal of Medicine (2022).',
  },
]

export const TECHNIQUE_MAP = new Map(TECHNIQUES.map((t) => [t.id, t]))

// ─────────────────────────── Classement des recettes ───────────────────────────

/** Féculents vendus secs : ils gonflent à la cuisson (environ 2,5 fois leur poids). */
const DRY_STARCH = /^(riz-|pates|quinoa|boulgour|semoule|polenta|orge|nouilles|flocons-avoine)/
/** Céréales sèches qui ne gonflent pas mais prennent de la place dans l'assiette. */
const BULKY_DRY = new Set(['muesli-nature', 'galettes-riz'])
const STARCH = new Set(['pommes-de-terre', 'patate-douce', 'mais-conserve', 'gnocchi', 'farine-ble', 'muesli-nature', 'galettes-riz'])
const LEGUMES_SECS = /^(lentilles-|pois-chiches|haricots-(rouges|blancs))/
/** Ingrédients ignorés pour les proportions : assaisonnements et matières grasses. */
const IGNORED = new Set(['ail', 'gingembre', 'citron', 'levure-seche', 'miel', 'cacao-poudre', 'chocolat-noir', 'beurre', 'creme-cuisine', 'lait-coco', 'beurre-cacahuete', 'amandes', 'noix', 'graines-courge', 'graines-lin'])
const RED_MEAT = new Set(['boeuf-hache', 'boeuf-ragout', 'porc-emince', 'cervelas', 'jambon-cuit'])
const FISH = new Set(['saumon-filet', 'truite-filet', 'cabillaud-filet', 'thon-conserve', 'sardines-huile', 'crevettes'])

export interface PlateShares {
  vegetables: number
  starch: number
  protein: number
}

/**
 * Proportions approximatives de l'assiette (en volume servi) : légumes et fruits, féculents, protéines.
 * Les féculents secs sont comptés cuits, les liquides (lait…) comptent moins, l'huile et les épices pas du tout.
 */
export function plateShares(recipe: Recipe, ingredients: ReadonlyMap<string, Ingredient>): PlateShares {
  let vegetables = 0
  let starch = 0
  let protein = 0
  for (const { id, grams } of recipe.ingredients) {
    const ing = ingredients.get(id)
    if (!ing || ing.aisle === 'condiments' || IGNORED.has(id)) continue
    let g = grams
    if (DRY_STARCH.test(id) || /^lentilles-/.test(id)) g *= 2.5
    else if (BULKY_DRY.has(id)) g *= 2
    if (ing.unit === 'ml') g *= 0.4
    if (LEGUMES_SECS.test(id) || FISH.has(id) || ing.aisle === 'boucherie' || ing.aisle === 'poissonnerie' || ing.aisle === 'cremerie') protein += g
    else if (STARCH.has(id) || DRY_STARCH.test(id) || ing.aisle === 'boulangerie') starch += g
    else if (ing.aisle === 'fruits-legumes' || ing.aisle === 'fruits-secs' || ing.aisle === 'surgeles' || id === 'tomates-pelees-conserve') vegetables += g
  }
  const total = vegetables + starch + protein || 1
  return { vegetables: vegetables / total, starch: starch / total, protein: protein / total }
}

/** Part des calories apportée par les protéines. */
export const proteinShare = (r: Recipe) => (r.perServing.protein * 4) / Math.max(1, r.perServing.kcal)

export const momentOfSlot = (slot: MealSlot): TechniqueMoment =>
  slot === 'petit-dej' ? 'petit-dej' : slot === 'dejeuner' || slot === 'diner' ? 'repas' : 'collation'

const has = (r: Recipe, set: Set<string>) => r.ingredients.some((i) => set.has(i.id))

/** Le plat contient-il de la viande rouge ou de la charcuterie ? */
export const hasRedMeat = (r: Recipe) => has(r, RED_MEAT)

/** La recette respecte-t-elle la technique pour ce moment de la journée ? */
export function fitsTechnique(recipe: Recipe, id: TechniqueId, moment: TechniqueMoment, ingredients: ReadonlyMap<string, Ingredient>): boolean {
  switch (id) {
    case 'assiette': {
      if (moment === 'collation') return false
      const s = plateShares(recipe, ingredients)
      return s.vegetables >= (moment === 'repas' ? 0.35 : 0.25) && s.starch >= 0.2 && s.protein >= 0.1
    }
    case 'mediterraneen': {
      if (hasRedMeat(recipe)) return false
      // Beurre et crème : 10 g par portion au plus.
      const dairyFat = recipe.ingredients.filter((i) => i.id === 'beurre' || i.id === 'creme-cuisine').reduce((s, i) => s + i.grams, 0)
      if (dairyFat > 10 * recipe.servings) return false
      if (moment !== 'repas') return true
      return plateShares(recipe, ingredients).vegetables >= 0.3 || recipe.ingredients.some((i) => LEGUMES_SECS.test(i.id)) || has(recipe, FISH)
    }
    case 'proteines':
      return proteinShare(recipe) >= (moment === 'repas' ? 0.28 : moment === 'petit-dej' ? 0.22 : 0.2)
    case 'jeune-16-8':
      // Deux repas par jour : des plats complets et rassasiants.
      return moment === 'repas' && recipe.perServing.protein >= 28 && recipe.perServing.kcal >= 480
  }
}

// ─────────────────────────── Effet sur le générateur ───────────────────────────

/** Viande rouge ou charcuterie : au plus 1 plat principal par semaine en méditerranéen. */
export const MAX_RED_MEAT_PER_WEEK = 1

/**
 * Coefficient appliqué au tirage d'une recette quand une technique est active
 * (> 1 : privilégiée, < 1 : plus rare). Les restrictions du profil restent prioritaires.
 */
export function techniqueWeight(recipe: Recipe, id: TechniqueId | null | undefined, slot: MealSlot, ingredients: ReadonlyMap<string, Ingredient>): number {
  if (!id) return 1
  const t = TECHNIQUE_MAP.get(id)!
  const moment = momentOfSlot(slot)
  if (!t.moments.includes(moment)) return 1
  if (id === 'mediterraneen' && hasRedMeat(recipe)) return 0.15
  const fits = fitsTechnique(recipe, id, moment, ingredients)
  if (id === 'mediterraneen' && fits && has(recipe, FISH)) return 3.5
  return fits ? 3 : id === 'jeune-16-8' ? 1 : 0.5
}

/** Bonus de score (négatif = meilleur) d'une journée pour les repas qui respectent la technique. */
export function techniqueBonus(recipes: Recipe[], slots: MealSlot[], id: TechniqueId | null | undefined, ingredients: ReadonlyMap<string, Ingredient>): number {
  if (!id) return 0
  const t = TECHNIQUE_MAP.get(id)!
  return recipes.reduce((bonus, r, i) => {
    const moment = momentOfSlot(slots[i])
    return t.moments.includes(moment) && fitsTechnique(r, id, moment, ingredients) ? bonus - 0.03 : bonus
  }, 0)
}

// ─────────────────────────── Réglages du profil ───────────────────────────

/** Technique réellement active (le jeûne n'a de sens qu'avec 2 repas par jour). */
export function activeTechnique(settings: Pick<ProfileSettings, 'technique' | 'mealsPerDay'>): TechniqueId | null {
  const t = settings.technique ?? null
  if (t === 'jeune-16-8' && settings.mealsPerDay !== 2) return null
  return t
}

/**
 * Active (ou retire, avec `null`) une technique. Le jeûne 16:8 passe à 2 repas par jour
 * et mémorise le nombre de repas d'avant, rétabli quand on le retire.
 */
export function withTechnique(settings: ProfileSettings, id: TechniqueId | null): ProfileSettings {
  const current = activeTechnique(settings)
  let mealsPerDay: MealsPerDay = settings.mealsPerDay
  let mealsBeforeFasting = settings.mealsBeforeFasting
  if (id === 'jeune-16-8' && current !== 'jeune-16-8') {
    mealsBeforeFasting = settings.mealsPerDay
    mealsPerDay = 2
  } else if (id !== 'jeune-16-8' && current === 'jeune-16-8') {
    mealsPerDay = settings.mealsBeforeFasting ?? 3
    mealsBeforeFasting = undefined
  }
  return { ...settings, technique: id, mealsPerDay, mealsBeforeFasting }
}

/**
 * Repas adaptés à une technique, pour un moment donné : recettes autorisées par le profil
 * qui respectent la technique, dans un ordre qui change avec la graine.
 */
export function adaptedMeals(
  recipes: Recipe[],
  id: TechniqueId,
  moment: TechniqueMoment,
  ingredients: ReadonlyMap<string, Ingredient>,
  allowed: (r: Recipe) => boolean,
  seed: number,
  count = 3,
): Recipe[] {
  const mealType = moment === 'repas' ? 'dejeuner' : moment
  const pool = recipes.filter((r) => !r.mealTypes.includes('base') && r.mealTypes.includes(mealType) && allowed(r) && fitsTechnique(r, id, moment, ingredients))
  // Tirage déterministe : un hachage simple de l'identifiant et de la graine.
  const key = (r: Recipe) => {
    let h = seed * 2654435761
    for (const c of r.id) h = Math.imul(h ^ c.charCodeAt(0), 2246822519) >>> 0
    return h
  }
  return [...pool].sort((a, b) => key(a) - key(b)).slice(0, count)
}
