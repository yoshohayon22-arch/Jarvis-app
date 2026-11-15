import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** État vide propre : on n'invente jamais de données, on explique pourquoi il n'y en a pas. */
export function EmptyState({ title = "Pas encore de données", reason, className }: {
  title?: string;
  reason: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2.5 text-sm", className)}>
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-text-2" />
      <div>
        <p className="font-medium text-text">{title}</p>
        <p className="text-text-2">{reason}</p>
      </div>
    </div>
  );
}
