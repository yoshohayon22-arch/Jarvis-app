/**
 * Générateur du menu de la semaine — fonctions pures et déterministes (graine aléatoire).
 *
 * Pour chaque jour :
 *  1. on tire de nombreuses combinaisons de recettes compatibles (restrictions, aliments
 *     détestés, variété, règles casher entre repas) ;
 *  2. pour chaque combinaison, on ajuste les portions pour coller aux calories et aux macros ;
 *  3. on garde la meilleure (précision + coût + saison + variété).
 * Les calories de chaque jour restent dans la marge de ±5 % autour de la cible.
 */
import type { Ingredient, Recipe } from '../catalog'
import { addDays } from '../nutrition'
import { canFollow, isRecipeAllowed } from '../restrictions'
import type { DayPlan, MealSlot, PlannedMeal, ProfileSettings, WeekPlan } from '../types'
import { objective, optimizePortions, relativeError, roundPortions, totals, type MacroVector, type PortionProblem } from './portions'
import { KCAL_SHARE, PORTION_BOUNDS, SLOT_HOUR, SLOT_MEAL_TYPE, SLOTS_BY_COUNT } from './slots'
import { canServe, isBatchCooked, planBatch, sessionForDay } from './batch'
import { allowedOnShabbat, dayShares, effectiveSessionDays, festiveTag } from './shabbat'

/** Marge tolérée sur les calories de chaque jour. */
export const KCAL_TOLERANCE = 0.05
/** Nombre maximal d'apparitions d'une même recette par semaine (hors plats de batch). */
export const MAX_USES_PER_WEEK = 3
/** Plats de batch : cuisinés en grande quantité, ils peuvent revenir plus souvent. */
export const MAX_USES_BATCH = 5
/** Combinaisons essayées par jour. */
const ATTEMPTS_PER_DAY = 140

export interface MenuTargets {
  kcal: number
  proteinG: number
  fatG: number
  carbsG: number
}

export interface GeneratorContext {
  settings: ProfileSettings
  targets: MenuTargets
  recipes: Recipe[]
  ingredients: ReadonlyMap<string, Ingredient>
  /** Lundi de la semaine (AAAA-MM-JJ). */
  weekStart: string
  seed: number
  now?: Date
}

// ─────────────────────────── Hasard reproductible ───────────────────────────

/** Générateur pseudo-aléatoire « mulberry32 » : même graine → même suite de nombres. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function weightedPick<T>(items: T[], weights: number[], rng: () => number): T | undefined {
  const total = weights.reduce((s, w) => s + w, 0)
  if (items.length === 0 || total <= 0) return undefined
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

// ─────────────────────────── Outils ───────────────────────────

export const recipePrice = (r: Recipe, lowBudget: boolean) => (lowBudget ? r.perServing.priceBudgetChf : r.perServing.priceChf)

const toVector = (r: Recipe): MacroVector => ({
  kcal: r.perServing.kcal,
  protein: r.perServing.protein,
  fat: r.perServing.fat,
  carbs: r.perServing.carbs,
})

const targetVector = (t: MenuTargets): MacroVector => ({ kcal: t.kcal, protein: t.proteinG, fat: t.fatG, carbs: t.carbsG })

export function maxUses(recipe: Recipe, settings: ProfileSettings): number {
  return settings.batch.enabled && recipe.tags.includes('batch-friendly') ? MAX_USES_BATCH : MAX_USES_PER_WEEK
}

/** Recettes autorisées pour chaque créneau (restrictions + aliments détestés). */
export function buildPools(ctx: GeneratorContext): Record<MealSlot, Recipe[]> {
  const allowed = ctx.recipes.filter(
    (r) => !r.mealTypes.includes('base') && isRecipeAllowed(r, ctx.settings, ctx.ingredients),
  )
  const pools = {} as Record<MealSlot, Recipe[]>
  for (const slot of SLOTS_BY_COUNT[5]) {
    pools[slot] = allowed.filter((r) => SLOT_MEAL_TYPE[slot].some((t) => r.mealTypes.includes(t)))
  }
  return pools
}

