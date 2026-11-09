// Saisie → extraction IA → écriture des neurones / liens / source.
import { db, nowIso } from "./db";
import { structuredCall, aiAvailable, AIError } from "./ai/client";
import { EXTRACTION_SYSTEM } from "./ai/prompts";
import { ExtractionSchema, type Extraction } from "./ai/schemas";
import {
  candidateNodes,
  createSource,
  getNode,
  insertNode,
  linkSource,
  touchNodes,
  updateNode,
  upsertEdge,
} from "./repo";
import { normalize } from "./text";
import type { BrainNode, CaptureResult, Direction, NodeType } from "./types";

export function todayFr() {
  const d = new Date();
  return `${d.toISOString().slice(0, 10)} (${d.toLocaleDateString("fr-CH", { weekday: "long" })})`;
}

export function formatCandidates(nodes: BrainNode[]): string {
  if (!nodes.length) return "(aucun neurone pour l'instant)";
  return nodes
    .map((n) => `${n.id} | ${n.type} | ${n.title}${n.tags.length ? ` | ${n.tags.slice(0, 4).join(", ")}` : ""}`)
    .join("\n");
}

type Neuron = Extraction["neurones"][number];
type Link = Extraction["liens"][number];

function parseDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Filet de sécurité anti-doublon : même titre normalisé (et type compatible). */
function findSameTitle(title: string, type: string): BrainNode | null {
  const t = normalize(title);
  if (!t) return null;
  const rows = db().prepare("SELECT id, type, title FROM nodes WHERE type = ? OR (? IN ('personne','organisation','lieu'))").all(type, type) as {
    id: string;
    type: string;
    title: string;
  }[];
  const hit = rows.find((r) => normalize(r.title.replace(/\(.*?\)/g, "")) === t || normalize(r.title) === t);
  return hit ? getNode(hit.id) : null;
}

export function applyExtraction(
  ex: { neurones: Neuron[]; liens: Link[] },
  ctx: { sourceId: string; origin: string; docNodeId?: string; fileId?: string | null },
): Omit<CaptureResult, "sourceId" | "fallback"> {
  const refMap = new Map<string, string>();
  const created: string[] = [];
  const updated: string[] = [];
  const edges: string[] = [];
  const today = nowIso().slice(0, 10);

  db().transaction(() => {
    for (const n of ex.neurones) {
      if (!n.titre?.trim()) continue;
      let target: BrainNode | null = n.existing_id ? getNode(n.existing_id) : null;
      if (!target && n.type !== "argent" && n.type !== "tache") target = findSameTitle(n.titre, n.type);
      const money =
        n.type === "argent"
          ? {
              amount: n.montant != null ? Math.abs(n.montant) : null,
              currency: (n.devise || "CHF").toUpperCase().replace("€", "EUR").replace("$", "USD"),
              direction: (n.sens ?? "depense") as Direction,
              category: n.categorie?.trim() || null,
              occurred_at: parseDate(n.date) ?? today,
            }
          : { occurred_at: parseDate(n.date) };

      if (target) {
        const add = n.resume?.trim();
        const summary =
          add && !normalize(target.summary).includes(normalize(add)) ? [target.summary, add].filter(Boolean).join("\n") : target.summary;
        updateNode(target.id, {
          summary,
          tags: [...target.tags, ...(n.tags ?? [])],
          ...(target.type === "argent" && target.amount == null ? money : {}),
        });
        refMap.set(n.ref, target.id);
        if (!updated.includes(target.id)) updated.push(target.id);
      } else {
        const id = insertNode({
          type: n.type as NodeType,
          title: n.titre,
          summary: n.resume ?? "",
          tags: n.tags ?? [],
          origin: ctx.origin,
          ...money,
        });
        refMap.set(n.ref, id);
        created.push(id);
      }
      linkSource(refMap.get(n.ref)!, ctx.sourceId);
    }

    const resolve = (r: string): string | null => {
      if (r === "doc") return ctx.docNodeId ?? null;
      if (refMap.has(r)) return refMap.get(r)!;
      return getNode(r)?.id ?? null;
    };
    for (const l of ex.liens) {
      const a = resolve(l.de);
      const b = resolve(l.vers);
      if (!a || !b) continue;
      const id = upsertEdge(a, b, l.label);
      if (id) edges.push(id);
    }
    // Un neurone créé sans aucun lien est rattaché au fichier d'origine s'il y en a un.
    if (ctx.docNodeId) {
      for (const id of created) {
        const has = db().prepare("SELECT 1 FROM edges WHERE source_id = ? OR target_id = ?").get(id, id);
        if (!has) {
          const e = upsertEdge(ctx.docNodeId, id, "mentionne");
          if (e) edges.push(e);
        }
      }
    }
    // Les neurones existants seulement cités par un lien sont aussi « touchés ».
    const linked = ex.liens.flatMap((l) => [resolve(l.de), resolve(l.vers)]).filter((x): x is string => !!x);
    touchNodes(linked.filter((id) => !created.includes(id) && !updated.includes(id)));
  })();

  return { created, updated, edges };
}

