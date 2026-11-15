import { describe, expect, it } from 'vitest'
import { INGREDIENT_MAP, RECIPES, type Ingredient, type Recipe } from './catalog'
import {
  canFollow,
  computeKashrut,
  exclusionReasons,
  isRecipeAllowed,
  matchesDisliked,
  mealKashrut,
  recipeTags,
  shoppingReminders,
  type DietProfile,
} from './restrictions'
import type { Restriction } from './types'

const profile = (restrictions: Restriction[], extra: Partial<DietProfile> = {}): DietProfile => ({
  restrictions,
  kosher: { waitAfterMeatHours: 6, separateFishAndMeat: true },
  dislikedFoods: [],
  ...extra,
})

const allowed = (p: DietProfile) => RECIPES.filter((r) => isRecipeAllowed(r, p, INGREDIENT_MAP))
const tagsOf = (r: Recipe) => recipeTags(r, INGREDIENT_MAP)

/** Petit catalogue de test pour les cas absents des vraies recettes (gélatine, saindoux…). */
const fake = new Map<string, Ingredient>([
  ['gelatine', { id: 'gelatine', name: 'Gélatine (porc)', aisle: 'epicerie', unit: 'g', per100g: { kcal: 0, protein: 0, fat: 0, carbs: 0 }, tags: ['gelatine-porcine'], packages: [10] }],
  ['saindoux', { id: 'saindoux', name: 'Saindoux', aisle: 'epicerie', unit: 'g', per100g: { kcal: 0, protein: 0, fat: 0, carbs: 0 }, tags: ['saindoux'], packages: [250] }],
  ['silure', { id: 'silure', name: 'Silure', aisle: 'poissonnerie', unit: 'g', per100g: { kcal: 0, protein: 0, fat: 0, carbs: 0 }, tags: ['poisson-sans-ecailles'], packages: [200] }],
  ['boeuf', INGREDIENT_MAP.get('boeuf-hache')!],
  ['saumon', INGREDIENT_MAP.get('saumon-filet')!],
  ['fromage', INGREDIENT_MAP.get('gruyere')!],
])
const dish = (...ids: string[]) => ({ ingredients: ids.map((id) => ({ id, grams: 100 })) })

describe('Casher', () => {
  const kosher = allowed(profile(['casher']))

  it('aucune recette casher ne contient de porc, lapin, fruits de mer ou poisson sans écailles', () => {
    for (const r of kosher) {
      const t = tagsOf(r)
      for (const bad of ['porc', 'lapin', 'fruits-de-mer', 'poisson-sans-ecailles', 'gelatine-porcine', 'saindoux'] as const) {
        expect(t.has(bad), `${r.id} contient ${bad}`).toBe(false)
      }
    }
  })

  it('aucune recette casher ne mélange viande et lait', () => {
    for (const r of kosher) {
      const t = tagsOf(r)
      const meat = t.has('viande') || t.has('volaille')
      expect(meat && t.has('lait'), `${r.id} mélange viande et lait`).toBe(false)
    }
  })

  it('chaque recette porte le bon classement bassari / halavi / parvé', () => {
    for (const r of RECIPES) {
      expect(r.kashrut, r.id).toBe(computeKashrut(r, INGREDIENT_MAP))
      expect(['bassari', 'halavi', 'parve', 'non-casher']).toContain(r.kashrut)
    }
  })

  it('exclut les plats non casher connus', () => {
    const ids = new Set(kosher.map((r) => r.id))
    for (const id of ['emince-porc-champignons', 'cervelas-salade-pdt', 'lapin-moutarde-polenta', 'crevettes-wok-riz', 'pates-pesto-poulet', 'pates-jambon-petits-pois']) {
      expect(ids.has(id), id).toBe(false)
    }
  })

  it('classe correctement des cas limites', () => {
    expect(computeKashrut(dish('saumon', 'fromage'), fake)).toBe('halavi') // poisson + lait : autorisé
    expect(computeKashrut(dish('boeuf', 'fromage'), fake)).toBe('non-casher')
    expect(computeKashrut(dish('silure'), fake)).toBe('non-casher')
    expect(computeKashrut(dish('gelatine'), fake)).toBe('non-casher')
  })

  it('option : pas de poisson et de viande dans le même plat', () => {
    const r = dish('boeuf', 'saumon')
    expect(computeKashrut(r, fake)).toBe('bassari')
    const strict = profile(['casher'], { kosher: { waitAfterMeatHours: 6, separateFishAndMeat: true } })
    const relaxed = profile(['casher'], { kosher: { waitAfterMeatHours: 6, separateFishAndMeat: false } })
    expect(isRecipeAllowed(r, strict, fake)).toBe(false)
    expect(isRecipeAllowed(r, relaxed, fake)).toBe(true)
  })

  it('un repas casher ne combine jamais viande et lait : toute paire bassari + halavi est rejetée', () => {
    const bassari = kosher.filter((r) => r.kashrut === 'bassari')
    const halavi = kosher.filter((r) => r.kashrut === 'halavi')
    expect(bassari.length).toBeGreaterThan(5)
    expect(halavi.length).toBeGreaterThan(5)
    for (const b of bassari) {
      for (const h of halavi) {
        expect(mealKashrut([b, h], INGREDIENT_MAP), `${b.id} + ${h.id}`).toBe('non-casher')
      }
    }
    // Parvé se combine avec tout.
    const parve = kosher.find((r) => r.kashrut === 'parve')!
    expect(mealKashrut([bassari[0], parve], INGREDIENT_MAP)).toBe('bassari')
    expect(mealKashrut([halavi[0], parve], INGREDIENT_MAP)).toBe('halavi')
  })

  it('délai après un repas bassari avant du halavi', () => {
    expect(canFollow('bassari', 'halavi', 3.5, 6)).toBe(false) // déjeuner 12h30 → collation 16h
    expect(canFollow('bassari', 'halavi', 7, 6)).toBe(true) // déjeuner 12h30 → dîner 19h30
    expect(canFollow('bassari', 'halavi', 1, 0)).toBe(true) // sans délai choisi
    expect(canFollow('halavi', 'bassari', 0.5, 6)).toBe(true) // lait puis viande : pas de délai long
    expect(canFollow('bassari', 'parve', 0, 6)).toBe(true)
  })

  it('il reste assez de recettes casher pour composer une semaine variée', () => {
    for (const meal of ['petit-dej', 'dejeuner', 'diner', 'collation'] as const) {
      expect(kosher.filter((r) => r.mealTypes.includes(meal)).length, meal).toBeGreaterThanOrEqual(10)
    }
  })
})

