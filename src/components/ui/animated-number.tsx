"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

/**
 * Nombre qui « compte » jusqu'à sa valeur (classement, points, températures, budget).
 * Le texte est mis à jour directement dans le DOM (aucun re-rendu React par image).
 */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toString(),
  duration = 0.6,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (reduced) {
      el.textContent = format(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (n) => (el.textContent = format(n)),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, inView, reduced, duration, format]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {format(value)}
    </span>
  );
}
