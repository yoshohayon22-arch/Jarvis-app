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

## Modifier les données

Tout est dans `src/data/` :

- **`prices.json`** — prix par ingrédient (CHF), avec magasin, conditionnement et date de mise à jour.
  Change `priceChf` ou `packageSize`, mets à jour `updatedAt`, puis lance `npm run recipes:update`.
  `"source": "relevé"` = prix constaté en ligne (avec `url` et `checkedAt`) ; `"estimation"` = valeur approximative.
  `"byWeight": true` = vendu au poids (vrac, coupe) : la liste de courses compte la quantité prise.
- **`ingredients.json`** — valeurs nutritionnelles pour 100 g, rayon, conditionnements, tags
  (`porc`, `lait`, `gluten`, `alcool`…). Les filtres casher, halal, etc. se basent sur ces tags.
- **`recipes.json`** — recettes (ingrédients en grammes pour toute la recette, étapes, conservation…).
  Après une modification, `npm run recipes:update` recalcule kcal, macros, prix par portion,
  classement casher, tag « petit-budget » et régimes compatibles. `npm test` vérifie la cohérence.

## Déploiement (Netlify)

Base directory : `coach-nutrition` — la commande de build et le dossier `dist` sont lus depuis `netlify.toml`.

> Cette application donne des repères généraux et ne remplace pas l'avis d'un médecin ou d'un diététicien.
