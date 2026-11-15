/**
 * Personnalité de mouvement de chaque thème.
 * Règles : on n'anime que transform et opacity ; 150–250 ms pour les micro-interactions,
 * 300–450 ms pour les transitions de page ; ressorts plutôt que courbes linéaires.
 */
import type { Transition } from "motion/react";
import type { ThemeId } from "@/lib/themes";

/** Easing « en marches » pour le thème Brutaliste (mouvement sec et mécanique). */
const steps =
  (n: number) =>
  (t: number): number =>
    Math.min(1, Math.ceil(t * n) / n);

export interface MotionPreset {
  /** Transition de page (changement d'onglet). */
  page: Transition;
  /** Décalage horizontal (px) à l'entrée d'une page, multiplié par la direction. */
  pageOffset: number;
  /** Indicateur d'onglet actif qui glisse. */
  indicator: Transition;
  /** Micro-interactions (boutons, cases, badges). */
  micro: Transition;
  /** Apparition des cartes en cascade. */
  card: Transition;
  /** Délai entre deux cartes (secondes). */
  stagger: number;
  /** Rotation légère à l'entrée (thème Dessiné : effet « tremblé »). */
  wobble: number;
  /** Ouverture / fermeture d'une carte extensible (shared layout). */
  layout: Transition;
}

export const MOTION_PRESETS: Record<ThemeId, MotionPreset> = {
  // Doux et premium : fondus + légers glissements.
  nuit: {
    page: { type: "spring", stiffness: 380, damping: 36, mass: 0.9 },
    pageOffset: 10,
    indicator: { type: "spring", stiffness: 500, damping: 40 },
    micro: { type: "spring", stiffness: 600, damping: 35 },
    card: { type: "spring", stiffness: 340, damping: 32 },
    stagger: 0.05,
    wobble: 0,
    layout: { type: "spring", stiffness: 420, damping: 38 },
  },
  // Flottant : ressorts plus amples.
  glass: {
    page: { type: "spring", stiffness: 240, damping: 28 },
    pageOffset: 12,
    indicator: { type: "spring", stiffness: 300, damping: 30 },
    micro: { type: "spring", stiffness: 400, damping: 28 },
    card: { type: "spring", stiffness: 220, damping: 26 },
    stagger: 0.06,
    wobble: 0,
    layout: { type: "spring", stiffness: 260, damping: 30 },
  },
  // Sec et mécanique : déplacements en marches, aucune élasticité.
  brutal: {
    page: { duration: 0.24, ease: steps(3) },
    pageOffset: 12,
    indicator: { duration: 0.15, ease: steps(2) },
    micro: { duration: 0.1, ease: steps(2) },
    card: { duration: 0.2, ease: steps(3) },
    stagger: 0.04,
    wobble: 0,
    layout: { duration: 0.25, ease: steps(4) },
  },
  // Légèrement tremblé, petits rebonds.
  dessine: {
    page: { type: "spring", stiffness: 320, damping: 18 },
    pageOffset: 10,
    indicator: { type: "spring", stiffness: 380, damping: 16 },
    micro: { type: "spring", stiffness: 500, damping: 14 },
    card: { type: "spring", stiffness: 300, damping: 16 },
    stagger: 0.05,
    wobble: 0.8,
    layout: { type: "spring", stiffness: 340, damping: 22 },
  },
};

/** Version « mouvement réduit » : un simple fondu court, sans déplacement. */
export const REDUCED_PRESET: MotionPreset = {
  page: { duration: 0.15, ease: "easeOut" },
  pageOffset: 0,
  indicator: { duration: 0 },
  micro: { duration: 0 },
  card: { duration: 0.15, ease: "easeOut" },
  stagger: 0,
  wobble: 0,
  layout: { duration: 0 },
};
