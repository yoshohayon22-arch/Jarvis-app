import { describe, expect, it } from 'vitest'
import { INGREDIENTS, INGREDIENT_MAP, RECIPES } from './catalog'
import { composeMeals, feasibleRecipes, matchIngredient, parseFridgeText, roleOf } from './fridge-meal'
import { momentShare } from './meal-ideas'
import { isRecipeAllowed } from './restrictions'
import type { Restriction } from './types'

const profile = (restrictions: Restriction[] = [], dislikedFoods: string[] = []) => ({
  restrictions,
  kosher: { waitAfterMeatHours: 6 as const, separateFishAndMeat: true },
  dislikedFoods,
  mealsPerDay: 3 as const,
})
const ids = (text: string) => parseFridgeText(text, INGREDIENTS).found

describe('Lire ce que j’ai chez moi', () => {
  it('reconnaît les mots courants, les pluriels et les quantités', () => {
    expect(ids('poulet, riz, 2 courgettes, une boîte de thon, 500 g de pâtes')).toEqual(['poulet-emince', 'riz-long', 'courgette', 'thon-conserve', 'pates'])
    expect(ids('œufs et yaourt grec')).toEqual(['oeufs', 'yaourt-grec'])
  })
  it('ne confond pas les expressions : pommes de terre, lait de coco, patate douce', () => {
    expect(matchIngredient('pommes de terre', INGREDIENTS)?.id).toBe('pommes-de-terre')
    expect(matchIngredient('des pommes', INGREDIENTS)?.id).toBe('pommes')
    expect(matchIngredient('lait de coco', INGREDIENTS)?.id).toBe('lait-coco')
    expect(matchIngredient('lait', INGREDIENTS)?.id).toBe('lait')
    expect(matchIngredient('patates douces', INGREDIENTS)?.id).toBe('patate-douce')
  })
  it('signale ce qu’elle ne connaît pas', () => {
    expect(parseFridgeText('riz, truc bizarre', INGREDIENTS)).toEqual({ found: ['riz-long'], unknown: ['truc bizarre'] })
  })
  it('classe les aliments (protéine, féculent, légume, fruit, placard)', () => {
    const role = (id: string) => roleOf(INGREDIENT_MAP.get(id)!)
    expect(role('poulet-emince')).toBe('proteine')
    expect(role('lentilles-corail')).toBe('proteine')
    expect(role('riz-long')).toBe('feculent')
    expect(role('pommes-de-terre')).toBe('feculent')
    expect(role('courgette')).toBe('legume')
    expect(role('pommes')).toBe('fruit')
    expect(role('huile-olive')).toBe('placard')
  })
})

