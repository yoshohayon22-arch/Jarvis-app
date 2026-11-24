# « DERNIER SIGNAL » : partie 2, la civilisation (le cœur du jeu)

Ce document complète le prompt principal et le prompt des missions. Il **change la structure du jeu** : l'aventure dans la station et l'épave devient l'**acte 1**, et la plus grande partie du jeu se passe sur la planète, où R-12 devient le **gouverneur** d'une civilisation qu'il fait naître. Lis-le en entier avant de toucher au code, puis propose-moi un plan de mise à jour du projet.

L'ambiance s'inspire de séries de survie politique comme *The 100* : des clans qui se méfient les uns des autres, des ressources rares, des alliances fragiles, des décisions difficiles sans bonne réponse. Ne reprends **aucun** nom, personnage, lieu ou élément propre à cette série : tout doit être original.

> **Mise à jour (refonte du mode gouverneur et de la planète)** : la partie 3, à la fin de ce fichier, **remplace** tout ce qui la contredit ici, en particulier la vue du dessus (§3), l'interface du mode gouverneur (§9), le bouton « Gouverner » (§10, qui lance désormais R-12 directement dans la vallée) et l'organisation du travail (§11). Les sections remplacées sont signalées par ⟶.

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

⟶ *Remplacé en partie par la partie 3 : plus de vue du dessus ni de « mode gouverneur » séparé ; on gouverne avec R-12 à la troisième personne, depuis sa base (partie 3, §1, §4, §5). Les ressources, bâtiments, territoires, population, temps, relations, conseil, lois, diplomatie et crises ci-dessous restent valables.*

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

⟶ *Remplacé par la partie 3, §4 (écran holographique de la base de R-12, interface minimale en dehors).*

- Sobre et lisible sur iPad : ressources en haut, panneau de construction en bas, cartes des chefs et tableau des relations accessibles en un toucher.
- Icônes claires, couleurs par espèce (Forgés : cyan, Vaëls : vert et or, Éveillés : blanc et orange).
- Notifications discrètes pour les événements, plus marquées pour les crises.
- Tout fonctionne au doigt, à la manette (curseur, raccourcis sur les gâchettes) et à la souris.

## 10. Bouton « Gouverner » : accès direct au mode gouverneur

⟶ *Toujours valable, mais le bouton lance maintenant R-12 directement dans la vallée (partie 3, §11).*

- Sur l'**écran titre**, à côté de « Nouvelle partie » et « Continuer », ajoute un bouton **« Gouverner »** qui lance directement l'**acte 2**, sans passer par l'acte 1.
- Il propose deux options :
  - **Reprendre ma civilisation** : reprend la dernière partie sauvegardée du mode gouverneur, directement en vue gouverneur.
  - **Nouvelle fondation** : démarre l'acte 2 depuis le début. R-12 est déjà sur la planète avec le jetpack, les bottes magnétiques et le scanner. Les souvenirs de l'acte 1 sont marqués comme non trouvés : un court résumé animé (30 secondes environ) explique l'essentiel de l'histoire, qu'on peut passer.
