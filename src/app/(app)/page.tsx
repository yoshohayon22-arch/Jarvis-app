"use client";

/** Pas de page d'accueil : on ouvre directement le premier onglet visible (ordre choisi dans les réglages). */
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SkeletonGrid } from "@/components/ui/skeleton-card";
import { usePrefs } from "@/lib/prefs/prefs-provider";
import { visibleTabIds } from "@/lib/prefs/preferences";

export default function Home() {
  const router = useRouter();
  const { prefs, ready } = usePrefs();

  useEffect(() => {
    if (!ready) return;
    router.replace(`/${visibleTabIds(prefs)[0] ?? "reglages"}`);
  }, [ready, prefs, router]);

  return <SkeletonGrid />;
}
