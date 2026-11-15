"use client";

/** Carte de connexion : Google uniquement (un seul compte autorisé). */
import { motion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useMotionPreset } from "@/lib/motion/use-motion-preset";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const ERRORS: Record<string, string> = {
  refuse: "Ce compte n'est pas autorisé. Seul le compte du propriétaire peut se connecter.",
  code: "La connexion a été interrompue. Réessaie.",
  config: "La connexion n'est pas encore configurée sur ce serveur (variables Supabase manquantes).",
};

function GoogleLogo() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9Z" />
    </svg>
  );
}

export function LoginCard() {
  const params = useSearchParams();
  const error = params.get("erreur");
  const [pending, setPending] = useState(false);
  const preset = useMotionPreset();

  const signIn = async () => {
    const supabasePromise = getSupabaseBrowserClient();
    if (!supabasePromise) return;
    setPending(true);
    const supabase = await supabasePromise;
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Seulement l'identité pour l'instant ; les droits Gmail seront demandés en Phase 2.
        scopes: "openid email profile",
        queryParams: { prompt: "select_account" },
      },
    });
    if (err) setPending(false);
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
        <p className="mt-1 text-sm text-text-2">Espace privé. Connexion avec ton compte Google.</p>
      </div>

      {error && ERRORS[error] ? (
        <p role="alert" className="rounded-control border-[length:var(--border-width)] border-border bg-accent-soft px-3 py-2 text-sm text-text">
          {ERRORS[error]}
        </p>
      ) : null}

      {isSupabaseConfigured ? (
        <Button variant="primary" onClick={signIn} disabled={pending} className="w-full">
          <GoogleLogo />
          {pending ? "Redirection vers Google…" : "Continuer avec Google"}
        </Button>
      ) : (
        <div className="flex flex-col gap-3 text-sm text-text-2">
          <p>Supabase n&apos;est pas encore configuré : la connexion est désactivée.</p>
          {process.env.NODE_ENV !== "production" ? (
            <Link href="/" className="font-medium text-text underline underline-offset-4">
              Ouvrir en mode local
            </Link>
          ) : null}
        </div>
      )}
    </motion.div>
  );
}
