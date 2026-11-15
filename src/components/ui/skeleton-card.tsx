import { cn } from "@/lib/utils";

/**
 * Squelette de chargement à la forme exacte d'une carte :
 * en-tête (titre + badge), lignes de contenu, ligne de source.
 */
export function SkeletonCard({ lines = 2, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("card flex min-h-44 flex-col gap-4 p-5", className)} aria-hidden>
      <div className="flex items-center justify-between">
        <div className="skeleton h-5 w-2/5" />
        <div className="skeleton h-5 w-14" />
      </div>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="skeleton h-4" style={{ width: `${90 - i * 18}%` }} />
        ))}
      </div>
      <div className="skeleton mt-auto h-3 w-1/2" />
    </div>
  );
}

/** Grille de squelettes affichée pendant le chargement d'un onglet. */
export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Chargement" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} lines={i % 2 ? 3 : 2} />
      ))}
    </div>
  );
}
