/**
 * « Avec ce que j'ai » : on dit ce qu'on a au frigo ou au placard (texte libre ou ajout rapide),
 * l'app compose une assiette avec ces produits, quantités calées sur les besoins du repas,
 * et liste les recettes du catalogue faisables avec ce qui manque.
 * Rien n'est mémorisé : la liste repart de zéro à chaque visite.
 */
import { useState } from 'react'
import { Check, ChefHat, Plus, RefreshCw, ShoppingBasket, X } from 'lucide-react'
import { INGREDIENTS, INGREDIENT_MAP, RECIPES, type Recipe } from '../../domain/catalog'
import { composeMeals, feasibleRecipes, parseFridgeText, type ComposedMeal } from '../../domain/fridge-meal'
import { momentShare, type IdeaMoment } from '../../domain/meal-ideas'
import { computeTargets } from '../../domain/nutrition'
import { referenceWeightFor } from '../../domain/profiles'
import { isRecipeAllowed } from '../../domain/restrictions'
import { Button, Card, Pill } from '../../components/ui'
import { Dialog } from '../../components/Dialog'
import { useAppData } from '../../state/AppDataContext'
import { RecipeDetail } from '../recipes/RecipeDetail'
import { formatQuantity, KASHRUT_LABELS } from '../recipes/recipe-labels'
import { Chip } from '../../components/Chip'
import { MOMENTS, momentNow } from './moments'

/** Ajout rapide : les produits qu'on a le plus souvent à la maison. */
const QUICK: { label: string; ids: string[] }[] = [
  { label: 'Protéines', ids: ['oeufs', 'poulet-emince', 'boeuf-hache', 'thon-conserve', 'saumon-filet', 'tofu-nature', 'lentilles-corail', 'pois-chiches-conserve', 'sere-maigre'] },
  { label: 'Féculents', ids: ['riz-long', 'pates', 'pommes-de-terre', 'pain-complet', 'semoule-couscous', 'flocons-avoine', 'patate-douce', 'quinoa'] },
  { label: 'Légumes', ids: ['tomates', 'courgette', 'carottes', 'brocoli', 'epinards-surgeles', 'poivron', 'salade-verte', 'champignons-paris', 'concombre'] },
  { label: 'Fruits et laitages', ids: ['pommes', 'bananes', 'baies-surgelees', 'yaourt-nature', 'yaourt-grec', 'lait', 'gruyere', 'feta', 'avocat'] },
]

