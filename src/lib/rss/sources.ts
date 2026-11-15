/**
 * Sources de presse (flux RSS publics des éditeurs), vérifiées le 15.11.2026.
 * Non incluses faute de flux public : Reuters (flux RSS supprimés) et i24NEWS (aucun flux trouvé).
 */
export type NewsTab = "une" | "foot" | "real" | "cours" | "ia";

export type NewsGroup = "suisse" | "france" | "international" | "moyen-orient" | "foot-fr" | "foot-es" | "foot-en" | "torah" | "ia-officiel" | "ia-presse" | "ia-blogs";

export const GROUP_LABELS: Record<NewsGroup, string> = {
  suisse: "Suisse romande",
  france: "France",
  international: "International",
  "moyen-orient": "Israël / Moyen-Orient",
  "foot-fr": "En français",
  "foot-es": "En espagnol",
  "foot-en": "En anglais",
  torah: "Cours de Torah",
  "ia-officiel": "Annonces officielles",
  "ia-presse": "Presse",
  "ia-blogs": "Blogs",
};

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  tab: NewsTab;
  group: NewsGroup;
  lang: "fr" | "en" | "es";
  /** Certains articles sont réservés aux abonnés du journal. */
  paywall?: boolean;
  /** Le résumé du flux n'est pas informatif (texte promotionnel répété) : on ne l'affiche pas. */
  noSummary?: boolean;
  /** « anthropic » : page HTML lue par un analyseur dédié (pas de flux RSS). */
  format?: "anthropic";
}

export const NEWS_SOURCES: readonly NewsSource[] = [
  // --- La Une ---
  { id: "letemps", name: "Le Temps", url: "https://www.letemps.ch/articles.rss", tab: "une", group: "suisse", lang: "fr", paywall: true },
  { id: "tdg", name: "Tribune de Genève", url: "https://partner-feeds.publishing.tamedia.ch/rss/tdg/la-une", tab: "une", group: "suisse", lang: "fr", paywall: true },
  { id: "20min", name: "20 minutes", url: "https://partner-feeds.20min.ch/rss/20minutes", tab: "une", group: "suisse", lang: "fr" },
  { id: "rts", name: "RTS Info", url: "https://www.rts.ch/info/?format=rss/news", tab: "une", group: "suisse", lang: "fr" },
  { id: "lemonde", name: "Le Monde", url: "https://www.lemonde.fr/rss/une.xml", tab: "une", group: "france", lang: "fr", paywall: true },
  { id: "lefigaro", name: "Le Figaro", url: "https://www.lefigaro.fr/rss/figaro_actualites.xml", tab: "une", group: "france", lang: "fr", paywall: true },
  { id: "liberation", name: "Libération", url: "https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml", tab: "une", group: "france", lang: "fr", paywall: true },
  { id: "courrier", name: "Courrier international", url: "https://www.courrierinternational.com/feed/all/rss.xml", tab: "une", group: "international", lang: "fr", paywall: true },
  { id: "bbc", name: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", tab: "une", group: "international", lang: "en" },
  { id: "toi", name: "The Times of Israël", url: "https://fr.timesofisrael.com/feed/", tab: "une", group: "moyen-orient", lang: "fr" },
  { id: "aljazeera", name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", tab: "une", group: "moyen-orient", lang: "en" },
  // --- Foot général ---
  { id: "lequipe", name: "L'Équipe", url: "https://dwh.lequipe.fr/api/edito/rss?path=/Football/", tab: "foot", group: "foot-fr", lang: "fr", paywall: true },
  { id: "footmercato", name: "Foot Mercato", url: "https://www.footmercato.net/flux-rss", tab: "foot", group: "foot-fr", lang: "fr" },
  { id: "rmc", name: "RMC Sport", url: "https://rmcsport.bfmtv.com/rss/football/", tab: "foot", group: "foot-fr", lang: "fr" },
  { id: "marca", name: "Marca", url: "https://e00-marca.uecdn.es/rss/futbol.xml", tab: "foot", group: "foot-es", lang: "es" },
  { id: "as", name: "AS", url: "https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/portada/", tab: "foot", group: "foot-es", lang: "es" },
  { id: "athletic", name: "The Athletic", url: "https://www.nytimes.com/athletic/rss/football/", tab: "foot", group: "foot-en", lang: "en", paywall: true },
  { id: "marca-real", name: "Marca · Real Madrid", url: "https://e00-marca.uecdn.es/rss/futbol/real-madrid.xml", tab: "real", group: "foot-es", lang: "es" },
  // --- Cours (chaîne YouTube officielle de Torah-Box, flux public) ---
  { id: "torahbox", name: "Torah-Box (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCNgEEqkr9UeSqxJAHxe6-KA", tab: "cours", group: "torah", lang: "fr", noSummary: true },
  { id: "romano", name: "Fabrizio Romano (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCX1em-uaFMS02Rrk_Bowyng", tab: "foot", group: "foot-en", lang: "en", noSummary: true },
  // --- Veille IA (vérifiées le 15.11.2026 ; Anthropic n'a pas de flux RSS, Numerama IA renvoie une erreur 404) ---
  { id: "anthropic", name: "Anthropic", url: "https://www.anthropic.com/news", tab: "ia", group: "ia-officiel", lang: "en", format: "anthropic" },
  { id: "claude-code", name: "Claude Code (versions)", url: "https://github.com/anthropics/claude-code/releases.atom", tab: "ia", group: "ia-officiel", lang: "en", noSummary: true },
  { id: "openai", name: "OpenAI", url: "https://openai.com/news/rss.xml", tab: "ia", group: "ia-officiel", lang: "en" },
  { id: "google-ai", name: "Google AI", url: "https://blog.google/technology/ai/rss/", tab: "ia", group: "ia-officiel", lang: "en" },
  { id: "deepmind", name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", tab: "ia", group: "ia-officiel", lang: "en" },
  { id: "lemonde-ia", name: "Le Monde · IA", url: "https://www.lemonde.fr/intelligence-artificielle/rss_full.xml", tab: "ia", group: "ia-presse", lang: "fr", paywall: true },
  { id: "verge-ia", name: "The Verge · AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", tab: "ia", group: "ia-presse", lang: "en" },
  { id: "willison", name: "Simon Willison", url: "https://simonwillison.net/atom/everything/", tab: "ia", group: "ia-blogs", lang: "en" },
];

/** Mots qui signalent un article sur le Real Madrid dans les flux généralistes. */
export const REAL_MADRID_PATTERN = /real madrid|bernab[eé]u|madridista|merengue/i;

/** L'onglet « real » réunit son flux dédié et les sources foot (filtrées ensuite sur le Real Madrid). */
export const sourcesForTab = (tab: NewsTab) => NEWS_SOURCES.filter((s) => s.tab === tab || (tab === "real" && s.tab === "foot"));
