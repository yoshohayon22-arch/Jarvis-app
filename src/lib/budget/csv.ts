/** Lecture d'un relevé bancaire au format CSV (fonctions pures, sans accès au réseau ni au stockage). */

/** Montant saisi (« 12.50 », « 12,50 », « 1'234.50 », « -45.90 CHF ») → centimes. null si illisible. */
export function parseAmount(raw: string): number | null {
  let s = String(raw ?? "").replace(/[\s'’`  ]|chf|fr\.?|sfr\.?/gi, "");
  if (!s) return null;
  const negative = /^-|-$|^\(.*\)$/.test(s);
  s = s.replace(/[-+()]/g, "");
  const comma = s.lastIndexOf(",");
  const dot = s.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    // Les deux séparateurs : le dernier est la décimale, l'autre sépare les milliers.
    s = comma > dot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (comma >= 0) {
    s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  if (!Number.isFinite(cents) || cents > 1e11) return null;
  return negative ? -cents : cents;
}

/** Date d'un relevé (jj.mm.aaaa, jj/mm/aa, aaaa-mm-jj…) → « aaaa-mm-jj ». null si illisible. */
export function parseDate(raw: string): string | null {
  const s = String(raw ?? "").trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?!\d)/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  } else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d || y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Découpe un texte CSV en lignes de cellules (guillemets et séparateur détecté : « ; », « , » ou tabulation). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const sample = clean.split(/\r?\n/).slice(0, 30).join("\n");
  const count = (ch: string) => sample.split(ch).length - 1;
  const delimiter = [";", "\t", ","].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ";");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

const RE_DATE = /date|datum|valeur|valuta|buchung/i;
const RE_LABEL = /libell|texte|text|descri|beschreib|d[ée]tail|communication|avis|motif|commer|merchant|objet|intitul/i;
const RE_DEBIT = /d[ée]bit|belastung|sortie|lastschrift|withdraw/i;
const RE_AMOUNT = /montant|betrag|amount|somme|importo/i;
const RE_BALANCE = /solde|saldo|balance/i;

/** Sens des montants : dépenses négatives, toutes les lignes sont des dépenses, ou colonne « débit » dédiée. */
export type SignMode = "negatives" | "toutes";

export interface CsvGuess {
  /** Index de la ligne d'en-tête (−1 si aucune). */
  header: number;
  columns: string[];
  date: number;
  label: number;
  amount: number;
  sign: SignMode;
}

/** Devine la ligne d'en-tête et le rôle des colonnes ; l'utilisateur peut corriger ensuite. */
export function guessColumns(rows: string[][]): CsvGuess {
  let header = -1;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const cells = rows[i];
    const hits = [RE_DATE, RE_LABEL, RE_DEBIT, RE_AMOUNT].filter((re) => cells.some((c) => c.length < 40 && re.test(c) && parseDate(c) === null)).length;
    if (hits >= 2) {
      header = i;
      break;
    }
  }
  const body = rows.slice(header + 1, header + 61);
  const width = Math.max(0, ...rows.slice(header < 0 ? 0 : header, header + 61).map((r) => r.length));
  const columns = Array.from({ length: width }, (_, i) => (header >= 0 && rows[header][i]) || `Colonne ${i + 1}`);
  const share = (col: number, test: (v: string) => boolean) => (body.length ? body.filter((r) => test(r[col] ?? "")).length / body.length : 0);
  const byHeader = (re: RegExp, not?: RegExp) => (header < 0 ? -1 : rows[header].findIndex((c) => re.test(c) && !(not && not.test(c))));
  const indexes = columns.map((_, i) => i);
  const best = (score: (col: number) => number, min: number) => {
    const ranked = indexes.map((i) => [score(i), i] as const).sort((a, b) => b[0] - a[0]);
    return ranked.length && ranked[0][0] >= min ? ranked[0][1] : -1;
  };

  let date = byHeader(RE_DATE);
  if (date < 0 || share(date, (v) => parseDate(v) !== null) < 0.5) date = best((i) => share(i, (v) => parseDate(v) !== null), 0.5);
  const debit = byHeader(RE_DEBIT);
  let amount = debit >= 0 ? debit : byHeader(RE_AMOUNT, RE_BALANCE);
  if (amount < 0) amount = best((i) => (i === date || RE_BALANCE.test(columns[i]) ? 0 : share(i, (v) => /\d/.test(v) && parseAmount(v) !== null && parseDate(v) === null)), 0.3);
  let label = byHeader(RE_LABEL);
  if (label < 0) label = best((i) => (i === date || i === amount ? 0 : body.reduce((n, r) => n + ((r[i] ?? "").replace(/[\d\s.,'-]/g, "").length > 2 ? (r[i] ?? "").length : 0), 0)), 1);
  const hasNegative = amount >= 0 && body.some((r) => (parseAmount(r[amount] ?? "") ?? 0) < 0);
  return { header, columns, date, label, amount, sign: debit < 0 && hasNegative ? "negatives" : "toutes" };
}

export interface CsvLine {
  date: string;
  /** Montant de la dépense en centimes (toujours positif). */
  c: number;
  note: string;
}

/** Extrait les dépenses selon les colonnes choisies. Les crédits et les lignes illisibles sont comptés à part. */
export function extractLines(rows: string[][], guess: Pick<CsvGuess, "header" | "date" | "label" | "amount" | "sign">): { lines: CsvLine[]; skipped: number } {
  const lines: CsvLine[] = [];
  let skipped = 0;
  for (const row of rows.slice(guess.header + 1)) {
    const date = parseDate(row[guess.date] ?? "");
    const value = parseAmount(row[guess.amount] ?? "");
    if (!date || value === null || value === 0 || (guess.sign === "negatives" && value > 0)) {
      skipped++;
      continue;
    }
    lines.push({ date, c: Math.abs(value), note: (row[guess.label] ?? "").replace(/\s+/g, " ").trim().slice(0, 140) });
  }
  return { lines, skipped };
}
