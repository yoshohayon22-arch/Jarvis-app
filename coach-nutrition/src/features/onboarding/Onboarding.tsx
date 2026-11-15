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
import { addProfile, createProfile } from '../../domain/profiles'
import { computeTargets } from '../../domain/nutrition'
import { HEALTH_DISCLAIMER } from '../../domain/safety'
import { draftToSettings, emptyDraft, parseNumber, STEP_IDS, validateStep, type Draft, type DraftErrors } from './draft'
import { StepFields } from './StepFields'
import { STEP_TITLES } from './options'
import { TargetsSummary } from './TargetsSummary'

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
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8 sm:py-12">
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
        <p className="mb-4 text-muted">
          Bienvenue ! En 2 minutes, on calcule tes besoins et on prépare la suite : menus, courses et suivi.
        </p>
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
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
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
            <StepFields step={step} draft={draft} set={set} errors={errors} />
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
    </div>
  )
}
