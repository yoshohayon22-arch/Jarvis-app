"use client";

/**
 * Coque de l'application : barre latérale (ordinateur), en-tête, contenu animé,
 * barre du bas (téléphone), swipe horizontal entre onglets et palette Cmd+K.
 */
import { motion } from "motion/react";
import { Search, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useMotionPreset } from "@/lib/motion/use-motion-preset";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getTab } from "@/lib/tabs";
import { BottomNav } from "./bottom-nav";
import { CommandPaletteProvider, usePalette } from "./command-palette";
import { GlassBackdrop } from "./glass-backdrop";
import { Sidebar } from "./sidebar";
import { ThemeSwitcher } from "./theme-switcher";
import { useNav } from "./use-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      <GlassBackdrop />
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          {!isSupabaseConfigured ? <DemoBanner /> : null}
          <AnimatedContent>{children}</AnimatedContent>
        </div>
      </div>
      <BottomNav />
    </CommandPaletteProvider>
  );
}

function Header() {
  const { activeId } = useNav();
  const { open } = usePalette();
  const title = activeId === "reglages" ? "Réglages" : (getTab(activeId)?.label ?? "Dashboard");

  return (
    <header className="safe-top sticky top-0 z-30 border-b-[length:var(--border-width)] border-border backdrop-blur-xl" style={{ background: "var(--nav-bg)" }}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 md:px-8">
        <h1 className="min-w-0 flex-1 truncate text-xl md:text-2xl">{title}</h1>
        <button
          type="button"
          onClick={open}
          aria-label="Ouvrir la palette de commandes (Ctrl + K)"
          className="btn-press inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-control border-[length:var(--border-width)] border-border bg-surface px-3 text-sm text-text-2"
        >
          <Search aria-hidden className="size-4" />
          <span className="hidden lg:inline">Rechercher…</span>
          <kbd className="hidden rounded border border-border px-1.5 text-xs lg:inline">Ctrl K</kbd>
        </button>
        <ThemeSwitcher />
        <Link
          href="/reglages"
          aria-label="Réglages"
          className="btn-press inline-flex size-11 items-center justify-center rounded-control border-[length:var(--border-width)] border-border bg-surface text-text md:hidden"
        >
          <Settings aria-hidden className="size-5" />
        </Link>
      </div>
    </header>
  );
}

function DemoBanner() {
  return (
    <div role="note" className="mx-auto mt-4 w-full max-w-7xl px-4 md:px-8">
      <p className="rounded-control border-[length:var(--border-width)] border-border bg-accent-soft px-4 py-2 text-sm text-text">
        Mode local : Supabase n&apos;est pas encore configuré, la connexion Google est désactivée et les préférences restent sur cet appareil.
      </p>
    </div>
  );
}

/**
 * Contenu de l'onglet : entrée en fondu + glissement de 8–12 px selon la direction
 * (onglet suivant → depuis la droite, précédent → depuis la gauche).
 * Le swipe horizontal (téléphone) passe à l'onglet voisin.
 */
function AnimatedContent({ children }: { children: React.ReactNode }) {
  const { pathname, visible, activeId } = useNav();
  const preset = useMotionPreset();
  const router = useRouter();
  const index = visible.findIndex((t) => t.id === activeId);

  // Direction calculée à partir de l'onglet précédent (mise à jour pendant le rendu, pattern React documenté).
  const [prev, setPrev] = useState({ path: pathname, index, dir: 0 });
  if (prev.path !== pathname) {
    setPrev({ path: pathname, index, dir: index >= 0 && prev.index >= 0 ? Math.sign(index - prev.index) : 0 });
  }
  const dir = prev.path === pathname ? prev.dir : 0;

  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || index < 0) return;
    // Pas de swipe si on fait défiler une zone horizontale (carrousel, tableau…).
    if ((e.target as HTMLElement).closest("[data-no-swipe]")) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const fast = Date.now() - start.t < 600;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8 && fast) {
      const next = visible[index + (dx < 0 ? 1 : -1)];
      if (next) router.push(`/${next.id}`);
    }
  };

  return (
    <main
      id="contenu"
      className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-12"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: dir * preset.pageOffset }}
        animate={{ opacity: 1, x: 0 }}
        transition={preset.page}
      >
        {children}
      </motion.div>
    </main>
  );
}
