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

## Habitants (J2)
- 12 personnages clés (`client/data/packs/medieval/characters.json`) : traits, biographie, objectifs, inventaire, relations, secrets, emploi du temps.
- 102 figurants générés à partir de 11 archétypes (`extras.json`) : marchands, artisans, paysans, gardes de jour et de nuit, miséreux, enfants, acolytes, mages, rôdeurs, habitués de la taverne.
- Chaque habitant suit son emploi du temps (travail, repas, prière, discussions, patrouilles, sommeil à l'intérieur de sa maison). Trois besoins (faim, fatigue, compagnie) peuvent interrompre la routine quand ils deviennent urgents.
- En s'approchant d'un habitant, une étiquette indique son nom, son rôle et ce qu'il fait.
- Rendu : les animations sont précalculées dans des textures (un appel de dessin par type de personnage).

## Qualité graphique
Deux préréglages (définis dans `client/data/quality.json`), touche **G** en jeu, mémorisé dans le navigateur :
- **Qualité haute** (par défaut sur ordinateur) : ombres 4096, SSAO, flou de profondeur, herbe animée (60 000 brins), MSAA ×4.
- **Qualité basse** (par défaut sur mobile) : ombres 1024, pas d'AO, de flou de profondeur ni d'herbe, FXAA.

On peut forcer un préréglage par l'URL : `http://localhost:5173/?quality=low`.

## Direction artistique (stylisé-réaliste)
- Modèles : packs CC0 **KayKit** (bâtiments, nature, props, personnages) au format glTF dans `client/public/assets/kaykit/`.
- Rendu des matériaux : un shader ajoute du relief (normal maps triplanaires pierre/bois/feuillage choisies selon la couleur), des variations d'albédo et de rugosité, et de la salissure au pied des murs (`client/src/render/materials.ts`).
- Éclairage : HDRI CC0 Poly Haven (via `@pmndrs/assets`) pour l'éclairage par image, soleil + `HemisphereLight`, ombres douces, brouillard lavande.
- Post-traitement (`postprocessing`) : SSAO, flou de profondeur, bloom, exposition, tone mapping ACES, étalonnage (ombres froides / lumières chaudes), vignette. Sortie sRGB.
- Palette limitée et réglages d'ambiance : `client/data/palette.json`.
- Seuls les lanternes et l'herbe (effet GPU) sont générés en code ; les autres géométries codées ne servent que de placeholders si un modèle manque.

### Réimporter les assets
```bash
git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 /tmp/kk/adv
git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0 /tmp/kk/hex
node tools/import-kaykit.mjs /tmp/kk      # GLB compressés meshopt + manifeste des dimensions
node tools/import-pmndrs.mjs              # HDRI + normal maps (CC0)
```
Galerie des modèles (en développement) : http://localhost:5173/gallery.html?cat=buildings (`cat` = buildings, nature, props, characters ; `filter` = expression régulière).

## Crédits
- KayKit Medieval Hexagon Pack 1.0 et Adventurers Character Pack 1.0 — Kay Lousberg (www.kaylousberg.com), CC0.
- HDRI Poly Haven et normal maps, via `@pmndrs/assets` — CC0.

## Tests
```bash
npm test           # tests unitaires (Vitest) : horloge, boucle, collisions, contrôleur, caméra, carte, données visuelles
npm run typecheck  # vérification TypeScript
npm run build && npm run e2e   # test de fumée : lance le jeu dans Chromium headless + captures (e2e/output/)
QUALITY=low npm run e2e        # idem en qualité basse (plus rapide sans GPU)
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
| G | qualité graphique basse / haute |
| F3 | panneau debug (FPS, draw calls, position, habitants dehors / à l'intérieur) |
| Échap | pause |

## Structure
```
chronos/
├─ shared/          # types communs (format des packs d'époque…)
├─ tools/           # import des assets CC0 (KayKit, @pmndrs/assets)
├─ client/          # le jeu (Vite + Three.js)
│  ├─ src/core/     # boucle à pas fixe, RNG à graine, entrées
│  ├─ src/sim/      # simulation déterministe (horloge, joueur, collisions, carte)
│  ├─ src/sim/agents/  # habitants : besoins, emplois du temps, décisions, déplacements
│  ├─ src/sim/nav/     # grille de navigation + A*
│  ├─ src/render/   # rendu Three.js (village procédural, personnage, caméra, ciel)
│  ├─ src/ui/       # HUD
│  ├─ data/         # palette, préréglages qualité, manifeste des modèles
│  ├─ data/packs/medieval/   # pack d'époque : manifeste, plan du village, visuels
│  ├─ public/assets/         # modèles glTF, HDRI, normal maps (CC0)
│  └─ test/         # tests unitaires
├─ e2e/             # test de fumée Playwright
└─ docs/
```
Le proxy Node pour l'API Claude (`server/`) arrive au jalon J4.

## Avancement
- [x] J1 : scène 3D, personnage jouable, déplacement, caméra, cycle jour/nuit
- [x] J2 : habitants avec routines et foule légère (12 personnages clés + 102 figurants)
- [ ] J3 : mémoire, rumeurs, réputations
- [ ] J4 : dialogues IA via le proxy
- [ ] J5 : pouvoirs (temps, télékinésie, ombre) et conséquences
- [ ] J6 : écho du passé, changement de visage
- [ ] J7 : missions générées et validées
- [ ] J8 : sauvegarde, réglages de coût, finitions
