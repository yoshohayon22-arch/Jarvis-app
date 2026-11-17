/**
 * « Juste un repas » : un repas ponctuel, sans toucher au menu de la semaine. Deux façons de faire :
 * - « Avec ce que j'ai » : on dit ce qu'on a chez soi, l'app compose l'assiette (FridgeMeal) ;
 * - « Des idées » : on choisit le moment et quelques envies (rapide, petit budget),
 *   Mia propose 3 recettes compatibles avec le profil, avec une portion adaptée ou normale.
 */
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Clock, Copy, Lightbulb, RefreshCw, Refrigerator, Wallet } from 'lucide-react'
import { INGREDIENT_MAP, RECIPES } from '../../domain/catalog'
import { suggestMeals, QUICK_MINUTES, type IdeaMoment, type MealIdea } from '../../domain/meal-ideas'
import { computeTargets } from '../../domain/nutrition'
import { referenceWeightFor } from '../../domain/profiles'
import { Button, Card } from '../../components/ui'
import { Dialog } from '../../components/Dialog'
import { MiaAvatar } from '../../components/Mia'
import { useAppData } from '../../state/AppDataContext'
import { formatChf } from '../../lib/format'
import { RecipeDetail } from '../recipes/RecipeDetail'
import { formatQuantity } from '../recipes/recipe-labels'
import { FridgeMeal } from './FridgeMeal'
import { Chip } from '../../components/Chip'
import { MOMENTS, momentNow } from './moments'

type Mode = 'frigo' | 'idees'

export function MealIdeas() {
  const location = useLocation()
  const [mode, setMode] = useState<Mode>((location.state as { mode?: Mode } | null)?.mode ?? 'frigo')
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex items-start gap-3">
        <MiaAvatar size={48} />
        <div>
          <h2 className="text-lg font-bold">Juste un repas</h2>
          <p className="text-muted">Dis-moi ce que tu as chez toi, ou ce qui te tente : je te propose un repas. Ton menu de la semaine ne change pas.</p>
        </div>
      </div>
      <div role="tablist" aria-label="Façon de choisir" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {(
          [
            ['frigo', 'Avec ce que j’ai', Refrigerator],
            ['idees', 'Des idées', Lightbulb],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === id ? 'bg-white text-brand-700 shadow-sm' : 'text-muted hover:text-ink'}`}
          >
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      {mode === 'frigo' ? <FridgeMeal /> : <CatalogIdeas />}
    </div>
  )
}

/** « Des idées » : 3 recettes du catalogue selon le moment et les envies. */
function CatalogIdeas() {
  const { activeProfile } = useAppData()
  const [moment, setMoment] = useState<IdeaMoment>(momentNow)
  const [quick, setQuick] = useState(false)
  const [cheap, setCheap] = useState(false)
  const [adapt, setAdapt] = useState(true)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6))
  const [open, setOpen] = useState<MealIdea | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  if (!activeProfile) return null

  const s = activeProfile.settings
  const dayKcal = computeTargets(s, referenceWeightFor(activeProfile)).targetKcal
  const ideas = suggestMeals(RECIPES, INGREDIENT_MAP, s, dayKcal, { moment, quick, cheap, adapt }, seed)

  const copy = async (idea: MealIdea) => {
    const r = idea.recipe
    const lines = [
      `${r.name} — ${idea.portions.toLocaleString('fr-CH')} portion${idea.portions >= 2 ? 's' : ''}`,
      ...r.ingredients.map(({ id, grams }) => `• ${INGREDIENT_MAP.get(id)!.name} : ${formatQuantity(INGREDIENT_MAP.get(id)!, (grams / r.servings) * idea.portions)}`),
    ].join('\n')
    try {
      await navigator.clipboard.writeText(lines)
    } catch {
      const area = document.createElement('textarea')
      area.value = lines
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(r.id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="flex flex-col gap-5">
      <Card as="div" className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Pour quand ?</legend>
          <div className="flex flex-wrap gap-2">
            {MOMENTS.map((m) => (
              <Chip key={m.value} type="radio" name="idee-moment" checked={moment === m.value} onChange={() => setMoment(m.value)}>
                {m.label}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Mes envies (facultatif)</legend>
          <div className="flex flex-wrap gap-2">
            <Chip type="checkbox" checked={quick} onChange={() => setQuick(!quick)}>
              Rapide ({QUICK_MINUTES} min max)
            </Chip>
            <Chip type="checkbox" checked={cheap} onChange={() => setCheap(!cheap)}>
              Petit budget
            </Chip>
            <Chip type="checkbox" checked={adapt} onChange={() => setAdapt(!adapt)}>
              Portion adaptée à mes besoins
            </Chip>
          </div>
        </fieldset>
      </Card>

      {ideas.length === 0 ? (
        <Card className="text-center text-muted">
          Aucune idée ne correspond à toutes ces envies. Essaie sans « rapide » ou sans « petit budget ».
        </Card>
      ) : (
        <ul key={seed} className="stagger flex flex-col gap-3" aria-live="polite">
          {ideas.map((idea, i) => (
            <li key={idea.recipe.id}>
              <Card as="article" className={`flex flex-col gap-3 ${i === 0 ? 'border-brand-200 ring-1 ring-brand-200' : ''}`}>
                <div className="min-w-0">
                  {i === 0 && <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">L’idée de Mia</p>}
                  <h3 className="text-lg font-bold leading-snug">{idea.recipe.name}</h3>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span className="font-semibold text-brand-700">{idea.kcal} kcal</span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} aria-hidden="true" /> {idea.recipe.prepMin + idea.recipe.cookMin} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Wallet size={14} aria-hidden="true" /> {formatChf(idea.priceChf)}
                    </span>
                    {idea.portions !== 1 && (
                      <span>
                        {idea.portions.toLocaleString('fr-CH')} portion{idea.portions >= 2 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant={i === 0 ? 'primary' : 'secondary'} onClick={() => setOpen(idea)}>
                    Voir la recette
                  </Button>
                  <Button variant="ghost" onClick={() => copy(idea)}>
                    <Copy size={16} aria-hidden="true" /> {copied === idea.recipe.id ? 'Copié !' : 'Copier les ingrédients'}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {ideas.length > 0 && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setSeed(seed + 1)}>
            <RefreshCw size={16} aria-hidden="true" /> Autres idées
          </Button>
        </div>
      )}

      <Dialog open={open !== null} onClose={() => setOpen(null)} title={open?.recipe.name ?? ''} size="xl">
        {open && <RecipeDetail recipe={open.recipe} showKashrut={s.restrictions.includes('casher')} portions={open.portions} />}
      </Dialog>
    </div>
  )
}
