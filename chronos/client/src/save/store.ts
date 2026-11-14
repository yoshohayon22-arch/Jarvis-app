import type { SaveGame } from "./saveGame";

export interface SaveSlotInfo {
  slot: string;
  savedAt: number;
  label: string;
}

/** Where saves live. IndexedDB in the browser; an in-memory map in tests. */
export interface SaveBackend {
  put(slot: string, save: SaveGame): Promise<void>;
  get(slot: string): Promise<unknown>;
  delete(slot: string): Promise<void>;
  keys(): Promise<string[]>;
}

export class MemoryBackend implements SaveBackend {
  readonly data = new Map<string, unknown>();
  async put(slot: string, save: SaveGame): Promise<void> {
    this.data.set(slot, structuredClone(save));
  }
  async get(slot: string): Promise<unknown> {
    return structuredClone(this.data.get(slot) ?? null);
  }
  async delete(slot: string): Promise<void> {
    this.data.delete(slot);
  }
  async keys(): Promise<string[]> {
    return [...this.data.keys()];
  }
}

const DB_NAME = "chronos";
const STORE = "saves";

export class IndexedDbBackend implements SaveBackend {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
    });
    return this.db;
  }

  private async run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    });
  }

  async put(slot: string, save: SaveGame): Promise<void> {
    await this.run("readwrite", (s) => s.put(save, slot));
  }
  get(slot: string): Promise<unknown> {
    return this.run("readonly", (s) => s.get(slot));
  }
  async delete(slot: string): Promise<void> {
    await this.run("readwrite", (s) => s.delete(slot));
  }
  async keys(): Promise<string[]> {
    return (await this.run("readonly", (s) => s.getAllKeys())).map(String);
  }
}

export const MANUAL_SLOT = "manual";
export const AUTO_SLOTS = ["auto-0", "auto-1", "auto-2"] as const;

/**
 * Save slots: one manual slot and three rotating autosaves (the oldest is
 * overwritten), so a bad autosave never destroys the only copy.
 */
export class SaveStore {
  constructor(private readonly backend: SaveBackend) {}

  async list(): Promise<SaveSlotInfo[]> {
    const out: SaveSlotInfo[] = [];
    for (const slot of await this.backend.keys()) {
      const s = (await this.backend.get(slot)) as Partial<SaveGame> | null;
      if (s && typeof s.savedAt === "number" && typeof s.label === "string") out.push({ slot, savedAt: s.savedAt, label: s.label });
    }
    return out.sort((a, b) => b.savedAt - a.savedAt);
  }

  /** Most recent save of any kind, or null. */
  async latest(): Promise<SaveSlotInfo | null> {
    return (await this.list())[0] ?? null;
  }

  saveManual(save: SaveGame): Promise<void> {
    return this.backend.put(MANUAL_SLOT, save);
  }

  /** Writes to the empty or oldest autosave slot; returns the slot used. */
  async saveAuto(save: SaveGame): Promise<string> {
    const taken = new Map((await this.list()).map((s) => [s.slot, s.savedAt]));
    let slot: string = AUTO_SLOTS[0];
    let oldest = Infinity;
    for (const a of AUTO_SLOTS) {
      const t = taken.get(a) ?? -Infinity;
      if (t < oldest) {
        oldest = t;
        slot = a;
      }
    }
    await this.backend.put(slot, save);
    return slot;
  }

  load(slot: string): Promise<unknown> {
    return this.backend.get(slot);
  }

  delete(slot: string): Promise<void> {
    return this.backend.delete(slot);
  }
}
