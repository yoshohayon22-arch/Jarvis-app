/**
 * Articles de presse d'un onglet (« une » ou « foot »), lus dans les flux RSS des éditeurs.
 * Seuls le titre, le court résumé du flux et le lien vers l'article original sont transmis.
 */
import type { NextRequest } from "next/server";
import { loadNews } from "@/lib/rss/load";

export async function GET(request: NextRequest) {
  const tab = request.nextUrl.searchParams.get("onglet");
  if (tab !== "une" && tab !== "foot") {
    return Response.json({ erreur: "Paramètre « onglet » attendu : une ou foot." }, { status: 400 });
  }
  return Response.json(await loadNews(tab));
}
