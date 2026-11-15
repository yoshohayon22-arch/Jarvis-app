/**
 * Carte « Message du coach » : message principal + autres conseils, avec actions
 * (se peser, passer au maintien, recalculer les besoins).
 */
import { useMemo, useState } from 'react'
import { MessageCircleHeart, PartyPopper, RefreshCw, Scale, ShieldAlert, Sparkles } from 'lucide-react'
import { coachMessages, type CoachMessage } from '../../domain/coach'
import { computeTargets, todayIso } from '../../domain/nutrition'
import { referenceWeightFor, updateProfile } from '../../domain/profiles'
import { Button, Card } from '../../components/ui'
import { MiaAvatar } from '../../components/Mia'
import { Celebrate } from '../../components/Celebrate'
import { useAppData } from '../../state/AppDataContext'
import { useMenu } from '../menu/useMenu'

const TONE = {
  info: { cls: 'from-brand-50', icon: MessageCircleHeart, iconCls: 'text-accent-500' },
  success: { cls: 'from-brand-100', icon: PartyPopper, iconCls: 'text-brand-600' },
  attention: { cls: 'from-accent-50', icon: ShieldAlert, iconCls: 'text-accent-600' },
} as const

export function CoachCard({ onWeigh, className = '' }: { onWeigh: () => void; className?: string }) {
  const { activeProfile, update } = useAppData()
  const { plan, refit } = useMenu()
  const [notice, setNotice] = useState<string | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const today = todayIso()
  const messages = useMemo(
    () => (activeProfile ? coachMessages(activeProfile.name, activeProfile.settings, activeProfile.weighIns, today) : []),
    [activeProfile, today],
  )
  if (!activeProfile || messages.length === 0) return null
  const [main, ...others] = messages
  const tone = TONE[main.tone]
  const Icon = tone.icon

  const runAction = (m: CoachMessage) => {
    if (m.action === 'peser') onWeigh()
    if (m.action === 'maintien') {
      update((d) => updateProfile(d, activeProfile.id, { settings: { ...activeProfile.settings, maintenanceMode: true } }))
      setCelebrate(true)
      setNotice('Plan de maintien activé : tes calories sont maintenant égales à ta dépense. Pense à adapter ton menu (écran Menu).')
    }
    if (m.action === 'recalcul') {
      const t = computeTargets(activeProfile.settings, referenceWeightFor(activeProfile))
      if (plan) refit()
      setNotice(
        `Besoins recalculés avec ton poids actuel (${referenceWeightFor(activeProfile).toLocaleString('fr-CH')} kg) : ${t.targetKcal.toLocaleString('fr-CH')} kcal par jour${plan ? ', portions du menu ajustées' : ''}.`,
      )
    }
  }

  const actionLabel = { peser: 'Me peser', maintien: 'Passer au maintien', recalcul: 'Recalculer mes besoins' } as const
  const ActionIcon = { peser: Scale, maintien: Sparkles, recalcul: RefreshCw } as const

  return (
    <Card aria-labelledby="coach-title" className={`relative overflow-hidden bg-gradient-to-br ${tone.cls} to-white ${className}`}>
      {(main.situation === 'objectif-atteint' || celebrate) && <Celebrate key={celebrate ? 'maintien' : 'objectif'} />}
      <div className="flex items-start gap-3">
        <MiaAvatar key={main.situation} size={52} className="animate-hop" />
        <div className="min-w-0">
          <h2 id="coach-title" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <Icon size={16} aria-hidden="true" className={tone.iconCls} /> Mia, ta coach
          </h2>
          <p className="text-lg font-bold" aria-live="polite">{main.title}</p>
        </div>
      </div>
      <div aria-live="polite">
        <p className="mt-2">{main.text}</p>
        {main.action && (
          <ActionButton label={actionLabel[main.action]} Icon={ActionIcon[main.action]} onClick={() => runAction(main)} />
        )}
        {notice && <p className="animate-pop-in mt-3 rounded-xl bg-white/70 p-3 text-sm text-brand-900">{notice}</p>}
      </div>
      {others.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 text-sm">
          {others.slice(0, 2).map((m) => (
            <li key={m.situation}>
              <strong>{m.title}</strong> — {m.text}
              {m.action && (
                <button type="button" onClick={() => runAction(m)} className="ml-1 font-semibold text-brand-700 underline">
                  {actionLabel[m.action]}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ActionButton({ label, Icon, onClick }: { label: string; Icon: typeof Scale; onClick: () => void }) {
  return (
    <Button variant="secondary" className="mt-3" onClick={onClick}>
      <Icon size={16} aria-hidden="true" /> {label}
    </Button>
  )
}
