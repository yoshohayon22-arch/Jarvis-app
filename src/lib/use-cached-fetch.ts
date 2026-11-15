"use client";

import { useCallback, useEffect, useState } from "react";

export interface CachedFetchState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * Charge une donnée côté navigateur avec un petit cache (sessionStorage) :
 * on réutilise la dernière réponse tant qu'elle a moins de `maxAgeMs`,
 * ce qui évite de solliciter la source à chaque changement d'onglet.
 */
export function useCachedFetch<T>(key: string, fetcher: () => Promise<T>, maxAgeMs: number): CachedFetchState<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const storageKey = `cache:${key}`;
    const force = tick > 0;

    (async () => {
      if (!force) {
        try {
          const raw = sessionStorage.getItem(storageKey);
          if (raw) {
            const cached = JSON.parse(raw) as { at: number; data: T };
            if (Date.now() - cached.at < maxAgeMs) {
              if (!cancelled) setState({ data: cached.data, error: null, loading: false });
              return;
            }
          }
        } catch {
          // Cache illisible : on recharge.
        }
      }
      try {
        const data = await fetcher();
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({ at: Date.now(), data }));
        } catch {
          // Stockage indisponible : pas grave.
        }
        if (!cancelled) setState({ data, error: null, loading: false });
      } catch (e) {
        if (!cancelled) {
          setState((prev) => ({ data: prev.data, error: e instanceof Error ? e.message : "Erreur inconnue", loading: false }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // fetcher est volontairement exclu : il est stable par construction (fonction de module).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, maxAgeMs, tick]);

  const refresh = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true }));
    setTick((t) => t + 1);
  }, []);

  return { ...state, refresh };
}
