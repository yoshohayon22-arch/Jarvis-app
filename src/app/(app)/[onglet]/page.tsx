import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CultureView } from "@/components/culture/culture-view";
import { MatchsView } from "@/components/matchs/matchs-view";
import { MeteoView } from "@/components/meteo/meteo-view";
import { NewsView } from "@/components/presse/news-view";
import { RealMadridView } from "@/components/real-madrid/real-madrid-view";
import { CalendarView } from "@/components/vie-juive/calendar-view";
import { CoursView } from "@/components/vie-juive/cours-view";
import { StudyView } from "@/components/vie-juive/study-view";
import { TabView } from "@/components/tab-view";
import { getTab, TAB_IDS } from "@/lib/tabs";

/** Une page par onglet, générée à l'avance. */
export function generateStaticParams() {
  return TAB_IDS.map((onglet) => ({ onglet }));
}

export async function generateMetadata({ params }: PageProps<"/[onglet]">): Promise<Metadata> {
  const { onglet } = await params;
  return { title: getTab(onglet)?.label ?? "Onglet" };
}

export default async function TabPage({ params }: PageProps<"/[onglet]">) {
  const { onglet } = await params;
  const tab = getTab(onglet);
  if (!tab) notFound();
  // Onglets déjà branchés sur de vraies données ; les autres affichent leurs cartes prévues.
  if (tab.id === "meteo") return <MeteoView />;
  if (tab.id === "la-une") return <NewsView tab="une" />;
  if (tab.id === "foot") return <NewsView tab="foot" />;
  if (tab.id === "real-madrid") return <RealMadridView />;
  if (tab.id === "veille-ia") return <NewsView tab="ia" />;
  if (tab.id === "culture-g") return <CultureView />;
  if (tab.id === "matchs-tv") return <MatchsView />;
  if (tab.id === "calendrier") return <CalendarView />;
  if (tab.id === "paracha" || tab.id === "tehilim" || tab.id === "halakha" || tab.id === "rambam") return <StudyView section={tab.id} />;
  if (tab.id === "cours") return <CoursView />;
  return <TabView tabId={tab.id} />;
}
