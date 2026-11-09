// Types partagés client / serveur.

export const NODE_TYPES = [
  "personne",
  "projet",
  "idee",
  "tache",
  "argent",
  "lieu",
  "organisation",
  "note",
  "document",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

/** Types que l'IA peut créer à partir d'une saisie (« document » est réservé aux fichiers / au seed). */
export const EXTRACTABLE_TYPES = NODE_TYPES.filter((t) => t !== "document") as Exclude<NodeType, "document">[];

export const TYPE_META: Record<NodeType, { label: string; color: string; emoji: string }> = {
  personne: { label: "Personne", color: "#38bdf8", emoji: "👤" },
  projet: { label: "Projet", color: "#a78bfa", emoji: "🚀" },
  idee: { label: "Idée", color: "#facc15", emoji: "💡" },
  tache: { label: "Tâche", color: "#fb923c", emoji: "✅" },
  argent: { label: "Argent", color: "#34d399", emoji: "💰" },
  lieu: { label: "Lieu", color: "#f472b6", emoji: "📍" },
  organisation: { label: "Organisation", color: "#60a5fa", emoji: "🏢" },
  note: { label: "Note", color: "#94a3b8", emoji: "📝" },
  document: { label: "Document", color: "#2dd4bf", emoji: "📄" },
};

export type Direction = "depense" | "rentree";

export interface BrainNode {
  id: string;
  type: NodeType;
  title: string;
  summary: string;
  tags: string[];
  url: string | null;
  amount: number | null;
  currency: string | null;
  direction: Direction | null;
  category: string | null;
  occurred_at: string | null;
  file_id: string | null;
  origin: string;
  user_edited: number;
  touch_count: number;
  created_at: string;
  last_activity_at: string;
}

export interface BrainEdge {
  id: string;
  source_id: string;
  target_id: string;
  label: string;
  created_at: string;
  last_activity_at: string;
}

export interface BrainSource {
  id: string;
  raw_text: string;
  kind: string;
  file_id: string | null;
  created_at: string;
}

export interface BrainFile {
  id: string;
  original_name: string;
  stored_name: string;
  mime: string;
  size: number;
  sha256: string;
  status: "en_attente" | "traite" | "erreur";
  error: string | null;
  created_at: string;
}

/** Nœud tel qu'envoyé à la carte. */
export interface GraphNode {
  id: string;
  type: NodeType;
  title: string;
  degree: number;
  glow: number; // 0.15 → 1 : éclat (récence × fréquence)
  url: string | null;
  created_at: string;
  last_activity_at: string;
  tags: string[];
}
export interface GraphLink {
  id: string;
  source: string;
  target: string;
  label: string;
  created_at: string;
}
export interface GraphPayload {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface NodeDetail {
  node: BrainNode;
  sources: BrainSource[];
  file: BrainFile | null;
  connections: { edge: BrainEdge; other: Pick<BrainNode, "id" | "title" | "type">; direction: "out" | "in" }[];
}

export interface CaptureResult {
  sourceId: string;
  created: string[];
  updated: string[];
  edges: string[];
  fallback: boolean;
  message?: string;
}

export interface AskResult {
  answer: string;
  cited: { id: string; title: string; type: NodeType }[];
  considered: number;
}

export interface ForgottenResult {
  node: { id: string; title: string; type: NodeType; daysSince: number } | null;
  sentence: string;
}

export interface MoneySummary {
  month: string; // AAAA-MM
  currencies: {
    currency: string;
    depenses: number;
    rentrees: number;
    solde: number;
    categories: { category: string; depenses: number; rentrees: number }[];
  }[];
  items: { id: string; title: string; amount: number; currency: string; direction: Direction; category: string; date: string }[];
}
