/**
 * « Créer un repas avec ce que j'ai » : on dit ce qu'on a au frigo ou au placard, l'app compose
 * une assiette avec CES produits (quantités calculées pour les besoins du repas) et liste les recettes
 * du catalogue faisables, avec ce qui manque.
 *
 * Fonctions pures. Les règles du profil (casher, halal, végétarien, allergies, aliments détestés)
 * sont vérifiées avec les mêmes fonctions que pour les recettes : l'assiette composée est traitée
 * comme une recette.
 *
 * Hypothèse : on a toujours de l'huile, du sel, du poivre et des épices (le « placard de base »).
 */
import type { Ingredient, Recipe } from './catalog'
import { momentShare, type IdeaMoment } from './meal-ideas'
import { createRng } from './menu/generator'
import { computeKashrut, isRecipeAllowed, normalizeWord, type DietProfile } from './restrictions'
import type { Kashrut } from './catalog'
import type { MealsPerDay } from './types'

export type FridgeRole = 'proteine' | 'feculent' | 'legume' | 'fruit' | 'laitage' | 'garniture' | 'placard'

// ─────────────────────────── Rôle de chaque aliment ───────────────────────────

const PROTEINS = new Set([
  'oeufs', 'tofu-nature', 'sere-maigre', 'cottage-cheese', 'yaourt-grec', 'thon-conserve', 'sardines-huile', 'maquereau-conserve',
  'colin-filet', 'crevettes', 'lentilles-corail', 'lentilles-vertes', 'pois-chiches-conserve', 'haricots-rouges-conserve',
  'haricots-blancs-conserve', 'pois-casses', 'edamame-surgeles',
])
const DAIRY = new Set(['yaourt-nature', 'yaourt-soja', 'lait', 'lait-sans-lactose', 'boisson-avoine', 'feta', 'mozzarella', 'ricotta', 'gruyere', 'parmesan', 'fromage-raclette'])
const STARCH = new Set(['pommes-de-terre', 'patate-douce', 'mais-conserve', 'muesli-nature', 'galettes-riz'])
const FRUIT = new Set(['pommes', 'bananes', 'poires', 'oranges', 'clementines', 'kiwis', 'baies-surgelees', 'raisins-secs', 'dattes'])
const VEG_EXTRA = new Set(['epinards-surgeles', 'petits-pois-surgeles', 'haricots-verts-surgeles', 'melange-legumes-surgeles', 'tomates-pelees-conserve'])
const GARNISH = new Set(['avocat', 'olives', 'amandes', 'noix', 'graines-courge', 'graines-lin', 'beurre-cacahuete', 'tahini', 'pesto-basilic'])
const PANTRY = new Set(['ail', 'gingembre', 'citron', 'farine-ble', 'levure-seche', 'miel', 'cacao-poudre', 'chocolat-noir', 'beurre', 'creme-cuisine', 'lait-coco', 'oignons'])

/** Rôle d'un ingrédient dans une assiette. */
export function roleOf(ing: Ingredient): FridgeRole {
  const id = ing.id
  if (ing.aisle === 'condiments' && !GARNISH.has(id)) return 'placard'
  if (PANTRY.has(id)) return 'placard'
  if (PROTEINS.has(id) || ing.aisle === 'boucherie' || ing.aisle === 'poissonnerie') return 'proteine'
  if (DAIRY.has(id)) return 'laitage'
  if (GARNISH.has(id) || ing.aisle === 'fruits-secs' && !FRUIT.has(id)) return 'garniture'
  if (FRUIT.has(id)) return 'fruit'
  if (STARCH.has(id) || ing.aisle === 'epicerie' || ing.aisle === 'boulangerie') return 'feculent'
  if (ing.aisle === 'fruits-legumes' || VEG_EXTRA.has(id) || ing.aisle === 'surgeles') return 'legume'
  return 'garniture'
}

// ─────────────────────────── Lire ce que l'utilisateur tape ───────────────────────────

