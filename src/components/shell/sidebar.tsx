"use client";

/** Barre latérale repliable (ordinateur) : onglets groupés par thème, indicateur qui glisse. */
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { usePrefs } from "@/lib/prefs/prefs-provider";
import { TAB_GROUP_LABELS, type TabDefinition, type TabGroup } from "@/lib/tabs";
import { cn } from "@/lib/utils";
import { ActiveIndicator } from "./active-indicator";
import { useNav } from "./use-nav";

export function Sidebar() {
  const { visible, activeId } = useNav();
  const { prefs, update } = usePrefs();
  const collapsed = prefs.sidebarCollapsed;

  // Regroupe en conservant l'ordre choisi : un groupe apparaît à la position de son premier onglet.
  const groups: { group: TabGroup; tabs: TabDefinition[] }[] = [];
  for (const tab of visible) {
    const g = groups.find((x) => x.group === tab.group);
    if (g) g.tabs.push(tab);
    else groups.push({ group: tab.group, tabs: [tab] });
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r-[length:var(--border-width)] border-border md:flex",
        collapsed ? "w-[76px]" : "w-64",
      )}
      style={{ background: "var(--nav-bg)" }}
      aria-label="Navigation principale"
    >
      <div className={cn("flex h-16 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
        {!collapsed ? <span className="font-heading text-xl">Dashboard</span> : null}
        <button
          type="button"
          onClick={() => update({ sidebarCollapsed: !collapsed })}
          aria-label={collapsed ? "Déplier la barre latérale" : "Replier la barre latérale"}
          aria-expanded={!collapsed}
          className="btn-press ml-auto inline-flex size-11 items-center justify-center rounded-control text-text-2 hover:text-text [[data-theme=brutal]_&]:shadow-none"
        >
          {collapsed ? <PanelLeftOpen aria-hidden className="size-5" /> : <PanelLeftClose aria-hidden className="size-5" />}
        </button>
      </div>

      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        {groups.map(({ group, tabs }) => (
          <div key={group} className="mt-3 first:mt-0">
            {!collapsed ? (
              <p className="px-3 pb-1 text-xs font-medium tracking-wide text-text-2 uppercase">{TAB_GROUP_LABELS[group]}</p>
            ) : (
              <div className="mx-auto my-2 h-px w-8 bg-border" aria-hidden />
            )}
            <ul className="flex flex-col gap-0.5">
              {tabs.map((tab) => {
                const active = tab.id === activeId;
                const Icon = tab.icon;
                return (
                  <li key={tab.id}>
                    <Link
                      href={`/${tab.id}`}
                      aria-current={active ? "page" : undefined}
                      aria-label={collapsed ? tab.label : undefined}
                      title={collapsed ? tab.label : undefined}
                      className={cn(
                        "relative isolate flex min-h-11 items-center gap-3 rounded-control px-3 text-sm transition-colors",
                        active ? "font-semibold text-text" : "text-text-2 hover:text-text",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      {active ? <ActiveIndicator layoutId="sidebar-indicator" /> : null}
                      <Icon aria-hidden className="size-5 shrink-0" />
                      {!collapsed ? <span className="truncate">{tab.label}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t-[length:var(--border-width)] border-border p-3">
        <Link
          href="/reglages"
          aria-current={activeId === "reglages" ? "page" : undefined}
          aria-label={collapsed ? "Réglages" : undefined}
          className={cn(
            "relative isolate flex min-h-11 items-center gap-3 rounded-control px-3 text-sm",
            activeId === "reglages" ? "font-semibold text-text" : "text-text-2 hover:text-text",
            collapsed && "justify-center px-0",
          )}
        >
          {activeId === "reglages" ? <ActiveIndicator layoutId="sidebar-indicator" /> : null}
          <Settings aria-hidden className="size-5" />
          {!collapsed ? "Réglages" : null}
        </Link>
      </div>
    </aside>
  );
}
