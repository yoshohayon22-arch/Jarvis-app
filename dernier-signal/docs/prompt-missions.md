# « DERNIER SIGNAL » : les missions du jeu

Ce document complète le prompt principal du projet. Il décrit **toutes les missions**, dans l'ordre, pour les trois zones. Utilise-le comme référence pour le level design, l'histoire, les énigmes et les moments visuels forts. Garde exactement l'ordre et l'esprit des missions ; tu peux ajuster les détails de mise en œuvre si un point pose un problème technique, mais préviens-moi.

Pour chaque mission, implémente : l'**objectif** affiché à l'écran (court), le **marqueur en losange** vers l'objectif, l'**énigme ou le danger**, le **morceau d'histoire** révélé, la **récompense**, et le **moment visuel fort** (caméra, lumière, musique) qui doit marquer le joueur. Ajoute un **point de contrôle** au début de chaque mission.

---

## L'équipage (personnages des journaux et hologrammes)

- **Ilse Varga** · commandante. Calme, protectrice, porte le poids des décisions.
- **Tomás Reyes** · ingénieur. Bricoleur, drôle, c'est lui qui a construit et réparé R-12.
- **Naomi Achebe** · biologiste. Fascinée par la planète, la première à vouloir y descendre.
- **Kenji Mori** · pilote. Prudent, s'oppose à l'expédition vers l'Asterion.
- **Léa Fontaine** · médecin. Tient un journal personnel, la voix la plus intime.
- **Samir Haddad** · spécialiste des communications. C'est lui qui a décodé le signal.

## La vérité (à révéler progressivement, jamais d'un coup)

Le signal vient d'une balise très ancienne, laissée sur la planète par une civilisation disparue. Ce n'est pas un appel au secours : c'est une **invitation adressée aux machines**, aux intelligences capables de survivre au temps. L'équipage l'a compris trop tard. Avant de disparaître, Tomás et Ilse ont transféré dans R-12 les journaux et les souvenirs de chacun, pour que quelqu'un se souvienne d'eux. R-12 ne s'est pas réveillé par hasard : la balise l'a appelé.

---

## Prologue

**0. Démarrage**
- Objectif : « Initialisation… »
- Écran noir, sons de diagnostic, puis l'œil du robot s'allume. Vue subjective floue qui devient nette : premier plan sur la station plongée dans le noir.
- Moment fort : la première lumière du jeu, ce sont les yeux de R-12 qui se reflètent sur une vitre.

---

## Zone 1 · Station Halcyon (bleu glacé et cyan) · environ 40 minutes

**1. Réveil**
- Objectif : « Trouver une source d'énergie. »
- Le joueur avance dans un couloir sombre en suivant des néons qui clignotent. Apprentissage : marcher, caméra, interagir.
- Récompense : la lampe frontale du robot s'allume.
- Moment fort : un néon s'allume l'un après l'autre jusqu'au bout du couloir.

**2. Courant coupé**
- Objectif : « Rétablir l'énergie de secours. »
- Énigme : rebrancher trois câbles dans la salle technique, au milieu des étincelles et des arcs électriques (danger : toucher un arc renvoie au point de contrôle).
- Histoire : premier journal audio, **Ilse** : « Jour 214. Samir dit que le signal se répète toutes les quatre heures. Il ne ressemble à rien de connu. »
- Moment fort : la station se rallume section par section, avec le ronronnement des machines qui reprend.

**3. Les quartiers de l'équipage**
- Objectif : « Explorer les quartiers. »
- Exploration libre de six cabines, une par membre de l'équipage. Indices dans le décor : photos, tasse renversée, lit défait, dessin de la planète par Naomi, plan du robot sur le bureau de Tomás.
- Histoire : journal de **Léa** sur le moral de l'équipage, qui se fissure.
- Récompense : le carnet s'ouvre (menu pause), avec la carte de la station.

**4. La baie d'observation**
- Objectif : « Ouvrir le volet de la baie. »
- Énigme simple : trouver le code du volet (inscrit à la main sous une console, visible au scanner).
- Histoire : **premier hologramme**, l'équipage qui célèbre le décodage du signal, Samir au centre.
- Moment fort : le volet s'ouvre lentement sur la planète, immense, et sur l'épave de l'Asterion qui dérive. La musique monte. C'est la carte postale du jeu : soigne la lumière, la réflexion de l'équipage-hologramme dans la vitre et le scintillement des étoiles.

**5. Le scanner**
- Objectif : « Récupérer le module de scan. »
- Dans le laboratoire de Naomi : échantillons figés, plantes mortes de la serre. Apprentissage du **scan** : l'onde lumineuse révèle des empreintes au sol.
- Histoire : journal de **Naomi** : « Les relevés de la surface sont impossibles. Il y a de la vie là-dessous, et elle brille. »

