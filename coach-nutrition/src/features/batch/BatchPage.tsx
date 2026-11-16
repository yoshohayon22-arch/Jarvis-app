/**
 * Écran Batch cooking : réglage des sessions, puis pour chaque session
 * ce qu'il faut cuisiner, le plan minuté, le matériel et la conservation.
 */
import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChefHat, Clock, Flame, Package, Refrigerator, ShoppingCart, Snowflake, Timer, Wrench } from 'lucide-react'
import { INGREDIENT_MAP } from '../../domain/catalog'
import { buildSessionPlans, scaledIngredients, type SessionPlan, type TimelineStep } from '../../domain/batch-plan'
import { SLOT_LABELS } from '../../domain/menu/slots'
import { updateProfile } from '../../domain/profiles'
import { effectiveSessionDays } from '../../domain/menu/shabbat'
import type { DayOfWeek } from '../../domain/types'
import { Button, Card, Notice, Toggle } from '../../components/ui'
import { useAppData } from '../../state/AppDataContext'
import { formatDate, formatDuration } from '../../lib/format'
import { DAYS } from '../onboarding/options'
import { formatQuantity } from '../recipes/recipe-labels'
import { useMenu } from '../menu/useMenu'

/** Minute → « 0:35 » (temps écoulé depuis le début de la session). */
const clock = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`

export function BatchPage() {
  const { activeProfile, update } = useAppData()
  const { plan, recipes, generate } = useMenu()
  const sessions = useMemo(() => (plan ? buildSessionPlans(plan, recipes) : []), [plan, recipes])
  if (!activeProfile) return null
  const batch = activeProfile.settings.batch
  // Shabbat sans cuisson : pas de session le samedi.
  const noSaturday = activeProfile.settings.shabbat.enabled && activeProfile.settings.shabbat.noCookingSaturday

  const saveBatch = (enabled: boolean, sessionDays: DayOfWeek[]) =>
    update((d) => updateProfile(d, activeProfile.id, { settings: { ...activeProfile.settings, batch: { enabled, sessionDays } } }))

  const planMatches =
    plan?.batch &&
    batch.enabled &&
    JSON.stringify([...new Set(effectiveSessionDays(activeProfile.settings))].sort()) ===
      JSON.stringify([...new Set(plan.batch.sessions.map((s) => (new Date(`${s.cookDate}T00:00:00Z`).getUTCDay() + 6) % 7))].sort())

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/menu" className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          <ArrowLeft size={14} aria-hidden="true" /> Menu
        </Link>
        <h1 className="text-3xl font-bold">Batch cooking</h1>
      </div>

      <SessionSettings enabled={batch.enabled} days={batch.sessionDays} onChange={saveBatch} noSaturday={noSaturday} />

      {batch.enabled && !planMatches && (
        <Notice tone="info" title="Ton menu doit être adapté">
          <p>Le menu actuel n’est pas organisé selon ces sessions. Génère un nouveau menu pour obtenir tes bases, ton plan de cuisine et tes bowls.</p>
          <div className="mt-2">
            <Button onClick={generate}>
              <ChefHat size={18} aria-hidden="true" /> Générer le menu batch
            </Button>
          </div>
        </Notice>
      )}

      {batch.enabled && planMatches && sessions.map((s) => <SessionCard key={s.cookDate} session={s} total={sessions.length} />)}

      {!batch.enabled && (
        <Card className="text-muted">
          Le batch cooking consiste à cuisiner en grande quantité 1 à 3 fois par semaine : quelques bases (céréale,
          protéine, légumes rôtis, sauce) qu’on combine ensuite en bowls, plus des plats mijotés pour les soirs. Active-le
          ci-dessus pour obtenir ton plan.
        </Card>
      )}
    </div>
  )
}

function SessionSettings({
  enabled,
  days,
  onChange,
  noSaturday,
}: {
  enabled: boolean
  days: DayOfWeek[]
  onChange: (enabled: boolean, days: DayOfWeek[]) => void
  noSaturday: boolean
}) {
  const id = useId()
  const [count, setCount] = useState(Math.min(3, Math.max(1, days.length)))
  const current = [...days, 6, 2, 4].slice(0, count) as DayOfWeek[]
  const setDay = (i: number, d: DayOfWeek) => {
    const next = [...current]
    next[i] = d
    onChange(enabled, next)
  }
  return (
    <Card className="flex flex-col gap-4" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="text-lg font-bold">
        Mes sessions de cuisine
      </h2>
      <Toggle label="Activer le batch cooking" checked={enabled} onChange={(v) => onChange(v, current)} />
      {enabled && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-n`} className="text-sm font-semibold">
              Sessions par semaine
            </label>
            <select
              id={`${id}-n`}
              value={count}
              onChange={(e) => {
                const n = Number(e.target.value)
                setCount(n)
                onChange(true, [...current, 6, 2, 4].filter((d, i, a) => a.indexOf(d) === i).slice(0, n) as DayOfWeek[])
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          {current.map((d, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-d${i}`} className="text-sm font-semibold">
                Jour de la session {i + 1}
              </label>
              <select
                id={`${id}-d${i}`}
                value={d}
                onChange={(e) => setDay(i, Number(e.target.value) as DayOfWeek)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              >
                {DAYS.map((day) => (
                  <option
                    key={day.value}
                    value={day.value}
                    disabled={(current.includes(day.value) && day.value !== d) || (noSaturday && day.value === 5)}
                  >
                    {day.label}
                    {noSaturday && day.value === 5 ? ' (Shabbat)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
      {enabled && noSaturday && (
        <p className="text-sm text-muted">Shabbat : pas de session le samedi. Une session le vendredi permet de préparer les plats du samedi.</p>
      )}
    </Card>
  )
}

const KIND_STYLE: Record<TimelineStep['kind'], { icon: typeof Flame; cls: string; label: string }> = {
  prechauffage: { icon: Flame, cls: 'bg-accent-100 text-accent-800', label: 'Four' },
  preparation: { icon: ChefHat, cls: 'bg-brand-100 text-brand-800', label: 'Préparation' },
  cuisson: { icon: Timer, cls: 'bg-sky-100 text-sky-800', label: 'Cuisson' },
  rangement: { icon: Package, cls: 'bg-slate-100 text-slate-700', label: 'Rangement' },
}

function SessionCard({ session, total }: { session: SessionPlan; total: number }) {
  const [openItem, setOpenItem] = useState<string | null>(null)
  const first = session.dates[0]
  const last = session.dates[session.dates.length - 1]
  const frozen = session.storage.filter((s) => s.thawOn)
  return (
    <Card aria-labelledby={`session-${session.index}`} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
            Session {session.index + 1}
            {total > 1 && ` sur ${total}`}
          </p>
          <h2 id={`session-${session.index}`} className="text-2xl font-bold capitalize">
            {formatDate(session.cookDate, { weekday: 'long', day: 'numeric', month: 'long' })}
          </h2>
          <p className="text-muted">
            Pour les repas du {formatDate(first, { weekday: 'long', day: 'numeric' })}
            {last !== first && ` au ${formatDate(last, { weekday: 'long', day: 'numeric' })}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-2 font-bold text-brand-800">
            <Clock size={18} aria-hidden="true" /> {formatDuration(session.totalMin)}
          </span>
          <Link to={`/courses#liste-${session.index}`} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:border-brand-300">
            <ShoppingCart size={16} aria-hidden="true" /> Liste de courses
          </Link>
        </div>
      </div>

      {session.items.length === 0 ? (
        <p className="text-muted">Aucun plat à préparer pour cette session.</p>
      ) : (
        <>
          <section>
            <h3 className="mb-2 font-bold">À cuisiner</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {session.items.map((item) => {
                const open = openItem === item.recipe.id
                return (
                  <li key={item.recipe.id} className="rounded-xl border border-slate-100 p-3">
                    <button
                      type="button"
                      onClick={() => setOpenItem(open ? null : item.recipe.id)}
                      aria-expanded={open}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <span className="font-semibold">{item.recipe.name.replace(/^Base\s*:\s*/i, '')}</span>
                      <span className="shrink-0 text-sm text-muted">
                        {item.portions.toLocaleString('fr-CH')} portion{item.portions >= 2 ? 's' : ''}
                      </span>
                    </button>
                    {open && (
                      <div className="mt-2 border-t border-slate-100 pt-2 text-sm">
                        <ul className="mb-2">
                          {scaledIngredients(item, INGREDIENT_MAP).map(({ ingredient, grams }) => (
                            <li key={ingredient.id} className="flex justify-between">
                              <span>{ingredient.name}</span>
                              <span className="font-semibold tabular-nums">{formatQuantity(ingredient, grams)}</span>
                            </li>
                          ))}
                        </ul>
                        <ol className="list-decimal pl-5 text-muted">
                          {item.recipe.steps.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 font-bold">Plan de cuisine minuté</h3>
            <ol className="flex flex-col gap-2">
              {session.timeline.map((step, i) => {
                const st = KIND_STYLE[step.kind]
                const Icon = st.icon
                return (
                  <li key={i} className="flex gap-3">
                    <span className="w-24 shrink-0 pt-1 text-sm font-semibold tabular-nums text-muted">
                      {clock(step.start)} → {clock(step.end)}
                    </span>
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${st.cls}`} title={st.label}>
                      <Icon size={15} aria-hidden="true" />
                      <span className="sr-only">{st.label}</span>
                    </span>
                    <span className="flex flex-col">
                      <span className="font-semibold">{step.label}</span>
                      {step.detail && <span className="text-sm text-muted">{step.detail}</span>}
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section>
              <h3 className="mb-2 flex items-center gap-2 font-bold">
                <Wrench size={18} aria-hidden="true" className="text-brand-600" /> Matériel
              </h3>
              <ul className="list-disc pl-5 text-sm">
                {session.equipment.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-2 flex items-center gap-2 font-bold">
                <Refrigerator size={18} aria-hidden="true" className="text-brand-600" /> Conservation
              </h3>
              {frozen.length === 0 ? (
                <p className="text-sm">Tout se garde au frigo jusqu’au jour prévu.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {frozen.map((s) => (
                    <li key={`${s.date}-${s.slot}`} className="flex gap-2">
                      <Snowflake size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-sky-600" />
                      <span>
                        <strong className="capitalize">{formatDate(s.date, { weekday: 'long', day: 'numeric' })}</strong> ({SLOT_LABELS[s.slot].toLowerCase()}) :
                        congeler {s.parts.filter((p) => p.where === 'congelateur').map((p) => p.name.toLowerCase()).join(', ')} dès la fin de la session,
                        puis {s.parts.length > 1 ? 'les' : 'le'} sortir au frigo le{' '}
                        <strong>{formatDate(s.thawOn!, { weekday: 'long', day: 'numeric' })} au soir</strong>.
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted">Refroidis les plats avant de fermer les boîtes, et note la date dessus.</p>
            </section>
          </div>
        </>
      )}
    </Card>
  )
}
