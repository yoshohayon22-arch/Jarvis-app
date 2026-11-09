// Accès aux données : neurones, liens, sources, fichiers.
import { db, nowIso } from "./db";
import { ftsQuery, keywords, normalize, slugify, currentMonth } from "./text";
import type {
  BrainEdge,
  BrainFile,
  BrainNode,
  BrainSource,
  Direction,
  GraphPayload,
  MoneySummary,
  NodeDetail,
  NodeType,
} from "./types";
import { NODE_TYPES } from "./types";

type Row = Record<string, unknown>;

export function rowToNode(r: Row): BrainNode {
  let tags: string[] = [];
  try {
    tags = JSON.parse(String(r.tags ?? "[]"));
  } catch {
    tags = [];
  }
  return { ...(r as unknown as BrainNode), tags };
}

function reindex(id: string) {
  const d = db();
  d.prepare("DELETE FROM nodes_fts WHERE node_id = ?").run(id);
  const n = d.prepare("SELECT id, title, summary, tags FROM nodes WHERE id = ?").get(id) as Row | undefined;
  if (!n) return;
  const tags = (() => {
    try {
      return (JSON.parse(String(n.tags)) as string[]).join(" ");
    } catch {
      return "";
    }
  })();
  d.prepare("INSERT INTO nodes_fts(node_id, title, summary, tags) VALUES (?, ?, ?, ?)").run(id, n.title, n.summary, tags);
}

function uniqueId(base: string): string {
  const d = db();
  const slug = slugify(base);
  let id = slug;
  let i = 2;
  while (d.prepare("SELECT 1 FROM nodes WHERE id = ?").get(id)) id = `${slug}-${i++}`;
  return id;
}

export interface NodeInput {
  id?: string;
  type: NodeType;
  title: string;
  summary?: string;
  tags?: string[];
  url?: string | null;
  amount?: number | null;
  currency?: string | null;
  direction?: Direction | null;
  category?: string | null;
  occurred_at?: string | null;
  file_id?: string | null;
  origin?: string;
  created_at?: string;
  last_activity_at?: string;
  touch_count?: number;
}

export function insertNode(input: NodeInput): string {
  const id = input.id ?? uniqueId(input.title);
  const now = nowIso();
  db()
    .prepare(
      `INSERT INTO nodes (id, type, title, summary, tags, url, amount, currency, direction, category, occurred_at, file_id, origin, touch_count, created_at, last_activity_at)
       VALUES (@id, @type, @title, @summary, @tags, @url, @amount, @currency, @direction, @category, @occurred_at, @file_id, @origin, @touch_count, @created_at, @last_activity_at)`,
    )
    .run({
      id,
      type: input.type,
      title: input.title.trim().slice(0, 200),
      summary: (input.summary ?? "").trim(),
      tags: JSON.stringify(cleanTags(input.tags ?? [])),
      url: input.url ?? null,
      amount: input.amount ?? null,
      currency: input.currency ?? null,
      direction: input.direction ?? null,
      category: input.category ?? null,
      occurred_at: input.occurred_at ?? null,
      file_id: input.file_id ?? null,
      origin: input.origin ?? "saisie",
      touch_count: input.touch_count ?? 1,
      created_at: input.created_at ?? now,
      last_activity_at: input.last_activity_at ?? input.created_at ?? now,
    });
  reindex(id);
  return id;
}

function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const v = t.trim().replace(/^#/, "").toLowerCase();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out.slice(0, 12);
}

export function getNode(id: string): BrainNode | null {
  const r = db().prepare("SELECT * FROM nodes WHERE id = ?").get(id) as Row | undefined;
  return r ? rowToNode(r) : null;
}

export type NodePatch = Partial<Omit<NodeInput, "id" | "origin" | "created_at">>;

