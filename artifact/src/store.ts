/**
 * Listes personnelles enregistrées dans la base intégrée à l'artefact (capacité « db »).
 * Chaque liste vit sous data/users/<identifiant de la personne>/<espace>/<liste>/<id> :
 * ce sous-arbre est privé (personne d'autre ne peut le lire, même si la page est partagée).
 */

interface DbError {
  code?: string;
}
interface DocSnap {
  id: string;
  data(): Record<string, unknown> | undefined;
}
interface DocRef {
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  collection(path: string): ColRef;
}
interface ColRef {
  doc(id?: string): DocRef;
  onSnapshot(next: (snap: { docs: DocSnap[]; metadata: { fromCache: boolean } }) => void, error?: (e: DbError) => void): () => void;
}
interface Db {
  collection(path: string): ColRef;
}

export function explainDbError(e: unknown): string {
  switch ((e as DbError)?.code) {
    case "quota_exceeded":
      return "L'espace de stockage de cette page est plein : supprime d'anciens éléments avant d'en ajouter.";
    case "resource_exhausted":
      return "Trop d'opérations en peu de temps : patiente quelques secondes, puis réessaie.";
    case "revoked":
    case "not_granted":
    case "capability_disabled":
    case "capability_removed":
      return "Le stockage de cette page n'est pas accessible ici.";
    case "invalid_argument":
    case "transform_error":
      return "L'enregistrement a été refusé (élément trop volumineux, ou pas le droit d'écrire sur cette page).";
    default:
      return "Le stockage ne répond pas pour le moment. Réessaie dans un instant.";
  }
}

/** Espace privé de la personne, résolu une seule fois pour toute la page. */
let rootPromise: Promise<ColRef | string> | null = null;
function privateRoot(): Promise<ColRef | string> {
  rootPromise ??= (async () => {
    const claude = window.claude;
    if (!claude) return "Le stockage intégré n'est pas disponible dans cette vue. Ouvre la page depuis claude.ai, connecté à ton compte.";
    const [db, user] = await Promise.all([claude.use("db").catch(() => null) as Promise<Db | null>, claude.use("user").catch(() => null) as Promise<{ id(): Promise<string | null> } | null>]);
    if (!db) return "Le stockage intégré n'est pas disponible dans cette vue. Ouvre la page depuis claude.ai, connecté à ton compte.";
    const uid = user ? await user.id() : null;
    if (!uid) return "Impossible de t'identifier ici : sans identité, il n'y a pas d'espace privé pour enregistrer tes données.";
    try {
      return db.collection(`data/users/${uid}`);
    } catch {
      return "Le stockage intégré n'est pas disponible dans cette vue.";
    }
  })();
  return rootPromise;
}

export interface LiveList<T extends { id: string }> {
  status: "attente" | "pret" | "indisponible";
  reason: string;
  /** Vrai si le stockage n'a pas encore confirmé ce qui est affiché. */
  stale: boolean;
  items: T[];
  /** Démarre l'écoute (sans effet si déjà démarrée). */
  start(): void;
  onChange(listener: () => void): () => void;
  /** Crée ou remplace un élément. */
  save(item: T): Promise<void>;
  remove(id: string): Promise<void>;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Une liste vivante : `space` est le document de l'onglet (ex. « projets »), `name` la liste dessous (ex. « liste »).
 * `read` valide ce qui est stocké ; un élément illisible est ignoré plutôt qu'affiché de travers.
 */
export function liveList<T extends { id: string }>(space: string, name: string, read: (id: string, data: Record<string, unknown>) => T | null): LiveList<T> {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  let col: ColRef | null = null;
  let started = false;
  let queue: Promise<void> = Promise.resolve();

  const write = (apply: () => void, run: (c: ColRef) => Promise<void>): Promise<void> => {
    const result = queue.then(async () => {
      if (!col) throw new Error("Le stockage n'est pas prêt.");
      const previous = list.items;
      apply();
      notify();
      try {
        try {
          await run(col);
        } catch (e) {
          if ((e as DbError)?.code !== "unavailable") throw e;
          await pause(600 + Math.random() * 900);
          await run(col);
        }
      } catch (e) {
        list.items = previous;
        notify();
        throw new Error(explainDbError(e));
      }
    });
    queue = result.catch(() => undefined);
    return result;
  };

  const list: LiveList<T> = {
    status: "attente",
    reason: "",
    stale: false,
    items: [],
    start() {
      if (started) return;
      started = true;
      void (async () => {
        const fail = (reason: string) => {
          list.status = "indisponible";
          list.reason = reason;
          notify();
        };
        const root = await privateRoot();
        if (typeof root === "string") return fail(root);
        try {
          col = root.doc(space).collection(name);
        } catch {
          return fail("Le stockage intégré n'est pas disponible dans cette vue.");
        }
        // Au bout de 10 secondes sans réponse, on le dit plutôt que de laisser un chargement sans fin.
        let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
          list.stale = true;
          notify();
        }, 10_000);
        col.onSnapshot(
          (snap) => {
            if (!snap.metadata.fromCache) {
              if (timer) clearTimeout(timer);
              timer = null;
              list.stale = false;
            }
            list.items = snap.docs.map((d) => read(d.id, d.data() ?? {})).filter((item): item is T => item !== null);
            list.status = "pret";
            notify();
          },
          (e) => {
            if (timer) clearTimeout(timer);
            fail(explainDbError(e));
          },
        );
      })();
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    save(item) {
      const { id, ...data } = item;
      return write(
        () => (list.items = [...list.items.filter((i) => i.id !== id), item]),
        (c) => c.doc(id).set(JSON.parse(JSON.stringify(data)) as Record<string, unknown>),
      );
    },
    remove(id) {
      return write(
        () => (list.items = list.items.filter((i) => i.id !== id)),
        (c) => c.doc(id).delete(),
      );
    },
  };
  return list;
}

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
export const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
export const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
