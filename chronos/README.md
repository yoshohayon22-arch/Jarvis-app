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

## Dialogues IA (J4)
Le jeu parle à l'IA uniquement à travers le petit serveur `server/` (proxy). **La clé API reste côté serveur** ; le navigateur ne la voit jamais.

```bash
# Terminal 1 : le proxy (choisir UNE des trois lignes)
ANTHROPIC_API_KEY=sk-ant-... npm run server   # IA réelle
CHRONOS_MOCK=1 npm run server                 # IA simulée, gratuite (pour tester le circuit)
npm run server                                # sans clé : le jeu utilise ses répliques locales

# Terminal 2 : le jeu
npm run dev
```
`npm run dev:all` lance les deux d'un coup (avec les mêmes variables d'environnement).
Sans proxy du tout, le jeu fonctionne aussi : les personnages répondent avec des répliques locales.

En jeu : approchez un **personnage clé** (nom en doré), touche **F**, écrivez, Entrée. Échap ou s'éloigner met fin à la conversation. Les figurants répondent par une courte réplique locale, sans IA.

### Garde-fous
- Le proxy charge lui-même la fiche du personnage et la bible du monde (`lore.md`) : le navigateur n'envoie qu'un identifiant et le contexte de la scène, tout borné et validé.
- Le texte du joueur (300 caractères max) est nettoyé et placé dans un bloc délimité ; l'IA a pour consigne de le traiter comme une parole, jamais comme un ordre.
- L'IA répond dans un format strict (réplique, humeur, intention, variation d'opinion, secret révélé). Elle ne fait que **proposer** : le code borne la variation d'opinion (±5 par réplique, ±12 par conversation) et n'accepte un secret que s'il existe et si la confiance est suffisante. Les secrets ne sont même pas envoyés au modèle en dessous du seuil de confiance (25).
- L'IA ne peut rien donner, rien ouvrir, rien modifier d'autre. Si elle « appelle la garde », le jeu fait accourir les gardes proches.

