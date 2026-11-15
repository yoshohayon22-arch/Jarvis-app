/** Fiche détaillée d'une recette : valeurs, ingrédients, étapes, conservation. */
import { Clock, Flame, Refrigerator, Snowflake, Users, Wallet } from 'lucide-react'
import { INGREDIENT_MAP, type Recipe } from '../../domain/catalog'
import { Pill } from '../../components/ui'
import { formatChf } from '../../lib/format'
import { DIET_LABELS, formatQuantity, formatSeason, KASHRUT_LABELS, MEAL_LABELS } from './recipe-labels'

export function RecipeDetail({
  recipe,
  showKashrut,
  portions,
}: {
  recipe: Recipe
  showKashrut: boolean
  /** Si fourni : valeurs et quantités pour la portion prévue au menu (ex. 1,3 portion). */
  portions?: number
}) {
  const factor = portions ?? 1
  const base = recipe.perServing
  const v = {
    ...base,
    kcal: Math.round(base.kcal * factor),
    protein: base.protein * factor,
    fat: base.fat * factor,
    carbs: base.carbs * factor,
    priceChf: base.priceChf * factor,
    priceBudgetChf: base.priceBudgetChf * factor,
  }
  return (
    <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto pr-1" tabIndex={0} role="region" aria-label={`Détail de la recette ${recipe.name}`}>
      <div className="flex flex-wrap gap-2">
        {recipe.mealTypes.map((m) => (
          <Pill key={m} tone="slate">
            {MEAL_LABELS[m]}
          </Pill>
        ))}
        {showKashrut && <Pill tone="brand">{KASHRUT_LABELS[recipe.kashrut]}</Pill>}
        {recipe.tags.includes('petit-budget') && <Pill tone="accent">Petit budget</Pill>}
        {recipe.tags.includes('batch-friendly') && <Pill tone="brand">Batch cooking</Pill>}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Info
          icon={<Flame size={16} />}
          label={portions ? 'Ta portion' : 'Par portion'}
          value={`${v.kcal} kcal`}
          detail={portions ? `${portions.toLocaleString('fr-CH')} portion${portions >= 2 ? 's' : ''}` : undefined}
        />
        <Info icon={<Clock size={16} />} label="Temps" value={`${recipe.prepMin + recipe.cookMin} min`} detail={`dont ${recipe.cookMin} min de cuisson`} />
        <Info icon={<Users size={16} />} label="Portions" value={String(recipe.servings)} />
        <Info icon={<Wallet size={16} />} label={portions ? 'Prix de ta portion' : 'Prix / portion'} value={formatChf(v.priceChf)} detail={`petit budget : ${formatChf(v.priceBudgetChf)}`} />
      </dl>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <Macro label="Protéines" value={v.protein} color="bg-brand-600" />
        <Macro label="Glucides" value={v.carbs} color="bg-accent-400" />
        <Macro label="Lipides" value={v.fat} color="bg-sky-500" />
      </div>

      <section>
        <h3 className="mb-2 font-bold">Ingrédients</h3>
        <table className="w-full overflow-hidden rounded-xl border border-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Ingrédient</th>
              {portions && <th scope="col" className="px-3 py-2 text-right font-semibold">Ta portion</th>}
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Recette ({recipe.servings} portion{recipe.servings > 1 ? 's' : ''})
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recipe.ingredients.map(({ id, grams }) => {
              const ing = INGREDIENT_MAP.get(id)!
              return (
                <tr key={id}>
                  <th scope="row" className="px-3 py-2 text-left font-normal">{ing.name}</th>
                  {portions && (
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-brand-700">
                      {formatQuantity(ing, (grams / recipe.servings) * portions)}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right tabular-nums">{formatQuantity(ing, grams)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="mb-2 font-bold">Préparation</h3>
        <ol className="flex flex-col gap-2">
          {recipe.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <Refrigerator size={16} aria-hidden="true" className="text-brand-700" />
          {recipe.fridgeDays > 0 ? `Frigo : ${recipe.fridgeDays} jour${recipe.fridgeDays > 1 ? 's' : ''}` : 'À consommer tout de suite'}
        </p>
        <p className="flex items-center gap-2">
          <Snowflake size={16} aria-hidden="true" className="text-sky-600" />
          {recipe.freezerMonths > 0 ? `Congélateur : ${recipe.freezerMonths} mois` : 'Ne se congèle pas'}
        </p>
        <p className="sm:col-span-2 text-muted">Saison : {formatSeason(recipe.season)}</p>
      </section>

      {recipe.compatibleWith.length > 0 && (
        <p className="text-xs text-muted">Compatible : {recipe.compatibleWith.map((d) => DIET_LABELS[d as keyof typeof DIET_LABELS]).join(' · ')}</p>
      )}
    </div>
  )
}

function Info({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted">
        <span aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="text-base font-bold">{value}</dd>
      {detail && <dd className="text-xs text-muted">{detail}</dd>}
    </div>
  )
}

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-100 p-2">
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
        {label}
      </p>
      <p className="font-bold">{Math.round(value)} g</p>
    </div>
  )
}