describe('Halal', () => {
  const halal = allowed(profile(['halal']))

  it('aucune recette halal ne contient de porc, gélatine porcine, saindoux ou alcool', () => {
    for (const r of halal) {
      const t = tagsOf(r)
      for (const bad of ['porc', 'gelatine-porcine', 'saindoux', 'alcool'] as const) {
        expect(t.has(bad), `${r.id} contient ${bad}`).toBe(false)
      }
    }
  })

  it('exclut les plats cuisinés au vin, même si l’alcool s’évapore', () => {
    const ids = new Set(halal.map((r) => r.id))
    expect(ids.has('risotto-champignons')).toBe(false)
    expect(ids.has('lapin-moutarde-polenta')).toBe(false)
    expect(ids.has('cervelas-salade-pdt')).toBe(false)
  })

  it('refuse gélatine porcine et saindoux', () => {
    const p = profile(['halal'])
    expect(isRecipeAllowed(dish('gelatine'), p, fake)).toBe(false)
    expect(isRecipeAllowed(dish('saindoux'), p, fake)).toBe(false)
    expect(isRecipeAllowed(dish('saumon'), p, fake)).toBe(true)
  })

  it('il reste assez de recettes halal pour une semaine variée', () => {
    for (const meal of ['petit-dej', 'dejeuner', 'diner', 'collation'] as const) {
      expect(halal.filter((r) => r.mealTypes.includes(meal)).length, meal).toBeGreaterThanOrEqual(10)
    }
  })
})

describe('Casher + halal en même temps', () => {
  it('respecte les deux ensembles de règles', () => {
    for (const r of allowed(profile(['casher', 'halal']))) {
      const t = tagsOf(r)
      expect(t.has('alcool') || t.has('porc') || t.has('lapin') || t.has('fruits-de-mer')).toBe(false)
      expect(r.kashrut).not.toBe('non-casher')
    }
  })
})

describe('Autres restrictions', () => {
  const check = (r: Restriction, forbidden: string[]) => {
    for (const x of allowed(profile([r]))) {
      const t = tagsOf(x)
      for (const f of forbidden) expect(t.has(f as never), `${x.id} (${r}) contient ${f}`).toBe(false)
    }
  }
  it('végétarien : ni viande ni poisson', () => check('vegetarien', ['viande', 'volaille', 'porc', 'lapin', 'poisson', 'fruits-de-mer']))
  it('sans gluten', () => check('sans-gluten', ['gluten']))
  it('sans lactose (le gruyère affiné reste permis)', () => {
    check('sans-lactose', ['lactose'])
    expect(INGREDIENT_MAP.get('gruyere')!.tags).not.toContain('lactose')
  })
  it('sans arachides', () => check('sans-arachides', ['arachide']))
})

describe('Aliments détestés', () => {
  const ing = (id: string) => INGREDIENT_MAP.get(id)!
  it('reconnaît pluriel, majuscules et accents', () => {
    expect(matchesDisliked(ing('champignons-paris'), 'Champignon')).toBe(true)
    expect(matchesDisliked(ing('epinards-surgeles'), 'épinards')).toBe(true)
    expect(matchesDisliked(ing('oeufs'), 'œufs')).toBe(true)
    expect(matchesDisliked(ing('carottes'), 'coriandre')).toBe(false)
  })
  it('comprend les familles d’aliments', () => {
    expect(matchesDisliked(ing('saumon-filet'), 'poisson')).toBe(true)
    expect(matchesDisliked(ing('thon-conserve'), 'Poissons')).toBe(true)
    expect(matchesDisliked(ing('crevettes'), 'fruits de mer')).toBe(true)
    expect(matchesDisliked(ing('poulet-emince'), 'viande')).toBe(true)
  })
  it('exclut les recettes concernées et explique pourquoi', () => {
    const p = profile([], { dislikedFoods: ['champignons'] })
    const risotto = RECIPES.find((r) => r.id === 'risotto-champignons')!
    expect(exclusionReasons(risotto, p, INGREDIENT_MAP)).toEqual(['n’aime pas : champignons'])
  })
})

describe('Rappels liste de courses', () => {
  it('rappelle la certification casher et halal', () => {
    expect(shoppingReminders(['casher'])[0]).toMatch(/certification casher/)
    expect(shoppingReminders(['halal'])[0]).toMatch(/halal certifiées/)
    expect(shoppingReminders(['vegetarien'])).toEqual([])
  })
})
