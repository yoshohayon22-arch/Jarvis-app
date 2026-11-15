"use client";

import { MotionConfig } from "motion/react";
import { useEffect } from "react";
import { PrefsProvider } from "@/lib/prefs/prefs-provider";

/** Fournisseurs globaux : préférences + respect de prefers-reduced-motion pour toutes les animations. */
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Service worker (PWA) : uniquement en production pour ne pas gêner le développement.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <PrefsProvider>{children}</PrefsProvider>
    </MotionConfig>
  );
}
