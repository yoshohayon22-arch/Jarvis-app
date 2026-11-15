/**
 * Écran Courses : liste(s) générée(s) depuis le menu, classée(s) par rayon,
 * avec cases à cocher, prix estimé, copie et version imprimable.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Check, Copy, Printer, ShoppingBasket } from 'lucide-react'
import { INGREDIENT_MAP, PRICES } from '../../domain/catalog'
import { buildShoppingLists, formatAmount, listToText, purchaseText, type ShoppingItem, type ShoppingList } from '../../domain/shopping'
import { toggleShoppingCheck } from '../../domain/profiles'
import { Button, Card, Notice } from '../../components/ui'
import { useAppData } from '../../state/AppDataContext'
import { formatChf, formatDate } from '../../lib/format'
import { useMenu } from '../menu/useMenu'

export function ShoppingPage() {
  const { activeProfile, update } = useAppData()
  const { plan, recipes } = useMenu()
  const { hash } = useLocation()
  const lists = useMemo(
    () => (plan && activeProfile ? buildShoppingLists(plan, recipes, INGREDIENT_MAP, PRICES.items, activeProfile.settings.restrictions) : []),
    [plan, recipes, activeProfile],
  )

  // Lien depuis l'écran Batch : on fait défiler jusqu'à la liste de la session.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [hash, lists.length])

  if (!activeProfile) return null
  if (!plan) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold">Courses</h1>
        <Card className="flex flex-col items-start gap-3">
          <p>La liste de courses se construit à partir de ton menu de la semaine.</p>
          <Link to="/menu" className="font-semibold text-brand-700 underline">
            Générer mon menu
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Courses</h1>
          <p className="text-muted">
            Semaine du {formatDate(plan.weekStart, { day: 'numeric', month: 'long' })} · {plan.lowBudget ? 'produits les moins chers' : 'produits standard'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => window.print()} className="no-print">
          <Printer size={18} aria-hidden="true" /> Imprimer
        </Button>
      </div>

      {lists[0]?.reminders.map((r) => (
        <Notice key={r} tone="info">
          {r}
        </Notice>
      ))}

      {lists.map((list, i) => (
        <ListCard
          key={list.id}
          anchor={`liste-${i}`}
          list={list}
          checked={activeProfile.shoppingChecks[list.id] ?? []}
          onToggle={(itemId) => update((d) => toggleShoppingCheck(d, activeProfile.id, list.id, itemId))}
        />
      ))}

      <p className="text-xs text-muted">
        Prix indicatifs (mis à jour le {formatDate(PRICES.updatedAt)}), arrondis aux paquets entiers. Le coût du menu compte ce que
        tu manges ; la liste compte ce que tu achètes, d’où une petite différence (il te restera du riz, de l’huile…).
      </p>
    </div>
  )
}

function ListCard({ anchor, list, checked, onToggle }: { anchor: string; list: ShoppingList; checked: string[]; onToggle: (id: string) => void }) {
  const [copied, setCopied] = useState(false)
  const count = list.aisles.reduce((s, a) => s + a.items.length, 0)
  const done = list.aisles.reduce((s, a) => s + a.items.filter((i) => checked.includes(i.ingredient.id)).length, 0)

  const copy = async () => {
    const text = listToText(list, checked)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Repli pour les navigateurs qui bloquent le presse-papiers.
      const area = document.createElement('textarea')
      area.value = text
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card aria-labelledby={`${anchor}-title`} className="print-break flex flex-col gap-5">
      <div id={anchor} className="flex flex-wrap items-start justify-between gap-4 scroll-mt-24">
        <div>
          <h2 id={`${anchor}-title`} className="flex items-center gap-2 text-xl font-bold">
            <ShoppingBasket size={22} aria-hidden="true" className="text-brand-600" /> {list.title}
          </h2>
          <p className="text-sm text-muted">{list.subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{formatChf(list.totalChf)}</p>
          <p className="text-sm text-muted" aria-live="polite">
            {done} / {count} article{count >= 2 ? 's' : ''} dans le panier
          </p>
        </div>
      </div>
      <div className="no-print">
        <Button variant="secondary" onClick={copy}>
          {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
          {copied ? 'Copié !' : 'Copier la liste'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {list.aisles.map((a) => (
          <section key={a.aisle} aria-labelledby={`${anchor}-${a.aisle}`} className="break-inside-avoid">
            <h3 id={`${anchor}-${a.aisle}`} className="mb-2 border-b border-slate-100 pb-1 text-sm font-bold uppercase tracking-wide text-brand-800">
              {a.label}
            </h3>
            <ul className="flex flex-col gap-1">
              {a.items.map((item) => (
                <ItemRow key={item.ingredient.id} item={item} checked={checked.includes(item.ingredient.id)} onToggle={() => onToggle(item.ingredient.id)} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {list.pantry.length > 0 && (
        <section className="rounded-xl bg-slate-50 p-4">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Dans tes placards ? (non compté dans le total)</h3>
          <p className="mb-2 text-sm text-muted">
            {list.pantry.map((i) => `${i.ingredient.name} (${formatAmount(i.ingredient, i.neededUnits)})`).join(' · ')}
          </p>
        </section>
      )}
    </Card>
  )
}

function ItemRow({ item, checked, onToggle }: { item: ShoppingItem; checked: boolean; onToggle: () => void }) {
  const id = `item-${item.ingredient.id}-${Math.round(item.neededGrams)}`
  return (
    <li>
      <label htmlFor={id} className={`flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 ${checked ? 'opacity-50' : ''}`}>
        <input id={id} type="checkbox" checked={checked} onChange={onToggle} className="mt-1 h-4 w-4 shrink-0 accent-brand-600" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`font-semibold ${checked ? 'line-through' : ''}`}>
            {item.ingredient.name} <span className="font-normal text-muted">— {formatAmount(item.ingredient, item.neededUnits)}</span>
          </span>
          <span className="text-xs text-muted">{purchaseText(item)}</span>
        </span>
        <span className="shrink-0 text-sm tabular-nums">{formatChf(item.totalChf)}</span>
      </label>
    </li>
  )
}
