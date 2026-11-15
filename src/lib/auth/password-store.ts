import "server-only";

import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Vérification du mot de passe (mode « mot de passe »).
 * Le site ne connaît pas le mot de passe : il n'en garde qu'une empreinte scrypt salée,
 * dans la variable d'environnement serveur PASSWORD_HASH (format « sel:empreinte », en hexadécimal).
 * Pour changer de mot de passe : `node scripts/empreinte-mot-de-passe.mjs`, puis remplacer PASSWORD_HASH chez l'hébergeur.
 */
const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

/**
 * Compteur d'échecs en mémoire : après 5 erreurs de suite, la connexion est bloquée 15 minutes.
 * Il vit le temps d'une instance du serveur ; la vraie protection reste la longueur de la phrase de passe.
 */
const attempts = { failures: 0, lockedUntil: 0 };

export type VerifyResult = { ok: true } | { ok: false; reason: "incorrect" | "bloque" | "absent"; retryInMinutes?: number };

export async function verifyPassword(password: string): Promise<VerifyResult> {
  const [saltHex, hashHex] = (process.env.PASSWORD_HASH ?? "").split(":");
  if (!saltHex || !hashHex) return { ok: false, reason: "absent" };

  if (attempts.lockedUntil > Date.now()) {
    return { ok: false, reason: "bloque", retryInMinutes: Math.ceil((attempts.lockedUntil - Date.now()) / 60000) };
  }

  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  if (expected.length > 0 && timingSafeEqual(expected, actual)) {
    attempts.failures = 0;
    return { ok: true };
  }

  attempts.failures += 1;
  if (attempts.failures >= MAX_FAILURES) {
    attempts.failures = 0;
    attempts.lockedUntil = Date.now() + LOCK_MS;
    return { ok: false, reason: "bloque", retryInMinutes: LOCK_MS / 60000 };
  }
  return { ok: false, reason: "incorrect" };
}