export function FridgeMeal() {
  const { activeProfile } = useAppData()
  const [have, setHave] = useState<string[]>([])
  const [text, setText] = useState('')
  const [unknown, setUnknown] = useState<string[]>([])
  const [moment, setMoment] = useState<IdeaMoment>(momentNow)
  const [seed, setSeed] = useState(1)
  const [open, setOpen] = useState<{ recipe: Recipe; portions: number } | null>(null)
  if (!activeProfile) return null

  const s = activeProfile.settings
  const t = computeTargets(s, referenceWeightFor(activeProfile))
  const allowed = (id: string) => isRecipeAllowed({ ingredients: [{ id, grams: 100 }] }, s, INGREDIENT_MAP)
  const meals = have.length ? composeMeals(have, INGREDIENT_MAP, s, t.targetKcal, t.macros.proteinG, moment, seed) : []
  const feasible = have.length ? feasibleRecipes(RECIPES, have, INGREDIENT_MAP, s, moment).slice(0, 6) : []
  const mealKcal = t.targetKcal * momentShare(moment, s.mealsPerDay)

  const addText = () => {
    if (!text.trim()) return
    const { found, unknown: u } = parseFridgeText(text, INGREDIENTS)
    setHave((h) => [...h, ...found.filter((id) => !h.includes(id))])
    setUnknown(u)
    setText('')
    setSeed(1)
  }
  const toggle = (id: string) => {
    setHave((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]))
    setSeed(1)
  }
  const name = (id: string) => INGREDIENT_MAP.get(id)!.name

  return (
    <div className="flex flex-col gap-5">
      <Card as="div" className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Pour quand ?</legend>
          <div className="flex flex-wrap gap-2">
            {MOMENTS.map((m) => (
              <Chip key={m.value} type="radio" name="frigo-moment" checked={moment === m.value} onChange={() => {
                  setMoment(m.value)
                  setSeed(1)
                }}>
                {m.label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="frigo-texte" className="mb-1.5 block text-sm font-semibold">
            Qu’as-tu chez toi ?
          </label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              addText()
            }}
          >
            <input
              id="frigo-texte"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="ex. poulet, riz, 2 courgettes, yaourt…"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-400"
            />
            <Button type="submit" variant="secondary">
              <Plus size={16} aria-hidden="true" /> Ajouter
            </Button>
          </form>
          <p className="mt-1 text-xs text-muted">Sépare les produits par des virgules. On suppose que tu as de l’huile, du sel, du poivre et des épices.</p>
          {unknown.length > 0 && (
            <p role="status" className="mt-2 text-sm text-accent-800">
              Je n’ai pas reconnu : {unknown.join(', ')}. Essaie un autre mot (ex. « poulet », « pâtes », « yaourt »).
            </p>
          )}
        </div>

        {have.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Chez moi ({have.length})</p>
              <button type="button" onClick={() => {
                  setHave([])
                  setUnknown([])
                }} className="text-sm font-semibold text-brand-700 underline underline-offset-4">
                Tout retirer
              </button>
            </div>
            <ul className="flex flex-wrap gap-2" aria-label="Produits que j’ai">
              {have.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    aria-label={`Retirer ${name(id)}`}
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${allowed(id) ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600 line-through'}`}
                    title={allowed(id) ? undefined : 'Exclu par ton profil'}
                  >
                    {name(id)} <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-brand-700">Ajout rapide</summary>
          <div className="mt-3 flex flex-col gap-3">
            {QUICK.map((g) => (
              <div key={g.label}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{g.label}</p>
                <div className="flex flex-wrap gap-2">
                  {g.ids
                    .filter((id) => INGREDIENT_MAP.has(id) && allowed(id))
                    .map((id) => (
                      <Chip key={id} type="checkbox" checked={have.includes(id)} onChange={() => toggle(id)}>
                        {name(id)}
                      </Chip>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </Card>

      {have.length === 0 ? (
        <p className="text-center text-muted">Ajoute quelques produits : je compose ton assiette et je te montre les recettes que tu peux faire.</p>
      ) : (
        <>
          <section aria-labelledby="assiette-title" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="assiette-title" className="text-lg font-bold">
                Ton assiette
              </h2>
              <p className="text-sm text-muted">Environ {Math.round(mealKcal)} kcal visées pour ce repas</p>
            </div>
            {meals.length === 0 ? (
              <Card className="text-muted">Avec ces produits et tes préférences, je n’arrive pas à composer d’assiette. Ajoute une protéine, un féculent ou un légume.</Card>
            ) : (
              <ul key={seed} className="stagger flex flex-col gap-3">
                {meals.map((m, i) => (
                  <li key={m.title + i}>
                    <PlateCard meal={m} first={i === 0} showKashrut={s.restrictions.includes('casher')} />
                  </li>
                ))}
              </ul>
            )}
            {meals.length > 0 && (
              <div className="flex justify-center">
                <Button variant="secondary" onClick={() => setSeed(seed + 1)}>
                  <RefreshCw size={16} aria-hidden="true" /> Autre combinaison
                </Button>
              </div>
            )}
          </section>

          <section aria-labelledby="faisables-title" className="flex flex-col gap-3">
            <h2 id="faisables-title" className="flex items-center gap-2 text-lg font-bold">
              <ChefHat size={20} aria-hidden="true" className="text-brand-600" /> Recettes que tu peux faire
            </h2>
            {feasible.length === 0 ? (
              <p className="text-sm text-muted">Aucune recette du catalogue avec au plus 2 produits à acheter. Ajoute d’autres produits pour en voir.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {feasible.map(({ recipe, missing }) => {
                  const portions = Math.min(2, Math.max(0.5, Math.round((mealKcal / Math.max(1, recipe.perServing.kcal)) * 10) / 10))
                  return (
                    <li key={recipe.id}>
                      <button
                        type="button"
                        onClick={() => setOpen({ recipe, portions })}
                        className="flex h-full w-full flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-300 hover:shadow-sm"
                      >
                        <span className="font-semibold leading-snug">{recipe.name}</span>
                        {missing.length === 0 ? (
                          <span className="flex items-center gap-1 text-sm font-semibold text-brand-700">
                            <Check size={14} aria-hidden="true" /> Tu as tout
                          </span>
                        ) : (
                          <span className="flex items-start gap-1 text-sm text-accent-800">
                            <ShoppingBasket size={14} aria-hidden="true" className="mt-0.5 shrink-0" /> Il te manque : {missing.map((id) => name(id).toLowerCase()).join(', ')}
                          </span>
                        )}
                        <span className="mt-auto text-xs text-muted">
                          {Math.round(recipe.perServing.kcal * portions)} kcal · {recipe.prepMin + recipe.cookMin} min
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <Dialog open={open !== null} onClose={() => setOpen(null)} title={open?.recipe.name ?? ''} size="xl">
        {open && <RecipeDetail recipe={open.recipe} showKashrut={s.restrictions.includes('casher')} portions={open.portions} />}
      </Dialog>
    </div>
  )
}

function PlateCard({ meal, first, showKashrut }: { meal: ComposedMeal; first: boolean; showKashrut: boolean }) {
  return (
    <Card as="article" className={`flex flex-col gap-4 ${first ? 'border-brand-200 ring-1 ring-brand-200' : ''}`}>
      <div>
        {first && <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">L’assiette de Mia</p>}
        <h3 className="text-lg font-bold leading-snug">{meal.title}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span className="font-semibold text-brand-700">{meal.kcal} kcal</span>
          <span>{meal.protein} g de protéines</span>
          {showKashrut && <Pill tone="slate">{KASHRUT_LABELS[meal.kashrut]}</Pill>}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-1.5 text-sm font-semibold">Quantités</h4>
          <ul className="flex flex-col gap-1 text-sm">
            {meal.items.map((i) => {
              const ing = INGREDIENT_MAP.get(i.id)!
              return (
                <li key={i.id} className="flex justify-between gap-3">
                  <span>
                    {ing.name}
                    {i.pantry && <span className="text-muted"> (placard)</span>}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{i.id === 'oeufs' ? `${Math.round(i.grams / 55)} œuf${i.grams > 55 ? 's' : ''}` : formatQuantity(ing, i.grams)}</span>
                </li>
              )
            })}
          </ul>
        </div>
        <div>
          <h4 className="mb-1.5 text-sm font-semibold">Préparation</h4>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
            {meal.steps.map((st) => (
              <li key={st}>{st}</li>
            ))}
          </ol>
        </div>
      </div>
      {meal.tips.map((tip) => (
        <p key={tip} className="rounded-xl bg-accent-50 p-3 text-sm text-accent-800">
          {tip}
        </p>
      ))}
    </Card>
  )
}
