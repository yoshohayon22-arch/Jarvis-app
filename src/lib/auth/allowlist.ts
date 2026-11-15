/**
 * Liste blanche : un seul compte Google autorisé.
 * L'adresse est lue dans la variable d'environnement ALLOWED_EMAIL (jamais écrite dans le code).
 * Ce contrôle est doublé côté base par un trigger qui refuse la création de tout autre compte
 * (voir supabase/migrations/0001_init.sql).
 */
export function getAllowedEmail(): string {
  return (process.env.ALLOWED_EMAIL ?? "").trim().toLowerCase();
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  const allowed = getAllowedEmail();
  return Boolean(allowed && email && email.trim().toLowerCase() === allowed);
}
