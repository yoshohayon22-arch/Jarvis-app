/**
 * Restrictions alimentaires — règles strictes, fonctions pures.
 *
 * Casher :
 *  - interdits : porc, lapin, fruits de mer, poissons sans écailles, gélatine porcine, saindoux ;
 *  - jamais de viande (bassari) et de lait (halavi) dans le même repas ;
 *  - option : délai d'attente après un repas bassari avant du halavi ;
 *  - option : pas de poisson et de viande dans un même plat.
 * Halal : pas de porc ni dérivés (gélatine porcine, saindoux), pas d'alcool, même en cuisine.
 */
import type { Ingredient, IngredientTag, Kashrut, MealType, Recipe } from './catalog'
import type { KosherOptions, Restriction } from './types'

/** Tags interdits pour chaque restriction. */
export const FORBIDDEN_TAGS: Record<Restriction, IngredientTag[]> = {
  casher: ['porc', 'lapin', 'fruits-de-mer', 'poisson-sans-ecailles', 'gelatine-porcine', 'saindoux'],
  halal: ['porc', 'gelatine-porcine', 'saindoux', 'alcool'],
  vegetarien: ['viande', 'volaille', 'porc', 'lapin', 'poisson', 'poisson-sans-ecailles', 'fruits-de-mer', 'gelatine-porcine', 'saindoux'],
  'sans-gluten': ['gluten'],
  'sans-lactose': ['lactose'],
  'sans-arachides': ['arachide'],
}

const MEAT_TAGS: IngredientTag[] = ['viande', 'volaille', 'porc', 'lapin']

type IngredientLookup = ReadonlyMap<string, Ingredient>

/** Tous les tags présents dans une recette (union des tags de ses ingrédients). */
export function recipeTags(recipe: Pick<Recipe, 'ingredients'>, ingredients: IngredientLookup): Set<IngredientTag> {
  const tags = new Set<IngredientTag>()
  for (const { id } of recipe.ingredients) {
    const ing = ingredients.get(id)
    if (!ing) throw new Error(`Ingrédient inconnu : ${id}`)
    ing.tags.forEach((t) => tags.add(t))
  }
  return tags
}

const hasAny = (tags: Set<IngredientTag>, list: IngredientTag[]) => list.some((t) => tags.has(t))

/**
 * Classement casher d'un ensemble de tags :
 * - « non-casher » si un aliment interdit est présent, ou viande + lait ensemble ;
 * - « bassari » s'il y a de la viande ou de la volaille ;
 * - « halavi » s'il y a un produit laitier ;
 * - « parvé » sinon (légumes, céréales, œufs, poisson…).
 */
export function kashrutFromTags(tags: Set<IngredientTag>): Kashrut {
  if (hasAny(tags, FORBIDDEN_TAGS.casher)) return 'non-casher'
  const meat = hasAny(tags, MEAT_TAGS)
  const milk = tags.has('lait')
  if (meat && milk) return 'non-casher'
  if (meat) return 'bassari'
  if (milk) return 'halavi'
  return 'parve'
}

export function computeKashrut(recipe: Pick<Recipe, 'ingredients'>, ingredients: IngredientLookup): Kashrut {
  return kashrutFromTags(recipeTags(recipe, ingredients))
}

/** Une recette mélange-t-elle poisson et viande ? (interdit si l'option casher est active) */
export function mixesFishAndMeat(recipe: Pick<Recipe, 'ingredients'>, ingredients: IngredientLookup): boolean {
  const tags = recipeTags(recipe, ingredients)
  return tags.has('poisson') && hasAny(tags, MEAT_TAGS)
}

/**
 * Classement casher d'un repas composé de plusieurs recettes (plat + accompagnement…).
 * Un repas bassari + halavi devient « non-casher ».
 */
export function mealKashrut(recipes: Pick<Recipe, 'ingredients'>[], ingredients: IngredientLookup): Kashrut {
  const tags = new Set<IngredientTag>()
  recipes.forEach((r) => recipeTags(r, ingredients).forEach((t) => tags.add(t)))
  return kashrutFromTags(tags)
}

/** Heures habituelles des repas (pour appliquer le délai d'attente casher). */
export const MEAL_HOURS: Record<'petit-dej' | 'collation-matin' | 'dejeuner' | 'collation-apres-midi' | 'diner', number> = {
  'petit-dej': 7.5,
  'collation-matin': 10,
  dejeuner: 12.5,
  'collation-apres-midi': 16,
  diner: 19.5,
}

/**
 * Un repas peut-il suivre le précédent selon les règles casher ?
 * Après du bassari, il faut attendre `waitHours` avant un repas halavi.
 * (Dans l'autre sens — viande après lait — un simple rinçage de bouche suffit pour la plupart des traditions.)
 */
