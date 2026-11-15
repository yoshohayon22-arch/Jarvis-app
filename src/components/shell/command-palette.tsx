"use client";

/**
 * Palette de commandes façon Raycast (Cmd/Ctrl + K) :
 * sauter à un onglet, changer de thème, ouvrir les réglages, se déconnecter.
 * Les agents IA s'y ajouteront à partir de la Phase 2.
 */
import { Command } from "cmdk";
import { LogOut, Palette, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePrefs } from "@/lib/prefs/prefs-provider";
import { TABS } from "@/lib/tabs";
import { THEMES, THEME_LABELS } from "@/lib/themes";

const PaletteContext = createContext<{ open: () => void } | null>(null);

export function usePalette() {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error("usePalette doit être utilisé dans <CommandPaletteProvider>");
  return ctx;
}

const itemClass =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 text-sm text-text data-[selected=true]:bg-surface-2";
const groupClass =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-text-2";

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { prefs, setTheme } = usePrefs();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = useCallback((fn: () => void) => {
    setIsOpen(false);
    fn();
  }, []);

  const logout = () => {
    // Formulaire POST vers la route de déconnexion.
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/auth/deconnexion";
    document.body.appendChild(form);
    form.submit();
  };

  // Onglets visibles d'abord, puis les onglets masqués (toujours accessibles ici).
  const tabs = useMemo(() => {
    const order = prefs.tabOrder;
    return [...TABS].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }, [prefs.tabOrder]);

  const ctx = useMemo(() => ({ open: () => setIsOpen(true) }), []);

  return (
    <PaletteContext value={ctx}>
      {children}
      <Command.Dialog
        open={isOpen}
        onOpenChange={setIsOpen}
        label="Palette de commandes"
        overlayClassName="fixed inset-0 z-50 bg-black/50"
        contentClassName="card fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden p-0 [[data-theme=glass]_&]:bg-[rgb(20_22_48/0.88)]"
        loop
      >
        <Command.Input
          placeholder="Aller à un onglet, changer de thème…"
          className="h-14 w-full border-b-[length:var(--border-width)] border-border bg-transparent px-4 text-base text-text outline-none placeholder:text-text-2"
        />
        <Command.List className="max-h-[60vh] overflow-y-auto p-1.5">
          <Command.Empty className="px-3 py-6 text-center text-sm text-text-2">Aucun résultat.</Command.Empty>
          <Command.Group heading="Onglets" className={groupClass}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const hidden = prefs.hiddenTabs.includes(tab.id);
              return (
                <Command.Item
                  key={tab.id}
                  value={`${tab.label} ${tab.id}`}
                  onSelect={() => run(() => router.push(`/${tab.id}`))}
                  className={itemClass}
                >
                  <Icon aria-hidden className="size-4 text-text-2" />
                  <span className="flex-1">{tab.label}</span>
                  {hidden ? <span className="text-xs text-text-2">masqué</span> : null}
                </Command.Item>
              );
            })}
          </Command.Group>
          <Command.Group heading="Thème" className={groupClass}>
            {THEMES.map((theme) => (
              <Command.Item
                key={theme}
                value={`thème ${THEME_LABELS[theme]}`}
                onSelect={() => run(() => setTheme(theme))}
                className={itemClass}
              >
                <Palette aria-hidden className="size-4 text-text-2" />
                <span className="flex-1">Thème {THEME_LABELS[theme]}</span>
                {prefs.theme === theme ? <span className="text-xs text-text-2">actif</span> : null}
              </Command.Item>
            ))}
          </Command.Group>
          <Command.Group heading="Actions" className={groupClass}>
            <Command.Item value="réglages paramètres" onSelect={() => run(() => router.push("/reglages"))} className={itemClass}>
              <Settings aria-hidden className="size-4 text-text-2" />
              Réglages
            </Command.Item>
            <Command.Item value="se déconnecter déconnexion" onSelect={() => run(logout)} className={itemClass}>
              <LogOut aria-hidden className="size-4 text-text-2" />
              Se déconnecter
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command.Dialog>
    </PaletteContext>
  );
}
