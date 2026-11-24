# « DERNIER SIGNAL » : partie 2, la civilisation (le cœur du jeu)

Ce document complète le prompt principal et le prompt des missions. Il **change la structure du jeu** : l'aventure dans la station et l'épave devient l'**acte 1**, et la plus grande partie du jeu se passe sur la planète, où R-12 devient le **gouverneur** d'une civilisation qu'il fait naître. Lis-le en entier avant de toucher au code, puis propose-moi un plan de mise à jour du projet.

L'ambiance s'inspire de séries de survie politique comme *The 100* : des clans qui se méfient les uns des autres, des ressources rares, des alliances fragiles, des décisions difficiles sans bonne réponse. Ne reprends **aucun** nom, personnage, lieu ou élément propre à cette série : tout doit être original.

---

## 1. Nouvelle structure du jeu

- **Acte 1 · Le signal** (environ 1 heure) : prologue, Zone 1 (station Halcyon), Zone 2 (épave de l'Asterion), descente sur la planète. On garde les missions 0 à 17 du prompt des missions, en resserrant si nécessaire.
- **Acte 2 · La fondation** (la majorité du jeu, environ 5 heures ou plus) : sur la planète, R-12 découvre la balise. Elle ne l'appelait pas pour partir, mais pour **faire naître quelque chose**. R-12 réveille, construit et rassemble trois espèces, et doit les faire vivre ensemble.
- Les missions 18 à 24 (campement, brume, spores, pluie, balise) deviennent le **début de l'acte 2**. Le choix « Répondre / Rester » est retiré et remplacé par les **fins de gouvernance** (section 8).

## 2. Les trois espèces

Chaque espèce a son rôle, son apparence, son architecture, ses forces et ses faiblesses. Aucune n'est « méchante » : elles ont des besoins différents.

### Les Forgés (robots)
- **Origine** : R-12 les construit lui-même avec les pièces des épaves (station, Asterion, capsules).
- **Rôle** : construction, extraction des minerais, production d'énergie, réparation, défense.
- **Forces** : efficaces, infatigables, loyaux au départ.
- **Faiblesses** : ne produisent pas de nourriture, dépendent de l'énergie, et peuvent devenir froids ou trop obéissants. Plus tard, certains réclament leur **autonomie** (ils ne veulent plus seulement obéir à R-12).
- **Apparence** : variantes du design choisi pour R-12, chacune adaptée à son métier (grands porteurs, petits ouvriers rapides, gardiens). Métal récupéré, assemblages visibles, lumières de la couleur de leur fonction.
- **Architecture** : ateliers, forges, tours d'énergie, structures métalliques assemblées à partir des épaves.

### Les Vaëls (créatures natives de la planète)
- **Origine** : peuple natif bioluminescent, à l'origine semi-sauvage, réparti en **trois clans** selon leur territoire :
  - **Clan des Racines** (forêt lumineuse) : guérisseurs, cultivateurs, pacifiques mais très attachés à leurs terres sacrées.
  - **Clan des Hauteurs** (falaises et canyons) : chasseurs, éclaireurs, fiers, méfiants envers les étrangers.
  - **Clan des Eaux** (marais et lacs) : pêcheurs et commerçants, pragmatiques, prêts à négocier avec tout le monde.
- **Rôle** : nourriture, plantes médicinales, connaissance de la planète, lien spirituel avec la balise.
- **Évolution** : ils **évoluent pendant le jeu** grâce aux échanges avec R-12 : nomades, puis villages, puis culture propre (langage de lumière, art, rituels). Leur apparence, leurs outils et leurs villages changent visiblement à chaque ère.
- **Apparence** : créatures élancées, à quatre membres, peau sombre parcourue de motifs lumineux qui changent de couleur selon leurs émotions (bleu calme, rouge colère, or joie). C'est leur langage. Design original, crédible et élégant, pas effrayant.
- **Architecture** : structures organiques, végétation tressée, lumières vivantes, à flanc de falaise ou sur pilotis.

### Les Éveillés (humains)
- **Origine** : l'équipage précédent de l'Asterion (celui arrivé des années avant la Halcyon) n'est pas mort : une **vingtaine d'humains** dorment dans des capsules de sommeil enfouies près de la balise. R-12 les réveille progressivement.
- **Rôle** : science, médecine, ingénierie avancée, art, et **diplomatie**.
- **Forces** : inventifs, capables de grandes choses.
- **Faiblesses** : divisés, effrayés par les Vaëls, méfiants envers les machines, et ils veulent décider eux-mêmes.
- **Deux factions** qui s'opposent :
  - **Le Bloc de l'Aube** : veut une colonie humaine forte, protégée par des murs, et des règles strictes. Dirigé par une ancienne officière autoritaire mais sincère.
  - **Les Dérivants** : veulent vivre avec les Vaëls, refusent la hiérarchie et se méfient des Forgés. Dirigés par un jeune médecin idéaliste.
- **Apparence** : humains en tenues de survie usées, rafistolées avec du matériel des Vaëls et des pièces de robots au fil du temps. Voir la section 7 sur le réalisme.
- **Architecture** : modules préfabriqués récupérés, puis bâtiments plus solides, puis une vraie ville.

Au total : **7 groupes** (Forgés, trois clans vaëls, deux factions humaines, et plus tard les Forgés autonomes s'ils font sécession). Chacun a un **chef** avec un nom, une personnalité, des objectifs et des limites à ne pas franchir.

## 3. Le rôle de gouverneur

Le joueur alterne entre deux modes, avec une transition de caméra fluide :
- **Mode exploration** : R-12 à la troisième personne, comme dans l'acte 1. Il parcourt la planète, découvre des ressources, des ruines, des souvenirs, rencontre les chefs, règle les problèmes sur place.
- **Mode gouverneur** : vue du dessus inclinée (caméra libre, zoom, rotation), pour construire les bases, attribuer les tâches, gérer les ressources et consulter le conseil.

### Ce que gère le joueur
- **Ressources** : énergie, métal, nourriture, eau, médicaments, **cristaux de la balise** (rares, convoités par tous).
- **Bases** : construire et améliorer des bâtiments sur un terrain réel, avec placement libre sur grille souple : habitats, serres, ateliers, générateurs, entrepôts, infirmerie, murs et tours, marché, lieu de conseil, observatoire, sanctuaire. Chaque espèce a ses bâtiments propres, et des **bâtiments communs** se débloquent quand deux espèces se font assez confiance.
- **Territoires** : la carte de la planète est divisée en régions. Certaines sont sacrées pour un clan, d'autres riches en ressources : s'y installer a des conséquences.
- **Population** : chaque habitant a un métier, un état (santé, moral) et une appartenance. Les habitants vivent réellement dans les bases (ils marchent, travaillent, se reposent, se rassemblent la nuit autour des lumières).
- **Temps** : un cycle jour-nuit sur la planète, avec des **saisons** (saison des pluies, saison des tempêtes de débris, longue nuit). Pause et accélération du temps (×1, ×2, ×4).

### Les relations
- Un **tableau des relations** entre tous les groupes : confiance, peur, rancune, dette. Il évolue selon les décisions du joueur et les événements.
- Chaque groupe a une **loyauté envers R-12**. Trop basse : grèves, départs, sabotage, rébellion.
- Un indicateur global de **paix**, et une **tension** qui peut dégénérer en affrontements si elle reste trop haute (le joueur doit intervenir, négocier, ou accepter les conséquences).

### Le conseil et les décisions
- Régulièrement, R-12 réunit le **conseil** : une scène dans un lieu qui évolue avec la civilisation (cercle de pierres au début, grande salle à la fin). Les chefs présents s'expriment, avec leurs couleurs et leurs postures.
- **Décisions difficiles** sous forme de dilemmes, avec 2 à 4 options, des conséquences immédiates et des **conséquences différées** (qui reviennent plusieurs heures de jeu plus tard). Exemples à développer :
  - Un Vaël du Clan des Hauteurs a tué un humain en défendant son territoire. Le Bloc de l'Aube exige une sanction exemplaire ; le clan exige qu'on respecte ses lois.
  - La serre ne peut nourrir que la moitié des groupes pendant la longue nuit. Qui rationner ?
  - Les Forgés demandent le droit de refuser un ordre. Accepter, refuser, ou négocier des limites ?
  - Une épidémie de spores touche les humains ; le remède exige de raser une partie de la forêt sacrée du Clan des Racines.
  - Les Dérivants ont caché des réfugiés vaëls bannis par leur propre clan.
  - Mentir à tout le monde pour éviter une panique, ou dire la vérité sur une menace ?
  - Réveiller tous les humains d'un coup (plus de bras, plus de bouches à nourrir, plus de tensions) ou progressivement ?
- **Lois** : le joueur peut instaurer, modifier ou abolir des lois (partage des ressources, couvre-feu, liberté de circulation, justice commune ou justice par clan, droits des Forgés). Chaque loi plaît à certains et en fâche d'autres.
- **Diplomatie** : traités, échanges, pactes de défense, territoires partagés, fêtes communes. Les accords peuvent être trahis.

### Les crises
Événements majeurs, scénarisés et aléatoires : tempête de débris qui détruit des bâtiments, migration d'une espèce sauvage, pénurie d'énergie, sabotage, coup de force d'une faction, schisme des Forgés, découverte d'une ruine qui révèle un secret sur la balise.

## 4. L'évolution de la civilisation

Quatre **ères**, qui transforment visuellement la planète :
1. **Survie** : feux, abris de fortune, méfiance totale, quelques Forgés.
2. **Fondation** : premières bases solides, premiers échanges, premières lois.
3. **Expansion** : villes, routes éclairées entre les bases, culture vaël qui s'épanouit, technologies mêlant les trois espèces.
4. **Unité ou rupture** : selon les choix du joueur, une civilisation commune lumineuse, ou des cités séparées par des murs.

La nuit, la vue d'ensemble de la planète doit montrer les lumières de la civilisation qui grandit : c'est un moment visuel clé, à soigner (bloom, brouillard, reflets dans l'eau, aurores).

## 5. L'histoire continue

- La balise reste au centre : elle réagit aux choix de R-12 et révèle progressivement pourquoi elle voulait faire naître une civilisation (à imaginer avec moi : propose 2 ou 3 idées de vérité finale).
- **Souvenirs de l'équipage** : pas jouables, mais de **courtes scènes** (hologrammes ou flashs à l'écran, 20 à 40 secondes) qui reviennent de temps en temps, surtout au moment des grandes décisions. Exemple : avant de trancher une sanction, R-12 se souvient d'Ilse qui a dû choisir qui envoyer sur l'Asterion. Elles aident à comprendre l'histoire de la Halcyon et donnent un sens humain aux choix du joueur. Prévois-en une vingtaine sur tout le jeu.
- Les **chefs** ont leur propre arc : ils peuvent devenir des alliés, des rivaux, mourir, être remplacés, trahir.

## 6. Le gameplay de l'acte 1, amélioré

Ajoute à chaque zone de l'acte 1 une **mécanique propre** :
- **Station Halcyon** : la gestion de l'énergie. Couper une section pour en alimenter une autre (portes, lumières, gravité, chauffage), avec des choix qui ouvrent ou ferment des chemins.
- **Épave de l'Asterion** : les vagues de débris deviennent aussi un **outil** (s'accrocher à un gros débris avec les bottes magnétiques pour traverser un gouffre).
- **Planète** : les plantes réagissent au **son** (bips de R-12) : elles s'éclairent, s'ouvrent ou se referment, ce qui sert aux énigmes et prépare la relation avec les Vaëls.

## 7. Réalisme des personnages : contrainte importante

- **Les robots** : le plus facile à rendre réaliste. Matières PBR très soignées, usure, éclats de lumière.
- **Les Vaëls** : un design non humain permet d'être très crédible (on ne compare pas à un modèle connu). Soigne la peau (subsurface scattering simulé, motifs lumineux animés par shader), les animations et les expressions de lumière.
- **Les humains** : c'est le plus difficile dans un navigateur, surtout sur iPad. Ne cherche pas un réalisme photographique des visages, qui tomberait dans la « vallée de l'étrange ». Vise des humains **réalistes stylisés** : bonnes proportions, tenues et matières très détaillées, capuches, casques, masques respiratoires ou visières selon les situations, éclairage cinématographique, animations naturelles. Si tu peux utiliser des personnages **CC0** de qualité (vérifie la licence) et des animations libres, propose-le-moi.
- Beaucoup d'habitants à l'écran : utilise des niveaux de détail (LOD) agressifs et l'instanciation, avec des personnages détaillés seulement en gros plan (conseil, dialogues).

## 8. Les fins

Fins de gouvernance, calculées selon l'état de la civilisation à la fin de l'ère 4 (paix, confiance entre les groupes, liberté des Forgés, survie des clans, choix moraux) :
- **La Fédération** : les trois espèces vivent ensemble, R-12 se retire et laisse un conseil commun gouverner. Fin lumineuse.
- **L'Ordre de fer** : la paix règne, mais imposée par les Forgés et par la force. Calme et inquiétant.
- **La Rupture** : la civilisation se divise en cités ennemies. R-12 n'a pas réussi, mais il reste des raisons d'espérer.
- **L'Exode** : R-12 répond enfin au signal et quitte la planète en laissant une civilisation encore fragile.
- Une **fin secrète**, débloquée si le joueur a retrouvé tous les souvenirs de l'équipage et atteint la Fédération : la vérité complète sur la balise et sur R-12.

Chaque fin a une cinématique, et un écran final récapitule la civilisation : population, ère atteinte, décisions marquantes, souvenirs retrouvés.

## 9. Interface du mode gouverneur

- Sobre et lisible sur iPad : ressources en haut, panneau de construction en bas, cartes des chefs et tableau des relations accessibles en un toucher.
- Icônes claires, couleurs par espèce (Forgés : cyan, Vaëls : vert et or, Éveillés : blanc et orange).
- Notifications discrètes pour les événements, plus marquées pour les crises.
- Tout fonctionne au doigt, à la manette (curseur, raccourcis sur les gâchettes) et à la souris.

## 10. Bouton « Gouverner » : accès direct au mode gouverneur

- Sur l'**écran titre**, à côté de « Nouvelle partie » et « Continuer », ajoute un bouton **« Gouverner »** qui lance directement l'**acte 2**, sans passer par l'acte 1.
- Il propose deux options :
  - **Reprendre ma civilisation** : reprend la dernière partie sauvegardée du mode gouverneur, directement en vue gouverneur.
  - **Nouvelle fondation** : démarre l'acte 2 depuis le début. R-12 est déjà sur la planète avec le jetpack, les bottes magnétiques et le scanner. Les souvenirs de l'acte 1 sont marqués comme non trouvés : un court résumé animé (30 secondes environ) explique l'essentiel de l'histoire, qu'on peut passer.
- Le bouton est disponible dès la première partie, sans avoir besoin de finir l'acte 1.
- Dans le **menu pause**, un raccourci « Vue gouverneur » permet aussi de passer à tout moment du mode exploration au mode gouverneur pendant l'acte 2 (en plus de la touche dédiée).
- Ce bouton doit fonctionner dès le **prototype du mode gouverneur** (étape 2 de l'organisation du travail), pour que je puisse le tester directement.

## 11. Organisation du travail

Ce projet devient beaucoup plus grand. Procède dans cet ordre, avec un point de validation à chaque étape :
1. Mets à jour le plan général du projet et montre-le-moi.
2. **Prototype du mode gouverneur**, simple visuellement : une base, deux groupes, les ressources, trois décisions du conseil, le tableau des relations. **Stop** : je teste que c'est amusant avant qu'on investisse dans les graphismes.
3. Atelier des designs des Vaëls et des humains (comme l'atelier des robots), **stop** pour que je choisisse.
4. Acte 1 complet.
5. Acte 2 par ère, chacune validée avant la suivante.
6. Fins, équilibrage, performances, finitions.

À chaque étape : lien GitHub Pages, ce qui est fait, ce qui reste, les problèmes. Si un choix d'histoire, de personnage ou de règle n'est pas couvert ici, propose-moi 2 ou 3 options courtes plutôt que de décider seul.
