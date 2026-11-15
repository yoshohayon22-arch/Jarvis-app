"use client";

/** Barre d'onglets du bas (téléphone) : 4 favoris + « Plus » qui ouvre la liste complète. */
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Ellipsis, Settings, X } from "lucide-react";
import { useState } from "react";
import { useMotionPreset } from "@/lib/motion/use-motion-preset";
import { TAB_GROUP_LABELS, type TabDefinition, type TabGroup } from "@/lib/tabs";
import { cn } from "@/lib/utils";
import { ActiveIndicator } from "./active-indicator";
import { useNav } from "./use-nav";

export function BottomNav() {
  const { favorites, visible, activeId } = useNav();
  const [moreOpen, setMoreOpen] = useState(false);
  const preset = useMotionPreset();
  const favoriteIds = favorites.map((f) => f.id);
  const activeInMore = !favoriteIds.includes(activeId) && activeId !== "";

  const others = visible.filter((t) => !favoriteIds.includes(t.id));
  const groups: { group: TabGroup; tabs: TabDefinition[] }[] = [];
  for (const tab of others) {
    const g = groups.find((x) => x.group === tab.group);
    if (g) g.tabs.push(tab);
    else groups.push({ group: tab.group, tabs: [tab] });
  }

  const item = "relative isolate flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-control text-[11px]";

  return (
    <>
      <nav
        aria-label="Onglets favoris"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t-[length:var(--border-width)] border-border backdrop-blur-xl md:hidden"
        style={{ background: "var(--nav-bg)" }}
      >
        <ul className="mx-auto flex max-w-xl gap-1 px-2 py-1.5">
          {favorites.map((tab) => {
            const active = tab.id === activeId;
            const Icon = tab.icon;
            return (
              <li key={tab.id} className="flex flex-1">
                <Link
                  href={`/${tab.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(item, active ? "font-semibold text-text" : "text-text-2")}
                >
                  {active ? <ActiveIndicator layoutId="bottom-indicator" /> : null}
                  <Icon aria-hidden className="size-5" />
                  <span className="max-w-full truncate px-1">{tab.shortLabel}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(item, activeInMore ? "font-semibold text-text" : "text-text-2")}
            >
              {activeInMore ? <ActiveIndicator layoutId="bottom-indicator" /> : null}
              <Ellipsis aria-hidden className="size-5" />
              <span>Plus</span>
            </button>
          </li>
        </ul>
      </nav>

      <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <AnimatePresence>
          {moreOpen ? (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-50 bg-black/50 md:hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount aria-describedby={undefined}>
                <motion.div
                  className="card safe-bottom fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-b-none p-4 md:hidden [[data-theme=glass]_&]:bg-[rgb(20_22_48/0.85)]"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={preset.page}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Dialog.Title className="font-heading text-xl">Tous les onglets</Dialog.Title>
                    <Dialog.Close
                      aria-label="Fermer"
                      className="btn-press inline-flex size-11 items-center justify-center rounded-control text-text-2"
                    >
                      <X aria-hidden className="size-5" />
                    </Dialog.Close>
                  </div>
                  {groups.map(({ group, tabs }) => (
                    <section key={group} className="mt-3">
                      <h2 className="mb-1 text-xs font-medium tracking-wide text-text-2 uppercase">{TAB_GROUP_LABELS[group]}</h2>
                      <ul className="grid grid-cols-3 gap-2">
                        {tabs.map((tab) => {
                          const Icon = tab.icon;
                          const active = tab.id === activeId;
                          return (
                            <li key={tab.id}>
                              <Link
                                href={`/${tab.id}`}
                                onClick={() => setMoreOpen(false)}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                  "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-control border-[length:var(--border-width)] border-border p-2 text-center text-xs",
                                  active ? "bg-accent-soft font-semibold text-text" : "bg-surface-2 text-text",
                                )}
                              >
                                <Icon aria-hidden className="size-5" />
                                {tab.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                  <Link
                    href="/reglages"
                    onClick={() => setMoreOpen(false)}
                    className="mt-4 flex min-h-11 items-center gap-2 rounded-control px-2 text-sm text-text-2"
                  >
                    <Settings aria-hidden className="size-4" /> Réglages
                  </Link>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          ) : null}
        </AnimatePresence>
      </Dialog.Root>
    </>
  );
}