/** Le passage du repas précédent à celui-ci respecte-t-il le délai casher ? */
function kosherOk(ctx: GeneratorContext, prev: { recipe: Recipe; hour: number } | null, next: Recipe, hour: number): boolean {
  if (!ctx.settings.restrictions.includes('casher') || !prev) return true
  const gap = hour >= prev.hour ? hour - prev.hour : hour + 24 - prev.hour
  return canFollow(prev.recipe.kashrut, next.kashrut, gap, ctx.settings.kosher.waitAfterMeatHours)
}

interface DayResult {
  recipes: Recipe[]
  portions: number[]
  score: number
}

/**
 * Pour des besoins élevés (prise de masse, sportifs), on autorise des portions plus grandes :
 * le plafond augmente proportionnellement au-delà de 2 300 kcal (jusqu'à +60 %).
 */
export function portionScale(targetKcal: number, mealsPerDay = 3): number {
  // Avec 2 repas par jour (jeûne intermittent), chaque repas est naturellement plus copieux.
  const twoMeals = mealsPerDay === 2 ? 1.4 : 1
  return Math.min(1.6, Math.max(1, targetKcal / 2300)) * twoMeals
}

/** Répartition de l'énergie entre protéines, lipides et glucides (fractions qui somment à 1). */
function energySplit(protein: number, fat: number, carbs: number): [number, number, number] {
  const p = protein * 4
  const f = fat * 9
  const c = carbs * 4
  const t = p + f + c || 1
  return [p / t, f / t, c / t]
}

/**
 * Ressemblance (0 à 1) entre la répartition des macros d'une recette et celle de la cible.
 * Elle oriente le tirage : un menu riche en protéines tire plus souvent les plats protéinés,
 * un menu de prise de masse les plats riches en glucides.
 */
function profileMatch(r: Recipe, target: [number, number, number]): number {
  const s = energySplit(r.perServing.protein, r.perServing.fat, r.perServing.carbs)
  const dist = Math.abs(s[0] - target[0]) + Math.abs(s[1] - target[1]) + Math.abs(s[2] - target[2])
  return Math.exp(-5 * dist)
}

/** Construit le problème d'ajustement des portions pour une liste de plats. */
function portionProblem(slots: MealSlot[], recipes: Recipe[], ctx: GeneratorContext, dayIndex = -1): PortionProblem {
  // Part de chaque repas dans la journée (le repas de Shabbat est plus copieux).
  const share = dayShares(KCAL_SHARE[ctx.settings.mealsPerDay], slots, ctx.settings, dayIndex)
  const scale = portionScale(ctx.targets.kcal, ctx.settings.mealsPerDay)
  const anchors = recipes.map((r, i) => {
    const lo = PORTION_BOUNDS[slots[i]][0]
    const hi = PORTION_BOUNDS[slots[i]][1] * scale
    const ideal = ((share[slots[i]] ?? 0.2) * ctx.targets.kcal) / Math.max(r.perServing.kcal, 1)
    return Math.min(hi, Math.max(lo, ideal))
  })
  return {
    items: recipes.map(toVector),
    anchors,
    min: slots.map((s) => PORTION_BOUNDS[s][0]),
    max: slots.map((s) => PORTION_BOUNDS[s][1] * scale),
    target: targetVector(ctx.targets),
  }
}

interface ScoreOptions {
  costWeight: number
  month: number
  /** Mode batch cooking actif : bonus pour les plats préparés en session. */
  batch?: boolean
  /** Jour de la semaine (0 = lundi), pour les règles du Shabbat. */
  dayIndex?: number
}

