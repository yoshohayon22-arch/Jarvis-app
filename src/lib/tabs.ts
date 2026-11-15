/**
 * Registre des onglets du dashboard.
 * Chaque onglet a un identifiant stable (utilisé dans l'URL et les préférences),
 * un libellé en français, une icône Lucide, un groupe et la phase où il sera construit.
 */
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Brain,
  CalendarDays,
  CirclePlay,
  Clapperboard,
  CloudSun,
  FolderKanban,
  Goal,
  GraduationCap,
  Library,
  Lightbulb,
  Mail,
  MonitorPlay,
  Music,
  Newspaper,
  Scale,
  ScrollText,
  Sparkles,
  Trophy,
  Tv,
  Wallet,
} from "lucide-react";

export type TabGroup =
  | "communication"
  | "foot"
  | "infos"
  | "etudes"
  | "vie-juive"
  | "loisirs"
  | "pratique";

export const TAB_GROUP_LABELS: Record<TabGroup, string> = {
  communication: "Communication",
  foot: "Foot",
  infos: "Infos et savoir",
  etudes: "Études et projets",
  "vie-juive": "Vie juive",
  loisirs: "Loisirs",
  pratique: "Vie pratique",
};

/** Carte prévue dans un onglet : son titre et ce qu'elle affichera, avec la source. */
export interface PlannedCard {
  title: string;
  description: string;
  source: string;
}

export interface TabDefinition {
  id: string;
  label: string;
  /** Libellé court pour la barre du bas (téléphone). */
  shortLabel: string;
  icon: LucideIcon;
  group: TabGroup;
  phase: number;
  cards: PlannedCard[];
}

