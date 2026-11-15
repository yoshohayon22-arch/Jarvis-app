/** Journée en cours des grandes compétitions (API publique d'ESPN), mise en cache 2 minutes côté serveur. */
import { connection } from "next/server";
import { loadMatchday } from "@/lib/football/load";
import { MATCH_LEAGUES } from "@/lib/football/leagues";

export async function GET() {
  await connection();
  const parts = await Promise.all(MATCH_LEAGUES.map(([slug, name]) => loadMatchday(slug, name)));
  return Response.json({ leagues: MATCH_LEAGUES.map(([slug, name], i) => ({ slug, name, matches: parts[i] })) });
}
