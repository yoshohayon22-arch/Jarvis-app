"use client";

/**
 * Onglets d'étude : Paracha, Tehilim, Halakha, Rambam.
 * Programme du jour (Hebcal / Sefaria) et texte hébreu avec traduction (Sefaria), toujours avec le lien vers l'original.
 */
import { ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { SourceNote } from "@/components/ui/source-note";
import type { StudyPayload, StudySection } from "@/lib/judaisme/types";
import { useCachedFetch } from "@/lib/use-cached-fetch";
import { useLocalSetting } from "@/lib/use-local-setting";
import { cn } from "@/lib/utils";

type Display = "les-deux" | "traduction" | "hebreu";
const DISPLAYS: [Display, string][] = [
  ["les-deux", "Les deux"],
  ["traduction", "Traduction"],
  ["hebreu", "Hébreu"],
];

const pill = (active: boolean) =>
  cn(
    "btn-press min-h-11 rounded-full border-[length:var(--border-width)] px-4 text-sm [[data-theme=brutal]_&]:shadow-none [[data-theme=dessine]_&]:shadow-none",
    active ? "border-accent bg-accent-soft font-semibold text-text" : "border-border bg-surface text-text-2",
  );

export function StudyView({ section }: { section: StudySection }) {
  const [chapters, setChapters] = useLocalSetting("dashboard-rambam", 1);
  const [display, setDisplay] = useState<Display>("les-deux");
  const query = section === "rambam" ? `rambam&chapitres=${chapters === 3 ? 3 : 1}` : section;
  const { data, error, loading, refresh } = useCachedFetch<StudyPayload>(
    `etude-${query}`,
    async () => {
      const res = await fetch(`/api/vie-juive?section=${query}`);
      const body = (await res.json().catch(() => null)) as (StudyPayload & { erreur?: string }) | null;
      if (!res.ok || !body) throw new Error(body?.erreur ?? `le serveur a répondu ${res.status}`);
      return body;
    },
    30 * 60 * 1000,
  );

  const rambamChoice =
    section === "rambam" ? (
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Nombre de chapitres par jour">
        {[1, 3].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={(chapters === 3 ? 3 : 1) === n} onClick={() => setChapters(n)} className={pill((chapters === 3 ? 3 : 1) === n)}>
            {n} chapitre{n > 1 ? "s" : ""} par jour
          </button>
        ))}
      </div>
    ) : null;

  if (!data) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        {rambamChoice}
        {loading ? (
          <SkeletonCard lines={3} />
        ) : (
          <div className="card flex flex-col gap-3 p-5">
            <EmptyState title="Texte indisponible" reason={`Le programme du jour n'a pas pu être lu (${error ?? "raison inconnue"}). Rien n'est affiché plutôt qu'un texte inventé.`} />
            <Button variant="secondary" onClick={refresh} className="self-start">
              Réessayer
            </Button>
          </div>
        )}
      </div>
    );
  }

  const { text } = data;
  const translationLabel = text.translation ? `${text.translation.language === "fr" ? "traduction française" : "traduction anglaise"} « ${text.translation.title} »` : null;
  const showHebrew = display !== "traduction";
  const showTranslation = display !== "hebreu" && Boolean(text.translation);
  const multi = text.sections.length > 1;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {rambamChoice}

      <section className="card flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl leading-tight">{data.title}</h2>
            {data.hebrewTitle ? (
              <p lang="he" dir="rtl" className="mt-1 text-left text-lg text-text-2">
                {data.hebrewTitle}
              </p>
            ) : null}
          </div>
          <Button variant="secondary" size="icon" onClick={refresh} disabled={loading} aria-label="Actualiser" className="shrink-0">
            <RefreshCw aria-hidden className={cn(loading && "animate-spin motion-reduce:animate-none")} />
          </Button>
        </div>

        <a href={text.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium underline underline-offset-4">
          Lire sur Sefaria avec les commentaires
          <ExternalLink aria-hidden className="size-4" />
        </a>

        {text.translation?.language === "en" ? (
          <p className="text-sm text-text-2">Sefaria n&apos;a pas de traduction française pour ce passage : la traduction affichée est en anglais.</p>
        ) : null}
        {!text.translation ? <p className="text-sm text-text-2">Sefaria ne propose pas de traduction pour ce passage : seul le texte hébreu est affiché.</p> : null}
        {section === "halakha" || section === "rambam" ? (
          <p className="rounded-control border-[length:var(--border-width)] border-border bg-accent-soft px-3 py-2 text-sm">
            Texte d&apos;étude. Pour une question de halakha pratique, demande à un rabbin.
          </p>
        ) : null}

        <SourceNote
          source={`${data.scheduleSource} · texte : Sefaria (${[text.hebrewVersion, translationLabel].filter(Boolean).join(" ; ")})`}
          updatedAt={new Date(data.fetchedAt)}
        />
        <p className="text-xs text-text-2">Le résumé en français par IA sera ajouté quand la clé Anthropic sera configurée.</p>
      </section>

      {data.extras.length ? (
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="text-lg">Montées et haftara</h2>
          <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {data.extras.map((e) => (
              <li key={e.label} className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 text-sm">
                <span className="text-text-2">{e.label}</span>
                <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-right underline underline-offset-4">
                  {e.ref}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card flex flex-col gap-5 p-5">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Affichage du texte">
          {DISPLAYS.filter(([id]) => text.translation || id === "hebreu").map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={display === id} onClick={() => setDisplay(id)} className={pill(display === id)}>
              {label}
            </button>
          ))}
        </div>

        {text.sections.map((s, i) => (
          <div key={s.number ?? i} className="flex flex-col gap-3">
            {multi && s.number != null ? (
              <h3 className="text-base text-text-2">
                {data.sectionLabel} {s.number}
              </h3>
            ) : null}
            <ol className="flex flex-col gap-4">
              {s.verses.map((v) => (
                <li key={v.n} className="flex gap-3">
                  <span className="w-7 shrink-0 pt-1 text-right text-xs text-text-2 tabular-nums" aria-hidden>
                    {v.n}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {showHebrew && v.hebrew ? (
                      <p lang="he" dir="rtl" className="hebrew-text text-xl leading-relaxed">
                        {v.hebrew}
                      </p>
                    ) : null}
                    {showTranslation && v.translation ? (
                      <p lang={text.translation?.language} className={cn("leading-relaxed", showHebrew ? "text-sm text-text-2" : "text-base")}>
                        {v.translation}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>
    </div>
  );
}