export function updateNode(id: string, patch: NodePatch, opts: { userEdit?: boolean; touch?: boolean } = {}) {
  const current = getNode(id);
  if (!current) throw new Error("Neurone introuvable");
  const next = {
    type: patch.type ?? current.type,
    title: (patch.title ?? current.title).trim().slice(0, 200),
    summary: (patch.summary ?? current.summary).trim(),
    tags: JSON.stringify(cleanTags(patch.tags ?? current.tags)),
    url: patch.url !== undefined ? patch.url : current.url,
    amount: patch.amount !== undefined ? patch.amount : current.amount,
    currency: patch.currency !== undefined ? patch.currency : current.currency,
    direction: patch.direction !== undefined ? patch.direction : current.direction,
    category: patch.category !== undefined ? patch.category : current.category,
    occurred_at: patch.occurred_at !== undefined ? patch.occurred_at : current.occurred_at,
    file_id: patch.file_id !== undefined ? patch.file_id : current.file_id,
  };
  if (!NODE_TYPES.includes(next.type)) throw new Error("Type invalide");
  db()
    .prepare(
      `UPDATE nodes SET type=@type, title=@title, summary=@summary, tags=@tags, url=@url, amount=@amount, currency=@currency,
       direction=@direction, category=@category, occurred_at=@occurred_at, file_id=@file_id,
       user_edited = CASE WHEN @userEdit THEN 1 ELSE user_edited END,
       touch_count = touch_count + CASE WHEN @touch THEN 1 ELSE 0 END,
       last_activity_at = CASE WHEN @touch THEN @now ELSE last_activity_at END
       WHERE id=@id`,
    )
    .run({ ...next, id, userEdit: opts.userEdit ? 1 : 0, touch: opts.touch === false ? 0 : 1, now: nowIso() });
  reindex(id);
}

export function touchNodes(ids: string[]) {
  const stmt = db().prepare("UPDATE nodes SET touch_count = touch_count + 1, last_activity_at = ? WHERE id = ?");
  const now = nowIso();
  const tx = db().transaction((list: string[]) => list.forEach((id) => stmt.run(now, id)));
  tx([...new Set(ids)]);
}

export function deleteNode(id: string) {
  const d = db();
  d.transaction(() => {
    d.prepare("DELETE FROM nodes_fts WHERE node_id = ?").run(id);
    d.prepare("DELETE FROM nodes WHERE id = ?").run(id);
  })();
}

