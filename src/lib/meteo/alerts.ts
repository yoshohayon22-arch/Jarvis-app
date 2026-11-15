/**
 * Alertes météo officielles pour la Suisse.
 * Source : Meteoalarm (réseau EUMETNET), qui relaie les avis de danger de MétéoSuisse.
 */
import type { AlertsPayload, WeatherAlert } from "./types";

export const METEOALARM_FEED = "https://feeds.meteoalarm.org/api/v1/warnings/feeds-switzerland";
const GENEVA = /gen[eè]ve|geneva|genf|ginevra/i;
const LEVELS: Record<number, string> = { 2: "Jaune · danger modéré", 3: "Orange · danger marqué", 4: "Rouge · fort danger" };

interface CapInfo {
  language?: string;
  headline?: string;
  event?: string;
  description?: string;
  instruction?: string;
  onset?: string;
  expires?: string;
  web?: string;
  area?: { areaDesc?: string }[];
  parameter?: { valueName?: string; value?: string }[];
}
interface CapWarning {
  uuid?: string;
  alert?: { identifier?: string; info?: CapInfo[] };
}

/** Transforme la réponse brute de Meteoalarm en alertes pour Genève. */
export function parseAlerts(data: { warnings?: CapWarning[] }): AlertsPayload {
  const now = Date.now();
  const geneva: WeatherAlert[] = [];
  let elsewhere = 0;

  for (const warning of data.warnings ?? []) {
    const infos = warning.alert?.info ?? [];
    // On préfère la version française, sinon la première disponible.
    const info = infos.find((i) => i.language?.toLowerCase().startsWith("fr")) ?? infos[0];
    if (!info) continue;

    const levelRaw = info.parameter?.find((p) => p.valueName === "awareness_level")?.value ?? "";
    const level = Number.parseInt(levelRaw, 10);
    // Niveau 1 (vert) = pas de danger particulier ; on ignore aussi les avis expirés.
    if (!Number.isFinite(level) || level < 2) continue;
    if (info.expires && new Date(info.expires).getTime() < now) continue;

    const areas = [...new Set(infos.flatMap((i) => i.area ?? []).map((a) => a.areaDesc ?? "").filter(Boolean))];
    if (!areas.some((a) => GENEVA.test(a))) {
      elsewhere += 1;
      continue;
    }

    geneva.push({
      id: warning.uuid ?? warning.alert?.identifier ?? `${info.headline}-${info.onset}`,
      headline: info.headline ?? info.event ?? "Avis de danger",
      description: info.description ?? "",
      instruction: info.instruction ?? null,
      level,
      levelLabel: LEVELS[level] ?? `Niveau ${level}`,
      areas,
      onset: info.onset ?? null,
      expires: info.expires ?? null,
      url: info.web ?? null,
    });
  }

  geneva.sort((a, b) => b.level - a.level);
  return { geneva, elsewhere, fetchedAt: new Date().toISOString() };
}

