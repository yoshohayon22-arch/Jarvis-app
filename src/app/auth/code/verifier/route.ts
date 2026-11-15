/**
 * Connexion par code : vérifie le code reçu par email et ouvre la session (cookies).
 */
import { NextResponse } from "next/server";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSupabaseConfigured) return NextResponse.json({ ok: false }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { email?: unknown; code?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.replace(/\s/g, "") : "";

  if (!isEmailAllowed(email) || !/^\d{6,10}$/.test(code)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });

  if (error || !isEmailAllowed(data.user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
