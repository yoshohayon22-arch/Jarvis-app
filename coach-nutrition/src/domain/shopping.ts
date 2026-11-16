/**
 * Liste de courses générée depuis le menu — fonctions pures.
 *
 * - Les quantités de toutes les recettes sont additionnées (portions prévues au menu).
 * - Chaque ingrédient est arrondi aux conditionnements réels du magasin, en choisissant
 *   la combinaison de paquets la moins chère qui couvre le besoin (ex. 1,3 kg de riz → 1 × 1 kg + 1 × 500 g,
 *   ou 2 × 1 kg si c'est moins cher).
 * - Classement par rayon ; les produits de placard (huile, épices…) sont listés à part.
 * - Avec le batch cooking : une liste par session.
 */
import { AISLE_LABELS, type Aisle, type Ingredient, type PriceEntry, type Recipe } from './catalog'
import { shoppingReminders } from './restrictions'
import { formatDate } from '../lib/format'
import type { Restriction, WeekPlan } from './types'

/** Ordre des rayons dans un magasin suisse typique (entrée : fruits et légumes). */
export const AISLE_ORDER: Aisle[] = [
  'fruits-legumes',
  'boulangerie',
  'boucherie',
  'poissonnerie',
  'cremerie',
  'epicerie',
  'conserves',
  'petit-dej',
  'fruits-secs',
  'surgeles',
  'condiments',
]

/**
 * Produits qui se gardent au moins une semaine : ce qui reste d'une session sert à la suivante
 * (épicerie, conserves, surgelés, légumes et fruits de garde).
 */
const KEEPS_AISLES: Aisle[] = ['epicerie', 'conserves', 'surgeles', 'petit-dej', 'fruits-secs', 'condiments']
const KEEPS_IDS = new Set(['carottes', 'oignons', 'pommes-de-terre', 'pommes', 'ail', 'courge-butternut', 'celeri-rave', 'chou-blanc', 'citron', 'patate-douce', 'oeufs', 'gruyere', 'parmesan', 'beurre'])
export const keepsAWeek = (ing: Ingredient) => KEEPS_AISLES.includes(ing.aisle) || KEEPS_IDS.has(ing.id)

/** Produits qu'on a souvent déjà à la maison : listés à part, hors total. */
const PANTRY_IDS = new Set(['farine-ble', 'levure-seche', 'miel', 'cacao-poudre'])
export const isPantry = (ing: Ingredient) => ing.aisle === 'condiments' || PANTRY_IDS.has(ing.id)

export interface Purchase {
  count: number
  entry: PriceEntry
  /** Pour un produit au poids : quantité prise (g ou ml). */
  quantity?: number
  priceChf: number
}

/** Quantité minimale au rayon vrac ou à la coupe (on ne demande pas 6 g de fromage). */
export const MIN_BY_WEIGHT = 100

export interface ShoppingItem {
  ingredient: Ingredient
  /** Besoin total en grammes (ou ml). */
  neededGrams: number
  /** Besoin exprimé dans l'unité d'achat (pièces pour les œufs). */
  neededUnits: number
  purchases: Purchase[]
  totalChf: number
  pantry: boolean
  /** Quantité déjà en stock (reste d'une session précédente), dans l'unité d'achat. */
  fromStock: number
}

export interface ShoppingList {
  id: string
  title: string
  subtitle: string
  aisles: { aisle: Aisle; label: string; items: ShoppingItem[] }[]
  pantry: ShoppingItem[]
  totalChf: number
  reminders: string[]
}

/**
 * Combinaison de paquets la moins chère couvrant `need` (dans l'unité d'achat).
 * À prix égal, on préfère le moins de gaspillage, puis le moins de paquets.
 */
export function bestPurchase(need: number, entries: PriceEntry[]): Purchase[] {
  if (need <= 0 || entries.length === 0) return []
  const packs = bestPackages(need, entries.filter((e) => !e.byWeight))
  const packsPrice = packs.reduce((s, p) => s + p.priceChf, 0)
  // Au poids : on prend la quantité nécessaire (au moins 100 g, arrondie aux 50 g).
  const loose = entries
    .filter((e) => e.byWeight)
    .map((e) => {
      const quantity = Math.max(MIN_BY_WEIGHT, Math.ceil(need / 50) * 50)
      return { count: 1, entry: e, quantity, priceChf: Math.round(((e.priceChf * quantity) / e.packageSize) * 100) / 100 }
    })
    .sort((a, b) => a.priceChf - b.priceChf)[0]
  if (loose && (packs.length === 0 || loose.priceChf < packsPrice)) return [loose]
  return packs
}

