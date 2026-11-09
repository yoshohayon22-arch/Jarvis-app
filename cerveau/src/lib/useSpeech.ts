"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API (Chrome, Edge, Safari). Absente de Firefox : le bouton micro est alors masqué.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

export function useSpeech(onText: (text: string, final: boolean) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const start = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      cb.current((finalText + interim).trim(), false);
    };
    rec.onerror = (e) => setError(e.error === "not-allowed" ? "Micro refusé par le navigateur" : `Dictée : ${e.error}`);
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) cb.current(finalText.trim(), true);
    };
    recRef.current = rec;
    setError(null);
    setListening(true);
    rec.start();
  }, []);

  const stop = useCallback(() => recRef.current?.stop(), []);
  return { supported, listening, error, start, stop };
}
