/** Écran provisoire pour les sections qui arrivent dans les prochaines phases. */
import { Hammer } from 'lucide-react'
import { Card } from '../components/ui'

export function ComingSoon({ title, phase, description }: { title: string; phase: number; description: string }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">{title}</h1>
      <Card className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent-700">
          <Hammer size={22} aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">En préparation (phase {phase})</p>
          <p className="text-muted">{description}</p>
        </div>
      </Card>
    </div>
  )
}
