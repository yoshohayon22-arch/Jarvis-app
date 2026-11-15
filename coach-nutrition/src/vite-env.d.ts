/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** « memory » pour l'aperçu intégré (pas d'adresses /menu, /suivi…). */
  readonly VITE_ROUTER?: string
  /** « 1 » pour afficher le bouton « profil d'exemple ». */
  readonly VITE_DEMO?: string
}
