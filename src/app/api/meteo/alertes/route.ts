/**
 * Alertes météo officielles pour la Suisse.
 * Source : Meteoalarm (réseau EUMETNET), qui relaie les avis de danger de MétéoSuisse.
 * Appel côté serveur (la source n'autorise pas les appels directs du navigateur), cache de 10 minutes.
 */
import { connection } from "next/server";
import { cached } from "@/lib/server-cache";
import type { AlertsPayload, WeatherAlert } from "@/lib/meteo/types";

const FEED = "https://feeds.meteoalarm.org/api/v1/warnings/feeds-switzerland";
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

async function loadAlerts(): Promise<AlertsPayload> {
  const res = await fetch(FEED, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Meteoalarm a répondu ${res.status}`);
  const data = (await res.json()) as { warnings?: CapWarning[] };

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

export async function GET() {
  // Toujours exécuté à la demande (jamais figé au moment du build) ; réponse gardée 10 minutes en mémoire.
  await connection();
  try {
    return Response.json(await cached("meteo-alertes", 10 * 60 * 1000, loadAlerts));
  } catch (e) {
    return Response.json({ erreur: e instanceof Error ? e.message : "Source indisponible" }, { status: 502 });
  }
}
