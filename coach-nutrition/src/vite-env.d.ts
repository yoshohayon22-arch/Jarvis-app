/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** « memory » pour l'aperçu intégré (pas d'adresses /menu, /suivi…). */
  readonly VITE_ROUTER?: string
  /** « 1 » pour afficher le bouton « profil d'exemple ». */
  readonly VITE_DEMO?: string
  /** Profil de base (JSON) créé automatiquement s'il n'y a aucun profil — à définir dans .env.local, jamais dans le dépôt. */
  readonly VITE_DEFAULT_PROFILE?: string
}
