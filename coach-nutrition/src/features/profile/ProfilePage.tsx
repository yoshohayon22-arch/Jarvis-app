/**
 * Écran Profil : modifier ses informations, voir ses besoins recalculés,
 * sauvegarder ses données (export / import) et tout effacer.
 */
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Save, Trash2, Upload, UserMinus } from 'lucide-react'
import { Button, Card, Notice } from '../../components/ui'
import { Dialog } from '../../components/Dialog'
import { useAppData } from '../../state/AppDataContext'
import { latestWeight, removeProfile, updateProfile, upsertWeighIn } from '../../domain/profiles'
import { computeTargets, todayIso } from '../../domain/nutrition'
import { ImportError } from '../../storage/storage'
import {
  draftToSettings,
  isComputable,
  parseNumber,
  settingsToDraft,
  STEP_IDS,
  validateAll,
  type Draft,
  type DraftErrors,
} from '../onboarding/draft'
import { StepFields } from '../onboarding/StepFields'
import { STEP_TITLES } from '../onboarding/options'
import { TargetsSummary } from '../onboarding/TargetsSummary'

export function ProfilePage() {
  const { activeProfile } = useAppData()
  if (!activeProfile) return null
  // La clé force la réinitialisation du formulaire quand on change de profil.
  return <ProfileEditor key={activeProfile.id} />
}

function ProfileEditor() {
  const { data, activeProfile, update, replaceAll, clearAll, storage } = useAppData()
  const navigate = useNavigate()
  const profile = activeProfile!
  const current = latestWeight(profile)
  const [draft, setDraft] = useState<Draft>(() => settingsToDraft(profile.name, profile.settings, current))
  const [errors, setErrors] = useState<DraftErrors>({})
  const [saved, setSaved] = useState(false)
  const [confirm, setConfirm] = useState<null | 'profil' | 'tout'>(null)
  const [importMsg, setImportMsg] = useState<{ tone: 'success' | 'attention'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setSaved(false)
    setErrors((e) => {
      const next = { ...e }
      for (const k of Object.keys(patch)) delete next[k as keyof Draft]
      return next
    })
  }

  // Aperçu des besoins recalculés en direct pendant la modification.
  const preview = useMemo(() => {
    if (!isComputable(draft)) return null
    const settings = draftToSettings(draft, profile.settings)
    return { settings, targets: computeTargets(settings, parseNumber(draft.weightKg)) }
  }, [draft, profile.settings])

  const save = () => {
    const e = validateAll(draft)
    if (Object.keys(e).length) {
      setErrors(e)
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    const settings = draftToSettings(draft, profile.settings)
    const newWeight = Math.round(parseNumber(draft.weightKg) * 10) / 10
    update((d) => {
      let next = updateProfile(d, profile.id, { name: draft.name, settings })
      // Si le poids a changé, on l'enregistre comme une pesée du jour.
      if (newWeight !== current) next = upsertWeighIn(next, profile.id, { date: todayIso(), kg: newWeight })
      return next
    })
    setSaved(true)
  }

  const exportData = () => {
    const blob = new Blob([storage.exportJson(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `coach-nutrition-${todayIso()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importData = async (file: File) => {
    try {
      const imported = storage.importJson(await file.text())
      replaceAll(imported)
      setImportMsg({ tone: 'success', text: `${imported.profiles.length} profil(s) importé(s).` })
    } catch (err) {
      setImportMsg({
        tone: 'attention',
        text: err instanceof ImportError ? err.message : 'Impossible de lire ce fichier.',
      })
    }
  }

  const editableSteps = STEP_IDS.filter((s) => s !== 'recapitulatif')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold">Profil</h1>
        <Button onClick={save}>
          <Save size={18} aria-hidden="true" /> Enregistrer
        </Button>
      </div>
      {saved && <Notice tone="success">Profil enregistré, tes besoins ont été recalculés.</Notice>}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="flex flex-col gap-6 lg:col-span-3">
          {editableSteps.map((step) => (
            <Card key={step} aria-labelledby={`sec-${step}`}>
              <h2 id={`sec-${step}`} className="mb-4 text-lg font-bold">
                {STEP_TITLES[step].title}
              </h2>
              <StepFields step={step} draft={draft} set={set} errors={errors} editMode />
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card aria-labelledby="needs-title" className="lg:sticky lg:top-24">
            <h2 id="needs-title" className="mb-4 text-lg font-bold">
              Tes besoins
            </h2>
            {preview ? (
              <TargetsSummary
                targets={preview.targets}
                sex={preview.settings.sex}
                currentWeightKg={parseNumber(draft.weightKg)}
                targetWeightKg={preview.settings.targetWeightKg}
              />
            ) : (
              <p className="text-muted">Complète les champs pour voir tes besoins.</p>
            )}
          </Card>

          <Card aria-labelledby="data-title">
            <h2 id="data-title" className="mb-1 text-lg font-bold">
              Mes données
            </h2>
            <p className="mb-4 text-sm text-muted">
              Tout est stocké uniquement dans ce navigateur. Exporte régulièrement un fichier de sauvegarde pour ne rien
              perdre (changement d’ordinateur, nettoyage du navigateur).
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="secondary" onClick={exportData}>
                <Download size={18} aria-hidden="true" /> Exporter mes données
              </Button>
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload size={18} aria-hidden="true" /> Importer
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                aria-label="Fichier de sauvegarde à importer"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void importData(f)
                  e.target.value = ''
                }}
              />
              {importMsg && <Notice tone={importMsg.tone}>{importMsg.text}</Notice>}
              <hr className="my-2 border-slate-100" />
              <Button variant="warning" onClick={() => setConfirm('profil')}>
                <UserMinus size={18} aria-hidden="true" /> Supprimer ce profil
              </Button>
              <Button variant="warning" onClick={() => setConfirm('tout')}>
                <Trash2 size={18} aria-hidden="true" /> Tout effacer
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'tout' ? 'Tout effacer ?' : `Supprimer le profil « ${profile.name} » ?`}
      >
        <p className="text-sm">
          {confirm === 'tout'
            ? 'Tous les profils, pesées et menus enregistrés dans ce navigateur seront supprimés. Pense à exporter tes données avant, si tu veux les garder.'
            : 'Les informations et pesées de ce profil seront supprimées de ce navigateur.'}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirm(null)} autoFocus>
            Annuler
          </Button>
          <Button
            variant="warning"
            onClick={() => {
              if (confirm === 'tout') clearAll()
              else update((d) => removeProfile(d, profile.id))
              setConfirm(null)
              navigate('/')
            }}
          >
            Oui, supprimer
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