**6. La serre morte**
- Objectif : « Traverser la serre hydroponique. »
- Décor : grande salle avec vapeur épaisse, rayons de lumière à travers les conduits, plantes desséchées, eau stagnante qui reflète les néons. Démonstration du brouillard volumétrique.
- Danger : conduits de vapeur brûlante qui s'ouvrent par intermittence.
- Indice : une seule plante encore en vie, qui pousse vers la planète.

**7. L'atelier de Tomás**
- Objectif : « Atteindre l'atelier. »
- Le sol d'une salle s'est effondré ; il faut suivre au scanner les traces laissées par Tomás pour trouver un chemin le long des parois.
- Histoire : **hologramme** de Tomás qui ajuste R-12 sur l'établi en lui parlant : « Toi, tu tiendras plus longtemps que nous tous. »
- Récompense : le **jetpack**.

**8. La brèche**
- Objectif : « Rejoindre le hangar. »
- Danger principal de la zone : une brèche vers le vide aspire tout ce qui n'est pas fixé. Il faut utiliser le jetpack pour passer d'une prise à l'autre puis activer une cloison d'urgence.
- Moment fort : objets et papiers aspirés dans l'espace, alarme rouge, silence soudain quand la cloison se ferme.

**9. Le hangar**
- Objectif : « Lancer la navette vers l'Asterion. »
- Énigme : rétablir le carburant (trois vannes) et ouvrir les portes du hangar.
- Histoire : dispute enregistrée entre **Kenji** et **Ilse** : Kenji refuse d'aller sur l'Asterion, Ilse décide d'y aller quand même.
- Moment fort : cinématique de départ, la navette glisse hors du hangar ; vue sur la station qui s'éloigne.

**Secrets de la zone 1** (comptent pour la fin « Rester ») : journal caché de Samir derrière un panneau (scanner) ; hologramme de l'anniversaire de Léa dans le réfectoire ; photo de famille de Kenji coincée dans une grille d'aération.

---

## Zone 2 · Épave de l'Asterion (rouge et ambre) · environ 45 minutes

**10. L'amarrage**
- Objectif : « Entrer dans l'Asterion. »
- La navette s'arrime de travers sur la carcasse. Première sortie **en apesanteur** dans l'espace : apprentissage du déplacement en 6 directions.
- Moment fort : le vaisseau immense, éventré, éclairé seulement par les éclairs lointains de la planète.

**11. Le pont brisé**
- Objectif : « Trouver le poste de commandement. »
- Navigation entre des ponts cassés, cargaisons flottantes, alarmes rouges qui tournent. La **tempête de débris** traverse par vagues : il faut s'abriter derrière des structures avant chaque vague (un grondement l'annonce).

**12. La gravité folle**
- Objectif : « Traverser la section de gravité artificielle. »
- La gravité s'inverse toutes les quelques secondes : marcher au sol, puis au plafond. Énigme de rythme et de placement.
- Histoire : journal de **Kenji** : « Ce vaisseau n'a pas été frappé par hasard. Les débris venaient tous de la même direction : de la planète. »

**13. Les bottes magnétiques**
- Objectif : « Récupérer l'équipement de sortie. »
- Dans le vestiaire de l'équipage de l'Asterion, combinaisons vides qui flottent (ambiance inquiétante, sans danger réel).
- Récompense : **bottes magnétiques** pour marcher sur les parois métalliques.
- Moment fort : première marche à la verticale le long de la coque, avec la planète qui tourne sous le robot.

**14. Le réacteur**
- Objectif : « Redémarrer le réacteur. »
- Grande salle verticale autour d'un réacteur géant éteint. Danger : zones irradiées (à traverser vite, effet visuel de grésillement sur la caméra).
- Énigme : aligner quatre anneaux de confinement en montant le long du réacteur avec les bottes et le jetpack.
- Moment fort : le réacteur se rallume, lumière ambre qui envahit la salle, vibration de la manette.

**15. Le poste de commandement**
- Objectif : « Accéder aux enregistrements de bord. »
- Histoire : **hologramme** majeur : l'équipage de la Halcyon arrive sur l'Asterion, la tempête de débris frappe, Ilse ordonne l'évacuation vers la surface de la planète. Léa est blessée.
- Révélation : l'Asterion était déjà là avant eux ; un autre équipage avait suivi le même signal, des années plus tôt.

**16. Les capsules**
- Objectif : « Trouver une capsule de descente. »
- Toutes les capsules ont été lancées sauf une, endommagée. Énigme : récupérer trois pièces sur des capsules détruites dispersées à l'extérieur de la coque, pendant une tempête de débris.
- Histoire : journal de **Léa**, blessée, juste avant la descente.

