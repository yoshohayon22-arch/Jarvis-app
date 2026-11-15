"use client";

/** Onglet Culture G : éphéméride, article du jour et articles les plus lus de Wikipédia en français. */
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardGrid } from "@/components/ui/card-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableCard } from "@/components/ui/expandable-card";
import { SkeletonGrid } from "@/components/ui/skeleton-card";
import { SourceNote } from "@/components/ui/source-note";
import type { CulturePayload, WikiPage } from "@/lib/culture/types";
import { useCachedFetch } from "@/lib/use-cached-fetch";

const SOURCE = "Wikipédia en français";
const ONE_HOUR = 60 * 60 * 1000;

async function fetchCulture(): Promise<CulturePayload> {
  const res = await fetch("/api/culture");
  const body = (await res.json().catch(() => null)) as (CulturePayload & { erreur?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.erreur ?? `le serveur a répondu ${res.status}`);
  return body;
}

function WikiLink({ page }: { page: WikiPage }) {
  return (
    <a href={page.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-6 items-center gap-1 underline-offset-4 hover:underline">
      {page.title}
      <ExternalLink aria-hidden className="size-3 shrink-0 text-text-2" />
    </a>
  );
}

export function CultureView() {
  const { data, error, loading, refresh } = useCachedFetch("culture", fetchCulture, ONE_HOUR);

  if (!data) {
    if (loading) return <SkeletonGrid count={3} />;
    return (
      <div className="card flex flex-col gap-3 p-5">
        <EmptyState title="Données indisponibles" reason={`Le serveur n'a pas pu lire Wikipédia (${error ?? "raison inconnue"}).`} />
        <Button onClick={refresh} className="self-start">
          Réessayer
        </Button>
        <SourceNote source={SOURCE} />
      </div>
    );
  }

  const updatedAt = new Date(data.fetchedAt);
  const day = `${data.date.slice(8, 10)}.${data.date.slice(5, 7)}`;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-end">
        <Button onClick={refresh} aria-label="Actualiser" disabled={loading}>
          <RefreshCw aria-hidden className="size-4" />
          <span className="hidden sm:inline">Actualiser</span>
        </Button>
      </div>
      <CardGrid>
        <ExpandableCard title={`Ce jour-là (${day})`}>
          <div className="flex flex-col gap-3">
            {data.onThisDay.length ? (
              <ul className="flex flex-col gap-3 text-sm">
                {data.onThisDay.map((event) => (
                  <li key={`${event.year}-${event.text}`} className="flex flex-col gap-0.5">
                    <span>
                      {event.year !== null ? <strong className="tabular-nums">{event.year} · </strong> : null}
                      {event.text}
                    </span>
                    {event.page ? (
                      <span className="text-xs text-text-2">
                        En savoir plus : <WikiLink page={event.page} />
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Pas encore de données" reason="Wikipédia ne propose pas d'éphéméride pour aujourd'hui." />
            )}
            <SourceNote source={SOURCE} updatedAt={updatedAt} />
          </div>
        </ExpandableCard>

        {data.featured ? (
          <ExpandableCard title="Article du jour">
            <div className="flex flex-col gap-3">
              <p className="font-heading text-base">
                <WikiLink page={data.featured} />
              </p>
              <p className="text-sm">{data.featured.extract}</p>
              <SourceNote source={SOURCE} updatedAt={updatedAt} />
            </div>
          </ExpandableCard>
        ) : null}

        <ExpandableCard title="Les plus lus sur Wikipédia">
          <div className="flex flex-col gap-3">
            {data.mostRead.length ? (
              <ol className="flex flex-col gap-3 text-sm">
                {data.mostRead.map((page, i) => (
                  <li key={page.url} className="flex gap-2">
                    <span className="w-5 shrink-0 text-text-2 tabular-nums">{i + 1}</span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <WikiLink page={page} />
                      {page.description ? <span className="text-xs text-text-2">{page.description}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Pas encore de données" reason="Wikipédia n'a pas encore publié le classement." />
            )}
            <SourceNote source={SOURCE} updatedAt={updatedAt} />
          </div>
        </ExpandableCard>

        <ExpandableCard title="Quiz du jour">
          <div className="flex flex-col gap-3">
            <EmptyState title="Pas disponible sur le site" reason="Le quiz est rédigé par Claude : il fonctionne dans la version artefact du Dashboard. Ici, il faudrait une clé Anthropic payante." />
            <SourceNote source="Claude" planned />
          </div>
        </ExpandableCard>
      </CardGrid>
    </div>
  );
}
