/** Onglets de la version artefact (mêmes identifiants que l'app). `live` : onglet branché sur de vraies données ici. */
export interface ArtifactTab {
  id: string;
  label: string;
  short: string;
  icon: string;
  group: string;
  live?: boolean;
  /** Ce que l'onglet affichera, et sa source prévue. */
  planned: [string, string][];
}

export const TABS: ArtifactTab[] = [
  { id: "mail", label: "Mail", short: "Mail", icon: "mail", group: "Communication", live: true, planned: [] },
  { id: "cerveau", label: "Le Cerveau", short: "Cerveau", icon: "brain", group: "Communication", planned: [["Notes et documents", "à définir ensemble"], ["Recherche", "plein texte et sémantique"]] },
  { id: "meteo", label: "Météo Genève", short: "Météo", icon: "cloud-sun", group: "Vie pratique", live: true, planned: [] },
  { id: "budget", label: "Budget", short: "Budget", icon: "wallet", group: "Vie pratique", live: true, planned: [] },
  { id: "la-une", label: "La Une", short: "La Une", icon: "newspaper", group: "Infos et savoir", live: true, planned: [] },
  { id: "veille-ia", label: "Veille IA", short: "Veille IA", icon: "sparkles", group: "Infos et savoir", live: true, planned: [] },
  { id: "culture-g", label: "Culture G", short: "Culture", icon: "lightbulb", group: "Infos et savoir", live: true, planned: [] },
  { id: "calendrier", label: "Calendrier hébraïque", short: "Calendrier", icon: "calendar-days", group: "Vie juive", live: true, planned: [] },
  { id: "paracha", label: "Paracha", short: "Paracha", icon: "book-open", group: "Vie juive", live: true, planned: [] },
  { id: "tehilim", label: "Tehilim", short: "Tehilim", icon: "scroll-text", group: "Vie juive", live: true, planned: [] },
  { id: "halakha", label: "Halakha", short: "Halakha", icon: "scale", group: "Vie juive", live: true, planned: [] },
  { id: "rambam", label: "Rambam", short: "Rambam", icon: "library", group: "Vie juive", live: true, planned: [] },
  { id: "cours", label: "Cours Torah-Box", short: "Cours", icon: "circle-play", group: "Vie juive", live: true, planned: [] },
  { id: "real-madrid", label: "Real Madrid", short: "Real", icon: "trophy", group: "Foot", live: true, planned: [] },
  { id: "foot", label: "Foot général", short: "Foot", icon: "goal", group: "Foot", live: true, planned: [] },
  { id: "matchs-tv", label: "Matchs TV", short: "TV", icon: "tv", group: "Foot", planned: [["Aujourd'hui", "à étudier"], ["Cette semaine", "à étudier"]] },
  { id: "etudes", label: "Études", short: "Études", icon: "graduation-cap", group: "Études et projets", live: true, planned: [] },
  { id: "projets", label: "Projets Claude Code", short: "Projets", icon: "folder-kanban", group: "Études et projets", live: true, planned: [] },
  { id: "films", label: "Films & Séries", short: "Films", icon: "clapperboard", group: "Loisirs", planned: [["Agent ciné", "TMDB + Claude"], ["Mes listes", "tes saisies"], ["Où regarder", "TMDB (Suisse)"]] },
  { id: "musique", label: "Musique", short: "Musique", icon: "music", group: "Loisirs", planned: [["Lecteur", "Spotify"]] },
  { id: "youtube", label: "YouTube", short: "YouTube", icon: "monitor-play", group: "Loisirs", planned: [["Nouvelles vidéos", "YouTube"]] },
];

export const DEFAULT_FAVORITES = ["mail", "meteo", "la-une", "calendrier"];
export const getTab = (id: string) => TABS.find((t) => t.id === id);
