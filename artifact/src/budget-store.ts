/**
 * Stockage du budget dans la base intégrée à l'artefact (capacité « db »).
 * Tout est rangé sous data/users/<identifiant de la personne>/budget : ce sous-arbre est privé,
 * personne d'autre ne peut le lire, même si la page est partagée un jour.
 * - budget (document)            : budgets par catégorie et abonnements ;
 * - budget/mois/<aaaa-mm>        : les dépenses d'un mois (un document par mois).
 */

export interface Line {
  id: string;
  /** aaaa-mm-jj */
  date: string;
  /** Montant en centimes de franc. */
  c: number;
  cat: string;
  note: string;
}
export interface Sub {
  id: string;
  nom: string;
  c: number;
  per: "mois" | "an";
}
export interface Settings {
  budgets: Record<string, number>;
  abonnements: Sub[];
}

export const CATEGORIES: [string, string][] = [
  ["courses", "Courses"],
  ["restaurants", "Restaurants"],
  ["transport", "Transport"],
  ["logement", "Logement"],
  ["sante", "Santé"],
  ["loisirs", "Loisirs"],
  ["abonnements", "Abonnements"],
  ["achats", "Achats"],
  ["etudes", "Études"],
  ["dons", "Dons et tsedaka"],
  ["autre", "Autre"],
];
export const categoryLabel = (id: string) => CATEGORIES.find(([key]) => key === id)?.[1] ?? "Autre";
const isCategory = (id: unknown): id is string => CATEGORIES.some(([key]) => key === id);

// ---------- Types minimaux de la capacité « db » ----------
interface DbError {
  code?: string;
}
interface Meta {
  fromCache: boolean;
}
interface DocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  metadata: Meta;
}
interface DocRef {
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  onSnapshot(next: (snap: DocSnap) => void, error?: (e: DbError) => void): () => void;
  collection(path: string): ColRef;
}
interface ColRef {
  doc(id?: string): DocRef;
  onSnapshot(next: (snap: { docs: DocSnap[]; metadata: Meta }) => void, error?: (e: DbError) => void): () => void;
}
interface Db {
  collection(path: string): ColRef;
}

export type Status = "attente" | "pret" | "indisponible";

export const budget = {
  status: "attente" as Status,
  /** Explication affichée quand le stockage n'est pas utilisable. */
  reason: "",
  /** Vrai si les données affichées n'ont pas encore été confirmées par le stockage. */
  stale: false,
  months: new Map<string, Line[]>(),
  settings: { budgets: {}, abonnements: [] } as Settings,
};

const listeners = new Set<() => void>();
export function onBudgetChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const notify = () => listeners.forEach((listener) => listener());

function explain(e: unknown): string {
  switch ((e as DbError)?.code) {
    case "quota_exceeded":
      return "L'espace de stockage de cette page est plein : supprime d'anciennes dépenses avant d'en ajouter.";
    case "resource_exhausted":
      return "Trop d'opérations en peu de temps : patiente quelques secondes, puis réessaie.";
    case "revoked":
    case "not_granted":
    case "capability_disabled":
    case "capability_removed":
      return "Le stockage de cette page n'est pas accessible ici.";
    case "invalid_argument":
    case "transform_error":
      return "L'enregistrement a été refusé (tu n'as peut-être pas le droit d'écrire sur cette page).";
    default:
      return "Le stockage ne répond pas pour le moment. Réessaie dans un instant.";
  }
}

// ---------- Lecture tolérante de ce qui est stocké ----------
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const cents = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);

function readLines(data: Record<string, unknown> | undefined): Line[] {
  const raw = Array.isArray(data?.lignes) ? (data.lignes as Record<string, unknown>[]) : [];
  return raw
    .filter((l) => l && typeof l.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(String(l.date)) && cents(l.c) > 0)
    .map((l) => ({ id: String(l.id), date: String(l.date), c: cents(l.c), cat: isCategory(l.cat) ? l.cat : "autre", note: text(l.note, 140) }));
}

function readSettings(data: Record<string, unknown> | undefined): Settings {
  const budgets: Record<string, number> = {};
  const rawBudgets = (data?.budgets ?? {}) as Record<string, unknown>;
  for (const [key] of CATEGORIES) if (cents(rawBudgets[key]) > 0) budgets[key] = cents(rawBudgets[key]);
  const rawSubs = Array.isArray(data?.abonnements) ? (data.abonnements as Record<string, unknown>[]) : [];
  const abonnements = rawSubs
    .filter((s) => s && typeof s.id === "string" && text(s.nom, 60) && cents(s.c) > 0)
    .map((s) => ({ id: String(s.id), nom: text(s.nom, 60), c: cents(s.c), per: s.per === "an" ? ("an" as const) : ("mois" as const) }));
  return { budgets, abonnements };
}

