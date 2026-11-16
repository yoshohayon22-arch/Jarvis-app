"use client";

/** Sauvegarde des données enregistrées sur l'appareil (budget, projets, écoles, notes, films) : export et restauration d'un fichier. */
import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LOCAL_PREFIX, notifyLocalData, today } from "@/lib/local/store";

const KEYS = ["budget", "projets", "etudes", "cerveau", "films", "youtube", "musique"];

export function BackupSection() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function exportData() {
    const data: Record<string, unknown> = {};
    try {
      for (const key of KEYS) {
        const raw = localStorage.getItem(LOCAL_PREFIX + key);
        if (raw) data[key] = JSON.parse(raw);
      }
    } catch {
      return setMessage("Lecture impossible : le stockage de ce navigateur est bloqué.");
    }
    if (!Object.keys(data).length) return setMessage("Rien à sauvegarder : aucune donnée n'est enregistrée sur cet appareil.");
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: "dashboard-sauvegarde-1", date: today(), data }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `dashboard-sauvegarde-${today()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setMessage("Fichier de sauvegarde créé. Garde-le en lieu sûr (Fichiers, iCloud…).");
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { format?: string; data?: Record<string, unknown> };
      const data = parsed?.data;
      if (parsed?.format !== "dashboard-sauvegarde-1" || !data || typeof data !== "object") throw new Error("format");
      const kept = Object.fromEntries(Object.entries(data).filter(([key]) => KEYS.includes(key)));
      if (!Object.keys(kept).length) throw new Error("vide");
      setPending(kept);
      setMessage("");
    } catch {
      setMessage("Ce fichier n'est pas une sauvegarde du Dashboard.");
    }
  }

  function restore() {
    if (!pending) return;
    try {
      for (const [key, value] of Object.entries(pending)) localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(value));
    } catch {
      return setMessage("Restauration impossible : le stockage de ce navigateur est plein ou bloqué.");
    }
    notifyLocalData();
    setMessage(`Sauvegarde restaurée (${Object.keys(pending).join(", ")}).`);
    setPending(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={exportData}>
          <Download aria-hidden />
          Télécharger une sauvegarde
        </Button>
        <Button onClick={() => fileRef.current?.click()}>
          <Upload aria-hidden />
          Restaurer une sauvegarde
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void readFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {pending ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          Remplacer les données actuelles de cet appareil ({Object.keys(pending).join(", ")}) par celles du fichier ?
          <Button variant="primary" onClick={restore}>
            Oui, remplacer
          </Button>
          <Button autoFocus onClick={() => setPending(null)}>
            Non
          </Button>
        </p>
      ) : null}
      <p role="status" className="text-xs text-text-2">
        {message}
      </p>
    </div>
  );
}
