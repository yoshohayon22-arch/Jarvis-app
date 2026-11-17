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

## Variété des menus

Règles appliquées par le générateur (`src/domain/menu/generator.ts`), testées dans `generator.test.ts` :

- **Plats principaux** : une même recette 3 fois par semaine au plus, jamais deux jours de suite ;
  une même famille d'aliments (poulet, riz, pâtes, quinoa…) 4 fois au plus sur les 14 déjeuners/dîners,
  jamais deux jours de suite (6 fois pour les profils très protéinés, où la précision passe avant).
- **Petit-déjeuner et collations** : une même recette 2 fois par semaine au plus (`MAX_SIDE_USES_PER_WEEK`),
  sauf si le profil n'a pas assez de recettes autorisées.
- **« Nouveau menu »** : les plats du menu actuel (non verrouillés) sont évités, la semaine suivante change vraiment.
- Le repas de Shabbat, traditionnel, passe avant ces règles ; le bowl de batch cooking revient un jour sur deux.

## Techniques de nutrition

Onglet **Menu → Techniques** (`src/domain/techniques.ts`, testé dans `techniques.test.ts`) :
assiette équilibrée suisse (OSAV/SSN 2025 : 2/5 légumes et fruits, 2/5 féculents, 1/5 protéines),
alimentation méditerranéenne, riche en protéines et jeûne intermittent 16:8. Chaque fiche explique le principe,
donne des conseils et des repas adaptés au profil. « Appliquer à mon menu » enregistre la technique dans le profil
et régénère la semaine : les recettes qui la respectent sont privilégiées (méditerranéen : viande rouge 1 fois par
semaine au plus ; jeûne : 2 repas par jour, nombre de repas d'avant rétabli au retrait). Calories et protéines restent
calculées comme d'habitude.

## Profil de base (aperçu personnel)

Pour ne pas ressaisir son profil à chaque ouverture, on peut définir un **profil de base** : il est créé
automatiquement, avec son menu de la semaine, quand l'application ne contient encore aucun profil
(et recréé après « Tout effacer »). Les données personnelles ne vont **jamais** dans le dépôt (public) :
elles sont dans `.env.preview.local` (ignoré par git), lu seulement par le build de l'aperçu :

```bash
# .env.preview.local
VITE_DEFAULT_PROFILE={"name":"Prénom","settings":{"sex":"femme","age":40,"heightCm":165,"startWeightKg":70,"targetWeightKg":65,"activityLevel":2}}
npx vite build --mode preview
```

Les réglages absents prennent les valeurs par défaut ; les garde-fous de l'onboarding s'appliquent
(âge ≥ 18 ans, IMC cible ≥ 18,5). Le site public (build normal, Netlify) n'a pas de profil de base.

## Sauvegarde des données

Tout reste dans le navigateur (localStorage). Dans **Profil → Mes données** :
« Exporter mes données » télécharge un fichier JSON, « Importer » le recharge, « Tout effacer »
supprime tout (avec confirmation). Sur un nouvel ordinateur, l'écran d'accueil propose directement
« J'ai déjà une sauvegarde : importer mon fichier ».

## Qualité

- `npm test` : 180+ tests (calculs, garde-fous, restrictions casher/halal, générateur, batch, courses, suivi, coach).
- Accessibilité vérifiée avec axe-core (WCAG 2.1 AA) sur tous les écrans, navigation complète au clavier.

## Déploiement (Netlify)

1. Sur Netlify : « Add new site » → « Import an existing project » → ce dépôt GitHub.
2. **Base directory : `coach-nutrition`** — la commande (`npm run build`), le dossier publié (`dist`)
   et la redirection des routes vers `index.html` sont lus depuis `netlify.toml`.
3. Chaque push sur la branche choisie redéploie le site automatiquement.

> Cette application donne des repères généraux et ne remplace pas l'avis d'un médecin ou d'un diététicien.
