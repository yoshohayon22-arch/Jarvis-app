"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { normalize } from "@/lib/text";
import { NODE_TYPES, TYPE_META, type AskResult, type CaptureResult, type GraphNode, type GraphPayload, type NodeType } from "@/lib/types";
import AnswerCard from "./AnswerCard";
import CommandBar, { type Mode } from "./CommandBar";
import ForgottenCard from "./ForgottenCard";
import NodePanel from "./NodePanel";

const BrainGraph = dynamic(() => import("./BrainGraph"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center">
      <span className="font-display text-sm tracking-[0.3em] text-cyan-300/70 glow-text">INITIALISATION…</span>
    </div>
  ),
});

type Status = { version: string; ai: boolean; mock: boolean; model: string; inboxPending: number };
type Toast = { id: number; msg: string; kind: "ok" | "err" };

export default function BrainApp() {
  const [graph, setGraph] = useState<GraphPayload>({ nodes: [], links: [] });
  const [version, setVersion] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [born, setBorn] = useState<Map<string, number>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string | null; tick: number }>({ id: null, tick: 0 });
  const [hiddenTypes, setHiddenTypes] = useState<Set<NodeType>>(new Set());
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<Mode>("saisie");
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<{ question: string; result: AskResult | null; loading: boolean } | null>(null);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [forgottenKey, setForgottenKey] = useState(0);
  const knownIds = useRef<Set<string> | null>(null);
  const versionRef = useRef("");
  const importRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const toast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 7000 : 4000);
  }, []);

  /** Recharge la carte ; les neurones et liens nouveaux « naissent » (animation). */
  const loadGraph = useCallback(async () => {
    const g = await api<GraphPayload & { version: string }>("/api/graph");
    const now = performance.now();
    if (knownIds.current) {
      const fresh = [...g.nodes.map((n) => n.id), ...g.links.map((l) => l.id)].filter((id) => !knownIds.current!.has(id));
      if (fresh.length) {
        setBorn((prev) => {
          const next = new Map([...prev].filter(([, t]) => now - t < 5000));
          fresh.forEach((id, i) => next.set(id, now + (g.links.some((l) => l.id === id) ? 500 : 0) + i * 60));
          return next;
        });
      }
    }
    knownIds.current = new Set([...g.nodes.map((n) => n.id), ...g.links.map((l) => l.id)]);
    setGraph({ nodes: g.nodes, links: g.links });
    setVersion(g.version);
    versionRef.current = g.version;
    return g;
  }, []);

  useEffect(() => {
    loadGraph().catch((e) => toast(`Carte indisponible : ${e.message}`, "err"));
  }, [loadGraph, toast]);

  // Surveille les changements (fichiers déposés dans /inbox, autre onglet…).
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const s = await api<Status>("/api/status");
        if (!alive) return;
        setStatus(s);
        if (versionRef.current && s.version !== versionRef.current) loadGraph().catch(() => {});
      } catch {
        /* hors ligne */
      }
    };
    tick();
    const t = setInterval(tick, 6000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [loadGraph]);

  const openNode = useCallback((id: string) => {
    setSelectedId(id);
    setFocus((f) => ({ id, tick: f.tick + 1 }));
  }, []);

  const searchMatches = useMemo(() => {
    const q = normalize(search);
    if (q.length < 2) return null;
    return new Set(graph.nodes.filter((n) => normalize(`${n.title} ${n.tags.join(" ")}`).includes(q)).map((n) => n.id));
  }, [search, graph.nodes]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(NODE_TYPES.map((t) => [t, 0])) as Record<NodeType, number>;
    graph.nodes.forEach((n) => c[n.type]++);
    return c;
  }, [graph.nodes]);

  const onSubmit = async (text: string, { dictated }: { dictated: boolean }) => {
    setBusy(true);
    try {
      if (mode === "saisie") {
        const r = await api<CaptureResult>("/api/capture", { method: "POST", json: { text, kind: dictated ? "dictee" : "saisie" } });
        await loadGraph();
        const parts = [];
        if (r.created.length) parts.push(`${r.created.length} nouveau${r.created.length > 1 ? "x" : ""} neurone${r.created.length > 1 ? "s" : ""}`);
        if (r.updated.length) parts.push(`${r.updated.length} enrichi${r.updated.length > 1 ? "s" : ""}`);
        if (r.edges.length) parts.push(`${r.edges.length} lien${r.edges.length > 1 ? "s" : ""}`);
        toast(`${r.message ? r.message + " · " : ""}${parts.join(" · ") || "Rangé"}`, r.fallback && !r.message?.startsWith("Mode test") ? "err" : "ok");
        const first = r.created[0] ?? r.updated[0];
        if (first) setTimeout(() => setFocus((f) => ({ id: first, tick: f.tick + 1 })), 250);
        setHighlight(new Set([...r.created, ...r.updated]));
        setTimeout(() => setHighlight(new Set()), 4500);
      } else {
        setAsk({ question: text, result: null, loading: true });
        setSelectedId(null);
        const r = await api<AskResult>("/api/ask", { method: "POST", json: { question: text } });
        setAsk({ question: text, result: r, loading: false });
        setHighlight(new Set(r.cited.map((c) => c.id)));
        loadGraph().catch(() => {});
      }
      return true;
    } catch (e) {
      toast((e as Error).message, "err");
      if (mode === "question") setAsk(null);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onNodeClick = (n: GraphNode) => {
    // Les neurones « document » avec un lien s'ouvrent dans un nouvel onglet (et le panneau s'ouvre aussi).
    if (n.type === "document" && n.url) window.open(n.url, "_blank", "noopener,noreferrer");
    setSelectedId(n.id);
  };

  // ----- Glisser-déposer de fichiers sur la carte -----
  const uploadFiles = async (files: FileList | File[]) => {
    const list = [...files];
    if (!list.length) return;
    toast(`Analyse de ${list.length} fichier${list.length > 1 ? "s" : ""}…`);
    const fd = new FormData();
    list.forEach((f) => fd.append("files", f));
    try {
      const r = await api<{ results: { name: string; error?: string; message?: string; fallback?: boolean; created?: string[]; docNodeId?: string | null; duplicate?: boolean }[] }>(
        "/api/upload",
        { method: "POST", body: fd },
      );
      await loadGraph();
      for (const x of r.results) {
        if (x.error) toast(`${x.name} : ${x.error}`, "err");
        else if (x.duplicate) toast(`${x.name} : déjà dans ton cerveau`);
        else toast(`${x.name} : ${x.created?.length ?? 0} neurone(s)${x.message ? ` — ${x.message}` : ""}`, x.fallback ? "err" : "ok");
      }
      const doc = r.results.find((x) => x.docNodeId)?.docNodeId;
      if (doc) openNode(doc);
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const onImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const replace = window.confirm(
        "Importer cette sauvegarde.\n\nOK = REMPLACER tout le cerveau actuel\nAnnuler = FUSIONNER avec le cerveau actuel (sans doublon)",
      );
      const r = await api<{ nodes: number; edges: number }>(`/api/backup?mode=${replace ? "remplacer" : "fusion"}`, { method: "POST", json: data });
      knownIds.current = null;
      await loadGraph();
      toast(`Import réussi : ${r.nodes} neurones, ${r.edges} liens ajoutés`);
    } catch (e) {
      toast(`Import impossible : ${(e as Error).message}`, "err");
    }
  };

  const toggleType = (t: NodeType) =>
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  return (
    <main
      className="fixed inset-0 overflow-hidden"
      onDragEnter={(e) => {
        if (![...e.dataTransfer.types].includes("Files")) return;
        dragDepth.current++;
        setDragging(true);
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
      }}
    >
      <div className="holo-grid pointer-events-none absolute inset-0" />

      <BrainGraph
        data={graph}
        hiddenTypes={hiddenTypes}
        searchMatches={searchMatches}
        highlight={highlight}
        born={born}
        selectedId={selectedId}
        focusId={focus.id}
        focusTick={focus.tick}
        onNodeClick={onNodeClick}
        onBackgroundClick={() => setSelectedId(null)}
      />

      {/* Haut : titre, recherche, filtres, neurone oublié */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 px-3 pt-safe md:px-5">
        <div className="pointer-events-auto flex items-center gap-3">
          <h1 className="flex items-center gap-2 font-display text-base font-black tracking-[0.25em] text-cyan-200 glow-text sm:text-lg">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_#38e1ff] pulse-dot" />
            LE CERVEAU
          </h1>
          <span className="hidden text-[11px] text-muted sm:inline">
            {graph.nodes.length} neurones · {graph.links.length} liens
          </span>
          <div className="ml-auto flex items-center gap-2">
            <div className="glass hidden items-center rounded-full px-3 py-1.5 sm:flex">
              <span className="mr-2 text-muted">⌕</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchMatches?.size) openNode([...searchMatches][0]);
                  if (e.key === "Escape") setSearch("");
                }}
                placeholder="Chercher un neurone"
                className="w-44 bg-transparent text-sm text-ink placeholder:text-muted/70 focus:outline-none lg:w-60"
              />
              {searchMatches && <span className="ml-2 text-[11px] text-cyan-300">{searchMatches.size}</span>}
            </div>
            <Link href="/argent" className="glass rounded-full px-3 py-1.5 text-sm text-emerald-200 hover:text-emerald-100">
              💰 <span className="hidden sm:inline">Argent</span>
            </Link>
            <div className="relative">
              <button onClick={() => setMenuOpen((m) => !m)} className="glass rounded-full px-3 py-1.5 text-sm text-ink" aria-label="Menu">
                ⋯
              </button>
              {menuOpen && (
                <div className="glass absolute right-0 mt-2 w-64 rounded-2xl p-2 text-sm rise" onMouseLeave={() => setMenuOpen(false)}>
                  <a href="/api/backup" className="block rounded-lg px-3 py-2 hover:bg-white/5" onClick={() => setMenuOpen(false)}>
                    ⬇ Exporter le cerveau (JSON)
                  </a>
                  <button className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5" onClick={() => importRef.current?.click()}>
                    ⬆ Importer une sauvegarde
                  </button>
                  <label className="block cursor-pointer rounded-lg px-3 py-2 hover:bg-white/5">
                    📎 Ajouter des fichiers…
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.gif,.txt,.md"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) uploadFiles(e.target.files);
                        e.target.value = "";
                        setMenuOpen(false);
                      }}
                    />
                  </label>
                  <button
                    className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5"
                    onClick={async () => {
                      setMenuOpen(false);
                      const r = await api<{ processed: number; errors: string[] }>("/api/inbox", { method: "POST" });
                      await loadGraph();
                      toast(r.processed ? `${r.processed} fichier(s) de /inbox rangé(s)` : "Rien de nouveau dans /inbox");
                      r.errors.forEach((er) => toast(er, "err"));
                    }}
                  >
                    📥 Analyser le dossier /inbox
                  </button>
                  <div className="mt-1 border-t border-line px-3 pt-2 text-[11px] leading-relaxed text-muted">
                    IA : {status ? (status.ai ? `active (${status.model})` : status.mock ? "mode test simulé" : "inactive — ajoute ANTHROPIC_API_KEY") : "…"}
                    {status?.inboxPending ? <> · {status.inboxPending} fichier(s) en attente</> : null}
                  </div>
                </div>
              )}
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                  e.target.value = "";
                  setMenuOpen(false);
                }}
              />
            </div>
          </div>
        </div>

        {/* Recherche mobile */}
        <div className="pointer-events-auto glass flex items-center rounded-full px-3 py-1.5 sm:hidden">
          <span className="mr-2 text-muted">⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchMatches?.size && openNode([...searchMatches][0])}
            placeholder="Chercher un neurone"
            className="flex-1 bg-transparent text-[16px] text-ink placeholder:text-muted/70 focus:outline-none"
          />
          {searchMatches && <span className="ml-2 text-[11px] text-cyan-300">{searchMatches.size}</span>}
        </div>

        <div className="no-scrollbar pointer-events-auto -mx-3 flex gap-1.5 overflow-x-auto px-3 md:mx-0 md:flex-wrap md:px-0">
          {NODE_TYPES.filter((t) => counts[t] > 0).map((t) => {
            const off = hiddenTypes.has(t);
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                onDoubleClick={() => setHiddenTypes(new Set(NODE_TYPES.filter((x) => x !== t)))}
                title="Clic : afficher/masquer · double-clic : seulement ce type"
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[12px] transition ${off ? "opacity-35" : ""}`}
                style={{
                  borderColor: `${TYPE_META[t].color}55`,
                  color: TYPE_META[t].color,
                  background: off ? "transparent" : `${TYPE_META[t].color}14`,
                }}
              >
                {TYPE_META[t].emoji} {TYPE_META[t].label} <span className="opacity-60">{counts[t]}</span>
              </button>
            );
          })}
          {hiddenTypes.size > 0 && (
            <button onClick={() => setHiddenTypes(new Set())} className="shrink-0 px-2 text-[12px] text-muted hover:text-ink">
              Tout afficher
            </button>
          )}
        </div>

        <div className={selectedId ? "hidden md:block" : ""}>
          <ForgottenCard onOpenNode={openNode} refreshKey={forgottenKey} />
        </div>
      </header>

      {/* Bas : réponse + barre de saisie */}
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 ${selectedId ? "max-md:hidden md:pr-[420px]" : ""}`}>
        {ask && (
          <AnswerCard
            question={ask.question}
            result={ask.result}
            loading={ask.loading}
            onClose={() => {
              setAsk(null);
              setHighlight(new Set());
            }}
            onOpenNode={openNode}
          />
        )}
        <CommandBar mode={mode} onModeChange={setMode} busy={busy} onSubmit={onSubmit} />
      </div>

      {selectedId && (
        <NodePanel
          id={selectedId}
          version={version}
          onClose={() => setSelectedId(null)}
          onOpenNode={openNode}
          toast={toast}
          onChanged={async (o) => {
            if (o?.deleted) setSelectedId(null);
            if (o?.mergedInto) openNode(o.mergedInto);
            await loadGraph();
            setForgottenKey((k) => k + 1);
          }}
        />
      )}

      {/* Toasts */}
      <div className="pointer-events-none fixed left-1/2 top-24 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2 md:top-20">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`glass rise rounded-xl px-4 py-2.5 text-sm ${t.kind === "err" ? "border-rose-400/40 text-rose-100" : "text-cyan-50"}`}
          >
            {t.msg}
          </div>
        ))}
      </div>

      {/* Zone de dépôt */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-cyan-400/5 backdrop-blur-[2px]">
          <div className="rounded-3xl border-2 border-dashed border-cyan-300/70 px-10 py-8 text-center glow-ring">
            <p className="font-display text-lg tracking-widest text-cyan-200 glow-text">DÉPOSE TES FICHIERS</p>
            <p className="mt-1 text-sm text-muted">PDF, Word, images, captures d&apos;écran → neurones</p>
          </div>
        </div>
      )}

      {graph.nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
          <p className="max-w-sm text-sm text-muted">Ton cerveau est vide. Écris une première info en bas, ou dépose un fichier sur l&apos;écran.</p>
        </div>
      )}
    </main>
  );
}
