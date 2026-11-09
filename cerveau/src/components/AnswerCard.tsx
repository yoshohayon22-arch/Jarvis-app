"use client";

import { Fragment } from "react";
import { TYPE_META, type AskResult } from "@/lib/types";

interface Props {
  question: string;
  result: AskResult | null;
  loading: boolean;
  onClose: () => void;
  onOpenNode: (id: string) => void;
}

/** Remplace les [id] de la réponse par des puces cliquables. */
function renderAnswer(text: string, result: AskResult, onOpenNode: (id: string) => void) {
  const byId = new Map(result.cited.map((c) => [c.id, c]));
  const parts = text.split(/(\[[a-z0-9][a-z0-9_-]*\])/gi);
  return parts.map((p, i) => {
    const m = /^\[([a-z0-9][a-z0-9_-]*)\]$/i.exec(p);
    const c = m ? byId.get(m[1]) : undefined;
    if (!m) return <Fragment key={i}>{p}</Fragment>;
    if (!c) return null;
    return (
      <button
        key={i}
        onClick={() => onOpenNode(c.id)}
        className="mx-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 align-baseline text-[12px] font-medium"
        style={{ background: `${TYPE_META[c.type].color}22`, color: TYPE_META[c.type].color }}
      >
        {c.title}
      </button>
    );
  });
}

export default function AnswerCard({ question, result, loading, onClose, onOpenNode }: Props) {
  return (
    <div className="pointer-events-auto mx-auto mb-2 w-full max-w-3xl px-3 rise">
      <div className="glass thin-scroll max-h-[42vh] overflow-y-auto rounded-2xl p-4 shadow-[0_0_30px_rgba(167,139,250,.15)]">
        <div className="mb-2 flex items-start gap-2">
          <span className="mt-0.5 text-violet-300">◈</span>
          <p className="flex-1 text-sm text-muted">{question}</p>
          <button onClick={onClose} className="rounded-full px-2 text-muted hover:text-ink" aria-label="Fermer la réponse">
            ✕
          </button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-violet-200">
            <span className="h-2 w-2 rounded-full bg-violet-300 pulse-dot" />
            Je fouille ton cerveau…
          </div>
        ) : result ? (
          <>
            <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{renderAnswer(result.answer, result, onOpenNode)}</div>
            {result.cited.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                <span className="text-[11px] uppercase tracking-wider text-muted">Neurones cités</span>
                {result.cited.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onOpenNode(c.id)}
                    className="rounded-full border px-2 py-0.5 text-[12px] transition hover:bg-white/5"
                    style={{ borderColor: `${TYPE_META[c.type].color}66`, color: TYPE_META[c.type].color }}
                  >
                    {TYPE_META[c.type].emoji} {c.title}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
