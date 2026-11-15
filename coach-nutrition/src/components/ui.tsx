/**
 * Petits composants d'interface réutilisables (boutons, cartes, champs).
 * Tous les champs ont un label associé et un message d'aide/erreur relié par aria-describedby.
 */
import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'warning'

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  secondary: 'bg-white text-ink border border-slate-200 hover:border-brand-400 hover:bg-brand-50',
  ghost: 'text-brand-700 hover:bg-brand-50',
  warning: 'bg-accent-100 text-accent-800 hover:bg-accent-200',
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({
  children,
  className = '',
  as: Tag = 'section',
  ...rest
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
  'aria-labelledby'?: string
}) {
  return (
    <Tag className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

/** Encart d'information / de conseil, jamais en rouge. */
export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'attention' | 'success'
  title?: string
  children: ReactNode
}) {
  const styles = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    attention: 'border-accent-200 bg-accent-50 text-accent-800',
    success: 'border-brand-200 bg-brand-50 text-brand-900',
  }[tone]
  return (
    <div role={tone === 'attention' ? 'alert' : 'status'} className={`rounded-xl border p-4 text-sm ${styles}`}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}

interface FieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
  suffix?: string
  inputMode?: 'decimal' | 'numeric' | 'text'
  placeholder?: string
  autoFocus?: boolean
  name?: string
}

/** Champ texte ou numérique avec label, aide, erreur et unité. Accepte la virgule décimale. */
export function Field({
  label,
  value,
  onChange,
  hint,
  error,
  suffix,
  inputMode = 'text',
  placeholder,
  autoFocus,
  name,
}: FieldProps) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div
        className={`flex items-center rounded-xl border bg-white focus-within:ring-2 focus-within:ring-brand-400 ${
          error ? 'border-accent-400' : 'border-slate-200'
        }`}
      >
        <input
          id={id}
          name={name}
          type="text"
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="w-full rounded-xl bg-transparent px-3.5 py-2.5 text-base outline-none"
        />
        {suffix && (
          <span className="pr-3.5 text-sm text-muted" aria-hidden="true">
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-accent-800">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Groupe de choix sous forme de cartes cliquables (radio ou cases à cocher natives,
 * donc utilisables au clavier : Tab pour entrer, flèches pour les radios, Espace pour cocher).
 */
export function ChoiceGroup<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  multiple = false,
  columns = 2,
  error,
  hint,
}: {
  legend: string
  options: { value: T; label: string; description?: string; icon?: ReactNode }[]
  value: T | T[]
  onChange: (value: T | T[]) => void
  multiple?: boolean
  columns?: 1 | 2 | 3 | 5
  error?: string
  hint?: string
}) {
  const name = useId()
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v)
  const toggle = (v: T) => {
    if (!multiple) return onChange(v)
    const arr = Array.isArray(value) ? value : []
    onChange(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  }
  const grid = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 5: 'sm:grid-cols-2 lg:grid-cols-5' }[
    columns
  ]
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      {hint && <p className="-mt-1 mb-1 text-xs text-muted">{hint}</p>}
      <div className={`grid grid-cols-1 gap-3 ${grid}`}>
        {options.map((o) => {
          const checked = selected(o.value)
          return (
            <label
              key={String(o.value)}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-brand-400 ${
                checked ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-300'
              }`}
            >
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                checked={checked}
                onChange={() => toggle(o.value)}
                className="mt-1 h-4 w-4 accent-brand-600"
              />
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 font-semibold">
                  {o.icon}
                  {o.label}
                </span>
                {o.description && <span className="text-sm text-muted">{o.description}</span>}
              </span>
            </label>
          )
        })}
      </div>
      {error && <p className="text-sm text-accent-800">{error}</p>}
    </fieldset>
  )
}

/** Interrupteur oui/non accessible (role="switch"). */
export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`}
        />
        <span className="sr-only">{checked ? 'Activé' : 'Désactivé'}</span>
      </button>
    </div>
  )
}

/** Petite étiquette arrondie. */
export function Pill({ children, tone = 'brand' }: { children: ReactNode; tone?: 'brand' | 'accent' | 'slate' }) {
  const styles = {
    brand: 'bg-brand-100 text-brand-800',
    accent: 'bg-accent-100 text-accent-800',
    slate: 'bg-slate-100 text-slate-700',
  }[tone]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles}`}>{children}</span>
}
