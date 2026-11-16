"use client";

/**
 * Onglet Musique : tes playlists, albums et artistes Spotify, lus dans le lecteur officiel intégré de Spotify.
 * Aucune connexion à ton compte n'est demandée par le Dashboard ; la liste reste sur l'appareil.
 */
import { Plus } from "lucide-react";
import { useState } from "react";
import { ConfirmDelete, inputClass, LocalNote, Status, STORAGE_ERROR } from "@/components/perso/form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { rows, str, useLocalData } from "@/lib/local/store";
import { parseSpotifyUrl, SPOTIFY_KINDS, type SpotifyKind } from "@/lib/spotify";
import { cn } from "@/lib/utils";

interface Item {
  kind: SpotifyKind;
  id: string;
  title: string;
}

const EMPTY: Item[] = [];
const parse = (raw: unknown): Item[] =>
  rows(raw)
    .filter((i) => String(i.kind) in SPOTIFY_KINDS && /^[A-Za-z0-9]{22}$/.test(String(i.id)))
    .map((i) => ({ kind: i.kind as SpotifyKind, id: String(i.id), title: str(i.title, 160) }));

export function MusiqueView() {
  const [items, update] = useLocalData("musique", parse, EMPTY);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const current = items.find((i) => i.id === selected) ?? items[0] ?? null;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const found = parseSpotifyUrl(input);
    if (!found) return setMessage("Lien non reconnu. Dans Spotify : « … » → Partager → Copier le lien, puis colle-le ici.");
    if (items.some((i) => i.id === found.id)) return setMessage("Ce lien est déjà dans ta liste.");
    setAdding(true);
    setMessage("Lecture du titre…");
    let title = "";
    try {
      const res = await fetch(`/api/musique?url=${encodeURIComponent(`https://open.spotify.com/${found.kind}/${found.id}`)}`);
      if (res.ok) title = String(((await res.json()) as { title?: string }).title ?? "");
    } catch {
      // Titre indisponible : on garde un nom générique.
    }
    const item = { ...found, title: title || `${SPOTIFY_KINDS[found.kind]} Spotify` };
    setMessage(update((list) => [...list, item]) ? `« ${item.title} » ajouté.` : STORAGE_ERROR);
    setSelected(item.id);
    setInput("");
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-lg">Ma musique</h2>
        <form onSubmit={add} className="flex gap-2">
          <label htmlFor="mu-lien" className="sr-only">
            Lien Spotify
          </label>
          <input id="mu-lien" className={inputClass} maxLength={300} placeholder="Colle un lien Spotify (playlist, album, artiste…)" value={input} onChange={(e) => setInput(e.target.value)} />
          <Button type="submit" variant="primary" disabled={adding} aria-label="Ajouter">
            <Plus aria-hidden />
            <span className="hidden sm:inline">Ajouter</span>
          </Button>
        </form>
        {items.length ? (
          <ul className="flex flex-wrap gap-2">
            {items.map((i) => (
              <li key={i.id} className={cn("flex items-center gap-1 rounded-full border-[length:var(--border-width)] pl-1 text-sm", current?.id === i.id ? "border-accent bg-accent-soft font-semibold" : "border-border bg-surface-2")}>
                <button type="button" aria-pressed={current?.id === i.id} className="min-h-11 px-3 text-left" onClick={() => setSelected(i.id)}>
                  {i.title} <span className="font-normal text-text-2">· {SPOTIFY_KINDS[i.kind]}</span>
                </button>
                <ConfirmDelete iconOnly label={`Retirer ${i.title}`} question="Retirer ?" onConfirm={() => setMessage(update((list) => list.filter((x) => x.id !== i.id)) ? `« ${i.title} » retiré.` : STORAGE_ERROR)} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Pas encore de données" reason="Aucune musique enregistrée. Dans Spotify, ouvre une playlist ou un album, puis « … » → Partager → Copier le lien, et colle-le ci-dessus." />
        )}
        <Status message={message} />
      </section>

      {current ? (
        <section className="card flex flex-col gap-3 p-5" aria-label={`Lecteur : ${current.title}`}>
          <h2 className="text-lg">{current.title}</h2>
          <iframe
            key={current.id}
            title={`Lecteur Spotify : ${current.title}`}
            src={`https://open.spotify.com/embed/${current.kind}/${current.id}`}
            className="w-full rounded-control border-0"
            height={current.kind === "track" || current.kind === "episode" ? 152 : 420}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
          <p className="text-xs text-text-2">
            Source : lecteur officiel intégré de Spotify. Sans être connecté à Spotify dans ce navigateur, il ne joue que des extraits ; l&apos;écoute complète dépend de ton compte Spotify.{" "}
            <a href={`https://open.spotify.com/${current.kind}/${current.id}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              Ouvrir dans Spotify
            </a>
          </p>
        </section>
      ) : null}
      <LocalNote />
    </div>
  );
}
