/**
 * Onglet « Techniques » : des méthodes de nutrition reconnues (assiette équilibrée suisse,
 * méditerranéen, riche en protéines, jeûne 16:8), expliquées simplement, avec des repas adaptés
 * au profil. « Appliquer à mon menu » oriente la génération de la semaine (une technique à la fois).
 */
import { useState } from 'react'
import { Check, Clock, Dumbbell, Fish, PieChart, RefreshCw, ShieldAlert, Sparkles, X } from 'lucide-react'
import { INGREDIENT_MAP, RECIPES, type Recipe } from '../../domain/catalog'
import { computeTargets } from '../../domain/nutrition'
import { referenceWeightFor } from '../../domain/profiles'
import { isRecipeAllowed } from '../../domain/restrictions'
import { activeTechnique, adaptedMeals, TECHNIQUES, type Technique, type TechniqueMoment } from '../../domain/techniques'
import type { TechniqueId } from '../../domain/types'
import { Button, Card, Pill } from '../../components/ui'
import { Dialog } from '../../components/Dialog'
import { MiaAvatar } from '../../components/Mia'
import { useAppData } from '../../state/AppDataContext'
import { RecipeDetail } from '../recipes/RecipeDetail'
import { useMenu } from './useMenu'

const ICONS: Record<TechniqueId, typeof PieChart> = {
  assiette: PieChart,
  mediterraneen: Fish,
  proteines: Dumbbell,
  'jeune-16-8': Clock,
}

const MOMENT_LABELS: Record<TechniqueMoment, string> = {
  'petit-dej': 'Petit-déjeuner',
  repas: 'Déjeuner et dîner',
  collation: 'Collation',
}

