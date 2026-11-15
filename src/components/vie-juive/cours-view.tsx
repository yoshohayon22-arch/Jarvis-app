"use client";

/** Cours audio et vidéo : dernières vidéos de la chaîne YouTube officielle de Torah-Box, avec lecteur intégré. */
import { ExternalLink, Play, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardGrid } from "@/components/ui/card-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonGrid } from "@/components/ui/skeleton-card";
import { SourceNote } from "@/components/ui/source-note";
import { formatDate } from "@/lib/format";
import type { Article, NewsPayload } from "@/lib/rss/types";
import { useCachedFetch } from "@/lib/use-cached-fetch";
import { cn } from "@/lib/utils";

async function fetchCours(): Promise<NewsPayload> {
  const res = await fetch("/api/presse?onglet=cours");
  if (!res.ok) throw new Error(`le serveur a répondu ${res.status}`);
  return (await res.json()) as NewsPayload;
}

const videoId = (link: string) => link.match(/[?&]v=([\w-]{6,})/)?.[1] ?? link.match(/shorts\/([\w-]{6,})/)?.[1] ?? null;

function VideoCard({ video }: { video: Article }) {
  const [playing, setPlaying] = useState(false);
  const id = videoId(video.link);
  return (
    <article className="card flex h-full flex-col overflow-hidden">
      <div className="relative aspect-video bg-surface-2">
        {id && playing ? (
          // Lecteur YouTube sans cookies de suivi ; chargé seulement quand tu lances la vidéo.
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        ) : id ? (
          <button type="button" onClick={() => setPlaying(true)} aria-label={`Lire la vidéo : ${video.title}`} className="group absolute inset-0 size-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <span className="flex size-14 items-center justify-center rounded-full bg-accent text-on-accent transition-transform group-hover:scale-105 motion-reduce:transition-none">
                <Play aria-hidden className="size-6 translate-x-0.5" />
              </span>
            </span>
          </button>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="text-base leading-snug">{video.title}</h2>
        <p className="mt-auto flex items-center justify-between gap-2 text-xs text-text-2">
          <span>{video.publishedAt ? formatDate(new Date(video.publishedAt)) : "date inconnue"}</span>
          <a href={video.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4">
            Voir sur YouTube <ExternalLink aria-hidden className="size-3" />
          </a>
        </p>
      </div>
    </article>
  );
}

export function CoursView() {
  const { data, error, loading, refresh } = useCachedFetch("cours", fetchCours, 30 * 60 * 1000);

  if (!data) {
    if (loading) return <SkeletonGrid count={6} />;
    return (
      <div className="card flex flex-col gap-3 p-5">
        <EmptyState title="Cours indisponibles" reason={`La chaîne n'a pas pu être lue (${error ?? "raison inconnue"}).`} />
        <Button variant="secondary" onClick={refresh} className="self-start">
          Réessayer
        </Button>
      </div>
    );
  }

  const failed = data.sources.find((s) => !s.ok);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-2">Les dernières vidéos publiées par Torah-Box. La vidéo ne se charge que lorsque tu appuies sur lecture.</p>
        <Button variant="secondary" onClick={refresh} disabled={loading} aria-label="Actualiser" className="shrink-0">
          <RefreshCw aria-hidden className={cn(loading && "animate-spin motion-reduce:animate-none")} />
          <span className="hidden sm:inline">Actualiser</span>
        </Button>
      </div>
      {data.articles.length ? (
        <CardGrid>
          {data.articles.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </CardGrid>
      ) : (
        <div className="card p-5">
          <EmptyState
            title="Aucun cours récent"
            reason={failed ? `La chaîne YouTube de Torah-Box n'a pas pu être lue (${failed.error}).` : "Aucune vidéo publiée ces 60 derniers jours sur la chaîne."}
          />
        </div>
      )}
      <SourceNote source="chaîne YouTube officielle de Torah-Box (flux public)" updatedAt={new Date(data.fetchedAt)} />
    </div>
  );
}
