/**
 * Calculateur de repas « fait maison » : on choisit le moment du repas, on ajoute des ingrédients
 * en grammes, et on voit les calories, les macros, le prix et la compatibilité avec son profil,
 * comparés aux besoins de ce repas. Mia donne un conseil.
 */
import { useId, useMemo, useState } from 'react'
import { Plus, Search, Trash2, X } from 'lucide-react'
import { INGREDIENTS, INGREDIENT_MAP, PRICES } from '../../domain/catalog'
import { analyzeMeal, gapPercent, mealTips, slotTargets, slotsFor, type MealItem } from '../../domain/meal-calculator'
import { SLOT_LABELS } from '../../domain/menu/slots'
import { computeTargets } from '../../domain/nutrition'
import { referenceWeightFor } from '../../domain/profiles'
import type { MealSlot } from '../../domain/types'
import { Button, Card, Notice, Pill } from '../../components/ui'
import { MiaAvatar } from '../../components/Mia'
import { useAppData } from '../../state/AppDataContext'
import { formatChf } from '../../lib/format'
import { DIET_LABELS, KASHRUT_LABELS } from '../recipes/recipe-labels'
import { parseNumber } from '../onboarding/draft'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe')

/** Quantité proposée à l'ajout : une pièce pour les œufs, sinon une portion courante. */
function defaultGrams(id: string): number {
  const ing = INGREDIENT_MAP.get(id)!
  if (ing.unit === 'piece') return ing.gramsPerPiece ?? 50
  if (ing.aisle === 'condiments') return 10
  if (ing.aisle === 'fruits-secs') return 20
  return 100
}

export interface CalculatorState {
  slot: MealSlot | null
  items: MealItem[]
}