/** Mots courants → ingrédient du catalogue. */
const SYNONYMS: Record<string, string> = {
  poulet: 'poulet-emince', 'blanc de poulet': 'poulet-emince', 'cuisse de poulet': 'cuisses-poulet', dinde: 'dinde-escalope',
  boeuf: 'boeuf-hache', 'viande hachee': 'boeuf-hache', 'steak hache': 'boeuf-hache', veau: 'veau-emince', porc: 'porc-emince', jambon: 'jambon-cuit',
  saumon: 'saumon-filet', truite: 'truite-filet', cabillaud: 'cabillaud-filet', colin: 'colin-filet', poisson: 'cabillaud-filet',
  thon: 'thon-conserve', sardine: 'sardines-huile', maquereau: 'maquereau-conserve', crevette: 'crevettes',
  oeuf: 'oeufs', tofu: 'tofu-nature', sere: 'sere-maigre', quark: 'sere-maigre', cottage: 'cottage-cheese', 'fromage blanc': 'sere-maigre',
  yaourt: 'yaourt-nature', 'yaourt grec': 'yaourt-grec', 'yogourt': 'yaourt-nature', lait: 'lait', fromage: 'gruyere', raclette: 'fromage-raclette',
  lentille: 'lentilles-vertes', 'lentille corail': 'lentilles-corail', 'pois chiche': 'pois-chiches-conserve', haricot: 'haricots-rouges-conserve',
  'haricot rouge': 'haricots-rouges-conserve', 'haricot blanc': 'haricots-blancs-conserve', 'haricot vert': 'haricots-verts-surgeles',
  riz: 'riz-long', 'riz complet': 'riz-complet', pate: 'pates', spaghetti: 'pates', semoule: 'semoule-couscous', couscous: 'semoule-couscous',
  pain: 'pain-complet', 'pomme de terre': 'pommes-de-terre', patate: 'pommes-de-terre', pdt: 'pommes-de-terre', 'patate douce': 'patate-douce',
  flocon: 'flocons-avoine', avoine: 'flocons-avoine', muesli: 'muesli-nature', nouille: 'nouilles-riz', kasha: 'sarrasin',
  tomate: 'tomates', carotte: 'carottes', courgette: 'courgette', poivron: 'poivron', oignon: 'oignons', salade: 'salade-verte', laitue: 'salade-verte',
  epinard: 'epinards-surgeles', champignon: 'champignons-paris', brocoli: 'brocoli', 'chou fleur': 'chou-fleur', chou: 'chou-blanc', 'petit pois': 'petits-pois-surgeles',
  concombre: 'concombre', courge: 'courge-butternut', butternut: 'courge-butternut', poireau: 'poireau', betterave: 'betterave-cuite', aubergine: 'aubergine',
  legume: 'melange-legumes-surgeles', 'legumes surgeles': 'melange-legumes-surgeles', mais: 'mais-conserve',
  pomme: 'pommes', banane: 'bananes', poire: 'poires', orange: 'oranges', clementine: 'clementines', kiwi: 'kiwis',
  'fruit rouge': 'baies-surgelees', baie: 'baies-surgelees', noix: 'noix', amande: 'amandes', avocat: 'avocat', olive: 'olives',
  'beurre de cacahuete': 'beurre-cacahuete', 'creme': 'creme-cuisine', beurre: 'beurre', 'lait de coco': 'lait-coco', coco: 'lait-coco',
  choufleur: 'chou-fleur', 'chou rouge': 'chou-rouge', 'flocon d avoine': 'flocons-avoine', sarrasin: 'sarrasin', fenouil: 'fenouil',
  ricotta: 'ricotta', feta: 'feta', mozzarella: 'mozzarella', parmesan: 'parmesan', gruyere: 'gruyere', huile: 'huile-colza', "huile d olive": 'huile-olive',
}

const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b\d+\s*(g|kg|ml|l|x)?\b/g, ' ') // « 2 courgettes », « 500 g de riz »
    .replace(/\b(de|des|du|d|la|le|les|un|une|en|au|aux|boite|paquet|reste|restes|frais|fraiche)\b/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeWord)
    .join(' ')