// ---------- Connexion (une seule fois pour toute la page) ----------
let base: DocRef | null = null;
let started = false;

export function connectBudget(): void {
  if (started) return;
  started = true;
  void (async () => {
    const claude = window.claude;
    const [db, user] = claude ? await Promise.all([claude.use("db").catch(() => null) as Promise<Db | null>, claude.use("user").catch(() => null) as Promise<{ id(): Promise<string | null> } | null>]) : [null, null];
    const fail = (reason: string) => {
      budget.status = "indisponible";
      budget.reason = reason;
      notify();
    };
    if (!db) return fail("Le stockage intégré n'est pas disponible dans cette vue. Ouvre la page depuis claude.ai, connecté à ton compte.");
    const uid = user ? await user.id() : null;
    if (!uid) return fail("Impossible de t'identifier ici : sans identité, il n'y a pas d'espace privé pour enregistrer ton budget.");

    try {
      base = db.collection(`data/users/${uid}`).doc("budget");
    } catch {
      return fail("Le stockage intégré n'est pas disponible dans cette vue.");
    }
    const seen = { settings: false, months: false };
    // Si le stockage ne répond pas en 10 secondes, on le dit plutôt que de laisser un chargement sans fin.
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      budget.stale = true;
      notify();
    }, 10_000);
    const mark = (meta: Meta) => {
      if (!meta.fromCache) {
        if (timer) clearTimeout(timer);
        timer = null;
        budget.stale = false;
      }
      if (seen.settings && seen.months) budget.status = "pret";
      notify();
    };
    const onError = (e: DbError) => {
      if (timer) clearTimeout(timer);
      fail(explain(e));
    };
    base.onSnapshot((snap) => {
      budget.settings = readSettings(snap.exists ? snap.data() : undefined);
      seen.settings = true;
      mark(snap.metadata);
    }, onError);
    base.collection("mois").onSnapshot((snap) => {
      budget.months = new Map(snap.docs.filter((d) => /^\d{4}-\d{2}$/.test(d.id)).map((d) => [d.id, readLines(d.data())]));
      seen.months = true;
      mark(snap.metadata);
    }, onError);
  })();
}

// ---------- Écritures : une à la fois, sur action de l'utilisateur uniquement ----------
let queue: Promise<void> = Promise.resolve();
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function attempt(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (e) {
    if ((e as DbError)?.code !== "unavailable") throw e;
    await pause(600 + Math.random() * 900);
    await run();
  }
}

function write(apply: () => (() => void) | void, run: () => Promise<void>): Promise<void> {
  const result = queue.then(async () => {
    if (!base) throw new Error("Le stockage n'est pas prêt.");
    // L'affichage est mis à jour tout de suite ; en cas d'échec on revient à l'état précédent.
    const undo = apply();
    notify();
    try {
      await attempt(run);
    } catch (e) {
      undo?.();
      notify();
      throw new Error(explain(e));
    }
  });
  queue = result.catch(() => undefined);
  return result;
}

/** Remplace les dépenses de plusieurs mois (clé « aaaa-mm »). Un mois vidé est supprimé. */
export function saveMonths(change: (months: ReadonlyMap<string, Line[]>) => Map<string, Line[]>): Promise<void> {
  let changed = new Map<string, Line[]>();
  return write(
    () => {
      const previous = new Map(budget.months);
      changed = change(previous);
      for (const [key, lines] of changed) {
        if (lines.length) budget.months.set(key, lines);
        else budget.months.delete(key);
      }
      return () => {
        budget.months = previous;
      };
    },
    async () => {
      for (const [key, lines] of changed) {
        const ref = base!.collection("mois").doc(key);
        await (lines.length ? ref.set({ lignes: lines.map((l) => ({ ...l })) }) : ref.delete());
      }
    },
  );
}

export function saveSettings(change: (settings: Settings) => Settings): Promise<void> {
  return write(
    () => {
      const previous = budget.settings;
      budget.settings = change(previous);
      return () => {
        budget.settings = previous;
      };
    },
    () => base!.set({ budgets: { ...budget.settings.budgets }, abonnements: budget.settings.abonnements.map((s) => ({ ...s })) }),
  );
}

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
