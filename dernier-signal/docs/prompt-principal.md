# Projet : « DERNIER SIGNAL » — jeu d'aventure-exploration spatial en 3D (navigateur)

> **Mise à jour** : pour l'acte 2, `docs/prompt-acte2-complet.md` fait foi. Les « deux fins » (section 6) sont retirées : le jeu ne se termine plus. La musique (section 9) reste dans l'acte 1 seulement ; l'acte 2 n'a que les sons du monde. R-12 parle dans l'acte 2 (voix robotique).

Tu vas construire avec moi un jeu 3D jouable dans le navigateur, sur iPad (Safari) en priorité, et aussi sur ordinateur. Je m'appelle Yosh, je ne suis pas développeur : explique-moi simplement ce que tu fais, en français, et arrête-toi aux points de validation indiqués plus bas pour me montrer le résultat avant de continuer.

Objectif n°1 : **le rendu le plus réaliste possible dans un navigateur**. Chaque décision technique doit servir la qualité visuelle, sans faire tomber le jeu sous 30 images par seconde sur iPad.

---

## 1. Le concept

- **Genre** : aventure-exploration, rythme lent, ambiance **mystérieuse**. Pas de combat.
- **Héros** : un petit robot de maintenance, **le dernier survivant**. Il se réveille seul et découvre peu à peu ce qui est arrivé à l'équipage.
- **Durée** : **2 heures ou plus** pour finir le jeu.
- **Trois zones**, chacune avec sa couleur dominante et sa météo propre (voir section 4).
- **Fin au choix** : deux fins, selon ce que le joueur a découvert (voir section 6).

## 2. L'histoire (squelette à enrichir)

Le robot (nom de série : **R-12**, à me faire valider) se réactive dans la station orbitale **Halcyon**, plongée dans le noir. Aucune trace de vie. La station orbite autour d'une planète inconnue ; non loin dérive l'épave d'un immense vaisseau, l'**Asterion**.

Le joueur reconstitue ce qui s'est passé à travers trois sources :
1. **Journaux audio et textes** laissés par l'équipage (une quinzaine, courts, 20 à 40 secondes chacun).
2. **Hologrammes** : des scènes rejouées en lumière bleue translucide, avec des silhouettes humaines, déclenchées près de projecteurs.
3. **Indices dans le décor** : objets laissés en plan, messages griffonnés, portes forcées, traces, photos. Le décor doit raconter sans texte.

Trame proposée (à garder mystérieuse, révélations progressives) :
- **Zone 1 · Station Halcyon** : l'équipage a reçu un signal venu de la planète, puis a envoyé une équipe sur l'Asterion. Quelque chose a mal tourné.
- **Zone 2 · Épave de l'Asterion** : le vaisseau a été frappé par une tempête de débris en s'approchant de la planète. Les survivants se sont réfugiés à la surface.
- **Zone 3 · Planète** : on découvre leur dernier campement et l'origine du signal. La vérité finale : ce que le signal était vraiment, et pourquoi le robot a été réactivé.

Écris tous les textes des journaux en français, avec des noms d'équipage originaux (5 ou 6 personnages avec des personnalités distinctes). Ton sobre, humain, jamais spectaculaire.

## 3. Le robot : PREMIÈRE ÉTAPE, l'atelier des designs

Avant de construire le jeu, crée une page **« Atelier »** : un showroom 3D sombre, sol réfléchissant, éclairage de studio (lumière principale, contre-jour cyan, lumière de remplissage), où 4 robots tournent lentement sur des socles. Je pourrai les faire tourner au doigt et en choisir un.

Les 4 propositions (tailles comparables, environ 1 mètre de haut, très soignées, arêtes biseautées, matières PBR réalistes, vis, joints, éraflures, usure sur les bords) :
- **A · « Pixel »** : orange et blanc, corps compact, tête-écran noire brillante avec deux grands yeux lumineux cyan qui clignent, petit sac à dos, antenne. Inspiré du style « robot mignon de film d'animation ».
- **B · « Rouille »** : même gabarit mais vieux et rafistolé, peinture écaillée, une antenne tordue, une plaque de métal différente sur l'épaule, un œil qui grésille parfois.
- **C · « Halo »** : épuré, blanc nacré, presque sans aspérités, une seule bande lumineuse en guise de visage, déplacement très fluide.
- **D · « Orbe »** : corps sphérique qui se déplie : se met en boule pour rouler, se déploie pour marcher.

