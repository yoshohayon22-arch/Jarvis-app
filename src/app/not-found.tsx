import Link from "next/link";

export default function NotFound() {
  return (
    <main id="contenu" className="flex min-h-dvh items-center justify-center p-4">
      <div className="card flex max-w-sm flex-col gap-3 p-7">
        <h1 className="text-2xl">Page introuvable</h1>
        <p className="text-sm text-text-2">Cet onglet n&apos;existe pas (ou plus).</p>
        <Link href="/" className="text-sm font-medium underline underline-offset-4">
          Revenir au dashboard
        </Link>
      </div>
    </main>
  );
}
