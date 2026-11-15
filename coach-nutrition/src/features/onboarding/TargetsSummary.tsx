/**
 * Affichage des besoins calculés : calories, macros, rythme, date estimée.
 * Utilisé à la fin de l'onboarding, sur l'accueil et sur le profil.
 */
import { CalendarCheck, Flame, Gauge, TrendingDown, TrendingUp } from 'lucide-react'
import type { NutritionTargets } from '../../domain/types'
import { CALORIE_FLOOR } from '../../domain/nutrition'
import { Notice } from '../../components/ui'
import { formatDate, formatKg } from '../../lib/format'

export function MacroBar({ targets }: { targets: NutritionTargets }) {
  const { proteinG, fatG, carbsG } = targets.macros
  const total = proteinG * 4 + fatG * 9 + carbsG * 4 || 1
  const items = [
    { label: 'Protéines', grams: proteinG, kcal: proteinG * 4, color: 'bg-brand-600' },
    { label: 'Glucides', grams: carbsG, kcal: carbsG * 4, color: 'bg-accent-400' },
    { label: 'Lipides', grams: fatG, kcal: fatG * 9, color: 'bg-sky-500' },
  ]
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        {items.map((i) => (
          <div key={i.label} className={i.color} style={{ width: `${(i.kcal / total) * 100}%` }} />
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {items.map((i) => (
          <div key={i.label} className="rounded-xl bg-slate-50 p-2">
            <dt className="flex items-center justify-center gap-1.5 text-xs text-muted">
              <span className={`inline-block h-2 w-2 rounded-full ${i.color}`} aria-hidden="true" />
              {i.label}
            </dt>
            <dd className="text-lg font-bold">{i.grams} g</dd>
            <dd className="text-xs text-muted">{Math.round((i.kcal / total) * 100)} %</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function TargetsSummary({
  targets,
  sex,
  currentWeightKg,
  targetWeightKg,
}: {
  targets: NutritionTargets
  sex: 'homme' | 'femme'
  currentWeightKg: number
  targetWeightKg: number
}) {
  const goalLabel = { perte: 'Perte de poids', prise: 'Prise de poids', maintien: 'Maintien' }[targets.goal]
  const weekly = Math.abs(targets.expectedWeeklyChangeKg)
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={<Flame size={18} aria-hidden="true" />}
          label="Calories par jour"
          value={`${targets.targetKcal.toLocaleString('fr-CH')} kcal`}
          highlight
        />
        <Stat
          icon={<Gauge size={18} aria-hidden="true" />}
          label="Dépense totale (TDEE)"
          value={`${targets.tdee.toLocaleString('fr-CH')} kcal`}
          detail={`Métabolisme de base : ${targets.bmr.toLocaleString('fr-CH')} kcal`}
        />
        <Stat
          icon={
            targets.goal === 'prise' ? (
              <TrendingUp size={18} aria-hidden="true" />
            ) : (
              <TrendingDown size={18} aria-hidden="true" />
            )
          }
          label={goalLabel}
          value={targets.goal === 'maintien' ? 'Stable' : `≈ ${formatKg(weekly)} / sem.`}
          detail={
            targets.goal === 'maintien'
              ? 'Calories = dépense totale'
              : `${targets.adjustmentKcal > 0 ? '+' : '−'}${Math.abs(targets.adjustmentKcal)} kcal/jour`
          }
        />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Répartition des macronutriments</h3>
        <MacroBar targets={targets} />
        <p className="mt-2 text-xs text-muted">
          Protéines et lipides calculés sur {formatKg(targets.referenceWeightKg)}
          {targets.referenceWeightKg < currentWeightKg - 0.1 && ' (poids de référence à IMC 25, plus réaliste)'}.
        </p>
      </div>

      {targets.goal !== 'maintien' && (
        <div className="flex items-center gap-3 rounded-xl bg-brand-50 p-4 text-brand-900">
          <CalendarCheck size={22} aria-hidden="true" className="shrink-0" />
          {targets.estimatedGoalDate ? (
            <p>
              Objectif de <strong>{formatKg(targetWeightKg)}</strong> estimé vers le{' '}
              <strong>{formatDate(targets.estimatedGoalDate)}</strong>. La date sera recalculée à chaque pesée.
            </p>
          ) : (
            <p>Le rythme est trop doux pour estimer une date fiable : on suivra ta tendance réelle.</p>
          )}
        </div>
      )}

      {targets.floorApplied && (
        <Notice tone="attention" title="Plancher de sécurité appliqué">
          Pour ton profil, on ne descend pas sous {CALORIE_FLOOR[sex].toLocaleString('fr-CH')} kcal par jour : en
          dessous, il devient difficile de couvrir tes besoins en vitamines et minéraux. Le rythme sera un peu plus
          lent, mais plus durable. Bouger un peu plus (marche, vélo) est une bonne façon d’avancer.
        </Notice>
      )}
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  detail,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail?: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-2xl p-4 ${highlight ? 'bg-brand-600 text-white' : 'bg-slate-50'}`}>
      <p className={`flex items-center gap-1.5 text-xs font-medium ${highlight ? 'text-brand-50' : 'text-muted'}`}>
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {detail && <p className={`text-xs ${highlight ? 'text-brand-50' : 'text-muted'}`}>{detail}</p>}
    </div>
  )
}
