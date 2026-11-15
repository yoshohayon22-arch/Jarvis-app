/** Connexion par mot de passe : vérifie l'empreinte et ouvre une session (cookie signé, 90 jours). */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_MODE } from "@/lib/auth/mode";
import { verifyPassword } from "@/lib/auth/password-store";
import { createSessionValue, getSessionSecret, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (e) {
    // Panne du stockage : on répond proprement, avec la nature de l'erreur (jamais de donnée sensible).
    const detail = e instanceof Error ? `${e.name} : ${e.message}`.slice(0, 200) : "erreur inconnue";
    return NextResponse.json({ ok: false, erreur: "stockage", detail }, { status: 500 });
  }
}

async function handle(request: Request) {
  const secret = getSessionSecret();
  if (AUTH_MODE !== "motdepasse" || !secret) return NextResponse.json({ ok: false, erreur: "config" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { motDePasse?: unknown } | null;
  const password = typeof body?.motDePasse === "string" ? body.motDePasse.slice(0, 200) : "";
  if (!password) return NextResponse.json({ ok: false, erreur: "incorrect" }, { status: 401 });

  const result = await verifyPassword(password);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, erreur: result.reason, minutes: result.retryInMinutes },
      { status: result.reason === "bloque" ? 429 : 401 },
    );
  }

  (await cookies()).set(SESSION_COOKIE, await createSessionValue(secret), sessionCookieOptions);
  return NextResponse.json({ ok: true });
}
