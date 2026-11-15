/**
 * Batch cooking — organisation des sessions, choix des bases, bowls et conservation.
 * Fonctions pures.
 *
 * Principe : chaque session cuisine 4 bases (céréale, protéine, légumes, sauce) qu'on combine
 * en « bowls » pendant les jours qui suivent, plus les plats mijotés prévus au menu.
 * Un plat n'est prévu à J+n que s'il tient n jours au frigo… ou s'il se congèle :
 * dans ce cas, on le congèle le jour de la session et on le sort la veille.
 */
import type { BatchRole, Ingredient, Recipe } from '../catalog'
import { addDays } from '../nutrition'
import { compatibleDiets, computeKashrut, isRecipeAllowed, kashrutFromTags, recipeTags } from '../restrictions'
import type { BatchSession, DayOfWeek, ProfileSettings } from '../types'

export const BATCH_ROLES: BatchRole[] = ['cereale', 'proteine', 'legumes', 'sauce']

/** Nombre de jours entre deux dates AAAA-MM-JJ. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/**
 * Répartit les 7 jours de la semaine entre les sessions de cuisine.
 * On cuisine l'après-midi pour les jours qui SUIVENT : chaque jour est couvert par la dernière
 * session qui a eu lieu strictement avant lui. Exemple avec dimanche + mercredi : la session
 * du dimanche (veille de la semaine) couvre lundi → mercredi, celle du mercredi jeudi → dimanche.
 */
export function scheduleSessions(weekStart: string, sessionDays: DayOfWeek[]): { cookDate: string; days: number[] }[] {
  const sorted = [...new Set(sessionDays)].sort((a, b) => a - b)
  if (sorted.length === 0) return []
  const groups = new Map<string, number[]>()
  for (let i = 0; i < 7; i++) {
    // Dernier jour de session < i dans cette semaine, sinon le dernier de la semaine précédente.
    const before = sorted.filter((s) => s < i)
    const cookDate = before.length ? addDays(weekStart, before[before.length - 1]) : addDays(weekStart, sorted[sorted.length - 1] - 7)
    groups.set(cookDate, [...(groups.get(cookDate) ?? []), i])
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cookDate, days]) => ({ cookDate, days }))
}

/** Une préparation cuisinée le jour `cookDate` peut-elle être mangée `offset` jours plus tard ? */
export function canKeep(recipe: Pick<Recipe, 'fridgeDays' | 'freezerMonths'>, offset: number): boolean {
  return offset <= recipe.fridgeDays || recipe.freezerMonths > 0
}

/** Où conserver une préparation pour la manger `offset` jours après la session. */
export function storageFor(
  recipe: Pick<Recipe, 'fridgeDays' | 'freezerMonths'>,
  offset: number,
): 'frigo' | 'congelateur' | 'impossible' {
  if (offset <= recipe.fridgeDays) return 'frigo'
  return recipe.freezerMonths > 0 ? 'congelateur' : 'impossible'
}

const shortName = (r: Recipe) => r.name.replace(/^Base\s*:\s*/i, '')

/**
 * Composition d'un bowl (en portions de chaque base) : proportions classiques du « meal prep »
 * sportif, avec une protéine généreuse et un peu moins de féculents.
 */
export const BOWL_PORTIONS: Record<BatchRole, number> = { cereale: 0.8, proteine: 1.5, legumes: 1, sauce: 1 }

const portionOf = (b: Recipe) => BOWL_PORTIONS[b.batchRole ?? 'legumes']

/** Valeurs d'un bowl (somme pondérée des bases). */
export function bowlValues(bases: Recipe[]): Recipe['perServing'] {
  const sum = (k: keyof Recipe['perServing']) => Math.round(bases.reduce((s, b) => s + b.perServing[k] * portionOf(b), 0) * 100) / 100
  return {
    kcal: Math.round(sum('kcal')),
    protein: sum('protein'),
    fat: sum('fat'),
    carbs: sum('carbs'),
    priceChf: sum('priceChf'),
    priceBudgetChf: sum('priceBudgetChf'),
  }
}

/** Assemble un bowl à partir des bases (voir BOWL_PORTIONS). */
export function makeBowl(bases: Recipe[], ingredients: ReadonlyMap<string, Ingredient>): Recipe {
  const merged = new Map<string, number>()
  for (const b of bases) {
    for (const { id, grams } of b.ingredients) merged.set(id, (merged.get(id) ?? 0) + (grams / b.servings) * portionOf(b))
  }
  const draft = {
    ingredients: [...merged.entries()].map(([id, grams]) => ({ id, grams: Math.round(grams * 10) / 10 })),
  }
  const months = bases.reduce<number[]>((acc, b) => acc.filter((m) => b.season.includes(m)), [...Array(12)].map((_, i) => i + 1))
  return {
    id: `bowl:${bases.map((b) => b.id.replace(/^base-/, '')).join('+')}`,
    name: `Bowl batch : ${bases.map(shortName).join(', ').toLowerCase()}`,
    mealTypes: ['dejeuner', 'diner'],
    servings: 1,
    prepMin: 5,
    cookMin: 3,
    ingredients: draft.ingredients,
    steps: [
      'Sortir les boîtes de bases du frigo (ou du congélateur la veille au soir).',
      `Réchauffer ${bases.filter((b) => b.batchRole !== 'sauce').map(shortName).join(', ').toLowerCase()} 2 à 3 min au micro-ondes ou à la poêle.`,
      'Disposer dans un bol et napper de sauce juste avant de manger.',
    ],
    kashrut: computeKashrut(draft, ingredients),
    tags: ['batch-friendly', 'assemblage'],
    season: months.length ? months : [...Array(12)].map((_, i) => i + 1),
    fridgeDays: Math.min(...bases.map((b) => b.fridgeDays)),
    freezerMonths: Math.min(...bases.map((b) => b.freezerMonths)),
    components: bases.map((b) => ({ id: b.id, portions: portionOf(b) })),
    perServing: bowlValues(bases),
    compatibleWith: compatibleDiets(draft, ingredients),
  }
}

