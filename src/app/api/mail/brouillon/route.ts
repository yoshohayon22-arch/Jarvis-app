/** Enregistre un brouillon dans Gmail. Aucun mail n'est jamais envoyé par le Dashboard. */
import { MailError, saveDraft } from "@/lib/mail/imap";
import { readAccount } from "@/lib/mail/secret";

export async function POST(request: Request) {
  const account = await readAccount();
  if (!account) return Response.json({ erreur: "Boîte mail non connectée." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const field = (name: string, max: number) => (typeof body?.[name] === "string" ? (body[name] as string).slice(0, max) : "");
  const to = field("a", 200).trim();
  const text = field("texte", 50_000);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) return Response.json({ erreur: "Adresse du destinataire invalide." }, { status: 400 });
  if (!text.trim()) return Response.json({ erreur: "Le brouillon est vide." }, { status: 400 });
  try {
    await saveDraft(account, { to, subject: field("objet", 300), text, inReplyTo: field("enReponseA", 500) || undefined, references: field("references", 4000) || undefined });
    return Response.json({ ok: true });
  } catch (e) {
    const error = e instanceof MailError ? e : new MailError("L'enregistrement du brouillon a échoué.");
    return Response.json({ erreur: error.message }, { status: error.status });
  }
}
