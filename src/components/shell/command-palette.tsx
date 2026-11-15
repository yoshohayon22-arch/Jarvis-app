"use client";

/**
 * Palette de commandes façon Raycast (Cmd/Ctrl + K) :
 * sauter à un onglet, changer de thème, ouvrir les réglages, se déconnecter.
 * Les agents IA s'y ajouteront à partir de la Phase 2.
 * L'interface (cmdk) n'est téléchargée qu'à la première ouverture.
 */
import dynamic from "next/dynamic";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const PaletteDialog = dynamic(() => import("./palette-dialog").then((m) => m.PaletteDialog), { ssr: false });

const PaletteContext = createContext<{ open: () => void } | null>(null);

export function usePalette() {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error("usePalette doit être utilisé dans <CommandPaletteProvider>");
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setLoaded(true);
        setIsOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ctx = useMemo(
    () => ({
      open: () => {
        setLoaded(true);
        setIsOpen(true);
      },
    }),
    [],
  );

  return (
    <PaletteContext value={ctx}>
      {children}
      {loaded ? <PaletteDialog open={isOpen} onOpenChange={setIsOpen} /> : null}
    </PaletteContext>
  );
}