/** Évalue une combinaison : précision nutritionnelle + coût + saison. Plus le score est bas, mieux c'est. */
function evaluate(slots: MealSlot[], recipes: Recipe[], ctx: GeneratorContext, opt: ScoreOptions): DayResult {
  const problem = portionProblem(slots, recipes, ctx, opt.dayIndex)
  const portions = roundPortions(problem, optimizePortions(problem), KCAL_TOLERANCE * 0.8)
  const kcalErr = Math.abs(relativeError(totals(problem.items, portions).kcal, ctx.targets.kcal))
  let score = objective(problem, portions)
  // Hors de la marge de ±5 % : fortement pénalisé (la combinaison ne sera retenue qu'en dernier recours).
  if (kcalErr > KCAL_TOLERANCE) score += 10 + kcalErr * 10
  const cost = recipes.reduce((s, r, i) => s + recipePrice(r, ctx.settings.lowBudget) * portions[i], 0)
  score += opt.costWeight * cost
  score += recipes.filter((r) => !r.season.includes(opt.month)).length * 0.01
  // Réalisme : au-delà d'environ 1,8 portion (ajusté aux besoins du profil), on préfère un plat
  // plus consistant plutôt que de multiplier une petite recette.
  const big = 1.8 * portionScale(ctx.targets.kcal, ctx.settings.mealsPerDay)
  score += portions.reduce((sum, p) => sum + Math.max(0, p - big), 0) * 0.04
  // Batch cooking : on veut utiliser ce qu'on a cuisiné en session (bowls, plats mijotés).
  if (opt.batch) {
    recipes.forEach((r, i) => {
      if (r.components) score -= 0.04
      else if (isBatchCooked(r, slots[i])) score -= 0.015
    })
  }
  return { recipes, portions, score }
}

/** Toutes les recettes utilisables par un menu : le catalogue + ses bowls de batch cooking. */
export function planLookup(plan: Pick<WeekPlan, 'bowls'>, recipes: Iterable<Recipe>): Map<string, Recipe> {
  const map = new Map<string, Recipe>()
  for (const r of recipes) map.set(r.id, r)
  for (const b of plan.bowls ?? []) map.set(b.id, b)
  return map
}

/**
 * Règles de batch cooking pour un plat à un jour donné :
 * - un bowl n'est proposé que pendant les jours couverts par SA session ;
 * - un plat cuisiné en session doit se conserver jusqu'au jour prévu (frigo, ou congélateur).
 */
function batchAllowed(
  batch: WeekPlan['batch'],
  weekStart: string,
  byId: ReadonlyMap<string, Recipe>,
  recipe: Recipe,
  dayIndex: number,
  slot: MealSlot,
): boolean {
  if (recipe.components && !batch) return false
  if (!batch || !isBatchCooked(recipe, slot)) return true
  const info = sessionForDay(batch.sessions, weekStart, dayIndex)
  if (!info) return !recipe.components
  if (recipe.components && info.session.bowlId !== recipe.id) return false
  return canServe(recipe, info.offset, byId)
}

/** Bowl proposé pour un jour donné (celui de la session qui couvre ce jour). */
function bowlForDay(batch: WeekPlan['batch'], weekStart: string, byId: ReadonlyMap<string, Recipe>, dayIndex: number): Recipe[] {
  if (!batch) return []
  const info = sessionForDay(batch.sessions, weekStart, dayIndex)
  const bowl = info?.session.bowlId ? byId.get(info.session.bowlId) : undefined
  return bowl ? [bowl] : []
}

// ─────────────────────────── Génération d'une semaine ───────────────────────────

export interface GenerateOptions {
  /** Menu précédent : ses plats verrouillés sont conservés au même jour et au même créneau. */
  previous?: WeekPlan | null
  /** Poids du coût dans le choix (augmenté automatiquement si le budget est dépassé). */
  costWeight?: number
}

/** Poids du coût par défaut : faible en mode normal, plus fort en mode petit budget. */
export const defaultCostWeight = (settings: ProfileSettings) => (settings.lowBudget ? 0.03 : 0.0015)

