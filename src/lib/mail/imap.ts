import "server-only";

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { MailAccount } from "./secret";
import type { MailMessage, MailRow } from "./types";

/** Erreur dont le message est déjà rédigé pour l'utilisateur. */
export class MailError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

function explain(e: unknown): MailError {
  if (e instanceof MailError) return e;
  const err = e as { authenticationFailed?: boolean; code?: string; responseText?: string };
  if (err?.authenticationFailed) return new MailError("Gmail a refusé la connexion : adresse ou mot de passe d'application incorrect.", 401);
  if (err?.code === "ETIMEDOUT" || err?.code === "ETIMEOUT") return new MailError("Gmail ne répond pas pour le moment. Réessaie dans un instant.");
  return new MailError("La lecture de la boîte mail a échoué. Réessaie dans un instant.");
}

/** Ouvre une connexion IMAP à Gmail le temps d'une opération, puis la referme. */
async function withImap<T>(account: MailAccount, run: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: account, logger: false, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 15000 });
  // Sans écouteur, une coupure réseau ferait planter le serveur au lieu d'échouer proprement.
  client.on("error", () => undefined);
  try {
    await client.connect();
    return await run(client);
  } catch (e) {
    throw explain(e);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

export const checkAccount = (account: MailAccount) => withImap(account, async () => true);

const clean = (s: string | undefined, max: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Les messages les plus récents de la boîte de réception. `query` : syntaxe de recherche Gmail (facultatif). */
export function listMails(account: MailAccount, query: string, unreadOnly: boolean, limit = 30): Promise<{ mails: MailRow[]; total: number }> {
  return withImap(account, async (client) => {
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      const found = await client.search({ ...(query ? { gmraw: query } : { all: true }), ...(unreadOnly ? { seen: false } : {}) }, { uid: true });
      const uids = (found || []).slice(-limit);
      const mails: MailRow[] = [];
      if (uids.length) {
        for await (const msg of client.fetch(uids, { envelope: true, flags: true, internalDate: true }, { uid: true })) {
          const sender = msg.envelope?.from?.[0];
          const date = msg.envelope?.date ?? msg.internalDate;
          mails.push({
            uid: msg.uid,
            from: clean(sender?.name, 120) || clean(sender?.address, 120) || "Expéditeur inconnu",
            email: clean(sender?.address, 200),
            subject: clean(msg.envelope?.subject, 300) || "(sans objet)",
            date: date ? new Date(date).toISOString() : null,
            unread: !msg.flags?.has("\\Seen"),
          });
        }
      }
      return { mails: mails.sort((a, b) => b.uid - a.uid), total: (found || []).length };
    } finally {
      lock.release();
    }
  });
}

const MAX_TEXT = 40_000;

/** Lit un message (texte brut). La boîte est ouverte en lecture seule : le message n'est pas marqué comme lu. */
export function readMail(account: MailAccount, uid: number): Promise<MailMessage> {
  return withImap(account, async (client) => {
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      const download = await client.download(String(uid), undefined, { uid: true, maxBytes: 3 * 1024 * 1024 });
      if (!download?.content) throw new MailError("Ce message est introuvable (il a peut-être été déplacé).", 404);
      const parsed = await simpleParser(download.content, { skipImageLinks: true });
      const sender = parsed.from?.value?.[0];
      const body = (parsed.text ?? "").replace(/\n{3,}/g, "\n\n").trim();
      const to = Array.isArray(parsed.to) ? parsed.to.map((t) => t.text).join(", ") : (parsed.to?.text ?? "");
      const refs = Array.isArray(parsed.references) ? parsed.references.join(" ") : (parsed.references ?? "");
      return {
        uid,
        from: clean(sender?.name, 120) || clean(sender?.address, 120) || "Expéditeur inconnu",
        email: clean(sender?.address, 200),
        to: clean(to, 300),
        subject: clean(parsed.subject, 300) || "(sans objet)",
        date: parsed.date ? parsed.date.toISOString() : null,
        text: body.slice(0, MAX_TEXT),
        truncated: body.length > MAX_TEXT,
        messageId: clean(parsed.messageId, 500),
        references: clean(refs, 4000),
      };
    } finally {
      lock.release();
    }
  });
}

const header = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
const encoded = (value: string) => (/^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`);

/** Enregistre un brouillon dans Gmail (dossier Brouillons). Rien n'est jamais envoyé. */
export function saveDraft(account: MailAccount, draft: { to: string; subject: string; text: string; inReplyTo?: string; references?: string }): Promise<void> {
  return withImap(account, async (client) => {
    const drafts = (await client.list()).find((box) => box.specialUse === "\\Drafts")?.path;
    if (!drafts) throw new MailError("Dossier Brouillons introuvable dans cette boîte.");
    const lines = [
      `From: ${header(account.user)}`,
      `To: ${header(draft.to)}`,
      `Subject: ${encoded(header(draft.subject))}`,
      `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: base64",
    ];
    if (draft.inReplyTo) lines.push(`In-Reply-To: ${header(draft.inReplyTo)}`, `References: ${header(`${draft.references ?? ""} ${draft.inReplyTo}`)}`);
    const body = Buffer.from(draft.text, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");
    const result = await client.append(drafts, `${lines.join("\r\n")}\r\n\r\n${body}\r\n`, ["\\Draft", "\\Seen"]);
    if (!result) throw new MailError("Gmail n'a pas enregistré le brouillon.");
  });
}
