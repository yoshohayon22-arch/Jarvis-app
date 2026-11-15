"use client";

/**
 * Onglets La Une et Foot général : titres, courts résumés et liens vers les articles originaux,
 * lus dans les flux RSS des éditeurs. Filtres par rubrique et par journal.
 */
import { ExternalLink, Lock, RefreshCw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CardGrid } from "@/components/ui/card-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonGrid } from "@/components/ui/skeleton-card";
import { SourceNote } from "@/components/ui/source-note";
import { formatDateTime } from "@/lib/format";
import { GROUP_LABELS, REAL_MADRID_PATTERN, type NewsGroup, type NewsTab } from "@/lib/rss/sources";
import type { Article, NewsPayload } from "@/lib/rss/types";
import { useCachedFetch } from "@/lib/use-cached-fetch";
import { cn } from "@/lib/utils";

const TEN_MINUTES = 10 * 60 * 1000;
const PAGE = 24;
const LANG_LABELS = { fr: null, en: "anglais", es: "espagnol" } as const;

const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
function timeAgo(iso: string | null, now: number): string {
  if (!iso) return "date inconnue";
  const minutes = Math.round((new Date(iso).getTime() - now) / 60000);
  if (minutes > -1) return "à l'instant";
  if (minutes > -60) return relative.format(minutes, "minute");
  if (minutes > -24 * 60) return relative.format(Math.round(minutes / 60), "hour");
  return relative.format(Math.round(minutes / 1440), "day");
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "btn-press min-h-11 shrink-0 rounded-full border-[length:var(--border-width)] px-4 text-sm whitespace-nowrap [[data-theme=brutal]_&]:shadow-none [[data-theme=dessine]_&]:shadow-none",
        active ? "border-accent bg-accent-soft font-semibold text-text" : "border-border bg-surface text-text-2",
      )}
    >
      {children}
    </button>
  );
}

function ArticleCard({ article, now }: { article: Article; now: number }) {
  const lang = LANG_LABELS[article.lang];
  return (
    <article className="card card-hover flex h-full flex-col gap-2 p-5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-2">
        <span className="font-semibold text-text">{article.sourceName}</span>
        <time dateTime={article.publishedAt ?? undefined} title={article.publishedAt ? formatDateTime(new Date(article.publishedAt)) : undefined}>
          {timeAgo(article.publishedAt, now)}
        </time>
        {lang ? <span className="rounded-full border border-border px-1.5">{lang}</span> : null}
        {article.paywall ? (
          <span className="inline-flex items-center gap-1" title="Certains articles de ce journal sont réservés à ses abonnés">
            <Lock aria-hidden className="size-3" />
            <span className="sr-only">Peut être réservé aux abonnés</span>
          </span>
        ) : null}
      </p>
      <h2 className="text-base leading-snug">
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          lang={article.lang}
          className="after:absolute after:inset-0 after:rounded-[inherit] hover:underline"
        >
          {article.title}
        </a>
      </h2>
      {article.summary ? (
        <p lang={article.lang} className="line-clamp-3 text-sm text-text-2">
          {article.summary}
        </p>
      ) : null}
      <p className="mt-auto flex items-center gap-1 pt-1 text-xs text-text-2">
        <ExternalLink aria-hidden className="size-3" />
        Lire sur le site du journal
      </p>
    </article>
  );
}

