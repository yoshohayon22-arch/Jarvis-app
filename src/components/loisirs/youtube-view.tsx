"use client";

/** Onglet YouTube : nouvelles vidéos des chaînes que tu suis (flux publics de YouTube). La liste des chaînes reste sur l'appareil. */
import { Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { ConfirmDelete, inputClass, LocalNote, Status, STORAGE_ERROR } from "@/components/perso/form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SourceNote } from "@/components/ui/source-note";
import { formatDateTime } from "@/lib/format";
import { rows, str, useLocalData } from "@/lib/local/store";

interface Channel {
  id: string;
  name: string;
}
interface Video {
  id: string;
  title: string;
  url: string;
  publishedAt: string | null;
  channelId: string;
  channelName: string;
}
interface Payload {
  channels: ({ id: string; ok: true; name: string; count: number } | { id: string; ok: false; error: string })[];
  videos: Video[];
  fetchedAt: string;
}

const EMPTY: Channel[] = [];
const parse = (raw: unknown): Channel[] =>
  rows(raw)
    .filter((c) => /^UC[\w-]{22}$/.test(String(c.id)))
    .map((c) => ({ id: String(c.id), name: str(c.name, 120) || "Chaîne YouTube" }));

export function YoutubeView() {
  const [channels, update] = useLocalData("youtube", parse, EMPTY);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ key: string; data: Payload | null; error: string }>({ key: "", data: null, error: "" });
  const [tick, setTick] = useState(0);
  const [limit, setLimit] = useState(24);

  const ids = channels.map((c) => c.id).join(",");
  const key = `${ids}|${tick}`;
  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    fetch(`/api/youtube?ids=${ids}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`le serveur a répondu ${res.status}`);
        return (await res.json()) as Payload;
      })
      .then((data) => !cancelled && setResult({ key, data, error: "" }))
      .catch((e: unknown) => !cancelled && setResult((r) => ({ key, data: r.data, error: e instanceof Error ? e.message : "lecture impossible" })));
    return () => {
      cancelled = true;
    };
  }, [ids, key]);
  const loading = Boolean(ids) && result.key !== key;
  const data = ids ? result.data : null;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setAdding(true);
    setMessage("Recherche de la chaîne…");
    try {
      const res = await fetch(`/api/youtube/chaine?q=${encodeURIComponent(q)}`);
      const body = (await res.json().catch(() => null)) as { id?: string; name?: string; erreur?: string } | null;
      if (!res.ok || !body?.id) throw new Error(body?.erreur ?? "chaîne introuvable");
      const channel = { id: body.id, name: body.name || "Chaîne YouTube" };
      if (channels.some((c) => c.id === channel.id)) setMessage(`« ${channel.name} » est déjà dans ta liste.`);
      else setMessage(update((list) => [...list, channel]) ? `Chaîne « ${channel.name} » ajoutée.` : STORAGE_ERROR);
      setInput("");
    } catch (err) {
      const text = err instanceof Error ? err.message : "chaîne introuvable";
      setMessage(`${text.charAt(0).toUpperCase()}${text.slice(1)}.`);
    } finally {
      setAdding(false);
    }
  }

  const failed = data?.channels.filter((c) => !c.ok) ?? [];
  const videos = (data?.videos ?? []).filter((v) => channels.some((c) => c.id === v.channelId));

  return (
    <div className="flex flex-col gap-5">
      <section className="card flex flex-col gap-4 p-5">
        <h2 className="text-lg">Mes chaînes</h2>
        <form onSubmit={add} className="flex gap-2">
          <label htmlFor="y-chaine" className="sr-only">
            Lien ou nom de la chaîne
          </label>
          <input id="y-chaine" className={inputClass} maxLength={300} placeholder="Lien de la chaîne ou @nom" value={input} onChange={(e) => setInput(e.target.value)} />
          <Button type="submit" variant="primary" disabled={adding} aria-label="Ajouter la chaîne">
            <Plus aria-hidden />
            <span className="hidden sm:inline">Ajouter</span>
          </Button>
        </form>
        {channels.length ? (
          <ul className="flex flex-wrap gap-2">
            {channels.map((c) => (
              <li key={c.id} className="flex items-center gap-1 rounded-full border border-border bg-surface-2 pl-4 text-sm">
                <a href={`https://www.youtube.com/channel/${c.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center hover:underline">
                  {c.name}
                </a>
                <ConfirmDelete iconOnly label={`Retirer la chaîne ${c.name}`} question="Retirer ?" onConfirm={() => setMessage(update((list) => list.filter((x) => x.id !== c.id)) ? `Chaîne « ${c.name} » retirée.` : STORAGE_ERROR)} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Pas encore de données" reason="Aucune chaîne suivie. Colle le lien d'une chaîne YouTube (ou son nom commençant par @) pour voir ses nouvelles vidéos ici." />
        )}
        <Status message={message} />
      </section>

      {channels.length ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg">Nouvelles vidéos</h2>
            <Button aria-label="Actualiser" disabled={loading} onClick={() => setTick((t) => t + 1)}>
              <RefreshCw aria-hidden />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
          </div>
          {!data && loading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="skeleton h-56" />
              ))}
            </div>
          ) : !data ? (
            <div className="card flex flex-col gap-3 p-5">
              <EmptyState title="Données indisponibles" reason={`Le serveur n'a pas pu lire YouTube (${result.error || "raison inconnue"}).`} />
            </div>
          ) : videos.length ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4">
              {videos.slice(0, limit).map((v) => (
                <li key={v.id} className="card relative flex flex-col overflow-hidden">
                  {/* Miniature publique de YouTube ; simple <img>, pas d'optimisation serveur nécessaire. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" width={320} height={180} className="aspect-video w-full bg-surface-2 object-cover" />
                  <div className="flex flex-1 flex-col gap-1.5 p-4">
                    <h3 className="text-base leading-snug">
                      <a href={v.url} target="_blank" rel="noopener noreferrer" className="after:absolute after:inset-0 hover:underline">
                        {v.title}
                      </a>
                    </h3>
                    <p className="mt-auto text-xs text-text-2">
                      <strong className="text-text">{v.channelName}</strong>
                      {v.publishedAt ? ` · ${formatDateTime(new Date(v.publishedAt))}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="card p-5">
              <EmptyState title="Aucune vidéo" reason="Les flux de ces chaînes ne contiennent aucune vidéo pour le moment." />
            </div>
          )}
          {videos.length > limit ? (
            <Button className="self-center" onClick={() => setLimit(limit + 24)}>
              Afficher plus ({videos.length - limit} restantes)
            </Button>
          ) : null}
          {failed.length ? <p className="text-xs text-text-2">Indisponibles pour le moment : {failed.map((c) => `${channels.find((x) => x.id === c.id)?.name ?? c.id} (${c.ok ? "" : c.error})`).join(", ")}.</p> : null}
          {data ? <SourceNote source="flux publics de YouTube (15 dernières vidéos par chaîne)" updatedAt={new Date(data.fetchedAt)} /> : null}
          <p className="text-xs text-text-2">Un clic sur une vidéo l&apos;ouvre sur YouTube.</p>
        </>
      ) : null}
      <LocalNote />
    </div>
  );
}
