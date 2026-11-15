/**
 * Détail d'une session de batch cooking, à partir du menu :
 * quoi cuisiner (et en quelle quantité), dans quel ordre (plan minuté), avec quel matériel,
 * et comment conserver chaque repas (frigo, ou congélation + date de décongélation).
 */
import type { Ingredient, Recipe } from './catalog'
import { addDays } from './nutrition'
import { daysBetween, isBatchCooked, storageFor } from './menu/batch'
import type { BatchSession, MealSlot, WeekPlan } from './types'

export type CookMethod = 'four' | 'plaque' | 'aucun'

/** Mode de cuisson déduit des étapes : four si une étape en parle, sinon plaque si cuisson. */
export function cookMethod(recipe: Pick<Recipe, 'steps' | 'cookMin'>): CookMethod {
  const text = recipe.steps.join(' ').toLowerCase()
  if (/\bfour\b|gratiner|rôtir|papillote/.test(text)) return 'four'
  return recipe.cookMin > 0 ? 'plaque' : 'aucun'
}

export interface CookItem {
  recipe: Recipe
  /** Portions totales à cuisiner pendant la session. */
  portions: number
  /** Multiplicateur appliqué à la recette (portions / portions de la recette). */
  scale: number
  method: CookMethod
}

export interface TimelineStep {
  /** Minutes depuis le début de la session. */
  start: number
  end: number
  kind: 'prechauffage' | 'preparation' | 'cuisson' | 'rangement'
  label: string
  detail?: string
}

export interface StorageInstruction {
  date: string
  slot: MealSlot
  recipeName: string
  /** Préparations concernées (pour un bowl : chacune de ses bases). */
  parts: { name: string; where: 'frigo' | 'congelateur' | 'impossible' }[]
  /** Si une partie est congelée : jour où la sortir au frigo (la veille au soir). */
  thawOn?: string
}

export interface SessionPlan {
  index: number
  cookDate: string
  /** Dates couvertes par la session. */
  dates: string[]
  items: CookItem[]
  timeline: TimelineStep[]
  totalMin: number
  equipment: string[]
  storage: StorageInstruction[]
}

const OVEN_SLOTS = 2 // deux plaques / grilles dans le four
const BURNERS = 4
const PREHEAT_MIN = 10
const COOLING_MIN = 10
const STORE_MIN = 5

/** Préparations à cuisiner pour une session (bases des bowls + plats mijotés), avec quantités. */
export function sessionItems(plan: WeekPlan, session: BatchSession, byId: ReadonlyMap<string, Recipe>): CookItem[] {
  const portions = new Map<string, number>()
  for (const d of session.days) {
    for (const m of plan.days[d]?.meals ?? []) {
      const r = byId.get(m.recipeId)
      if (!r || !isBatchCooked(r, m.slot)) continue
      const parts = r.components ?? [{ id: r.id, portions: 1 }]
      for (const c of parts) portions.set(c.id, (portions.get(c.id) ?? 0) + m.portions * c.portions)
    }
  }
  return [...portions.entries()]
    .map(([id, p]) => {
      const recipe = byId.get(id)!
      const total = Math.round(p * 10) / 10
      return { recipe, portions: total, scale: total / recipe.servings, method: cookMethod(recipe) }
    })
    .sort((a, b) => a.recipe.name.localeCompare(b.recipe.name, 'fr'))
}

/** Durées ajustées à la quantité : la préparation s'allonge un peu, la cuisson presque pas. */
function durations(item: CookItem): { prep: number; cook: number } {
  const extra = Math.max(0, item.scale - 1)
  return {
    prep: Math.max(5, Math.round(item.recipe.prepMin * (1 + 0.3 * extra))),
    cook: Math.round(item.recipe.cookMin * (item.scale > 2 ? 1.15 : 1)),
  }
}

/**
 * Plan minuté (ordonnancement glouton) :
 *  1. on lance le préchauffage du four ;
 *  2. on prépare d'abord ce qui cuit au four, en commençant par la cuisson la plus longue,
 *     puis ce qui cuit sur la plaque, puis ce qui ne cuit pas ;
 *  3. pendant qu'un plat cuit, on prépare le suivant (une seule personne, 2 places au four, 4 feux) ;
 *  4. chaque préparation est mise en boîte après un court refroidissement.
 */
