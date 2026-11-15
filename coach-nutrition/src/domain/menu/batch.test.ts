import { describe, expect, it } from 'vitest'
import { INGREDIENT_MAP, RECIPES } from '../catalog'
import { computeTargets } from '../nutrition'
import { mealKashrut, isRecipeAllowed } from '../restrictions'
import { DEFAULT_SETTINGS } from '../../storage/migrations'
import type { DayOfWeek, ProfileSettings } from '../types'
import { buildSessionPlans, buildTimeline, cookMethod, sessionItems } from '../batch-plan'
import { canServe, daysBetween, makeBowl, scheduleSessions, sessionForDay, storageFor } from './batch'
import { daySummary, generateWeek, KCAL_TOLERANCE, planLookup, type GeneratorContext } from './generator'

const R = (id: string) => RECIPES.find((r) => r.id === id)!

function ctx(s: Partial<ProfileSettings>, sessionDays: DayOfWeek[], seed = 1): GeneratorContext {
  const settings = { ...DEFAULT_SETTINGS, sex: 'homme', age: 34, heightCm: 180, targetWeightKg: 75, activityLevel: 3, mealsPerDay: 3, ...s, batch: { enabled: true, sessionDays } } as ProfileSettings
  const t = computeTargets(settings, 80)
  return { settings, targets: { kcal: t.targetKcal, proteinG: t.macros.proteinG, fatG: t.macros.fatG, carbsG: t.macros.carbsG }, recipes: RECIPES, ingredients: INGREDIENT_MAP, weekStart: '2026-11-16', seed, now: new Date('2026-11-15T10:00:00Z') }
}

describe('Sessions de batch cooking', () => {
  it('une session le dimanche (veille de la semaine) couvre les 7 jours', () => {
    expect(scheduleSessions('2026-11-16', [6])).toEqual([{ cookDate: '2026-11-15', days: [0, 1, 2, 3, 4, 5, 6] }])
  })
  it('dimanche + mercredi : lundi → mercredi, puis jeudi → dimanche (2 sessions, pas 3)', () => {
    const s = scheduleSessions('2026-11-16', [6, 2])
    expect(s).toEqual([
      { cookDate: '2026-11-15', days: [0, 1, 2] },
      { cookDate: '2026-11-18', days: [3, 4, 5, 6] },
    ])
  })
  it('trois sessions couvrent chaque jour une seule fois, toujours après la cuisine', () => {
    const s = scheduleSessions('2026-11-16', [0, 2, 4])
    expect(s.flatMap((x) => x.days).sort()).toEqual([0, 1, 2, 3, 4, 5, 6])
    for (const x of s) for (const d of x.days) expect(daysBetween(x.cookDate, `2026-11-${16 + d}`)).toBeGreaterThanOrEqual(1)
  })
  it('compte les jours entre deux dates', () => {
    expect(daysBetween('2026-11-15', '2026-11-20')).toBe(5)
  })
})

describe('Conservation', () => {
  it('frigo si la durée le permet, sinon congélation, sinon impossible', () => {
    expect(storageFor({ fridgeDays: 3, freezerMonths: 3 }, 2)).toBe('frigo')
    expect(storageFor({ fridgeDays: 3, freezerMonths: 3 }, 5)).toBe('congelateur')
    expect(storageFor({ fridgeDays: 3, freezerMonths: 0 }, 5)).toBe('impossible')
  })
  it('un bowl n’est servi que si chacune de ses bases se conserve', () => {
    const bowl = makeBowl([R('base-riz-complet'), R('base-poulet-epices'), R('base-legumes-rotis-hiver'), R('base-sauce-yaourt-herbes')], INGREDIENT_MAP)
    const byId = new Map(RECIPES.map((r) => [r.id, r]))
    expect(canServe(bowl, 4, byId)).toBe(true) // sauce yaourt : 4 jours au frigo
    expect(canServe(bowl, 5, byId)).toBe(false) // la sauce yaourt ne se congèle pas
  })
})