export function Techniques({ onShowWeek }: { onShowWeek: () => void }) {
  const { activeProfile } = useAppData()
  const { plan, applyTechnique } = useMenu()
  const active = activeProfile ? activeTechnique(activeProfile.settings) : null
  const [selected, setSelected] = useState<TechniqueId>(active ?? 'assiette')
  const [seed, setSeed] = useState(1)
  const [confirm, setConfirm] = useState<TechniqueId | 'retirer' | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [open, setOpen] = useState<Recipe | null>(null)
  if (!activeProfile) return null

  const s = activeProfile.settings
  const proteinG = computeTargets(s, referenceWeightFor(activeProfile)).macros.proteinG
  const technique = TECHNIQUES.find((t) => t.id === selected)!
  const allowed = (r: Recipe) => isRecipeAllowed(r, s, INGREDIENT_MAP)

  const run = (id: TechniqueId | null) => {
    applyTechnique(id)
    setConfirm(null)
    setDone(id ? `Ton menu de la semaine suit maintenant « ${TECHNIQUES.find((t) => t.id === id)!.name} ».` : 'Technique retirée : ton menu de la semaine est revenu à la normale.')
  }
  // Pas de menu encore : rien à remplacer, on applique directement.
  const ask = (id: TechniqueId | 'retirer') => (plan ? setConfirm(id) : run(id === 'retirer' ? null : id))

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex items-start gap-3">
        <MiaAvatar size={48} />
        <div>
          <h2 className="text-lg font-bold">Techniques de nutrition</h2>
          <p className="text-muted">
            Des méthodes reconnues pour composer tes repas. Choisis-en une pour orienter ton menu de la semaine ; tu peux la retirer à tout moment.
          </p>
        </div>
      </div>

      {done && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          <p className="flex items-center gap-2 font-semibold">
            <Check size={18} aria-hidden="true" /> {done}
          </p>
          <button type="button" onClick={onShowWeek} className="font-semibold text-brand-700 underline underline-offset-4">
            Voir mon menu
          </button>
        </div>
      )}

      {/* Choix de la technique */}
      <ul className="stagger grid gap-3 sm:grid-cols-2" aria-label="Techniques">
        {TECHNIQUES.map((t) => {
          const Icon = ICONS[t.id]
          const isSel = t.id === selected
          return (
            <li key={t.id}>
              <button
                type="button"
                aria-pressed={isSel}
                onClick={() => {
                  setSelected(t.id)
                  setSeed(1)
                }}
                className={`flex h-full w-full items-start gap-3 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                  isSel ? 'border-brand-400 bg-white ring-2 ring-brand-200' : 'border-slate-200 bg-white'
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isSel ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700'}`}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 font-bold">
                    {t.name} {active === t.id && <Pill>Active</Pill>}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{t.tagline}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Fiche de la technique choisie */}
      <Card as="article" aria-labelledby="technique-title" className="flex flex-col gap-5">
        <div>
          <h3 id="technique-title" className="text-xl font-bold">
            {technique.name}
          </h3>
          <p className="font-semibold text-brand-700">{technique.tagline}</p>
        </div>

        {technique.id === 'assiette' ? (
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <PlateDiagram />
            <p className="leading-relaxed">{technique.principle}</p>
          </div>
        ) : (
          <p className="leading-relaxed">{technique.principle}</p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Bullets title="Pourquoi ça marche" items={technique.why} />
          <Bullets title="Conseils pratiques" items={technique.tips} />
        </div>

        {technique.caution && (
          <p className="flex gap-2 rounded-xl border border-accent-200 bg-accent-50 p-3 text-sm text-accent-800">
            <ShieldAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" /> {technique.caution}
          </p>
        )}

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="mb-1 text-sm font-semibold">Dans ton menu</p>
          <p className="text-sm text-muted">
            {technique.effect}
            {technique.id === 'proteines' && ` Ton objectif actuel : ${proteinG} g de protéines par jour.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {active === technique.id ? (
              <Button variant="secondary" onClick={() => ask('retirer')}>
                <X size={16} aria-hidden="true" /> Retirer de mon menu
              </Button>
            ) : (
              <Button onClick={() => ask(technique.id)}>
                <Sparkles size={16} aria-hidden="true" /> Appliquer à mon menu
              </Button>
            )}
          </div>
          {active && active !== technique.id && (
            <p className="mt-2 text-xs text-muted">Remplace la technique active « {TECHNIQUES.find((t) => t.id === active)!.name} ».</p>
          )}
        </div>

        <AdaptedMeals technique={technique} allowed={allowed} seed={seed} onOpen={setOpen} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => setSeed(seed + 1)}>
            <RefreshCw size={16} aria-hidden="true" /> Autres idées
          </Button>
          <p className="text-xs text-muted">Source : {technique.source}</p>
        </div>
      </Card>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'retirer' ? 'Retirer la technique ?' : `Appliquer « ${TECHNIQUES.find((t) => t.id === confirm)?.name ?? ''} » ?`}
      >
        <p className="text-muted">
          Ton menu de la semaine va être recréé {confirm === 'retirer' ? 'sans technique' : 'avec cette technique'}. Les plats que tu as verrouillés sont gardés.
          {confirm === 'jeune-16-8' && ' Tu passeras à 2 repas par jour.'}
          {confirm === 'retirer' && active === 'jeune-16-8' && ` Tu retrouveras tes ${s.mealsBeforeFasting ?? 3} repas par jour.`}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>
            Annuler
          </Button>
          <Button onClick={() => run(confirm === 'retirer' ? null : confirm)}>{confirm === 'retirer' ? 'Retirer' : 'Appliquer'}</Button>
        </div>
      </Dialog>

      <Dialog open={open !== null} onClose={() => setOpen(null)} title={open?.name ?? ''} size="xl">
        {open && <RecipeDetail recipe={open} showKashrut={s.restrictions.includes('casher')} />}
      </Dialog>
    </div>
  )
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="mb-2 font-semibold">{title}</h4>
      <ul className="flex flex-col gap-1.5 text-sm">
        {items.map((it) => (
          <li key={it} className="flex gap-2">
            <Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-600" /> <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Repas adaptés à la technique, compatibles avec les restrictions du profil. */
function AdaptedMeals({ technique, allowed, seed, onOpen }: { technique: Technique; allowed: (r: Recipe) => boolean; seed: number; onOpen: (r: Recipe) => void }) {
  return (
    <section aria-labelledby="adapted-title" className="flex flex-col gap-4">
      <h4 id="adapted-title" className="text-lg font-bold">
        Repas adaptés
      </h4>
      {technique.moments.map((moment) => {
        const meals = adaptedMeals(RECIPES, technique.id, moment, INGREDIENT_MAP, allowed, seed)
        return (
          <div key={moment}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{MOMENT_LABELS[moment]}</p>
            {meals.length === 0 ? (
              <p className="text-sm text-muted">Pas encore de recette de ce type compatible avec tes préférences.</p>
            ) : (
              <ul key={seed} className="stagger grid gap-2 sm:grid-cols-3">
                {meals.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(r)}
                      className="flex h-full w-full flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-300 hover:shadow-sm"
                    >
                      <span className="font-semibold leading-snug">{r.name}</span>
                      <span className="mt-auto text-xs text-muted">
                        {Math.round(r.perServing.kcal)} kcal · {Math.round(r.perServing.protein)} g prot. · {r.prepMin + r.cookMin} min
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </section>
  )
}

/** L'assiette équilibrée suisse : 2/5 légumes et fruits, 2/5 féculents, 1/5 protéines. */
function PlateDiagram() {
  // Arcs d'un anneau (rayon 40, centre 50/50) : 0 → 144° → 288° → 360°.
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => [50 + 40 * Math.sin((a * Math.PI) / 180), 50 - 40 * Math.cos((a * Math.PI) / 180)].map((v) => v.toFixed(2)).join(' ')
    return `M ${p(a0)} A 40 40 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`
  }
  const parts = [
    { label: 'Légumes et fruits', share: '2/5', color: 'var(--color-brand-500)', d: arc(0, 144) },
    { label: 'Féculents', share: '2/5', color: 'var(--color-accent-400)', d: arc(144, 288) },
    { label: 'Protéines', share: '1/5', color: '#0ea5e9', d: arc(288, 360) },
  ]
  return (
    <figure className="flex shrink-0 items-center gap-4">
      <svg viewBox="0 0 100 100" width="120" height="120" aria-hidden="true" className="animate-pop-in">
        <circle cx="50" cy="50" r="48" fill="white" stroke="#e2e8f0" strokeWidth="2" />
        {parts.map((p) => (
          <path key={p.label} d={p.d} fill="none" stroke={p.color} strokeWidth="16" />
        ))}
      </svg>
      <figcaption>
        <ul className="flex flex-col gap-1.5 text-sm">
          {parts.map((p) => (
            <li key={p.label} className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: p.color }} aria-hidden="true" />
              <span>
                <strong>{p.share}</strong> {p.label}
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}
