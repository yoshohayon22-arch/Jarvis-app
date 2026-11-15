/**
 * Assistant d'onboarding en plusieurs étapes.
 * Chaque étape est validée avant de passer à la suivante ; le dernier écran
 * affiche les besoins calculés avant de créer le profil.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Leaf } from 'lucide-react'
import { Button, Card } from '../../components/ui'
import { useAppData } from '../../state/AppDataContext'
import { addProfile, createProfile, upsertWeighIn } from '../../domain/profiles'
import { addDays, todayIso } from '../../domain/nutrition'
import { DEFAULT_SETTINGS } from '../../storage/migrations'
import { computeTargets } from '../../domain/nutrition'
import { HEALTH_DISCLAIMER } from '../../domain/safety'
import { draftToSettings, emptyDraft, parseNumber, STEP_IDS, validateStep, type Draft, type DraftErrors } from './draft'
import { StepFields } from './StepFields'
import { STEP_TITLES } from './options'
import { TargetsSummary } from './TargetsSummary'
import { ImportError } from '../../storage/storage'

export function Onboarding() {
  const { data, update } = useAppData()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [index, setIndex] = useState(0)
  const [errors, setErrors] = useState<DraftErrors>({})
  const headingRef = useRef<HTMLHeadingElement>(null)

  const step = STEP_IDS[index]
  const isLast = index === STEP_IDS.length - 1
  const isFirstProfile = data.profiles.length === 0

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    // On efface l'erreur d'un champ dès qu'il est modifié.
    setErrors((e) => {
      const next = { ...e }
      for (const k of Object.keys(patch)) delete next[k as keyof Draft]
      return next
    })
  }

  const settings = useMemo(() => (step === 'recapitulatif' ? draftToSettings(draft) : null), [draft, step])
  const targets = useMemo(
    () => (settings ? computeTargets(settings, parseNumber(draft.weightKg)) : null),
    [settings, draft.weightKg],
  )

  // À chaque changement d'étape, le focus va sur le titre (lecteurs d'écran / clavier).
  // Fait juste après l'affichage, pour ne jamais voler le focus d'un champ en cours de saisie.
  const focusHeading = useRef(false)
  useEffect(() => {
    if (!focusHeading.current) return
    focusHeading.current = false
    headingRef.current?.focus()
  }, [index])

  const goTo = (i: number) => {
    focusHeading.current = true
    setIndex(i)
    setErrors({})
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const stepErrors = validateStep(step, draft)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    if (!isLast) return goTo(index + 1)
    const profile = createProfile(draft.name, draftToSettings(draft))
    update((d) => addProfile(d, profile))
    navigate('/')
  }

  const { title, subtitle } = STEP_TITLES[step]
  const progress = ((index + 1) / STEP_IDS.length) * 100

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8 sm:py-12">
      <header className="mb-6 flex items-center gap-2 text-brand-700">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Leaf size={20} aria-hidden="true" />
        </span>
        <span className="text-lg font-bold">Coach Nutrition</span>
        {!isFirstProfile && (
          <Button variant="ghost" className="ml-auto" onClick={() => navigate('/')}>
            Annuler
          </Button>
        )}
      </header>

      {index === 0 && isFirstProfile && (
        <div className="mb-4 flex flex-col gap-2">
          <p className="text-muted">
            Bienvenue ! En 2 minutes, on calcule tes besoins et on prépare la suite : menus, courses et suivi.
          </p>
          <ImportBackup />
          {import.meta.env.VITE_DEMO === '1' && <DemoProfile />}
        </div>
      )}

      <div className="mb-2 flex items-center justify-between text-sm text-muted">
        <span>
          Étape {index + 1} sur {STEP_IDS.length}
        </span>
      </div>
      <div
        className="mb-6 h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label="Progression du formulaire"
        aria-valuemin={1}
        aria-valuemax={STEP_IDS.length}
        aria-valuenow={index + 1}
      >
        <div className="bar-fill h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
      </div>

      <Card as="div">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <div>
            <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
              {title}
            </h1>
            <p className="text-muted">{subtitle}</p>
          </div>

          {step === 'recapitulatif' && targets && settings ? (
            <TargetsSummary
              targets={targets}
              sex={settings.sex}
              currentWeightKg={parseNumber(draft.weightKg)}
              targetWeightKg={settings.targetWeightKg}
            />
          ) : (
            <div key={step} className="animate-slide-in-right">
              <StepFields step={step} draft={draft} set={set} errors={errors} />
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <Button variant="secondary" onClick={() => goTo(index - 1)} disabled={index === 0}>
              <ArrowLeft size={16} aria-hidden="true" /> Retour
            </Button>
            <Button type="submit">
              {isLast ? (
                <>
                  <Check size={16} aria-hidden="true" /> Créer mon profil
                </>
              ) : (
                <>
                  Continuer <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      <p className="mt-6 text-center text-xs text-muted">{HEALTH_DISCLAIMER}</p>
    </main>
  )
}

/** Nouvel ordinateur ou navigateur vidé : on peut repartir d'un fichier de sauvegarde. */
function ImportBackup() {
  const { storage, replaceAll } = useAppData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="text-sm">
      <button type="button" onClick={() => fileRef.current?.click()} className="font-semibold text-brand-700 underline underline-offset-4">
        J’ai déjà une sauvegarde : importer mon fichier
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Fichier de sauvegarde à importer"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            replaceAll(storage.importJson(await f.text()))
          } catch (err) {
            setError(err instanceof ImportError ? err.message : 'Impossible de lire ce fichier.')
          }
        }}
      />
      {error && (
        <p role="alert" className="mt-1 text-accent-800">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Version de démonstration uniquement : crée un profil « Exemple » avec 5 semaines de pesées
 * (données fictives, clairement nommées), pour explorer tous les écrans sans rien saisir.
 */
function DemoProfile() {
  const { update } = useAppData()
  const create = () => {
    const today = todayIso()
    const start = addDays(today, -35)
    const settings = { ...DEFAULT_SETTINGS, sex: 'homme' as const, age: 34, heightCm: 178, startWeightKg: 86.4, targetWeightKg: 78, activityLevel: 3 as const, mealsPerDay: 4 as const, weeklyBudgetChf: 90 }
    const profile = createProfile('Exemple', settings, new Date(`${start}T08:00:00`))
    update((d) => {
      let next = addProfile(d, profile)
      for (let i = 2; i <= 35; i += 2) {
        const noise = [0.4, -0.3, 0.5, -0.4, 0.1, -0.2][i % 6]
        next = upsertWeighIn(next, profile.id, { date: addDays(start, i), kg: Math.round((86.4 - (0.5 * i) / 7 + noise) * 10) / 10 })
      }
      return next
    })
  }
  return (
    <button type="button" onClick={create} className="self-start rounded-xl bg-accent-100 px-3 py-2 text-sm font-semibold text-accent-800 hover:bg-accent-200">
      Explorer avec un profil d’exemple (données fictives)
    </button>
  )
}
