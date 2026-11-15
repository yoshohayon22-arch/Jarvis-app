"use client";

/** Onglet Le Cerveau : tes notes avec recherche immédiate, enregistrées sur l'appareil. */
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";
import { newId, num, rows, str, useLocalData } from "@/lib/local/store";
import { areaClass, ConfirmDelete, Field, inputClass, LocalNote, Status, STORAGE_ERROR } from "./form";

interface Note {
  id: string;
  titre: string;
  texte: string;
  maj: number;
}

const EMPTY: Note[] = [];
const parse = (raw: unknown): Note[] =>
  rows(raw)
    .filter((n) => typeof n.id === "string" && (str(n.titre, 160).trim() || str(n.texte, 20000).trim()))
    .map((n) => ({ id: String(n.id), titre: str(n.titre, 160) || "(sans titre)", texte: str(n.texte, 20000), maj: num(n.maj) }));

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function Editor({ note, isNew, onSave, onDelete, onCancel }: { note: Note; isNew: boolean; onSave: (n: Note) => void; onDelete: () => void; onCancel: () => void }) {
  const [d, setD] = useState(note);
  const [error, setError] = useState("");
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!d.titre.trim() && !d.texte.trim()) return setError("La note est vide.");
        onSave({ ...d, titre: d.titre.trim() || d.texte.trim().split("\n")[0].slice(0, 60), maj: Date.now() });
      }}
    >
      <Field label="Titre" htmlFor={`n-${note.id}-titre`}>
        <input id={`n-${note.id}-titre`} className={inputClass} maxLength={160} value={d.titre} onChange={(e) => setD({ ...d, titre: e.target.value })} />
      </Field>
      <Field label="Note" htmlFor={`n-${note.id}-texte`}>
        <textarea id={`n-${note.id}-texte`} className={areaClass} rows={10} maxLength={20000} placeholder="Écris ou colle ta note ici…" value={d.texte} onChange={(e) => setD({ ...d, texte: e.target.value })} />
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
        {isNew ? null : <ConfirmDelete label="Supprimer" question="Supprimer définitivement cette note ?" onConfirm={onDelete} />}
      </div>
    </form>
  );
}

export function CerveauView() {
  const [notes, update] = useLocalData("cerveau", parse, EMPTY);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);
  const [message, setMessage] = useState("");
  const save = (change: (list: Note[]) => Note[], done: string) => setMessage(update(change) ? done : STORAGE_ERROR);

  const terms = fold(query).split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  const sorted = [...notes].sort((a, b) => b.maj - a.maj);
  const shown = terms.length ? sorted.filter((n) => terms.every((t) => fold(`${n.titre} ${n.texte}`).includes(t))) : sorted;
  const isNew = editing ? !notes.some((n) => n.id === editing.id) : false;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2">
        <label htmlFor="c-recherche" className="sr-only">
          Chercher dans mes notes
        </label>
        <input id="c-recherche" type="search" className={inputClass} maxLength={100} placeholder="Chercher dans mes notes" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button variant="primary" aria-label="Nouvelle note" onClick={() => setEditing({ id: newId(), titre: "", texte: "", maj: 0 })}>
          <Plus aria-hidden />
          <span className="hidden sm:inline">Nouvelle note</span>
        </Button>
      </div>

      {editing && isNew ? (
        <div className="card p-5">
          <Editor note={editing} isNew onCancel={() => setEditing(null)} onDelete={() => setEditing(null)} onSave={(next) => (save((list) => [...list, next], `Note « ${next.titre} » enregistrée.`), setEditing(null))} />
        </div>
      ) : null}

      {!notes.length ? (
        editing ? null : (
          <div className="card p-5">
            <EmptyState title="Pas encore de données" reason="Aucune note. Crée la première avec « Nouvelle note »." />
          </div>
        )
      ) : !shown.length ? (
        <div className="card p-5">
          <EmptyState title="Aucune note trouvée" reason="Aucune note ne contient tous ces mots." />
        </div>
      ) : (
        <>
          <p className="text-xs text-text-2">{terms.length ? `${shown.length} note${shown.length > 1 ? "s" : ""} sur ${notes.length}` : `${shown.length} note${shown.length > 1 ? "s" : ""}`}</p>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] items-start gap-4">
            {shown.slice(0, 200).map((n) => (
              <li key={n.id} className={editing?.id === n.id ? "card col-span-full p-5" : "card flex flex-col gap-2 p-4"}>
                {editing?.id === n.id ? (
                  <Editor
                    note={n}
                    isNew={false}
                    onCancel={() => setEditing(null)}
                    onSave={(next) => (save((list) => list.map((x) => (x.id === n.id ? next : x)), `Note « ${next.titre} » enregistrée.`), setEditing(null))}
                    onDelete={() => (save((list) => list.filter((x) => x.id !== n.id), `Note « ${n.titre} » supprimée.`), setEditing(null))}
                  />
                ) : (
                  <>
                    <button type="button" className="min-h-11 self-start text-left font-heading text-base hover:underline" onClick={() => setEditing(n)}>
                      {n.titre}
                    </button>
                    {n.texte.trim() ? <p className="line-clamp-4 whitespace-pre-line text-sm text-text-2">{n.texte.trim().slice(0, 400)}</p> : null}
                    {n.maj ? <p className="text-xs text-text-2">{formatDateTime(new Date(n.maj))}</p> : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-xs text-text-2">Les questions posées à tes notes (réponses de Claude) fonctionnent dans la version artefact.</p>
      <LocalNote />
      <Status message={message} />
    </div>
  );
}
