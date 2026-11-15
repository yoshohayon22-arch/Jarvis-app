"use client";

/**
 * Onglet Real Madrid : prochain match (compte à rebours), score, classements LaLiga et Ligue des champions,
 * buteurs, effectif et actus. Matchs et classements : API publique d'ESPN. Buteurs et effectif : football-data.org (si un jeton est configuré).
 */
import { ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { CardGrid } from "@/components/ui/card-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableCard } from "@/components/ui/expandable-card";
import { LiveBadge, LiveScore } from "@/components/ui/live-badge";
import { SkeletonCard, SkeletonGrid } from "@/components/ui/skeleton-card";
import { SourceNote } from "@/components/ui/source-note";
import { formatDate, formatLongDate, formatTime } from "@/lib/format";
import {
  REAL_MADRID_ID,
  type Match,
  type Part,
  type RealMadridPayload,
  type Scorer,
  type SquadPlayer,
  type StandingRow,
  type TeamRef,
} from "@/lib/football/types";
import type { NewsPayload } from "@/lib/rss/types";
import { useCachedFetch } from "@/lib/use-cached-fetch";
import { cn } from "@/lib/utils";

const SOURCE = "ESPN";
const SOURCE_FD = "football-data.org";
const ONE_MINUTE = 60 * 1000;
const TEN_MINUTES = 10 * ONE_MINUTE;
const round = (n: number) => Math.round(n).toString();
const border = "border-t-[length:var(--border-width)] border-border pt-4";

async function fetchRealMadrid(): Promise<RealMadridPayload> {
  const res = await fetch("/api/real-madrid");
  if (!res.ok) throw new Error(`le serveur a répondu ${res.status}`);
  return (await res.json()) as RealMadridPayload;
}
async function fetchRealNews(): Promise<NewsPayload> {
  const res = await fetch("/api/presse?onglet=real");
  if (!res.ok) throw new Error(`le serveur a répondu ${res.status}`);
  return (await res.json()) as NewsPayload;
}

export function RealMadridView() {
  const { data, error, loading, refresh } = useCachedFetch("real-madrid", fetchRealMadrid, ONE_MINUTE);
  const news = useCachedFetch("real-madrid-actus", fetchRealNews, TEN_MINUTES);

  // Pendant un match, on redemande les données chaque minute (le serveur garde les réponses 1 minute).
  const live = data?.matches.ok ? data.matches.data.live : null;
  useEffect(() => {
    if (!live) return;
    const id = setInterval(refresh, ONE_MINUTE);
    return () => clearInterval(id);
  }, [live, refresh]);

  const refreshAll = useCallback(() => {
    refresh();
    news.refresh();
  }, [refresh, news]);

  if (!data) {
    if (loading) return <SkeletonGrid count={6} />;
    return (
      <div className="card flex flex-col gap-3 p-5">
        <EmptyState title="Données indisponibles" reason={`Le serveur n'a pas pu lire les données de football (${error ?? "raison inconnue"}).`} />
        <Button variant="secondary" onClick={refresh} className="self-start">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-2">Scores en différé (plan gratuit de la source) : un but peut apparaître avec quelques minutes de retard.</p>
        <Button variant="secondary" onClick={refreshAll} disabled={loading} aria-label="Actualiser" className="shrink-0">
          <RefreshCw aria-hidden className={cn(loading && "animate-spin motion-reduce:animate-none")} />
          <span className="hidden sm:inline">Actualiser</span>
        </Button>
      </div>
      <CardGrid>
        <NextMatchCard part={data.matches} />
        <ScoreCard part={data.matches} />
        <StandingsCard title="Classement LaLiga" part={data.laliga} around={3} />
        <StandingsCard title="Ligue des champions" part={data.championsLeague} around={2} note="Phase de ligue : les 8 premiers vont en huitièmes, les places 9 à 24 en barrages." />
        <ScorersCard part={data.scorers} />
        <SquadCard part={data.squad} />
        <NewsCard state={news} />
      </CardGrid>
    </div>
  );
}

// ---------- Briques communes ----------
function Missing({ title, error }: { title: string; error: string }) {
  return (
    <ExpandableCard title={title}>
      <div className="flex flex-col gap-3">
        <EmptyState title="Pas de données" reason={`La source n'a pas fourni cette information (${error}).`} />
        <SourceNote source={SOURCE} />
      </div>
    </ExpandableCard>
  );
}

function Crest({ team, className }: { team: TeamRef; className?: string }) {
  // Si l'écusson ne se charge pas, on affiche une pastille neutre plutôt qu'une image cassée.
  const [failed, setFailed] = useState(false);
  if (!team.crest || failed) return <span aria-hidden className={cn("inline-block size-6 shrink-0 rounded-full bg-surface-2", className)} />;
  // Écussons (fournis seulement par football-data.org) ; simple <img>, pas d'optimisation serveur nécessaire.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={team.crest}
      alt=""
      width={24}
      height={24}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("size-6 shrink-0 object-contain", className)}
    />
  );
}