export function upsertEdge(sourceId: string, targetId: string, label = "lié à", at?: string): string | null {
  if (!sourceId || !targetId || sourceId === targetId) return null;
  const d = db();
  const lab = label.trim().slice(0, 60) || "lié à";
  const existing = d
    .prepare(
      "SELECT id FROM edges WHERE (source_id=? AND target_id=?) OR (source_id=? AND target_id=?) ORDER BY (label = ?) DESC LIMIT 1",
    )
    .get(sourceId, targetId, targetId, sourceId, lab) as { id: string } | undefined;
  const now = at ?? nowIso();
  if (existing) {
    d.prepare("UPDATE edges SET weight = weight + 1, last_activity_at = ? WHERE id = ?").run(now, existing.id);
    return existing.id;
  }
  const exists = (id: string) => d.prepare("SELECT 1 FROM nodes WHERE id = ?").get(id);
  if (!exists(sourceId) || !exists(targetId)) return null;
  const id = `e_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  d.prepare(
    "INSERT INTO edges (id, source_id, target_id, label, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, sourceId, targetId, lab, now, now);
  return id;
}

export function deleteEdge(id: string) {
  db().prepare("DELETE FROM edges WHERE id = ?").run(id);
}

export function createSource(raw: string, kind: string, fileId: string | null = null, at?: string): string {
  const id = `s_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  db()
    .prepare("INSERT INTO sources (id, raw_text, kind, file_id, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, raw, kind, fileId, at ?? nowIso());
  return id;
}

export function linkSource(nodeId: string, sourceId: string) {
  db().prepare("INSERT OR IGNORE INTO node_sources (node_id, source_id) VALUES (?, ?)").run(nodeId, sourceId);
}

/** Fusionne `fromId` dans `intoId` : liens, sources, tags et résumé sont rapatriés. */
export function mergeNodes(fromId: string, intoId: string) {
  if (fromId === intoId) throw new Error("Impossible de fusionner un neurone avec lui-même");
  const from = getNode(fromId);
  const into = getNode(intoId);
  if (!from || !into) throw new Error("Neurone introuvable");
  const d = db();
  d.transaction(() => {
    const edges = d.prepare("SELECT * FROM edges WHERE source_id = ? OR target_id = ?").all(fromId, fromId) as BrainEdge[];
    for (const e of edges) {
      const s = e.source_id === fromId ? intoId : e.source_id;
      const t = e.target_id === fromId ? intoId : e.target_id;
      upsertEdge(s, t, e.label, e.created_at);
    }
    d.prepare("INSERT OR IGNORE INTO node_sources (node_id, source_id) SELECT ?, source_id FROM node_sources WHERE node_id = ?").run(
      intoId,
      fromId,
    );
    const summary =
      from.summary && !into.summary.includes(from.summary) ? [into.summary, from.summary].filter(Boolean).join("\n") : into.summary;
    updateNode(
      intoId,
      {
        summary,
        tags: [...into.tags, ...from.tags],
        url: into.url ?? from.url,
        file_id: into.file_id ?? from.file_id,
      },
      { userEdit: true },
    );
    d.prepare("UPDATE nodes SET touch_count = touch_count + ? WHERE id = ?").run(from.touch_count, intoId);
    deleteNode(fromId);
  })();
}

// ---------- Lecture ----------

export function computeGlow(lastActivity: string, touchCount: number, now = Date.now()): number {
  const days = Math.max(0, (now - Date.parse(lastActivity)) / 86_400_000);
  const recency = Math.exp(-days / 14);
  const freq = Math.min(1, Math.log(1 + touchCount) / Math.log(11));
  return Math.max(0.15, Math.min(1, 0.15 + 0.85 * recency * (0.6 + 0.4 * freq)));
}

export function getGraph(): GraphPayload {
  const d = db();
  const nodes = d.prepare("SELECT id, type, title, tags, url, touch_count, created_at, last_activity_at FROM nodes").all() as Row[];
  const links = d.prepare("SELECT id, source_id, target_id, label, created_at FROM edges").all() as Row[];
  const degree = new Map<string, number>();
  for (const l of links) {
    degree.set(String(l.source_id), (degree.get(String(l.source_id)) ?? 0) + 1);
    degree.set(String(l.target_id), (degree.get(String(l.target_id)) ?? 0) + 1);
  }
  const now = Date.now();
  return {
    nodes: nodes.map((n) => ({
      id: String(n.id),
      type: n.type as NodeType,
      title: String(n.title),
      tags: rowToNode(n).tags,
      url: (n.url as string) ?? null,
      degree: degree.get(String(n.id)) ?? 0,
      glow: computeGlow(String(n.last_activity_at), Number(n.touch_count), now),
      created_at: String(n.created_at),
      last_activity_at: String(n.last_activity_at),
    })),
    links: links.map((l) => ({
      id: String(l.id),
      source: String(l.source_id),
      target: String(l.target_id),
      label: String(l.label),
      created_at: String(l.created_at),
    })),
  };
}

export function getNodeDetail(id: string): NodeDetail | null {
  const node = getNode(id);
  if (!node) return null;
  const d = db();
  const sources = d
    .prepare(
      "SELECT s.* FROM sources s JOIN node_sources ns ON ns.source_id = s.id WHERE ns.node_id = ? ORDER BY s.created_at DESC",
    )
    .all(id) as BrainSource[];
  const file = node.file_id ? (d.prepare("SELECT * FROM files WHERE id = ?").get(node.file_id) as BrainFile | undefined) ?? null : null;
  const edges = d.prepare("SELECT * FROM edges WHERE source_id = ? OR target_id = ? ORDER BY last_activity_at DESC").all(id, id) as BrainEdge[];
  const connections = edges
    .map((edge) => {
      const otherId = edge.source_id === id ? edge.target_id : edge.source_id;
      const other = d.prepare("SELECT id, title, type FROM nodes WHERE id = ?").get(otherId) as
        | Pick<BrainNode, "id" | "title" | "type">
        | undefined;
      return other ? { edge, other, direction: (edge.source_id === id ? "out" : "in") as "out" | "in" } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
  return { node, sources, file, connections };
}

/** Recherche plein texte (titres, résumés, tags) + repli LIKE. */
export function searchNodes(query: string, limit = 20): BrainNode[] {
  const d = db();
  const words = keywords(query, 10);
  const q = ftsQuery(words);
  let ids: string[] = [];
  if (q) {
    try {
      ids = (
        d.prepare("SELECT node_id FROM nodes_fts WHERE nodes_fts MATCH ? ORDER BY bm25(nodes_fts, 0, 5.0, 1.0, 2.0) LIMIT ?").all(q, limit) as {
          node_id: string;
        }[]
      ).map((r) => r.node_id);
    } catch {
      ids = [];
    }
  }
  if (!ids.length && query.trim()) {
    ids = (
      d.prepare("SELECT id FROM nodes WHERE title LIKE ? OR summary LIKE ? LIMIT ?").all(`%${query.trim()}%`, `%${query.trim()}%`, limit) as {
        id: string;
      }[]
    ).map((r) => r.id);
  }
  return ids.map((id) => getNode(id)).filter((n): n is BrainNode => !!n);
}

export function neighborIds(ids: string[]): string[] {
  if (!ids.length) return [];
  const d = db();
  const out = new Set<string>();
  const stmt = d.prepare("SELECT source_id, target_id FROM edges WHERE source_id = ? OR target_id = ?");
  for (const id of ids) {
    for (const e of stmt.all(id, id) as { source_id: string; target_id: string }[]) {
      out.add(e.source_id === id ? e.target_id : e.source_id);
    }
  }
  ids.forEach((id) => out.delete(id));
  return [...out];
}

export function degreeOf(id: string): number {
  const r = db().prepare("SELECT COUNT(*) AS c FROM edges WHERE source_id = ? OR target_id = ?").get(id, id) as { c: number };
  return r.c;
}

/**
 * Neurones existants à montrer à l'IA pour qu'elle réutilise au lieu de dupliquer :
 * correspondances plein texte + mots du titre présents dans la phrase + plus actifs récemment.
 */
export function candidateNodes(text: string, limit = 150): BrainNode[] {
  const d = db();
  const picked = new Map<string, BrainNode>();
  for (const n of searchNodes(text, 60)) picked.set(n.id, n);
  // Titres (ou prénoms) contenus tels quels dans la phrase
  const norm = ` ${normalize(text)} `;
  const all = d.prepare("SELECT * FROM nodes WHERE type != 'document'").all() as Row[];
  for (const r of all) {
    const n = rowToNode(r);
    const t = normalize(n.title.replace(/\(.*?\)/g, ""));
    const first = t.split(" ")[0];
    if ((t.length > 2 && norm.includes(` ${t} `)) || (first.length > 3 && norm.includes(` ${first} `))) picked.set(n.id, n);
  }
  const recent = d.prepare("SELECT * FROM nodes WHERE type != 'document' ORDER BY last_activity_at DESC LIMIT ?").all(limit) as Row[];
  for (const r of recent) {
    if (picked.size >= limit) break;
    if (!picked.has(String(r.id))) picked.set(String(r.id), rowToNode(r));
  }
  return [...picked.values()].slice(0, limit);
}

// ---------- Fichiers ----------

export function findFileBySha(sha: string): BrainFile | null {
  return (db().prepare("SELECT * FROM files WHERE sha256 = ?").get(sha) as BrainFile | undefined) ?? null;
}
export function getFile(id: string): BrainFile | null {
  return (db().prepare("SELECT * FROM files WHERE id = ?").get(id) as BrainFile | undefined) ?? null;
}
export function insertFile(f: Omit<BrainFile, "created_at" | "status" | "error">): void {
  db()
    .prepare(
      "INSERT INTO files (id, original_name, stored_name, mime, size, sha256, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'en_attente', ?)",
    )
    .run(f.id, f.original_name, f.stored_name, f.mime, f.size, f.sha256, nowIso());
}
export function setFileStatus(id: string, status: BrainFile["status"], error: string | null = null) {
  db().prepare("UPDATE files SET status = ?, error = ? WHERE id = ?").run(status, error, id);
}
export function listFiles(limit = 30): BrainFile[] {
  return db().prepare("SELECT * FROM files ORDER BY created_at DESC LIMIT ?").all(limit) as BrainFile[];
}

// ---------- Argent ----------

export function moneyNodes(month?: string): BrainNode[] {
  const rows = db()
    .prepare("SELECT * FROM nodes WHERE type = 'argent' AND amount IS NOT NULL")
    .all() as Row[];
  const nodes = rows.map(rowToNode);
  if (!month) return nodes;
  return nodes.filter((n) => (n.occurred_at ?? n.created_at).slice(0, 7) === month);
}

export function moneySummary(month = currentMonth()): MoneySummary {
  const items = moneyNodes(month).map((n) => ({
    id: n.id,
    title: n.title,
    amount: Math.abs(n.amount ?? 0),
    currency: (n.currency ?? "CHF").toUpperCase(),
    direction: (n.direction ?? "depense") as Direction,
    category: n.category?.trim() || "Autre",
    date: (n.occurred_at ?? n.created_at).slice(0, 10),
  }));
  const byCur = new Map<string, MoneySummary["currencies"][number]>();
  for (const it of items) {
    let c = byCur.get(it.currency);
    if (!c) {
      c = { currency: it.currency, depenses: 0, rentrees: 0, solde: 0, categories: [] };
      byCur.set(it.currency, c);
    }
    let cat = c.categories.find((x) => x.category.toLowerCase() === it.category.toLowerCase());
    if (!cat) {
      cat = { category: it.category, depenses: 0, rentrees: 0 };
      c.categories.push(cat);
    }
    if (it.direction === "rentree") {
      c.rentrees += it.amount;
      cat.rentrees += it.amount;
    } else {
      c.depenses += it.amount;
      cat.depenses += it.amount;
    }
  }
  const currencies = [...byCur.values()].map((c) => ({
    ...c,
    depenses: round(c.depenses),
    rentrees: round(c.rentrees),
    solde: round(c.rentrees - c.depenses),
    categories: c.categories
      .map((x) => ({ ...x, depenses: round(x.depenses), rentrees: round(x.rentrees) }))
      .sort((a, b) => b.depenses + b.rentrees - (a.depenses + a.rentrees)),
  }));
  items.sort((a, b) => b.date.localeCompare(a.date));
  return { month, currencies, items };
}
const round = (n: number) => Math.round(n * 100) / 100;

// ---------- Sauvegarde ----------

export interface BrainExport {
  format: "le-cerveau";
  version: 1;
  exported_at: string;
  nodes: BrainNode[];
  edges: BrainEdge[];
  sources: BrainSource[];
  node_sources: { node_id: string; source_id: string }[];
  files: BrainFile[];
}

export function exportAll(): BrainExport {
  const d = db();
  return {
    format: "le-cerveau",
    version: 1,
    exported_at: nowIso(),
    nodes: (d.prepare("SELECT * FROM nodes").all() as Row[]).map(rowToNode),
    edges: d.prepare("SELECT * FROM edges").all() as BrainEdge[],
    sources: d.prepare("SELECT * FROM sources").all() as BrainSource[],
    node_sources: d.prepare("SELECT * FROM node_sources").all() as { node_id: string; source_id: string }[],
    files: d.prepare("SELECT * FROM files").all() as BrainFile[],
  };
}

/** Import d'une sauvegarde : fusion par identifiant (les neurones existants sont mis à jour, rien n'est dupliqué). */
export function importAll(data: BrainExport, mode: "fusion" | "remplacer" = "fusion") {
  if (data?.format !== "le-cerveau") throw new Error("Ce fichier n'est pas une sauvegarde du Cerveau");
  const d = db();
  const stats = { nodes: 0, edges: 0, sources: 0 };
  d.transaction(() => {
    if (mode === "remplacer") {
      d.exec("DELETE FROM node_sources; DELETE FROM edges; DELETE FROM nodes_fts; DELETE FROM nodes; DELETE FROM sources;");
    }
    for (const f of data.files ?? []) {
      d.prepare(
        `INSERT OR IGNORE INTO files (id, original_name, stored_name, mime, size, sha256, status, error, created_at)
         VALUES (@id, @original_name, @stored_name, @mime, @size, @sha256, @status, @error, @created_at)`,
      ).run(f);
    }
    for (const n of data.nodes ?? []) {
      if (!NODE_TYPES.includes(n.type)) continue;
      const row = {
        ...n,
        tags: JSON.stringify(n.tags ?? []),
        url: n.url ?? null,
        amount: n.amount ?? null,
        currency: n.currency ?? null,
        direction: n.direction ?? null,
        category: n.category ?? null,
        occurred_at: n.occurred_at ?? null,
        file_id: n.file_id && getFile(n.file_id) ? n.file_id : null,
        origin: n.origin ?? "import",
        user_edited: n.user_edited ?? 0,
        touch_count: n.touch_count ?? 1,
      };
      d.prepare(
        `INSERT INTO nodes (id, type, title, summary, tags, url, amount, currency, direction, category, occurred_at, file_id, origin, user_edited, touch_count, created_at, last_activity_at)
         VALUES (@id, @type, @title, @summary, @tags, @url, @amount, @currency, @direction, @category, @occurred_at, @file_id, @origin, @user_edited, @touch_count, @created_at, @last_activity_at)
         ON CONFLICT(id) DO UPDATE SET type=excluded.type, title=excluded.title, summary=excluded.summary, tags=excluded.tags, url=excluded.url,
           amount=excluded.amount, currency=excluded.currency, direction=excluded.direction, category=excluded.category, occurred_at=excluded.occurred_at,
           file_id=excluded.file_id, user_edited=excluded.user_edited,
           touch_count=MAX(nodes.touch_count, excluded.touch_count), last_activity_at=MAX(nodes.last_activity_at, excluded.last_activity_at)`,
      ).run(row);
      reindex(n.id);
      stats.nodes++;
    }
    for (const s of data.sources ?? []) {
      d.prepare("INSERT OR IGNORE INTO sources (id, raw_text, kind, file_id, created_at) VALUES (@id, @raw_text, @kind, @file_id, @created_at)").run({
        ...s,
        file_id: s.file_id && getFile(s.file_id) ? s.file_id : null,
      });
      stats.sources++;
    }
    for (const e of data.edges ?? []) {
      const r = d
        .prepare(
          `INSERT OR IGNORE INTO edges (id, source_id, target_id, label, weight, created_at, last_activity_at)
           SELECT @id, @source_id, @target_id, @label, @weight, @created_at, @last_activity_at
           WHERE EXISTS (SELECT 1 FROM nodes WHERE id=@source_id) AND EXISTS (SELECT 1 FROM nodes WHERE id=@target_id)`,
        )
        .run({ weight: 1, ...e });
      stats.edges += r.changes;
    }
    for (const ns of data.node_sources ?? []) {
      d.prepare(
        `INSERT OR IGNORE INTO node_sources (node_id, source_id) SELECT @node_id, @source_id
         WHERE EXISTS (SELECT 1 FROM nodes WHERE id=@node_id) AND EXISTS (SELECT 1 FROM sources WHERE id=@source_id)`,
      ).run(ns);
    }
  })();
  return stats;
}
