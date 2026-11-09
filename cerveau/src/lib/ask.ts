// « Parler au cerveau » : récupération (mots-clés + voisins) puis réponse IA ancrée sur ces seules données.
import { db } from "./db";
import { aiAvailable, structuredCall } from "./ai/client";
import { ANSWER_SYSTEM } from "./ai/prompts";
import { AnswerSchema } from "./ai/schemas";
import { getNode, moneySummary, neighborIds, searchNodes, touchNodes, rowToNode } from "./repo";
import { currentMonth, normalize } from "./text";
import type { AskResult, BrainNode, NodeType } from "./types";
import { todayFr } from "./extract";

const MONEY_RE = /(combien|depens|depense|argent|budget|paye|achat|achete|gagne|rentree|salaire|chf|eur|francs|cout|coute|frais)/;
const TYPE_HINTS: [RegExp, NodeType][] = [
  [/\bidees?\b/, "idee"],
  [/\btaches?\b|a faire|todo/, "tache"],
  [/\bprojets?\b/, "projet"],
  [/\bpersonnes?\b|\bqui\b|\bcontacts?\b/, "personne"],
  [/\blieux?\b|\bou\b/, "lieu"],
  [/\borganisations?\b|\bclubs?\b|\bentreprises?\b|\bboites?\b/, "organisation"],
  [/\bdocuments?\b|\bfichiers?\b|\bpages?\b/, "document"],
];

function monthFromQuestion(q: string): string {
  const n = normalize(q);
  const now = new Date();
  if (/mois dernier|le mois passe/.test(n)) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    return d.toISOString().slice(0, 7);
  }
  const months = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
  const idx = months.findIndex((m) => n.includes(m));
  if (idx >= 0) {
    const year = idx > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
    return `${year}-${String(idx + 1).padStart(2, "0")}`;
  }
  return currentMonth();
}

export function retrieve(question: string, max = 40): { nodes: BrainNode[]; moneyContext: string | null } {
  const picked = new Map<string, BrainNode>();
  const hits = searchNodes(question, 15);
  hits.forEach((n) => picked.set(n.id, n));

  const n = normalize(question);
  // Indices de type (« mes idées de business ? ») → neurones de ce type, les plus actifs d'abord.
  for (const [re, type] of TYPE_HINTS) {
    if (!re.test(n)) continue;
    const rows = db().prepare("SELECT * FROM nodes WHERE type = ? ORDER BY last_activity_at DESC LIMIT 25").all(type) as Record<string, unknown>[];
    for (const r of rows) if (picked.size < max) picked.set(String(r.id), rowToNode(r));
  }

  let moneyContext: string | null = null;
  if (MONEY_RE.test(n)) {
    const month = monthFromQuestion(question);
    const s = moneySummary(month);
    moneyContext = s.currencies.length
      ? `Totaux pré-calculés pour ${month} :\n` +
        s.currencies
          .map(
            (c) =>
              `- ${c.currency} : dépenses ${c.depenses}, rentrées ${c.rentrees}, solde ${c.solde}. Par catégorie : ` +
              c.categories.map((k) => `${k.category} (dép. ${k.depenses}${k.rentrees ? `, rentr. ${k.rentrees}` : ""})`).join(", "),
          )
          .join("\n")
      : `Aucun mouvement d'argent enregistré pour ${month}.`;
    for (const it of s.items.slice(0, 25)) {
      const node = getNode(it.id);
      if (node && picked.size < max) picked.set(node.id, node);
    }
  }

  // Voisins directs des meilleurs résultats (le graphe apporte le contexte).
  for (const id of neighborIds(hits.slice(0, 8).map((h) => h.id))) {
    if (picked.size >= max) break;
    const node = getNode(id);
    if (node) picked.set(id, node);
  }
  return { nodes: [...picked.values()], moneyContext };
}

function describe(n: BrainNode): string {
  const d = db();
  const edges = d
    .prepare(
      `SELECT e.label, e.source_id, e.target_id, n.title AS other FROM edges e
       JOIN nodes n ON n.id = CASE WHEN e.source_id = ? THEN e.target_id ELSE e.source_id END
       WHERE e.source_id = ? OR e.target_id = ? LIMIT 12`,
    )
    .all(n.id, n.id, n.id) as { label: string; source_id: string; target_id: string; other: string }[];
  const sources = d
    .prepare(
      "SELECT s.raw_text, s.created_at FROM sources s JOIN node_sources ns ON ns.source_id = s.id WHERE ns.node_id = ? ORDER BY s.created_at DESC LIMIT 3",
    )
    .all(n.id) as { raw_text: string; created_at: string }[];
  const lines = [
    `[${n.id}] (${n.type}) ${n.title}`,
    n.summary ? `  résumé : ${n.summary.slice(0, 600)}` : "",
    n.tags.length ? `  tags : ${n.tags.join(", ")}` : "",
    n.type === "argent" && n.amount != null
      ? `  montant : ${n.direction === "rentree" ? "+" : "-"}${n.amount} ${n.currency ?? ""} · ${n.category ?? "?"} · ${(n.occurred_at ?? n.created_at).slice(0, 10)}`
      : "",
    n.url ? `  lien : ${n.url}` : "",
    edges.length ? `  connexions : ${edges.map((e) => `${e.source_id === n.id ? "→" : "←"} ${e.label} ${e.other}`).join(" ; ")}` : "",
    ...sources.map((s) => `  source (${s.created_at.slice(0, 10)}) : « ${s.raw_text.slice(0, 300)} »`),
    `  créé le ${n.created_at.slice(0, 10)}, dernière activité ${n.last_activity_at.slice(0, 10)}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export async function ask(question: string): Promise<AskResult> {
  const q = question.trim().slice(0, 1000);
  if (!q) throw new Error("Question vide");
  const { nodes, moneyContext } = retrieve(q);

  if (!nodes.length && !moneyContext) {
    return { answer: "Je ne sais pas : rien dans ton cerveau ne correspond à cette question.", cited: [], considered: 0 };
  }

  if (!aiAvailable()) {
    // Sans IA : on liste simplement ce qui a été trouvé.
    const top = nodes.slice(0, 8);
    return {
      answer:
        (moneyContext ? `${moneyContext}\n\n` : "") +
        `Sans IA, voici les neurones les plus proches de ta question :\n` +
        top.map((n) => `• ${n.title}${n.summary ? ` — ${n.summary.slice(0, 120)}` : ""} [${n.id}]`).join("\n"),
      cited: top.map((n) => ({ id: n.id, title: n.title, type: n.type })),
      considered: nodes.length,
    };
  }

  const out = await structuredCall({
    schema: AnswerSchema,
    system: ANSWER_SYSTEM,
    effort: "medium",
    content: `Date du jour : ${todayFr()}

${moneyContext ? moneyContext + "\n\n" : ""}Neurones disponibles (${nodes.length}) :
${nodes.map(describe).join("\n\n")}

Question de Yosh : ${q}`,
  });

  const allowed = new Set(nodes.map((n) => n.id));
  // Les ids cités = ceux déclarés + ceux présents entre crochets dans la réponse, s'ils font partie du contexte.
  const inText = [...out.reponse.matchAll(/\[([a-z0-9][a-z0-9_-]*)\]/gi)].map((m) => m[1]);
  const citedIds = [...new Set([...out.neurones_cites, ...inText])].filter((id) => allowed.has(id));
  touchNodes(citedIds);
  return {
    answer: out.reponse,
    cited: citedIds.map((id) => {
      const n = nodes.find((x) => x.id === id)!;
      return { id, title: n.title, type: n.type };
    }),
    considered: nodes.length,
  };
}
