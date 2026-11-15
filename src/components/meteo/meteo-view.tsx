"use client";

/**
 * Onglet Météo Genève : maintenant, heure par heure, 7 jours, qualité de l'air, alertes.
 * Données réelles uniquement ; chaque carte indique sa source et son heure de mise à jour.
 */
import { Droplets, RefreshCw, Sunrise, Sunset, Wind } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { CardGrid } from "@/components/ui/card-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableCard } from "@/components/ui/expandable-card";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { SourceNote } from "@/components/ui/source-note";
import { formatDateTime } from "@/lib/format";
import { fetchAirQuality, fetchForecast } from "@/lib/meteo/open-meteo";
import type { AirQuality, AlertsPayload, DailyPoint, Forecast } from "@/lib/meteo/types";
import { aqiLabel, describeWeather, uvLabel, windDirectionLabel } from "@/lib/meteo/wmo";
import { useCachedFetch, type CachedFetchState } from "@/lib/use-cached-fetch";
import { cn } from "@/lib/utils";
import { WeatherIcon } from "./weather-icon";

const TEN_MINUTES = 10 * 60 * 1000;

const round = (n: number) => Math.round(n).toString();
const oneDecimal = new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatTemp = (n: number) => oneDecimal.format(n);
const weekday = new Intl.DateTimeFormat("fr-CH", { weekday: "short", day: "numeric", timeZone: "UTC" });
const dayLabel = (date: string, index: number) =>
  index === 0 ? "Aujourd'hui" : weekday.format(new Date(`${date}T12:00:00Z`)).replace(".", "");

async function fetchAlerts(): Promise<AlertsPayload> {
  const res = await fetch("/api/meteo/alertes");
  const data = (await res.json().catch(() => null)) as (AlertsPayload & { erreur?: string }) | null;
  if (!res.ok || !data) throw new Error(data?.erreur ?? "Source des alertes indisponible");
  return data;
}

const OPEN_METEO_CH = "Open-Meteo · modèle MétéoSuisse ICON-CH";

export function MeteoView() {
  const forecast = useCachedFetch("meteo-previsions", fetchForecast, TEN_MINUTES);
  const air = useCachedFetch("meteo-air", fetchAirQuality, TEN_MINUTES);
  const alerts = useCachedFetch("meteo-alertes", fetchAlerts, TEN_MINUTES);

  const refreshAll = () => {
    forecast.refresh();
    air.refresh();
    alerts.refresh();
  };
  const loading = forecast.loading || air.loading || alerts.loading;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-2">Genève · prévisions calculées par des modèles, mises à jour toutes les 10 minutes au plus.</p>
        <Button variant="secondary" onClick={refreshAll} disabled={loading} aria-label="Actualiser la météo" className="shrink-0">
          <RefreshCw aria-hidden className={cn(loading && "animate-spin motion-reduce:animate-none")} />
          <span className="hidden sm:inline">Actualiser</span>
        </Button>
      </div>

      <CardGrid>
        <NowCard forecast={forecast} air={air.data} />
        <HourlyCard forecast={forecast} />
        <DailyCard forecast={forecast} />
        <AirCard air={air} />
        <AlertsCard alerts={alerts} />
      </CardGrid>
    </div>
  );
}

/** État commun : squelette pendant le chargement, explication honnête en cas d'échec. */
function Unavailable<T>({ state, title, source }: { state: CachedFetchState<T>; title: string; source: string }) {
  if (state.loading && !state.data) return <SkeletonCard lines={3} />;
  return (
    <ExpandableCard title={title}>
      <div className="flex flex-col gap-3">
        <EmptyState
          title="Données indisponibles"
          reason={`La source n'a pas répondu (${state.error ?? "raison inconnue"}). Aucune valeur n'est affichée plutôt qu'une valeur inventée.`}
        />
        <Button variant="secondary" onClick={state.refresh} className="self-start">
          Réessayer
        </Button>
        <SourceNote source={source} />
      </div>
    </ExpandableCard>
  );
}

