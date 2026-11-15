"use client";

/**
 * Connexion par mot de passe.
 * - Avec le lien de première connexion (?jeton=…) : choix du mot de passe (une seule fois).
 * - Ensuite : simple saisie du mot de passe.
 */
import { motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/session";
import { useMotionPreset } from "@/lib/motion/use-motion-preset";

const inputClass =
  "h-12 w-full rounded-control border-[length:var(--border-width)] border-border bg-surface-2 px-3 text-base text-text placeholder:text-text-2";

export function PasswordLoginCard() {
  const params = useSearchParams();
  const router = useRouter();
  const preset = useMotionPreset();
  const setupToken = params.get("jeton");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const enter = () => {
    router.replace("/");
    router.refresh();
  };

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(
      () => null,
    );
    const data = res ? ((await res.json().catch(() => null)) as { erreur?: string; minutes?: number } | null) : null;
    return { ok: Boolean(res?.ok), erreur: data?.erreur, minutes: data?.minutes };
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (password.length < MIN_PASSWORD_LENGTH) return setMessage(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`);
    if (password !== confirm) return setMessage("Les deux mots de passe ne sont pas identiques.");
    setPending(true);
    const result = await post("/auth/mot-de-passe/creer", { jeton: setupToken, motDePasse: password });
    if (result.ok) return enter();
    setPending(false);
    setMessage(
      result.erreur === "lien"
        ? "Ce lien de première connexion n'est plus valable (il ne sert qu'une fois). Connecte-toi avec ton mot de passe."
        : result.erreur === "config"
          ? "La connexion n'est pas encore configurée sur ce serveur."
          : "L'enregistrement a échoué (stockage indisponible). Réessaie dans un instant.",
    );
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setPending(true);
    const result = await post("/auth/mot-de-passe/connexion", { motDePasse: password });
    if (result.ok) return enter();
    setPending(false);
    setPassword("");
    setMessage(
      result.erreur === "bloque"
        ? `Trop d'essais : la connexion est bloquée pendant ${result.minutes ?? 15} minutes.`
        : result.erreur === "absent"
          ? "Aucun mot de passe n'a encore été choisi. Utilise le lien de première connexion."
          : result.erreur === "config"
            ? "La connexion n'est pas encore configurée sur ce serveur."
            : result.erreur === "stockage"
              ? "La vérification a échoué (stockage indisponible). Réessaie dans un instant."
              : "Mot de passe incorrect.",
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
        <p className="mt-1 text-sm text-text-2">
          {setupToken ? "Première connexion : choisis ton mot de passe." : "Espace privé, réservé à son propriétaire."}
        </p>
      </div>

      {message ? (
        <p role="alert" className="rounded-control border-[length:var(--border-width)] border-border bg-accent-soft px-3 py-2 text-sm text-text">
          {message}
        </p>
      ) : null}

      {setupToken ? (
        <form onSubmit={create} className="flex flex-col gap-3">
          <label htmlFor="nouveau" className="text-sm font-medium">
            Nouveau mot de passe
          </label>
          <input
            id="nouveau"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="aide-mdp"
            className={inputClass}
          />
          <p id="aide-mdp" className="text-xs text-text-2">
            Au moins {MIN_PASSWORD_LENGTH} caractères. Une phrase de plusieurs mots est facile à retenir et difficile à deviner.
          </p>
          <label htmlFor="confirmation" className="text-sm font-medium">
            Confirme le mot de passe
          </label>
          <input
            id="confirmation"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
          <Button type="submit" variant="primary" disabled={pending} className="w-full">
            {pending ? "Enregistrement…" : "Enregistrer et entrer"}
          </Button>
        </form>
      ) : (
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
            className={inputClass}
          />
          <Button type="submit" variant="primary" disabled={pending} className="w-full">
            {pending ? "Vérification…" : "Se connecter"}
          </Button>
        </form>
      )}
    </motion.div>
  );
}
