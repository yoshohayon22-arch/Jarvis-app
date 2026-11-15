"use client";

/**
 * Carte extensible : elle s'agrandit en vue détaillée (shared layout animation)
 * puis revient à sa place. Échap ou clic sur le fond pour fermer.
 */
import { AnimatePresence, motion } from "motion/react";
import { Maximize2, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMotionPreset } from "@/lib/motion/use-motion-preset";
import { cn } from "@/lib/utils";

export function ExpandableCard({
  title,
  badge,
  children,
  detail,
  className,
}: {
  title: string;
  badge?: React.ReactNode;
  /** Contenu de la carte repliée. */
  children: React.ReactNode;
  /** Contenu supplémentaire de la vue détaillée. */
  detail?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const preset = useMotionPreset();
  const layoutId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const [slotHeight, setSlotHeight] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = `${layoutId}-title`;

  const close = useCallback(() => {
    setOpen(false);
    // Le bouton « Détails » est remonté après la fermeture : on lui rend le focus.
    setTimeout(() => triggerRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const header = (expanded: boolean) => (
    <div className="flex items-start justify-between gap-3">
      <motion.h2 layout="position" id={expanded ? titleId : undefined} className="text-lg leading-tight">
        {title}
      </motion.h2>
      <div className="flex items-center gap-2">
        {badge}
        {expanded ? (
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Fermer la vue détaillée"
            className="btn-press -m-2 inline-flex size-11 items-center justify-center rounded-control text-text-2 hover:text-text"
          >
            <X aria-hidden className="size-5" />
          </button>
        ) : null}
      </div>
    </div>
  );

  const openCard = () => {
    // On fige la hauteur de l'emplacement pour que la grille ne bouge pas pendant l'ouverture.
    setSlotHeight(slotRef.current?.offsetHeight ?? null);
    setOpen(true);
  };

  return (
    <>
      <div ref={slotRef} style={open && slotHeight ? { height: slotHeight } : undefined}>
        {!open ? (
          <motion.div
            layoutId={layoutId}
            transition={preset.layout}
            className={cn("card card-hover flex h-full min-h-44 flex-col gap-4 p-5", className)}
          >
            {header(false)}
            <div className="flex-1">{children}</div>
            <button
              ref={triggerRef}
              type="button"
              onClick={openCard}
              className="btn-press -mx-2 -mb-2 inline-flex min-h-11 items-center gap-2 self-start rounded-control px-2 text-sm text-text-2 hover:text-text [[data-theme=brutal]_&]:shadow-none [[data-theme=dessine]_&]:shadow-none"
              aria-label={`Détails : ${title}`}
            >
              <Maximize2 aria-hidden className="size-4" />
              Détails
            </button>
          </motion.div>
        ) : null}
      </div>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
                  {/* Fond : le flou est fixe, seule l'opacité s'anime (le flou « s'intensifie »). */}
                  <motion.div
                    className="absolute inset-0 bg-black/50 [[data-theme=glass]_&]:backdrop-blur-xl [[data-theme=nuit]_&]:backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={close}
                  />
                  <motion.div
                    layoutId={layoutId}
                    transition={preset.layout}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    className="card relative flex max-h-[85dvh] w-full max-w-2xl flex-col gap-4 overflow-y-auto p-6 [[data-theme=glass]_&]:bg-[rgb(20_22_48/0.72)]"
                  >
                    {header(true)}
                    <div>{children}</div>
                    {detail ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: 0.12 } }}
                        exit={{ opacity: 0, transition: { duration: 0.08 } }}
                      >
                        {detail}
                      </motion.div>
                    ) : null}
                  </motion.div>
                </div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
