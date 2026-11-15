"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Données personnelles enregistrées sur l'appareil (localStorage du navigateur).
 * Elles ne quittent pas l'appareil : pas de compte ni de base de données nécessaires,
 * mais elles ne sont pas synchronisées entre appareils (voir la sauvegarde dans les Réglages).
 */
export const LOCAL_PREFIX = "dash-data:";

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Autre onglet du navigateur : on se met à jour quand il écrit.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export const notifyLocalData = () => listeners.forEach((l) => l());

function read<T>(key: string, parse: (raw: unknown) => T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LOCAL_PREFIX + key);
  } catch {
    // Stockage indisponible (navigation privée stricte) : on affiche des listes vides.
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T;
  try {
    value = parse(raw ? JSON.parse(raw) : null);
  } catch {
    value = parse(null);
  }
  cache.set(key, { raw, value });
  return value;
}

/**
 * Lit et modifie une donnée locale. `parse` valide ce qui est stocké (et fournit la valeur vide pour `null`).
 * `update` renvoie false si l'enregistrement a échoué (stockage plein ou bloqué).
 */
export function useLocalData<T>(key: string, parse: (raw: unknown) => T, empty: T): [T, (change: (previous: T) => T) => boolean] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, parse),
    () => empty,
  );
  const update = useCallback(
    (change: (previous: T) => T) => {
      try {
        localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(change(read(key, parse))));
      } catch {
        return false;
      }
      notifyLocalData();
      return true;
    },
    [key, parse],
  );
  return [value, update];
}

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
export const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
export const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
export const rows = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);

/** Jour civil à Genève, au format aaaa-mm-jj. */
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());
export const dayLabel = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;

/** N'accepte qu'un lien http(s). */
export function safeUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}
