"use client";

/** Onglet Projets Claude Code : idées et projets en trois colonnes (Idées / En cours / Fini), enregistrés sur l'appareil. */
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";
import { newId, num, rows, safeUrl, str, useLocalData } from "@/lib/local/store";
import { areaClass, ConfirmDelete, Field, inputClass, LocalNote, Status, STORAGE_ERROR } from "./form";

type Statut = "idee" | "encours" | "fini";
const STATUTS: [Statut, string, string][] = [
  ["idee", "Idées", "Aucune idée notée. Ajoute la première ci-dessus."],
  ["encours", "En cours", "Aucun projet en cours."],
  ["fini", "Fini", "Aucun projet terminé."],
];

interface Projet {
  id: string;
  titre: string;
  desc: string;
  statut: Statut;
  etape: string;
  lien: string;
  notes: string;
  maj: number;
}

const EMPTY: Projet[] = [];
const parse = (raw: unknown): Projet[] =>
  rows(raw)
    .filter((p) => typeof p.id === "string" && str(p.titre, 120).trim())
    .map((p) => ({ id: String(p.id), titre: str(p.titre, 120), desc: str(p.desc, 4000), statut: STATUTS.some(([s]) => s === p.statut) ? (p.statut as Statut) : "idee", etape: str(p.etape, 300), lien: str(p.lien, 500), notes: str(p.notes, 20000), maj: num(p.maj) }));

function Editor({ projet, onSave, onDelete, onCancel }: { projet: Projet; onSave: (p: Projet) => void; onDelete: () => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(projet);
  const [error, setError] = useState("");
  const id = `p-${projet.id}`;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.titre.trim()) return setError("Le titre ne peut pas être vide.");
        if (draft.lien.trim() && !safeUrl(draft.lien)) return setError("Le lien doit commencer par https://");
        onSave({ ...draft, titre: draft.titre.trim(), desc: draft.desc.trim(), etape: draft.etape.trim(), lien: safeUrl(draft.lien), notes: draft.notes.trim(), maj: Date.now() });
      }}
    >
      <Field label="Titre" htmlFor={`${id}-titre`}>
        <input id={`${id}-titre`} className={inputClass} maxLength={120} value={draft.titre} onChange={(e) => setDraft({ ...draft, titre: e.target.value })} />
      </Field>
      <Field label="Description" htmlFor={`${id}-desc`}>
        <textarea id={`${id}-desc`} className={areaClass} rows={3} maxLength={4000} placeholder="À quoi ça sert, pour qui, ce que ça doit faire…" value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} />
      </Field>
      <Field label="Prochaine étape" htmlFor={`${id}-etape`}>
        <input id={`${id}-etape`} className={inputClass} maxLength={300} value={draft.etape} onChange={(e) => setDraft({ ...draft, etape: e.target.value })} />
      </Field>
      <Field label="Lien (dépôt, site…)" htmlFor={`${id}-lien`}>
        <input id={`${id}-lien`} className={inputClass} inputMode="url" maxLength={500} placeholder="https://github.com/…" value={draft.lien} onChange={(e) => setDraft({ ...draft, lien: e.target.value })} />
      </Field>
      <Field label="Plan, prompt et notes" htmlFor={`${id}-notes`}>
        <textarea id={`${id}-notes`} className={areaClass} rows={6} maxLength={20000} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
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
        <ConfirmDelete label="Supprimer" question="Supprimer définitivement ce projet ?" onConfirm={onDelete} />
      </div>
    </form>
  );
}

export function ProjetsView() {
  const [projets, update] = useLocalData("projets", parse, EMPTY);
  const [idea, setIdea] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const save = (change: (list: Projet[]) => Projet[], done: string) => setMessage(update(change) ? done : STORAGE_ERROR);

  return (
    <div className="flex flex-col gap-5">
      <form
        className="card flex flex-col gap-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const titre = idea.trim().slice(0, 120);
          if (!titre) return;
          save((list) => [...list, { id: newId(), titre, desc: "", statut: "idee", etape: "", lien: "", notes: "", maj: Date.now() }], `Idée « ${titre} » ajoutée.`);
          setIdea("");
        }}
      >
        <label htmlFor="p-idee" className="text-lg font-heading">
          Nouvelle idée
        </label>
        <div className="flex gap-2">
          <input id="p-idee" className={inputClass} maxLength={120} placeholder="Ex. : un suivi de mes révisions" value={idea} onChange={(e) => setIdea(e.target.value)} />
          <Button type="submit" variant="primary" aria-label="Ajouter une idée">
            <Plus aria-hidden />
            <span className="hidden sm:inline">Ajouter</span>
          </Button>
        </div>
      </form>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] items-start gap-4">
        {STATUTS.map(([statut, label, emptyReason], index) => {
          const items = projets.filter((p) => p.statut === statut).sort((a, b) => b.maj - a.maj);
          return (
            <section key={statut} aria-label={label} className="flex min-w-0 flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg">{label}</h2>
                <span className="text-xs text-text-2">{items.length}</span>
              </div>
              {items.length ? (
                <ul className="flex flex-col gap-2.5">
                  {items.map((p) => {
                    const url = safeUrl(p.lien);
                    const move = (delta: number) => {
                      const next = STATUTS[index + delta];
                      return next ? (
                        <Button size="icon" aria-label={`Passer « ${p.titre} » dans ${next[1]}`} onClick={() => save((list) => list.map((x) => (x.id === p.id ? { ...x, statut: next[0], maj: Date.now() } : x)), `« ${p.titre} » : ${next[1]}.`)}>
                          {delta < 0 ? <ChevronLeft aria-hidden /> : <ChevronRight aria-hidden />}
                        </Button>
                      ) : null;
                    };
                    return (
                      <li key={p.id} className="card flex flex-col gap-2 p-4">
                        {editing === p.id ? (
                          <Editor
                            projet={p}
                            onCancel={() => setEditing(null)}
                            onSave={(next) => (save((list) => list.map((x) => (x.id === p.id ? next : x)), `Projet « ${next.titre} » enregistré.`), setEditing(null))}
                            onDelete={() => (save((list) => list.filter((x) => x.id !== p.id), `Projet « ${p.titre} » supprimé.`), setEditing(null))}
                          />
                        ) : (
                          <>
                            <button type="button" className="min-h-11 self-start text-left font-heading text-base hover:underline" onClick={() => setEditing(p.id)}>
                              {p.titre}
                            </button>
                            {p.desc ? <p className="line-clamp-3 text-sm text-text-2">{p.desc}</p> : null}
                            {p.etape ? (
                              <p className="text-sm">
                                <strong>Prochaine étape : </strong>
                                {p.etape}
                              </p>
                            ) : null}
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex flex-wrap items-center gap-2 text-xs text-text-2">
                                {url ? (
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                                    Ouvrir le lien
                                  </a>
                                ) : null}
                                {p.maj ? <span>{formatDateTime(new Date(p.maj))}</span> : null}
                              </span>
                              <span className="flex gap-1.5">
                                {move(-1)}
                                {move(1)}
                              </span>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState title="Pas encore de données" reason={emptyReason} />
              )}
            </section>
          );
        })}
      </div>
      <p className="text-xs text-text-2">L&apos;agent qui rédige un plan et un prompt fonctionne dans la version artefact (il utilise Claude).</p>
      <LocalNote />
      <Status message={message} />
    </div>
  );
}
