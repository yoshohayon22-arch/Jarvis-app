/**
 * Écran Menu : menu de la semaine (génération, remplacement, verrouillage, coût)
 * et bibliothèque de recettes.
 */
import { useState } from 'react'
import { BookOpen, CalendarDays, Lock, LockOpen, RefreshCw, Shuffle, Sparkles, Wallet } from 'lucide-react'
import type { Recipe } from '../../domain/catalog'
import { isBatchCooked } from '../../domain/menu/batch'
import { daySummary, mealValues } from '../../domain/menu/generator'
import { SLOT_LABELS } from '../../domain/menu/slots'
import { todayIso } from '../../domain/nutrition'
import type { DayPlan, PlannedMeal } from '../../domain/types'
import { Button, Card, Notice, Pill, Toggle } from '../../components/ui'
import { Dialog } from '../../components/Dialog'
import { formatChf, formatDate } from '../../lib/format'
import { RecipeLibrary } from '../recipes/RecipeLibrary'
import { RecipeDetail } from '../recipes/RecipeDetail'
import { KASHRUT_LABELS } from '../recipes/recipe-labels'
import { useMenu } from './useMenu'

type Tab = 'semaine' | 'recettes'

export function MenuPage() {
  const [tab, setTab] = useState<Tab>('semaine')
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold">Menu</h1>
        <div role="tablist" aria-label="Affichage" className="flex rounded-xl bg-slate-100 p-1">
          {(
            [
              ['semaine', 'Ma semaine', CalendarDays],
              ['recettes', 'Recettes', BookOpen],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === id ? 'bg-white text-brand-700 shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              <Icon size={16} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'semaine' ? <WeekView /> : <RecipeLibrary />}
    </div>
  )
}

function WeekView() {
  const { ctx, plan, summary, recipes, stale, generate, replace, toggleLock, refit, setLowBudget } = useMenu()
  const today = todayIso()
  const todayIndex = plan ? plan.days.findIndex((d) => d.date === today) : -1
  const [selected, setSelected] = useState(Math.max(0, todayIndex))
  const [open, setOpen] = useState<{ meal: PlannedMeal } | null>(null)
  const [variants, setVariants] = useState<Record<string, number>>({})
  if (!ctx) return null
  const settings = ctx.settings
  const isKosher = settings.restrictions.includes('casher')

  if (!plan) {
    return (
      <Card className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <Sparkles size={28} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-bold">Ton menu de la semaine</h2>
          <p className="mx-auto max-w-md text-muted">
            7 jours de repas calés sur tes {ctx.targets.kcal.toLocaleString('fr-CH')} kcal et tes macros, qui respectent tes
            préférences. Tu pourras remplacer ou verrouiller chaque plat.
          </p>
        </div>
        <div className="w-full max-w-sm">
          <Toggle label="Mode petit budget" checked={settings.lowBudget} onChange={setLowBudget} />
        </div>
        <Button onClick={generate}>
          <Sparkles size={18} aria-hidden="true" /> Générer mon menu
        </Button>
      </Card>
    )
  }

  const day = plan.days[selected]
  const budget = settings.weeklyBudgetChf
  const proteinGap = summary ? summary.protein / plan.targets.proteinG - 1 : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted">
          Semaine du <strong className="text-ink">{formatDate(plan.weekStart, { day: 'numeric', month: 'long' })}</strong> au{' '}
          <strong className="text-ink">{formatDate(plan.days[6].date, { day: 'numeric', month: 'long' })}</strong>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-64">
            <Toggle label="Petit budget" checked={settings.lowBudget} onChange={setLowBudget} />
          </div>
          <Button variant="secondary" onClick={generate}>
            <RefreshCw size={18} aria-hidden="true" /> Nouveau menu
          </Button>
        </div>
      </div>

      {plan.weekStart < ctx.weekStart && (
        <Notice tone="info" title="Une nouvelle semaine commence">
          Ce menu concerne une semaine passée. Clique sur « Nouveau menu » pour préparer celle du{' '}
          {formatDate(ctx.weekStart, { day: 'numeric', month: 'long' })}.
        </Notice>
      )}
      {stale && (
        <Notice tone="attention" title="Tes besoins ont changé">
          <p>Depuis la création du menu, ton objectif calorique ou ton mode budget a évolué.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={refit}>
              Adapter les portions
            </Button>
            <Button variant="ghost" onClick={generate}>
              Générer un nouveau menu
            </Button>
          </div>
        </Notice>
      )}

      {summary && (
        <Card as="div" className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <Wallet size={16} aria-hidden="true" /> Coût estimé de la semaine
            </p>
            <p className="text-2xl font-bold">{formatChf(summary.costChf)}</p>
            <p className="text-sm text-muted">soit {formatChf(summary.costPerDayChf)} par jour</p>
          </div>
          <div className="sm:col-span-2">
            {budget ? (
              <BudgetBar cost={summary.costChf} budget={budget} lowBudget={settings.lowBudget} onLowBudget={() => setLowBudget(true)} />
            ) : (
              <p className="text-sm text-muted">
                Ajoute un budget hebdomadaire dans ton profil pour comparer. Prix {plan.lowBudget ? 'des produits les moins chers (M-Budget, Prix Garantie, Lidl, Aldi)' : 'moyens Migros / Coop'}, pour tes portions.
              </p>
            )}
          </div>
        </Card>
      )}

      {proteinGap < -0.1 && (
        <Notice tone="info" title="Petit coup de pouce protéines">
          Cette semaine, le menu apporte environ {Math.round(summary!.protein)} g de protéines par jour pour un objectif de{' '}
          {plan.targets.proteinG} g. {settings.mealsPerDay < 5 ? 'Passer à une collation de plus (séré, cottage cheese, yaourt grec, œufs) dans ton profil' : 'Choisir des collations à base de séré, cottage cheese ou yaourt grec'} aide à combler l’écart.
        </Notice>
      )}

      {/* Vue de la semaine : un bouton par jour */}
      <nav aria-label="Jours de la semaine">
        <ul className="grid grid-cols-7 gap-1.5 sm:gap-3">
          {plan.days.map((d, i) => {
            const s = daySummary(d, recipes, plan.lowBudget)
            const isSel = i === selected
            return (
              <li key={d.date}>
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-current={isSel ? 'date' : undefined}
                  className={`flex w-full flex-col items-center rounded-xl border px-1 py-2.5 transition sm:px-3 ${
                    isSel ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-100 bg-white hover:border-brand-300'
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase sm:text-xs">
                    {formatDate(d.date, { weekday: 'short' }).replace('.', '')}
                  </span>
                  <span className="text-lg font-bold">{Number(d.date.slice(8))}</span>
                  <span className={`hidden text-xs sm:block ${isSel ? 'text-brand-50' : 'text-muted'}`}>{Math.round(s.kcal)} kcal</span>
                  {d.date === today && <span className="sr-only">(aujourd’hui)</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <DayDetail
        day={day}
        dayIndex={selected}
        targets={plan.targets}
        lowBudget={plan.lowBudget}
        showKashrut={isKosher}
        recipes={recipes}
        batch={Boolean(plan.batch)}
        onOpen={(meal) => setOpen({ meal })}
        onReplace={(slot) => {
          const key = `${selected}-${slot}`
          const v = (variants[key] ?? 0) + 1
          setVariants({ ...variants, [key]: v })
          replace(selected, slot, v)
        }}
        onToggleLock={(slot) => toggleLock(selected, slot)}
      />

      <Dialog
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? recipes.get(open.meal.recipeId)!.name : ''}
        size="xl"
      >
        {open && <RecipeDetail recipe={recipes.get(open.meal.recipeId)!} showKashrut={isKosher} portions={open.meal.portions} />}
      </Dialog>
    </div>
  )
}

function BudgetBar({ cost, budget, lowBudget, onLowBudget }: { cost: number; budget: number; lowBudget: boolean; onLowBudget: () => void }) {
  const ratio = cost / budget
  const over = ratio > 1
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-sm">
        <span className="font-semibold">Budget : {formatChf(budget)}</span>
        <span className={over ? 'font-semibold text-accent-800' : 'text-brand-700'}>
          {over ? `${formatChf(cost - budget)} au-dessus` : `${formatChf(budget - cost)} de marge`}
        </span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label="Coût du menu par rapport au budget"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(ratio, 1) * 100)}
      >
        <div className={`h-full rounded-full ${over ? 'bg-accent-400' : 'bg-brand-500'}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      </div>
      {over && (
        <p className="text-sm text-muted">
          {lowBudget ? (
            'Le menu est déjà optimisé petit budget. Tu peux remplacer quelques plats (poisson, viande) par des recettes à base de légumineuses ou d’œufs.'
          ) : (
            <>
              Active le mode petit budget pour privilégier les produits les moins chers.{' '}
              <button type="button" onClick={onLowBudget} className="font-semibold text-brand-700 underline">
                Activer
              </button>
            </>
          )}
        </p>
      )}
    </div>
  )
}

function DayDetail({
  day,
  dayIndex,
  targets,
  lowBudget,
  showKashrut,
  recipes,
  batch,
  onOpen,
  onReplace,
  onToggleLock,
}: {
  day: DayPlan
  dayIndex: number
  targets: { kcal: number; proteinG: number; fatG: number; carbsG: number }
  lowBudget: boolean
  showKashrut: boolean
  recipes: ReadonlyMap<string, Recipe>
  batch: boolean
  onOpen: (meal: PlannedMeal) => void
  onReplace: (slot: PlannedMeal['slot']) => void
  onToggleLock: (slot: PlannedMeal['slot']) => void
}) {
  const s = daySummary(day, recipes, lowBudget)
  const rows = [
    { label: 'Calories', value: s.kcal, target: targets.kcal, unit: 'kcal' },
    { label: 'Protéines', value: s.protein, target: targets.proteinG, unit: 'g' },
    { label: 'Glucides', value: s.carbs, target: targets.carbsG, unit: 'g' },
    { label: 'Lipides', value: s.fat, target: targets.fatG, unit: 'g' },
  ]
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2" aria-labelledby={`day-${dayIndex}`}>
        <h2 id={`day-${dayIndex}`} className="mb-4 text-lg font-bold capitalize">
          {formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}
        </h2>
        <ul className="flex flex-col gap-3">
          {day.meals.map((m) => {
            const r = recipes.get(m.recipeId)!
            const v = mealValues(m, r, lowBudget)
            return (
              <li key={m.slot} className={`rounded-xl border p-4 ${m.locked ? 'border-brand-300 bg-brand-50/50' : 'border-slate-100'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">{SLOT_LABELS[m.slot]}</p>
                    <button type="button" onClick={() => onOpen(m)} className="text-left font-bold text-ink hover:text-brand-700 hover:underline">
                      {r.name}
                    </button>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
                      <span className="font-semibold text-brand-700">{Math.round(v.kcal)} kcal</span>
                      <span>{m.portions.toLocaleString('fr-CH')} portion{m.portions >= 2 ? 's' : ''}</span>
                      <span>{Math.round(v.protein)} g prot.</span>
                      <span>{formatChf(v.costChf)}</span>
                      {showKashrut && <Pill tone="slate">{KASHRUT_LABELS[r.kashrut].split(' ')[0]}</Pill>}
                      {batch && isBatchCooked(r, m.slot) && <Pill tone="brand">Préparé en batch</Pill>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleLock(m.slot)}
                      aria-pressed={m.locked}
                      aria-label={m.locked ? `Déverrouiller ${r.name}` : `Verrouiller ${r.name}`}
                      title={m.locked ? 'Déverrouiller' : 'Verrouiller (gardé si tu régénères le menu)'}
                      className={`rounded-xl p-2.5 transition ${m.locked ? 'bg-brand-600 text-white' : 'bg-slate-100 text-muted hover:bg-slate-200'}`}
                    >
                      {m.locked ? <Lock size={18} aria-hidden="true" /> : <LockOpen size={18} aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onReplace(m.slot)}
                      disabled={m.locked}
                      className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-semibold hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Remplacer ${r.name}`}
                    >
                      <Shuffle size={16} aria-hidden="true" /> <span className="hidden sm:inline">Remplacer</span>
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card aria-labelledby={`totals-${dayIndex}`}>
        <h2 id={`totals-${dayIndex}`} className="mb-4 text-lg font-bold">
          Bilan du jour
        </h2>
        <dl className="flex flex-col gap-3">
          {rows.map((row) => {
            const pct = Math.round((row.value / row.target - 1) * 100)
            return (
              <div key={row.label} className="grid grid-cols-[1fr_auto] gap-x-2 text-sm">
                <dt className="font-semibold">{row.label}</dt>
                <dd>
                  {Math.round(row.value)} / {row.target} {row.unit}{' '}
                  <span className="text-muted">
                    ({pct > 0 ? '+' : ''}
                    {pct} %)
                  </span>
                </dd>
                <dd className="col-span-2 mt-1 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, (row.value / row.target) * 100)}%` }} />
                </dd>
              </div>
            )
          })}
        </dl>
        <p className="mt-4 text-sm text-muted">Coût du jour : {formatChf(s.costChf)}</p>
      </Card>
    </div>
  )
}
