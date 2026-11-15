"use client";

import { useReducedMotion } from "motion/react";
import { usePrefs } from "@/lib/prefs/prefs-provider";
import { MOTION_PRESETS, REDUCED_PRESET, type MotionPreset } from "./presets";

/** Renvoie la personnalité de mouvement du thème actif (ou un simple fondu si mouvement réduit). */
export function useMotionPreset(): MotionPreset {
  const { prefs } = usePrefs();
  const reduced = useReducedMotion();
  return reduced ? REDUCED_PRESET : MOTION_PRESETS[prefs.theme];
}
