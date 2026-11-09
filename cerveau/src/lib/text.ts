// Utilitaires texte (sans dépendance serveur).

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(s: string): string {
  return (
    normalize(s)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "neurone"
  );
}

const STOPWORDS = new Set(
  (
    "le la les un une des de du d l au aux et ou mais donc or ni car a à en dans par pour sur avec sans sous chez " +
    "ce cet cette ces mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs je tu il elle on nous vous ils elles " +
    "me te se lui y que qui quoi dont ou est sont suis es etre être ai as avons avez ont avait fait faire " +
    "quel quelle quels quelles qu est-ce ne pas plus tres très tout tous toute toutes moi toi sait sais savoir " +
    "comment combien pourquoi quand quoi rien chose choses m t s n j c"
  ).split(" "),
);

/** Mots-clés significatifs d'une phrase (normalisés, sans mots vides). */
export function keywords(s: string, max = 12): string[] {
  const out: string[] = [];
  for (const raw of normalize(s).split(/[^a-z0-9@]+/)) {
    if (raw.length < 2 || STOPWORDS.has(raw) || out.includes(raw)) continue;
    out.push(raw);
    if (out.length >= max) break;
  }
  return out;
}

/** Requête FTS5 sûre : "mot"* OR "mot2"* … */
export function ftsQuery(words: string[]): string | null {
  const ws = words.filter(Boolean).map((w) => `"${w.replace(/"/g, "")}"*`);
  return ws.length ? ws.join(" OR ") : null;
}

export function currentMonth(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}
