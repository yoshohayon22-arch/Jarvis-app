/**
 * Écran Suivi : saisie rapide d'une pesée, indicateurs (départ, actuel, tendance, cible,
 * % parcouru, tendance par semaine, dates estimées), courbe avec moyenne mobile sur 7 jours,
 * historique et FAQ du coach.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronDown, Trash2 } from 'lucide-react'
import { computeTargets, todayIso, addDays } from '../../domain/nutrition'
import { referenceWeightFor, removeWeighIn, upsertWeighIn } from '../../domain/profiles'
import { progressPercent } from '../../domain/progress'
import { projectedDate, trendSeries, weeklyTrend } from '../../domain/tracking'
import { FAQ } from '../../domain/coach'
import { checkWeight } from '../../domain/safety'
import { Button, Card, Field } from '../../components/ui'
import { useAppData } from '../../state/AppDataContext'
import { formatDate, formatKg } from '../../lib/format'
import { parseNumber } from '../onboarding/draft'
import { CoachCard } from '../coach/CoachCard'
import { WeighInDialog } from './WeighInDialog'

/** Couleurs du graphique (validées : contraste ≥ 3:1 pour les tracés et séparation daltonisme). */
const COLORS = { raw: '#0284c7', avg: '#07964f', target: '#d95c06', grid: '#e8edea', axis: '#52645b' }
const RANGES = [
  { id: '30', label: '1 mois', days: 30 },
  { id: '90', label: '3 mois', days: 90 },
  { id: 'all', label: 'Tout', days: Infinity },
] as const