export function buildTimeline(items: CookItem[]): { steps: TimelineStep[]; totalMin: number } {
  const order = [...items].sort((a, b) => {
    const rank = { four: 0, plaque: 1, aucun: 2 }
    if (rank[a.method] !== rank[b.method]) return rank[a.method] - rank[b.method]
    return durations(b).cook - durations(a).cook
  })
  const steps: TimelineStep[] = []
  let cook = 0 // la personne est libre à partir de cette minute
  const oven = Array(OVEN_SLOTS).fill(PREHEAT_MIN)
  const burners = Array(BURNERS).fill(0)
  const ready: { at: number; item: CookItem }[] = []

  if (order.some((i) => i.method === 'four')) {
    steps.push({ start: 0, end: PREHEAT_MIN, kind: 'prechauffage', label: 'Préchauffer le four à 200 °C' })
  }
  for (const item of order) {
    const { prep, cook: cookTime } = durations(item)
    const name = item.recipe.name.replace(/^Base\s*:\s*/i, '')
    // Détail : la première vraie étape (le préchauffage est déjà une ligne à part).
    const detail = item.recipe.steps.find((st) => !/préchauffer/i.test(st)) ?? item.recipe.steps[0]
    steps.push({ start: cook, end: cook + prep, kind: 'preparation', label: `Préparer : ${name}`, detail })
    cook += prep
    if (item.method === 'aucun' || cookTime === 0) {
      ready.push({ at: cook, item })
      continue
    }
    const res = item.method === 'four' ? oven : burners
    const slot = res.indexOf(Math.min(...res))
    const start = Math.max(cook, res[slot])
    const end = start + cookTime
    res[slot] = end
    steps.push({
      start,
      end,
      kind: 'cuisson',
      label: `${item.method === 'four' ? 'Four' : 'Plaque'} : ${name}`,
      detail: item.method === 'plaque' ? 'Remuer de temps en temps entre deux préparations.' : `${cookTime} min de cuisson`,
    })
    ready.push({ at: end, item })
  }
  // Mise en boîtes : dans l'ordre où les préparations sont prêtes (après refroidissement).
  for (const { at, item } of ready.sort((a, b) => a.at - b.at)) {
    const start = Math.max(cook, at + (item.method === 'aucun' ? 0 : COOLING_MIN))
    steps.push({
      start,
      end: start + STORE_MIN,
      kind: 'rangement',
      label: `Mettre en boîtes : ${item.recipe.name.replace(/^Base\s*:\s*/i, '')}`,
      detail: `${item.portions.toLocaleString('fr-CH')} portion${item.portions >= 2 ? 's' : ''}`,
    })
    cook = start + STORE_MIN
  }
  steps.sort((a, b) => a.start - b.start || a.end - b.end)
  return { steps, totalMin: Math.max(0, ...steps.map((s) => s.end)) }
}

/** Matériel nécessaire, déduit des préparations. */
export function equipmentFor(items: CookItem[], storage: StorageInstruction[]): string[] {
  const text = items.flatMap((i) => i.recipe.steps).join(' ').toLowerCase()
  const oven = items.filter((i) => i.method === 'four').length
  const stove = items.filter((i) => i.method === 'plaque').length
  const list: string[] = ['Planche à découper et couteau de chef', 'Saladiers']
  if (oven) list.push(`Four et ${Math.min(oven, OVEN_SLOTS)} plaque${oven > 1 ? 's' : ''} recouverte${oven > 1 ? 's' : ''} de papier cuisson`)
  if (stove) list.push(`${Math.min(stove, BURNERS)} casserole${stove > 1 ? 's' : ''} ou poêle${stove > 1 ? 's' : ''}`)
  if (/mixe/.test(text)) list.push('Mixeur ou mixeur plongeant')
  if (/râpe/.test(text)) list.push('Râpe')
  if (/égoutt|rincer/.test(text)) list.push('Passoire')
  const boxes = Math.ceil(storage.length + items.filter((i) => i.recipe.batchRole === 'sauce').length)
  list.push(`Environ ${boxes} boîtes hermétiques (et des bocaux pour les sauces)`)
  if (storage.some((s) => s.parts.some((p) => p.where === 'congelateur'))) list.push('Sacs ou boîtes allant au congélateur')
  list.push('Étiquettes ou feutre pour dater les boîtes')
  return list
}

/** Instructions de conservation pour chaque repas cuisiné pendant la session. */
export function storagePlan(plan: WeekPlan, session: BatchSession, byId: ReadonlyMap<string, Recipe>): StorageInstruction[] {
  const out: StorageInstruction[] = []
  for (const d of session.days) {
    const day = plan.days[d]
    if (!day) continue
    const offset = daysBetween(session.cookDate, day.date)
    for (const m of day.meals) {
      const r = byId.get(m.recipeId)
      if (!r || !isBatchCooked(r, m.slot)) continue
      const parts = (r.components ?? [{ id: r.id }]).map((c) => byId.get(c.id)!)
      const detail = parts.map((p) => ({ name: p.name.replace(/^Base\s*:\s*/i, ''), where: storageFor(p, offset) }))
      const frozen = detail.some((p) => p.where === 'congelateur')
      out.push({ date: day.date, slot: m.slot, recipeName: r.name, parts: detail, thawOn: frozen ? addDays(day.date, -1) : undefined })
    }
  }
  return out
}

export function buildSessionPlans(plan: WeekPlan, byId: ReadonlyMap<string, Recipe>): SessionPlan[] {
  if (!plan.batch) return []
  return plan.batch.sessions.map((session, index) => {
    const items = sessionItems(plan, session, byId)
    const storage = storagePlan(plan, session, byId)
    const { steps, totalMin } = buildTimeline(items)
    return {
      index,
      cookDate: session.cookDate,
      dates: session.days.map((d) => plan.days[d]?.date).filter(Boolean) as string[],
      items,
      timeline: steps,
      totalMin,
      equipment: equipmentFor(items, storage),
      storage,
    }
  })
}

/** Quantités d'ingrédients à préparer pour un élément de session (grammes). */
export function scaledIngredients(item: CookItem, ingredients: ReadonlyMap<string, Ingredient>): { ingredient: Ingredient; grams: number }[] {
  return item.recipe.ingredients.map(({ id, grams }) => ({ ingredient: ingredients.get(id)!, grams: grams * item.scale }))
}
