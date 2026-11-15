import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeteoView } from "@/components/meteo/meteo-view";
import { NewsView } from "@/components/presse/news-view";
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
  return <TabView tabId={tab.id} />;
}