describe('Créer un repas avec mes produits', () => {
  it('compose une assiette avec mes produits seulement (plus l’huile du placard), calée sur les calories du repas', () => {
    const have = ids('poulet, riz, courgettes, tomates')
    const meals = composeMeals(have, INGREDIENT_MAP, profile(), 2000, 130, 'diner', 1)
    expect(meals.length).toBeGreaterThanOrEqual(2)
    const target = 2000 * momentShare('diner', 3)
    for (const m of meals) {
      for (const i of m.items) expect(have.includes(i.id) || i.pantry, i.id).toBe(true)
      expect(Math.abs(m.kcal - target) / target).toBeLessThan(0.15)
      expect(m.protein).toBeGreaterThanOrEqual(30)
      expect(m.steps.length).toBeGreaterThanOrEqual(3)
    }
    expect(meals[0].title).toMatch(/^Poulet/)
  })

  it('casher : jamais de viande avec du fromage ou du yaourt, même s’ils sont au frigo', () => {
    const have = ids('poulet, riz, courgettes, gruyère, yaourt, parmesan, feta')
    for (let seed = 1; seed <= 20; seed++) {
      for (const m of composeMeals(have, INGREDIENT_MAP, profile(['casher']), 2000, 130, 'diner', seed)) {
        expect(m.kashrut, m.title).not.toBe('non-casher')
      }
    }
  })

  it('respecte végétarien, halal, sans gluten et les aliments détestés', () => {
    const have = ids('poulet, jambon, tofu, pâtes, riz, courgettes, champignons, vin blanc')
    const p = profile(['vegetarien', 'sans-gluten'], ['champignons'])
    for (let seed = 1; seed <= 10; seed++) {
      for (const m of composeMeals(have, INGREDIENT_MAP, p, 2000, 120, 'dejeuner', seed)) {
        expect(isRecipeAllowed({ ingredients: m.items.map((i) => ({ id: i.id, grams: i.grams })) }, p, INGREDIENT_MAP), m.title).toBe(true)
        expect(m.items.some((i) => i.id === 'champignons-paris')).toBe(false)
      }
    }
  })

  it('petit-déjeuner et collation : des assiettes adaptées (laitage, fruit, céréales)', () => {
    const bf = composeMeals(ids('flocons d’avoine, yaourt grec, bananes, noix'), INGREDIENT_MAP, profile(), 2000, 120, 'petit-dej', 1)
    expect(bf[0].items.map((i) => i.id)).toEqual(expect.arrayContaining(['yaourt-grec', 'flocons-avoine']))
    const snack = composeMeals(ids('pommes, yaourt'), INGREDIENT_MAP, profile(), 2000, 120, 'collation', 1)
    expect(snack[0].kcal).toBeLessThan(350)
  })

  it('collation ou petit-déjeuner sans produit typique : petite assiette salée avec ce qu’il y a', () => {
    for (const moment of ['collation', 'petit-dej'] as const) {
      const [m] = composeMeals(ids('saumon, pommes de terre, brocoli'), INGREDIENT_MAP, profile(), 2000, 120, moment, 1)
      expect(m, moment).toBeDefined()
      expect(m.items.some((i) => i.id === 'saumon-filet')).toBe(true)
      expect(m.kcal).toBeLessThan(2000 * momentShare(moment, 3) * 1.6)
    }
  })

  it('dit ce qui manque pour un repas complet (pas de protéine, pas de féculent)', () => {
    const [m] = composeMeals(ids('riz, courgettes'), INGREDIENT_MAP, profile(), 2000, 120, 'diner', 1)
    expect(m.tips.join(' ')).toMatch(/protéines/)
    const [n] = composeMeals(ids('poulet, salade'), INGREDIENT_MAP, profile(), 2000, 120, 'diner', 1)
    expect(n.tips.join(' ')).toMatch(/féculent/)
  })

  it('« Autre combinaison » propose autre chose', () => {
    const have = ids('poulet, oeufs, thon, riz, pâtes, pommes de terre, courgettes, brocoli, carottes')
    const a = composeMeals(have, INGREDIENT_MAP, profile(), 2000, 130, 'diner', 1).map((m) => m.title)
    const b = composeMeals(have, INGREDIENT_MAP, profile(), 2000, 130, 'diner', 2).map((m) => m.title)
    expect(a).toHaveLength(3)
    expect(a).not.toEqual(b)
  })
})

describe('Recettes faisables avec ce que j’ai', () => {
  it('liste les recettes avec au plus 2 ingrédients à acheter, en commençant par celles où il ne manque rien', () => {
    const list = feasibleRecipes(RECIPES, ids('pain, oeufs, tomates, avocat'), INGREDIENT_MAP, profile(), 'petit-dej')
    expect(list.length).toBeGreaterThan(0)
    expect(list[0].missing).toEqual([])
    for (let i = 1; i < list.length; i++) expect(list[i].missing.length).toBeGreaterThanOrEqual(list[i - 1].missing.length)
    for (const x of list) expect(x.missing.length).toBeLessThanOrEqual(2)
  })
  it('ignore le placard de base (huile, épices, ail) et respecte le profil', () => {
    const list = feasibleRecipes(RECIPES, ids('saumon, brocoli, pommes de terre'), INGREDIENT_MAP, profile(['casher']), 'diner')
    const s = list.find((x) => x.recipe.id === 'saumon-pdt-brocoli')
    expect(s?.missing).toEqual([])
    for (const x of list) expect(isRecipeAllowed(x.recipe, profile(['casher']), INGREDIENT_MAP)).toBe(true)
  })
})