function generateOnce(ctx: GeneratorContext, opts: GenerateOptions): WeekPlan {
  const rng = createRng(ctx.seed)
  const slots = SLOTS_BY_COUNT[ctx.settings.mealsPerDay]
  const pools = buildPools(ctx)
  const byId = new Map(ctx.recipes.map((r) => [r.id, r]))
  const month = Number(ctx.weekStart.slice(5, 7))
  const scoreOpt: ScoreOptions = { costWeight: opts.costWeight ?? defaultCostWeight(ctx.settings), month }

  // Batch cooking : sessions, bases et bowls de la semaine.
  const batchPlan =
    ctx.settings.batch.enabled && effectiveSessionDays(ctx.settings).length > 0
      ? planBatch(ctx.recipes, { ...ctx.settings, batch: { ...ctx.settings.batch, sessionDays: effectiveSessionDays(ctx.settings) } }, ctx.ingredients, ctx.weekStart, rng, energySplit(ctx.targets.proteinG, ctx.targets.fatG, ctx.targets.carbsG))
      : null
  const batch: WeekPlan['batch'] = batchPlan ? { sessions: batchPlan.sessions } : null
  scoreOpt.batch = Boolean(batch)
  const bowls = [...(batchPlan?.bowls ?? [])]
  for (const b of opts.previous?.bowls ?? []) if (!bowls.some((x) => x.id === b.id)) bowls.push(b)
  bowls.forEach((b) => byId.set(b.id, b))

  // Compte d'utilisation : on intègre d'abord tous les plats verrouillés de la semaine.
  const uses = new Map<string, number>()
  const lockedAt = (day: number, slot: MealSlot): Recipe | undefined => {
    const m = opts.previous?.days[day]?.meals.find((x) => x.slot === slot && x.locked)
    return m ? byId.get(m.recipeId) : undefined
  }
  for (let d = 0; d < 7; d++) {
    for (const s of slots) {
      const r = lockedAt(d, s)
      if (r) uses.set(r.id, (uses.get(r.id) ?? 0) + 1)
    }
  }

  const targetSplit = energySplit(ctx.targets.proteinG, ctx.targets.fatG, ctx.targets.carbsG)
  const days: DayPlan[] = []
  let previousDay: Recipe[] = []
  let lastMeal: { recipe: Recipe; hour: number } | null = null

  for (let d = 0; d < 7; d++) {
    let best: DayResult | null = null
    for (let attempt = 0; attempt < ATTEMPTS_PER_DAY; attempt++) {
      const chosen: Recipe[] = []
      let prev = lastMeal
      let ok = true
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]
        const hour = SLOT_HOUR[slot]
        const locked = lockedAt(d, slot)
        if (locked) {
          chosen.push(locked)
          prev = { recipe: locked, hour }
          continue
        }
        // Dernier recours, seulement si aucune combinaison valide n'a été trouvée : on assouplit la limite hebdomadaire.
        const relax = best === null && attempt > ATTEMPTS_PER_DAY * 0.8
        const pool = slot === 'dejeuner' || slot === 'diner' ? [...pools[slot], ...bowlForDay(batch, ctx.weekStart, byId, d)] : pools[slot]
        const candidates = pool.filter(
          (r) =>
            !chosen.some((c) => c.id === r.id) && // jamais deux fois le même plat dans la journée
            batchAllowed(batch, ctx.weekStart, byId, r, d, slot) &&
            allowedOnShabbat(r, ctx.settings, d) &&
            (relax || (uses.get(r.id) ?? 0) < maxUses(r, ctx.settings)) &&
            kosherOk(ctx, prev, r, hour) &&
            // un plat verrouillé plus tard dans la journée doit rester compatible
            slots.slice(i + 1).every((s2) => {
              const l = lockedAt(d, s2)
              return !l || l.id !== r.id
            }),
        )
        // Shabbat : le repas de fête est choisi parmi les plats traditionnels (s'il y en a pour ce profil).
        const festive = festiveTag(ctx.settings, d, slot)
        if (festive) {
          const traditional = candidates.filter((r) => r.tags.includes(festive))
          if (traditional.length) candidates.splice(0, candidates.length, ...traditional)
        }
        // Batch cooking : le menu est construit autour des bases. Au déjeuner, on sert le bowl
        // de la session dès qu'il est disponible (conservation OK, limite hebdomadaire non atteinte).
        if (batch && slot === 'dejeuner' && !festive) {
          const bowl = candidates.find((r) => r.components)
          if (bowl) candidates.splice(0, candidates.length, bowl)
        }
        const weights = candidates.map((r) => {
          let w = 1 / (1 + (uses.get(r.id) ?? 0)) // varier les plats
          if (previousDay[i]?.id === r.id) w *= 0.25 // éviter le même plat deux jours de suite
          if (!r.season.includes(month)) w *= 0.3 // préférer la saison
          if (ctx.settings.lowBudget && r.tags.includes('petit-budget')) w *= 2
          // Batch cooking : le bowl est le déjeuner type, les plats mijotés sont privilégiés le soir.
          if (r.components) w *= slot === 'dejeuner' ? 8 : 1.5
          else if (batch && isBatchCooked(r, slot)) w *= 1.8
          w *= profileMatch(r, targetSplit)
          return w
        })
        const pick = weightedPick(candidates, weights, rng)
        if (!pick) {
          ok = false
          break
        }
        chosen.push(pick)
        prev = { recipe: pick, hour }
      }
      if (!ok) continue
      // Le dernier repas doit aussi permettre le premier du lendemain (casher : dîner → petit-déj).
      const result = evaluate(slots, chosen, ctx, { ...scoreOpt, dayIndex: d })
      if (!best || result.score < best.score) best = result
    }
    if (!best) throw new Error(`Impossible de composer le jour ${d + 1} avec ces restrictions.`)

    best.recipes.forEach((r) => uses.set(r.id, (uses.get(r.id) ?? 0) + (lockedAt(d, slots[best!.recipes.indexOf(r)]) ? 0 : 1)))
    previousDay = best.recipes
    lastMeal = { recipe: best.recipes[best.recipes.length - 1], hour: SLOT_HOUR[slots[slots.length - 1]] }
    days.push({
      date: addDays(ctx.weekStart, d),
      meals: best.recipes.map((r, i) => ({
        slot: slots[i],
        recipeId: r.id,
        portions: best!.portions[i],
        locked: Boolean(lockedAt(d, slots[i])),
      })),
    })
  }

  return {
    weekStart: ctx.weekStart,
    createdAt: (ctx.now ?? new Date()).toISOString(),
    seed: ctx.seed,
    targets: { ...ctx.targets },
    lowBudget: ctx.settings.lowBudget,
    days,
    batch,
    // On ne garde que les bowls des sessions ou effectivement utilisés.
    bowls: bowls.filter(
      (b) => batch?.sessions.some((s) => s.bowlId === b.id) || days.some((d) => d.meals.some((m) => m.recipeId === b.id)),
    ),
  }
}

