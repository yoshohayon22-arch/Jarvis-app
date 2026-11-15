# Dashboard

Dashboard personnel privé (un seul utilisateur), en français, pour téléphone et ordinateur.

- **Stack** : Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · composants style shadcn/ui · Motion · connexion par phrase de passe (Supabase prévu) · PWA · hébergé sur Netlify.
- **Mise en ligne** : voir [`docs/MISE-EN-LIGNE.md`](docs/MISE-EN-LIGNE.md).

## Développement local

```bash
npm install
cp .env.example .env.local   # puis remplis les valeurs (facultatif : sans Supabase, l'app tourne en « mode local »)
npm run dev                  # http://localhost:3000
```

## Organisation

| Dossier | Contenu |
|---|---|
| `src/app/(app)/[onglet]` | Une page par onglet (registre dans `src/lib/tabs.ts`) |
| `src/app/(app)/reglages` | Réglages : thème, ordre / masquage / favoris des onglets |
| `src/app/connexion`, `src/app/auth/*` | Connexion Google, retour OAuth, déconnexion |
| `src/proxy.ts` | Rafraîchit la session Supabase et applique la liste blanche |
| `src/styles/tokens.css` | Design tokens des 4 thèmes (Nuit, Glassmorphism, Brutaliste, Dessiné) |
| `src/lib/motion/presets.ts` | Personnalité de mouvement de chaque thème + mode mouvement réduit |
| `src/components/shell` | Barre latérale, barre du bas, en-tête, palette Cmd/Ctrl+K, sélecteur de thème |
| `src/components/ui` | Cartes extensibles, squelettes, nombres animés, badge LIVE, états vides |
| `supabase/migrations` | SQL à exécuter dans Supabase (liste blanche, préférences, RLS) |
| `legacy/` | Ancien prototype « Jarvis » (archivé, non utilisé) |

## Règles du projet

- Données réelles uniquement : si une donnée manque, état vide « Pas encore de données » + explication.
- Chaque donnée affiche sa source et l'heure de mise à jour.
- Clés API uniquement côté serveur (variables d'environnement), jamais dans le navigateur.
- Animations : uniquement `transform` et `opacity`, ressorts, respect de `prefers-reduced-motion`.
