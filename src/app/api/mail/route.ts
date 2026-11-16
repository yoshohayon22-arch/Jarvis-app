/** Boîte de réception (lecture seule). Paramètres : q (recherche, syntaxe Gmail), nonlus=1. */
import type { NextRequest } from "next/server";
import { listMails, MailError } from "@/lib/mail/imap";
import { readAccount } from "@/lib/mail/secret";

export async function GET(request: NextRequest) {
  const account = await readAccount();
  if (!account) return Response.json({ connected: false });
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 300);
  const unreadOnly = request.nextUrl.searchParams.get("nonlus") === "1";
  try {
    const { mails, total } = await listMails(account, query, unreadOnly);
    return Response.json({ connected: true, account: account.user, mails, total, fetchedAt: new Date().toISOString() });
  } catch (e) {
    const error = e instanceof MailError ? e : new MailError("La lecture de la boîte mail a échoué.");
    return Response.json({ connected: true, account: account.user, erreur: error.message, identifiants: error.status === 401 }, { status: error.status });
  }
}
