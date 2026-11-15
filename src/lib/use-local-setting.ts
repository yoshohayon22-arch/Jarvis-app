"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Petit réglage mémorisé sur l'appareil (ex. délai d'allumage des bougies). Valeur par défaut côté serveur. */
export function useLocalSetting(key: string, fallback: number): [number, (value: number) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        const raw = Number(localStorage.getItem(key));
        return Number.isFinite(raw) && raw > 0 ? raw : fallback;
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );
  const set = useCallback(
    (next: number) => {
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // Stockage indisponible : le réglage vaudra pour cette visite seulement.
      }
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, set];
}
