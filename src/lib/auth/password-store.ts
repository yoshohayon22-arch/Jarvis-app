import "server-only";

import { getStore } from "@netlify/blobs";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Stockage du mot de passe (mode « mot de passe »).
 * Seule une empreinte scrypt salée est conservée, jamais le mot de passe lui-même.
 * Elle est rangée dans Netlify Blobs (stockage privé du site, chiffré, accessible uniquement par le serveur).
 */
const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

interface PasswordRecord {
  salt: string;
  hash: string;
  createdAt: string;
}
interface AttemptsRecord {
  failures: number;
  lockedUntil: number;
}

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

/** En local (hors Netlify), LOCAL_AUTH_STORE=1 active un stockage en mémoire pour les tests. */
const memory = new Map<string, unknown>();
const useMemory = process.env.LOCAL_AUTH_STORE === "1";

const store = () => getStore("auth");

/** Évite qu'un stockage qui ne répond pas bloque la page 30 secondes : on abandonne après 6 s avec une erreur claire. */
function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`stockage : ${what} sans réponse`)), 6000)),
  ]);
}

async function read<T>(key: string): Promise<T | null> {
  if (useMemory) return (memory.get(key) as T) ?? null;
  return (await withTimeout(store().get(key, { type: "json" }), "lecture")) as T | null;
}
async function write(key: string, value: unknown, onlyIfNew = false): Promise<boolean> {
  if (useMemory) {
    if (onlyIfNew && memory.has(key)) return false;
    memory.set(key, value);
    return true;
  }
  const { modified } = await withTimeout(store().setJSON(key, value, onlyIfNew ? { onlyIfNew: true } : {}), "écriture");
  return modified;
}

export async function hasPassword(): Promise<boolean> {
  return (await read<PasswordRecord>("password")) !== null;
}

/** Enregistre le mot de passe une seule fois : refuse s'il en existe déjà un. */
export async function createPassword(password: string): Promise<boolean> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return write("password", { salt: salt.toString("hex"), hash: hash.toString("hex"), createdAt: new Date().toISOString() }, true);
}

export type VerifyResult = { ok: true } | { ok: false; reason: "incorrect" | "bloque" | "absent"; retryInMinutes?: number };

/** Vérifie le mot de passe. Après 5 échecs de suite, la connexion est bloquée 15 minutes. */
export async function verifyPassword(password: string): Promise<VerifyResult> {
  const record = await read<PasswordRecord>("password");
  if (!record) return { ok: false, reason: "absent" };

  const attempts = (await read<AttemptsRecord>("attempts")) ?? { failures: 0, lockedUntil: 0 };
  if (attempts.lockedUntil > Date.now()) {
    return { ok: false, reason: "bloque", retryInMinutes: Math.ceil((attempts.lockedUntil - Date.now()) / 60000) };
  }

  const expected = Buffer.from(record.hash, "hex");
  const actual = await scryptAsync(password, Buffer.from(record.salt, "hex"), expected.length);
  if (timingSafeEqual(expected, actual)) {
    if (attempts.failures > 0) await write("attempts", { failures: 0, lockedUntil: 0 });
    return { ok: true };
  }

  const failures = attempts.failures + 1;
  const locked = failures >= MAX_FAILURES;
  await write("attempts", { failures: locked ? 0 : failures, lockedUntil: locked ? Date.now() + LOCK_MS : 0 });
  return locked ? { ok: false, reason: "bloque", retryInMinutes: LOCK_MS / 60000 } : { ok: false, reason: "incorrect" };
}
