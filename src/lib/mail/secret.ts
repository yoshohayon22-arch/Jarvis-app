import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getSessionSecret } from "@/lib/auth/session";

/**
 * Accès à la boîte mail : l'adresse et le « mot de passe d'application » Google sont chiffrés (AES-256-GCM,
 * clé dérivée de SESSION_SECRET) et rangés dans un cookie que seul le serveur peut lire (HttpOnly).
 * Rien n'est enregistré sur le serveur, et le navigateur ne peut pas relire le mot de passe.
 */
export const MAIL_COOKIE = "dash_mail";
export const mailCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/api/mail", maxAge: 60 * 60 * 24 * 180 };

export interface MailAccount {
  user: string;
  pass: string;
}

function key(): Buffer | null {
  const secret = getSessionSecret();
  return secret ? createHash("sha256").update(`mail:${secret}`).digest() : null;
}

export function sealAccount(account: MailAccount): string | null {
  const k = key();
  if (!k) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(account), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

export async function readAccount(): Promise<MailAccount | null> {
  const k = key();
  const value = (await cookies()).get(MAIL_COOKIE)?.value;
  if (!k || !value) return null;
  try {
    const raw = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", k, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const account = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")) as MailAccount;
    return typeof account.user === "string" && typeof account.pass === "string" ? account : null;
  } catch {
    return null;
  }
}