/** Synonymes normalisés de la même façon que le texte saisi (pluriels, accents, mots de liaison). */
let normalizedSynonyms: [string, string][] | null = null
const synonyms = () =>
  (normalizedSynonyms ??= Object.entries(SYNONYMS)
    .map(([k, v]) => [clean(k), v] as [string, string])
    // Expression la plus longue d'abord : « pomme de terre » avant « pomme », « yaourt grec » avant « yaourt ».
    .sort((a, b) => b[0].length - a[0].length))

/** Trouve l'ingrédient du catalogue le plus proche d'un mot ou d'une expression. */
export function matchIngredient(text: string, ingredients: readonly Ingredient[]): Ingredient | null {
  const q = clean(text)
  if (!q) return null
  const byId = new Map(ingredients.map((i) => [i.id, i]))
  for (const [k, id] of synonyms()) if (k === q && byId.has(id)) return byId.get(id)!
  for (const [k, id] of synonyms()) if (` ${q} `.includes(` ${k} `) && byId.has(id)) return byId.get(id)!
  // Sinon : nom du catalogue qui contient tous les mots ; le nom le plus court gagne (le plus générique).
  const words = q.split(' ')
  const hits = ingredients.filter((i) => {
    const name = ` ${clean(i.name)} `
    return words.every((w) => name.includes(` ${w} `) || name.includes(` ${w}`))
  })
  hits.sort((a, b) => a.name.length - b.name.length)
  return hits[0] ?? null
}

/** Lit une liste tapée librement (« poulet, riz et 2 courgettes ») : ingrédients reconnus + mots inconnus. */
export function parseFridgeText(text: string, ingredients: readonly Ingredient[]): { found: string[]; unknown: string[] } {
  const parts = text
    .split(/[,;\n+]|\bet\b/i)
    .map((s) => s.trim())
    .filter(Boolean)
  const found: string[] = []
  const unknown: string[] = []
  for (const p of parts) {
    const ing = matchIngredient(p, ingredients)
    if (ing) {
      if (!found.includes(ing.id)) found.push(ing.id)
    } else unknown.push(p)
  }
  return { found, unknown }
}

// ─────────────────────────── Composer l'assiette ───────────────────────────

export interface PlateItem {
  id: string
  grams: number
  role: FridgeRole
  /** Ingrédient du placard de base, pas forcément listé par l'utilisateur. */
  pantry?: boolean
}

export interface ComposedMeal {
  title: string
  items: PlateItem[]
  kcal: number
  protein: number
  fat: number
  carbs: number
  kashrut: Kashrut
  steps: string[]
  /** Ce qui manque pour un repas complet (pas de protéine, pas de légume…). */
  tips: string[]
}

export interface FridgeProfile extends DietProfile {
  mealsPerDay: MealsPerDay
}

interface Targets {
  kcal: number
  protein: number
}

/** Bornes réalistes (en grammes) d'une portion, par aliment ou type d'aliment. */
function bounds(ing: Ingredient, role: FridgeRole, moment: IdeaMoment): [number, number] {
  const id = ing.id
  const small = moment === 'collation'
  if (role === 'proteine') {
    if (id === 'oeufs') return small ? [55, 110] : [110, 220]
    if (/^lentilles|pois-casses/.test(id)) return [50, 120]
    if (ing.aisle === 'conserves' && !ing.tags.includes('poisson')) return small ? [60, 120] : [120, 300]
    if (['sere-maigre', 'cottage-cheese', 'yaourt-grec'].includes(id)) return small ? [100, 200] : [150, 300]
    if (ing.aisle === 'conserves') return small ? [40, 80] : [60, 180]
    return small ? [60, 120] : [100, 250]
  }
  if (role === 'feculent') {
    if (/^(riz|pates|quinoa|boulgour|semoule|polenta|orge|nouilles|sarrasin|millet)/.test(id)) return [40, 140]
    if (/^flocons|muesli/.test(id)) return [30, 90]
    if (id === 'galettes-riz') return [20, 50]
    if (ing.aisle === 'boulangerie') return small ? [30, 60] : [50, 160]
    if (id === 'gnocchi') return [150, 400]
    if (id === 'mais-conserve') return [80, 200]
    return [150, 500] // pommes de terre, patate douce
  }
  if (role === 'laitage') {
    if (['gruyere', 'parmesan', 'fromage-raclette'].includes(id)) return [15, 40]
    if (['feta', 'mozzarella', 'ricotta'].includes(id)) return [30, 80]
    return small ? [100, 200] : [150, 300] // yaourts, lait
  }
  if (role === 'fruit') return /raisins|dattes/.test(id) ? [15, 40] : small ? [100, 150] : [100, 200]
  if (role === 'garniture') return id === 'avocat' ? [40, 80] : id === 'olives' ? [20, 40] : [10, 20]
  return [80, 400] // légumes
}

