/**
 * Accueil en mode tableau de bord : calories du jour, progression vers l'objectif,
 * repas du jour, message du coach et bouton « Peser ».
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Scale, Target } from 'lucide-react'
import { Button, Card, Pill } from '../../components/ui'
import { useAppData } from '../../state/AppDataContext'
import { computeTargets, todayIso } from '../../domain/nutrition'
import { referenceWeightFor } from '../../domain/profiles'
import { CoachCard } from '../coach/CoachCard'
import { TrendCard } from '../tracking/TrendCard'
import { CountUp } from '../../components/CountUp'
import { progressPercent } from '../../domain/progress'
import { RECIPE_MAP } from '../../domain/catalog'
import { planLookup } from '../../domain/menu/generator'
import { SLOT_LABELS } from '../../domain/menu/slots'
import { formatDate, formatKg } from '../../lib/format'
import { MacroBar } from '../onboarding/TargetsSummary'
import { WeighInDialog } from '../tracking/WeighInDialog'

export function Dashboard() {
  const { activeProfile } = useAppData()
  const [weighOpen, setWeighOpen] = useState(false)
  const [hour] = useState(() => new Date().getHours())

  const current = activeProfile ? referenceWeightFor(activeProfile) : 0
  const targets = useMemo(
    () => (activeProfile ? computeTargets(activeProfile.settings, current) : null),
    [activeProfile, current],
  )
  if (!activeProfile || !targets) return null

  const { settings } = activeProfile
  const todayPlan = activeProfile.menu?.days.find((d) => d.date === todayIso())
  const pct = progressPercent(settings.startWeightKg, current, settings.targetWeightKg)
  const hello = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{formatDate(todayIso(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-3xl font-bold">
            {hello}, {activeProfile.name} !
          </h1>
        </div>
        <Button onClick={() => setWeighOpen(true)}>
          <Scale size={18} aria-hidden="true" /> Peser
        </Button>
      </div>

      <div className="stagger grid gap-6 lg:grid-cols-3">
        {/* Calories du jour */}
        <Card className="lg:col-span-2" aria-labelledby="kcal-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="kcal-title" className="text-lg font-bold">
              Calories du jour
            </h2>
            <Pill>{{ perte: 'Perte douce', prise: 'Prise progressive', maintien: 'Maintien' }[targets.goal]}</Pill>
          </div>
          <p className="mb-4">
            <CountUp className="text-4xl font-bold tabular-nums text-brand-700" value={targets.targetKcal} />{' '}
            <span className="text-muted">kcal visées aujourd’hui</span>
          </p>
          <MacroBar targets={targets} />
        </Card>

        {/* Progression */}
        <Card aria-labelledby="progress-title">
          <h2 id="progress-title" className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Target size={20} aria-hidden="true" className="text-brand-600" /> Progression
          </h2>
          {targets.goal === 'maintien' && settings.maintenanceMode ? (
            <p>Objectif atteint, bravo ! Tu es maintenant en plan de maintien.</p>
          ) : (
            <>
              <div
                className="h-3 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-label="Chemin parcouru vers l’objectif"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
              >
                <div className="bar-fill h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-sm font-semibold">{pct} % du chemin parcouru</p>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <dt className="text-muted">Départ</dt>
                  <dd className="font-bold">{formatKg(settings.startWeightKg)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Actuel</dt>
                  <dd className="font-bold text-brand-700">{formatKg(current)}</dd>
                  <dd className="text-xs text-muted">moy. 7 jours</dd>
                </div>
                <div>
                  <dt className="text-muted">Cible</dt>
                  <dd className="font-bold">{formatKg(settings.targetWeightKg)}</dd>
                </div>
              </dl>
              {targets.estimatedGoalDate && (
                <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
                  Date estimée : <strong>{formatDate(targets.estimatedGoalDate)}</strong>
                </p>
              )}
            </>
          )}
        </Card>

        {/* Repas du jour, tirés du menu de la semaine */}
        <Card className="lg:col-span-2" aria-labelledby="meals-title">
          <h2 id="meals-title" className="mb-3 flex items-center gap-2 text-lg font-bold">
            <CalendarDays size={20} aria-hidden="true" className="text-brand-600" /> Repas du jour
          </h2>
          {todayPlan ? (
            <ul className="divide-y divide-slate-100">
              {todayPlan.meals.map((m) => {
                const r = planLookup(activeProfile.menu!, RECIPE_MAP.values()).get(m.recipeId)
                if (!r) return null
                return (
                  <li key={m.slot} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{SLOT_LABELS[m.slot]}</p>
                      <p className="truncate font-semibold">{r.name}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-brand-700">
                      {Math.round(r.perServing.kcal * m.portions)} kcal
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-muted">
              {activeProfile.menu
                ? 'Pas de menu prévu pour aujourd’hui : génère celui de la semaine.'
                : `Génère ton menu de la semaine, calé sur tes ${settings.mealsPerDay} repas par jour et tes préférences.`}
            </p>
          )}
          <Link to="/menu" className="mt-3 inline-block font-semibold text-brand-700 underline-offset-4 hover:underline">
            {todayPlan ? 'Voir le menu de la semaine' : 'Aller au menu'}
          </Link>
          <Link to="/menu" state={{ tab: 'idee' }} className="ml-4 mt-3 inline-block font-semibold text-brand-700 underline-offset-4 hover:underline">
            Envie d’autre chose ? Juste un repas
          </Link>
        </Card>

        {/* Mini-courbe des 4 dernières semaines */}
        <TrendCard weighIns={activeProfile.weighIns} targetKg={settings.targetWeightKg} />

        {/* Mia, la coach (règles : plateau, rythme, régularité, objectif, rappel) */}
        <CoachCard className="lg:col-span-3" onWeigh={() => setWeighOpen(true)} />
      </div>

      <WeighInDialog open={weighOpen} onClose={() => setWeighOpen(false)} />
    </div>
  )
}
