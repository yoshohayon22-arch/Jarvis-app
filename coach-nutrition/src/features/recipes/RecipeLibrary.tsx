/**
 * Bibliothèque de recettes, filtrée selon le profil actif (restrictions + aliments détestés).
 */
import { useMemo, useState } from 'react'
import { ChefHat, Clock, Search, Wallet } from 'lucide-react'
import { INGREDIENT_MAP, RECIPES, type MealType, type Recipe } from '../../domain/catalog'
import { exclusionReasons } from '../../domain/restrictions'
import { useAppData } from '../../state/AppDataContext'
import { Card, Notice, Pill, Toggle } from '../../components/ui'
import { Dialog } from '../../components/Dialog'
import { formatChf } from '../../lib/format'
import { DIET_LABELS, KASHRUT_LABELS, MEAL_LABELS } from './recipe-labels'
import { RecipeDetail } from './RecipeDetail'

const FILTERS: { value: MealType | 'tout'; label: string }[] = [
  { value: 'tout', label: 'Tout' },
  { value: 'petit-dej', label: 'Petit-déjeuner' },
  { value: 'dejeuner', label: 'Déjeuner / dîner' },
  { value: 'collation', label: 'Collation' },
  { value: 'base', label: 'Bases batch' },
]

/** Recherche insensible aux accents et à la casse. */
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function RecipeLibrary() {
  const { activeProfile } = useAppData()
  const [meal, setMeal] = useState<MealType | 'tout'>('tout')
  const [query, setQuery] = useState('')
  const [budgetOnly, setBudgetOnly] = useState(false)
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [showExcluded, setShowExcluded] = useState(false)

  const settings = activeProfile?.settings
  const isKosher = settings?.restrictions.includes('casher') ?? false

  const { allowed, excluded } = useMemo(() => {
    const allowed: Recipe[] = []
    const excluded: { recipe: Recipe; reasons: string[] }[] = []
    if (!settings) return { allowed, excluded }
    for (const r of RECIPES) {
      const reasons = exclusionReasons(r, settings, INGREDIENT_MAP)
      if (reasons.length) excluded.push({ recipe: r, reasons })
      else allowed.push(r)
    }
    return { allowed, excluded }
  }, [settings])

  const visible = allowed.filter((r) => {
    if (meal === 'dejeuner' ? !(r.mealTypes.includes('dejeuner') || r.mealTypes.includes('diner')) : meal !== 'tout' && !r.mealTypes.includes(meal)) return false
    if (budgetOnly && !r.tags.includes('petit-budget')) return false
    if (query && !norm(r.name).includes(norm(query))) return false
    return true
  })

  if (!settings) return null

  return (
    <div className="flex flex-col gap-6">
      <Card as="div" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <label htmlFor="recipe-search" className="sr-only">
              Rechercher une recette
            </label>
            <Search size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="recipe-search"
              type="search"
              placeholder="Rechercher (ex. lentilles, saumon…)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div className="md:w-72">
            <Toggle label="Petit budget uniquement" checked={budgetOnly} onChange={setBudgetOnly} />
          </div>
        </div>
        <div role="group" aria-label="Type de repas" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={meal === f.value}
              onClick={() => setMeal(f.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                meal === f.value ? 'bg-brand-600 text-white' : 'bg-slate-100 text-ink hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {settings.restrictions.length > 0 && (
          <p className="text-sm text-muted">
            Filtres actifs : {settings.restrictions.map((r) => DIET_LABELS[r]).join(', ')}
            {settings.dislikedFoods.length > 0 && ` · sans ${settings.dislikedFoods.join(', ')}`}
          </p>
        )}
      </Card>

      <p className="text-sm text-muted" aria-live="polite">
        {visible.length} recette{visible.length > 1 ? 's' : ''}
      </p>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setSelected(r)}
              className="flex h-full w-full flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
            >
              <div className="flex flex-wrap gap-1.5">
                <Pill tone="slate">{r.mealTypes.map((m) => MEAL_LABELS[m]).join(' · ')}</Pill>
                {isKosher && <Pill tone="brand">{KASHRUT_LABELS[r.kashrut].split(' ')[0]}</Pill>}
                {r.tags.includes('petit-budget') && <Pill tone="accent">Petit budget</Pill>}
              </div>
              <h2 className="font-bold leading-snug">{r.name}</h2>
              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <span className="font-semibold text-brand-700">{r.perServing.kcal} kcal</span>
                <span>{Math.round(r.perServing.protein)} g prot.</span>
                <span className="flex items-center gap-1">
                  <Clock size={14} aria-hidden="true" /> {r.prepMin + r.cookMin} min
                </span>
                <span className="flex items-center gap-1">
                  <Wallet size={14} aria-hidden="true" /> {formatChf(settings.lowBudget ? r.perServing.priceBudgetChf : r.perServing.priceChf)}
                </span>
                {r.tags.includes('batch-friendly') && (
                  <span className="flex items-center gap-1">
                    <ChefHat size={14} aria-hidden="true" /> batch
                  </span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {excluded.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowExcluded((s) => !s)} aria-expanded={showExcluded} className="text-sm font-semibold text-brand-700 hover:underline">
            {showExcluded ? 'Masquer' : 'Voir'} les {excluded.length} recettes écartées pour ton profil
          </button>
          {showExcluded && (
            <div className="mt-3">
              <Notice tone="info">
                <ul className="flex flex-col gap-1">
                  {excluded.map(({ recipe, reasons }) => (
                    <li key={recipe.id}>
                      <strong>{recipe.name}</strong> — {reasons.join(', ')}
                    </li>
                  ))}
                </ul>
              </Notice>
            </div>
          )}
        </div>
      )}

      <Dialog open={selected !== null} onClose={() => setSelected(null)} title={selected?.name ?? ''} size="xl">
        {selected && <RecipeDetail recipe={selected} showKashrut={isKosher} />}
      </Dialog>
    </div>
  )
}
