"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

let browserClient: Promise<SupabaseClient> | null = null;

/**
 * Client Supabase côté navigateur (une seule instance), chargé à la demande
 * pour ne pas alourdir le premier affichage. Renvoie null si Supabase n'est pas configuré.
 */
export function getSupabaseBrowserClient(): Promise<SupabaseClient> | null {
  if (!isSupabaseConfigured) return null;
  browserClient ??= import("@supabase/ssr").then(({ createBrowserClient }) =>
    createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY),
  );
  return browserClient;
}
