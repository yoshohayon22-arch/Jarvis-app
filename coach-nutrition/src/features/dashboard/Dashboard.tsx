/**
 * Accueil en mode tableau de bord.
 * Phase 1 : besoins du jour, progression vers l'objectif, bouton « Peser ».
 * Les repas du jour (phase 3) et le coach complet (phase 5) viendront s'ajouter ici.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, MessageCircleHeart, Scale, Target } from 'lucide-react'
import { Button, Card, Pill } from '../../components/ui'
import { useAppData } from '../../state/AppDataContext'
import { computeTargets, todayIso } from '../../domain/nutrition'
import { latestWeight } from '../../domain/profiles'
import { progressPercent } from '../../domain/progress'
import { formatDate, formatKg } from '../../lib/format'
import { MacroBar } from '../onboarding/TargetsSummary'
import { WeighInDialog } from '../tracking/WeighInDialog'

export function Dashboard() {
  const { activeProfile } = useAppData()
  const [weighOpen, setWeighOpen] = useState(false)
  const [hour] = useState(() => new Date().getHours())

  const current = activeProfile ? latestWeight(activeProfile) : 0
  const targets = useMemo(
    () => (activeProfile ? computeTargets(activeProfile.settings, current) : null),
    [activeProfile, current],
  )
  if (!activeProfile || !targets) return null

  const { settings } = activeProfile
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calories du jour */}
        <Card className="lg:col-span-2" aria-labelledby="kcal-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="kcal-title" className="text-lg font-bold">
              Calories du jour
            </h2>
            <Pill>{{ perte: 'Perte douce', prise: 'Prise progressive', maintien: 'Maintien' }[targets.goal]}</Pill>
          </div>
          <p className="mb-4">
            <span className="text-4xl font-bold text-brand-700">{targets.targetKcal.toLocaleString('fr-CH')}</span>{' '}
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
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
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

        {/* Repas du jour — arrive en phase 3 */}
        <Card className="lg:col-span-2" aria-labelledby="meals-title">
          <h2 id="meals-title" className="mb-2 flex items-center gap-2 text-lg font-bold">
            <CalendarDays size={20} aria-hidden="true" className="text-brand-600" /> Repas du jour
          </h2>
          <p className="text-muted">
            Le menu de la semaine sera bientôt généré ici, selon tes {settings.mealsPerDay} repas par jour et tes
            préférences.
          </p>
          <Link to="/menu" className="mt-3 inline-block font-semibold text-brand-700 underline-offset-4 hover:underline">
            Voir le menu
          </Link>
        </Card>

        {/* Message du coach — version complète en phase 5 */}
        <Card aria-labelledby="coach-title" className="bg-gradient-to-br from-brand-50 to-white">
          <h2 id="coach-title" className="mb-2 flex items-center gap-2 text-lg font-bold">
            <MessageCircleHeart size={20} aria-hidden="true" className="text-accent-500" /> Message du coach
          </h2>
          <p>
            Bienvenue ! Pèse-toi une à deux fois par semaine, le matin, dans les mêmes conditions : c’est la tendance qui
            compte, pas le chiffre d’un jour.
          </p>
        </Card>
      </div>

      <WeighInDialog open={weighOpen} onClose={() => setWeighOpen(false)} />
    </div>
  )
}