describe('Bowls', () => {
  it('additionne une portion de chaque base et calcule le classement casher', () => {
    const bases = [R('base-quinoa'), R('base-lentilles'), R('base-legumes-rotis-hiver'), R('base-sauce-tahini')]
    const bowl = makeBowl(bases, INGREDIENT_MAP)
    // 0,8 céréale + 1,5 protéine + 1 légumes + 1 sauce
    const expected = bases[0].perServing.kcal * 0.8 + bases[1].perServing.kcal * 1.5 + bases[2].perServing.kcal + bases[3].perServing.kcal
    expect(bowl.perServing.kcal).toBe(Math.round(expected))
    expect(bowl.kashrut).toBe('parve')
    expect(bowl.components!.map((c) => c.id)).toEqual(bases.map((b) => b.id))
    const meatMilk = makeBowl([R('base-riz-complet'), R('base-poulet-epices'), R('base-legumes-rotis-hiver'), R('base-sauce-yaourt-herbes')], INGREDIENT_MAP)
    expect(meatMilk.kashrut).toBe('non-casher')
  })
})

const SCENARIOS: [string, Partial<ProfileSettings>, DayOfWeek[]][] = [
  ['1 session le dimanche', {}, [6]],
  ['2 sessions dimanche + mercredi, 4 repas', { mealsPerDay: 4 }, [6, 2]],
  ['3 sessions, casher', { restrictions: ['casher'], mealsPerDay: 4 }, [0, 2, 4]],
  ['1 session, halal sans gluten', { restrictions: ['halal', 'sans-gluten'] }, [5]],
  ['2 sessions, végétarien petit budget', { restrictions: ['vegetarien'], lowBudget: true, mealsPerDay: 4 }, [6, 3]],
]

describe('Menu en mode batch cooking', () => {
  for (const [name, s, days] of SCENARIOS) {
    for (const seed of [1, 9]) {
      const c = ctx(s, days, seed)
      const plan = generateWeek(c)
      const byId = planLookup(plan, RECIPES)

      it(`${name} (graine ${seed}) : 4 bases par session et bowls au menu`, () => {
        expect(plan.batch?.sessions.length).toBe(scheduleSessions('2026-11-16', days).length)
        for (const ses of plan.batch!.sessions) {
          expect(ses.baseIds).toHaveLength(4)
          const roles = ses.baseIds.map((id) => byId.get(id)!.batchRole).sort()
          expect(roles).toEqual(['cereale', 'legumes', 'proteine', 'sauce'])
          for (const id of ses.baseIds) expect(isRecipeAllowed(byId.get(id)!, c.settings, INGREDIENT_MAP)).toBe(true)
        }
        const bowlMeals = plan.days.flatMap((d) => d.meals).filter((m) => byId.get(m.recipeId)!.components)
        expect(bowlMeals.length).toBeGreaterThanOrEqual(2)
      })

      it(`${name} (graine ${seed}) : aucun plat n’est prévu au-delà de sa conservation`, () => {
        const plans = buildSessionPlans(plan, byId)
        for (const sp of plans) {
          for (const st of sp.storage) {
            for (const part of st.parts) expect(part.where, `${st.date} ${st.recipeName} / ${part.name}`).not.toBe('impossible')
            if (st.parts.some((p) => p.where === 'congelateur')) expect(st.thawOn).toBeDefined()
          }
        }
        // Vérification indépendante : chaque repas cuisiné en session tient jusqu'au jour prévu.
        plan.days.forEach((d, i) => {
          const info = sessionForDay(plan.batch!.sessions, plan.weekStart, i)!
          for (const m of d.meals) {
            const r = byId.get(m.recipeId)!
            if (r.components) expect(info.session.bowlId).toBe(r.id)
            if (r.components || ((m.slot === 'dejeuner' || m.slot === 'diner') && r.tags.includes('batch-friendly'))) {
              expect(canServe(r, info.offset, byId), `${d.date} ${r.id} (J+${info.offset})`).toBe(true)
            }
          }
        })
      })

      it(`${name} (graine ${seed}) : calories à ±5 % et restrictions respectées`, () => {
        for (const d of plan.days) {
          expect(Math.abs(daySummary(d, byId, plan.lowBudget).kcal / c.targets.kcal - 1)).toBeLessThanOrEqual(KCAL_TOLERANCE)
          for (const m of d.meals) {
            const r = byId.get(m.recipeId)!
            expect(isRecipeAllowed(r, c.settings, INGREDIENT_MAP), r.id).toBe(true)
            if (c.settings.restrictions.includes('casher')) expect(mealKashrut([r], INGREDIENT_MAP)).not.toBe('non-casher')
          }
        }
      })
    }
  }
})