const round = (g: number, id: string) => (id === 'oeufs' ? Math.max(55, Math.round(g / 55) * 55) : g < 100 ? Math.round(g / 5) * 5 : Math.round(g / 10) * 10)
const per = (ing: Ingredient, key: 'kcal' | 'protein' | 'fat' | 'carbs', g: number) => (ing.per100g[key] * g) / 100

/** Nom court pour le titre de l'assiette (« Poitrine de poulet » → « poulet »…). */
export function shortName(ing: Ingredient): string {
  const base = ing.name.split(' (')[0].replace(/ en conserve| surgelés| écossés| décortiqué| à l’huile.*$/i, '')
  const lower = base.charAt(0).toLowerCase() + base.slice(1)
  return lower.replace(/^poitrine de /, '').replace(/^filet de /, '').replace(/^escalope de /, '').replace(/^viande hachée de /, '').replace(/^émincé de /, '')
}

const HINTS: [RegExp, string][] = [
  [/^(poulet|dinde|veau|porc|boeuf-hache)/, 'Saisir {x} en lamelles dans l’huile chaude, 6 à 8 min, jusqu’à cuisson à cœur.'],
  [/^cuisses-poulet/, 'Rôtir {x} 35 min à 210 °C.'],
  [/^boeuf-ragout|lapin/, 'Faire mijoter {x} 1 h à couvert avec un fond d’eau et des épices.'],
  [/filet$/, 'Cuire {x} 12 min au four à 200 °C (ou 3 min par face à la poêle).'],
  [/^crevettes/, 'Poêler {x} 3 à 4 min avec un peu d’ail.'],
  [/^oeufs/, 'Cuire {x} en omelette, au plat ou mollets (6 min dans l’eau bouillante).'],
  [/^tofu/, 'Couper {x} en cubes et le dorer 6 min dans l’huile.'],
  [/^lentilles-corail|pois-casses/, 'Cuire {x} 15 à 35 min dans deux fois leur volume d’eau.'],
  [/^lentilles/, 'Cuire {x} 20 min à l’eau frémissante.'],
  [/conserve$/, 'Rincer {x} et les réchauffer 3 min avec les épices (ou les servir froids).'],
  [/^edamame/, 'Cuire {x} 5 min à l’eau bouillante salée.'],
  [/^(riz|quinoa|boulgour|semoule|millet|sarrasin|orge|nouilles)/, 'Cuire {x} à l’eau salée (temps indiqué sur le paquet, 10 à 20 min).'],
  [/^pates/, 'Cuire {x} al dente dans l’eau bouillante salée.'],
  [/^polenta/, 'Cuire {x} 5 à 10 min dans quatre fois son volume d’eau en remuant.'],
  [/^gnocchi/, 'Poêler {x} 6 min dans un peu d’huile, ou les cuire 2 min à l’eau.'],
  [/^(pommes-de-terre|patate-douce)/, 'Cuire {x} 20 min à l’eau, ou les rôtir en quartiers 30 min à 210 °C.'],
  [/^(pain|galettes|tortillas|challah)/, 'Griller {x} si tu le souhaites.'],
  [/^(flocons|muesli)/, 'Faire gonfler {x} dans le laitage (ou cuire 5 min dans le lait).'],
]

