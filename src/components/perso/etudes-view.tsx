"use client";

/** Onglet Études : suivi de tes écoles et candidatures (état, date limite, notes), enregistré sur l'appareil. */
import { AlertTriangle, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardGrid } from "@/components/ui/card-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { dayLabel, newId, num, rows, safeUrl, str, today, useLocalData } from "@/lib/local/store";
import { cn } from "@/lib/utils";
import { areaClass, ConfirmDelete, Field, inputClass, LocalNote, Status, STORAGE_ERROR } from "./form";

const STATUTS: [string, string][] = [
  ["a-etudier", "À étudier"],
  ["interesse", "Intéressé"],
  ["dossier", "Dossier en préparation"],
  ["envoye", "Candidature envoyée"],
  ["admis", "Admis"],
  ["refuse", "Refusé"],
];
const statutLabel = (s: string) => STATUTS.find(([id]) => id === s)?.[1] ?? "À étudier";

interface Ecole {
  id: string;
  nom: string;
  programme: string;
  lieu: string;
  url: string;
  statut: string;
  /** Date limite de candidature, aaaa-mm-jj (vide si inconnue). */
  echeance: string;
  notes: string;
  maj: number;
}

const EMPTY: Ecole[] = [];
const parse = (raw: unknown): Ecole[] =>
  rows(raw)
    .filter((e) => typeof e.id === "string" && str(e.nom, 160).trim())
    .map((e) => ({ id: String(e.id), nom: str(e.nom, 160), programme: str(e.programme, 200), lieu: str(e.lieu, 120), url: str(e.url, 500), statut: STATUTS.some(([s]) => s === e.statut) ? String(e.statut) : "a-etudier", echeance: /^\d{4}-\d{2}-\d{2}$/.test(String(e.echeance)) ? String(e.echeance) : "", notes: str(e.notes, 4000), maj: num(e.maj) }));

const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
const daysUntil = (date: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86_400_000);
const blank = (): Ecole => ({ id: newId(), nom: "", programme: "", lieu: "", url: "", statut: "a-etudier", echeance: "", notes: "", maj: 0 });
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

