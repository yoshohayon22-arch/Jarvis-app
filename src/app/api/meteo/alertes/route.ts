/**
 * Alertes météo officielles pour la Suisse.
 * Source : Meteoalarm (réseau EUMETNET), qui relaie les avis de danger de MétéoSuisse.
 * Appel côté serveur (la source n'autorise pas les appels directs du navigateur), cache de 10 minutes.
 */
import { connection } from "next/server";
import { cached } from "@/lib/server-cache";
import { METEOALARM_FEED, parseAlerts } from "@/lib/meteo/alerts";
import type { AlertsPayload } from "@/lib/meteo/types";

async function loadAlerts(): Promise<AlertsPayload> {
  const res = await fetch(METEOALARM_FEED, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Meteoalarm a répondu ${res.status}`);
  return parseAlerts((await res.json()) as Parameters<typeof parseAlerts>[0]);
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