/** Le bowl (ou un plat de batch) peut-il être servi `offset` jours après la session ? */
export function canServe(recipe: Recipe, offset: number, byId: ReadonlyMap<string, Recipe>): boolean {
  const parts = recipe.components ? recipe.components.map((c) => byId.get(c.id)!) : [recipe]
  return parts.every((p) => canKeep(p, offset))
}

/**
 * Choisit les 4 bases d'une session : compatibles avec le profil, de saison si possible,
 * conservables sur toute la période couverte, différentes de la session précédente,
 * et formant un bowl casher le cas échéant (pas de protéine bassari avec une sauce au yaourt).
 */
export function chooseBases(
  allRecipes: Recipe[],
  settings: ProfileSettings,
  ingredients: ReadonlyMap<string, Ingredient>,
  maxOffset: number,
  month: number,
  rng: () => number,
  avoid: string[] = [],
  /** Répartition visée de l'énergie (protéines, lipides, glucides) pour orienter le choix. */
  targetSplit?: [number, number, number],
): Recipe[] | null {
  const byRole = new Map<BatchRole, Recipe[]>()
  for (const role of BATCH_ROLES) {
    byRole.set(
      role,
      allRecipes.filter((r) => r.batchRole === role && isRecipeAllowed(r, settings, ingredients)),
    )
  }
  if (BATCH_ROLES.some((role) => byRole.get(role)!.length === 0)) return null

  let best: { bases: Recipe[]; score: number } | null = null
  for (let attempt = 0; attempt < 60; attempt++) {
    const bases = BATCH_ROLES.map((role) => {
      const list = byRole.get(role)!
      return list[Math.floor(rng() * list.length)]
    })
    const tags = new Set(bases.flatMap((b) => [...recipeTags(b, ingredients)]))
    if (settings.restrictions.includes('casher') && kashrutFromTags(tags) === 'non-casher') continue
    let score = rng() * 0.5
    score += bases.filter((b) => !b.season.includes(month)).length * 2
    score += bases.filter((b) => !canKeep(b, maxOffset)).length * 1.5 // une base qui ne tient pas toute la période
    score += bases.filter((b) => avoid.includes(b.id)).length * 1
    if (targetSplit) {
      // Le bowl doit ressembler à la répartition visée (sinon il ne sera jamais retenu au menu).
      const v = bowlValues(bases)
      const e = v.protein * 4 + v.fat * 9 + v.carbs * 4 || 1
      const split = [(v.protein * 4) / e, (v.fat * 9) / e, (v.carbs * 4) / e]
      score += 6 * split.reduce((s, x, i) => s + Math.abs(x - targetSplit[i]), 0)
    }
    if (!best || score < best.score) best = { bases, score }
  }
  return best?.bases ?? null
}

/** Organise les sessions de la semaine et construit leurs bowls. */
export function planBatch(
  allRecipes: Recipe[],
  settings: ProfileSettings,
  ingredients: ReadonlyMap<string, Ingredient>,
  weekStart: string,
  rng: () => number,
  targetSplit?: [number, number, number],
): { sessions: BatchSession[]; bowls: Recipe[] } {
  const month = Number(weekStart.slice(5, 7))
  const sessions: BatchSession[] = []
  const bowls: Recipe[] = []
  let previous: string[] = []
  for (const s of scheduleSessions(weekStart, settings.batch.sessionDays)) {
    const maxOffset = Math.max(...s.days.map((d) => daysBetween(s.cookDate, addDays(weekStart, d))))
    const bases = chooseBases(allRecipes, settings, ingredients, maxOffset, month, rng, previous, targetSplit)
    if (!bases) {
      sessions.push({ ...s, baseIds: [], bowlId: '' })
      continue
    }
    const bowl = makeBowl(bases, ingredients)
    if (!bowls.some((b) => b.id === bowl.id)) bowls.push(bowl)
    sessions.push({ ...s, baseIds: bases.map((b) => b.id), bowlId: bowl.id })
    previous = bases.map((b) => b.id)
  }
  return { sessions, bowls }
}

/** Session qui couvre un jour donné, et nombre de jours écoulés depuis la cuisine. */
export function sessionForDay(
  sessions: BatchSession[],
  weekStart: string,
  dayIndex: number,
): { session: BatchSession; index: number; offset: number } | null {
  const index = sessions.findIndex((s) => s.days.includes(dayIndex))
  if (index === -1) return null
  const session = sessions[index]
  return { session, index, offset: daysBetween(session.cookDate, addDays(weekStart, dayIndex)) }
}

/** En mode batch, un plat de déjeuner/dîner « batch-friendly » est cuisiné pendant la session. */
export function isBatchCooked(recipe: Recipe, slot: string): boolean {
  return (slot === 'dejeuner' || slot === 'diner') && (Boolean(recipe.components) || recipe.tags.includes('batch-friendly'))
}