function bestPackages(need: number, entries: PriceEntry[]): Purchase[] {
  if (entries.length === 0) return []
  // On garde au plus 3 options (les moins chères au gramme) : la recherche exhaustive reste instantanée.
  const options = [...entries].sort((a, b) => a.priceChf / a.packageSize - b.priceChf / b.packageSize).slice(0, 3)
  let best: { counts: number[]; price: number; waste: number; packs: number } | null = null
  const max = options.map((o) => Math.ceil(need / o.packageSize))
  const counts = options.map(() => 0)
  const visit = (i: number) => {
    if (i === options.length) {
      const qty = counts.reduce((s, c, k) => s + c * options[k].packageSize, 0)
      if (qty < need) return
      const price = counts.reduce((s, c, k) => s + c * options[k].priceChf, 0)
      const waste = qty - need
      const packs = counts.reduce((s, c) => s + c, 0)
      const better =
        !best ||
        price < best.price - 1e-9 ||
        (Math.abs(price - best.price) < 1e-9 && (waste < best.waste || (waste === best.waste && packs < best.packs)))
      if (better) best = { counts: [...counts], price, waste, packs }
      return
    }
    for (let c = 0; c <= max[i]; c++) {
      counts[i] = c
      visit(i + 1)
    }
    counts[i] = 0
  }
  visit(0)
  const found = best as { counts: number[] } | null
  return found
    ? options
        .map((entry, k) => ({ count: found.counts[k], entry, priceChf: Math.round(found.counts[k] * entry.priceChf * 100) / 100 }))
        .filter((p) => p.count > 0)
    : []
}

/** Besoin exprimé dans l'unité d'achat : grammes / ml, ou nombre de pièces (arrondi au-dessus). */
export function toPurchaseUnits(ingredient: Ingredient, grams: number): number {
  if (ingredient.unit === 'piece') return Math.ceil(grams / (ingredient.gramsPerPiece ?? 1) - 0.05)
  return grams
}

/** Additionne les ingrédients d'une liste de repas (portions prévues). */
export function aggregateIngredients(
  meals: { recipeId: string; portions: number }[],
  byId: ReadonlyMap<string, Recipe>,
): Map<string, number> {
  const total = new Map<string, number>()
  for (const m of meals) {
    const r = byId.get(m.recipeId)
    if (!r) continue
    for (const { id, grams } of r.ingredients) {
      total.set(id, (total.get(id) ?? 0) + (grams / r.servings) * m.portions)
    }
  }
  return total
}

export function buildList(
  id: string,
  title: string,
  subtitle: string,
  meals: { recipeId: string; portions: number }[],
  byId: ReadonlyMap<string, Recipe>,
  ingredients: ReadonlyMap<string, Ingredient>,
  prices: Record<string, PriceEntry[]>,
  options: { lowBudget: boolean; restrictions: Restriction[]; shabbat?: boolean },
  /** Stock restant des listes précédentes (modifié sur place : ce qui reste après cette liste). */
  stock: Map<string, number> = new Map(),
): ShoppingList {
  const items: ShoppingItem[] = []
  for (const [ingId, grams] of aggregateIngredients(meals, byId)) {
    const ingredient = ingredients.get(ingId)!
    const all = prices[ingId] ?? []
    // Mode normal : produits standard ; mode petit budget : tous, le moins cher l'emporte.
    const standard = all.filter((e) => !e.budgetLine)
    const entries = options.lowBudget || standard.length === 0 ? all : standard
    const neededUnits = toPurchaseUnits(ingredient, grams)
    const fromStock = Math.min(stock.get(ingId) ?? 0, neededUnits)
    const purchases = bestPurchase(neededUnits - fromStock, entries)
    const bought = purchases.reduce((s, p) => s + (p.quantity ?? p.count * p.entry.packageSize), 0)
    // Ce qui reste (si le produit se garde) servira à la session suivante.
    stock.set(ingId, keepsAWeek(ingredient) ? (stock.get(ingId) ?? 0) - fromStock + bought - (neededUnits - fromStock) : 0)
    items.push({
      ingredient,
      neededGrams: grams,
      neededUnits,
      purchases,
      totalChf: Math.round(purchases.reduce((s, p) => s + p.priceChf, 0) * 100) / 100,
      pantry: isPantry(ingredient),
      fromStock,
    })
  }
  const byName = (a: ShoppingItem, b: ShoppingItem) => a.ingredient.name.localeCompare(b.ingredient.name, 'fr')
  const main = items.filter((i) => !i.pantry)
  return {
    id,
    title,
    subtitle,
    aisles: AISLE_ORDER.map((aisle) => ({
      aisle,
      label: AISLE_LABELS[aisle],
      items: main.filter((i) => i.ingredient.aisle === aisle).sort(byName),
    })).filter((a) => a.items.length > 0),
    pantry: items.filter((i) => i.pantry).sort(byName),
    totalChf: Math.round(main.reduce((s, i) => s + i.totalChf, 0) * 100) / 100,
    reminders: shoppingReminders(options.restrictions, options.shabbat),
  }
}

