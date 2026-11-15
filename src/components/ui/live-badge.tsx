"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/** Badge LIVE avec pulsation discrète. */
export function LiveBadge({ label = "LIVE" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white">
      <span aria-hidden className="live-dot size-1.5 rounded-full bg-white" />
      {label}
    </span>
  );
}

/**
 * Score en direct : un flash doux quand la valeur change (but marqué).
 * On anime l'opacité d'un calque coloré, pas la couleur de fond.
 */
export function LiveScore({ home, away }: { home: number; away: number }) {
  const reduced = useReducedMotion();
  const [flashKey, setFlashKey] = useState(0);
  const prev = useRef(`${home}-${away}`);

  useEffect(() => {
    const key = `${home}-${away}`;
    if (key !== prev.current) {
      prev.current = key;
      setFlashKey((k) => k + 1);
    }
  }, [home, away]);

  return (
    <span className="relative inline-flex items-center rounded-control px-2 font-heading text-2xl tabular-nums">
      {flashKey > 0 && !reduced ? (
        <motion.span
          key={flashKey}
          aria-hidden
          className="absolute inset-0 rounded-[inherit] bg-accent"
          initial={{ opacity: 0.55 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      ) : null}
      <span className="relative" aria-live="polite">
        {home} – {away}
      </span>
    </span>
  );
}