### Coût
Réglages dans `server/config.json` :
- `routes.dialogue.model` : `claude-opus-5-5` par défaut (4 $ / 20 $ par million de tokens). Pour réduire fortement le coût : `claude-haiku-5-5` (0,10 $ / 0,50 $) ou `claude-sonnet-5-5` (2 $ / 10 $). On peut aussi passer `CHRONOS_DIALOGUE_MODEL=claude-haiku-5-5` au lancement.
- `routes.dialogue.maxTokens` (plafond de sortie par appel, réflexion comprise) et `effort`.
- `budget.dailyLimitUsd` (2 $ par défaut) : au-delà, le proxy répond « budget atteint » et le jeu passe aux répliques locales jusqu'au lendemain.
- `rateLimit.perMinute`, cache de réponses (`cacheTtlSeconds`), et le préfixe stable du prompt (bible + règles + fiche) est mis en cache côté API.
- Le prix de lecture du cache pour Haiku 5.5 dans `pricesPerMTok` est une estimation (10 % du prix d'entrée), à ajuster si besoin.

Le panneau **F3** affiche le mode (IA / simulée / repli), le modèle, les appels, les tokens et la dépense du jour.

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

## Mémoire, rumeurs et réputations (J3)
- Chaque acte du joueur devient un **événement** dans le journal du monde (`sim/social/events.ts`), avec son vrai auteur et son auteur apparent.
- **Témoins** : il faut être à portée (24 m le jour, 9 m la nuit), regarder dans la bonne direction (ou être à moins de 5 m), ne pas avoir de mur entre soi et la scène, et être éveillé et dehors.
- **Mémoire** : chaque témoin garde un souvenir (importance 0 à 1). Les souvenirs s'effacent avec le temps, plus lentement chez les rancuniers ; les souvenirs importants de plus de 2 jours sont condensés en une impression durable.
- **Rumeurs** : les habitants se racontent ce qu'ils savent quand ils sont côte à côte ou dans le même bâtiment, après un délai de 20 minutes de jeu. À chaque relais la confiance baisse (×0,85) et l'histoire peut être exagérée, perdre son lieu ou, rarement, accuser quelqu'un d'autre.
- **Réputations** : quatre groupes de −100 à +100. Elles ne bougent que lorsque quelqu'un **apprend** l'acte : un méfait sans témoin ne change rien. Un même événement est plafonné par groupe.
- Les règles (actes, poids, plafonds) sont dans `client/data/packs/medieval/acts.json`.

## Pouvoirs et conséquences (J5)
Tout est décrit dans `client/data/powers.json` : chaque capacité est une combinaison de briques du moteur (bulle de temps, gel, rembobinage, saisie, poussée, invisibilité), avec son coût, son délai et sa portée. On ajoute ou on règle un pouvoir sans toucher au moteur. Les quatre pouvoirs V2 y figurent, désactivés.

- **Énergie** : une jauge commune (100), qui se recharge seule, plus vite à l'arrêt. L'ombre et la télékinésie la consomment tant qu'elles sont actives.
- **Temps** : ralentir (bulle où tout va quatre fois moins vite, sauf Kael), geler (3 personnes et les objets proches, 4 s), rembobiner (les environs reviennent 4 s en arrière : positions, souvenirs, réputations et bourse ; l'événement reste dans le journal du monde, marqué « annulé »).
- **Télékinésie** : saisir un objet (tonneau, caisse, sac, seau), le porter, le lancer ; repousser quelqu'un. Un objet lancé qui touche quelqu'un est une agression.
- **Ombre** : invisible pour les habitants et la garde ; frapper ou menacer révèle Kael.
- **Interactions** : un objet gelé garde en réserve la poussée reçue et la libère au dégel ; un objet lancé ralentit dans une bulle de temps ; un vol sous l'ombre n'a aucun témoin.
- **Deux voies** : trois actes héroïques (aumône) ou trois actes sombres (vol, menace, coup…) débloquent la branche correspondante de chaque pouvoir. Les deux voies ne s'excluent pas.
- **Devant témoins** : utiliser un pouvoir en public est un événement comme un autre ; il inquiète les villageois et surtout l'Ordre des mages.

Conséquences visibles (`client/data/packs/medieval/consequences.json`) :
- **Garde** : en dessous de −30, les gardes qui voient Kael le poursuivent ; en dessous de −60, toute la garde s'y met. Rattrapé, il perd sa bourse et passe la nuit au cachot.
- **Peur** : les actes qui font peur terrorisent le quartier où ils ont lieu. Au-delà d'un seuil, les habitants restent chez eux, fuient à l'approche de Kael, et le quartier se couvre de caisses renversées. La peur retombe avec le temps.
- **Trahison** : un personnage clé qui appréciait Kael et dont l'opinion s'effondre va le dénoncer à la garde.
- **Marché en fête** : très aimé des villageois, Kael voit la place se pavoiser.

## Écho du passé et faux visage (J6)
Ces deux pouvoirs ne créent rien : ils lisent et écrivent dans le même journal d'événements que tout le reste du monde.

- **Écho du passé (8)** : montre jusqu'à cinq scènes survenues dans un rayon de 12 m depuis 24 h. Chaque scène est lue telle quelle dans le journal, sans IA : le véritable auteur (même s'il portait un autre visage), les instants effacés par un rembobinage, et l'endroit où le temps s'est replié. Des silhouettes apparaissent là où la scène a eu lieu, et un panneau la décrit en clair.
  - Voie héroïque, *Œil du témoin* : remonte deux jours en arrière et nomme les témoins.
  - Voie sombre, *Secrets monnayables* : chaque méfait ou secret d'autrui vu dans l'écho devient un moyen de pression. La touche N près de cette personne devient « faire chanter » (15 pièces, une fois).
- **Changer de visage (9)** : rester à moins de 4 m de quelqu'un pendant 3 s pour mémoriser son visage, puis le viser. Le masque tient 60 minutes de jeu.
  - Tout acte commis sous ce visage est attribué à la personne imitée : souvenirs des témoins, rumeurs et opinions la visent elle, pas Kael.
  - Deux accusations de crime, ou une seule devant un garde, et la garde l'emmène au cachot pour 18 h à la place de Kael.
  - La personne imitée et ses proches démasquent Kael s'ils le voient de face à moins de 7 m. Se transformer à portée de voix fait se retourner les gens.
  - La garde qui recherche Kael ne reconnaît pas ce visage.
  - En dialogue, le personnage croit parler à la personne imitée et réagit selon ce qu'il pense d'elle.
  - Voie héroïque, *Masque fidèle* : durée doublée. Voie sombre, *Masque parfait* : les proches doivent être tout près pour démasquer.
- **Le village vit sans Kael** : les voleurs de la guilde font les poches là où ils « travaillent », et un garde qui s'attarde à discuter avec un membre de la guilde laisse la trace d'une rencontre secrète. Ces faits passent par le même journal : l'Écho a donc de vraies choses à révéler, et un voleur pris sur le fait finit au cachot.

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
npm test           # tests unitaires du jeu et du proxy (Vitest)
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
| 1 / 2 / 3 | temps : ralentir / geler / rembobiner |
| 4 / 5 | télékinésie : saisir puis lancer l'objet visé / repousser la personne visée |
| 6 | ombre : devenir invisible (appuyer de nouveau pour réapparaître) |
| 7 | boucle cruelle (voie sombre, à débloquer) |
| 8 | écho du passé : revoir ce qui s'est passé ici |
| 9 | changer de visage : prendre celui de la personne visée (appuyer de nouveau pour l'ôter) |
| F | parler à un habitant (texte libre avec les personnages clés) |
| E / V / N / B | près d'un habitant : faire l'aumône / voler / menacer (ou faire chanter) / frapper |
| J | journal : réputations et ce que l'on sait de toi |
| T | vitesse du temps : ×1 → ×10 → ×60 → figé |
| G | qualité graphique basse / haute |
| F3 | panneau debug (FPS, draw calls, position, habitants dehors / à l'intérieur) |
| Échap | pause |

## Structure
```
chronos/
├─ shared/          # types communs (format des packs d'époque…)
├─ tools/           # import des assets CC0 (KayKit, @pmndrs/assets)
├─ server/          # proxy Node pour l'API Claude (la clé ne quitte jamais ce processus)
├─ client/          # le jeu (Vite + Three.js)
│  ├─ src/core/     # boucle à pas fixe, RNG à graine, entrées
│  ├─ src/sim/      # simulation déterministe (horloge, joueur, collisions, carte)
│  ├─ src/sim/agents/  # habitants : besoins, emplois du temps, décisions, déplacements
│  ├─ src/sim/nav/     # grille de navigation + A*
│  ├─ src/sim/social/  # événements, témoins, mémoire, rumeurs, réputations
│  ├─ src/sim/powers/  # moteur de pouvoirs (données → briques), historique pour le rembobinage
│  ├─ src/sim/physics.ts, consequences.ts  # objets mobiles ; règles de conséquences
│  ├─ src/render/   # rendu Three.js (village procédural, personnage, caméra, ciel)
│  ├─ src/ui/       # HUD
│  ├─ data/         # palette, préréglages qualité, manifeste des modèles
│  ├─ data/packs/medieval/   # pack d'époque : manifeste, plan du village, visuels
│  ├─ public/assets/         # modèles glTF, HDRI, normal maps (CC0)
│  └─ test/         # tests unitaires
├─ e2e/             # test de fumée Playwright
└─ docs/
```

## Avancement
- [x] J1 : scène 3D, personnage jouable, déplacement, caméra, cycle jour/nuit
- [x] J2 : habitants avec routines et foule légère (12 personnages clés + 102 figurants)
- [x] J3 : mémoire, rumeurs, réputations
- [x] J4 : dialogues IA via le proxy
- [x] J5 : pouvoirs (temps, télékinésie, ombre) et conséquences
- [x] J6 : écho du passé, changement de visage
- [ ] J7 : missions générées et validées
- [ ] J8 : sauvegarde, réglages de coût, finitions
