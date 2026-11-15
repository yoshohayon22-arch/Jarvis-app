/**
 * Saisie rapide d'une pesée (date + kg).
 * La date estimée d'objectif est recalculée automatiquement après l'enregistrement.
 */
import { useState, type FormEvent } from 'react'
import { Dialog } from '../../components/Dialog'
import { Button, Field } from '../../components/ui'
import { useAppData } from '../../state/AppDataContext'
import { upsertWeighIn } from '../../domain/profiles'
import { todayIso } from '../../domain/nutrition'
import { checkWeight } from '../../domain/safety'
import { parseNumber } from '../onboarding/draft'

export function WeighInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeProfile, update } = useAppData()
  const [kg, setKg] = useState('')
  const [date, setDate] = useState(todayIso())
  const [error, setError] = useState<string>()

  if (!activeProfile) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = parseNumber(kg)
    const check = checkWeight(value)
    if (!check.ok) return setError(check.message)
    if (date > todayIso()) return setError('La date ne peut pas être dans le futur.')
    update((d) => upsertWeighIn(d, activeProfile.id, { date, kg: Math.round(value * 10) / 10 }))
    setKg('')
    setError(undefined)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nouvelle pesée">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field
          label="Poids"
          value={kg}
          onChange={(v) => {
            setKg(v)
            setError(undefined)
          }}
          inputMode="decimal"
          suffix="kg"
          autoFocus
          error={error}
          hint="Idéalement le matin, à jeun, après être passé aux toilettes."
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="weigh-date" className="text-sm font-semibold">
            Date
          </label>
          <input
            id="weigh-date"
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-3.5 py-2.5"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>
    </Dialog>
  )
}
