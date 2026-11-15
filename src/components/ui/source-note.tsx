import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Petit texte discret : source de la donnée et heure de mise à jour. */
export function SourceNote({
  source,
  updatedAt,
  planned,
  className,
}: {
  source: string;
  updatedAt?: Date | null;
  /** true si la source est seulement prévue (données pas encore branchées). */
  planned?: boolean;
  className?: string;
}) {
  return (
    <p className={cn("text-xs text-text-2", className)}>
      {planned ? "Source prévue : " : "Source : "}
      {source}
      {updatedAt ? <> · Mis à jour le {formatDateTime(updatedAt)}</> : null}
    </p>
  );
}
