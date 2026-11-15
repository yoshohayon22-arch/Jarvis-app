/**
 * Onglets « Vie juive » : calendrier (Hebcal) et textes d'étude du jour (Hebcal + Sefaria).
 * ?section=calendrier&bougies=18   |   ?section=paracha|tehilim|halakha   |   ?section=rambam&chapitres=1|3
 */
import type { NextRequest } from "next/server";
import { getCalendar } from "@/lib/judaisme/hebcal";
import { loadStudy } from "@/lib/judaisme/study";
import type { StudySection } from "@/lib/judaisme/types";

const STUDY: StudySection[] = ["paracha", "tehilim", "halakha", "rambam"];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const section = params.get("section");
  try {
    if (section === "calendrier") {
      // Délai d'allumage avant le coucher du soleil : 18 minutes par défaut, réglable de 10 à 60.
      const minutes = Number.parseInt(params.get("bougies") ?? "18", 10);
      const candleMinutes = Number.isFinite(minutes) ? Math.min(60, Math.max(10, minutes)) : 18;
      return Response.json(await getCalendar(candleMinutes));
    }
    if (STUDY.includes(section as StudySection)) {
      return Response.json(await loadStudy(section as StudySection, params.get("chapitres") === "3" ? 3 : 1));
    }
    return Response.json({ erreur: "Paramètre « section » inconnu." }, { status: 400 });
  } catch (e) {
    return Response.json({ erreur: e instanceof Error ? e.message : "source indisponible" }, { status: 502 });
  }
}
