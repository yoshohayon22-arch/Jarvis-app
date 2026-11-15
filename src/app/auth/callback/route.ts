/**
 * Retour de Google après connexion : on échange le code contre une session Supabase,
 * puis on vérifie que le compte est bien celui de la liste blanche.
 */
import { NextResponse } from "next/server";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/connexion?erreur=${searchParams.get("error") ? "refuse" : "code"}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !isEmailAllowed(data.user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/connexion?erreur=refuse`);
  }

  return NextResponse.redirect(`${origin}/`);
}
