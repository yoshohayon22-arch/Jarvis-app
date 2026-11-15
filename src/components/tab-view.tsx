"use client";

/**
 * Contenu d'un onglet. En Phase 0, aucune source n'est encore branchée :
 * chaque carte affiche un état vide honnête et la source prévue (aucune donnée inventée).
 */
import { CardGrid } from "@/components/ui/card-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableCard } from "@/components/ui/expandable-card";
import { SourceNote } from "@/components/ui/source-note";
import { getTab } from "@/lib/tabs";

export function TabView({ tabId }: { tabId: string }) {
  const tab = getTab(tabId);
  if (!tab) return null;

  const reason = `Cet onglet sera branché en Phase ${tab.phase}.`;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-text-2">
        {tab.cards.length} carte{tab.cards.length > 1 ? "s" : ""} prévue{tab.cards.length > 1 ? "s" : ""} · Phase {tab.phase}
      </p>
      <CardGrid>
        {tab.cards.map((card) => (
          <ExpandableCard
            key={card.title}
            title={card.title}
            badge={
              <span className="rounded-full border-[length:var(--border-width)] border-border px-2 py-0.5 text-xs text-text-2">
                Phase {tab.phase}
              </span>
            }
            detail={
              <div className="flex flex-col gap-3 border-t-[length:var(--border-width)] border-border pt-4 text-sm">
                <p className="text-text">{card.description}</p>
                <p className="text-text-2">
                  Les données apparaîtront ici dès que la source sera branchée. Chaque information affichera sa source et son heure de mise à jour.
                </p>
              </div>
            }
          >
            <div className="flex flex-col gap-3">
              <EmptyState reason={reason} />
              <SourceNote source={card.source} planned />
            </div>
          </ExpandableCard>
        ))}
      </CardGrid>
    </div>
  );
}