export function canFollow(previous: Kashrut, next: Kashrut, hoursBetween: number, waitHours: number): boolean {
  if (previous === 'bassari' && next === 'halavi') return hoursBetween >= waitHours
  return true
}

/** Normalise un mot pour la comparaison : minuscules, sans accents, sans pluriel. */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .trim()
    .replace(/(s|x)$/, '')
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(normalizeWord)
}

/** Mots-clés génériques → tags (« poisson » exclut tous les poissons, etc.). */
const DISLIKE_SYNONYMS: Record<string, IngredientTag[]> = {
  poisson: ['poisson', 'poisson-sans-ecailles'],
  'fruit de mer': ['fruits-de-mer'],
  viande: ['viande', 'volaille', 'porc', 'lapin'],
  volaille: ['volaille'],
  porc: ['porc'],
  laitage: ['lait'],
  'produit laitier': ['lait'],
  oeuf: ['oeuf'],
  soja: ['soja'],
  sesame: ['sesame'],
  'fruit a coque': ['fruits-a-coque'],
  arachide: ['arachide'],
  cacahuete: ['arachide'],
}

/** L'ingrédient correspond-il à un aliment détesté (texte libre) ? */
export function matchesDisliked(ingredient: Ingredient, disliked: string): boolean {
  const target = words(disliked)
  if (target.length === 0) return false
  const key = target.join(' ')
  const synonymTags = DISLIKE_SYNONYMS[key]
  if (synonymTags && ingredient.tags.some((t) => synonymTags.includes(t))) return true
  // Tous les mots saisis doivent apparaître dans le nom de l'ingrédient.
  const nameWords = words(ingredient.name)
  return target.every((w) => nameWords.includes(w))
}

export interface DietProfile {
  restrictions: Restriction[]
  kosher: KosherOptions
  dislikedFoods: string[]
}

/** Raisons pour lesquelles une recette est exclue (liste vide = recette autorisée). */
export function exclusionReasons(
  recipe: Pick<Recipe, 'ingredients'>,
  profile: DietProfile,
  ingredients: IngredientLookup,
): string[] {
  const reasons: string[] = []
  const tags = recipeTags(recipe, ingredients)
  for (const r of profile.restrictions) {
    if (r === 'casher') {
      if (kashrutFromTags(tags) === 'non-casher') reasons.push('casher')
      else if (profile.kosher.separateFishAndMeat && mixesFishAndMeat(recipe, ingredients)) {
        reasons.push('casher (poisson et viande)')
      }
    } else if (hasAny(tags, FORBIDDEN_TAGS[r])) {
      reasons.push(r)
    }
  }
  for (const food of profile.dislikedFoods) {
    const hit = recipe.ingredients.some(({ id }) => matchesDisliked(ingredients.get(id)!, food))
    if (hit) reasons.push(`n’aime pas : ${food}`)
  }
  return reasons
}

export function isRecipeAllowed(
  recipe: Pick<Recipe, 'ingredients'>,
  profile: DietProfile,
  ingredients: IngredientLookup,
): boolean {
  return exclusionReasons(recipe, profile, ingredients).length === 0
}

/** Liste des régimes avec lesquels une recette est compatible (pour l'affichage). */
export function compatibleDiets(recipe: Pick<Recipe, 'ingredients'>, ingredients: IngredientLookup): Restriction[] {
  const all: Restriction[] = ['casher', 'halal', 'vegetarien', 'sans-gluten', 'sans-lactose', 'sans-arachides']
  return all.filter((r) =>
    isRecipeAllowed(recipe, { restrictions: [r], kosher: { waitAfterMeatHours: 0, separateFishAndMeat: true }, dislikedFoods: [] }, ingredients),
  )
}

/** Rappels à afficher dans la liste de courses selon les restrictions. */
export function shoppingReminders(restrictions: Restriction[]): string[] {
  const out: string[] = []
  if (restrictions.includes('casher')) {
    out.push(
      'Casher : choisis des produits avec certification casher (hechsher), en particulier viande, volaille, fromages, pain, vin et produits transformés. En Suisse, on les trouve dans les épiceries casher et certains rayons spécialisés.',
    )
  }
  if (restrictions.includes('halal')) {
    out.push(
      'Halal : choisis de la viande et de la volaille halal certifiées, et vérifie l’absence de gélatine porcine et d’alcool dans les produits transformés.',
    )
  }
  return out
}

export function recipeServesMeal(recipe: Pick<Recipe, 'mealTypes'>, meal: MealType): boolean {
  return recipe.mealTypes.includes(meal)
}
