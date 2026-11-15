"use client";

import { motion } from "motion/react";
import { useMotionPreset } from "@/lib/motion/use-motion-preset";
import { usePrefs } from "@/lib/prefs/prefs-provider";
import { cn } from "@/lib/utils";

/**
 * Indicateur d'onglet actif qui glisse d'un onglet à l'autre (layoutId partagé).
 * Thème Dessiné : un trait « au feutre » qui se dessine (stroke-dashoffset).
 */
export function ActiveIndicator({ layoutId, className }: { layoutId: string; className?: string }) {
  const preset = useMotionPreset();
  const { prefs } = usePrefs();

  return (
    <motion.span
      layoutId={layoutId}
      transition={preset.indicator}
      aria-hidden
      className={cn(
        "absolute inset-0 -z-10 rounded-control bg-accent-soft",
        "[[data-theme=brutal]_&]:border-[3px] [[data-theme=brutal]_&]:border-black [[data-theme=brutal]_&]:bg-accent-2",
        "[[data-theme=dessine]_&]:bg-transparent",
        className,
      )}
    >
      {prefs.theme === "dessine" ? (
        <svg
          key="draw"
          className="draw-stroke absolute inset-x-1 bottom-0.5 h-3 w-[calc(100%-0.5rem)] text-accent"
          viewBox="0 0 100 12"
          preserveAspectRatio="none"
        >
          <path
            d="M2 8 C 20 3, 35 11, 52 6 S 85 4, 98 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={1}
          />
        </svg>
      ) : null}
    </motion.span>
  );
}
