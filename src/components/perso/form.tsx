"use client";

/** Briques de formulaire des onglets à saisie (budget, projets, études, notes, films). */
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const inputClass = "h-11 w-full min-w-0 rounded-control border-[length:var(--border-width)] border-border bg-surface-2 px-3 text-base text-text placeholder:text-text-2";
export const areaClass = "w-full rounded-control border-[length:var(--border-width)] border-border bg-surface-2 p-3 text-base leading-normal text-text placeholder:text-text-2";

export function Field({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Suppression définitive : on demande confirmation sur place. */
export function ConfirmDelete({ label, question, onConfirm, iconOnly }: { label: string; question: string; onConfirm: () => void; iconOnly?: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button type="button" variant={iconOnly ? "ghost" : "secondary"} size={iconOnly ? "icon" : "md"} aria-label={label} onClick={() => setAsking(true)}>
        <Trash2 aria-hidden />
        {iconOnly ? null : label}
      </Button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      {question}
      <Button type="button" variant="primary" onClick={onConfirm}>
        Oui
      </Button>
      <Button type="button" autoFocus onClick={() => setAsking(false)}>
        Non
      </Button>
    </span>
  );
}

/** Rappel honnête : ces données restent sur l'appareil. */
export function LocalNote() {
  return (
    <p className="text-xs text-text-2">
      Source : tes saisies, enregistrées sur cet appareil uniquement (pas de synchronisation entre appareils). Pense à la sauvegarde dans les Réglages.
    </p>
  );
}

export function Status({ message }: { message: string }) {
  return (
    <p role="status" className="min-h-4 text-xs text-text-2">
      {message}
    </p>
  );
}

export const STORAGE_ERROR = "Enregistrement impossible : le stockage de ce navigateur est plein ou bloqué.";