/**
 * Génère le menu de la semaine. Si un budget est indiqué et dépassé, on régénère
 * en donnant plus de poids au coût (jusqu'à 4 fois), et on garde le menu le moins cher.
 */
export function generateWeek(ctx: GeneratorContext, opts: GenerateOptions = {}): WeekPlan {
  let weight = opts.costWeight ?? defaultCostWeight(ctx.settings)
  let plan = generateOnce(ctx, { ...opts, costWeight: weight })
  const budget = ctx.settings.weeklyBudgetChf
  if (!budget) return plan
  let cost = weekSummary(plan, planLookup(plan, ctx.recipes)).costChf
  for (let i = 0; i < 4 && cost > budget; i++) {
    weight *= 2.5
    const candidate = generateOnce(ctx, { ...opts, costWeight: weight })
    const c = weekSummary(candidate, planLookup(candidate, ctx.recipes)).costChf
    if (c < cost) {
      plan = candidate
      cost = c
    }
  }
  return plan
}

// ─────────────────────────── Remplacer / verrouiller un plat ───────────────────────────

/**
 * Remplace le plat d'un créneau par une autre recette compatible, en tenant compte des
 * autres plats de la journée et de la semaine, puis réajuste les portions de la journée.
 * `variant` permet d'obtenir une proposition différente à chaque clic.
 */
