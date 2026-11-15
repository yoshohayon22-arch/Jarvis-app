/**
 * Première connexion : le propriétaire choisit son mot de passe grâce à un lien à usage unique.
 * Le jeton du lien (SETUP_TOKEN) ne sert qu'une fois : dès qu'un mot de passe existe, cette route refuse tout.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_MODE } from "@/lib/auth/mode";
import { createPassword, hasPassword } from "@/lib/auth/password-store";
import { createSessionValue, getSessionSecret, MIN_PASSWORD_LENGTH, safeEqual, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: Request) {
  const secret = getSessionSecret();
  const setupToken = process.env.SETUP_TOKEN ?? "";
  if (AUTH_MODE !== "motdepasse" || !secret || setupToken.length < 24) {
    return NextResponse.json({ ok: false, erreur: "config" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { jeton?: unknown; motDePasse?: unknown } | null;
  const token = typeof body?.jeton === "string" ? body.jeton : "";
  const password = typeof body?.motDePasse === "string" ? body.motDePasse : "";

  if (!safeEqual(token, setupToken) || (await hasPassword())) {
    return NextResponse.json({ ok: false, erreur: "lien" }, { status: 403 });
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 200) {
    return NextResponse.json({ ok: false, erreur: "longueur" }, { status: 400 });
  }
  if (!(await createPassword(password))) {
    return NextResponse.json({ ok: false, erreur: "lien" }, { status: 403 });
  }

  (await cookies()).set(SESSION_COOKIE, await createSessionValue(secret), sessionCookieOptions);
  return NextResponse.json({ ok: true });
}
