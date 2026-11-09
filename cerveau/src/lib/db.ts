import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { importSeedIfNeeded } from "./seed-import";

export const DATA_DIR = path.resolve(process.env.CERVEAU_DATA_DIR ?? path.join(process.cwd(), "data"));
export const FILES_DIR = path.join(DATA_DIR, "files");
export const INBOX_DIR = path.resolve(process.env.CERVEAU_INBOX_DIR ?? path.join(process.cwd(), "inbox"));
export const SEED_FILE = path.resolve(process.env.CERVEAU_SEED_FILE ?? path.join(process.cwd(), "seed", "cerveau-seed.json"));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('personne','projet','idee','tache','argent','lieu','organisation','note','document')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  url TEXT,
  amount REAL,
  currency TEXT,
  direction TEXT CHECK (direction IN ('depense','rentree')),
  category TEXT,
  occurred_at TEXT,
  file_id TEXT REFERENCES files(id) ON DELETE SET NULL,
  origin TEXT NOT NULL DEFAULT 'saisie',
  user_edited INTEGER NOT NULL DEFAULT 0,
  touch_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_activity ON nodes(last_activity_at);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'lié à',
  weight REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  UNIQUE (source_id, target_id, label)
);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'en_attente',
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  raw_text TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'saisie',
  file_id TEXT REFERENCES files(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS node_sources (
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  PRIMARY KEY (node_id, source_id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
  node_id UNINDEXED, title, summary, tags,
  tokenize = "unicode61 remove_diacritics 2"
);

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

declare global {
  var __cerveauDb: Database.Database | undefined;
}

export function db(): Database.Database {
  if (globalThis.__cerveauDb) return globalThis.__cerveauDb;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(FILES_DIR, { recursive: true });
  const d = new Database(path.join(DATA_DIR, "cerveau.db"));
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  d.exec(SCHEMA);
  globalThis.__cerveauDb = d;
  try {
    importSeedIfNeeded(d);
  } catch (e) {
    console.error("[cerveau] import du seed impossible :", e);
  }
  return d;
}

export const nowIso = () => new Date().toISOString();

export function kvGet(key: string): string | null {
  const row = db().prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}
export function kvSet(key: string, value: string) {
  db().prepare("INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
