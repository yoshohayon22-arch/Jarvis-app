"use client";

/**
 * Onglet Budget : dépenses en CHF, budgets par catégorie, abonnements et import d'un relevé CSV.
 * Uniquement tes saisies, enregistrées sur cet appareil ; aucun chiffre n'est inventé.
 */
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CardGrid } from "@/components/ui/card-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableCard } from "@/components/ui/expandable-card";
import { extractLines, guessColumns, parseAmount, parseCsv, type CsvGuess, type SignMode } from "@/lib/budget/csv";
import { dayLabel, newId, num, rows, str, today, useLocalData } from "@/lib/local/store";
import { cn } from "@/lib/utils";
import { ConfirmDelete, Field, inputClass, LocalNote, Status, STORAGE_ERROR } from "./form";

interface Line {
  id: string;
  date: string;
  /** Montant en centimes de franc. */
  c: number;
  cat: string;
  note: string;
}
interface Sub {
  id: string;
  nom: string;
  c: number;
  per: "mois" | "an";
}
interface BudgetData {
  lines: Line[];
  budgets: Record<string, number>;
  subs: Sub[];
}

const CATEGORIES: [string, string][] = [
  ["courses", "Courses"],
  ["restaurants", "Restaurants"],
  ["transport", "Transport"],
  ["logement", "Logement"],
  ["sante", "Santé"],
  ["loisirs", "Loisirs"],
  ["abonnements", "Abonnements"],
  ["achats", "Achats"],
  ["etudes", "Études"],
  ["dons", "Dons et tsedaka"],
  ["autre", "Autre"],
];
const catLabel = (id: string) => CATEGORIES.find(([k]) => k === id)?.[1] ?? "Autre";
const isCat = (id: unknown): id is string => CATEGORIES.some(([k]) => k === id);
const cents = (v: unknown) => (num(v) > 0 ? Math.round(num(v)) : 0);

const EMPTY: BudgetData = { lines: [], budgets: {}, subs: [] };
function parseBudget(raw: unknown): BudgetData {
  if (!raw || typeof raw !== "object") return EMPTY;
  const data = raw as Record<string, unknown>;
  const budgets: Record<string, number> = {};
  const rawBudgets = (data.budgets ?? {}) as Record<string, unknown>;
  for (const [key] of CATEGORIES) if (cents(rawBudgets[key])) budgets[key] = cents(rawBudgets[key]);
  return {
    lines: rows(data.lines)
      .filter((l) => typeof l.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(String(l.date)) && cents(l.c))
      .map((l) => ({ id: String(l.id), date: String(l.date), c: cents(l.c), cat: isCat(l.cat) ? l.cat : "autre", note: str(l.note, 140) })),
    budgets,
    subs: rows(data.subs)
      .filter((s) => typeof s.id === "string" && str(s.nom, 60) && cents(s.c))
      .map((s) => ({ id: String(s.id), nom: str(s.nom, 60), c: cents(s.c), per: s.per === "an" ? "an" : "mois" })),
  };
}

