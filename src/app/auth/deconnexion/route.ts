import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_MODE } from "@/lib/auth/mode";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Déconnexion (POST uniquement, pour éviter une déconnexion par simple lien). */
export async function POST(request: Request) {
  if (AUTH_MODE === "motdepasse") {
    (await cookies()).delete(SESSION_COOKIE);
  } else if (AUTH_MODE === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/connexion", request.url), { status: 303 });
}
