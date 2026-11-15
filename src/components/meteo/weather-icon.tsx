import type { WeatherKind } from "@/lib/meteo/types";
import { cn } from "@/lib/utils";

/**
 * Icône météo animée en SVG (soleil qui tourne, nuage qui dérive, pluie et neige qui tombent, éclair).
 * Animations CSS sur transform/opacity uniquement, coupées si « réduire les animations » est actif.
 * Elle suit la couleur du texte du thème (currentColor) ; l'accent colore soleil et éclair.
 */
export function WeatherIcon({
  kind,
  isDay = true,
  animated = false,
  className,
}: {
  kind: WeatherKind;
  isDay?: boolean;
  /** Les grandes icônes sont animées ; les petites (listes) restent fixes pour ne pas distraire. */
  animated?: boolean;
  className?: string;
}) {
  const cloudy = kind !== "clair";
  const sunVisible = kind === "clair" || kind === "peu-nuageux" || kind === "averses";
  const drops = kind === "pluie" || kind === "averses" || kind === "bruine" || kind === "orage";

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("wx", animated && "wx-animated", className)}
    >
      {sunVisible && isDay ? (
        <g className="wx-sun" style={{ transformOrigin: cloudy ? "22px 22px" : "32px 32px" }} stroke="var(--accent)">
          {cloudy ? (
            <>
              <circle cx="22" cy="22" r="7" />
              <path d="M22 7v4M7 22h4M11.4 11.4l2.8 2.8M32.6 11.4l-2.8 2.8M33 22h4" />
            </>
          ) : (
            <>
              <circle cx="32" cy="32" r="11" />
              <path d="M32 8v6M32 50v6M8 32h6M50 32h6M15 15l4.3 4.3M44.7 44.7 49 49M49 15l-4.3 4.3M19.3 44.7 15 49" />
            </>
          )}
        </g>
      ) : null}

      {sunVisible && !isDay ? (
        <path
          className="wx-moon"
          stroke="var(--accent)"
          d={cloudy ? "M27 9a11 11 0 1 0 8 15 9 9 0 0 1-8-15Z" : "M38 12a20 20 0 1 0 14 27 16 16 0 0 1-14-27Z"}
        />
      ) : null}

      {cloudy ? (
        <path
          className="wx-cloud"
          fill="var(--surface)"
          d={
            kind === "brouillard"
              ? "M20 34a10 10 0 0 1 1.5-19.9A13 13 0 0 1 46 17a9 9 0 0 1 1 17Z"
              : "M20 42a10 10 0 0 1 1.5-19.9A13 13 0 0 1 46 25a9 9 0 0 1 1 17Z"
          }
        />
      ) : null}

      {kind === "brouillard" ? (
        <g className="wx-fog">
          <path d="M14 42h36M20 50h28" />
        </g>
      ) : null}

      {drops ? (
        <g className="wx-rain" strokeWidth={kind === "bruine" ? 2 : 3}>
          <path className="wx-drop" d="M24 48l-2 6" />
          <path className="wx-drop wx-delay-1" d="M34 48l-2 6" />
          {kind !== "orage" ? <path className="wx-drop wx-delay-2" d="M44 48l-2 6" /> : null}
        </g>
      ) : null}

      {kind === "neige" ? (
        <g className="wx-snow" strokeWidth="4">
          <path className="wx-flake" d="M23 50h.01" />
          <path className="wx-flake wx-delay-1" d="M33 54h.01" />
          <path className="wx-flake wx-delay-2" d="M43 50h.01" />
        </g>
      ) : null}

      {kind === "orage" ? <path className="wx-bolt" stroke="var(--accent)" d="M42 44l-5 8h6l-4 8" /> : null}
    </svg>
  );
}
