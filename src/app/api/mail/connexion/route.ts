/** Connecte (ou déconnecte) la boîte Gmail : vérifie l'accès, puis range les identifiants chiffrés dans un cookie serveur. */
import { cookies } from "next/headers";
import { checkAccount, MailError } from "@/lib/mail/imap";
import { MAIL_COOKIE, mailCookieOptions, sealAccount } from "@/lib/mail/secret";

// Peu d'essais : on évite de marteler Gmail avec de mauvais mots de passe.
let attempts: number[] = [];

export async function POST(request: Request) {
  const now = Date.now();
  attempts = attempts.filter((t) => now - t < 10 * 60 * 1000);
  if (attempts.length >= 6) return Response.json({ erreur: "Trop d'essais. Patiente 10 minutes avant de réessayer." }, { status: 429 });
  attempts.push(now);

  const body = (await request.json().catch(() => null)) as { adresse?: unknown; motDePasse?: unknown } | null;
  const user = typeof body?.adresse === "string" ? body.adresse.trim().toLowerCase().slice(0, 200) : "";
  // Google affiche le mot de passe d'application par groupes de 4 lettres : les espaces ne comptent pas.
  const pass = typeof body?.motDePasse === "string" ? body.motDePasse.replace(/\s+/g, "").slice(0, 100) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user) || pass.length < 8) return Response.json({ erreur: "Indique ton adresse Gmail et le mot de passe d'application (16 lettres)." }, { status: 400 });

  try {
    await checkAccount({ user, pass });
  } catch (e) {
    const error = e instanceof MailError ? e : new MailError("La connexion à Gmail a échoué.");
    return Response.json({ erreur: error.message }, { status: error.status });
  }
  const sealed = sealAccount({ user, pass });
  if (!sealed) return Response.json({ erreur: "Le serveur n'est pas configuré pour protéger ces identifiants." }, { status: 503 });
  (await cookies()).set(MAIL_COOKIE, sealed, mailCookieOptions);
  return Response.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).set(MAIL_COOKIE, "", { ...mailCookieOptions, maxAge: 0 });
  return Response.json({ ok: true });
}
