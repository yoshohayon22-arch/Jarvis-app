"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TYPE_META, type ForgottenResult } from "@/lib/types";

export default function ForgottenCard({ onOpenNode, refreshKey }: { onOpenNode: (id: string) => void; refreshKey: number }) {
  const [data, setData] = useState<ForgottenResult | null>(null);
  const [hidden, setHidden] = useState(true);
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem("cerveau:oublie-masque") === today);
    } catch {
      setHidden(false);
    }
  }, [today]);

  useEffect(() => {
    api<ForgottenResult>("/api/forgotten").then(setData).catch(() => setData(null));
  }, [refreshKey]);

  if (hidden || !data?.node) return null;
  const meta = TYPE_META[data.node.type];

  return (
    <div className="pointer-events-auto glass rise w-full max-w-md rounded-2xl px-3 py-2 sm:p-3">
      <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-amber-200/80">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-300 pulse-dot" />
        Neurone oublié du jour
        <button
          className="ml-auto rounded-full px-1.5 text-muted normal-case tracking-normal hover:text-ink"
          onClick={() => {
            try {
              localStorage.setItem("cerveau:oublie-masque", today);
            } catch {}
            setHidden(true);
          }}
          aria-label="Masquer pour aujourd'hui"
        >
          ✕
        </button>
      </div>
      <button onClick={() => onOpenNode(data.node!.id)} className="text-left">
        <span className="font-display text-sm font-bold" style={{ color: meta.color }}>
          {meta.emoji} {data.node.title}
        </span>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink/90 sm:line-clamp-none">{data.sentence}</p>
      </button>
      <div className="mt-1.5 flex gap-3 text-[12px] sm:mt-2">
        <button onClick={() => onOpenNode(data.node!.id)} className="text-cyan-300 hover:underline">
          Voir sur la carte
        </button>
        <button
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              setData(await api<ForgottenResult>("/api/forgotten?refresh=1"));
            } finally {
              setLoading(false);
            }
          }}
          className="text-muted hover:text-ink disabled:opacity-50"
        >
          {loading ? "…" : "Un autre"}
        </button>
      </div>
    </div>
  );
}
