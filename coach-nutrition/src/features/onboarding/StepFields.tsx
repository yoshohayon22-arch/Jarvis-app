/**
 * Contenu de chaque étape du formulaire de profil.
 * Réutilisé tel quel par l'assistant d'onboarding et par l'écran Profil.
 */
import { useId, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { ACTIVITY_LEVELS, computeBmi, weightForBmi } from '../../domain/nutrition'
import type { DayOfWeek, KosherWaitHours, MealsPerDay, Restriction } from '../../domain/types'
import { ChoiceGroup, Field, Notice, Toggle } from '../../components/ui'
import { describeGoal, parseNumber, type Draft, type DraftErrors, type StepId } from './draft'
import { DAYS, KOSHER_WAIT_OPTIONS, MEAL_OPTIONS, RESTRICTION_OPTIONS } from './options'

interface StepProps {
  step: StepId
  draft: Draft
  set: (patch: Partial<Draft>) => void
  errors: DraftErrors
  /** Masque des champs qui n'ont pas de sens en édition (ex. le nom est géré ailleurs). */
  editMode?: boolean
}

export function StepFields({ step, draft, set, errors, editMode }: StepProps) {
  switch (step) {
    case 'identite':
      return (
        <div className="flex flex-col gap-5">
          <Field
            label="Nom du profil"
            value={draft.name}
            onChange={(name) => set({ name })}
            hint="Ton prénom, par exemple. Utile si plusieurs personnes utilisent l’app sur cet ordinateur."
            error={errors.name}
            autoFocus={!editMode}
          />
          <ChoiceGroup
            legend="Sexe"
            hint="Utilisé uniquement par la formule de calcul du métabolisme."
            options={[
              { value: 'femme', label: 'Femme' },
              { value: 'homme', label: 'Homme' },
            ]}
            value={draft.sex ?? ('' as never)}
            onChange={(sex) => set({ sex: sex as Draft['sex'] })}
            error={errors.sex}
          />
          <Field
            label="Âge"
            value={draft.age}
            onChange={(age) => set({ age })}
            inputMode="numeric"
            suffix="ans"
            error={errors.age}
          />
        </div>
      )

    case 'mensurations':
      return (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Taille"
            value={draft.heightCm}
            onChange={(heightCm) => set({ heightCm })}
            inputMode="numeric"
            suffix="cm"
            placeholder="ex. 172"
            error={errors.heightCm}
          />
          <Field
            label={editMode ? 'Poids actuel' : 'Poids actuel'}
            value={draft.weightKg}
            onChange={(weightKg) => set({ weightKg })}
            inputMode="decimal"
            suffix="kg"
            placeholder="ex. 72,5"
            hint={editMode ? 'Une modification ajoute une pesée à la date du jour.' : 'Le matin à jeun, c’est le plus fiable.'}
            error={errors.weightKg}
          />
        </div>
      )

    case 'objectif': {
      const h = parseNumber(draft.heightCm)
      const t = parseNumber(draft.targetWeightKg)
      const bmi = Number.isFinite(h) && Number.isFinite(t) ? computeBmi(t, h) : null
      const healthyRange = Number.isFinite(h)
        ? `${(Math.ceil(weightForBmi(18.5, h) * 10) / 10).toLocaleString('fr-CH')} à ${(
            Math.floor(weightForBmi(25, h) * 10) / 10
          ).toLocaleString('fr-CH')} kg`
        : null
      const goal = describeGoal(draft)
      return (
        <div className="flex flex-col gap-5">
          <Field
            label="Poids cible"
            value={draft.targetWeightKg}
            onChange={(targetWeightKg) => set({ targetWeightKg })}
            inputMode="decimal"
            suffix="kg"
            hint={healthyRange ? `Repère santé (IMC 18,5 à 25) pour ta taille : ${healthyRange}.` : undefined}
            error={errors.targetWeightKg}
          />
          {bmi !== null && !errors.targetWeightKg && goal && (
            <Notice tone="success">
              {goal} IMC visé : {bmi.toFixed(1).replace('.', ',')}.
            </Notice>
          )}
        </div>
      )
    }

    case 'activite':
      return (
        <ChoiceGroup
          legend="Niveau d’activité"
          columns={1}
          options={ACTIVITY_LEVELS.map((a) => ({
            value: a.level,
            label: `${a.level}. ${a.label}`,
            description: a.example,
          }))}
          value={draft.activityLevel ?? (0 as never)}
          onChange={(v) => set({ activityLevel: v as Draft['activityLevel'] })}
          error={errors.activityLevel}
        />
      )

    case 'repas':
      return (
        <ChoiceGroup
          legend="Nombre de repas par jour"
          columns={3}
          options={MEAL_OPTIONS}
          value={draft.mealsPerDay}
          onChange={(v) => set({ mealsPerDay: v as MealsPerDay })}
        />
      )

    case 'restrictions':
      return (
        <div className="flex flex-col gap-6">
          <ChoiceGroup
            legend="Restrictions alimentaires"
            hint="Le générateur de menus les respectera strictement. Plusieurs choix possibles."
            multiple
            options={RESTRICTION_OPTIONS}
            value={draft.restrictions}
            onChange={(v) => set({ restrictions: v as Restriction[] })}
          />
          {draft.restrictions.includes('casher') && (
            <div className="flex flex-col gap-4 rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
              <p className="font-semibold">Options casher</p>
              <ChoiceGroup
                legend="Délai après un repas bassari (viande) avant du halavi (lait)"
                columns={2}
                options={KOSHER_WAIT_OPTIONS}
                value={draft.kosherWait}
                onChange={(v) => set({ kosherWait: v as KosherWaitHours })}
              />
              <Toggle
                label="Ne pas mélanger poisson et viande"
                description="Jamais de poisson et de viande dans un même plat."
                checked={draft.separateFishAndMeat}
                onChange={(separateFishAndMeat) => set({ separateFishAndMeat })}
              />
            </div>
          )}
          <DislikedFoodsInput value={draft.dislikedFoods} onChange={(dislikedFoods) => set({ dislikedFoods })} />
        </div>
      )

    case 'organisation':
      return (
        <div className="flex flex-col gap-5">
          <Field
            label="Budget courses par semaine (facultatif)"
            value={draft.weeklyBudgetChf}
            onChange={(weeklyBudgetChf) => set({ weeklyBudgetChf })}
            inputMode="decimal"
            suffix="CHF"
            placeholder="ex. 90"
            hint="Pour une personne. On comparera le coût du menu à ce montant."
            error={errors.weeklyBudgetChf}
          />
          <Toggle
            label="Mode petit budget"
            description="Priorité aux légumineuses, œufs, flocons d’avoine, légumes de saison et marques M-Budget, Prix Garantie, Lidl, Aldi."
            checked={draft.lowBudget}
            onChange={(lowBudget) => set({ lowBudget })}
          />
          <Toggle
            label="Batch cooking"
            description="Cuisiner en grande quantité 1 à 3 fois par semaine, puis assembler les repas."
            checked={draft.batchEnabled}
            onChange={(batchEnabled) => set({ batchEnabled })}
          />
          {draft.batchEnabled && (
            <ChoiceGroup
              legend="Jours de cuisine (1 à 3)"
              multiple
              columns={3}
              options={DAYS}
              value={draft.batchDays}
              onChange={(v) => set({ batchDays: v as DayOfWeek[] })}
              error={errors.batchDays}
            />
          )}
        </div>
      )

    default:
      return null
  }
}

/** Saisie libre des aliments détestés, sous forme d'étiquettes supprimables. */
function DislikedFoodsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState('')
  const id = useId()
  const add = () => {
    const items = text
      .split(/[,;]/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s && !value.includes(s))
    if (items.length) onChange([...value, ...items])
    setText('')
  }
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        Aliments que tu n’aimes pas
      </label>
      <p className="text-xs text-muted" id={`${id}-hint`}>
        Tape un aliment puis Entrée (ou sépare par des virgules). Ex. : coriandre, champignons.
      </p>
      <div className="flex gap-2">
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          aria-describedby={`${id}-hint`}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-xl bg-brand-50 px-3 font-semibold text-brand-700 hover:bg-brand-100"
        >
          <Plus size={16} aria-hidden="true" /> Ajouter
        </button>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Aliments exclus">
          {value.map((food) => (
            <li key={food}>
              <button
                type="button"
                onClick={() => onChange(value.filter((f) => f !== food))}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm hover:bg-slate-200"
                aria-label={`Retirer ${food}`}
              >
                {food} <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