export function MealCalculator({ state, setState }: { state: CalculatorState; setState: (s: CalculatorState) => void }) {
  const { activeProfile } = useAppData()
  const [query, setQuery] = useState('')
  const searchId = useId()
  const settings = activeProfile?.settings

  const slots = settings ? slotsFor(settings.mealsPerDay) : []
  const slot = state.slot && slots.includes(state.slot) ? state.slot : (slots[1] ?? slots[0])

  // Calculs instantanés : pas besoin de mémoïsation.
  let target = null
  if (activeProfile && slot) {
    const t = computeTargets(activeProfile.settings, referenceWeightFor(activeProfile))
    target = slotTargets({ kcal: t.targetKcal, proteinG: t.macros.proteinG, fatG: t.macros.fatG, carbsG: t.macros.carbsG }, activeProfile.settings.mealsPerDay, slot)
  }
  const analysis = settings ? analyzeMeal(state.items, INGREDIENT_MAP, PRICES.items, settings) : null

  const results = useMemo(() => {
    const q = norm(query.trim())
    if (!q) return []
    return INGREDIENTS.filter((i) => norm(i.name).includes(q) && !state.items.some((x) => x.ingredientId === i.id)).slice(0, 8)
  }, [query, state.items])

  if (!settings || !analysis || !target || !slot) return null

  const add = (id: string) => {
    setState({ slot, items: [...state.items, { ingredientId: id, grams: defaultGrams(id) }] })
    setQuery('')
  }
  const setGrams = (id: string, grams: number) =>
    setState({ slot, items: state.items.map((i) => (i.ingredientId === id ? { ...i, grams } : i)) })
  const remove = (id: string) => setState({ slot, items: state.items.filter((i) => i.ingredientId !== id) })

  const t = analysis.totals
  const rows = [
    { label: 'Calories', value: t.kcal, target: target.kcal, unit: 'kcal' },
    { label: 'Protéines', value: t.protein, target: target.proteinG, unit: 'g' },
    { label: 'Glucides', value: t.carbs, target: target.carbsG, unit: 'g' },
    { label: 'Lipides', value: t.fat, target: target.fatG, unit: 'g' },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="flex flex-col gap-5 lg:col-span-3" aria-labelledby="calc-title">
        <div>
          <h2 id="calc-title" className="text-lg font-bold">
            Calculer un repas fait maison
          </h2>
          <p className="text-sm text-muted">Ajoute les ingrédients de ton assiette et leur poids : je fais les comptes.</p>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Pour quel repas ?</legend>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <label
                key={s}
                className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition focus-within:ring-2 focus-within:ring-brand-400 ${
                  s === slot ? 'bg-brand-600 text-white' : 'bg-slate-100 hover:bg-slate-200'
                }`}
              >
                <input type="radio" name="calc-slot" className="sr-only" checked={s === slot} onChange={() => setState({ ...state, slot: s })} />
                {SLOT_LABELS[s]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="relative">
          <label htmlFor={searchId} className="mb-1.5 block text-sm font-semibold">
            Ajouter un ingrédient
          </label>
          <div className="relative">
            <Search size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id={searchId}
              type="search"
              value={query}
              placeholder="ex. riz, poulet, lentilles, séré…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results[0]) {
                  e.preventDefault()
                  add(results[0].id)
                }
              }}
              aria-describedby={`${searchId}-hint`}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <p id={`${searchId}-hint`} className="mt-1 text-xs text-muted">
            {INGREDIENTS.length} ingrédients disponibles. Entrée ajoute le premier résultat.
          </p>
          {results.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Résultats de recherche">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => add(r.id)}
                    className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm hover:border-brand-400 hover:bg-brand-50"
                  >
                    <Plus size={14} aria-hidden="true" /> {r.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim() && results.length === 0 && <p className="mt-2 text-sm text-muted">Aucun ingrédient ne correspond à « {query} ».</p>}
        </div>

        {state.items.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-6 text-center text-muted">Ton assiette est vide. Cherche un premier ingrédient ci-dessus.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="py-2 font-semibold">Ingrédient</th>
                  <th scope="col" className="py-2 font-semibold">Quantité</th>
                  <th scope="col" className="py-2 text-right font-semibold">kcal</th>
                  <th scope="col" className="py-2 text-right font-semibold">Prot.</th>
                  <th scope="col" className="py-2"><span className="sr-only">Retirer</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.items.map((item) => {
                  const ing = INGREDIENT_MAP.get(item.ingredientId)!
                  const line = analysis.lines.find((l) => l.ingredientId === item.ingredientId)
                  return (
                    <tr key={item.ingredientId}>
                      <th scope="row" className="py-2 pr-2 text-left font-medium">{ing.name}</th>
                      <td className="py-2">
                        <GramsInput
                          label={`Quantité de ${ing.name}`}
                          grams={item.grams}
                          unit={ing.unit === 'ml' ? 'ml' : 'g'}
                          onChange={(g) => setGrams(item.ingredientId, g)}
                        />
                        {ing.unit === 'piece' && ing.gramsPerPiece && (
                          <span className="ml-1 text-xs text-muted">≈ {Math.round((item.grams / ing.gramsPerPiece) * 10) / 10} pce</span>
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums">{line ? line.kcal : 0}</td>
                      <td className="py-2 text-right tabular-nums">{line ? Math.round(line.protein) : 0} g</td>
                      <td className="py-2 text-right">
                        <button type="button" onClick={() => remove(item.ingredientId)} className="rounded-lg p-1.5 text-muted hover:bg-slate-100 hover:text-ink" aria-label={`Retirer ${ing.name}`}>
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="mt-3">
              <Button variant="ghost" onClick={() => setState({ slot, items: [] })}>
                <X size={16} aria-hidden="true" /> Vider l’assiette
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card aria-labelledby="calc-result" className="lg:sticky lg:top-24">
          <h2 id="calc-result" className="text-lg font-bold">
            Bilan du repas
          </h2>
          <p className="mb-4 text-sm text-muted">
            {SLOT_LABELS[slot]} : environ {Math.round(target.share * 100)} % de ta journée, soit {target.kcal} kcal.
          </p>
          <dl className="flex flex-col gap-3" aria-live="polite">
            {rows.map((row) => {
              const pct = gapPercent(row.value, row.target)
              return (
                <div key={row.label} className="grid grid-cols-[1fr_auto] gap-x-2 text-sm">
                  <dt className="font-semibold">{row.label}</dt>
                  <dd>
                    {Math.round(row.value)} / {row.target} {row.unit}{' '}
                    {row.value > 0 && (
                      <span className="text-muted">
                        ({pct > 0 ? '+' : ''}
                        {pct} %)
                      </span>
                    )}
                  </dd>
                  <dd className="col-span-2 mt-1 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                    <div className="bar-fill h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, (row.value / Math.max(1, row.target)) * 100)}%` }} />
                  </dd>
                </div>
              )
            })}
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-sm">
            <span>
              Prix estimé : <strong>{formatChf(t.priceChf)}</strong>
            </span>
            {settings.restrictions.includes('casher') && state.items.length > 0 && (
              <Pill tone={analysis.kashrut === 'non-casher' ? 'accent' : 'brand'}>{KASHRUT_LABELS[analysis.kashrut]}</Pill>
            )}
          </div>
        </Card>

        {analysis.conflicts.length > 0 && (
          <Notice tone="attention" title="À vérifier pour ton profil">
            <ul className="list-disc pl-5">
              {analysis.conflicts.map((c) => (
                <li key={c}>{conflictText(c)}</li>
              ))}
            </ul>
          </Notice>
        )}

        {state.items.length > 0 && (
          <Card as="div" className="flex items-start gap-3 bg-gradient-to-br from-brand-50 to-white">
            <MiaAvatar size={44} />
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">Le conseil de Mia</p>
              <ul className="mt-1 flex flex-col gap-1">
                {mealTips(t, target).map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

/** Texte lisible pour un conflit de restriction. */
function conflictText(code: string): string {
  if (code === 'casher') return 'Ce repas n’est pas casher : viande et lait ensemble, ou aliment non casher.'
  if (code === 'casher (poisson et viande)') return 'Poisson et viande dans le même plat (option casher activée).'
  if (code.startsWith('n’aime pas')) return `Contient un aliment que tu n’aimes pas (${code.replace('n’aime pas : ', '')}).`
  const label = DIET_LABELS[code as keyof typeof DIET_LABELS]
  return label ? `Pas compatible « ${label} ».` : code
}

/** Champ de quantité : accepte « 120 » ou « 72,5 », sans bloquer la saisie en cours. */
function GramsInput({ label, grams, unit, onChange }: { label: string; grams: number; unit: string; onChange: (g: number) => void }) {
  const [text, setText] = useState(String(grams))
  return (
    <span className="inline-flex items-center rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-brand-400">
      <input
        aria-label={label}
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const v = parseNumber(e.target.value)
          onChange(Number.isFinite(v) && v >= 0 ? Math.min(v, 5000) : 0)
        }}
        className="w-16 rounded-lg bg-transparent px-2 py-1 text-right tabular-nums outline-none"
      />
      <span className="pr-2 text-xs text-muted" aria-hidden="true">
        {unit}
      </span>
    </span>
  )
}
