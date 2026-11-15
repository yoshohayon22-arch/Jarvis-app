"use client";

/** Interface de la palette de commandes (chargée à la demande). */
import { Command } from "cmdk";
import { LogOut, Palette, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { usePrefs } from "@/lib/prefs/prefs-provider";
import { TABS } from "@/lib/tabs";
import { THEMES, THEME_LABELS } from "@/lib/themes";

const itemClass =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 text-sm text-text data-[selected=true]:bg-surface-2";
const groupClass =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-text-2";

export function PaletteDialog({ open: isOpen, onOpenChange: setIsOpen }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { prefs, setTheme } = usePrefs();

  const run = useCallback(
    (fn: () => void) => {
      setIsOpen(false);
      fn();
    },
    [setIsOpen],
  );

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

  return (
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
  );
}