export function replaceMeal(plan: WeekPlan, ctx: GeneratorContext, dayIndex: number, slot: MealSlot, variant = 0): WeekPlan {
  const byId = planLookup(plan, ctx.recipes)
  const day = plan.days[dayIndex]
  const slots = day.meals.map((m) => m.slot)
  const idx = slots.indexOf(slot)
  if (idx === -1) return plan
  const current = day.meals[idx].recipeId
  const dayRecipes = day.meals.map((m) => byId.get(m.recipeId)!)

  const uses = new Map<string, number>()
  plan.days.forEach((dd) => dd.meals.forEach((m) => uses.set(m.recipeId, (uses.get(m.recipeId) ?? 0) + 1)))

  const prevMeal = (i: number): { recipe: Recipe; hour: number } | null => {
    if (i > 0) return { recipe: dayRecipes[i - 1], hour: SLOT_HOUR[slots[i - 1]] }
    const yesterday = plan.days[dayIndex - 1]
    if (!yesterday) return null
    const last = yesterday.meals[yesterday.meals.length - 1]
    return { recipe: byId.get(last.recipeId)!, hour: SLOT_HOUR[last.slot] }
  }

  const pool = [...buildPools(ctx)[slot], ...(slot === 'dejeuner' || slot === 'diner' ? bowlForDay(plan.batch, plan.weekStart, byId, dayIndex) : [])]
  const month = Number(plan.weekStart.slice(5, 7))
  const scoreOpt = { costWeight: defaultCostWeight(ctx.settings), month, batch: Boolean(plan.batch), dayIndex }
  // Repas de Shabbat : on remplace par un autre plat traditionnel quand il en existe.
  const tag = festiveTag(ctx.settings, dayIndex, slot)
  const hasTraditional = Boolean(tag) && pool.some((r) => r.id !== current && r.tags.includes(tag!))
  const scored = pool
    .filter(
      (r) =>
        r.id !== current &&
        batchAllowed(plan.batch, plan.weekStart, byId, r, dayIndex, slot) &&
        allowedOnShabbat(r, ctx.settings, dayIndex) &&
        (!festiveTag(ctx.settings, dayIndex, slot) || r.tags.includes(festiveTag(ctx.settings, dayIndex, slot)!) || !hasTraditional) &&
        !dayRecipes.some((c, i) => i !== idx && c.id === r.id) &&
        (uses.get(r.id) ?? 0) < maxUses(r, ctx.settings) &&
        kosherOk(ctx, prevMeal(idx), r, SLOT_HOUR[slot]) &&
        // le repas suivant doit rester compatible avec le nouveau plat
        (idx === slots.length - 1 || kosherOk(ctx, { recipe: r, hour: SLOT_HOUR[slot] }, dayRecipes[idx + 1], SLOT_HOUR[slots[idx + 1]])),
    )
    .map((r) => {
      const recipes = dayRecipes.map((c, i) => (i === idx ? r : c))
      return evaluate(slots, recipes, ctx, scoreOpt)
    })
    .sort((a, b) => a.score - b.score)

  if (scored.length === 0) return plan
  // On propose une des meilleures options, différente selon `variant`.
  const top = scored.slice(0, Math.min(6, scored.length))
  const rng = createRng(plan.seed + dayIndex * 31 + idx * 7 + variant * 101)
  const chosen = top[Math.floor(rng() * top.length)]

  const newDay: DayPlan = {
    ...day,
    meals: day.meals.map((m, i) => ({ ...m, recipeId: chosen.recipes[i].id, portions: chosen.portions[i] })),
  }
  return { ...plan, days: plan.days.map((dd, i) => (i === dayIndex ? newDay : dd)) }
}

