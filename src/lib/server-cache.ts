import "server-only";

/**
 * Petit cache mémoire côté serveur pour les sources externes (flux RSS, alertes météo).
 * - Une réponse réussie est réutilisée pendant `ttlMs` : on ménage les serveurs des sources.
 * - Un échec n'est jamais mis en cache, et son message d'erreur reste lisible
 *   (contrairement à « use cache », qui masque les messages d'erreur en production).
 * - Les appels simultanés pour la même clé partagent la même requête.
 * Sur un hébergement « serverless », ce cache vit le temps d'une instance : c'est suffisant ici.
 */
const store = new Map<string, { at: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  const running = pending.get(key);
  if (running) return running as Promise<T>;

  const promise = load()
    .then((value) => {
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