describe('Plan minuté', () => {
  const c = ctx({}, [6])
  const plan = generateWeek(c)
  const byId = planLookup(plan, RECIPES)
  const [session] = buildSessionPlans(plan, byId)

  it('cuisine les bonnes quantités (somme des portions du menu)', () => {
    const items = sessionItems(plan, plan.batch!.sessions[0], byId)
    const bowlPortions = plan.batch!.sessions[0].days
      .flatMap((d) => plan.days[d].meals)
      .filter((m) => m.recipeId === plan.batch!.sessions[0].bowlId)
      .reduce((s, m) => s + m.portions, 0)
    const cereal = items.find((i) => i.recipe.batchRole === 'cereale')!
    expect(cereal.portions).toBeCloseTo(bowlPortions * 0.8, 1)
  })

  it('le four démarre en premier, la cuisson la plus longue en tête, et les tâches se chevauchent', () => {
    const steps = session.timeline
    const firstPrep = steps.find((s) => s.kind === 'preparation')!
    const ovenItems = session.items.filter((i) => i.method === 'four')
    if (ovenItems.length) {
      expect(steps[0].kind).toBe('prechauffage')
      const longest = [...ovenItems].sort((a, b) => b.recipe.cookMin - a.recipe.cookMin)[0]
      expect(firstPrep.label).toContain(longest.recipe.name.replace(/^Base\s*:\s*/i, ''))
    }
    // Durée totale inférieure à la somme des durées (preuve du parallélisme).
    const sequential = steps.filter((s) => s.kind !== 'prechauffage').reduce((sum, s) => sum + (s.end - s.start), 0)
    expect(session.totalMin).toBeLessThan(sequential)
    // Une seule personne : les tâches actives (préparer, ranger) ne se chevauchent jamais.
    const active = steps.filter((s) => s.kind === 'preparation' || s.kind === 'rangement').sort((a, b) => a.start - b.start)
    for (let i = 1; i < active.length; i++) expect(active[i].start).toBeGreaterThanOrEqual(active[i - 1].end)
  })

  it('jamais plus de 2 plats au four en même temps', () => {
    const oven = session.timeline.filter((s) => s.kind === 'cuisson' && s.label.startsWith('Four'))
    // Nombre de plats au four à chaque début de cuisson (maximum de concurrence).
    for (const s of oven) {
      const inOven = oven.filter((o) => o.start <= s.start && o.end > s.start)
      expect(inOven.length).toBeLessThanOrEqual(2)
    }
  })

  it('liste le matériel', () => {
    expect(session.equipment.join(' ')).toMatch(/boîtes hermétiques/)
  })

  it('reconnaît le mode de cuisson', () => {
    expect(cookMethod(R('base-legumes-rotis-hiver'))).toBe('four')
    expect(cookMethod(R('base-riz-complet'))).toBe('plaque')
    expect(cookMethod(R('base-sauce-tahini'))).toBe('aucun')
  })

  it('ordonnancement sur un cas simple', () => {
    const items = [
      { recipe: R('base-legumes-rotis-hiver'), portions: 6, scale: 1, method: 'four' as const },
      { recipe: R('base-riz-complet'), portions: 6, scale: 1, method: 'plaque' as const },
    ]
    const { steps, totalMin } = buildTimeline(items)
    const ovenCook = steps.find((s) => s.kind === 'cuisson' && s.label.startsWith('Four'))!
    const ricePrep = steps.find((s) => s.kind === 'preparation' && s.label.includes('riz'))!
    expect(ricePrep.start).toBeLessThan(ovenCook.end) // le riz se prépare pendant que les légumes rôtissent
    expect(totalMin).toBeLessThan(15 + 35 + 2 + 30 + 10)
  })
})
