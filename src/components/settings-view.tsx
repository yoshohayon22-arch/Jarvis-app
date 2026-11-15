"use client";

/** Réglages : thème, ordre / masquage / favoris des onglets, consommation IA, compte. */
import { motion } from "motion/react";
import { ChevronDown, ChevronUp, Eye, EyeOff, LogOut, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useMotionPreset } from "@/lib/motion/use-motion-preset";
import { usePrefs } from "@/lib/prefs/prefs-provider";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getTab, MAX_FAVORITES } from "@/lib/tabs";
import { THEMES, THEME_LABELS, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";

/** Aperçu des couleurs de chaque thème (fond / carte / accent). */
const SWATCHES: Record<ThemeId, [string, string, string]> = {
  nuit: ["#0B0E14", "#151A23", "#F5C451"],
  glass: ["#43308C", "#0C6E7E", "#9BE7FF"],
  brutal: ["#F2F0E6", "#FFFFFF", "#FF4A1C"],
  dessine: ["#FBF7EE", "#FFF3B0", "#C7402A"],
};

function Section({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-lg">{title}</h2>
        {description ? <p className="text-sm text-text-2">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function SettingsView() {
  const { prefs, update, setTheme, reset } = usePrefs();
  const preset = useMotionPreset();

  const move = (id: string, delta: number) => {
    const order = [...prefs.tabOrder];
    const i = order.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    update({ tabOrder: order });
  };

  const toggleHidden = (id: string) => {
    const hidden = prefs.hiddenTabs.includes(id);
    update({
      hiddenTabs: hidden ? prefs.hiddenTabs.filter((x) => x !== id) : [...prefs.hiddenTabs, id],
      favorites: hidden ? prefs.favorites : prefs.favorites.filter((x) => x !== id),
    });
  };

  const toggleFavorite = (id: string) => {
    const fav = prefs.favorites.includes(id);
    if (!fav && prefs.favorites.length >= MAX_FAVORITES) return;
    update({ favorites: fav ? prefs.favorites.filter((x) => x !== id) : [...prefs.favorites, id] });
  };

  const iconBtn =
    "btn-press inline-flex size-11 items-center justify-center rounded-control text-text-2 hover:text-text disabled:opacity-30 [[data-theme=brutal]_&]:shadow-none [[data-theme=dessine]_&]:shadow-none";

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <Section title="Thème" description="Mémorisé sur cet appareil et dans ton compte.">
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Thème">
          {THEMES.map((theme) => {
            const active = prefs.theme === theme;
            return (
              <button
                key={theme}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={(e) => setTheme(theme, { x: e.clientX, y: e.clientY })}
                className={cn(
                  "btn-press flex min-h-20 flex-col items-start justify-between gap-2 rounded-control border-[length:var(--border-width)] p-3 text-left text-sm",
                  active ? "border-accent bg-accent-soft font-semibold" : "border-border bg-surface-2",
                )}
              >
                <span className="flex gap-1" aria-hidden>
                  {SWATCHES[theme].map((c) => (
                    <span key={c} className="size-5 rounded-full border border-black/20" style={{ background: c }} />
                  ))}
                </span>
                {THEME_LABELS[theme]}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-text-2">
          Les animations suivent le réglage « Réduire les animations » de ton appareil.
        </p>
      </Section>

      <Section
        title="Onglets"
        description={`Réordonne, masque, et choisis jusqu'à ${MAX_FAVORITES} favoris pour la barre du bas sur téléphone (${prefs.favorites.length}/${MAX_FAVORITES}).`}
      >
        <ul className="flex flex-col">
          {prefs.tabOrder.map((id, i) => {
            const tab = getTab(id);
            if (!tab) return null;
            const Icon = tab.icon;
            const hidden = prefs.hiddenTabs.includes(id);
            const fav = prefs.favorites.includes(id);
            const favDisabled = hidden || (!fav && prefs.favorites.length >= MAX_FAVORITES);
            return (
              <motion.li
                key={id}
                layout="position"
                transition={preset.layout}
                className={cn("flex items-center gap-1 border-b-[length:var(--border-width)] border-border py-1 last:border-b-0", hidden && "opacity-60")}
              >
                <Icon aria-hidden className="mx-2 size-5 shrink-0 text-text-2" />
                <span className="min-w-0 flex-1 truncate text-sm">{tab.label}</span>
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => toggleFavorite(id)}
                  disabled={favDisabled}
                  aria-pressed={fav}
                  aria-label={fav ? `Retirer ${tab.label} des favoris` : `Ajouter ${tab.label} aux favoris`}
                >
                  <Star aria-hidden className={cn("size-5", fav && "fill-accent text-accent [[data-theme=brutal]_&]:text-black")} />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => toggleHidden(id)}
                  aria-pressed={hidden}
                  aria-label={hidden ? `Afficher ${tab.label}` : `Masquer ${tab.label}`}
                >
                  {hidden ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
                </button>
                <button type="button" className={iconBtn} onClick={() => move(id, -1)} disabled={i === 0} aria-label={`Monter ${tab.label}`}>
                  <ChevronUp aria-hidden className="size-5" />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => move(id, 1)}
                  disabled={i === prefs.tabOrder.length - 1}
                  aria-label={`Descendre ${tab.label}`}
                >
                  <ChevronDown aria-hidden className="size-5" />
                </button>
              </motion.li>
            );
          })}
        </ul>
        <Button variant="ghost" className="self-start" onClick={reset}>
          Rétablir l&apos;ordre par défaut
        </Button>
      </Section>

      <Section title="Consommation IA" description="Tokens utilisés ce mois-ci par les agents.">
        <EmptyState reason="Les agents IA arrivent en Phase 2 : le compteur s'affichera ici dès le premier appel." />
      </Section>

      <Section title="Compte">
        {isSupabaseConfigured ? (
          <form action="/auth/deconnexion" method="post">
            <Button type="submit" variant="secondary">
              <LogOut aria-hidden /> Se déconnecter
            </Button>
          </form>
        ) : (
          <EmptyState title="Connexion non configurée" reason="Supabase n'est pas encore relié : l'app tourne en mode local." />
        )}
      </Section>
    </div>
  );
}