const isReal = (team: TeamRef) => team.id === REAL_MADRID_ID;

function matchWhen(match: Match): string {
  const date = new Date(match.utcDate);
  return match.timeConfirmed ? `${formatLongDate(date)} à ${formatTime(date)}` : `${formatLongDate(date)} · horaire à confirmer`;
}

function Fixture({ match, compact }: { match: Match; compact?: boolean }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", compact ? "text-sm" : "text-base")}>
      <Crest team={match.home} />
      <span className={cn("truncate", isReal(match.home) && "font-semibold")}>{match.home.name}</span>
      <span className="shrink-0 text-text-2 tabular-nums">
        {match.homeScore != null && match.awayScore != null ? `${match.homeScore} – ${match.awayScore}` : "–"}
      </span>
      <span className={cn("truncate", isReal(match.away) && "font-semibold")}>{match.away.name}</span>
      <Crest team={match.away} />
    </span>
  );
}

// ---------- Prochain match ----------
function useCountdown(targetIso: string | null): { days: number; hours: number; minutes: number; seconds: number } | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!targetIso) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  if (!targetIso || now == null) return null;
  const total = Math.max(0, Math.floor((new Date(targetIso).getTime() - now) / 1000));
  return { days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

function NextMatchCard({ part }: { part: Part<{ live: Match | null; upcoming: Match[]; recent: Match[] }> }) {
  const next = part.ok ? (part.data.upcoming[0] ?? null) : null;
  const countdown = useCountdown(next?.timeConfirmed ? next.utcDate : null);
  if (!part.ok) return <Missing title="Prochain match" error={part.error} />;
  if (!next) {
    return (
      <ExpandableCard title="Prochain match">
        <div className="flex flex-col gap-3">
          <EmptyState title="Aucun match programmé" reason="La source n'annonce aucun match dans les 60 prochains jours." />
          <SourceNote source={SOURCE} updatedAt={new Date(part.fetchedAt)} />
        </div>
      </ExpandableCard>
    );
  }
  const units: [number, string][] = countdown
    ? [
        [countdown.days, "j"],
        [countdown.hours, "h"],
        [countdown.minutes, "min"],
        [countdown.seconds, "s"],
      ]
    : [];

  return (
    <ExpandableCard
      title="Prochain match"
      badge={<span className="text-xs text-text-2">{next.competition}</span>}
      detail={
        <ul className={cn("flex flex-col gap-3", border)}>
          {part.data.upcoming.slice(1).map((m) => (
            <li key={m.id} className="flex flex-col gap-0.5">
              <Fixture match={m} compact />
              <span className="text-xs text-text-2">
                {m.competition} · {matchWhen(m)}
              </span>
            </li>
          ))}
        </ul>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-around gap-3 text-center">
          {[next.home, next.away].map((t, i) => (
            <div key={t.id} className={cn("flex min-w-0 flex-1 flex-col items-center gap-2", i === 1 && "order-3")}>
              <Crest team={t} className="size-12" />
              <span className={cn("max-w-full truncate text-sm", isReal(t) && "font-semibold")}>{t.name}</span>
            </div>
          ))}
          <span className="order-2 text-sm text-text-2">contre</span>
        </div>
        <p className="text-center text-sm first-letter:uppercase">{matchWhen(next)}</p>
        {countdown ? (
          <p className="flex justify-center gap-3" role="timer" aria-label="Temps restant avant le coup d'envoi">
            {units.map(([value, unit]) => (
              <span key={unit} className="flex min-w-12 flex-col items-center rounded-control bg-surface-2 px-2 py-1.5">
                <span className="font-heading text-2xl leading-none tabular-nums">{String(value).padStart(2, "0")}</span>
                <span className="text-[11px] text-text-2">{unit}</span>
              </span>
            ))}
          </p>
        ) : null}
        <SourceNote source={SOURCE} updatedAt={new Date(part.fetchedAt)} />
      </div>
    </ExpandableCard>
  );
}

// ---------- Score : match en cours ou dernier résultat ----------
const OUTCOME_LABEL = { V: "Victoire", N: "Nul", D: "Défaite" } as const;

function OutcomeDot({ outcome }: { outcome: Match["outcome"] }) {
  if (!outcome) return null;
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full border-[length:var(--border-width)] border-border text-[11px] font-bold",
        outcome === "V" ? "bg-accent text-on-accent" : "bg-surface-2 text-text",
      )}
    >
      <span aria-hidden>{outcome}</span>
      <span className="sr-only">{OUTCOME_LABEL[outcome]}</span>
    </span>
  );
}