export const TABS: readonly TabDefinition[] = [
  {
    id: "mail",
    label: "Mail",
    shortLabel: "Mail",
    icon: Mail,
    group: "communication",
    phase: 2,
    cards: [
      { title: "Mails importants", description: "Résumé IA des mails prioritaires.", source: "Gmail API" },
      { title: "Tri", description: "Urgent / à lire / pub, appliqué en libellés Gmail.", source: "Gmail API" },
      { title: "Brouillons à valider", description: "Rédigés par l'agent, jamais envoyés sans ton accord.", source: "Gmail API" },
      { title: "Recherche", description: "Recherche en langage naturel dans tes mails.", source: "Gmail API + Claude" },
    ],
  },
  {
    id: "cerveau",
    label: "Le Cerveau",
    shortLabel: "Cerveau",
    icon: Brain,
    group: "communication",
    phase: 6,
    cards: [
      { title: "Notes et documents", description: "Ton second cerveau, structure à définir ensemble.", source: "Supabase" },
      { title: "Recherche", description: "Plein texte + recherche sémantique (embeddings).", source: "Supabase pgvector" },
    ],
  },
  {
    id: "real-madrid",
    label: "Real Madrid",
    shortLabel: "Real",
    icon: Trophy,
    group: "foot",
    phase: 1,
    cards: [
      { title: "Prochain match", description: "Compte à rebours et compétition.", source: "football-data.org" },
      { title: "Score", description: "Dernier score (différé avec l'offre gratuite).", source: "football-data.org" },
      { title: "Classement LaLiga", description: "Classement complet, Real mis en avant.", source: "football-data.org" },
      { title: "Ligue des champions", description: "Classement de la phase de ligue.", source: "football-data.org" },
      { title: "Effectif et stats", description: "Buteurs, passeurs, effectif.", source: "football-data.org" },
      { title: "Actus et transferts", description: "Filtrées « Real Madrid ».", source: "RSS Marca, AS…" },
    ],
  },
  {
    id: "foot",
    label: "Foot général",
    shortLabel: "Foot",
    icon: Goal,
    group: "foot",
    phase: 1,
    cards: [
      { title: "Dernières infos", description: "Titre, résumé, lien vers l'article original.", source: "RSS L'Équipe, Foot Mercato, RMC Sport…" },
      { title: "Résumé IA", description: "Optionnel, 2 lignes par article.", source: "Claude" },
    ],
  },
  {
    id: "matchs-tv",
    label: "Matchs TV",
    shortLabel: "TV",
    icon: Tv,
    group: "foot",
    phase: 6,
    cards: [
      { title: "Aujourd'hui", description: "Matchs du jour et chaîne en Suisse.", source: "À étudier (programme des diffuseurs)" },
      { title: "Cette semaine", description: "Programme de la semaine.", source: "À étudier" },
    ],
  },
  {
    id: "la-une",
    label: "La Une",
    shortLabel: "La Une",
    icon: Newspaper,
    group: "infos",
    phase: 1,
    cards: [
      { title: "Suisse romande", description: "Le Temps, Tribune de Genève, 20 minutes, RTS Info.", source: "RSS" },
      { title: "France", description: "Le Monde, Le Figaro, Libération.", source: "RSS" },
      { title: "International", description: "Courrier international, BBC, Reuters.", source: "RSS" },
      { title: "Israël / Moyen-Orient", description: "Times of Israel, i24news, Al Jazeera.", source: "RSS" },
    ],
  },
  {
    id: "veille-ia",
    label: "Veille IA",
    shortLabel: "Veille IA",
    icon: Sparkles,
    group: "infos",
    phase: 5,
    cards: [
      { title: "Nouveautés", description: "Modèles, fonctionnalités, connecteurs, skills.", source: "Blog Anthropic, releases Claude Code…" },
      { title: "Comment l'utiliser", description: "L'agent explique et propose des usages.", source: "Claude" },
    ],
  },
  {
    id: "culture-g",
    label: "Culture G",
    shortLabel: "Culture",
    icon: Lightbulb,
    group: "infos",
    phase: 5,
    cards: [
      { title: "Ce jour-là", description: "Événements historiques du jour.", source: "Wikipédia « On this day »" },
      { title: "Quiz du jour", description: "Score et série de jours.", source: "Claude" },
    ],
  },
  {
    id: "etudes",
    label: "Études",
    shortLabel: "Études",
    icon: GraduationCap,
    group: "etudes",
    phase: 5,
    cards: [
      { title: "Recherche d'écoles", description: "Fiches avec programme, prix, admission, délais.", source: "Recherche web + Claude" },
      { title: "Favoris et candidatures", description: "Suivi des deadlines.", source: "Supabase" },
    ],
  },
  {
    id: "projets",
    label: "Projets Claude Code",
    shortLabel: "Projets",
    icon: FolderKanban,
    group: "etudes",
    phase: 5,
    cards: [
      { title: "Idées / en cours / fini", description: "Chronos, Coach Nutrition, Global Shopping Casher, MCI Sport…", source: "Supabase" },
      { title: "Agent projets", description: "Propositions selon ton temps et tes envies.", source: "Claude" },
    ],
  },
  {
    id: "calendrier",
    label: "Calendrier hébraïque",
    shortLabel: "Calendrier",
    icon: CalendarDays,
    group: "vie-juive",
    phase: 3,
    cards: [
      { title: "Date hébraïque", description: "Date du jour et fêtes à venir.", source: "Hebcal" },
      { title: "Chabbat", description: "Allumage (délai réglable, 18 min par défaut) et havdala.", source: "Hebcal" },
      { title: "Zmanim à Genève", description: "Horaires calculés (écart possible de 1–2 min).", source: "Hebcal" },
    ],
  },
  {
    id: "paracha",
    label: "Paracha",
    shortLabel: "Paracha",
    icon: BookOpen,
    group: "vie-juive",
    phase: 3,
    cards: [{ title: "Paracha de la semaine", description: "Texte, commentaires et résumé en français.", source: "Hebcal + Sefaria" }],
  },
  {
    id: "tehilim",
    label: "Tehilim",
    shortLabel: "Tehilim",
    icon: ScrollText,
    group: "vie-juive",
    phase: 3,
    cards: [{ title: "Tehilim du jour", description: "Cycle quotidien.", source: "Hebcal + Sefaria" }],
  },
  {
    id: "halakha",
    label: "Halakha",
    shortLabel: "Halakha",
    icon: Scale,
    group: "vie-juive",
    phase: 3,
    cards: [{ title: "Halakha du jour", description: "Programme quotidien.", source: "Calendrier Sefaria" }],
  },
  {
    id: "rambam",
    label: "Rambam",
    shortLabel: "Rambam",
    icon: Library,
    group: "vie-juive",
    phase: 3,
    cards: [{ title: "Rambam quotidien", description: "1 ou 3 chapitres (réglable).", source: "Hebcal + Sefaria" }],
  },
  {
    id: "cours",
    label: "Cours Torah-Box",
    shortLabel: "Cours",
    icon: CirclePlay,
    group: "vie-juive",
    phase: 3,
    cards: [{ title: "Derniers cours", description: "Audio et vidéo.", source: "YouTube (flux RSS)" }],
  },
  {
    id: "films",
    label: "Films & Séries",
    shortLabel: "Films",
    icon: Clapperboard,
    group: "loisirs",
    phase: 4,
    cards: [
      { title: "Agent ciné", description: "Propose 3–5 titres selon ton humeur.", source: "TMDB + Claude" },
      { title: "Mes listes", description: "À voir, favoris, déjà vu avec ta note.", source: "Supabase" },
      { title: "Où regarder", description: "Plateformes disponibles en Suisse.", source: "TMDB watch providers (CH)" },
    ],
  },
  {
    id: "musique",
    label: "Musique",
    shortLabel: "Musique",
    icon: Music,
    group: "loisirs",
    phase: 6,
    cards: [{ title: "Lecteur", description: "Tes playlists et nouveautés.", source: "Spotify" }],
  },
  {
    id: "youtube",
    label: "YouTube",
    shortLabel: "YouTube",
    icon: MonitorPlay,
    group: "loisirs",
    phase: 6,
    cards: [{ title: "Nouvelles vidéos", description: "Tes abonnements et « à regarder plus tard ».", source: "YouTube Data API" }],
  },
  {
    id: "budget",
    label: "Budget",
    shortLabel: "Budget",
    icon: Wallet,
    group: "pratique",
    phase: 4,
    cards: [
      { title: "Ce mois-ci", description: "Dépenses par catégorie en CHF.", source: "Supabase" },
      { title: "Abonnements", description: "Dépenses récurrentes.", source: "Supabase" },
      { title: "Import CSV", description: "Relevé bancaire.", source: "Fichier importé" },
    ],
  },
  {
    id: "meteo",
    label: "Météo Genève",
    shortLabel: "Météo",
    icon: CloudSun,
    group: "pratique",
    phase: 1,
    cards: [
      { title: "Maintenant", description: "Température, ressenti, vent, UV.", source: "Open-Meteo (MétéoSuisse ICON-CH)" },
      { title: "Heure par heure", description: "Prochaines 24 h.", source: "Open-Meteo (MétéoSuisse ICON-CH)" },
      { title: "7 jours", description: "ICON-CH2 jusqu'à J+5, ECMWF au-delà (source indiquée).", source: "Open-Meteo" },
      { title: "Qualité de l'air", description: "Indice et polluants.", source: "Open-Meteo Air Quality" },
      { title: "Alertes", description: "Avis de danger en cours.", source: "Meteoalarm (avis MétéoSuisse)" },
    ],
  },
];

export const TAB_IDS = TABS.map((t) => t.id);

export function getTab(id: string): TabDefinition | undefined {
  return TABS.find((t) => t.id === id);
}

/** Ordre par défaut : les favoris d'abord, puis le reste dans l'ordre du registre. */
export const DEFAULT_FAVORITES = ["mail", "meteo", "la-une", "calendrier"];
export const DEFAULT_ORDER = [
  ...DEFAULT_FAVORITES,
  ...TAB_IDS.filter((id) => !DEFAULT_FAVORITES.includes(id)),
];
export const MAX_FAVORITES = 4;
