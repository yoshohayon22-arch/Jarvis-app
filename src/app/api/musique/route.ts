/** Titre d'un lien Spotify (playlist, album, artiste…), lu sur le service public « oEmbed » de Spotify (aucune clé). */
import type { NextRequest } from "next/server";
import { parseSpotifyUrl } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const item = parseSpotifyUrl(request.nextUrl.searchParams.get("url") ?? "");
  if (!item) return Response.json({ erreur: "Lien Spotify non reconnu." }, { status: 400 });
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/${item.kind}/${item.id}`)}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { title?: unknown };
    return Response.json({ ...item, title: typeof data.title === "string" ? data.title.slice(0, 160) : "" });
  } catch {
    // Le titre est facultatif : sans lui, l'utilisateur garde le nom qu'il a saisi.
    return Response.json({ ...item, title: "" });
  }
}
