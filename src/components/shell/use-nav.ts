"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { usePrefs } from "@/lib/prefs/prefs-provider";
import { visibleTabIds } from "@/lib/prefs/preferences";
import { getTab, type TabDefinition } from "@/lib/tabs";

/** Onglets visibles (ordre choisi), onglet actif et favoris de la barre du bas. */
export function useNav() {
  const pathname = usePathname();
  const { prefs } = usePrefs();

  return useMemo(() => {
    const visible = visibleTabIds(prefs)
      .map(getTab)
      .filter((t): t is TabDefinition => Boolean(t));
    const activeId = pathname.split("/")[1] ?? "";
    const favorites = prefs.favorites.map(getTab).filter((t): t is TabDefinition => Boolean(t));
    return { pathname, visible, activeId, favorites };
  }, [pathname, prefs]);
}
