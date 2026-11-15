"use client";

/** Connexion par mot de passe (phrase de passe personnelle). */
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useMotionPreset } from "@/lib/motion/use-motion-preset";

const MESSAGES: Record<string, string> = {
  absent: "Aucun mot de passe n'est encore configuré sur ce serveur.",
  config: "La connexion n'est pas encore configurée sur ce serveur.",
  incorrect: "Mot de passe incorrect.",
};

export function PasswordLoginCard() {
  const router = useRouter();
  const preset = useMotionPreset();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setPending(true);
    const res = await fetch("/auth/mot-de-passe/connexion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motDePasse: password }),
    }).catch(() => null);
    if (res?.ok) {
      router.replace("/");
      router.refresh();
      return;
    }
    const data = res ? ((await res.json().catch(() => null)) as { erreur?: string; minutes?: number } | null) : null;
    setPending(false);
    setPassword("");
    setMessage(
      data?.erreur === "bloque"
        ? `Trop d'essais : la connexion est bloquée pendant ${data.minutes ?? 15} minutes.`
        : (MESSAGES[data?.erreur ?? ""] ?? "La connexion a échoué. Réessaie dans un instant."),
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={preset.page}
      className="card flex w-full max-w-sm flex-col gap-6 p-7"
    >
      <div>
        <h1 className="text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-text-2">Espace privé, réservé à son propriétaire.</p>
      </div>

      {message ? (
        <p role="alert" className="rounded-control border-[length:var(--border-width)] border-border bg-accent-soft px-3 py-2 text-sm text-text">
          {message}
        </p>
      ) : null}

      <form onSubmit={login} className="flex flex-col gap-3">
        <label htmlFor="mdp" className="text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="mdp"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 w-full rounded-control border-[length:var(--border-width)] border-border bg-surface-2 px-3 text-base text-text placeholder:text-text-2"
        />
        <Button type="submit" variant="primary" disabled={pending} className="w-full">
          {pending ? "Vérification…" : "Se connecter"}
        </Button>
      </form>
    </motion.div>
  );
}
