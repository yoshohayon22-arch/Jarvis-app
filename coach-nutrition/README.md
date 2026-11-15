# Coach Nutrition

Web app de coaching nutritionnel (usage privé, en français, pour la Suisse).
React + Vite + TypeScript + Tailwind CSS · Recharts · Vitest. Aucune donnée ne quitte le navigateur.

## Commandes

```bash
npm install        # installer les dépendances
npm run dev        # lancer en local → http://localhost:5173
npm test           # lancer les tests (Vitest)
npm run build      # construire le site statique dans dist/
```

## Organisation

- `src/domain/` — calculs nutritionnels et règles métier (fonctions pures, testées)
- `src/storage/` — couche de stockage (localStorage aujourd'hui, remplaçable plus tard) + migrations
- `src/features/` — écrans (onboarding, accueil, profil…)
- `src/components/` — composants d'interface réutilisables

## Déploiement (Netlify)

Base directory : `coach-nutrition` — la commande de build et le dossier `dist` sont lus depuis `netlify.toml`.

> Cette application donne des repères généraux et ne remplace pas l'avis d'un médecin ou d'un diététicien.
