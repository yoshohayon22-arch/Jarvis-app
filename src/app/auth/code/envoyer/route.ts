/**
 * Connexion par code : envoie un code à usage unique par email (Supabase Auth).
 * Le code n'est envoyé que si l'adresse est celle de la liste blanche ;
 * la réponse est identique dans tous les cas pour ne rien révéler.
 */
import { NextResponse } from "next/server";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSupabaseConfigured) return NextResponse.json({ ok: false, erreur: "config" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (isEmailAllowed(email)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    // Limite d'envoi atteinte (Supabase) : on le dit, car seul le propriétaire arrive ici.
    if (error?.status === 429) return NextResponse.json({ ok: false, erreur: "limite" }, { status: 429 });
    if (error) return NextResponse.json({ ok: false, erreur: "envoi" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
