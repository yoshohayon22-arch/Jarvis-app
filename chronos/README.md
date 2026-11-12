# Chronos

RPG 3D low-poly en monde ouvert, jouable dans le navigateur (TypeScript, Vite, Three.js).
Architecture détaillée : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Prérequis
- Node.js 20 ou plus récent (testé avec Node 22)
- npm 10 ou plus récent

## Installation
```bash
cd chronos
npm install
```

## Lancer le jeu (développement)
```bash
npm run dev
```
Puis ouvrir http://localhost:5173 dans le navigateur.

## Build de production
```bash
npm run build      # vérifie les types puis construit client/dist
npm run preview    # sert le build sur http://localhost:4173
```

## Tests
```bash
npm test           # tests unitaires (Vitest) : horloge, boucle, collisions, contrôleur, caméra, carte
npm run typecheck  # vérification TypeScript
npm run build && npm run e2e   # test de fumée : lance le jeu dans Chromium headless + captures (e2e/output/)
```
Le test e2e utilise Playwright, qui doit être installé (`npx playwright install chromium` si besoin).

## Contrôles
| Touche | Action |
|---|---|
| ZQSD (AZERTY) / WASD (QWERTY) / flèches | se déplacer (relatif à la caméra) |
| Maj | courir |
| Espace | esquiver |
| Souris | orienter la caméra (clic dans le jeu pour verrouiller le pointeur) |
| Molette | zoom |
| T | vitesse du temps : ×1 → ×10 → ×60 → figé |
| F3 | panneau debug (FPS, draw calls, position) |
| Échap | pause |

## Structure
```
chronos/
├─ shared/          # types communs (format des packs d'époque…)
├─ client/          # le jeu (Vite + Three.js)
│  ├─ src/core/     # boucle à pas fixe, RNG à graine, entrées
│  ├─ src/sim/      # simulation déterministe (horloge, joueur, collisions, carte)
│  ├─ src/render/   # rendu Three.js (village procédural, personnage, caméra, ciel)
│  ├─ src/ui/       # HUD
│  ├─ data/packs/medieval/   # pack d'époque : manifeste + plan du village
│  └─ test/         # tests unitaires
├─ e2e/             # test de fumée Playwright
└─ docs/
```
Le proxy Node pour l'API Claude (`server/`) arrive au jalon J4.

## Avancement
- [x] J1 : scène 3D, personnage jouable, déplacement, caméra, cycle jour/nuit
- [ ] J2 : habitants avec routines et foule légère
- [ ] J3 : mémoire, rumeurs, réputations
- [ ] J4 : dialogues IA via le proxy
- [ ] J5 : pouvoirs (temps, télékinésie, ombre) et conséquences
- [ ] J6 : écho du passé, changement de visage
- [ ] J7 : missions générées et validées
- [ ] J8 : sauvegarde, réglages de coût, finitions
