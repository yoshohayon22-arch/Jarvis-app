/** Sélection du jour de Wikipédia en français, pour l'onglet Culture G. */
import { connection } from "next/server";
import { loadCulture } from "@/lib/culture/load";

export async function GET() {
  await connection();
  try {
    return Response.json(await loadCulture());
  } catch (e) {
    return Response.json({ erreur: e instanceof Error ? e.message : "erreur inconnue" }, { status: 502 });
  }
}
