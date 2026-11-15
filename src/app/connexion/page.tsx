import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginCard } from "@/components/login-card";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main id="contenu" className="flex min-h-dvh items-center justify-center p-4">
      <Suspense fallback={<div className="card h-72 w-full max-w-sm" aria-hidden />}>
        <LoginCard />
      </Suspense>
    </main>
  );
}