Chaque robot doit avoir ses animations : attente (respire, regarde autour), marche, saut, propulsion du jetpack, flottement en apesanteur, scan. Les yeux et les lumières doivent émettre de la lumière (bloom).

**Arrête-toi après l'atelier** et donne-moi le lien pour que je choisisse.

## 4. Les trois zones

Le jeu est **ouvert à l'intérieur de chaque zone** (pas un couloir), avec des zones secrètes et des améliorations qui ouvrent de nouveaux chemins (logique d'exploration à la Metroid, mais simple).

### Zone 1 · Station Halcyon — dominante **bleu glacé et cyan**
- Couloirs modulaires, salle de contrôle, quartiers de l'équipage, serre hydroponique morte, hangar, baie d'observation avec grande vitre donnant sur la planète et les étoiles.
- Lumière : noir presque total au réveil, puis rétablissement progressif de l'énergie, néons qui clignotent, lumières de secours rouges ponctuelles, faisceau de la lampe du robot.
- Météo de la zone : **vapeur** qui s'échappe des conduits, **étincelles** de câbles arrachés, givre sur les vitres, coupures de courant.
- Dangers : arcs électriques, brèche vers le vide qui aspire (il faut s'accrocher ou fermer une cloison), sas qui s'ouvrent.
- Amélioration trouvée : **jetpack** (petits bonds, jauge d'énergie qui se recharge).

### Zone 2 · Épave de l'Asterion — dominante **rouge et ambre**
- Vaisseau immense éventré, carcasse ouverte sur l'espace, ponts brisés, cargaisons flottantes, réacteur éteint géant.
- Grandes zones en **apesanteur** : le robot flotte et se propulse dans les trois dimensions ; certaines parties gardent une gravité artificielle qui fonctionne mal (gravité qui s'inverse par intermittence).
- Météo de la zone : **tempête de débris** qui traverse par vagues, éclairs lointains de la planète, poussière métallique en suspension, alarmes rouges qui tournent.
- Dangers : débris en mouvement, vide spatial, sections qui se détachent, zones irradiées (à traverser vite).
- Amélioration trouvée : **bottes magnétiques** (marcher sur les parois et les plafonds métalliques).

### Zone 3 · Planète — dominante **vert émeraude et violet**
- Surface nocturne sous un **ciel étoilé** très dense, deux lunes, aurores. Végétation extraterrestre **bioluminescente**, roches, flaques et eaux sombres qui reflètent le ciel, campement abandonné de l'équipage, structure ancienne d'où vient le signal.
- Météo de la zone : **change pendant l'exploration** : nuit claire, puis brume épaisse au ras du sol, puis **pluie fine** (gouttes, sol mouillé et brillant, flaques qui se forment), puis éclaircie avec aurores.
- Dangers : chutes, crevasses, plantes qui libèrent des spores aveuglantes, eau trop profonde.
- Amélioration trouvée : **scanner amélioré** (révèle les traces invisibles de l'équipage).

## 5. Mécaniques de jeu

- Déplacements : **marcher, sauter, jetpack** (jauge), **apesanteur** (6 directions) dans la zone 2, bottes magnétiques.
- **Interaction** : un bouton pour activer terminaux, portes, leviers, journaux, hologrammes.
- **Scan** : un bouton qui envoie une onde lumineuse (effet visuel soigné) et met en surbrillance les indices et objets importants à proximité.
- **Énigmes simples** liées au décor : rétablir l'énergie en routant les câbles, réaligner une antenne, reconstituer un code à partir d'indices trouvés, ouvrir un sas en dépressurisant une salle.
- **Collection** : journaux, hologrammes et indices comptés dans un **carnet** consultable (menu pause), avec une carte de chaque zone qui se dévoile en explorant.
- **Pas de mort punitive** : chute ou danger = le robot se réactive au dernier point de contrôle, avec un court effet de redémarrage à l'écran.
- **Sauvegarde automatique** (localStorage) à chaque point de contrôle, et reprise de la partie au lancement.

## 6. Les deux fins

À la fin, face à la source du signal, le joueur fait un choix :
- **Fin « Répondre »** : le robot répond au signal et part vers l'inconnu. Disponible pour tous.
- **Fin « Rester »** : le robot comprend toute la vérité et choisit de veiller sur la mémoire de l'équipage. **Débloquée seulement si le joueur a trouvé au moins 80 % des journaux et hologrammes.** Elle révèle la dernière pièce du mystère.

Chaque fin a une courte cinématique (caméra animée, musique, texte final), puis un écran de crédits avec le pourcentage de découverte.

## 7. Direction artistique et rendu (le plus important)

### Moteur et technique
- **Three.js** (dernière version stable) avec **Vite** et **TypeScript**.
- `renderer.toneMapping = ACESFilmicToneMapping` (ou AgX si le rendu est meilleur), espace couleur sRGB, rendu physique (PBR) partout : `MeshStandardMaterial` / `MeshPhysicalMaterial` avec **cartes de couleur, normales, rugosité, métal et occlusion ambiante**.
- Éclairage : environnements HDR (PMREM) par zone pour les reflets et la lumière ambiante, lumières ponctuelles et projecteurs avec ombres douces (PCFSoft ou VSM), lumières émissives (néons, écrans, végétation) qui éclairent réellement autour.
- **Post-traitement** (bibliothèque `postprocessing` de pmndrs si possible, sinon les passes de Three.js) :
  - **Bloom sélectif** pour les lueurs et halos (yeux du robot, néons, hologrammes, plantes) : indispensable.
  - **Brouillard volumétrique** et **rayons de lumière** (god rays) dans la vapeur, la poussière et la brume : indispensable. Brouillard de hauteur partout ; vrai brouillard volumétrique en raymarching à basse résolution pour le préréglage haut.
  - **Reflets** : sols métalliques et mouillés, vitres, flaques. Reflets planaires (Reflector) sur les grandes surfaces planes importantes, sondes d'environnement (cubemaps) pour le reste, SSR seulement sur ordinateur puissant.
  - Occlusion ambiante (SSAO/N8AO), aberration chromatique très légère, grain de film léger, vignettage, profondeur de champ pendant les cinématiques.
- Ciel spatial : champ d'étoiles dense en plusieurs couches avec scintillement, nébuleuses générées par shader dans la couleur de la zone, planète visible depuis l'espace avec atmosphère (diffusion sur le limbe).
- Hologrammes : shader bleu translucide avec lignes de balayage, scintillement, légère distorsion.
- Particules : vapeur, étincelles avec rebond, débris flottants, poussière dans les faisceaux, gouttes de pluie, spores lumineuses.

### Textures et modèles : Poly Haven
- Utilise **Poly Haven** (licence CC0) via son API publique (`api.polyhaven.com`) pour télécharger :
  - **Textures** : métal peint, métal rouillé, tôle ondulée, plaques de métal, béton, roches, sol, et toute matière utile aux trois zones. Cherche dans l'API les plus adaptées (par exemple `rusty_metal_02`, `rusty_painted_metal`, `corrugated_iron`, et des textures de roche et de sol pour la planète).
  - **HDRI** : utilise-les pour l'éclairage d'ambiance et les reflets en intérieur, et pour la planète de nuit si une HDRI nocturne convient. Le ciel visible de l'espace reste le champ d'étoiles généré.
  - **Modèles** quand ils conviennent (caisses, barils, outils, petit mobilier).
- Résolutions : **1K pour iPad, 2K pour ordinateur**, chargées selon le préréglage. Compresse les textures (KTX2 / Basis si possible) et les modèles (glTF + Draco ou Meshopt).
- Poly Haven a peu d'objets de science-fiction : construis l'architecture (modules de couloir, panneaux, conduits, portes, consoles) en **kitbashing procédural** dans le code, avec biseaux, détails, câbles, vis, et habille-la avec les textures PBR. Tu peux compléter avec d'autres kits **CC0 uniquement** (par exemple Kenney ou Quaternius) en vérifiant la licence de chacun. Tiens un fichier `CREDITS.md` avec chaque source.

### Préréglages de qualité
- **Auto-détection** au lancement : iPad / mobile → « Équilibré » ; ordinateur avec bonne carte graphique → « Ultra ».
- Un menu Options pour changer : résolution de rendu, qualité des ombres, brouillard volumétrique, reflets, densité des particules, bloom.
- Objectif : **30 images/s minimum sur iPad, 60 sur ordinateur**. Utilise l'instanciation, les niveaux de détail (LOD), le découpage par zones (chargement progressif), et mesure les performances en continu (compteur d'images/s activable).

## 8. Commandes

- **Manette** (Gamepad API, Xbox et PlayStation) : stick gauche = déplacement, stick droit = caméra, A/Croix = saut et jetpack (maintenir), B/Rond = interagir, X/Carré = scanner, gâchettes = monter/descendre en apesanteur, Start = pause et carnet. Petite vibration quand la manette le permet.
- **Écran tactile iPad** : joystick virtuel à gauche, glisser à droite pour la caméra, boutons ronds semi-transparents à droite (Saut, Interagir, Scan), bouton pause en haut. Gros boutons, bien espacés.
- **Clavier et souris** : ZQSD et WASD, souris pour la caméra (verrouillage du pointeur), Espace = saut/jetpack, E = interagir, F = scan, Maj/Ctrl = monter/descendre en apesanteur, Échap = pause.
- Les icônes d'aide à l'écran s'adaptent automatiquement au dernier mode de contrôle utilisé.
- Caméra à la troisième personne, souple, qui évite les murs, et se rapproche dans les couloirs étroits.

## 9. Son

- **Musique d'ambiance** générée en direct avec la Web Audio API : nappes spatiales lentes, différentes pour chaque zone (station froide et métallique, épave grave et inquiétante, planète plus organique), qui montent légèrement lors des découvertes.
- **Bruitages** (synthétisés ou CC0, à créditer) : pas du robot selon le sol, jetpack, bips et petits sons expressifs du robot, portes, sas, étincelles, tempête de débris, pluie, alarmes, ronronnement de la station. Son spatialisé en 3D.
- **Voix pour les journaux** : lus à voix haute en français avec la synthèse vocale du navigateur (`speechSynthesis`), une voix différente par membre d'équipage quand c'est possible, avec le texte affiché en sous-titres. Prévois de pouvoir remplacer plus tard par de vrais fichiers audio.
- Le son ne démarre qu'après le premier toucher ou clic (contrainte de Safari).

## 10. Interface

- Minimaliste et élégante, dans l'esprit de la vidéo d'inspiration : en haut à gauche, nom de la zone et petite barre d'objectif ; marqueur en losange avec la distance en mètres vers l'objectif actuel ; jauge du jetpack discrète près du robot.
- Écran titre avec la station en fond, caméra qui dérive lentement, titre « DERNIER SIGNAL ».
- Menu pause : Reprendre, Carnet (journaux, hologrammes, carte), Options, Commandes.
- Police lisible, textes en français.

## 11. Organisation du travail et points de validation

1. **Mise en place** : dépôt GitHub, Vite + Three.js + TypeScript, déploiement automatique sur **GitHub Pages** à chaque modification, pour que je teste sur mon iPad avec un simple lien.
2. **Atelier des robots** (section 3). → **Stop : je choisis un design.**
3. **Tranche verticale** : les 10 premières minutes de la Zone 1, entièrement finies (graphismes, son, commandes, un journal, un hologramme, une énigme, le jetpack). → **Stop : je teste sur iPad et je donne mon avis.**
4. Zone 1 complète. → Stop.
5. Zone 2 complète. → Stop.
6. Zone 3 complète et les deux fins. → Stop.
7. Finitions : performances, équilibrage, crédits.

À chaque étape : donne-moi le lien GitHub Pages, ce qui a été fait, ce qui reste, et les éventuels problèmes. Teste toi-même le jeu (y compris en simulant un écran d'iPad) avant de me l'envoyer. Si un choix d'histoire ou de design n'est pas couvert par ce document, propose-moi 2 ou 3 options courtes plutôt que de décider seul.
