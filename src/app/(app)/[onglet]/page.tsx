import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  return <TabView tabId={tab.id} />;
}