const chf = new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" });
const money = (c: number) => chf.format(c / 100);
const monthLong = new Intl.DateTimeFormat("fr-CH", { month: "long", year: "numeric", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("fr-CH", { month: "short", year: "2-digit", timeZone: "UTC" });
const monthDate = (key: string) => new Date(`${key}-01T00:00:00Z`);
const shiftMonth = (key: string, delta: number) => {
  const d = monthDate(key);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
};
const sum = (lines: Line[]) => lines.reduce((n, l) => n + l.c, 0);

/** Barre à l'échelle : `value` et le repère `mark` partagent le même maximum. */
function Bar({ value, max, mark }: { value: number; max: number; mark?: number }) {
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / (max || 1)) * 100)).toFixed(2)}%`;
  return (
    <div aria-hidden className="relative h-2.5 rounded bg-surface-2">
      {value > 0 ? <span className="absolute inset-y-0 left-0 min-w-0.5 rounded bg-accent" style={{ width: pct(value) }} /> : null}
      {mark ? <span className="absolute -inset-y-1 w-0.5 bg-text" style={{ left: pct(mark) }} /> : null}
    </div>
  );
}

function CategorySelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {CATEGORIES.map(([k, label]) => (
        <option key={k} value={k}>
          {label}
        </option>
      ))}
    </select>
  );
}

function ColumnSelect({ id, value, columns, onChange }: { id: string; value: number; columns: string[]; onChange: (v: number) => void }) {
  return (
    <select id={id} className={inputClass} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      <option value={-1}>Aucune</option>
      {columns.map((label, i) => (
        <option key={i} value={i}>
          {label.slice(0, 40)}
        </option>
      ))}
    </select>
  );
}

interface ImportState {
  name: string;
  rows: string[][];
  guess: CsvGuess;
}

export function BudgetView() {
  const [data, update] = useLocalData("budget", parseBudget, EMPTY);
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ amount: "", date: today(), cat: "courses", note: "" });
  const [formError, setFormError] = useState("");
  const [sub, setSub] = useState({ nom: "", amount: "", per: "mois" });
  const [subError, setSubError] = useState("");
  const [editBudgets, setEditBudgets] = useState<Record<string, string> | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [imp, setImp] = useState<ImportState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = (change: (d: BudgetData) => BudgetData, done: string) => setMessage(update(change) ? done : STORAGE_ERROR);

  const lines = useMemo(() => data.lines.filter((l) => l.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date)), [data.lines, month]);
  const total = sum(lines);
  const planned = Object.values(data.budgets).reduce((n, v) => n + v, 0);
  const spent = new Map<string, number>();
  for (const l of lines) spent.set(l.cat, (spent.get(l.cat) ?? 0) + l.c);
  const catRows = CATEGORIES.filter(([id]) => spent.has(id) || data.budgets[id]).sort((a, b) => (spent.get(b[0]) ?? 0) - (spent.get(a[0]) ?? 0));
  const max = Math.max(1, ...catRows.map(([id]) => Math.max(spent.get(id) ?? 0, data.budgets[id] ?? 0)));
  const over = planned > 0 && total > planned;

  const trendKeys = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
  const trend = trendKeys.map((key) => sum(data.lines.filter((l) => l.date.startsWith(key))));
  const trendMax = Math.max(...trend);
  const monthlySubs = data.subs.reduce((n, s) => n + (s.per === "an" ? s.c / 12 : s.c), 0);

  function addExpense(e: React.FormEvent) {
    e.preventDefault();
    const c = parseAmount(form.amount);
    if (c === null || c <= 0) return setFormError("Montant illisible. Exemple : 12.50");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return setFormError("Choisis une date.");
    setFormError("");
    const line: Line = { id: newId(), date: form.date, c, cat: form.cat, note: form.note.trim().slice(0, 140) };
    save((d) => ({ ...d, lines: [...d.lines, line] }), `Dépense de ${money(c)} ajoutée (${catLabel(line.cat)}).`);
    setMonth(form.date.slice(0, 7));
    setForm({ ...form, amount: "", note: "" });
  }

  function addSub(e: React.FormEvent) {
    e.preventDefault();
    const c = parseAmount(sub.amount);
    const nom = sub.nom.trim().slice(0, 60);
    if (!nom) return setSubError("Donne un nom à l'abonnement.");
    if (c === null || c <= 0) return setSubError("Montant illisible. Exemple : 12.50");
    setSubError("");
    save((d) => ({ ...d, subs: [...d.subs, { id: newId(), nom, c, per: sub.per === "an" ? "an" : "mois" }] }), `Abonnement « ${nom} » ajouté.`);
    setSub({ nom: "", amount: "", per: sub.per });
  }

  function saveBudgets(e: React.FormEvent) {
    e.preventDefault();
    if (!editBudgets) return;
    const budgets: Record<string, number> = {};
    for (const [id] of CATEGORIES) {
      const raw = (editBudgets[id] ?? "").trim();
      if (!raw) continue;
      const c = parseAmount(raw);
      if (c === null || c < 0) return setMessage(`Montant illisible pour « ${catLabel(id)} ».`);
      if (c > 0) budgets[id] = c;
    }
    save((d) => ({ ...d, budgets }), "Budgets enregistrés.");
    setEditBudgets(null);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setMessage("Ce fichier dépasse 5 Mo : exporte une période plus courte.");
    let text: string;
    try {
      const bytes = await file.arrayBuffer();
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        // Beaucoup de banques exportent encore en Windows-1252 (accents).
        text = new TextDecoder("windows-1252").decode(bytes);
      }
    } catch {
      return setMessage("Impossible de lire ce fichier.");
    }
    const parsed = parseCsv(text);
    if (parsed.length < 2) return setMessage("Ce fichier ne contient pas de lignes lisibles. Vérifie qu'il s'agit bien d'un export CSV.");
    setImp({ name: file.name, rows: parsed, guess: guessColumns(parsed) });
  }

  const importPreview = useMemo(() => {
    if (!imp) return null;
    const { lines: found, skipped } = extractLines(imp.rows, imp.guess);
    const key = (l: { date: string; c: number; note: string }) => `${l.date}|${l.c}|${l.note}`;
    const known = new Set(data.lines.map(key));
    const fresh = found.filter((l) => !known.has(key(l))).slice(0, 3000);
    return { fresh, duplicates: found.filter((l) => known.has(key(l))).length, skipped };
  }, [imp, data.lines]);

  function confirmImport() {
    if (!imp || !importPreview?.fresh.length) return;
    const added = importPreview.fresh.map((l) => ({ id: newId(), date: l.date, c: l.c, cat: "autre", note: l.note }));
    save((d) => ({ ...d, lines: [...d.lines, ...added] }), `${added.length} dépense${added.length > 1 ? "s" : ""} importée${added.length > 1 ? "s" : ""} depuis ${imp.name} (catégorie « Autre »).`);
    setMonth(added.reduce((m, l) => (l.date > m ? l.date : m), "").slice(0, 7));
    setImp(null);
  }

  const setGuess = (patch: Partial<CsvGuess>) => setImp((s) => (s ? { ...s, guess: { ...s.guess, ...patch } } : s));
  const shown = showAll ? lines : lines.slice(0, 30);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="icon" aria-label="Mois précédent" onClick={() => (setMonth(shiftMonth(month, -1)), setShowAll(false))}>
            <ChevronLeft aria-hidden />
          </Button>
          <h2 aria-live="polite" className="min-w-[9ch] text-center text-lg capitalize">
            {monthLong.format(monthDate(month))}
          </h2>
          <Button size="icon" aria-label="Mois suivant" onClick={() => (setMonth(shiftMonth(month, 1)), setShowAll(false))}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <Button onClick={() => fileRef.current?.click()}>
          <Upload aria-hidden />
          Importer un relevé (CSV)
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {imp && importPreview ? (
        <section className="card flex flex-col gap-4 p-5" aria-label="Importer un relevé">
          <h2 className="text-lg">Importer un relevé</h2>
          <p className="text-sm text-text-2">Fichier : {imp.name}. Il est lu sur ton appareil ; seules les dépenses que tu valides sont enregistrées. Vérifie les colonnes reconnues :</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,170px),1fr))] gap-3">
            <Field label="Colonne des dates" htmlFor="imp-date">
              <ColumnSelect id="imp-date" columns={imp.guess.columns} value={imp.guess.date} onChange={(v) => setGuess({ date: v })} />
            </Field>
            <Field label="Colonne des libellés" htmlFor="imp-label">
              <ColumnSelect id="imp-label" columns={imp.guess.columns} value={imp.guess.label} onChange={(v) => setGuess({ label: v })} />
            </Field>
            <Field label="Colonne des montants" htmlFor="imp-amount">
              <ColumnSelect id="imp-amount" columns={imp.guess.columns} value={imp.guess.amount} onChange={(v) => setGuess({ amount: v })} />
            </Field>
            <Field label="Lignes comptées comme dépenses" htmlFor="imp-sign">
              <select id="imp-sign" className={inputClass} value={imp.guess.sign} onChange={(e) => setGuess({ sign: e.target.value as SignMode })}>
                <option value="negatives">Seulement les montants négatifs</option>
                <option value="toutes">Toutes les lignes avec un montant</option>
              </select>
            </Field>
          </div>
          <p className="text-sm">
            {importPreview.fresh.length} dépense{importPreview.fresh.length > 1 ? "s" : ""} à importer
            {importPreview.duplicates ? ` · ${importPreview.duplicates} déjà enregistrée${importPreview.duplicates > 1 ? "s" : ""} (ignorée${importPreview.duplicates > 1 ? "s" : ""})` : ""}
            {importPreview.skipped ? ` · ${importPreview.skipped} ligne${importPreview.skipped > 1 ? "s" : ""} ignorée${importPreview.skipped > 1 ? "s" : ""} (crédit, montant ou date illisible)` : ""}.
          </p>
          {importPreview.fresh.length ? (
            <ul className="text-sm">
              {importPreview.fresh.slice(0, 8).map((l, i) => (
                <li key={i} className="flex items-baseline gap-3 border-b border-border/60 py-1.5 last:border-b-0">
                  <span className="shrink-0 tabular-nums text-text-2">{dayLabel(l.date)}</span>
                  <span className="min-w-0 flex-1 break-words">{l.note || "(sans libellé)"}</span>
                  <span className="shrink-0 tabular-nums">{money(l.c)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Rien à importer" reason="Vérifie les colonnes choisies : il faut au moins une colonne de dates et une colonne de montants." />
          )}
          {importPreview.fresh.length > 8 ? <p className="text-xs text-text-2">Aperçu des 8 premières lignes sur {importPreview.fresh.length}.</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={!importPreview.fresh.length} onClick={confirmImport}>
              Importer {importPreview.fresh.length || ""} dépense{importPreview.fresh.length > 1 ? "s" : ""}
            </Button>
            <Button onClick={() => setImp(null)}>Annuler</Button>
          </div>
        </section>
      ) : null}

      <CardGrid>
        <section className="card flex flex-col gap-4 p-5">
          <h2 className="text-lg">Ajouter une dépense</h2>
          <form onSubmit={addExpense} className="grid grid-cols-2 items-end gap-3">
            <Field label="Montant (CHF)" htmlFor="b-montant">
              <input id="b-montant" className={inputClass} inputMode="decimal" autoComplete="off" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Date" htmlFor="b-date">
              <input id="b-date" type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Catégorie" htmlFor="b-cat">
              <CategorySelect id="b-cat" value={form.cat} onChange={(cat) => setForm({ ...form, cat })} />
            </Field>
            <Field label="Note" htmlFor="b-note">
              <input id="b-note" className={inputClass} maxLength={140} autoComplete="off" placeholder="Facultatif" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
            <Button type="submit" variant="primary" className="col-span-2 sm:col-span-1">
              <Plus aria-hidden />
              Ajouter
            </Button>
            {formError ? (
              <p role="alert" className="col-span-2 text-sm font-semibold">
                {formError}
              </p>
            ) : null}
          </form>
        </section>

        <ExpandableCard title="Ce mois-ci" badge={lines.length ? <span className="text-xs text-text-2">{lines.length} dépense{lines.length > 1 ? "s" : ""}</span> : undefined}>
          <div className="flex flex-col gap-4">
            {!lines.length && !planned ? (
              <EmptyState title="Pas encore de données" reason="Aucune dépense saisie pour ce mois. Ajoute une dépense ou importe un relevé." />
            ) : (
              <>
                <div>
                  <p className="font-heading text-3xl tabular-nums">{money(total)}</p>
                  {planned ? (
                    <p className={cn("flex items-center gap-1 text-sm", over ? "font-semibold" : "text-text-2")}>
                      {over ? <AlertTriangle aria-hidden className="size-4 shrink-0" /> : null}
                      {over ? `Budget dépassé de ${money(total - planned)} (prévu : ${money(planned)})` : `sur ${money(planned)} prévus · reste ${money(planned - total)}`}
                    </p>
                  ) : (
                    <p className="text-sm text-text-2">dépensés en {monthLong.format(monthDate(month))}</p>
                  )}
                </div>
                <ul className="flex flex-col gap-3.5">
                  {catRows.map(([id, label]) => {
                    const s = spent.get(id) ?? 0;
                    const b = data.budgets[id] ?? 0;
                    return (
                      <li key={id} className="flex flex-col gap-1.5">
                        <div className="flex justify-between gap-3 text-sm">
                          <span>{label}</span>
                          <span className="tabular-nums">{b ? `${money(s)} / ${money(b)}` : money(s)}</span>
                        </div>
                        <Bar value={s} max={max} mark={b || undefined} />
                        {b > 0 && s > b ? (
                          <p className="flex items-center gap-1 text-xs font-semibold">
                            <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
                            Dépassé de {money(s - b)}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {planned && catRows.length ? <p className="text-xs text-text-2">Le trait vertical marque le budget prévu ; toutes les barres sont à la même échelle.</p> : null}
              </>
            )}
            {editBudgets ? (
              <form onSubmit={saveBudgets} className="flex flex-col gap-3 border-t border-border pt-4">
                <p className="text-sm text-text-2">Montant maximal par mois, en francs. Laisse vide pour ne pas fixer de budget.</p>
                <div className="grid grid-cols-2 gap-3">
                  {CATEGORIES.map(([id, label]) => (
                    <Field key={id} label={label} htmlFor={`bud-${id}`}>
                      <input id={`bud-${id}`} className={inputClass} inputMode="decimal" autoComplete="off" placeholder="Pas de budget" value={editBudgets[id] ?? ""} onChange={(e) => setEditBudgets({ ...editBudgets, [id]: e.target.value })} />
                    </Field>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary">
                    Enregistrer
                  </Button>
                  <Button type="button" onClick={() => setEditBudgets(null)}>
                    Annuler
                  </Button>
                </div>
              </form>
            ) : (
              <Button className="self-start" onClick={() => setEditBudgets(Object.fromEntries(Object.entries(data.budgets).map(([k, v]) => [k, (v / 100).toFixed(2)])))}>
                {planned ? "Modifier les budgets" : "Définir des budgets par catégorie"}
              </Button>
            )}
          </div>
        </ExpandableCard>
      </CardGrid>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-lg">Dépenses du mois</h2>
        {lines.length ? (
          <ul>
            {shown.map((line) => (
              <li key={line.id} className="flex min-h-13 items-center gap-3 border-b border-border/60 py-1.5 text-sm last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{line.note || catLabel(line.cat)}</p>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-text-2">
                    <span className="tabular-nums">{dayLabel(line.date)}</span>
                    <span className="rounded-full border border-border px-1.5">{catLabel(line.cat)}</span>
                  </p>
                </div>
                <strong className="shrink-0 tabular-nums">{money(line.c)}</strong>
                <ConfirmDelete iconOnly label={`Supprimer la dépense du ${dayLabel(line.date)}, ${money(line.c)}`} question="Supprimer ?" onConfirm={() => save((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== line.id) }), "Dépense supprimée.")} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Pas encore de données" reason="Aucune dépense enregistrée pour ce mois." />
        )}
        {lines.length > shown.length ? (
          <Button className="self-center" onClick={() => setShowAll(true)}>
            Afficher les {lines.length} dépenses
          </Button>
        ) : null}
      </section>

      <CardGrid>
        <section className="card flex flex-col gap-4 p-5">
          <h2 className="text-lg">Abonnements</h2>
          {data.subs.length ? (
            <>
              <div>
                <p className="font-heading text-3xl tabular-nums">{money(Math.round(monthlySubs))}</p>
                <p className="text-sm text-text-2">par mois, soit {money(Math.round(monthlySubs * 12))} par an</p>
              </div>
              <ul>
                {[...data.subs]
                  .sort((a, b) => (b.per === "an" ? b.c / 12 : b.c) - (a.per === "an" ? a.c / 12 : a.c))
                  .map((s) => (
                    <li key={s.id} className="flex items-center gap-3 border-b border-border/60 py-1.5 text-sm last:border-b-0">
                      <span className="min-w-0 flex-1 break-words font-medium">{s.nom}</span>
                      <span className="shrink-0 tabular-nums">
                        {money(s.c)} / {s.per === "an" ? "an" : "mois"}
                      </span>
                      <ConfirmDelete iconOnly label={`Retirer l'abonnement ${s.nom}`} question="Retirer ?" onConfirm={() => save((d) => ({ ...d, subs: d.subs.filter((x) => x.id !== s.id) }), `Abonnement « ${s.nom} » retiré.`)} />
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <EmptyState title="Pas encore de données" reason="Aucun abonnement saisi. Ajoute-les ci-dessous pour voir ce qu'ils coûtent par mois et par an." />
          )}
          <form onSubmit={addSub} className="grid grid-cols-2 items-end gap-3 border-t border-border pt-4">
            <Field label="Nom" htmlFor="s-nom">
              <input id="s-nom" className={inputClass} maxLength={60} autoComplete="off" value={sub.nom} onChange={(e) => setSub({ ...sub, nom: e.target.value })} />
            </Field>
            <Field label="Montant (CHF)" htmlFor="s-montant">
              <input id="s-montant" className={inputClass} inputMode="decimal" autoComplete="off" placeholder="0.00" value={sub.amount} onChange={(e) => setSub({ ...sub, amount: e.target.value })} />
            </Field>
            <Field label="Fréquence" htmlFor="s-per">
              <select id="s-per" className={inputClass} value={sub.per} onChange={(e) => setSub({ ...sub, per: e.target.value })}>
                <option value="mois">Par mois</option>
                <option value="an">Par an</option>
              </select>
            </Field>
            <Button type="submit">
              <Plus aria-hidden />
              Ajouter
            </Button>
            {subError ? (
              <p role="alert" className="col-span-2 text-sm font-semibold">
                {subError}
              </p>
            ) : null}
          </form>
          <p className="text-xs text-text-2">Les abonnements ne sont pas ajoutés automatiquement aux dépenses du mois, pour éviter les doublons avec un relevé importé.</p>
        </section>

        <section className="card flex flex-col gap-4 p-5">
          <h2 className="text-lg">Six derniers mois</h2>
          {trendMax ? (
            <>
              <ul className="flex flex-col gap-2.5">
                {trendKeys.map((key, i) => (
                  <li key={key} className={cn("grid grid-cols-[64px_minmax(0,1fr)_104px] items-center gap-2.5 text-xs", key === month ? "font-semibold" : "text-text-2")}>
                    <span>{monthShort.format(monthDate(key))}</span>
                    <Bar value={trend[i]} max={trendMax} />
                    <span className="text-right tabular-nums">{trend[i] ? money(trend[i]) : "–"}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-text-2">Total des dépenses saisies par mois. « – » : rien de saisi ce mois-là.</p>
            </>
          ) : (
            <EmptyState title="Pas encore de données" reason="Aucune dépense sur ces six mois." />
          )}
        </section>
      </CardGrid>

      <LocalNote />
      <Status message={message} />
    </div>
  );
}
