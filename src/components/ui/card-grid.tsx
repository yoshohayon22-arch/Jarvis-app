"use client";

/**
 * Grille de cartes avec apparition en cascade (stagger 40–60 ms selon le thème),
 * jouée uniquement au tout premier chargement de l'app.
 */
import { motion } from "motion/react";
import { Children, useEffect, useState } from "react";
import { useMotionPreset } from "@/lib/motion/use-motion-preset";
import { cn } from "@/lib/utils";

let firstLoadDone = false;

export function CardGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  const preset = useMotionPreset();
  // Figé au montage : seule la toute première grille affichée joue la cascade.
  const [animate] = useState(() => !firstLoadDone);
  useEffect(() => {
    firstLoadDone = true;
  }, []);

  return (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3", className)}>
      {Children.map(children, (child, i) =>
        animate ? (
          <motion.div
            initial={{ opacity: 0, y: 12, rotate: preset.wobble ? (i % 2 ? preset.wobble : -preset.wobble) : 0 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ ...preset.card, delay: i * preset.stagger }}
          >
            {child}
          </motion.div>
        ) : (
          <div>{child}</div>
        ),
      )}
    </div>
  );
}
