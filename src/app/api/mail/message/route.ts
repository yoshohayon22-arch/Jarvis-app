/** Texte d'un message de la boîte de réception (lecture seule, le message n'est pas marqué comme lu). */
import type { NextRequest } from "next/server";
import { MailError, readMail } from "@/lib/mail/imap";
import { readAccount } from "@/lib/mail/secret";

export async function GET(request: NextRequest) {
  const account = await readAccount();
  if (!account) return Response.json({ erreur: "Boîte mail non connectée." }, { status: 401 });
  const uid = Number(request.nextUrl.searchParams.get("uid"));
  if (!Number.isInteger(uid) || uid <= 0) return Response.json({ erreur: "Message inconnu." }, { status: 400 });
  try {
    return Response.json(await readMail(account, uid));
  } catch (e) {
    const error = e instanceof MailError ? e : new MailError("La lecture du message a échoué.");
    return Response.json({ erreur: error.message }, { status: error.status });
  }
}
