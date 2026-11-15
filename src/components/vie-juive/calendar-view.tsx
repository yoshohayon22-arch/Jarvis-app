"use client";

/** Calendrier hébraïque et zmanim à Genève (source : Hebcal). */
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardGrid } from "@/components/ui/card-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableCard } from "@/components/ui/expandable-card";
import { SkeletonGrid } from "@/components/ui/skeleton-card";
import { SourceNote } from "@/components/ui/source-note";
import { formatDate, formatLongDate, formatTime } from "@/lib/format";
import type { CalendarPayload } from "@/lib/judaisme/types";
import { useCachedFetch } from "@/lib/use-cached-fetch";
import { useLocalSetting } from "@/lib/use-local-setting";
import { cn } from "@/lib/utils";

const SOURCE = "Hebcal · horaires calculés pour Genève";
const CANDLE_CHOICES = [18, 20, 22, 30, 40];
const border = "border-t-[length:var(--border-width)] border-border pt-4";

export function CalendarView() {
  const [minutes, setMinutes] = useLocalSetting("dashboard-bougies", 18);
  const { data, error, loading, refresh } = useCachedFetch<CalendarPayload>(
    `calendrier-${minutes}`,
    async () => {
      const res = await fetch(`/api/vie-juive?section=calendrier&bougies=${minutes}`);
      const body = (await res.json().catch(() => null)) as (CalendarPayload & { erreur?: string }) | null;
      if (!res.ok || !body) throw new Error(body?.erreur ?? `le serveur a répondu ${res.status}`);
      return body;
    },
    15 * 60 * 1000,
  );

  if (!data) {
    if (loading) return <SkeletonGrid count={4} />;
    return (
      <div className="card flex flex-col gap-3 p-5">
        <EmptyState title="Données indisponibles" reason={`Hebcal n'a pas pu être lu (${error ?? "raison inconnue"}). Aucun horaire n'est affiché plutôt qu'un horaire inventé.`} />
        <Button variant="secondary" onClick={refresh} className="self-start">
          Réessayer
        </Button>
      </div>
    );
  }

  const updatedAt = new Date(data.fetchedAt);
  const main = data.zmanim.filter((z) => z.main);
  const zmanRow = (z: CalendarPayload["zmanim"][number]) => (
    <li key={z.key} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span>{z.label}</span>
      <span className="font-medium tabular-nums">{formatTime(new Date(z.time))}</span>
    </li>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-2">Horaires calculés pour Genève : un écart de 1 à 2 minutes avec ceux de ta communauté est possible.</p>
        <Button variant="secondary" onClick={refresh} disabled={loading} aria-label="Actualiser" className="shrink-0">
          <RefreshCw aria-hidden className={cn(loading && "animate-spin motion-reduce:animate-none")} />
          <span className="hidden sm:inline">Actualiser</span>
        </Button>
      </div>

      <CardGrid>
        <ExpandableCard title="Aujourd'hui">
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-heading text-3xl leading-tight">{data.hebrewDate.text}</p>
              <p lang="he" dir="rtl" className="mt-1 text-xl text-text-2">
                {data.hebrewDate.hebrew}
              </p>
            </div>
            <p className="text-sm first-letter:uppercase">
              {formatLongDate(updatedAt)} · {formatDate(updatedAt)}
            </p>
            {data.hebrewDate.afterSunset ? (
              <p className="text-xs text-text-2">Le soleil est couché : la date hébraïque affichée est déjà celle du jour qui commence ce soir.</p>
            ) : null}
            <SourceNote source={SOURCE} updatedAt={updatedAt} />
          </div>
        </ExpandableCard>

        <ExpandableCard title="Chabbat" badge={data.shabbat.parasha ? <span className="text-xs text-text-2">{data.shabbat.parasha}</span> : undefined}>
          <div className="flex flex-col gap-4">
            {data.shabbat.candles || data.shabbat.havdalah ? (
              <dl className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["Allumage des bougies", data.shabbat.candles],
                    ["Havdala", data.shabbat.havdalah],
                  ] as const
                ).map(([label, iso]) => (
                  <div key={label} className="rounded-control bg-surface-2 p-3">
                    <dt className="text-xs text-text-2">{label}</dt>
                    <dd className="font-heading text-3xl leading-tight tabular-nums">{iso ? formatTime(new Date(iso)) : "–"}</dd>
                    <dd className="text-xs text-text-2 first-letter:uppercase">{iso ? formatLongDate(new Date(iso)) : "non communiqué"}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <EmptyState reason="Hebcal n'indique pas d'horaire de chabbat pour cette semaine." />
            )}
            <div className="flex flex-col gap-2">
              <p id="bougies-label" className="text-sm">
                Allumage avant le coucher du soleil
              </p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="bougies-label">
                {CANDLE_CHOICES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={minutes === m}
                    onClick={() => setMinutes(m)}
                    className={cn(
                      "btn-press min-h-11 min-w-14 rounded-full border-[length:var(--border-width)] px-3 text-sm [[data-theme=brutal]_&]:shadow-none [[data-theme=dessine]_&]:shadow-none",
                      minutes === m ? "border-accent bg-accent-soft font-semibold text-text" : "border-border bg-surface text-text-2",
                    )}
                  >
                    {m} min
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-2">18 minutes par défaut. Choisis l&apos;usage de ta communauté ; la havdala est calculée à la sortie des étoiles.</p>
            </div>
            <SourceNote source={SOURCE} updatedAt={updatedAt} />
          </div>
        </ExpandableCard>

        <ExpandableCard
          title="Zmanim du jour"
          detail={
            <div className={border}>
              <ul>{data.zmanim.map(zmanRow)}</ul>
              <p className="mt-3 text-xs text-text-2">Pour une question pratique sur un horaire, demande à ton rabbin.</p>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <ul>{main.map(zmanRow)}</ul>
            <SourceNote source={SOURCE} updatedAt={updatedAt} />
          </div>
        </ExpandableCard>

        <ExpandableCard title="Fêtes et dates à venir" detail={data.holidays.length > 5 ? <ul className={border}>{data.holidays.slice(5).map(holidayRow)}</ul> : undefined}>
          <div className="flex flex-col gap-3">
            {data.holidays.length ? <ul>{data.holidays.slice(0, 5).map(holidayRow)}</ul> : <EmptyState reason="Hebcal n'annonce aucune fête dans les prochains mois." />}
            <p className="text-xs text-text-2">Les fêtes commencent la veille au soir de la date indiquée.</p>
            <SourceNote source="Hebcal" updatedAt={updatedAt} />
          </div>
        </ExpandableCard>
      </CardGrid>
    </div>
  );
}

function holidayRow(h: CalendarPayload["holidays"][number]) {
  return (
    <li key={`${h.title}-${h.date}`} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className="min-w-0">
        <span className="font-medium">{h.title}</span>
        {h.hebrewDate ? <span className="text-text-2"> · {h.hebrewDate}</span> : null}
      </span>
      <span className="shrink-0 text-text-2 tabular-nums">{formatDate(new Date(`${h.date}T12:00:00Z`))}</span>
    </li>
  );
}
