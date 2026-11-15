/** Les 4 thèmes du dashboard. Les valeurs visuelles vivent dans src/styles/tokens.css. */
export const THEMES = ["nuit", "glass", "brutal", "dessine"] as const;
export type ThemeId = (typeof THEMES)[number];

export const DEFAULT_THEME: ThemeId = "nuit";

export const THEME_LABELS: Record<ThemeId, string> = {
  nuit: "Nuit",
  glass: "Glassmorphism",
  brutal: "Brutaliste",
  dessine: "Dessiné à la main",
};

/** Couleur de la barre d'état du téléphone pour chaque thème. */
export const THEME_COLORS: Record<ThemeId, string> = {
  nuit: "#0B0E14",
  glass: "#0B0E1D",
  brutal: "#F2F0E6",
  dessine: "#FBF7EE",
};

export const THEME_STORAGE_KEY = "dashboard-theme";

export function isTheme(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/**
 * Script exécuté avant le premier rendu (dans <head>) pour appliquer le thème mémorisé
 * sans flash. Il doit rester autonome : pas d'import possible.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var ok=${JSON.stringify(
  THEMES,
)};if(ok.indexOf(t)<0)t='${DEFAULT_THEME}';document.documentElement.dataset.theme=t;var c=${JSON.stringify(
  THEME_COLORS,
)}[t];var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',c);}catch(e){document.documentElement.dataset.theme='${DEFAULT_THEME}';}})();`;