function ScoreCard({ part }: { part: Part<{ live: Match | null; upcoming: Match[]; recent: Match[] }> }) {
  if (!part.ok) return <Missing title="Score" error={part.error} />;
  const { live, recent } = part.data;
  const shown = live ?? recent[0] ?? null;
  if (!shown) {
    return (
      <ExpandableCard title="Score">
        <div className="flex flex-col gap-3">
          <EmptyState title="Aucun résultat récent" reason="La source ne liste aucun match joué dans les 45 derniers jours." />
          <SourceNote source={SOURCE} updatedAt={new Date(part.fetchedAt)} />
        </div>
      </ExpandableCard>
    );
  }

  return (
    <ExpandableCard
      title={live ? "Match en cours" : "Dernier résultat"}
      badge={live ? <LiveBadge label="EN COURS · différé" /> : <span className="text-xs text-text-2">{shown.competition}</span>}
      detail={
        <ul className={cn("flex flex-col gap-3", border)} aria-label="Derniers résultats">
          {recent.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              <OutcomeDot outcome={m.outcome} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <Fixture match={m} compact />
                <span className="text-xs text-text-2">
                  {m.competition} · {formatDate(new Date(m.utcDate))}
                </span>
              </div>
            </li>
          ))}
        </ul>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-around gap-2 text-center">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <Crest team={shown.home} className="size-12" />
            <span className={cn("max-w-full truncate text-sm", isReal(shown.home) && "font-semibold")}>{shown.home.name}</span>
          </div>
          {shown.homeScore != null && shown.awayScore != null ? (
            <LiveScore home={shown.homeScore} away={shown.awayScore} />
          ) : (
            <span className="text-text-2">–</span>
          )}
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <Crest team={shown.away} className="size-12" />
            <span className={cn("max-w-full truncate text-sm", isReal(shown.away) && "font-semibold")}>{shown.away.name}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-text-2">
            {live ? "Coup d'envoi" : "Joué le"} {formatDate(new Date(shown.utcDate))}
            {shown.outcome ? ` · ${OUTCOME_LABEL[shown.outcome]}` : ""}
          </span>
          <span className="flex gap-1" aria-label="Forme récente, du plus récent au plus ancien">
            {recent.slice(0, 5).map((m) => (
              <OutcomeDot key={m.id} outcome={m.outcome} />
            ))}
          </span>
        </div>
        <SourceNote source={SOURCE} updatedAt={new Date(part.fetchedAt)} />
      </div>
    </ExpandableCard>
  );
}

