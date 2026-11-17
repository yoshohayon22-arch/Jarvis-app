/** Puce sélectionnable (radio ou case à cocher natives, utilisables au clavier). */
import type { ReactNode } from 'react'

export function Chip({
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
  children: ReactNode
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
