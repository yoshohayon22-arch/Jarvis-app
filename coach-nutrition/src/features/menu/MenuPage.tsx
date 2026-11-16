/**
 * Écran Menu, en version épurée : la semaine (un jour à la fois, un repas par ligne,
 * actions discrètes, bilan en une ligne), les recettes et le calculateur de repas.
 */
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Calculator, CalendarDays, UtensilsCrossed, ChefHat, Check, Flame, Lock, LockOpen, RefreshCw, Shuffle, Sparkles } from 'lucide-react'
import type { Recipe } from '../../domain/catalog'
import { isBatchCooked } from '../../domain/menu/batch'
import { daySummary, mealValues } from '../../domain/menu/generator'
import { shabbatLabel } from '../../domain/menu/shabbat'
import { SLOT_LABELS } from '../../domain/menu/slots'
import { todayIso } from '../../domain/nutrition'
import type { DayPlan, PlannedMeal, ProfileSettings } from '../../domain/types'
import { Button, Card, Notice } from '../../components/ui'
import { Dialog } from '../../components/Dialog'
import { formatChf, formatDate } from '../../lib/format'
import { RecipeLibrary } from '../recipes/RecipeLibrary'
import { RecipeDetail } from '../recipes/RecipeDetail'
import { useMenu } from './useMenu'
import { CountUp } from '../../components/CountUp'
import { MealCalculator, type CalculatorState } from './MealCalculator'
import { MealIdeas } from './MealIdeas'

type Tab = 'semaine' | 'idee' | 'recettes' | 'calcul'