export function NewsView({ tab }: { tab: NewsTab }) {
  const fetcher = useCallback(async (): Promise<NewsPayload> => {
    const res = await fetch(`/api/presse?onglet=${tab}`);
    if (!res.ok) throw new Error(`le serveur a répondu ${res.status}`);
    return (await res.json()) as NewsPayload;
  }, [tab]);
  const { data, error, loading, refresh } = useCachedFetch(`presse-${tab}`, fetcher, TEN_MINUTES);

  const [group, setGroup] = useState<NewsGroup | "tout">("tout");
  const [sourceId, setSourceId] = useState<string | "toutes">("toutes");
  const [realOnly, setRealOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const groups = useMemo(() => [...new Set((data?.sources ?? []).map((s) => s.group))], [data]);
  const sourcesInGroup = useMemo(
    () => (data?.sources ?? []).filter((s) => s.ok && s.count > 0 && (group === "tout" || s.group === group)),
    [data, group],
  );
  const filtered = useMemo(
    () =>
      (data?.articles ?? []).filter(
        (a) =>
          (group === "tout" || a.group === group) &&
          (sourceId === "toutes" || a.sourceId === sourceId) &&
          (!realOnly || REAL_MADRID_PATTERN.test(`${a.title} ${a.summary}`)),
      ),
    [data, group, sourceId, realOnly],
  );

  if (!data) {
    if (loading) return <SkeletonGrid count={6} />;
    return (
      <div className="card flex flex-col gap-3 p-5">
        <EmptyState
          title="Articles indisponibles"
          reason={`Les flux des journaux n'ont pas pu être lus (${error ?? "raison inconnue"}). Rien n'est affiché plutôt qu'un contenu inventé.`}
        />
        <Button variant="secondary" onClick={refresh} className="self-start">
          Réessayer
        </Button>
      </div>
    );
  }

  const now = new Date(data.fetchedAt).getTime();
  const failed = data.sources.filter((s) => !s.ok);
  const silent = data.sources.filter((s) => s.ok && s.count === 0);
  const selectGroup = (g: NewsGroup | "tout") => {
    setGroup(g);
    setSourceId("toutes");
    setLimit(PAGE);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1" data-no-swipe role="group" aria-label="Filtrer par rubrique">
            <Chip active={group === "tout"} onClick={() => selectGroup("tout")}>
              Tout
            </Chip>
            {groups.map((g) => (
              <Chip key={g} active={group === g} onClick={() => selectGroup(g)}>
                {GROUP_LABELS[g]}
              </Chip>
            ))}
            {tab === "foot" ? (
              <Chip
                active={realOnly}
                onClick={() => {
                  setRealOnly((v) => !v);
                  setLimit(PAGE);
                }}
              >
                Real Madrid
              </Chip>
            ) : null}
          </div>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1" data-no-swipe role="group" aria-label="Filtrer par journal">
            <Chip active={sourceId === "toutes"} onClick={() => setSourceId("toutes")}>
              Tous les journaux
            </Chip>
            {sourcesInGroup.map((s) => (
              <Chip
                key={s.id}
                active={sourceId === s.id}
                onClick={() => {
                  setSourceId(s.id);
                  setLimit(PAGE);
                }}
              >
                {s.name}
              </Chip>
            ))}
          </div>
        </div>
        <Button variant="secondary" onClick={refresh} disabled={loading} aria-label="Actualiser les articles" className="mt-1 shrink-0">
          <RefreshCw aria-hidden className={cn(loading && "animate-spin motion-reduce:animate-none")} />
          <span className="hidden sm:inline">Actualiser</span>
        </Button>
      </div>

      {filtered.length ? (
        <CardGrid>
          {filtered.slice(0, limit).map((a) => (
            <div key={a.id} className="relative h-full">
              <ArticleCard article={a} now={now} />
            </div>
          ))}
        </CardGrid>
      ) : (
        <div className="card p-5">
          <EmptyState title="Aucun article" reason="Aucun article récent ne correspond à ces filtres." />
        </div>
      )}

      {filtered.length > limit ? (
        <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)} className="self-center">
          Afficher plus ({filtered.length - limit} restants)
        </Button>
      ) : null}

      <div className="flex flex-col gap-1">
        <SourceNote
          source={`flux RSS de ${data.sources.filter((s) => s.ok).map((s) => s.name).join(", ")}`}
          updatedAt={new Date(data.fetchedAt)}
        />
        {failed.length ? (
          <p className="text-xs text-text-2">
            Indisponibles pour le moment : {failed.map((s) => `${s.name} (${s.error})`).join(", ")}.
          </p>
        ) : null}
        {silent.length ? (
          <p className="text-xs text-text-2">Aucun article de moins de 3 jours : {silent.map((s) => s.name).join(", ")}.</p>
        ) : null}
        <p className="text-xs text-text-2">
          Seuls le titre et le court résumé fournis par chaque journal sont affichés ; l&apos;article complet se lit sur son site.
        </p>
      </div>
    </div>
  );
}
