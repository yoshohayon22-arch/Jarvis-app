"use client";

/** Onglet Films & Séries : tes listes (à voir, en cours, vu) avec note et avis, enregistrées sur l'appareil. */
import { ExternalLink, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { newId, num, rows, str, useLocalData } from "@/lib/local/store";
import { cn } from "@/lib/utils";
import { areaClass, ConfirmDelete, Field, inputClass, LocalNote, Status, STORAGE_ERROR } from "./form";

type Statut = "a-voir" | "en-cours" | "vu";
const STATUTS: [Statut, string][] = [
  ["a-voir", "À voir"],
  ["en-cours", "En cours"],
  ["vu", "Vu"],
];

interface Titre {
  id: string;
  titre: string;
  genre: "film" | "serie";
  statut: Statut;
  /** Ma note de 1 à 5 (0 : pas noté). */
  note: number;
  avis: string;
  maj: number;
}

const EMPTY: Titre[] = [];
const parse = (raw: unknown): Titre[] =>
  rows(raw)
    .filter((t) => typeof t.id === "string" && str(t.titre, 160).trim())
    .map((t) => {
      const note = Math.round(num(t.note));
      return { id: String(t.id), titre: str(t.titre, 160), genre: t.genre === "serie" ? "serie" : "film", statut: STATUTS.some(([s]) => s === t.statut) ? (t.statut as Statut) : "a-voir", note: note >= 1 && note <= 5 ? note : 0, avis: str(t.avis, 2000), maj: num(t.maj) };
    });

const justWatch = (t: string) => `https://www.justwatch.com/ch/recherche?q=${encodeURIComponent(t)}`;

function Editor({ titre, onSave, onDelete, onCancel }: { titre: Titre; onSave: (t: Titre) => void; onDelete: () => void; onCancel: () => void }) {
  const [d, setD] = useState(titre);
  const id = `f-${titre.id}`;
  return (
    <form
      className="flex w-full flex-col gap-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (d.titre.trim()) onSave({ ...d, titre: d.titre.trim(), avis: d.avis.trim(), maj: Date.now() });
      }}
    >
      <Field label="Titre" htmlFor={`${id}-titre`}>
        <input id={`${id}-titre`} className={inputClass} maxLength={160} value={d.titre} onChange={(e) => setD({ ...d, titre: e.target.value })} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Type" htmlFor={`${id}-genre`}>
          <select id={`${id}-genre`} className={inputClass} value={d.genre} onChange={(e) => setD({ ...d, genre: e.target.value === "serie" ? "serie" : "film" })}>
            <option value="film">Film</option>
            <option value="serie">Série</option>
          </select>
        </Field>
        <Field label="Liste" htmlFor={`${id}-statut`}>
          <select id={`${id}-statut`} className={inputClass} value={d.statut} onChange={(e) => setD({ ...d, statut: e.target.value as Statut })}>
            {STATUTS.map(([s, label]) => (
              <option key={s} value={s}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ma note" htmlFor={`${id}-note`}>
          <select id={`${id}-note`} className={inputClass} value={d.note} onChange={(e) => setD({ ...d, note: Number(e.target.value) })}>
            <option value={0}>Pas noté</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} / 5
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Mon avis" htmlFor={`${id}-avis`}>
        <textarea id={`${id}-avis`} className={areaClass} rows={3} maxLength={2000} value={d.avis} onChange={(e) => setD({ ...d, avis: e.target.value })} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary">
          Enregistrer
        </Button>
        <Button type="button" onClick={onCancel}>
          Annuler
        </Button>
        <ConfirmDelete label="Retirer" question="Retirer définitivement ce titre ?" onConfirm={onDelete} />
      </div>
    </form>
  );
}

export function FilmsView() {
  const [titres, update] = useLocalData("films", parse, EMPTY);
  const [filter, setFilter] = useState<Statut>("a-voir");
  const [draft, setDraft] = useState({ titre: "", genre: "film" });
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const save = (change: (list: Titre[]) => Titre[], done: string) => setMessage(update(change) ? done : STORAGE_ERROR);
  const shown = titres.filter((t) => t.statut === filter).sort((a, b) => b.maj - a.maj);

  return (
    <div className="flex flex-col gap-5">
      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-lg">Mes listes</h2>
        <form
          className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const titre = draft.titre.trim().slice(0, 160);
            if (!titre) return;
            if (titres.some((t) => t.titre.toLowerCase() === titre.toLowerCase())) return setMessage(`« ${titre} » est déjà dans tes listes.`);
            save((list) => [...list, { id: newId(), titre, genre: draft.genre === "serie" ? "serie" : "film", statut: filter, note: 0, avis: "", maj: Date.now() }], `« ${titre} » ajouté à « ${STATUTS.find(([s]) => s === filter)?.[1]} ».`);
            setDraft({ ...draft, titre: "" });
          }}
        >
          <Field label="Titre" htmlFor="f-nouveau" className="col-span-2 sm:col-span-1">
            <input id="f-nouveau" className={inputClass} maxLength={160} placeholder="Titre du film ou de la série" value={draft.titre} onChange={(e) => setDraft({ ...draft, titre: e.target.value })} />
          </Field>
          <Field label="Type" htmlFor="f-nouveau-genre">
            <select id="f-nouveau-genre" className={inputClass} value={draft.genre} onChange={(e) => setDraft({ ...draft, genre: e.target.value })}>
              <option value="film">Film</option>
              <option value="serie">Série</option>
            </select>
          </Field>
          <Button type="submit" variant="primary">
            <Plus aria-hidden />
            Ajouter
          </Button>
        </form>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Choisir une liste">
          {STATUTS.map(([s, label]) => (
            <button
              key={s}
              type="button"
              aria-pressed={filter === s}
              onClick={() => setFilter(s)}
              className={cn("min-h-11 rounded-full border-[length:var(--border-width)] px-4 text-sm", filter === s ? "border-accent bg-accent-soft font-semibold text-text" : "border-border bg-surface text-text-2")}
            >
              {label} ({titres.filter((t) => t.statut === s).length})
            </button>
          ))}
        </div>

        {shown.length ? (
          <ul>
            {shown.map((t) => (
              <li key={t.id} className="flex min-h-13 flex-wrap items-center gap-3 border-b border-border/60 py-1.5 text-sm last:border-b-0">
                {editing === t.id ? (
                  <Editor
                    titre={t}
                    onCancel={() => setEditing(null)}
                    onSave={(next) => (save((list) => list.map((x) => (x.id === t.id ? next : x)), `« ${next.titre} » enregistré.`), setEditing(null))}
                    onDelete={() => (save((list) => list.filter((x) => x.id !== t.id), `« ${t.titre} » retiré.`), setEditing(null))}
                  />
                ) : (
                  <>
                    <button type="button" className="min-h-11 min-w-0 flex-1 break-words text-left font-medium hover:underline" onClick={() => setEditing(t.id)}>
                      {t.titre}
                    </button>
                    <span className="rounded-full border border-border px-1.5 text-xs text-text-2">{t.genre === "serie" ? "Série" : "Film"}</span>
                    {t.note ? <span className="tabular-nums">{t.note} / 5</span> : null}
                    <a href={justWatch(t.titre)} target="_blank" rel="noopener noreferrer" aria-label={`Où regarder ${t.titre} en Suisse (JustWatch)`} className="inline-flex size-11 items-center justify-center text-text-2 hover:text-text">
                      <ExternalLink aria-hidden className="size-4" />
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Pas encore de données" reason="Cette liste est vide." />
        )}
        <p className="text-xs text-text-2">L&apos;icône à droite d&apos;un titre ouvre JustWatch pour voir où le regarder en Suisse. L&apos;agent ciné (idées de Claude) fonctionne dans la version artefact.</p>
      </section>
      <LocalNote />
      <Status message={message} />
    </div>
  );
}
