/**
 * Mode de connexion du site, choisi à la construction par NEXT_PUBLIC_AUTH_MODE :
 * - « motdepasse » : un mot de passe personnel, sans service externe (mode actuel) ;
 * - « supabase »   : compte Supabase (code par email / Google), quand la base sera branchée ;
 * - aucun          : mode local de développement (site fermé en production).
 */
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type AuthMode = "motdepasse" | "supabase" | "aucun";

export const AUTH_MODE: AuthMode =
  process.env.NEXT_PUBLIC_AUTH_MODE === "motdepasse" ? "motdepasse" : isSupabaseConfigured ? "supabase" : "aucun";
