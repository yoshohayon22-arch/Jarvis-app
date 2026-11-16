/** Retrouve une chaîne YouTube à partir d'un lien, d'un nom « @… » ou d'un identifiant. */
import type { NextRequest } from "next/server";
import { resolveChannel } from "@/lib/youtube/load";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 300);
  try {
    return Response.json(await resolveChannel(q));
  } catch (e) {
    return Response.json({ erreur: e instanceof Error ? e.message : "chaîne introuvable" }, { status: 404 });
  }
}
