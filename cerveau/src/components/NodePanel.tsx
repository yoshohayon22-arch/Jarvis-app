"use client";

import { useEffect, useState } from "react";
import { api, fmtMoney, relativeDays } from "@/lib/api";
import { NODE_TYPES, TYPE_META, type NodeDetail, type NodeType } from "@/lib/types";

interface Props {
  id: string;
  version: string;
  onClose: () => void;
  onOpenNode: (id: string) => void;
  onChanged: (opts?: { deleted?: string; mergedInto?: string }) => void;
  toast: (msg: string, kind?: "ok" | "err") => void;
}

type Edit = {
  title: string;
  summary: string;
  type: NodeType;
  tags: string;
  url: string;
  amount: string;
  currency: string;
  direction: string;
  category: string;
  occurred_at: string;
};

export default function NodePanel({ id, version, onClose, onOpenNode, onChanged, toast }: Props) {
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergeHits, setMergeHits] = useState<{ id: string; title: string; type: NodeType }[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setError(null);
    api<NodeDetail>(`/api/nodes/${encodeURIComponent(id)}`)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id, version]);

  useEffect(() => {
    setEdit(null);
    setMerging(false);
    setConfirmDelete(false);
    setMergeQuery("");
  }, [id]);

  useEffect(() => {
    if (!merging || mergeQuery.trim().length < 2) return setMergeHits([]);
    const t = setTimeout(() => {
      api<{ id: string; title: string; type: NodeType }[]>(`/api/search?q=${encodeURIComponent(mergeQuery)}`)
        .then((r) => setMergeHits(r.filter((x) => x.id !== id)))
        .catch(() => setMergeHits([]));
    }, 200);
    return () => clearTimeout(t);
  }, [merging, mergeQuery, id]);

  if (error) {
    return (
      <Shell onClose={onClose}>
        <p className="p-4 text-sm text-rose-300">{error}</p>
      </Shell>
    );
  }
  if (!detail || detail.node.id !== id) {
    return (
      <Shell onClose={onClose}>
        <div className="space-y-3 p-5">
          <div className="h-5 w-2/3 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-full animate-pulse rounded bg-white/5" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-white/5" />
        </div>
      </Shell>
    );
  }

  const { node, sources, file, connections } = detail;
  const meta = TYPE_META[node.type];

  const startEdit = () =>
    setEdit({
      title: node.title,
      summary: node.summary,
      type: node.type,
      tags: node.tags.join(", "),
      url: node.url ?? "",
      amount: node.amount?.toString() ?? "",
      currency: node.currency ?? "CHF",
      direction: node.direction ?? "depense",
      category: node.category ?? "",
      occurred_at: (node.occurred_at ?? "").slice(0, 10),
    });

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        title: edit.title,
        summary: edit.summary,
        type: edit.type,
        tags: edit.tags.split(",").map((t) => t.trim()).filter(Boolean),
        url: edit.url.trim() || null,
      };
      if (edit.type === "argent") {
        Object.assign(body, {
          amount: edit.amount === "" ? null : Number(edit.amount.replace(",", ".")),
          currency: edit.currency,
          direction: edit.direction,
          category: edit.category || null,
          occurred_at: edit.occurred_at || null,
        });
      }
      setDetail(await api<NodeDetail>(`/api/nodes/${encodeURIComponent(id)}`, { method: "PATCH", json: body }));
      setEdit(null);
      onChanged();
      toast("Neurone mis à jour");
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const merge = async (into: string, title: string) => {
    setBusy(true);
    try {
      await api(`/api/nodes/merge`, { method: "POST", json: { from: id, into } });
      toast(`Fusionné dans « ${title} »`);
      onChanged({ mergedInto: into });
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api(`/api/nodes/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast("Neurone supprimé");
      onChanged({ deleted: id });
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (edgeId: string) => {
    await api(`/api/edges/${edgeId}`, { method: "DELETE" });
    setDetail({ ...detail, connections: connections.filter((c) => c.edge.id !== edgeId) });
    onChanged();
  };

  const isImage = file?.mime.startsWith("image/");
  const isPdf = file?.mime === "application/pdf";
  const openUrl = node.url;

  return (
    <Shell onClose={onClose}>
      <div className="thin-scroll flex-1 overflow-y-auto px-4 pb-6 pt-1 sm:px-5">
        {/* En-tête */}
        <div className="mb-3 flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{ background: `${meta.color}20`, color: meta.color, boxShadow: `0 0 12px ${meta.color}40` }}
          >
            {meta.emoji} {meta.label}
          </span>
          <span className="text-[11px] text-muted">
            créé {relativeDays(node.created_at)} · actif {relativeDays(node.last_activity_at)} · touché {node.touch_count}×
          </span>
        </div>

        {edit ? (
          <div className="space-y-2.5">
            <Field label="Titre">
              <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="inp" />
            </Field>
            <Field label="Type">
              <select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as NodeType })} className="inp">
                {NODE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Résumé">
              <textarea rows={4} value={edit.summary} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} className="inp" />
            </Field>
            <Field label="Tags (séparés par des virgules)">
              <input value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} className="inp" />
            </Field>
            <Field label="Lien (URL)">
              <input value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} className="inp" placeholder="https://…" />
            </Field>
            {edit.type === "argent" && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Montant">
                  <input inputMode="decimal" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} className="inp" />
                </Field>
                <Field label="Devise">
                  <input value={edit.currency} onChange={(e) => setEdit({ ...edit, currency: e.target.value.toUpperCase() })} className="inp" />
                </Field>
                <Field label="Sens">
                  <select value={edit.direction} onChange={(e) => setEdit({ ...edit, direction: e.target.value })} className="inp">
                    <option value="depense">Dépense</option>
                    <option value="rentree">Rentrée</option>
                  </select>
                </Field>
                <Field label="Catégorie">
                  <input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} className="inp" />
                </Field>
                <Field label="Date">
                  <input type="date" value={edit.occurred_at} onChange={(e) => setEdit({ ...edit, occurred_at: e.target.value })} className="inp" />
                </Field>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button disabled={busy} onClick={save} className="btn-primary">
                Enregistrer
              </button>
              <button onClick={() => setEdit(null)} className="btn-ghost">
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="font-display text-xl font-bold leading-tight" style={{ color: meta.color, textShadow: `0 0 18px ${meta.color}55` }}>
              {node.title}
            </h2>

            {node.type === "argent" && node.amount != null && (
              <p className={`mt-2 font-display text-2xl ${node.direction === "rentree" ? "text-emerald-300" : "text-rose-200"}`}>
                {node.direction === "rentree" ? "+" : "−"}
                {fmtMoney(node.amount, node.currency ?? "CHF")}
                <span className="ml-2 align-middle font-sans text-xs text-muted">
                  {node.category ?? "sans catégorie"} · {(node.occurred_at ?? node.created_at).slice(0, 10)}
                </span>
              </p>
            )}

            {openUrl && (
              <a
                href={openUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-teal-300/40 bg-teal-300/10 px-3 py-1.5 text-sm text-teal-200 hover:bg-teal-300/20"
              >
                Ouvrir {file ? "le fichier" : "le document"} ↗
              </a>
            )}

            {file && (
              <div className="mt-3 overflow-hidden rounded-xl border border-line bg-black/30">
                {isImage ? (
                  <a href={`/api/files/${file.id}`} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/files/${file.id}?thumb=1`} alt={file.original_name} className="max-h-64 w-full object-contain" />
                  </a>
                ) : isPdf ? (
                  <iframe src={`/api/files/${file.id}#toolbar=0&view=FitH`} title={file.original_name} className="h-64 w-full bg-white" />
                ) : (
                  <div className="flex items-center gap-3 p-3 text-sm">
                    <span className="text-2xl">📄</span>
                    <span className="truncate">{file.original_name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-muted">
                  <span className="truncate">{file.original_name}</span>
                  <span>
                    {file.status === "erreur" ? "⚠ analyse impossible" : `${Math.round(file.size / 1024)} Ko`}
                  </span>
                </div>
              </div>
            )}

            {node.summary ? (
              <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-ink/90">{node.summary}</p>
            ) : (
              <p className="mt-3 text-sm italic text-muted">Pas encore de résumé.</p>
            )}

            {node.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {node.tags.map((t) => (
                  <span key={t} className="rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] text-muted">
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={startEdit} className="btn-ghost">
                ✎ Modifier
              </button>
              <button onClick={() => setMerging((m) => !m)} className="btn-ghost">
                ⇄ Fusionner
              </button>
              {confirmDelete ? (
                <span className="flex items-center gap-2 text-sm">
                  <button disabled={busy} onClick={remove} className="rounded-lg bg-rose-500/80 px-3 py-1.5 text-white hover:bg-rose-500">
                    Confirmer
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="text-muted hover:text-ink">
                    Annuler
                  </button>
                </span>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="btn-ghost hover:!border-rose-400/50 hover:!text-rose-200">
                  🗑 Supprimer
                </button>
              )}
            </div>

            {merging && (
              <div className="mt-3 rounded-xl border border-line bg-black/20 p-3 rise">
                <p className="mb-2 text-xs text-muted">
                  Fusionner « {node.title} » <strong>dans</strong> un autre neurone (ses liens, sources et tags y seront rapatriés) :
                </p>
                <input autoFocus value={mergeQuery} onChange={(e) => setMergeQuery(e.target.value)} placeholder="Chercher le neurone cible…" className="inp" />
                <ul className="mt-2 space-y-1">
                  {mergeHits.map((h) => (
                    <li key={h.id}>
                      <button
                        disabled={busy}
                        onClick={() => merge(h.id, h.title)}
                        className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5"
                        style={{ color: TYPE_META[h.type].color }}
                      >
                        {TYPE_META[h.type].emoji} {h.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Connexions */}
        <Section title={`Connexions (${connections.length})`}>
          {connections.length === 0 && <p className="text-sm text-muted">Aucune connexion.</p>}
          <ul className="space-y-1">
            {connections.map(({ edge, other, direction }) => (
              <li key={edge.id} className="group flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 truncate text-[11px] text-muted" title={edge.label}>
                  {direction === "out" ? "→" : "←"} {edge.label}
                </span>
                <button onClick={() => onOpenNode(other.id)} className="truncate text-left hover:underline" style={{ color: TYPE_META[other.type].color }}>
                  {TYPE_META[other.type].emoji} {other.title}
                </button>
                <button
                  onClick={() => unlink(edge.id)}
                  className="ml-auto text-xs text-muted opacity-0 transition hover:text-rose-300 group-hover:opacity-100 max-sm:opacity-60"
                  aria-label="Supprimer ce lien"
                  title="Supprimer ce lien"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </Section>

        {/* Sources */}
        <Section title={`Sources (${sources.length})`}>
          {sources.length === 0 && <p className="text-sm text-muted">{node.origin === "seed" ? "Importé du cerveau de départ." : "Aucune source."}</p>}
          <ul className="space-y-2">
            {sources.map((s) => (
              <li key={s.id} className="rounded-lg border-l-2 border-cyan-400/40 bg-white/[0.03] px-3 py-2">
                <p className="whitespace-pre-wrap text-[13px] leading-snug text-ink/85">« {s.raw_text.length > 600 ? s.raw_text.slice(0, 600) + "…" : s.raw_text} »</p>
                <p className="mt-1 text-[11px] text-muted">
                  {s.kind === "dictee" ? "🎙 dictée" : s.kind === "inbox" ? "📥 dossier inbox" : s.kind === "depot" ? "📎 glisser-déposer" : "⌨ saisie"} ·{" "}
                  {new Date(s.created_at).toLocaleString("fr-CH", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </Shell>
  );
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <aside
      className="glass pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex max-h-[72vh] flex-col rounded-t-3xl slide-in
                 md:inset-x-auto md:bottom-4 md:right-4 md:top-16 md:max-h-none md:w-[400px] md:rounded-3xl"
    >
      <div className="flex items-center justify-between px-4 pt-3 sm:px-5">
        <span className="mx-auto h-1 w-10 rounded-full bg-white/15 md:hidden" />
        <button onClick={onClose} className="absolute right-3 top-2.5 rounded-full p-1.5 text-muted hover:bg-white/5 hover:text-ink" aria-label="Fermer">
          ✕
        </button>
      </div>
      {children}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 font-display text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}