const RAW_VEG = /^(salade|concombre|tomates$|avocat|betterave|chou-rouge|fenouil|carottes)/

function stepsFor(items: PlateItem[], ingredients: ReadonlyMap<string, Ingredient>, moment: IdeaMoment): string[] {
  const steps: string[] = []
  const name = (i: PlateItem) => `${shortName(ingredients.get(i.id)!)} (${i.id === 'oeufs' ? `${Math.round(i.grams / 55)} œuf${i.grams > 55 ? 's' : ''}` : `${i.grams} g`})`
  for (const i of items) {
    if (i.pantry || i.role === 'garniture' || i.role === 'fruit' || i.role === 'laitage') continue
    if (i.role === 'legume') continue
    const hint = HINTS.find(([re]) => re.test(i.id))
    if (hint) steps.push(hint[1].replace('{x}', name(i)))
  }
  const veg = items.filter((i) => i.role === 'legume')
  const raw = veg.filter((v) => RAW_VEG.test(v.id))
  const cooked = veg.filter((v) => !RAW_VEG.test(v.id))
  if (cooked.length) steps.push(`Faire revenir ou rôtir ${cooked.map(name).join(' et ')} avec un filet d’huile, 8 à 10 min (vapeur possible).`)
  if (raw.length) steps.push(`Couper ${raw.map(name).join(' et ')} et les assaisonner (huile, citron ou vinaigre, sel, poivre).`)
  const others = items.filter((i) => (i.role === 'fruit' || i.role === 'laitage' || i.role === 'garniture') && !i.pantry)
  if (others.length) steps.push(`Ajouter ${others.map(name).join(', ')}.`)
  steps.push(
    moment === 'dejeuner' || moment === 'diner'
      ? 'Servir : environ 2/5 de l’assiette en légumes, 2/5 en féculents et 1/5 en protéines.'
      : 'Assembler et déguster.',
  )
  return steps
}

/** Compose une assiette avec les quantités ajustées aux besoins du repas. */
function composeOne(
  picks: { id: string; role: FridgeRole }[],
  ingredients: ReadonlyMap<string, Ingredient>,
  t: Targets,
  moment: IdeaMoment,
  oilId: string,
): { items: PlateItem[]; kcal: number; protein: number; fat: number; carbs: number } {
  const ing = (id: string) => ingredients.get(id)!
  const items: PlateItem[] = []
  const add = (id: string, grams: number, role: FridgeRole, pantry = false) => items.push({ id, grams: round(grams, id), role, pantry })
  const main = moment === 'dejeuner' || moment === 'diner'
  // 1. Légumes : environ 2/5 de l'assiette (250 g pour un repas de 650 kcal).
  const veg = picks.filter((p) => p.role === 'legume')
  const vegTotal = main ? Math.min(400, Math.max(150, 250 * (t.kcal / 650))) : 100
  veg.forEach((v, i) => add(v.id, veg.length === 1 ? vegTotal : vegTotal * (i === 0 ? 0.6 : 0.4), 'legume'))
  // 2. Fruit (petit-déjeuner, collation).
  for (const f of picks.filter((p) => p.role === 'fruit')) {
    const [lo, hi] = bounds(ing(f.id), 'fruit', moment)
    add(f.id, (lo + hi) / 2, 'fruit')
  }
  // 3. Huile (placard) pour cuisiner les plats principaux.
  if (main) add(oilId, t.kcal < 450 ? 5 : 10, 'placard', true)
  // 4. Garniture et laitage d'accompagnement : petites quantités.
  for (const g of picks.filter((p) => p.role === 'garniture' || (p.role === 'laitage' && picks.some((x) => x.role === 'proteine')))) {
    const [lo, hi] = bounds(ing(g.id), g.role, moment)
    add(g.id, main ? lo : (lo + hi) / 2, g.role)
  }
  const sum = (key: 'kcal' | 'protein' | 'fat' | 'carbs') => items.reduce((s, i) => s + per(ing(i.id), key, i.grams), 0)
  // 5. Protéine : de quoi atteindre l'objectif de protéines du repas (85 %, le reste vient des féculents).
  const prot = picks.find((p) => p.role === 'proteine') ?? (picks.some((p) => p.role === 'proteine') ? null : picks.find((p) => p.role === 'laitage' && !items.some((i) => i.id === p.id)))
  if (prot) {
    const i = ing(prot.id)
    const [lo, hi] = bounds(i, prot.role, moment)
    const need = Math.max(0, t.protein * 0.85 - sum('protein'))
    add(prot.id, Math.min(hi, Math.max(lo, (need / Math.max(1, i.per100g.protein)) * 100)), prot.role)
  }
  // 6. Féculent : complète les calories.
  const starch = picks.find((p) => p.role === 'feculent')
  if (starch) {
    const i = ing(starch.id)
    const [lo, hi] = bounds(i, 'feculent', moment)
    const missing = t.kcal - sum('kcal')
    add(starch.id, Math.min(hi, Math.max(lo, (missing / Math.max(1, i.per100g.kcal)) * 100)), 'feculent')
  }
  return { items, kcal: Math.round(sum('kcal')), protein: Math.round(sum('protein')), fat: Math.round(sum('fat')), carbs: Math.round(sum('carbs')) }
}

