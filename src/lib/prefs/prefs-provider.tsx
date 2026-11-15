"use client";

/**
 * Fournisseur des préférences : état local instantané (localStorage)
 * + synchronisation Supabase (table public.preferences) si la connexion est configurée.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { THEME_COLORS, THEME_STORAGE_KEY, isTheme, type ThemeId } from "@/lib/themes";
import {
  DEFAULT_PREFERENCES,
  PREFS_STORAGE_KEY,
  normalizePreferences,
  type Preferences,
} from "./preferences";

interface PrefsContextValue {
  prefs: Preferences;
  /** true une fois les préférences locales chargées (évite d'animer sur des valeurs par défaut). */
  ready: boolean;
  update: (patch: Partial<Omit<Preferences, "updatedAt">>) => void;
  /** Change de thème avec une révélation circulaire depuis le point (x, y). */
  setTheme: (theme: ThemeId, origin?: { x: number; y: number }) => void;
  reset: () => void;
}

const PrefsContext = createContext<PrefsContextValue | null>(null);

function readLocal(): Preferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Preferences>) : {};
    // Le thème a sa propre clé (lue par le script anti-flash dans <head>).
    const theme = localStorage.getItem(THEME_STORAGE_KEY);
    return normalizePreferences({ ...parsed, theme: isTheme(theme) ? theme : parsed.theme });
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function writeLocal(prefs: Preferences) {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    localStorage.setItem(THEME_STORAGE_KEY, prefs.theme);
  } catch {
    // Navigation privée ou stockage plein : les préférences restent en mémoire.
  }
}

function applyThemeToDocument(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

/*
 * Petit magasin externe : lu via useSyncExternalStore pour que le rendu serveur
 * utilise les valeurs par défaut et que le navigateur bascule ensuite sur les valeurs locales,
 * sans erreur d'hydratation.
 */
let current: Preferences | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => (current ??= readLocal());
const getServerSnapshot = () => DEFAULT_PREFERENCES;
function setStore(next: Preferences) {
  current = next;
  writeLocal(next);
  listeners.forEach((l) => l());
}
const noopSubscribe = () => () => {};

type Row = {
  theme: string;
  tab_order: string[];
  hidden_tabs: string[];
  favorites: string[];
  sidebar_collapsed: boolean;
  updated_at: string;
};

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const userIdRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Préférences locales déjà lues par le magasin ; on complète depuis Supabase si possible.
  useEffect(() => {
    const local = getSnapshot();

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId || cancelled) return;
      userIdRef.current = userId;
      const { data } = await supabase.from("preferences").select("*").eq("user_id", userId).maybeSingle<Row>();
      if (!data || cancelled) return;
      // La version la plus récente gagne.
      if (new Date(data.updated_at) > new Date(local.updatedAt)) {
        const remote = normalizePreferences({
          theme: data.theme as ThemeId,
          tabOrder: data.tab_order,
          hiddenTabs: data.hidden_tabs,
          favorites: data.favorites,
          sidebarCollapsed: data.sidebar_collapsed,
          updatedAt: data.updated_at,
        });
        setStore(remote);
        applyThemeToDocument(remote.theme);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Sauvegarde Supabase différée (regroupe les changements rapprochés).
  const scheduleRemoteSave = useCallback((next: Preferences) => {
    const supabase = getSupabaseBrowserClient();
    const userId = userIdRef.current;
    if (!supabase || !userId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void supabase.from("preferences").upsert({
        user_id: userId,
        theme: next.theme,
        tab_order: next.tabOrder,
        hidden_tabs: next.hiddenTabs,
        favorites: next.favorites,
        sidebar_collapsed: next.sidebarCollapsed,
        updated_at: next.updatedAt,
      });
    }, 600);
  }, []);

  const commit = useCallback(
    (producer: (prev: Preferences) => Preferences) => {
      const next = normalizePreferences({ ...producer(getSnapshot()), updatedAt: new Date().toISOString() });
      setStore(next);
      scheduleRemoteSave(next);
    },
    [scheduleRemoteSave],
  );

  const update = useCallback<PrefsContextValue["update"]>(
    (patch) => commit((prev) => ({ ...prev, ...patch })),
    [commit],
  );

  const setTheme = useCallback<PrefsContextValue["setTheme"]>(
    (theme, origin) => {
      const apply = () => {
        flushSync(() => commit((prev) => ({ ...prev, theme })));
        applyThemeToDocument(theme);
      };
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!document.startViewTransition || reduced) {
        apply();
        return;
      }
      // Révélation circulaire depuis le bouton (View Transitions API).
      const x = origin?.x ?? window.innerWidth / 2;
      const y = origin?.y ?? 0;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      const transition = document.startViewTransition(apply);
      transition.ready
        .then(() => {
          document.documentElement.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            {
              duration: theme === "brutal" ? 260 : 420,
              easing: theme === "brutal" ? "steps(4, end)" : "cubic-bezier(0.22, 1, 0.36, 1)",
              pseudoElement: "::view-transition-new(root)",
            },
          );
        })
        .catch(() => {});
    },
    [commit],
  );

  const reset = useCallback(() => {
    commit((prev) => ({ ...DEFAULT_PREFERENCES, theme: prev.theme }));
  }, [commit]);

  const value = useMemo(() => ({ prefs, ready, update, setTheme, reset }), [prefs, ready, update, setTheme, reset]);

  return <PrefsContext value={value}>{children}</PrefsContext>;
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs doit être utilisé dans <PrefsProvider>");
  return ctx;
}