**17. La descente**
- Objectif : « Descendre vers la planète. »
- Cinématique jouable : la capsule traverse l'atmosphère, flammes, secousses, puis les nuages, puis la nuit étoilée et les forêts lumineuses en dessous.
- Moment fort : le passage de la lumière rouge de l'épave aux couleurs vertes et violettes de la planète.

**Secrets de la zone 2** : journal de l'ancien équipage de l'Asterion (premier indice que d'autres sont venus) ; hologramme de Samir qui chante dans le noir ; le casque de Kenji, accroché à une antenne extérieure.

---

## Zone 3 · Planète (vert émeraude et violet) · environ 45 minutes

**18. Atterrissage**
- Objectif : « Trouver un signe de l'équipage. »
- Nuit claire, deux lunes, végétation bioluminescente qui réagit au passage du robot (les plantes s'allument quand il approche). Les flaques reflètent le ciel étoilé.
- Indice : traces de pas humains à moitié effacées (scanner).

**19. Le campement**
- Objectif : « Explorer le campement. »
- Tentes abîmées, feu de camp éteint depuis longtemps, matériel abandonné. Indices sur ce qu'ont vécu les survivants.
- Histoire : journal de **Naomi** : « Les plantes chantent la nuit. Je crois qu'elles répètent le signal. »

**20. La brume**
- Objectif : « Suivre la piste vers la vallée. »
- La météo change : une **brume épaisse** monte au ras du sol, seules les lumières des plantes et du robot percent. Danger : crevasses invisibles dans la brume (le scanner les révèle).

**21. Les spores**
- Objectif : « Traverser la forêt lumineuse. »
- Danger : certaines plantes libèrent des spores aveuglantes si on passe trop près (l'écran blanchit, le joueur doit trouver un chemin de contournement).
- Histoire : **hologramme** de Naomi et Léa qui soignent quelqu'un sous une tente pendant la pluie.

**22. La pluie**
- Objectif : « Atteindre la structure ancienne. »
- **Pluie fine** : gouttes, sol mouillé et brillant, flaques qui se forment en temps réel, reflets partout. Moment le plus spectaculaire pour les reflets.
- Énigme : rétablir un pont de pierre ancien en activant trois pierres gravées dans le bon ordre (indices trouvés dans le carnet de Samir).

**23. Le dernier message**
- Objectif : « Trouver Ilse. »
- Dans une grotte à l'entrée de la structure : **journal d'Ilse**, le plus émouvant du jeu. Elle explique qu'ils n'ont pas pu répondre au signal, qu'il ne s'adressait pas à eux, et qu'ils ont confié leurs souvenirs à R-12.
- Moment fort : l'éclaircie. La pluie s'arrête, et des **aurores** apparaissent au-dessus de la structure.

**24. La balise**
- Objectif : « Entrer dans la structure. »
- Architecture ancienne et immense, inconnue, dont les formes s'éclairent au passage du robot. Énigme finale : reconstituer la séquence du signal en combinant tout ce que le joueur a appris (les plantes, le carnet de Samir, les pierres).
- Révélation : la balise reconnaît R-12 et lui parle, par des lumières et des sons, pas par des mots.

**25. Le choix**
- Face à la source du signal, le joueur choisit :
  - **« Répondre »** : R-12 répond au signal. Cinématique : un faisceau monte vers les étoiles, R-12 est emporté dans la lumière vers l'inconnu. Fin ouverte et mystérieuse.
  - **« Rester »** (débloqué seulement si le joueur a trouvé au moins 80 % des journaux et hologrammes) : R-12 refuse l'invitation. Il revient au campement, plante la dernière plante de la station près des tentes, et projette tous les hologrammes de l'équipage autour de lui, sous les aurores. Message final : il gardera leur mémoire, et il envoie leur histoire vers la Terre.
- Écran de crédits avec le pourcentage de découverte et la liste des souvenirs retrouvés.

**Secrets de la zone 3** : l'enregistrement de Samir qui traduit enfin une partie du signal ; le dessin de R-12 par Naomi, caché sous une pierre du campement ; un dernier hologramme de tout l'équipage réuni, dans une grotte cachée derrière une cascade.

---

## Récapitulatif

- **26 missions** principales (prologue compris) et **9 secrets**.
- Environ **15 journaux** et **10 hologrammes** au total : vérifie que le seuil de 80 % pour la fin « Rester » est atteignable mais demande une vraie exploration.
- Chaque zone se termine par un moment de transition fort (départ en navette, descente en capsule, fin du jeu).
- Ajoute ces missions au fichier de suivi du projet et coche-les au fur et à mesure. Aux points de validation, dis-moi quelles missions sont terminées.