// ---------- Classements ----------
function StandingsTable({ rows, full }: { rows: StandingRow[]; full?: boolean }) {
  return (
    <div className="overflow-x-auto" data-no-swipe>
      <table className="w-full text-left text-sm tabular-nums">
        <thead className="text-xs text-text-2">
          <tr>
            <th scope="col" className="w-8 py-1.5 font-medium">#</th>
            <th scope="col" className="py-1.5 font-medium">Équipe</th>
            <th scope="col" className="px-1.5 py-1.5 text-right font-medium"><abbr title="Matchs joués" className="no-underline">J</abbr></th>
            {full ? (
              <>
                <th scope="col" className="px-1.5 py-1.5 text-right font-medium"><abbr title="Victoires" className="no-underline">V</abbr></th>
                <th scope="col" className="px-1.5 py-1.5 text-right font-medium"><abbr title="Nuls" className="no-underline">N</abbr></th>
                <th scope="col" className="px-1.5 py-1.5 text-right font-medium"><abbr title="Défaites" className="no-underline">D</abbr></th>
              </>
            ) : null}
            <th scope="col" className="px-1.5 py-1.5 text-right font-medium"><abbr title="Différence de buts" className="no-underline">Diff.</abbr></th>
            <th scope="col" className="py-1.5 pl-1.5 text-right font-medium"><abbr title="Points" className="no-underline">Pts</abbr></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team.id} className={cn("border-t border-border/60", isReal(r.team) && "bg-accent-soft font-semibold")}>
              <td className="py-1.5 pl-1">{r.position}</td>
              <th scope="row" className={cn("py-1.5", isReal(r.team) ? "font-semibold" : "font-normal")}>
                <span className="flex items-center gap-2">
                  <Crest team={r.team} className="size-5" />
                  <span className="truncate">{r.team.name}</span>
                </span>
              </th>
              <td className="px-1.5 py-1.5 text-right">{r.played}</td>
              {full ? (
                <>
                  <td className="px-1.5 py-1.5 text-right">{r.won}</td>
                  <td className="px-1.5 py-1.5 text-right">{r.draw}</td>
                  <td className="px-1.5 py-1.5 text-right">{r.lost}</td>
                </>
              ) : null}
              <td className="px-1.5 py-1.5 text-right">{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</td>
              <td className="py-1.5 pr-1 pl-1.5 text-right">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StandingsCard({
  title,
  part,
  around,
  note,
}: {
  title: string;
  part: Part<{ matchday: number | null; table: StandingRow[] }>;
  /** Nombre de lignes affichées au-dessus et en dessous du Real dans la carte repliée. */
  around: number;
  note?: string;
}) {
  if (!part.ok) return <Missing title={title} error={part.error} />;
  const { table, matchday } = part.data;
  const real = table.find((r) => isReal(r.team));
  if (!table.length) {
    return (
      <ExpandableCard title={title}>
        <div className="flex flex-col gap-3">
          <EmptyState reason="La source ne renvoie aucun classement pour le moment." />
          <SourceNote source={SOURCE} updatedAt={new Date(part.fetchedAt)} />
        </div>
      </ExpandableCard>
    );
  }
  const index = real ? table.indexOf(real) : 0;
  const start = Math.max(0, Math.min(index - around, table.length - (2 * around + 1)));
  const excerpt = table.slice(start, start + 2 * around + 1);

  return (
    <ExpandableCard
      title={title}
      badge={matchday ? <span className="text-xs text-text-2">Journée {matchday}</span> : undefined}
      detail={
        <div className={cn("flex flex-col gap-3", border)}>
          <StandingsTable rows={table} full />
          {note ? <p className="text-xs text-text-2">{note}</p> : null}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {real ? (
          <p className="flex items-baseline gap-2">
            <span className="font-heading text-4xl leading-none">
              <AnimatedNumber value={real.position} format={round} />
              <sup className="text-lg">{real.position === 1 ? "er" : "e"}</sup>
            </span>
            <span className="text-sm text-text-2">
              <AnimatedNumber value={real.points} format={round} /> points en {real.played} matchs
            </span>
          </p>
        ) : (
          <p className="text-sm text-text-2">Le Real Madrid n&apos;apparaît pas dans ce classement.</p>
        )}
        <StandingsTable rows={excerpt} />
        <SourceNote source={SOURCE} updatedAt={new Date(part.fetchedAt)} />
      </div>
    </ExpandableCard>
  );
}

// ---------- Buteurs ----------
function ScorerRow({ scorer, rank }: { scorer: Scorer; rank: number }) {
  return (
    <li className={cn("flex items-center gap-2 py-1.5 text-sm", isReal(scorer.team) && "font-semibold")}>
      <span className="w-5 shrink-0 text-text-2 tabular-nums">{rank}</span>
      <Crest team={scorer.team} className="size-5" />
      <span className="min-w-0 flex-1 truncate">{scorer.name}</span>
      <span className="shrink-0 text-xs font-normal text-text-2 tabular-nums">
        {scorer.assists != null ? `${scorer.assists} passe${scorer.assists > 1 ? "s" : ""} déc.` : ""}
      </span>
      <span className="w-14 shrink-0 text-right tabular-nums">
        {scorer.goals} but{scorer.goals > 1 ? "s" : ""}
      </span>
    </li>
  );
}

function ScorersCard({ part }: { part: Part<Scorer[]> }) {
  if (!part.ok) return <Missing title="Buteurs LaLiga" error={part.error} />;
  const scorers = part.data;
  const realScorers = scorers.filter((s) => isReal(s.team));

  return (
    <ExpandableCard
      title="Buteurs LaLiga"
      detail={
        <div className={cn("flex flex-col gap-2", border)}>
          <p className="text-xs text-text-2">Les {scorers.length} meilleurs buteurs du championnat.</p>
          <ol>
            {scorers.map((s, i) => (
              <ScorerRow key={`${s.name}-${s.team.id}`} scorer={s} rank={i + 1} />
            ))}
          </ol>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <ol>
          {scorers.slice(0, 5).map((s, i) => (
            <ScorerRow key={`${s.name}-${s.team.id}`} scorer={s} rank={i + 1} />
          ))}
        </ol>
        <p className="text-xs text-text-2">
          {realScorers.length
            ? `Joueurs du Real parmi les ${scorers.length} premiers : ${realScorers.map((s) => `${s.name} (${s.goals})`).join(", ")}.`
            : `Aucun joueur du Real parmi les ${scorers.length} premiers buteurs.`}{" "}
          Les passes décisives ne sont connues que pour ces joueurs : la source ne fournit pas de classement des passeurs.
        </p>
        <SourceNote source={SOURCE_FD} updatedAt={new Date(part.fetchedAt)} />
      </div>
    </ExpandableCard>
  );
}

// ---------- Effectif ----------
const LINES: [string, RegExp][] = [
  ["Gardiens", /gardien/i],
  ["Défenseurs", /défens|arrière/i],
  ["Milieux", /milieu/i],
  ["Attaquants", /attaqu|avant|ailier/i],
];

function SquadCard({ part }: { part: Part<{ coach: string | null; venue: string | null; players: SquadPlayer[] }> }) {
  if (!part.ok) return <Missing title="Effectif" error={part.error} />;
  const { players, coach, venue } = part.data;
  const groups = LINES.map(([label, pattern]) => ({ label, players: players.filter((p) => pattern.test(p.position)) }));
  const others = players.filter((p) => !LINES.some(([, pattern]) => pattern.test(p.position)));
  if (others.length) groups.push({ label: "Autres", players: others });

  return (
    <ExpandableCard
      title="Effectif"
      badge={<span className="text-xs text-text-2">{players.length} joueurs</span>}
      detail={
        <div className={cn("flex flex-col gap-4", border)}>
          {groups.map((g) => (
            <section key={g.label}>
              <h3 className="mb-1 text-sm">{g.label}</h3>
              <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                {g.players.map((p) => (
                  <li key={p.name} className="flex justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 text-xs text-text-2">{p.position}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-4 gap-2 text-center">
          {groups.slice(0, 4).map((g) => (
            <div key={g.label} className="rounded-control bg-surface-2 px-1 py-2">
              <dd className="font-heading text-2xl leading-none tabular-nums">{g.players.length}</dd>
              <dt className="mt-1 text-[11px] text-text-2">{g.label}</dt>
            </div>
          ))}
        </dl>
        <p className="text-sm text-text-2">
          {coach ? `Entraîneur : ${coach}. ` : ""}
          {venue ? `Stade : ${venue}.` : ""}
        </p>
        <p className="text-xs text-text-2">Les blessures et suspensions ne sont pas fournies par cette source.</p>
        <SourceNote source={SOURCE_FD} updatedAt={new Date(part.fetchedAt)} />
      </div>
    </ExpandableCard>
  );
}

// ---------- Actus ----------
function NewsCard({ state }: { state: { data: NewsPayload | null; error: string | null; loading: boolean } }) {
  if (!state.data) {
    if (state.loading) return <SkeletonCard lines={3} />;
    return <Missing title="Actus Real Madrid" error={state.error ?? "raison inconnue"} />;
  }
  const { articles, sources, fetchedAt } = state.data;
  const names = [...new Set(articles.map((a) => a.sourceName))];
  const item = (a: (typeof articles)[number]) => (
    <li key={a.id} className="flex flex-col gap-0.5">
      <a href={a.link} target="_blank" rel="noopener noreferrer" lang={a.lang} className="text-sm leading-snug hover:underline">
        {a.title}
        <ExternalLink aria-hidden className="ml-1 inline size-3 text-text-2" />
      </a>
      <span className="text-xs text-text-2">
        {a.sourceName}
        {a.publishedAt ? ` · ${formatDate(new Date(a.publishedAt))} à ${formatTime(new Date(a.publishedAt))}` : ""}
      </span>
    </li>
  );

  return (
    <ExpandableCard
      title="Actus Real Madrid"
      detail={articles.length > 4 ? <ul className={cn("flex flex-col gap-3", border)}>{articles.slice(4, 20).map(item)}</ul> : undefined}
    >
      <div className="flex flex-col gap-3">
        {articles.length ? (
          <ul className="flex flex-col gap-3">{articles.slice(0, 4).map(item)}</ul>
        ) : (
          <EmptyState title="Aucune actu récente" reason="Aucun article de moins de 3 jours ne parle du Real Madrid dans les flux suivis." />
        )}
        <SourceNote
          source={names.length ? `flux RSS de ${names.join(", ")}` : `flux RSS (${sources.filter((s) => s.ok).length} sources lues)`}
          updatedAt={new Date(fetchedAt)}
        />
      </div>
    </ExpandableCard>
  );
}
