/**
 * Préférences de l'utilisateur (thème, ordre des onglets, onglets masqués, favoris).
 * Elles sont gardées localement (localStorage, pour un affichage instantané)
 * et synchronisées dans Supabase (table public.preferences) quand la connexion est configurée.
 */
import { DEFAULT_FAVORITES, DEFAULT_ORDER, MAX_FAVORITES, TAB_IDS } from "@/lib/tabs";
import { DEFAULT_THEME, isTheme, type ThemeId } from "@/lib/themes";

export interface Preferences {
  theme: ThemeId;
  tabOrder: string[];
  hiddenTabs: string[];
  favorites: string[];
  sidebarCollapsed: boolean;
  /** Horodatage ISO de la dernière modification, pour arbitrer local / Supabase. */
  updatedAt: string;
}

export const PREFS_STORAGE_KEY = "dashboard-prefs";

export const DEFAULT_PREFERENCES: Preferences = {
  theme: DEFAULT_THEME,
  tabOrder: DEFAULT_ORDER,
  hiddenTabs: [],
  favorites: DEFAULT_FAVORITES,
  sidebarCollapsed: false,
  updatedAt: new Date(0).toISOString(),
};

const known = (ids: unknown): string[] =>
  Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string" && TAB_IDS.includes(id)) : [];

/**
 * Nettoie des préférences venues de l'extérieur (localStorage, base) :
 * onglets inconnus retirés, nouveaux onglets ajoutés à la fin, au plus 4 favoris visibles.
 */
export function normalizePreferences(raw: Partial<Preferences> | null | undefined): Preferences {
  const order = known(raw?.tabOrder);
  const tabOrder = [...new Set([...order, ...DEFAULT_ORDER])];
  const hiddenTabs = known(raw?.hiddenTabs);
  const favorites = (raw?.favorites ? known(raw.favorites) : DEFAULT_FAVORITES)
    .filter((id) => !hiddenTabs.includes(id))
    .slice(0, MAX_FAVORITES);
  return {
    theme: isTheme(raw?.theme) ? raw.theme : DEFAULT_THEME,
    tabOrder,
    hiddenTabs,
    favorites,
    sidebarCollapsed: Boolean(raw?.sidebarCollapsed),
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : DEFAULT_PREFERENCES.updatedAt,
  };
}

/** Onglets visibles, dans l'ordre choisi. */
export function visibleTabIds(prefs: Preferences): string[] {
  return prefs.tabOrder.filter((id) => !prefs.hiddenTabs.includes(id));
}