function Stat({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="flex items-center gap-1.5 text-xs text-text-2">
        {icon}
        {label}
      </dt>
      <dd className="text-sm font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function NowCard({ forecast, air }: { forecast: CachedFetchState<Forecast>; air: AirQuality | null }) {
  const data = forecast.data;
  if (!data) return <Unavailable state={forecast} title="Maintenant" source={OPEN_METEO_CH} />;
  const { current } = data;
  const today = data.daily[0];
  const weather = describeWeather(current.code);

  return (
    <ExpandableCard
      title="Maintenant"
      badge={<span className="text-xs text-text-2">mesure de {current.time}</span>}
      detail={
        <dl className="grid grid-cols-2 gap-4 border-t-[length:var(--border-width)] border-border pt-4 sm:grid-cols-3">
          <Stat label="Humidité">{current.humidity} %</Stat>
          <Stat label="Précipitations (15 min)">{formatTemp(current.precipitation)} mm</Stat>
          <Stat label="Direction du vent">
            {windDirectionLabel(current.windDirection)} ({current.windDirection}°)
          </Stat>
          {today ? (
            <>
              <Stat icon={<Sunrise aria-hidden className="size-3.5" />} label="Lever du soleil">
                {today.sunrise}
              </Stat>
              <Stat icon={<Sunset aria-hidden className="size-3.5" />} label="Coucher du soleil">
                {today.sunset}
              </Stat>
              <Stat label="Min / max du jour">
                {round(today.min)}° / {round(today.max)}°
              </Stat>
            </>
          ) : null}
        </dl>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <WeatherIcon kind={weather.kind} isDay={current.isDay} animated className="size-20 shrink-0" />
          <div>
            <p className="font-heading text-5xl leading-none">
              <AnimatedNumber value={current.temperature} format={formatTemp} />
              <span className="text-3xl">°C</span>
            </p>
            <p className="mt-1 text-sm">{weather.label}</p>
            <p className="text-sm text-text-2">
              Ressenti <AnimatedNumber value={current.apparent} format={formatTemp} />°
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <Stat icon={<Wind aria-hidden className="size-3.5" />} label="Vent">
            <AnimatedNumber value={current.wind} format={round} /> km/h
          </Stat>
          <Stat label="Rafales">
            <AnimatedNumber value={current.gusts} format={round} /> km/h
          </Stat>
          <Stat label="UV">{air?.uv != null ? `${formatTemp(air.uv)} · ${uvLabel(air.uv)}` : "–"}</Stat>
        </dl>
        <SourceNote
          source={air?.uv != null ? `${OPEN_METEO_CH} · UV : modèle CAMS` : OPEN_METEO_CH}
          updatedAt={new Date(data.fetchedAt)}
        />
      </div>
    </ExpandableCard>
  );
}

function HourlyCard({ forecast }: { forecast: CachedFetchState<Forecast> }) {
  const data = forecast.data;
  if (!data) return <Unavailable state={forecast} title="Heure par heure" source={OPEN_METEO_CH} />;

  return (
    <ExpandableCard
      title="Heure par heure"
      badge={<span className="text-xs text-text-2">24 h</span>}
      detail={
        <div className="overflow-x-auto border-t-[length:var(--border-width)] border-border pt-4" data-no-swipe>
          <table className="w-full text-left text-sm tabular-nums">
            <caption className="sr-only">Prévisions détaillées des 24 prochaines heures</caption>
            <thead className="text-xs text-text-2">
              <tr>
                <th scope="col" className="py-1.5 pr-3 font-medium">Heure</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Temps</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Temp.</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Pluie</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Vent</th>
                <th scope="col" className="py-1.5 font-medium">Rafales</th>
              </tr>
            </thead>
            <tbody>
              {data.hourly.map((h) => (
                <tr key={h.iso} className="border-t border-border/60">
                  <th scope="row" className="py-1.5 pr-3 font-medium">{h.time}</th>
                  <td className="py-1.5 pr-3">{describeWeather(h.code).label}</td>
                  <td className="py-1.5 pr-3">{round(h.temperature)}°</td>
                  <td className="py-1.5 pr-3">
                    {h.precipitationProbability != null ? `${h.precipitationProbability} %` : "–"} · {formatTemp(h.precipitation)} mm
                  </td>
                  <td className="py-1.5 pr-3">{round(h.wind)} km/h</td>
                  <td className="py-1.5">{round(h.gusts)} km/h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <ul className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1" data-no-swipe aria-label="Prochaines heures">
          {data.hourly.slice(0, 12).map((h) => {
            const w = describeWeather(h.code);
            return (
              <li key={h.iso} className="flex min-w-14 flex-col items-center gap-1 rounded-control bg-surface-2 px-2 py-2 text-center">
                <span className="text-xs text-text-2">{h.time.slice(0, 2)} h</span>
                <WeatherIcon kind={w.kind} isDay={h.isDay} className="size-7" />
                <span className="sr-only">{w.label},</span>
                <span className="text-sm font-medium tabular-nums">{round(h.temperature)}°</span>
                <span className="flex items-center gap-0.5 text-[11px] text-text-2 tabular-nums">
                  <Droplets aria-hidden className="size-3" />
                  <span className="sr-only">Risque de pluie</span>
                  {h.precipitationProbability ?? "–"}%
                </span>
              </li>
            );
          })}
        </ul>
        <SourceNote source={OPEN_METEO_CH} updatedAt={new Date(data.fetchedAt)} />
      </div>
    </ExpandableCard>
  );
}

function DailyRow({ day, index, min, max }: { day: DailyPoint; index: number; min: number; max: number }) {
  const w = describeWeather(day.code);
  const span = Math.max(1, max - min);
  // Barre min/max positionnée par transform (pas de largeur animée).
  const left = ((day.min - min) / span) * 100;
  const width = ((day.max - day.min) / span) * 100;
  return (
    <li className="flex items-center gap-2 py-1.5 text-sm">
      <span className="w-20 shrink-0 capitalize">{dayLabel(day.date, index)}</span>
      <WeatherIcon kind={w.kind} className="size-6 shrink-0" />
      <span className="sr-only">{w.label},</span>
      <span className="w-8 shrink-0 text-right text-text-2 tabular-nums">{round(day.min)}°</span>
      <span aria-hidden className="relative h-1.5 min-w-8 flex-1 rounded-full bg-surface-2">
        <span className="absolute inset-y-0 rounded-full bg-accent" style={{ left: `${left}%`, width: `${Math.max(width, 6)}%` }} />
      </span>
      <span className="w-8 shrink-0 font-medium tabular-nums">{round(day.max)}°</span>
      {day.model === "ECMWF IFS" ? (
        <abbr title="Jour hors de portée du modèle MétéoSuisse : prévision du modèle européen ECMWF" className="shrink-0 text-[10px] text-text-2 no-underline">
          ECMWF
        </abbr>
      ) : null}
    </li>
  );
}

function DailyCard({ forecast }: { forecast: CachedFetchState<Forecast> }) {
  const data = forecast.data;
  if (!data) return <Unavailable state={forecast} title="7 jours" source="Open-Meteo" />;
  const min = Math.min(...data.daily.map((d) => d.min));
  const max = Math.max(...data.daily.map((d) => d.max));
  const hasEcmwf = data.daily.some((d) => d.model === "ECMWF IFS");

  return (
    <ExpandableCard
      title="7 jours"
      detail={
        <div className="overflow-x-auto border-t-[length:var(--border-width)] border-border pt-4" data-no-swipe>
          <table className="w-full text-left text-sm tabular-nums">
            <caption className="sr-only">Prévisions détaillées par jour</caption>
            <thead className="text-xs text-text-2">
              <tr>
                <th scope="col" className="py-1.5 pr-3 font-medium">Jour</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Temps</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Pluie</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Rafales</th>
                <th scope="col" className="py-1.5 font-medium">Modèle</th>
              </tr>
            </thead>
            <tbody>
              {data.daily.map((d, i) => (
                <tr key={d.date} className="border-t border-border/60">
                  <th scope="row" className="py-1.5 pr-3 font-medium capitalize">{dayLabel(d.date, i)}</th>
                  <td className="py-1.5 pr-3">{describeWeather(d.code).label}</td>
                  <td className="py-1.5 pr-3">
                    {d.precipitationProbability != null ? `${d.precipitationProbability} %` : "–"} · {formatTemp(d.precipitation)} mm
                  </td>
                  <td className="py-1.5 pr-3">{round(d.gusts)} km/h</td>
                  <td className="py-1.5 text-text-2">{d.model}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <ul>
          {data.daily.map((d, i) => (
            <DailyRow key={d.date} day={d} index={i} min={min} max={max} />
          ))}
        </ul>
        <SourceNote
          source={hasEcmwf ? "Open-Meteo · MétéoSuisse ICON-CH (5 jours) puis ECMWF IFS" : OPEN_METEO_CH}
          updatedAt={new Date(data.fetchedAt)}
        />
      </div>
    </ExpandableCard>
  );
}

function AirCard({ air }: { air: CachedFetchState<AirQuality> }) {
  const data = air.data;
  const source = "Open-Meteo Air Quality · modèle CAMS (Copernicus)";
  if (!data) return <Unavailable state={air} title="Qualité de l'air" source={source} />;

  return (
    <ExpandableCard
      title="Qualité de l'air"
      detail={
        <p className="border-t-[length:var(--border-width)] border-border pt-4 text-sm text-text-2">
          Indice européen (EAQI) : 0–20 bon, 20–40 correct, 40–60 moyen, 60–80 médiocre, 80–100 mauvais, au-delà très mauvais.
          Valeurs modélisées pour Genève, pas une mesure de station.
        </p>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="flex items-baseline gap-3">
          <AnimatedNumber value={data.aqi} format={round} className="font-heading text-5xl leading-none" />
          <span className="text-sm">
            <span className="font-medium">{aqiLabel(data.aqi)}</span> <span className="text-text-2">· indice EAQI</span>
          </span>
        </p>
        <dl className="grid grid-cols-4 gap-3">
          <Stat label="PM2.5">{formatTemp(data.pm25)}</Stat>
          <Stat label="PM10">{formatTemp(data.pm10)}</Stat>
          <Stat label="NO₂">{formatTemp(data.no2)}</Stat>
          <Stat label="Ozone">{formatTemp(data.ozone)}</Stat>
        </dl>
        <p className="text-xs text-text-2">
          Concentrations en µg/m³.
          {data.uvMax != null ? ` UV maximum sur 24 h : ${formatTemp(data.uvMax)} (${uvLabel(data.uvMax)}).` : ""}
        </p>
        <SourceNote source={source} updatedAt={new Date(data.fetchedAt)} />
      </div>
    </ExpandableCard>
  );
}

function AlertsCard({ alerts }: { alerts: CachedFetchState<AlertsPayload> }) {
  const data = alerts.data;
  const source = "Meteoalarm (EUMETNET) · avis de MétéoSuisse";
  if (!data) return <Unavailable state={alerts} title="Alertes" source={source} />;

  return (
    <ExpandableCard
      title="Alertes"
      badge={
        data.geneva.length ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent">{data.geneva.length}</span>
        ) : undefined
      }
      detail={
        data.geneva.length ? (
          <ul className="flex flex-col gap-4 border-t-[length:var(--border-width)] border-border pt-4 text-sm">
            {data.geneva.map((a) => (
              <li key={a.id} className="flex flex-col gap-1">
                <p className="font-medium">{a.headline}</p>
                {a.description ? <p className="text-text-2">{a.description}</p> : null}
                {a.instruction ? <p>{a.instruction}</p> : null}
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                    Voir l&apos;avis officiel
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t-[length:var(--border-width)] border-border pt-4 text-sm text-text-2">
            Les avis de danger (vent, orages, pluie, neige, gel, canicule…) émis par MétéoSuisse pour la région de Genève apparaîtront ici.
          </p>
        )
      }
    >
      <div className="flex flex-col gap-3">
        {data.geneva.length ? (
          <ul className="flex flex-col gap-2">
            {data.geneva.map((a) => (
              <li key={a.id} className="rounded-control border-[length:var(--border-width)] border-border bg-accent-soft px-3 py-2 text-sm">
                <p className="font-medium">{a.headline}</p>
                <p className="text-xs text-text-2">
                  {a.levelLabel}
                  {a.expires ? ` · jusqu'au ${formatDateTime(new Date(a.expires))}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">
            <span className="font-medium">Aucun avis de danger en cours pour Genève.</span>
            {data.elsewhere > 0 ? (
              <span className="text-text-2">
                {" "}
                {data.elsewhere} avis en cours ailleurs en Suisse.
              </span>
            ) : null}
          </p>
        )}
        <SourceNote source={source} updatedAt={new Date(data.fetchedAt)} />
      </div>
    </ExpandableCard>
  );
}