/** Listes de courses du menu : une par session de batch cooking, sinon une pour la semaine. */
export function buildShoppingLists(
  plan: WeekPlan,
  byId: ReadonlyMap<string, Recipe>,
  ingredients: ReadonlyMap<string, Ingredient>,
  prices: Record<string, PriceEntry[]>,
  restrictions: Restriction[],
  shabbat = false,
): ShoppingList[] {
  const options = { lowBudget: plan.lowBudget, restrictions, shabbat }
  const span = (dates: string[]) =>
    `du ${formatDate(dates[0], { weekday: 'long', day: 'numeric', month: 'long' })} au ${formatDate(dates[dates.length - 1], { weekday: 'long', day: 'numeric', month: 'long' })}`
  if (plan.batch && plan.batch.sessions.length > 0) {
    const stock = new Map<string, number>()
    return plan.batch.sessions.map((s, i) => {
      const dates = s.days.map((d) => plan.days[d].date)
      const meals = s.days.flatMap((d) => plan.days[d].meals)
      return buildList(
        `${plan.createdAt}#${i}`,
        `Courses pour la session ${i + 1}`,
        `À faire avant de cuisiner le ${formatDate(s.cookDate, { weekday: 'long', day: 'numeric', month: 'long' })} · repas ${span(dates)}`,
        meals,
        byId,
        ingredients,
        prices,
        options,
        stock,
      )
    })
  }
  const dates = plan.days.map((d) => d.date)
  return [
    buildList(`${plan.createdAt}#semaine`, 'Courses de la semaine', `Repas ${span(dates)}`, plan.days.flatMap((d) => d.meals), byId, ingredients, prices, options),
  ]
}

/** Quantité lisible : « 1,2 kg », « 750 g », « 8 pièces ». */
export function formatAmount(ingredient: Ingredient, units: number): string {
  if (ingredient.unit === 'piece') return `${units} pièce${units >= 2 ? 's' : ''}`
  const unit = ingredient.unit === 'ml' ? ['ml', 'l'] : ['g', 'kg']
  if (units >= 1000) return `${(Math.round(units / 100) / 10).toLocaleString('fr-CH')} ${unit[1]}`
  return `${Math.max(1, Math.round(units))} ${unit[0]}`
}

/** « 2 × M-Budget Pâtes (500 g, Migros) » ou « ≈ 150 g au poids — Gruyère AOP (CHF 17.00/kg, Migros) » */
export function formatPurchase(ingredient: Ingredient, p: Purchase): string {
  if (p.quantity !== undefined) {
    const perKg = (p.entry.priceChf * 1000) / p.entry.packageSize
    return `≈ ${formatAmount(ingredient, p.quantity)} au poids — ${p.entry.label.replace(/\s*\((prix )?au kg\)/, '')} (CHF ${perKg.toFixed(2)}/kg, ${p.entry.store})`
  }
  return `${p.count} × ${p.entry.label} (${formatAmount(ingredient, p.entry.packageSize)}, ${p.entry.store})`
}

/** Texte d'achat d'un article, en tenant compte du stock restant. */
export function purchaseText(item: ShoppingItem): string {
  const parts = item.purchases.map((p) => formatPurchase(item.ingredient, p))
  if (item.fromStock > 0) {
    const stockTxt = `${formatAmount(item.ingredient, item.fromStock)} déjà achetés à la session précédente`
    return parts.length ? `${stockTxt} + ${parts.join(' + ')}` : `Rien à acheter : ${stockTxt}`
  }
  return parts.join(' + ')
}

/** Version texte pour le bouton « copier ». */
export function listToText(list: ShoppingList, checked: string[] = []): string {
  const lines = [list.title, list.subtitle, '']
  for (const a of list.aisles) {
    lines.push(a.label.toUpperCase())
    for (const i of a.items) {
      const box = checked.includes(i.ingredient.id) ? '☑' : '☐'
      lines.push(`${box} ${i.ingredient.name} — ${formatAmount(i.ingredient, i.neededUnits)} → ${purchaseText(i)}`)
    }
    lines.push('')
  }
  if (list.pantry.length) {
    lines.push('PLACARD (vérifier avant d’acheter)')
    for (const i of list.pantry) lines.push(`☐ ${i.ingredient.name} — ${formatAmount(i.ingredient, i.neededUnits)}`)
    lines.push('')
  }
  lines.push(`Total estimé : CHF ${list.totalChf.toFixed(2)}`)
  for (const r of list.reminders) lines.push(`• ${r}`)
  return lines.join('\n')
}