- Le bouton est disponible dès la première partie, sans avoir besoin de finir l'acte 1.
- Dans le **menu pause**, un raccourci « Vue gouverneur » permet aussi de passer à tout moment du mode exploration au mode gouverneur pendant l'acte 2 (en plus de la touche dédiée).
- Ce bouton doit fonctionner dès le **prototype du mode gouverneur** (étape 2 de l'organisation du travail), pour que je puisse le tester directement.

## 11. Organisation du travail

⟶ *Remplacé par la partie 3, §12.*

Ce projet devient beaucoup plus grand. Procède dans cet ordre, avec un point de validation à chaque étape :
1. Mets à jour le plan général du projet et montre-le-moi.
2. **Prototype du mode gouverneur**, simple visuellement : une base, deux groupes, les ressources, trois décisions du conseil, le tableau des relations. **Stop** : je teste que c'est amusant avant qu'on investisse dans les graphismes.
3. Atelier des designs des Vaëls et des humains (comme l'atelier des robots), **stop** pour que je choisisse.
4. Acte 1 complet.
5. Acte 2 par ère, chacune validée avant la suivante.
6. Fins, équilibrage, performances, finitions.

À chaque étape : lien GitHub Pages, ce qui est fait, ce qui reste, les problèmes. Si un choix d'histoire, de personnage ou de règle n'est pas couvert ici, propose-moi 2 ou 3 options courtes plutôt que de décider seul.


---

# Partie 3 · Refonte du mode gouverneur et de la planète

Le prototype du mode gouverneur fonctionne, mais **la planète est très en dessous du reste du jeu** : sol plat et uniforme, arbres en boules, bâtiments en formes simples, brume grise qui écrase tout, vue du dessus sans profondeur. Le reste du jeu est beaucoup plus beau : je veux **le même niveau de qualité graphique sur la planète**, et même plus, car c'est là qu'on passe la majorité du temps.

Ce document **remplace** les sections du document de civilisation qui le contredisent (en particulier la vue du dessus et l'interface du mode gouverneur).

## 1. Le principe : on gouverne avec le robot, pas d'en haut

- **Plus de vue du dessus.** On reste **toujours avec R-12 à la troisième personne**, exactement comme dans l'acte 1. Gouverner, c'est se déplacer dans la vallée, parler aux habitants, construire sur place, intervenir quand ça dégénère.
- Le temps passe **en temps réel**, avec pause et accélération (×1, ×2, ×4) disponibles depuis la base de R-12 et le menu pause.
- Un **cycle jour et nuit** complet. Le jour est lumineux ; la nuit est étoilée, avec deux lunes, des aurores occasionnelles et une végétation bioluminescente qui transforme la vallée.

## 2. La vallée : les graphismes (priorité absolue)

Une **seule grande vallée**, très détaillée, divisée en territoires. Elle doit donner envie de s'arrêter pour regarder.

### Les territoires
- **La forêt lumineuse** (Clan des Racines) : arbres géants extraterrestres aux troncs torsadés et aux feuillages translucides, racines aériennes, sous-bois dense, champignons et fleurs qui s'allument la nuit, rayons de lumière à travers la canopée le jour.
- **Les falaises et canyons** (Clan des Hauteurs) : grandes parois rocheuses stratifiées, corniches, arches naturelles, cascades qui tombent des falaises, vent et poussière.
- **Les marais et le lac** (Clan des Eaux) : eaux calmes qui reflètent le ciel, roseaux et plantes flottantes, brume basse permanente, lucioles, pilotis.
- **La plaine de la balise** : herbes hautes qui ondulent au vent, ruines anciennes à moitié enfouies, la balise au centre. C'est là que R-12 installe sa base, que les Forgés s'établissent et, plus tard, les humains.
- Une **rivière** qui traverse toute la vallée et relie les territoires, avec des rapides et des cascades.

### Exigences de rendu
- **Terrain** : relief réel en heightmap haute résolution, avec érosion simulée, ravines, rochers. Plusieurs matières mélangées selon la pente, l'altitude et l'humidité (herbe, terre, roche, mousse, boue, sable). Utilise les **textures PBR de Poly Haven** (sols, roches, mousses), avec du triplanar mapping sur les falaises pour éviter les textures étirées. Ajoute des détails de surface : cailloux, branches mortes, feuilles au sol.
- **Végétation** : de vraies formes d'arbres et de plantes (troncs, branches, feuillages en plusieurs couches), pas des sphères. Instanciation massive avec niveaux de détail (LOD) et imposteurs au loin. **Herbe dense** autour du joueur, animée par le vent. Les plantes se plient au passage de R-12.
- **Eau** : shader d'eau réaliste (reflets, réfraction, vagues, mousse aux berges et au pied des cascades, assombrissement en profondeur). Cascades animées avec embruns et brume.
- **Ciel et lumière** : ciel physique le jour (diffusion atmosphérique), lever et coucher de soleil colorés, nuit avec champ d'étoiles dense, voie lactée, deux lunes qui éclairent réellement, aurores. Ombres en cascade (cascaded shadow maps) nettes près du joueur, douces au loin.
- **Atmosphère** : brouillard de hauteur qui varie selon les territoires et l'heure (brume du matin dans le marais, air clair sur les falaises), **pas un voile gris uniforme**. Rayons de lumière (god rays) dans la forêt, poussière et pollen en suspension, lucioles la nuit.
- **Bioluminescence** : la nuit, la vallée devient spectaculaire : plantes, champignons, motifs des Vaëls et eau qui s'éclairent, avec un vrai bloom. Ce doit être le moment le plus beau du jeu.
- **Météo** dynamique : pluie (sol mouillé et brillant, flaques, gouttes sur la caméra légère), vent, orages lointains.
- **Performances** : mêmes préréglages qu'ailleurs (« Équilibré » sur iPad, « Ultra » sur ordinateur), 30 images/s minimum sur iPad. Découpe la vallée en tuiles avec chargement progressif, culling et LOD agressifs.

## 3. Les villages : un par espèce

Chaque espèce a **son propre village dans son territoire**, relié aux autres par des chemins qui se forment avec le temps (traces au sol, puis sentiers, puis routes éclairées).
- **Villages vaëls** (un par clan) : architecture organique, végétation tressée, lanternes vivantes, maisons dans les arbres (Racines), creusées dans la falaise (Hauteurs) ou sur pilotis (Eaux).
- **Campement des Forgés** : structures métalliques assemblées à partir des épaves, forges incandescentes, câbles, étincelles, tours d'énergie.
- **Colonie humaine** : modules récupérés des capsules, tentes renforcées, puis bâtiments en matériaux mêlant techniques humaines, vaëls et forgées.
- **Les bâtiments ont l'air réels** : matières PBR, usure, détails, éclairage intérieur visible la nuit par les fenêtres et les ouvertures, fumée, vie autour (objets, outils, linge, réserves).
- Les villages **évoluent visiblement** à chaque ère.

## 4. La base de R-12

- R-12 a **sa propre base**, près de la balise : un abri construit dans une épave, qui s'agrandit au fil du jeu.
- Au centre, son **écran holographique de gouverneur**. C'est là qu'on consulte :
  - les **ressources** (énergie, métal, nourriture, eau, médicaments, cristaux de la balise) et leur évolution ;
  - le **tableau des relations** entre tous les groupes ;
  - les **fiches des habitants et des chefs** ;
  - les **objectifs du moment** et l'ère en cours ;
  - le **contrôle du temps** ;
  - la **convocation du conseil**.
- En dehors de la base, l'interface reste **minimale** : heure et jour, objectif actuel, marqueur vers les événements urgents, petites alertes (une crise, un affrontement, une pénurie).

## 5. Construire

- **Mélange de projection holographique et de construction à la main** :
  1. R-12 ouvre son projecteur et choisit un bâtiment ; une **silhouette holographique** apparaît devant lui. Il la déplace, la tourne, la place sur le terrain (rouge si l'emplacement ne convient pas, cyan s'il est valide).
  2. Une fois validée, les **habitants de l'espèce concernée viennent construire**, chacun à sa manière (les Forgés soudent, les Vaëls tressent et font pousser, les humains assemblent). On les voit travailler, et le bâtiment se monte par étapes visibles.
  3. R-12 peut **participer lui-même** : porter des matériaux, souder, assembler une pièce délicate (petites actions avec un bouton maintenu). Sa présence accélère le chantier.
- Chaque espèce a ses bâtiments propres. Des **bâtiments communs** (marché, lieu de conseil, pont, infirmerie partagée) se débloquent quand la confiance entre deux groupes est assez haute.

## 6. Les habitants

- **Ordre d'arrivée** :
  1. **Les Vaëls sont déjà là** quand R-12 arrive. Il faut d'abord gagner leur confiance, clan par clan.
  2. R-12 construit ensuite progressivement les **Forgés**.
  3. Plus tard, il trouve et réveille les **humains** (une vingtaine), un par un ou par petits groupes, ce qui crée de nouvelles tensions.
- **Tous les habitants sont uniques** : nom, apparence propre, personnalité, métier, liens d'amitié et de rivalité, souvenirs des événements passés. Ils ont une routine (travail, repas, repos, rassemblements le soir) et réagissent à ce qui se passe.
- **Besoins** de chaque habitant et de chaque groupe :
  - **Survie** : nourriture, eau, énergie, abri ;
  - **Sécurité** : se sentir protégé des autres groupes et des dangers ;
  - **Respect et liberté** : être écouté, garder ses lois et ses terres ;
  - **Sens** : culture, rituels, fêtes, projets communs.
- Le moral et la loyauté envers R-12 dépendent de ces besoins.

## 7. Parler aux habitants

- **Dialogues à choix** pour l'histoire et les moments importants : réponses à choisir, avec des conséquences sur les relations.
- **Dialogues libres** pour discuter avec n'importe quel habitant, en écrivant (et en parlant si le navigateur le permet). Le personnage répond selon sa personnalité, ce qu'il sait et ce qu'il pense de R-12.
  - Cela demande un modèle de langage. Le jeu étant hébergé sur GitHub Pages, **ne mets jamais de clé d'API dans le code ou le dépôt**. Propose la solution la plus sûre et la plus simple (par exemple : un champ dans les options où l'on colle sa propre clé, stockée uniquement sur l'appareil, ou un petit serveur intermédiaire). Expliquer le coût éventuel avant de l'activer.
  - Si les dialogues libres ne sont pas disponibles, le jeu fonctionne entièrement avec les dialogues à choix.

## 8. Le conseil et les décisions

- Le conseil se réunit **quand une crise survient** ou **quand on le convoque** depuis l'écran de la base. Pendant le conseil, le temps est en pause.
- Le lieu de conseil évolue avec la civilisation : cercle de pierres, puis abri commun, puis grande salle.
- Types de décisions, toutes avec des conséquences immédiates et **différées** :
  - **Justice** : juger un crime, une trahison, un vol, un meurtre entre groupes.
  - **Partage des ressources** : qui mange, qui reçoit l'énergie, qui a accès aux cristaux.
  - **Territoires** : terres sacrées, frontières, expansion d'un village sur le territoire d'un autre.
  - **Dilemmes moraux** : sacrifier peu pour sauver beaucoup, mentir pour préserver la paix ou dire la vérité.
- Garder les **lois** et la **diplomatie** du document de civilisation (traités, pactes, trahisons possibles).

## 9. Les affrontements

- Les tensions peuvent dégénérer en **vrais affrontements** dans la vallée (rixes, embuscades, attaques de village).
- R-12 peut tout faire, au choix du joueur :
  - **S'interposer** : bouclier d'énergie, onde qui repousse, pour séparer les combattants.
  - **Négocier sur place** : dialogue tendu en temps limité, en pleine bagarre.
  - **Combattre** : système de combat simple et lisible (esquive, coups, onde d'étourdissement). Combattre a des conséquences : rancune durable du groupe visé, blessés, réputation de R-12.
- **Pas de game over**, mais tout a un coût : blessés, morts définitives d'habitants uniques, départs, villages endommagés, alliances perdues.

## 10. La progression

Plusieurs repères en même temps :
- **Les ères** (survie, fondation, expansion, unité ou rupture), annoncées par un court moment cinématique.
- **Les objectifs du moment** : missions et projets concrets (gagner la confiance du Clan des Eaux, réveiller trois humains, construire le pont sur la rivière).
- **La vallée qui grandit** : ce qu'on voit change réellement (villages plus grands, chemins, lumières la nuit).
- **Les relations** : les clans font confiance à R-12 et s'allient entre eux, ou l'inverse.

## 11. Ce qui reste inchangé

Tout le reste du document de civilisation : les trois espèces et leurs groupes, les crises, les saisons, les souvenirs de l'équipage aux grandes décisions, les fins de gouvernance, et le bouton « Gouverner » sur l'écran titre (qui lance maintenant directement R-12 dans la vallée).

## 12. Organisation

1. Mettre à jour ce fichier et montrer le plan de refonte.
2. **Tranche visuelle de la vallée** : la plaine de la balise et l'orée de la forêt, au niveau de qualité final, de jour et de nuit, avec R-12 qui s'y promène. **Stop** : validation de la qualité graphique avant tout le reste, avec des captures de jour, au coucher du soleil et de nuit.
3. Base de R-12 et écran de gouverneur, construction holographique, premier village vaël.
4. Habitants uniques, dialogues, conseil.
5. Affrontements, Forgés, humains, puis les ères.

À chaque étape : le lien GitHub Pages, ce qui est fait, ce qui reste, et les problèmes éventuels. Si un choix n'est pas couvert ici, proposer 2 ou 3 options courtes.