/**
 * Propose jusqu'à `count` assiettes différentes composées uniquement avec les aliments disponibles
 * (plus l'huile du placard), compatibles avec le profil, quantités calées sur les besoins du repas.
 */
export function composeMeals(
  have: readonly string[],
  ingredients: ReadonlyMap<string, Ingredient>,
  profile: FridgeProfile,
  dayKcal: number,
  dayProteinG: number,
  moment: IdeaMoment,
  seed: number,
  count = 3,
): ComposedMeal[] {
  const rng = createRng(seed)
  const share = momentShare(moment, profile.mealsPerDay)
  const t: Targets = { kcal: dayKcal * share, protein: moment === 'collation' ? 10 : dayProteinG * share }
  const main = moment === 'dejeuner' || moment === 'diner'
  const avail = have.map((id) => ingredients.get(id)).filter((i): i is Ingredient => Boolean(i))
  // Aliments autorisés par le profil, pris un par un.
  const ok = avail.filter((i) => isRecipeAllowed({ ingredients: [{ id: i.id, grams: 100 }] }, profile, ingredients))
  const by = (role: FridgeRole) => ok.filter((i) => roleOf(i) === role).map((i) => i.id)
  const proteins = by('proteine')
  const dairy = by('laitage')
  const starches = by('feculent').filter((id) => (main ? !/^(flocons|muesli|galettes-riz)/.test(id) : true))
  const vegs = by('legume')
  const fruits = by('fruit')
  const garnishes = by('garniture')
  const oilId = have.includes('huile-olive') ? 'huile-olive' : 'huile-colza'

  // Combinaisons candidates selon le moment.
  type Pick = { id: string; role: FridgeRole }
  const combos: Pick[][] = []
  const opt = <T,>(list: T[]) => (list.length ? list : [null])
  // Combinaisons « plat » : protéine + féculent + 1 ou 2 légumes (+ un peu de fromage, olives…).
  const plateCombos = () => {
    const protOptions: (string | null)[] = proteins.length ? proteins : dairy.filter((d) => ['feta', 'mozzarella', 'ricotta', 'fromage-raclette', 'gruyere'].includes(d)).slice(0, 2)
    for (const p of opt(protOptions)) for (const s of opt(starches)) {
      const v1 = vegs.length ? vegs : []
      // 1 ou 2 légumes, en variant la combinaison.
      const vegSets: string[][] = v1.length >= 2 ? v1.flatMap((a, i) => v1.slice(i + 1).map((b) => [a, b])).concat(v1.map((a) => [a])) : [v1]
      for (const vs of vegSets) {
        const picks: Pick[] = []
        if (p) picks.push({ id: p, role: proteins.includes(p) ? 'proteine' : 'laitage' })
        if (s) picks.push({ id: s, role: 'feculent' })
        vs.forEach((v) => picks.push({ id: v, role: 'legume' }))
        // Un peu de fromage ou d'olives/avocat pour la gourmandise, si c'est compatible.
        const extra = [...garnishes, ...dairy.filter((d) => d !== p && ['parmesan', 'feta', 'gruyere', 'mozzarella', 'fromage-raclette'].includes(d))]
        if (extra.length && rng() < 0.6) {
          const e = extra[Math.floor(rng() * extra.length)]
          picks.push({ id: e, role: garnishes.includes(e) ? 'garniture' : 'laitage' })
        }
        if (picks.length) combos.push(picks)
      }
    }
  }
  if (main) {
    plateCombos()
  } else {
    // Petit-déjeuner / collation : féculent (sauf collation) + laitage ou protéine + fruit, garniture.
    const prots = [...dairy.filter((d) => !['parmesan', 'gruyere', 'fromage-raclette', 'feta', 'mozzarella'].includes(d) || moment === 'collation'), ...proteins.filter((p) => ['oeufs', 'tofu-nature', 'sere-maigre', 'cottage-cheese', 'yaourt-grec', 'thon-conserve', 'sardines-huile', 'maquereau-conserve', 'edamame-surgeles'].includes(p))]
    const bfStarch = starches.filter((s) => /^(flocons|muesli|galettes|pain|tortillas|challah|millet|sarrasin)/.test(s))
    for (const p of opt(prots)) for (const s of moment === 'collation' ? [null] : opt(bfStarch)) for (const f of opt([...fruits, ...vegs.filter((v) => /^(tomates|concombre|avocat|carottes)/.test(v))])) {
      const picks: Pick[] = []
      if (p) picks.push({ id: p, role: proteins.includes(p) ? 'proteine' : 'laitage' })
      if (s) picks.push({ id: s, role: 'feculent' })
      if (f) picks.push({ id: f, role: fruits.includes(f) ? 'fruit' : 'legume' })
      if (garnishes.length && rng() < 0.5) picks.push({ id: garnishes[Math.floor(rng() * garnishes.length)], role: 'garniture' })
      if (picks.length >= (moment === 'collation' ? 1 : 2)) combos.push(picks)
    }
    // Rien de typique pour ce moment (ex. saumon et brocoli pour une collation) : petite assiette salée.
    if (combos.length === 0) plateCombos()
  }

  // Évaluation : précision (kcal, protéines), assiette complète, respect du profil (casher : jamais viande + lait).
  const scored = combos
    .map((picks) => {
      const plate = composeOne(picks, ingredients, t, moment, oilId)
      const recipe = { ingredients: plate.items.map((i) => ({ id: i.id, grams: i.grams })) }
      if (!isRecipeAllowed(recipe, profile, ingredients)) return null
      const roles = new Set(picks.map((p) => p.role))
      let score = Math.abs(plate.kcal - t.kcal) / t.kcal + Math.max(0, t.protein - plate.protein) / Math.max(1, t.protein)
      if (main && !roles.has('proteine') && !roles.has('laitage')) score += 1
      if (main && !roles.has('legume')) score += 0.6
      if (main && !roles.has('feculent')) score += 0.4
      score += rng() * 0.25 // variété : « Autre combinaison » propose autre chose
      return { picks, plate, score, recipe }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.score - b.score)

  // Garder des assiettes vraiment différentes (protéine ou féculent différents).
  const out: ComposedMeal[] = []
  const core = (x: (typeof scored)[number]) => x.picks.filter((p) => p.role === 'proteine' || p.role === 'feculent').map((p) => p.id).sort().join('+')
  const full = (x: (typeof scored)[number]) => x.picks.map((p) => p.id).sort().join('+')
  // D'abord des assiettes avec une protéine ou un féculent différents, puis des variantes (autres légumes).
  const chosen: typeof scored = []
  const cores = new Set<string>()
  for (const x of scored) {
    if (cores.has(core(x)) || chosen.length >= count) continue
    cores.add(core(x))
    chosen.push(x)
  }
  for (const x of scored) if (chosen.length < count && !chosen.some((c) => full(c) === full(x))) chosen.push(x)
  for (const s of chosen) {
    const ORDER: FridgeRole[] = ['proteine', 'laitage', 'feculent', 'legume', 'fruit']
    const names = s.plate.items
      .filter((i) => !i.pantry && ORDER.includes(i.role) && !(i.role === 'laitage' && s.picks.some((p) => p.role === 'proteine') && (moment === 'dejeuner' || moment === 'diner')))
      .sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role))
      .map((i) => shortName(ingredients.get(i.id)!))
    const title = names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}` : names[0] ?? 'Assiette'
    const roles = new Set(s.picks.map((p) => p.role))
    const tips: string[] = []
    if (main && !roles.has('proteine') && !roles.has('laitage')) tips.push('Pas de source de protéines : ajoute des œufs, du tofu, des légumineuses, du poisson ou de la viande pour un repas complet.')
    if (main && !roles.has('legume')) tips.push('Pas de légume : ajoute-en un (même surgelé) pour le volume et les fibres.')
    if (main && !roles.has('feculent')) tips.push('Pas de féculent : ajoute du pain, des pâtes, du riz ou des pommes de terre pour l’énergie.')
    if (s.plate.kcal < t.kcal * 0.8) tips.push(`Ce repas apporte ${s.plate.kcal} kcal pour environ ${Math.round(t.kcal)} visées : complète avec un fruit, un laitage ou du pain.`)
    out.push({
      title: title.charAt(0).toUpperCase() + title.slice(1),
      items: s.plate.items,
      kcal: s.plate.kcal,
      protein: s.plate.protein,
      fat: s.plate.fat,
      carbs: s.plate.carbs,
      kashrut: computeKashrut(s.recipe, ingredients),
      steps: stepsFor(s.plate.items, ingredients, moment),
      tips,
    })
  }
  return out
}

// ─────────────────────────── Recettes faisables ───────────────────────────

export interface FeasibleRecipe {
  recipe: Recipe
  /** Ingrédients de la recette qui manquent (hors placard de base). */
  missing: string[]
  /** Ingrédients de la recette que l'on a. */
  uses: string[]
}

/** On ne compte pas comme « manquants » les ingrédients du placard de base. */
const isBasic = (ing: Ingredient) => ing.aisle === 'condiments' || ['ail', 'citron', 'gingembre'].includes(ing.id)

/**
 * Recettes du catalogue réalisables avec ce qu'on a (au plus `maxMissing` ingrédients à acheter),
 * compatibles avec le profil, triées par nombre d'ingrédients manquants.
 */
export function feasibleRecipes(
  recipes: Recipe[],
  have: readonly string[],
  ingredients: ReadonlyMap<string, Ingredient>,
  profile: DietProfile,
  moment: IdeaMoment,
  maxMissing = 2,
): FeasibleRecipe[] {
  const set = new Set(have)
  const type = moment === 'dejeuner' || moment === 'diner' ? ['dejeuner', 'diner'] : [moment]
  return recipes
    .filter((r) => !r.mealTypes.includes('base') && r.mealTypes.some((m) => type.includes(m)) && isRecipeAllowed(r, profile, ingredients))
    .map((r) => {
      const essential = r.ingredients.map((i) => i.id).filter((id) => !isBasic(ingredients.get(id)!))
      return { recipe: r, missing: essential.filter((id) => !set.has(id)), uses: essential.filter((id) => set.has(id)), total: essential.length }
    })
    // Au moins la moitié des ingrédients sous la main, et au moins un ingrédient « principal » (pas que l'oignon).
    .filter((x) => x.missing.length <= maxMissing && x.uses.length >= Math.max(1, Math.ceil(x.total / 2)) && x.uses.some((id) => id !== 'oignons'))
    .sort((a, b) => a.missing.length - b.missing.length || b.uses.length - a.uses.length || a.recipe.name.localeCompare(b.recipe.name))
    .map(({ recipe, missing, uses }) => ({ recipe, missing, uses }))
}
