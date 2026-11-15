/**
 * Session par cookie signé (mode « mot de passe »).
 * Le cookie contient seulement une date d'expiration et une signature HMAC-SHA256
 * calculée avec SESSION_SECRET (variable d'environnement serveur). Il est httpOnly :
 * le JavaScript de la page ne peut pas le lire.
 * N'utilise que Web Crypto, pour fonctionner aussi dans le proxy (environnement « edge »).
 */
export const SESSION_COOKIE = "dash_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 jours
export const MIN_PASSWORD_LENGTH = 10;

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

/** Comparaison en temps constant (évite de révéler la signature caractère par caractère). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function getSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET ?? "";
  return secret.length >= 32 ? secret : null;
}

export async function createSessionValue(secret: string): Promise<string> {
  const payload = `v1.${Math.floor(Date.now() / 1000) + SESSION_MAX_AGE}`;
  return `${payload}.${await sign(payload, secret)}`;
}

export async function isSessionValid(value: string | undefined, secret: string | null): Promise<boolean> {
  if (!value || !secret) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || expires < Date.now() / 1000) return false;
  return safeEqual(parts[2], await sign(`${parts[0]}.${parts[1]}`, secret));
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