export function TrackingPage() {
  const { activeProfile, update } = useAppData()
  const [weighOpen, setWeighOpen] = useState(false)
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('90')
  const today = todayIso()
  const series = useMemo(() => (activeProfile ? trendSeries(activeProfile.weighIns) : []), [activeProfile])
  if (!activeProfile) return null

  const { settings, weighIns } = activeProfile
  const trend = referenceWeightFor(activeProfile)
  const latest = series[series.length - 1]
  const perWeek = weeklyTrend(weighIns, today)
  const targets = computeTargets(settings, trend)
  const projected = projectedDate(trend, settings.targetWeightKg, perWeek, today)
  const pct = progressPercent(settings.startWeightKg, trend, settings.targetWeightKg)
  const days = RANGES.find((r) => r.id === range)!.days
  const from = Number.isFinite(days) ? addDays(today, -days) : '0000-00-00'
  const visible = series.filter((p) => p.date >= from).map((p) => ({ ...p, t: Date.parse(`${p.date}T12:00:00`) }))

  const values = [...visible.flatMap((p) => [p.kg, p.avg7]), settings.targetWeightKg]
  // Graduations rondes : tous les 1, 2 ou 5 kg selon l'amplitude.
  const lo = Math.min(...values) - 0.5
  const hi = Math.max(...values) + 0.5
  const step = hi - lo > 20 ? 5 : hi - lo > 6 ? 2 : 1
  const yMin = Math.floor(lo / step) * step
  const yMax = Math.ceil(hi / step) * step
  const yTicks = Array.from({ length: Math.round((yMax - yMin) / step) + 1 }, (_, i) => yMin + i * step)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold">Suivi</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <QuickWeighIn onSave={(date, kg) => update((d) => upsertWeighIn(d, activeProfile.id, { date, kg }))} />
        <CoachCard className="lg:col-span-2" onWeigh={() => setWeighOpen(true)} />
      </div>

      <Card aria-labelledby="stats-title">
        <h2 id="stats-title" className="sr-only">
          Indicateurs
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Départ" value={formatKg(settings.startWeightKg)} />
          <Stat label="Dernière pesée" value={latest ? formatKg(latest.kg) : '—'} detail={latest ? formatDate(latest.date, { day: 'numeric', month: 'short' }) : undefined} />
          <Stat label="Tendance (moy. 7 j)" value={formatKg(trend)} highlight />
          <Stat label="Objectif" value={formatKg(settings.targetWeightKg)} />
          <Stat label="Chemin parcouru" value={`${pct} %`} />
          <Stat
            label="Tendance / semaine"
            value={perWeek === null ? '—' : `${perWeek > 0 ? '+' : perWeek < 0 ? '−' : ''}${formatKg(Math.abs(perWeek))}`}
            detail={perWeek === null ? 'Il faut 3 pesées sur 7 jours' : 'sur les 3 dernières semaines'}
          />
        </dl>
        <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted">Date estimée selon ton plan : </span>
            <strong>{targets.estimatedGoalDate ? formatDate(targets.estimatedGoalDate) : settings.maintenanceMode ? 'maintien' : '—'}</strong>
          </p>
          <p>
            <span className="text-muted">Au rythme actuel : </span>
            <strong>{projected ? formatDate(projected) : 'pas encore assez de recul'}</strong>
          </p>
        </div>
      </Card>

      <Card aria-labelledby="chart-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="chart-title" className="text-lg font-bold">
              Évolution du poids
            </h2>
            <p className="text-sm text-muted">La moyenne sur 7 jours lisse les variations d’eau d’un jour à l’autre.</p>
          </div>
          <div role="group" aria-label="Période affichée" className="flex rounded-xl bg-slate-100 p-1">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={range === r.id}
                onClick={() => setRange(r.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${range === r.id ? 'bg-white text-brand-700 shadow-sm' : 'text-muted'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="mb-2 flex flex-wrap gap-4 text-sm" aria-label="Légende">
          <li className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS.raw }} aria-hidden="true" /> Pesées
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-5 rounded" style={{ background: COLORS.avg }} aria-hidden="true" /> Moyenne sur 7 jours
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-5 rounded" style={{ background: COLORS.target }} aria-hidden="true" /> Objectif
          </li>
        </ul>
        {visible.length < 2 ? (
          <p className="rounded-xl bg-slate-50 p-6 text-center text-muted">La courbe apparaîtra dès ta deuxième pesée sur cette période.</p>
        ) : (
          <div className="h-72" role="img" aria-label={`Courbe du poids : de ${formatKg(visible[0].kg)} à ${formatKg(visible[visible.length - 1].kg)}, tendance actuelle ${formatKg(trend)}, objectif ${formatKg(settings.targetWeightKg)}. Le détail est dans l’historique ci-dessous.`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={visible} margin={{ top: 20, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(t: number) => new Date(t).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })}
                  tick={{ fill: COLORS.axis, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  domain={[yMin, yMax]}
                  ticks={yTicks}
                  tickFormatter={(v: number) => `${v} kg`}
                  tick={{ fill: COLORS.axis, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: COLORS.axis, strokeWidth: 1 }} />
                <ReferenceLine
                  y={settings.targetWeightKg}
                  stroke={COLORS.target}
                  strokeWidth={2}
                  label={{ value: `Objectif ${formatKg(settings.targetWeightKg)}`, position: 'insideTopLeft', fill: COLORS.axis, fontSize: 12 }}
                />
                <Scatter dataKey="kg" fill={COLORS.raw} stroke="#ffffff" strokeWidth={2} r={5} isAnimationActive={false} />
                <Line dataKey="avg7" stroke={COLORS.avg} strokeWidth={2} dot={false} strokeLinecap="round" strokeLinejoin="round" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card aria-labelledby="history-title">
        <h2 id="history-title" className="mb-3 text-lg font-bold">
          Historique
        </h2>
        {series.length === 0 ? (
          <p className="text-muted">Aucune pesée pour l’instant.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="py-2 font-semibold">Date</th>
                  <th scope="col" className="py-2 text-right font-semibold">Pesée</th>
                  <th scope="col" className="py-2 text-right font-semibold">Moyenne 7 j</th>
                  <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...series].reverse().map((p) => (
                  <tr key={p.date}>
                    <td className="py-2">{formatDate(p.date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</td>
                    <td className="py-2 text-right tabular-nums">{formatKg(p.kg)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-brand-700">{formatKg(p.avg7)}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => update((d) => removeWeighIn(d, activeProfile.id, p.date))}
                        className="rounded-lg p-1.5 text-muted hover:bg-slate-100 hover:text-ink"
                        aria-label={`Supprimer la pesée du ${formatDate(p.date)}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card aria-labelledby="faq-title">
        <h2 id="faq-title" className="mb-3 text-lg font-bold">
          Questions fréquentes
        </h2>
        <div className="flex flex-col divide-y divide-slate-100">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                {f.q}
                <ChevronDown size={18} aria-hidden="true" className="shrink-0 transition group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </Card>

      <WeighInDialog open={weighOpen} onClose={() => setWeighOpen(false)} />
    </div>
  )
}

function Stat({ label, value, detail, highlight }: { label: string; value: string; detail?: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`text-xl font-bold ${highlight ? 'text-brand-700' : ''}`}>{value}</dd>
      {detail && <dd className="text-xs text-muted">{detail}</dd>}
    </div>
  )
}

interface TooltipProps {
  active?: boolean
  payload?: { payload: { date: string; kg: number; avg7: number } }[]
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold">{formatDate(p.date, { weekday: 'short', day: 'numeric', month: 'long' })}</p>
      <p className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLORS.raw }} aria-hidden="true" /> Pesée : {formatKg(p.kg)}
      </p>
      <p className="flex items-center gap-2">
        <span className="inline-block h-0.5 w-3" style={{ background: COLORS.avg }} aria-hidden="true" /> Moyenne 7 j : {formatKg(p.avg7)}
      </p>
    </div>
  )
}

/** Saisie rapide sans ouvrir de fenêtre. */
function QuickWeighIn({ onSave }: { onSave: (date: string, kg: number) => void }) {
  const [kg, setKg] = useState('')
  const [date, setDate] = useState(todayIso())
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = parseNumber(kg)
    const c = checkWeight(v)
    if (!c.ok) return setError(c.message)
    if (date > todayIso()) return setError('La date ne peut pas être dans le futur.')
    onSave(date, Math.round(v * 10) / 10)
    setKg('')
    setError(undefined)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }
  return (
    <Card aria-labelledby="quick-title">
      <h2 id="quick-title" className="mb-3 text-lg font-bold">
        Nouvelle pesée
      </h2>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <Field label="Poids" value={kg} onChange={(v) => { setKg(v); setError(undefined) }} inputMode="decimal" suffix="kg" error={error} placeholder="ex. 78,4" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quick-date" className="text-sm font-semibold">
            Date
          </label>
          <input id="quick-date" type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-slate-200 px-3.5 py-2.5" />
        </div>
        <Button type="submit">Enregistrer</Button>
        <p className="min-h-5 text-sm text-brand-700" aria-live="polite">
          {saved ? 'Pesée enregistrée, tendance mise à jour.' : ''}
        </p>
      </form>
    </Card>
  )
}
