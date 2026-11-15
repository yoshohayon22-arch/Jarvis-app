"use client";

/**
 * Fond du thème Glassmorphism : 3 dégradés radiaux avec une légère parallaxe
 * qui suit le pointeur (ordinateur). Seul transform est animé.
 */
import { motion, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import { useEffect } from "react";
import { usePrefs } from "@/lib/prefs/prefs-provider";

const BLOBS = [
  { color: "#43308C", size: "70vmax", top: "-20vmax", left: "-15vmax", depth: 1 },
  { color: "#0C6E7E", size: "60vmax", top: "30vh", left: "45vw", depth: -1.4 },
  { color: "#7A2E6B", size: "55vmax", top: "55vh", left: "-10vw", depth: 0.8 },
];

function Blob({ blob, x, y }: { blob: (typeof BLOBS)[number]; x: MotionValue<number>; y: MotionValue<number> }) {
  const bx = useTransform(x, (n) => n * blob.depth);
  const by = useTransform(y, (n) => n * blob.depth);
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: blob.size,
        height: blob.size,
        top: blob.top,
        left: blob.left,
        // Opacité limitée pour garantir le contraste du texte posé sur les cartes.
        opacity: 0.55,
        background: `radial-gradient(circle at center, ${blob.color} 0%, transparent 65%)`,
        x: bx,
        y: by,
      }}
    />
  );
}

export function GlassBackdrop() {
  const { prefs } = usePrefs();
  const reduced = useReducedMotion();
  const x = useSpring(0, { stiffness: 50, damping: 20 });
  const y = useSpring(0, { stiffness: 50, damping: 20 });
  const active = prefs.theme === "glass" && !reduced;

  useEffect(() => {
    if (!active) return;
    const onMove = (e: PointerEvent) => {
      x.set((e.clientX / window.innerWidth - 0.5) * 30);
      y.set((e.clientY / window.innerHeight - 0.5) * 30);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [active, x, y]);

  return (
    <div aria-hidden className="glass-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ background: "#0B0E1D" }}>
      {BLOBS.map((b) => (
        <Blob key={b.color} blob={b} x={x} y={y} />
      ))}
    </div>
  );
}