function Editor({ ecole, isNew, onSave, onDelete, onCancel }: { ecole: Ecole; isNew: boolean; onSave: (e: Ecole) => void; onDelete: () => void; onCancel: () => void }) {
  const [d, setD] = useState(ecole);
  const [error, setError] = useState("");
  const id = `e-${ecole.id}`;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!d.nom.trim()) return setError("Indique le nom de l'école.");
        if (d.url.trim() && !safeUrl(d.url)) return setError("Le lien doit commencer par https://");
        onSave({ ...d, nom: d.nom.trim(), programme: d.programme.trim(), lieu: d.lieu.trim(), url: safeUrl(d.url), notes: d.notes.trim(), maj: Date.now() });
      }}
    >
      <Field label="École" htmlFor={`${id}-nom`}>
        <input id={`${id}-nom`} className={inputClass} maxLength={160} value={d.nom} onChange={(e) => setD({ ...d, nom: e.target.value })} />
      </Field>
      <Field label="Programme" htmlFor={`${id}-prog`}>
        <input id={`${id}-prog`} className={inputClass} maxLength={200} value={d.programme} onChange={(e) => setD({ ...d, programme: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Lieu" htmlFor={`${id}-lieu`}>
          <input id={`${id}-lieu`} className={inputClass} maxLength={120} value={d.lieu} onChange={(e) => setD({ ...d, lieu: e.target.value })} />
        </Field>
        <Field label="État" htmlFor={`${id}-statut`}>
          <select id={`${id}-statut`} className={inputClass} value={d.statut} onChange={(e) => setD({ ...d, statut: e.target.value })}>
            {STATUTS.map(([s, label]) => (
              <option key={s} value={s}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date limite de candidature" htmlFor={`${id}-date`} className="col-span-2">
          <input id={`${id}-date`} type="date" className={inputClass} value={d.echeance} onChange={(e) => setD({ ...d, echeance: e.target.value })} />
        </Field>
      </div>
      <Field label="Site officiel" htmlFor={`${id}-url`}>
        <input id={`${id}-url`} className={inputClass} inputMode="url" maxLength={500} placeholder="https://…" value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} />
      </Field>
      <Field label="Notes" htmlFor={`${id}-notes`}>
        <textarea id={`${id}-notes`} className={areaClass} rows={4} maxLength={4000} placeholder="Conditions d'admission, prix, pièces du dossier, contact…" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
      </Field>
      {error ? (
        <p role="alert" className="text-sm font-semibold">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary">
          Enregistrer
        </Button>
        <Button type="button" onClick={onCancel}>
          Annuler
        </Button>
        {isNew ? null : <ConfirmDelete label="Retirer" question="Retirer définitivement cette école ?" onConfirm={onDelete} />}
      </div>
    </form>
  );
}

export function EtudesView() {
  const [ecoles, update] = useLocalData("etudes", parse, EMPTY);
  const [editing, setEditing] = useState<Ecole | null>(null);
  const [message, setMessage] = useState("");
  const save = (change: (list: Ecole[]) => Ecole[], done: string) => setMessage(update(change) ? done : STORAGE_ERROR);
  const sorted = [...ecoles].sort((a, b) => (a.echeance || "9999").localeCompare(b.echeance || "9999") || a.nom.localeCompare(b.nom));
  const isNew = editing ? !ecoles.some((e) => e.id === editing.id) : false;

  return (
    <div className="flex flex-col gap-5">
      <CardGrid>
        <section className="card flex flex-col gap-4 p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg">Mes écoles et candidatures</h2>
            <Button variant="primary" aria-label="Ajouter une école" onClick={() => setEditing(blank())}>
              <Plus aria-hidden />
              <span className="hidden sm:inline">Ajouter une école</span>
            </Button>
          </div>
          {editing && isNew ? (
            <div className="rounded-control border border-border p-4">
              <Editor ecole={editing} isNew onCancel={() => setEditing(null)} onDelete={() => setEditing(null)} onSave={(next) => (save((list) => [...list, next], `« ${next.nom} » enregistrée.`), setEditing(null))} />
            </div>
          ) : null}
          {sorted.length ? (
            <ul className="flex flex-col gap-2.5">
              {sorted.map((e) => {
                const done = e.statut === "envoye" || e.statut === "admis" || e.statut === "refuse";
                const days = e.echeance ? daysUntil(e.echeance) : null;
                const urgent = days !== null && !done && days <= 14;
                const url = safeUrl(e.url);
                return (
                  <li key={e.id} className="flex flex-col gap-1.5 rounded-control border border-border p-4">
                    {editing?.id === e.id ? (
                      <Editor
                        ecole={e}
                        isNew={false}
                        onCancel={() => setEditing(null)}
                        onSave={(next) => (save((list) => list.map((x) => (x.id === e.id ? next : x)), `« ${next.nom} » enregistrée.`), setEditing(null))}
                        onDelete={() => (save((list) => list.filter((x) => x.id !== e.id), `« ${e.nom} » retirée.`), setEditing(null))}
                      />
                    ) : (
                      <>
                        <button type="button" className="min-h-11 self-start text-left font-heading text-base hover:underline" onClick={() => setEditing(e)}>
                          {e.nom}
                        </button>
                        {e.programme || e.lieu ? <p className="text-sm">{[e.programme, e.lieu].filter(Boolean).join(" · ")}</p> : null}
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-2">
                          <span className={cn("rounded-full border border-border px-1.5", e.statut === "admis" && "bg-accent font-semibold text-on-accent")}>{statutLabel(e.statut)}</span>
                          {days !== null ? (
                            <span className={cn("inline-flex items-center gap-1", urgent && "font-semibold text-text")}>
                              {urgent ? <AlertTriangle aria-hidden className="size-3.5" /> : null}
                              Date limite : {dayLabel(e.echeance)} ({days < 0 ? "dépassée, " : ""}
                              {relative.format(days, "day")})
                            </span>
                          ) : (
                            <span>Date limite : non renseignée</span>
                          )}
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                              {host(url)}
                            </a>
                          ) : null}
                        </p>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : editing ? null : (
            <EmptyState title="Pas encore de données" reason="Aucune école dans ta liste. Ajoute la première avec le bouton ci-dessus." />
          )}
          <p className="text-xs text-text-2">Triées par date limite. Alerte à 14 jours ou moins.</p>
        </section>
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="text-lg">Recherche d&apos;écoles</h2>
          <EmptyState title="Pas disponible sur le site" reason="La recherche web résumée par Claude fonctionne dans la version artefact du Dashboard. Ici, il faudrait une clé Anthropic payante." />
        </section>
      </CardGrid>
      <LocalNote />
      <Status message={message} />
    </div>
  );
}
