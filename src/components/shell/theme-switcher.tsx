"use client";

/** Sélecteur de thème (en-tête). Le changement se fait par révélation circulaire depuis le bouton. */
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Gem, Moon, Palette, PenLine, Square } from "lucide-react";
import { useRef } from "react";
import { usePrefs } from "@/lib/prefs/prefs-provider";
import { THEMES, THEME_LABELS, type ThemeId } from "@/lib/themes";

const THEME_ICONS: Record<ThemeId, typeof Moon> = {
  nuit: Moon,
  glass: Gem,
  brutal: Square,
  dessine: PenLine,
};

export function ThemeSwitcher() {
  const { prefs, setTheme } = usePrefs();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const origin = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined;
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        ref={triggerRef}
        aria-label={`Changer de thème (actuel : ${THEME_LABELS[prefs.theme]})`}
        className="btn-press inline-flex size-11 items-center justify-center rounded-control border-[length:var(--border-width)] border-border bg-surface text-text"
      >
        <Palette aria-hidden className="size-5" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="card z-50 min-w-56 p-1.5 [[data-theme=glass]_&]:bg-[rgb(20_22_48/0.85)]"
        >
          <DropdownMenu.Label className="px-3 py-2 text-xs text-text-2">Thème</DropdownMenu.Label>
          {THEMES.map((theme) => {
            const Icon = THEME_ICONS[theme];
            const active = theme === prefs.theme;
            return (
              <DropdownMenu.Item
                key={theme}
                onSelect={() => setTheme(theme, origin())}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 text-sm text-text outline-none data-[highlighted]:bg-surface-2"
              >
                <Icon aria-hidden className="size-4 text-text-2" />
                <span className="flex-1">{THEME_LABELS[theme]}</span>
                {active ? <Check aria-label="Thème actif" className="size-4 text-text" /> : null}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
