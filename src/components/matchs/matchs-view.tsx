"use client";

/** Onglet Matchs de la journée : journée en cours de six compétitions, heures de Genève. Source : API publique d'ESPN. */
import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CardGrid } from "@/components/ui/card-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableCard } from "@/components/ui/expandable-card";
import { LiveBadge } from "@/components/ui/live-badge";
import { SkeletonGrid } from "@/components/ui/skeleton-card";
import { SourceNote } from "@/components/ui/source-note";
import type { Match } from "@/lib/football/espn";
import type { MatchdayPayload } from "@/lib/football/leagues";
import { useCachedFetch } from "@/lib/use-cached-fetch";

const SOURCE = "ESPN";
const TWO_MINUTES = 2 * 60 * 1000;
const dayFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", weekday: "short", day: "2-digit", month: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

async function fetchMatchday(): Promise<MatchdayPayload> {
  const res = await fetch("/api/matchs");
  if (!res.ok) throw new Error(`le serveur a répondu ${res.status}`);
  return (await res.json()) as MatchdayPayload;
}

function MatchRow({ match }: { match: Match }) {
  const known = match.homeScore !== null && match.awayScore !== null;
  const date = new Date(match.date);
  return (
    <li className="flex flex-col gap-1 border-b border-border/60 py-2 text-sm last:border-b-0">
      <p className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <span className="break-words">{match.home}</span>
        <strong className="font-heading text-base tabular-nums">{known ? `${match.homeScore} – ${match.awayScore}` : "–"}</strong>
        <span className="break-words text-right">{match.away}</span>
      </p>
      <p className="flex flex-wrap items-center gap-2 text-xs text-text-2">
        {match.state === "in" ? <LiveBadge label={match.clock ? `EN DIRECT · ${match.clock}` : "EN DIRECT"} /> : null}
        <span className="capitalize">
          {dayFmt.format(date)} à {timeFmt.format(date)}
        </span>
        {match.state === "post" ? <span>Terminé</span> : null}
      </p>
    </li>
  );
}

export function MatchsView() {
  const { data, error, loading, refresh } = useCachedFetch("matchs-journee", fetchMatchday, TWO_MINUTES);

  // Pendant un match, on redemande les scores toutes les deux minutes.
  const live = data?.leagues.some((l) => l.matches.ok && l.matches.data.some((m) => m.state === "in")) ?? false;
  useEffect(() => {
    if (!live) return;
    const id = setInterval(refresh, TWO_MINUTES);
    return () => clearInterval(id);
  }, [live, refresh]);

  if (!data) {
    if (loading) return <SkeletonGrid count={6} />;
    return (
      <div className="card flex flex-col gap-3 p-5">
        <EmptyState title="Données indisponibles" reason={`Le serveur n'a pas pu lire les matchs (${error ?? "raison inconnue"}).`} />
        <Button onClick={refresh} className="self-start">
          Réessayer
        </Button>
        <SourceNote source={SOURCE} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-2">Journée en cours de {data.leagues.length} compétitions · heures de Genève</p>
        <Button onClick={refresh} aria-label="Actualiser les matchs" disabled={loading}>
          <RefreshCw aria-hidden className="size-4" />
          <span className="hidden sm:inline">Actualiser</span>
        </Button>
      </div>
      <CardGrid>
        {data.leagues.map((league) => {
          const part = league.matches;
          return (
            <ExpandableCard
              key={league.slug}
              title={league.name}
              badge={part.ok && part.data.length ? <span className="text-xs text-text-2">{part.data.length} match{part.data.length > 1 ? "s" : ""}</span> : undefined}
              detail={part.ok && part.data.length > 8 ? <ul>{part.data.slice(8).map((m) => <MatchRow key={m.id} match={m} />)}</ul> : undefined}
            >
              <div className="flex flex-col gap-3">
                {!part.ok ? (
                  <EmptyState title="Pas de données" reason={`La source n'a pas fourni cette information (${part.error}).`} />
                ) : part.data.length ? (
                  <ul>
                    {part.data.slice(0, 8).map((m) => (
                      <MatchRow key={m.id} match={m} />
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="Pas encore de données" reason="ESPN n'affiche aucun match pour la journée en cours." />
                )}
                <SourceNote source={SOURCE} updatedAt={part.ok ? new Date(part.fetchedAt) : undefined} />
              </div>
            </ExpandableCard>
          );
        })}
      </CardGrid>
      <div className="card p-5">
        <EmptyState
          title="Chaînes TV : pas de données"
          reason="Aucune source publique et fiable n'indique la chaîne de diffusion en Suisse. ESPN ne donne que les chaînes américaines : elles ne sont donc pas affichées."
        />
      </div>
    </div>
  );
}