export function MenuPage() {
  // L'accueil peut ouvrir directement l'onglet « Un repas ».
  const location = useLocation()
  const [tab, setTab] = useState<Tab>((location.state as { tab?: Tab } | null)?.tab ?? 'semaine')
  // L'assiette du calculateur est gardée quand on change d'onglet.
  const [calc, setCalc] = useState<CalculatorState>({ slot: null, items: [] })
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold">Menu</h1>
        <div role="tablist" aria-label="Affichage" className="flex w-full rounded-xl bg-slate-100 p-1 sm:w-auto">
          {(
            [
              ['semaine', 'Semaine', CalendarDays],
              ['idee', 'Un repas', UtensilsCrossed],
              ['recettes', 'Recettes', BookOpen],
              ['calcul', 'Calculer', Calculator],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition sm:flex-none sm:px-4 ${
                tab === id ? 'bg-white text-brand-700 shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              <Icon size={16} aria-hidden="true" className="hidden sm:block" /> {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'semaine' && <WeekView />}
      {tab === 'idee' && <MealIdeas />}
      {tab === 'recettes' && <RecipeLibrary />}
      {tab === 'calcul' && <MealCalculator state={calc} setState={setCalc} />}
    </div>
  )
}

function WeekView() {
  const { ctx, plan, summary, recipes, stale, generate, replace, toggleLock, refit, setLowBudget } = useMenu()
  const today = todayIso()
  const todayIndex = plan ? plan.days.findIndex((d) => d.date === today) : -1
  const [selected, setSelected] = useState(Math.max(0, todayIndex))
  const [open, setOpen] = useState<PlannedMeal | null>(null)
  const [variants, setVariants] = useState<Record<string, number>>({})
  if (!ctx) return null
  const settings = ctx.settings

  if (!plan) {
    return (
      <Card className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <Sparkles size={28} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-bold">Ton menu de la semaine</h2>
          <p className="mx-auto max-w-md text-muted">
            7 jours calés sur tes {ctx.targets.kcal.toLocaleString('fr-CH')} kcal et tes préférences. Tu pourras remplacer ou garder chaque plat.
          </p>
        </div>
        <BudgetSwitch on={settings.lowBudget} onChange={setLowBudget} />
        <Button onClick={generate}>
          <Sparkles size={18} aria-hidden="true" /> Générer mon menu
        </Button>
      </Card>
    )
  }

  const day = plan.days[selected]
  const budget = settings.weeklyBudgetChf
  const proteinGap = summary ? summary.protein / plan.targets.proteinG - 1 : 0
  // Un seul message à la fois, le plus utile.
  const notice = stale
    ? { title: 'Tes besoins ont changé', text: 'Adapte les portions à ton objectif actuel, ou génère un nouveau menu.', action: { label: 'Adapter les portions', run: refit } }
    : plan.weekStart < ctx.weekStart
      ? { title: 'Nouvelle semaine', text: `Ce menu est passé : prépare celui du ${formatDate(ctx.weekStart, { day: 'numeric', month: 'long' })}.`, action: { label: 'Nouveau menu', run: generate } }
      : proteinGap < -0.1
        ? { title: 'Coup de pouce protéines', text: 'Ajoute une collation de séré, cottage cheese, yaourt grec ou des œufs pour atteindre ton objectif.', action: null }
        : null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {/* Résumé de la semaine en une ligne + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold">
            {formatDate(plan.weekStart, { day: 'numeric' })} – {formatDate(plan.days[6].date, { day: 'numeric', month: 'long' })}
          </p>
          {summary && (
            <p className="text-sm text-muted">
              <CountUp value={summary.costChf} format={formatChf} /> la semaine · {formatChf(summary.costPerDayChf)} / jour
              {budget ? (
                summary.costChf <= budget ? (
                  <span className="text-brand-700"> · dans ton budget</span>
                ) : (
                  <span className="text-accent-800"> · {formatChf(summary.costChf - budget)} au-dessus du budget</span>
                )
              ) : null}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BudgetSwitch on={settings.lowBudget} onChange={setLowBudget} />
          {settings.batch.enabled && (
            <Link to="/batch" className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:border-brand-300">
              <ChefHat size={16} aria-hidden="true" /> Plan batch
            </Link>
          )}
          <Button variant="secondary" onClick={generate}>
            <RefreshCw size={16} aria-hidden="true" /> Nouveau menu
          </Button>
        </div>
      </div>

      {notice && (
        <Notice tone={stale ? 'attention' : 'info'} title={notice.title}>
          <p>{notice.text}</p>
          {notice.action && (
            <button type="button" onClick={notice.action.run} className="mt-1 font-semibold text-brand-700 underline">
              {notice.action.label}
            </button>
          )}
        </Notice>
      )}

      {/* Jours de la semaine */}
      <nav aria-label="Jours de la semaine">
        <ul className="grid grid-cols-7 gap-1.5">
          {plan.days.map((d, i) => {
            const isSel = i === selected
            const shabbat = settings.shabbat.enabled && (i === 4 || i === 5)
            return (
              <li key={d.date}>
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-current={isSel ? 'date' : undefined}
                  className={`flex w-full flex-col items-center rounded-xl py-2 transition ${
                    isSel ? 'bg-brand-600 text-white' : 'bg-white text-ink hover:bg-brand-50'
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase">{formatDate(d.date, { weekday: 'short' }).replace('.', '')}</span>
                  <span className="text-lg font-bold leading-tight">{Number(d.date.slice(8))}</span>
                  {shabbat ? (
                    <Flame size={12} aria-label="Shabbat" className={isSel ? 'text-accent-200' : 'text-accent-500'} />
                  ) : (
                    <span className="h-3" aria-hidden="true" />
                  )}
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
        settings={settings}
        recipes={recipes}
        batch={Boolean(plan.batch)}
        onOpen={setOpen}
        onReplace={(slot) => {
          const key = `${selected}-${slot}`
          const v = (variants[key] ?? 0) + 1
          setVariants({ ...variants, [key]: v })
          replace(selected, slot, v)
        }}
        onToggleLock={(slot) => toggleLock(selected, slot)}
      />

      <Dialog open={open !== null} onClose={() => setOpen(null)} title={open ? recipes.get(open.recipeId)!.name : ''} size="xl">
        {open && <RecipeDetail recipe={recipes.get(open.recipeId)!} showKashrut={settings.restrictions.includes('casher')} portions={open.portions} />}
      </Dialog>
    </div>
  )
}

/** Interrupteur compact « Petit budget ». */
function BudgetSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
        on ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-muted hover:border-brand-300'
      }`}
    >
      <span className={`relative h-4 w-7 rounded-full transition ${on ? 'bg-brand-600' : 'bg-slate-300'}`} aria-hidden="true">
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
      </span>
      Petit budget
    </button>
  )
}

function DayDetail({
  day,
  dayIndex,
  targets,
  lowBudget,
  settings,
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
  settings: ProfileSettings
  recipes: ReadonlyMap<string, Recipe>
  batch: boolean
  onOpen: (meal: PlannedMeal) => void
  onReplace: (slot: PlannedMeal['slot']) => void
  onToggleLock: (slot: PlannedMeal['slot']) => void
}) {
  const s = daySummary(day, recipes, lowBudget)
  const kcalGap = Math.round((s.kcal / targets.kcal - 1) * 100)
  const inTarget = Math.abs(kcalGap) <= 5
  return (
    <Card key={day.date} className="animate-fade-in !p-0" aria-labelledby={`day-${dayIndex}`}>
      <h2 id={`day-${dayIndex}`} className="px-5 pt-5 text-lg font-bold capitalize sm:px-6">
        {formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}
      </h2>
      <ul className="mt-2 divide-y divide-slate-100">
        {day.meals.map((m) => {
          const r = recipes.get(m.recipeId)!
          const v = mealValues(m, r, lowBudget)
          const label = shabbatLabel(settings, dayIndex, m.slot)
          return (
            <li key={`${m.slot}-${m.recipeId}`} className={`animate-slide-in-right flex items-center gap-3 px-5 py-3 sm:px-6 ${m.locked ? 'bg-brand-50/60' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {SLOT_LABELS[m.slot]}
                  {label && (
                    <span className="flex items-center gap-1 normal-case tracking-normal text-accent-700">
                      <Flame size={12} aria-hidden="true" /> {label}
                    </span>
                  )}
                  {batch && isBatchCooked(r, m.slot) && (
                    <span className="flex items-center gap-1 normal-case tracking-normal text-brand-700">
                      <ChefHat size={12} aria-hidden="true" /> batch
                    </span>
                  )}
                </p>
                <button type="button" onClick={() => onOpen(m)} className="text-left font-semibold leading-snug text-ink hover:text-brand-700 hover:underline">
                  {r.name}
                </button>
                {/* Sur téléphone, les kcal passent sous le nom pour lui laisser la place. */}
                <p className="text-sm font-semibold tabular-nums text-brand-700 sm:hidden">{Math.round(v.kcal)} kcal</p>
              </div>
              <span className="hidden shrink-0 text-sm font-semibold tabular-nums text-brand-700 sm:block">{Math.round(v.kcal)} kcal</span>
              <div className="flex shrink-0 gap-1">
                <IconButton
                  label={m.locked ? `Ne plus garder ${r.name}` : `Garder ${r.name} (même si je régénère)`}
                  pressed={m.locked}
                  onClick={() => onToggleLock(m.slot)}
                >
                  {m.locked ? <Lock size={16} aria-hidden="true" /> : <LockOpen size={16} aria-hidden="true" />}
                </IconButton>
                <IconButton label={`Remplacer ${r.name}`} disabled={m.locked} onClick={() => onReplace(m.slot)}>
                  <Shuffle size={16} aria-hidden="true" />
                </IconButton>
              </div>
            </li>
          )
        })}
      </ul>
      {/* Bilan du jour en une ligne, détails sur demande */}
      <details className="group border-t border-slate-100 px-5 py-3 text-sm sm:px-6">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold">
            {Math.round(s.kcal).toLocaleString('fr-CH')} kcal · {Math.round(s.protein)} g de protéines
          </span>
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${inTarget ? 'bg-brand-100 text-brand-800' : 'bg-accent-100 text-accent-800'}`}>
            {inTarget ? <Check size={12} aria-hidden="true" /> : null}
            {inTarget ? 'dans ta cible' : `${kcalGap > 0 ? '+' : ''}${kcalGap} % de la cible`}
          </span>
          <span className="ml-auto text-xs text-muted underline-offset-2 group-open:hidden hover:underline">Détails</span>
        </summary>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-muted sm:grid-cols-4">
          {[
            ['Calories', s.kcal, targets.kcal, 'kcal'],
            ['Protéines', s.protein, targets.proteinG, 'g'],
            ['Glucides', s.carbs, targets.carbsG, 'g'],
            ['Lipides', s.fat, targets.fatG, 'g'],
          ].map(([label, value, target, unit]) => (
            <div key={label as string}>
              <dt className="text-xs">{label}</dt>
              <dd className="font-semibold text-ink">
                {Math.round(value as number)} / {target} {unit}
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-xs">Coût du jour</dt>
            <dd className="font-semibold text-ink">{formatChf(s.costChf)}</dd>
          </div>
        </dl>
      </details>
    </Card>
  )
}

/** Petit bouton icône (avec nom accessible et infobulle). */
function IconButton({
  label,
  onClick,
  pressed,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  pressed?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`rounded-lg p-2 transition disabled:cursor-not-allowed disabled:opacity-30 ${
        pressed ? 'bg-brand-600 text-white' : 'text-muted hover:bg-slate-100 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
