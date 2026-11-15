/**
 * Fenêtre modale basée sur l'élément natif <dialog> :
 * focus piégé, fermeture avec Échap et retour du focus gérés par le navigateur.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Dialog({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Largeur : « md » pour une confirmation, « xl » pour une fiche recette. */
  size?: 'md' | 'xl'
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal?.()
    if (!open && el.open) el.close?.()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Clic sur le fond : on ferme.
        if (e.target === ref.current) onClose()
      }}
      aria-labelledby="dialog-title"
      className={`m-auto w-[calc(100%-2rem)] ${size === 'xl' ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] rounded-2xl p-0 shadow-xl backdrop:bg-slate-900/40`}
    >
      {open && (
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id="dialog-title" className="text-lg font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted hover:bg-slate-100"
              aria-label="Fermer"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
