import "server-only";

import { cached } from "@/lib/server-cache";
import { channelFeedUrl, channelIdFromHtml, channelLookup, parseChannelFeed, type Video } from "./parse";

export { CHANNEL_ID } from "./parse";
export type { Video };

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Accept-Language": "fr-CH,fr;q=0.9",
  // Évite la page de consentement aux cookies que YouTube affiche aux visiteurs européens.
  Cookie: "SOCS=CAI; CONSENT=YES+1",
};

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(9000), cache: "no-store" }).catch((e: unknown) => {
    throw new Error(e instanceof Error && e.name === "TimeoutError" ? "YouTube ne répond pas (9 secondes)" : "YouTube injoignable");
  });
  if (res.status === 404) throw new Error("chaîne introuvable");
  if (!res.ok) throw new Error(`YouTube a répondu ${res.status}`);
  return res.text();
}

/** Vidéos récentes d'une chaîne, lues dans son flux public (aucune clé nécessaire). Gardées 15 minutes. */
export function loadChannel(channelId: string): Promise<{ name: string; videos: Video[] }> {
  return cached(`youtube:${channelId}`, 15 * 60 * 1000, async () => parseChannelFeed(await get(channelFeedUrl(channelId)), channelId));
}

/** Retrouve une chaîne à partir d'un identifiant, d'un lien ou d'un nom « @… ». */
export async function resolveChannel(input: string): Promise<{ id: string; name: string }> {
  const lookup = channelLookup(input);
  if (!lookup) throw new Error("colle le lien d'une chaîne YouTube ou son nom commençant par @");
  const id = "id" in lookup ? lookup.id : channelIdFromHtml(await get(lookup.page));
  if (!id) throw new Error("impossible de reconnaître cette chaîne ; essaie avec le lien complet de la chaîne");
  return { id, name: (await loadChannel(id)).name };
}
