import "server-only";

import { decodeEntities, parseFeed } from "@/lib/rss/parse";
import { cached } from "@/lib/server-cache";

/** Vidéos récentes d'une chaîne, lues dans son flux public (aucune clé nécessaire). */
export interface Video {
  id: string;
  title: string;
  url: string;
  publishedAt: string | null;
  channelId: string;
  channelName: string;
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Accept-Language": "fr-CH,fr;q=0.9",
  // Évite la page de consentement aux cookies que YouTube affiche aux visiteurs européens.
  Cookie: "SOCS=CAI; CONSENT=YES+1",
};
export const CHANNEL_ID = /^UC[\w-]{22}$/;

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(9000), cache: "no-store" }).catch((e: unknown) => {
    throw new Error(e instanceof Error && e.name === "TimeoutError" ? "YouTube ne répond pas (9 secondes)" : "YouTube injoignable");
  });
  if (res.status === 404) throw new Error("chaîne introuvable");
  if (!res.ok) throw new Error(`YouTube a répondu ${res.status}`);
  return res.text();
}

export function loadChannel(channelId: string): Promise<{ name: string; videos: Video[] }> {
  return cached(`youtube:${channelId}`, 15 * 60 * 1000, async () => {
    const xml = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    const name = decodeEntities(xml.match(/<author>\s*<name>([^<]+)<\/name>/)?.[1] ?? xml.match(/<title>([^<]+)<\/title>/)?.[1] ?? "").trim() || "Chaîne YouTube";
    const videos = parseFeed(xml, 15)
      .map((item) => ({ id: item.link.match(/[?&]v=([\w-]{11})/)?.[1] ?? item.link.match(/\/shorts\/([\w-]{11})/)?.[1] ?? "", title: item.title, url: item.link, publishedAt: item.publishedAt, channelId, channelName: name }))
      .filter((v) => v.id);
    return { name, videos };
  });
}

/**
 * Retrouve une chaîne à partir de ce que l'utilisateur colle : identifiant « UC… », lien de chaîne, ou nom « @… ».
 * Pour un nom, on lit la page publique de la chaîne et on y relève son identifiant.
 */
export async function resolveChannel(input: string): Promise<{ id: string; name: string }> {
  const text = input.trim();
  let id = text.match(/(?:^|\/channel\/)(UC[\w-]{22})(?:$|[/?#])/)?.[1] ?? (CHANNEL_ID.test(text) ? text : "");
  if (!id) {
    const handle = text.match(/youtube\.com\/(@[\w.-]{2,60})/i)?.[1] ?? text.match(/^@?([\w.-]{2,60})$/)?.[0];
    const legacy = text.match(/youtube\.com\/((?:c|user)\/[\w.-]{1,80})/i)?.[1];
    if (!handle && !legacy) throw new Error("colle le lien d'une chaîne YouTube ou son nom commençant par @");
    const html = await get(`https://www.youtube.com/${legacy ?? (handle!.startsWith("@") ? handle : `@${handle}`)}`);
    id = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1] ?? html.match(/"(?:externalId|channelId)":"(UC[\w-]{22})"/)?.[1] ?? html.match(/channel_id=(UC[\w-]{22})/)?.[1] ?? "";
    if (!id) throw new Error("impossible de reconnaître cette chaîne ; essaie avec le lien complet de la chaîne");
  }
  return { id, name: (await loadChannel(id)).name };
}
