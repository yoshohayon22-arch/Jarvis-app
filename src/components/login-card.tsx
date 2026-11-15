"use client";

/** Carte de connexion : code à usage unique par email, et Google quand il est configuré (un seul compte autorisé). */
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

/** Le bouton Google n'apparaît que lorsque Google Cloud est configuré (variable NEXT_PUBLIC_GOOGLE_LOGIN=1). */
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1";

const inputClass =
  "h-12 w-full rounded-control border-[length:var(--border-width)] border-border bg-surface-2 px-3 text-base text-text placeholder:text-text-2";

export function LoginCard() {
  const params = useSearchParams();
  const urlError = params.get("erreur");
  const preset = useMotionPreset();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    const supabasePromise = getSupabaseBrowserClient();
    if (!supabasePromise) return;
    setPending(true);
    const supabase = await supabasePromise;
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "openid email profile",
        queryParams: { prompt: "select_account" },
      },
    });
    if (err) setPending(false);
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const res = await fetch("/auth/code/envoyer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setPending(false);
    if (res?.ok) {
      setStep("code");
    } else if (res?.status === 429) {
      setMessage("Trop de demandes : attends quelques minutes avant de redemander un code.");
    } else {
      setMessage("L'envoi du code a échoué. Réessaie dans un instant.");
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const res = await fetch("/auth/code/verifier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    }).catch(() => null);
    if (res?.ok) {
      router.replace("/");
      router.refresh();
      return;
    }
    setPending(false);
    setMessage("Code incorrect ou expiré. Vérifie le dernier email reçu ou redemande un code.");
  };

  const alert = message ?? (urlError ? ERRORS[urlError] : null);

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

      {alert ? (
        <p role="alert" className="rounded-control border-[length:var(--border-width)] border-border bg-accent-soft px-3 py-2 text-sm text-text">
          {alert}
        </p>
      ) : null}

      {!isSupabaseConfigured ? (
        <div className="flex flex-col gap-3 text-sm text-text-2">
          <p>Supabase n&apos;est pas encore configuré : la connexion est désactivée.</p>
          {process.env.NODE_ENV !== "production" ? (
            <Link href="/" className="font-medium text-text underline underline-offset-4">
              Ouvrir en mode local
            </Link>
          ) : null}
        </div>
      ) : step === "email" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-medium">
            Ton adresse email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom@exemple.com"
            className={inputClass}
          />
          <Button type="submit" variant="primary" disabled={pending} className="w-full">
            {pending ? "Envoi…" : "Recevoir un code par email"}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="flex flex-col gap-3">
          <p className="text-sm text-text-2">
            Si cette adresse est autorisée, un code vient d&apos;être envoyé. Il est valable quelques minutes (pense à regarder les spams).
          </p>
          <label htmlFor="code" className="text-sm font-medium">
            Code reçu par email
          </label>
          <input
            id="code"
            required
            autoFocus
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9 ]{6,12}"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className={`${inputClass} text-center text-xl tracking-[0.3em]`}
          />
          <Button type="submit" variant="primary" disabled={pending} className="w-full">
            {pending ? "Vérification…" : "Se connecter"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setStep("email");
              setCode("");
              setMessage(null);
            }}
          >
            Changer d&apos;adresse ou redemander un code
          </Button>
        </form>
      )}

      {isSupabaseConfigured && GOOGLE_ENABLED ? (
        <Button variant="secondary" onClick={signInWithGoogle} disabled={pending} className="w-full">
          <GoogleLogo />
          Continuer avec Google
        </Button>
      ) : null}
    </motion.div>
  );
}
