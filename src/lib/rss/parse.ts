/**
 * Petit lecteur de flux RSS 2.0 et Atom, sans dépendance.
 * On n'en extrait que le strict nécessaire : titre, lien, court résumé, date.
 * Le texte complet des articles n'est jamais repris.
 */

export interface FeedItem {
  title: string;
  link: string;
  /** Résumé fourni par le flux, sans HTML, tronqué. */
  summary: string;
  /** Date ISO, ou null si le flux n'en donne pas d'exploitable. */
  publishedAt: string | null;
}

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", hellip: "…",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", eacute: "é", egrave: "è",
  ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô", ucirc: "û", ugrave: "ù", icirc: "î",
  iuml: "ï", euml: "ë", oelig: "œ", Eacute: "É", Agrave: "À", Ccedil: "Ç", euro: "€", deg: "°",
  aacute: "á", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", iexcl: "¡", iquest: "¿", uuml: "ü",
  // Espaces typographiques (fréquents dans les textes hébreux de Sefaria).
  thinsp: " ", ensp: " ", emsp: " ", zwnj: "", zwj: "", lrm: "", rlm: "", shy: "",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    }
    return NAMED[code] ?? match;
  });
}

/** Contenu texte propre : CDATA déballé, entités décodées (deux passes : beaucoup de flux échappent leur HTML), balises retirées. */
export function cleanText(raw: string): string {
  let text = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  text = decodeEntities(text);
  text = text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
  text = decodeEntities(text);
  return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40)).replace(/[\s,;:.]+$/, "")}…`;
}

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? match[1] : null;
}

function atomLink(block: string): string | null {
  const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => m[1]);
  const pick = links.find((a) => /rel=["']alternate["']/i.test(a)) ?? links.find((a) => !/rel=/i.test(a)) ?? links[0];
  return pick?.match(/href=["']([^"']+)["']/i)?.[1] ?? null;
}

function toIso(raw: string | null): string | null {
  if (!raw) return null;
  const date = new Date(cleanText(raw));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseFeed(xml: string, maxItems = 15): FeedItem[] {
  const isAtom = !/<item[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const blocks = xml.match(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const items: FeedItem[] = [];

  for (const block of blocks) {
    if (items.length >= maxItems) break;
    const title = cleanText(tag(block, "title") ?? "");
    const rawLink = isAtom ? atomLink(block) : (tag(block, "link") ?? atomLink(block));
    const link = cleanText(rawLink ?? "");
    // On ne garde que des liens web sûrs vers l'article original.
    if (!title || !/^https?:\/\//i.test(link)) continue;

    const rawSummary = tag(block, "description") ?? tag(block, "summary") ?? tag(block, "media:description") ?? "";
    const summary = truncate(cleanText(rawSummary), 240);
    const publishedAt = toIso(tag(block, "pubDate") ?? tag(block, "published") ?? tag(block, "updated") ?? tag(block, "dc:date"));

    items.push({ title: truncate(title, 200), link, summary: summary === title ? "" : summary, publishedAt });
  }
  return items;
}

/** Décode le flux avec le bon jeu de caractères (en-tête HTTP, sinon déclaration XML, sinon UTF-8). */
export function decodeFeed(buffer: ArrayBuffer, contentType: string | null): string {
  const head = new TextDecoder("latin1").decode(buffer.slice(0, 200));
  const charset =
    contentType?.match(/charset=["']?([\w-]+)/i)?.[1] ?? head.match(/encoding=["']([\w-]+)["']/i)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}
