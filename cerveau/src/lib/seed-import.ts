// Import automatique de seed/cerveau-seed.json au démarrage — idempotent.
// - un neurone absent est créé ;
// - un neurone déjà importé du seed et jamais modifié à la main est complété / mis à jour ;
// - un neurone modifié à la main n'est jamais écrasé ;
// - les liens sont ajoutés sans doublon.
import type Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import { SEED_FILE, kvGet, kvSet, nowIso } from "./db";
import { insertNode, getNode, updateNode } from "./repo";
import { NODE_TYPES, type NodeType } from "./types";

interface SeedNode {
  id: string;
  type: string;
  title: string;
  summary?: string;
  tags?: string[];
  url?: string | null;
  amount?: number | null;
  currency?: string | null;
  direction?: "depense" | "rentree" | null;
  category?: string | null;
  date?: string | null;
}
type SeedEdge = [string, string, string?] | { source: string; target: string; label?: string };

export function importSeedIfNeeded(d: Database.Database, opts: { force?: boolean } = {}) {
  if (!fs.existsSync(SEED_FILE)) return null;
  const raw = fs.readFileSync(SEED_FILE, "utf8");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  if (!opts.force && kvGet("seed_hash") === hash) return null;

  const data = JSON.parse(raw) as { nodes?: SeedNode[]; edges?: SeedEdge[] };
  const stats = { created: 0, updated: 0, edges: 0 };
  const now = nowIso();

  d.transaction(() => {
    for (const n of data.nodes ?? []) {
      if (!n?.id || !n.title || !NODE_TYPES.includes(n.type as NodeType)) continue;
      const fields = {
        type: n.type as NodeType,
        title: n.title,
        summary: n.summary ?? "",
        tags: n.tags ?? [],
        url: n.url ?? null,
        amount: n.amount ?? null,
        currency: n.currency ?? null,
        direction: n.direction ?? null,
        category: n.category ?? null,
        occurred_at: n.date ?? null,
      };
      const existing = getNode(n.id);
      if (!existing) {
        insertNode({ id: n.id, ...fields, origin: "seed", created_at: now });
        stats.created++;
      } else if (existing.origin === "seed" && !existing.user_edited) {
        // Ne remplace un champ que si le seed apporte une valeur.
        updateNode(
          n.id,
          {
            type: fields.type,
            title: fields.title,
            summary: fields.summary || existing.summary,
            tags: fields.tags.length ? fields.tags : existing.tags,
            url: fields.url ?? existing.url,
            amount: fields.amount ?? existing.amount,
            currency: fields.currency ?? existing.currency,
            direction: fields.direction ?? existing.direction,
            category: fields.category ?? existing.category,
            occurred_at: fields.occurred_at ?? existing.occurred_at,
          },
          { touch: false },
        );
        stats.updated++;
      }
    }
    const exists = d.prepare("SELECT 1 FROM nodes WHERE id = ?");
    const dup = d.prepare(
      "SELECT 1 FROM edges WHERE (source_id=? AND target_id=? AND label=?) OR (source_id=? AND target_id=? AND label=?)",
    );
    const ins = d.prepare(
      "INSERT OR IGNORE INTO edges (id, source_id, target_id, label, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const e of data.edges ?? []) {
      const [s, t, label] = Array.isArray(e) ? e : [e.source, e.target, e.label];
      const lab = (label ?? "lié à").trim() || "lié à";
      if (!s || !t || s === t || !exists.get(s) || !exists.get(t) || dup.get(s, t, lab, t, s, lab)) continue;
      ins.run(`seed_${crypto.createHash("md5").update(`${s}|${t}|${lab}`).digest("hex").slice(0, 12)}`, s, t, lab, now, now);
      stats.edges++;
    }
  })();

  kvSet("seed_hash", hash);
  console.log(`[cerveau] seed importé : ${stats.created} créés, ${stats.updated} mis à jour, ${stats.edges} liens`);
  return stats;
}
