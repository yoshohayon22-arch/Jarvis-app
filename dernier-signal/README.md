# Dernier Signal

Jeu d'aventure-exploration spatial en 3D, jouable dans le navigateur (iPad / Safari en priorité, et ordinateur).

**Étape en cours : 2 — Atelier des robots** (choix du design de R-12).

## Lancer en local
```bash
npm install
npm run dev        # puis ouvrir l'adresse affichée (…/atelier.html)
```
Les textures Poly Haven sont déjà dans `public/assets/polyhaven`. Pour les retélécharger :
`NODE_USE_ENV_PROXY=1 npm run assets` (ImageMagick requis pour la recompression).

## Organisation
| Dossier | Contenu |
|---|---|
| `src/core` | Préréglages de qualité, rendu + post-traitement, chargement des textures |
| `src/robots` | Les 4 robots procéduraux, matériaux PBR avec usure, animations |
| `src/fx` | Sol réfléchissant, faisceaux volumétriques, poussière, flammes, onde de scan |
| `src/atelier` | Page « Atelier » (showroom) |

Déploiement automatique sur GitHub Pages à chaque push sur `main` (`.github/workflows/deploy.yml`).
