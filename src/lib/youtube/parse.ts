/** Lecture des pages et flux publics de YouTube (fonctions pures, partagées par le site et la version artefact). */
import { decodeEntities, parseFeed } from "@/lib/rss/parse";

export interface Video {
  id: string;
  title: string;
  url: string;
  publishedAt: string | null;
  channelId: string;
  channelName: string;
}

export const CHANNEL_ID = /^UC[\w-]{22}$/;
export const channelFeedUrl = (channelId: string) => `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

/**
 * Ce que l'utilisateur colle : identifiant « UC… », lien de chaîne, ou nom « @… ».
 * Renvoie l'identifiant s'il est déjà dans le texte, sinon l'adresse de la page de chaîne à lire pour le trouver.
 */
export function channelLookup(input: string): { id: string } | { page: string } | null {
  const text = input.trim();
  const id = text.match(/(?:^|\/channel\/)(UC[\w-]{22})(?:$|[/?#])/)?.[1] ?? (CHANNEL_ID.test(text) ? text : "");
  if (id) return { id };
  const legacy = text.match(/youtube\.com\/((?:c|user)\/[\w.-]{1,80})/i)?.[1];
  if (legacy) return { page: `https://www.youtube.com/${legacy}` };
  const handle = text.match(/youtube\.com\/@([\w.-]{2,60})/i)?.[1] ?? text.match(/^@?([\w.-]{2,60})$/)?.[1];
  return handle ? { page: `https://www.youtube.com/@${handle}` } : null;
}

/** Relève l'identifiant de la chaîne dans le code de sa page publique. */
export function channelIdFromHtml(html: string): string {
  // Seuls des repères propres à la chaîne affichée : la page cite aussi les identifiants d'autres chaînes (« channelId »).
  return (
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1] ??
    html.match(/<meta property="og:url" content="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1] ??
    html.match(/<meta itemprop="identifier" content="(UC[\w-]{22})"/)?.[1] ??
    html.match(/"externalId":"(UC[\w-]{22})"/)?.[1] ??
    ""
  );
}

export function parseChannelFeed(xml: string, channelId: string): { name: string; videos: Video[] } {
  const name = decodeEntities(xml.match(/<author>\s*<name>([^<]+)<\/name>/)?.[1] ?? xml.match(/<title>([^<]+)<\/title>/)?.[1] ?? "").trim() || "Chaîne YouTube";
  const videos = parseFeed(xml, 15)
    .map((item) => ({ id: item.link.match(/[?&]v=([\w-]{11})/)?.[1] ?? item.link.match(/\/shorts\/([\w-]{11})/)?.[1] ?? "", title: item.title, url: item.link, publishedAt: item.publishedAt, channelId, channelName: name }))
    .filter((v) => v.id);
  return { name, videos };
}
