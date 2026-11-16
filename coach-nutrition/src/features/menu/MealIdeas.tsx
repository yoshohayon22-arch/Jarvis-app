/**
 * « Juste un repas » : une idée de repas ponctuelle, sans toucher au menu de la semaine.
 * On choisit le moment, quelques envies (rapide, petit budget, ce qu'on a au frigo) ;
 * Mia propose 3 idées compatibles avec le profil, avec une portion adaptée ou normale.
 */
import { useState } from 'react'
import { Clock, Copy, Plus, RefreshCw, Search, Wallet, X } from 'lucide-react'
import { INGREDIENTS, INGREDIENT_MAP, RECIPES } from '../../domain/catalog'
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

const MOMENTS: { value: IdeaMoment; label: string }[] = [
  { value: 'petit-dej', label: 'Petit-déjeuner' },
  { value: 'dejeuner', label: 'Déjeuner' },
  { value: 'diner', label: 'Dîner' },
  { value: 'collation', label: 'Collation' },
]

/** Moment proposé par défaut selon l'heure. */
function momentNow(): IdeaMoment {
  const h = new Date().getHours()
  if (h < 10) return 'petit-dej'
  if (h < 15) return 'dejeuner'
  if (h < 17) return 'collation'
  return 'diner'
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe')

export function MealIdeas() {
  const { activeProfile } = useAppData()
  const [moment, setMoment] = useState<IdeaMoment>(momentNow)
  const [quick, setQuick] = useState(false)
  const [cheap, setCheap] = useState(false)
  const [adapt, setAdapt] = useState(true)
  const [have, setHave] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6))
  const [open, setOpen] = useState<MealIdea | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  if (!activeProfile) return null

  const s = activeProfile.settings
  const dayKcal = computeTargets(s, referenceWeightFor(activeProfile)).targetKcal
  const ideas = suggestMeals(RECIPES, INGREDIENT_MAP, s, dayKcal, { moment, quick, cheap, have, adapt }, seed)
  const results = query.trim()
    ? INGREDIENTS.filter((i) => norm(i.name).includes(norm(query.trim())) && !have.includes(i.id) && i.aisle !== 'condiments').slice(0, 6)
    : []

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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex items-start gap-3">
        <MiaAvatar size={48} />
        <div>
          <h2 className="text-lg font-bold">Juste un repas</h2>
          <p className="text-muted">Pas envie de suivre le programme ? Dis-moi ce qui te tente, je te propose trois idées. Ton menu de la semaine ne change pas.</p>
        </div>
      </div>

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
        <div>
          <label htmlFor="idee-frigo" className="mb-1.5 block text-sm font-semibold">
            J’ai dans mon frigo… (facultatif)
          </label>
          <div className="relative">
            <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="idee-frigo"
              type="search"
              value={query}
              placeholder="ex. courgette, œufs, lentilles…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results[0]) {
                  e.preventDefault()
                  setHave([...have, results[0].id])
                  setQuery('')
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          {(results.length > 0 || have.length > 0) && (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Ingrédients">
              {have.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setHave(have.filter((h) => h !== id))}
                    className="flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1 text-sm font-semibold text-white"
                    aria-label={`Retirer ${INGREDIENT_MAP.get(id)!.name}`}
                  >
                    {INGREDIENT_MAP.get(id)!.name} <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setHave([...have, r.id])
                      setQuery('')
                    }}
                    className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm hover:border-brand-400"
                  >
                    <Plus size={14} aria-hidden="true" /> {r.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {have.length > 0 && ideas.length > 0 && ideas.every((i) => i.uses.length === 0) && (
        <p className="rounded-xl bg-accent-50 p-3 text-sm text-accent-800" role="status">
          Aucune idée {quick ? 'rapide ' : ''}avec {have.map((id) => INGREDIENT_MAP.get(id)!.name.toLowerCase()).join(', ')} pour ce moment.
          {quick || cheap ? ' Essaie sans « rapide » ou « petit budget », ou' : ' Voici'} d’autres idées qui pourraient te plaire.
        </p>
      )}
      {ideas.length === 0 ? (
        <Card className="text-center text-muted">
          Aucune idée ne correspond à toutes ces envies. Essaie sans « rapide » ou sans « petit budget ».
        </Card>
      ) : (
        <ul key={seed} className="stagger flex flex-col gap-3" aria-live="polite">
          {ideas.map((idea, i) => (
            <li key={idea.recipe.id}>
              <Card as="article" className={`flex flex-col gap-3 ${i === 0 ? 'border-brand-200 ring-1 ring-brand-200' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
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
                    {idea.uses.length > 0 && (
                      <p className="mt-1 text-sm text-brand-800">Avec ce que tu as : {idea.uses.map((id) => INGREDIENT_MAP.get(id)!.name.toLowerCase()).join(', ')}</p>
                    )}
                  </div>
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

/** Puce sélectionnable (radio ou case à cocher natives, utilisables au clavier). */
function Chip({
  type,
  name,
  checked,
  onChange,
  children,
}: {
  type: 'radio' | 'checkbox'
  name?: string
  checked: boolean
  onChange: () => void
  children: React.ReactNode
}) {
  return (
    <label
      className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition focus-within:ring-2 focus-within:ring-brand-400 ${
        checked ? 'bg-brand-600 text-white' : 'bg-slate-100 hover:bg-slate-200'
      }`}
    >
      <input type={type} name={name} className="sr-only" checked={checked} onChange={onChange} />
      {children}
    </label>
  )
}
