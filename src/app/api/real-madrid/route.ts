/** Données Real Madrid (football-data.org), assemblées et mises en cache côté serveur. */
import { connection } from "next/server";
import { loadRealMadrid } from "@/lib/football/load";

export async function GET() {
  await connection();
  return Response.json(await loadRealMadrid());
}