export function toggleLock(plan: WeekPlan, dayIndex: number, slot: MealSlot): WeekPlan {
  return {
    ...plan,
    days: plan.days.map((d, i) =>
      i !== dayIndex ? d : { ...d, meals: d.meals.map((m) => (m.slot === slot ? { ...m, locked: !m.locked } : m)) },
    ),
  }
}

// ─────────────────────────── Résumés ───────────────────────────

export interface DaySummary {
  kcal: number
  protein: number
  fat: number
  carbs: number
  costChf: number
}

export function mealValues(meal: PlannedMeal, recipe: Recipe, lowBudget: boolean): DaySummary {
  const p = meal.portions
  return {
    kcal: recipe.perServing.kcal * p,
    protein: recipe.perServing.protein * p,
    fat: recipe.perServing.fat * p,
    carbs: recipe.perServing.carbs * p,
    costChf: recipePrice(recipe, lowBudget) * p,
  }
}

export function daySummary(day: DayPlan, byId: ReadonlyMap<string, Recipe>, lowBudget: boolean): DaySummary {
  const s = { kcal: 0, protein: 0, fat: 0, carbs: 0, costChf: 0 }
  for (const m of day.meals) {
    const r = byId.get(m.recipeId)
    if (!r) continue
    const v = mealValues(m, r, lowBudget)
    s.kcal += v.kcal
    s.protein += v.protein
    s.fat += v.fat
    s.carbs += v.carbs
    s.costChf += v.costChf
  }
  return s
}

export function weekSummary(plan: WeekPlan, byId: ReadonlyMap<string, Recipe>): DaySummary & { costPerDayChf: number } {
  const days = plan.days.map((d) => daySummary(d, byId, plan.lowBudget))
  const sum = (k: keyof DaySummary) => days.reduce((s, d) => s + d[k], 0)
  const costChf = Math.round(sum('costChf') * 100) / 100
  return {
    kcal: sum('kcal') / 7,
    protein: sum('protein') / 7,
    fat: sum('fat') / 7,
    carbs: sum('carbs') / 7,
    costChf,
    costPerDayChf: Math.round((costChf / 7) * 100) / 100,
  }
}

/** Lundi de la semaine contenant `date` (AAAA-MM-JJ). */
export function mondayOf(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7 // 0 = lundi
  return addDays(isoDate, -dow)
}

/**
 * Garde les mêmes plats mais réajuste les portions à de nouveaux besoins
 * (après une pesée ou une modification du profil).
 */
export function refitPortions(plan: WeekPlan, ctx: GeneratorContext): WeekPlan {
  const byId = planLookup(plan, ctx.recipes)
  const scoreOpt = { costWeight: 0, month: Number(plan.weekStart.slice(5, 7)) }
  return {
    ...plan,
    targets: { ...ctx.targets },
    lowBudget: ctx.settings.lowBudget,
    days: plan.days.map((d, dayIndex) => {
      const slots = d.meals.map((m) => m.slot)
      const res = evaluate(slots, d.meals.map((m) => byId.get(m.recipeId)!), ctx, { ...scoreOpt, dayIndex })
      return { ...d, meals: d.meals.map((m, i) => ({ ...m, portions: res.portions[i] })) }
    }),
  }
}

/** Semaine à planifier : la semaine en cours, ou la suivante à partir du samedi. */
export function planningWeekStart(today: string): string {
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7 // 0 = lundi
  return dow >= 5 ? addDays(mondayOf(today), 7) : mondayOf(today)
}

/** Les besoins ont-ils assez changé (> 3 %) pour proposer d'adapter les portions ? */
export function targetsChanged(plan: WeekPlan, targets: MenuTargets): boolean {
  return Math.abs(plan.targets.kcal / targets.kcal - 1) > 0.03 || Math.abs(plan.targets.proteinG / targets.proteinG - 1) > 0.05
}
