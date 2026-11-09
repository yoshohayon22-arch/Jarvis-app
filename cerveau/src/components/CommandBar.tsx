"use client";

import { useEffect, useRef, useState } from "react";
import { useSpeech } from "@/lib/useSpeech";

export type Mode = "saisie" | "question";

interface Props {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  busy: boolean;
  onSubmit: (text: string, opts: { dictated: boolean }) => Promise<boolean>;
}

const PLACEHOLDERS: Record<Mode, string> = {
  saisie: "Jette une info… « payé 40 CHF de resto », « idée : coffrets de vin pour Noël »",
  question: "Demande à ton cerveau… « qu'est-ce que je sais sur le Standard de Liège ? »",
};

export default function CommandBar({ mode, onModeChange, busy, onSubmit }: Props) {
  const [text, setText] = useState("");
  const [dictated, setDictated] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const speech = useSpeech((t) => {
    setText(t);
    setDictated(true);
  });

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [text]);

  // Raccourci : « / » pour écrire, « ? » pour une question.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key === "/") {
        e.preventDefault();
        onModeChange("saisie");
        taRef.current?.focus();
      } else if (e.key === "?") {
        e.preventDefault();
        onModeChange("question");
        taRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onModeChange]);

  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    if (speech.listening) speech.stop();
    const okSubmit = await onSubmit(t, { dictated });
    if (okSubmit) {
      setText("");
      setDictated(false);
    }
  };

  const accent = mode === "saisie" ? "from-cyan-400/70 to-sky-500/70" : "from-violet-400/70 to-fuchsia-500/70";

  return (
    <div className="pointer-events-auto mx-auto w-full max-w-3xl px-3 pb-safe">
      <div className="mb-2 flex items-center gap-1.5">
        {(["saisie", "question"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              onModeChange(m);
              taRef.current?.focus();
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium tracking-wide transition ${
              mode === m
                ? m === "saisie"
                  ? "bg-cyan-400/15 text-cyan-200 glow-ring"
                  : "bg-violet-400/15 text-violet-200 shadow-[0_0_0_1px_rgba(167,139,250,.5),0_0_18px_rgba(167,139,250,.35)]"
                : "text-muted hover:text-ink"
            }`}
          >
            {m === "saisie" ? "✦ Saisie" : "◈ Question"}
          </button>
        ))}
        <span className="ml-auto hidden text-[11px] text-muted sm:inline">« / » saisie · « ? » question · Entrée pour envoyer</span>
      </div>

      <div className={`relative rounded-2xl bg-gradient-to-r p-[1px] ${accent} ${busy ? "scanline" : ""}`}>
        <div className="glass flex items-end gap-2 rounded-2xl px-3 py-2">
          <textarea
            ref={taRef}
            value={text}
            rows={1}
            onChange={(e) => {
              setText(e.target.value);
              if (!e.target.value) setDictated(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={speech.listening ? "Je t'écoute…" : PLACEHOLDERS[mode]}
            className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-[16px] leading-snug text-ink placeholder:text-muted/70 focus:outline-none"
            aria-label={mode === "saisie" ? "Nouvelle info" : "Question"}
            enterKeyHint="send"
          />
          {speech.supported && (
            <button
              type="button"
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              className={`mb-1 grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${
                speech.listening ? "bg-rose-500/25 text-rose-200 shadow-[0_0_18px_rgba(244,63,94,.6)]" : "text-muted hover:bg-white/5 hover:text-ink"
              }`}
              aria-label={speech.listening ? "Arrêter la dictée" : "Dicter"}
              title="Dicter (fr-FR)"
            >
              {speech.listening ? (
                <span className="h-3 w-3 rounded-sm bg-rose-300 pulse-dot" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
                </svg>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={busy || !text.trim()}
            className={`mb-1 grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold transition disabled:opacity-30 ${
              mode === "saisie" ? "bg-cyan-400/90 text-slate-950 hover:bg-cyan-300" : "bg-violet-400/90 text-slate-950 hover:bg-violet-300"
            }`}
            aria-label="Envoyer"
          >
            {busy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {speech.error && <p className="mt-1 text-xs text-rose-300">{speech.error}</p>}
    </div>
  );
}