/** Extraction hors-ligne très simple (mode test / sans clé API). */
export function mockExtraction(text: string, candidates: BrainNode[]): Extraction {
  const neurones: Neuron[] = [];
  const liens: Link[] = [];
  const t = text.trim();
  const lower = normalize(t);
  const money = /(\d+(?:[.,]\d{1,2})?)\s*(chf|eur|euros?|€|usd|\$|francs?|fr\.?)(?![a-z])/i.exec(t);
  const base = {
    existing_id: null,
    tags: [] as string[],
    montant: null,
    devise: null,
    sens: null,
    categorie: null,
    date: null,
  };
  if (money) {
    const cur = money[2].toLowerCase();
    const devise = cur.startsWith("eur") || cur === "€" ? "EUR" : cur === "usd" || cur === "$" ? "USD" : "CHF";
    const rentree = /(recu|reçu|gagne|gagné|salaire|rembourse|vendu|encaisse)/.test(lower);
    neurones.push({
      ...base,
      ref: "n1",
      type: "argent",
      titre: t.replace(money[0], "").replace(/^(j'ai\s+)?(paye|payé)\s*/i, "").trim().slice(0, 40) || "Dépense",
      resume: t,
      montant: Number(money[1].replace(",", ".")),
      devise,
      sens: rentree ? "rentree" : "depense",
      categorie: /resto|restaurant|repas|diner|dîner|dej/.test(lower) ? "restaurant" : "autre",
    });
  } else {
    const type = /^(idee|idée)\s*:?/.test(lower) ? "idee" : /(a faire|à faire|rappel|todo|penser a|penser à)/.test(lower) ? "tache" : "note";
    neurones.push({
      ...base,
      ref: "n1",
      type,
      titre: t.replace(/^(idée|idee)\s*:\s*/i, "").split(/\s+/).slice(0, 6).join(" "),
      resume: t,
    });
  }
  const norm = ` ${lower} `;
  for (const c of candidates) {
    const title = normalize(c.title.replace(/\(.*?\)/g, ""));
    const first = title.split(" ")[0];
    if ((title.length > 2 && norm.includes(` ${title} `)) || (first.length > 3 && norm.includes(` ${first} `))) {
      liens.push({ de: "n1", vers: c.id, label: "concerne" });
    }
  }
  return { neurones, liens };
}

export async function extractFromText(text: string): Promise<{ extraction: Extraction; fallback: boolean; message?: string }> {
  const candidates = candidateNodes(text);
  if (!aiAvailable()) {
    return {
      extraction: mockExtraction(text, candidates),
      fallback: true,
      message: process.env.CERVEAU_MOCK_AI === "1" ? "Mode test (IA simulée)" : "Pas de clé API : rangement simplifié sans IA.",
    };
  }
  const extraction = await structuredCall({
    schema: ExtractionSchema,
    system: EXTRACTION_SYSTEM,
    effort: "medium",
    content: `Date du jour : ${todayFr()}

Neurones existants (id | type | titre | tags) :
${formatCandidates(candidates)}

Source à ranger :
"""
${text}
"""`,
  });
  return { extraction, fallback: false };
}

export async function capture(text: string, kind: "saisie" | "dictee" = "saisie"): Promise<CaptureResult> {
  const clean = text.trim().slice(0, 8000);
  if (!clean) throw new Error("Texte vide");
  const sourceId = createSource(clean, kind);
  try {
    const { extraction, fallback, message } = await extractFromText(clean);
    const res = applyExtraction(extraction, { sourceId, origin: kind });
    return { sourceId, ...res, fallback, message };
  } catch (e) {
    // On ne perd jamais une saisie : en dernier recours, une note brute.
    const id = insertNode({ type: "note", title: clean.split(/\s+/).slice(0, 6).join(" "), summary: clean, origin: kind });
    linkSource(id, sourceId);
    return {
      sourceId,
      created: [id],
      updated: [],
      edges: [],
      fallback: true,
      message: e instanceof AIError ? `${e.message} — gardé comme note.` : "Erreur d'analyse — gardé comme note.",
    };
  }
}
