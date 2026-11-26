# « DERNIER SIGNAL » · ACTE 2 : DOCUMENT DE RÉFÉRENCE COMPLET

> **Mise à jour (personnages en métal)** : l'apparence des humains, des Vaëls et des souvenirs de l'équipage suit désormais `docs/prompt-personnages-metal.md` (statues de métal vivantes : acier brossé, cuivre gravé de lumière, or pour les souvenirs). Elle remplace la « peau sombre aux motifs lumineux » des Vaëls (section 7) et l'atelier de designs qui leur était prévu. La meute garde son design.

Ce document est la **référence complète et détaillée de l'acte 2** (la vie sur la planète et le rôle de gouverneur), y compris les **pouvoirs de R-12**. Il rassemble tout ce qui a été décidé et ajoute de nombreux détails.

## 0. Consignes de travail (à lire en premier)

- **Ne casse rien de ce qui existe** : acte 1, missions, vallée et ses graphismes, QG dans la capsule, pouvoirs, commandes, réglages de qualité, bouton « Gouverner ». Ce document **précise et complète** ; il ne demande pas de tout refaire.
- Quand ce document **contredit** un document précédent dans `docs/`, **c'est lui qui compte**. Les contradictions principales sont listées en section 1.
- Enregistre ce document sous `docs/prompt-acte2-complet.md`, mets à jour les autres documents pour qu'ils restent cohérents, puis **montre-moi un plan de travail** découpé en étapes, avant de coder.
- Avance **étape par étape**, avec un **point de validation** à la fin de chaque étape : lien GitHub Pages, captures, ce qui est fait, ce qui reste, problèmes rencontrés. Vérifie à chaque fois que rien d'existant ne s'est cassé.
- Si un point n'est pas couvert, propose-moi **2 ou 3 options courtes** plutôt que de décider seul.
- Réponds-moi toujours en **français**, simplement. Je joue et teste sur **iPad**, avec une **manette**.

---

## 1. Ce qui change par rapport aux documents précédents

1. **Le jeu ne se termine jamais.** On **supprime toutes les fins** : Fédération, Ordre de fer, Rupture, Exode, la fin secrète, et l'écran de fin. La civilisation continue d'évoluer sans limite.
2. **Pas de musique dans l'acte 2.** Uniquement les **sons naturels** et les bruits du monde (section 17). L'acte 1 garde sa musique.
3. **R-12 parle**, avec une **voix robotique** qui devient plus humaine au fil du jeu (section 4).
4. **R-12 comprend les Vaëls immédiatement** : son scanner traduit leur langage de lumière.
5. **Les humains dorment dans un bunker sous la balise**, et sont dirigés au réveil par **un ancien du premier équipage** de l'Asterion (section 8).
6. Les factions humaines (Bloc de l'Aube, Dérivants) **n'existent pas au départ** : elles **naissent plus tard**, selon les choix du joueur.
7. La **réputation de R-12** ne s'affiche pas en chiffres : on la lit dans **l'attitude des habitants**. Le tableau des **relations entre groupes** reste disponible au QG.
8. **Plusieurs emplacements de sauvegarde.**
9. **Les habitants vieillissent, ont des enfants**, et des habitants **arrivent ou quittent la vallée**.
10. Pas de mode photo.

---

## 2. La vision de l'acte 2

- **Le cœur du jeu, ce sont les décisions.** Tout le reste (exploration, construction, combats, pouvoirs) sert à les rendre fortes : comprendre la situation, réunir des preuves, vivre les conséquences.
- **Ton : dur, mais avec de l'espoir.** Survie, pertes, trahisons et choix douloureux, mais aussi de vrais moments chaleureux : fêtes, amitiés, naissances, réconciliations.
- Le joueur est **toujours avec R-12, à la troisième personne**, dans la vallée. Pas de vue du dessus.
- **Une journée planétaire dure 10 minutes en temps réel** (à vitesse ×1). Pause et accélération ×2 et ×4 depuis le QG et le menu pause. La salle de recharge du QG permet d'avancer jusqu'au matin.
- **Difficulté équilibrée** : des moments durs, mais toujours du temps pour respirer et se rattraper.

---

## 3. R-12 dans l'acte 2

### Personnalité façonnée par le joueur
- R-12 n'a pas de personnalité fixe : **le joueur la façonne** par ses choix (juste, dur, doux, rusé, pacifique). Ses répliques disponibles, ses pensées et le ton de sa voix évoluent selon cette personnalité.
- Le jeu garde en mémoire des **traits** de R-12 (par exemple : clémence, fermeté, honnêteté, usage de la force, attachement aux traditions), mis à jour par les décisions. Ils ne s'affichent pas en chiffres, mais se ressentent dans ses répliques et dans la façon dont les autres lui parlent.

### Pensées à voix haute
- **Parfois**, R-12 pense à voix haute : il commente ce qu'il voit, doute avant une décision, se souvient d'un membre de l'équipage. Courtes phrases, jamais envahissantes, avec un réglage pour les désactiver.

### Voix
- **Voix robotique** : métallique, un peu hachée au début. Elle devient **progressivement plus humaine** au fil des ères et des souvenirs retrouvés (intonations plus naturelles, moins de grésillements).
- La synthèse vocale du navigateur seule ne permet pas d'effets ; choisis la solution qui donne le meilleur rendu sur iPad (par exemple une synthèse vocale locale rendue dans un tampon audio puis traitée par la Web Audio API pour l'effet robotique), avec une **licence compatible**. Explique-moi ton choix. Sous-titres toujours affichés, voix désactivable.

### Apparence personnalisable
- Au QG, R-12 peut changer de **couleurs**, de **pièces** (antenne, bras, sac à dos, protections) et porter des **cadeaux** offerts par les habitants : un collier tressé par le Clan des Racines, une plaque gravée par les Forgés, un insigne humain. Les cadeaux reflètent ses relations : on voit sur lui ses alliances.

### Dégâts et réparation
- R-12 peut être **endommagé** : rayures, carrosserie enfoncée, bras qui grésille, œil fissuré, visibles sur lui jusqu'à réparation.
- S'il est trop touché, il tombe **hors service**. Il se **réactive dans la salle de recharge du QG**, avec un **coût** : ressources dépensées pour la réparation, et **temps perdu** pendant lequel la vallée a continué à vivre sans lui (des événements ont pu se produire en son absence).

---

## 4. Les pouvoirs de R-12 (rappel complet)

Les six pouvoirs sont obtenus pendant l'**acte 1** (détail et missions dans `docs/prompt-pouvoirs-r12.md`). Dans l'acte 2, R-12 les a **tous**. Le bouton « Gouverner » → « Nouvelle fondation » les donne aussi.

| Pouvoir | Couleur | Effet |
|---|---|---|
| **Élan** | blanc argenté | Dash éclair (sol, air, apesanteur) et vol plané avec ailerons de lumière |
| **Gravité** | violet | Soulever, tenir, orienter et lancer des objets lourds à distance |
| **Égide** | bleu électrique | Maintenir : bouclier qui protège R-12 et ceux derrière lui. Relâcher d'un coup sec : le bouclier explose en onde de choc |
| **Ralenti** | or ambré | Le temps ralentit pour tous sauf R-12 |
| **Assemblage** | vert émeraude | Nanomachines qui construisent ou réparent en quelques secondes |
| **Frappe** | rouge orangé | Coup extrêmement puissant, brise murs et rochers, **peut blesser gravement** |

- **Aucune limite** d'énergie ou de recharge. Le frein, ce sont les **réactions des habitants**.
- **Commandes** : pouvoir actif + raccourci (croix directionnelle pour choisir, gâchette droite pour lancer ; sur iPad un bouton « Pouvoir » de la couleur du pouvoir actif ; au clavier touches 1 à 6 et clic droit).
- **Améliorations** à l'atelier du QG avec les ressources (2 ou 3 niveaux par pouvoir ; une amélioration de la Frappe permet d'assommer sans blesser). Chaque amélioration se voit aussi sur l'apparence de R-12.

### Les pouvoirs dans la vie de la vallée
- **Élan** : rejoindre vite un village attaqué, explorer les falaises, fuir.
- **Gravité** : dégager des habitants coincés après un séisme, déplacer des matériaux sur les chantiers, bloquer une crue avec des rochers, ouvrir des ruines.
- **Égide** : protéger un village pendant une attaque de la meute, séparer deux groupes qui se battent, abriter des habitants d'un incendie.
- **Ralenti** : sauver quelqu'un emporté par la crue, désamorcer une bagarre, éviter la meute.
- **Assemblage** : reconstruire après une catastrophe, accélérer les chantiers, réparer les Forgés blessés.
- **Frappe** : briser une entrée de grotte, se défendre, impressionner. À utiliser avec prudence.

### Réactions des habitants aux pouvoirs
- **Aider** avec un pouvoir : admiration et confiance.
- **Utiliser la force** : peur, méfiance, rumeurs dans les autres villages.
- **Blesser gravement un habitant** : rancune durable du groupe, demande de justice au conseil, habitants qui évitent R-12, risque de rébellion.
- Chaque groupe lit la force différemment : le **Clan des Hauteurs la respecte**, le **Clan des Racines la redoute**, les **humains s'en inquiètent**, les **Forgés** la jugent selon leur niveau de conscience.

---

## 5. L'ouverture de l'acte 2 : l'encerclement

- La capsule s'écrase au centre de la vallée (QG). R-12 sort, **encore endommagé**, au crépuscule. Des **Vaëls des trois clans l'encerclent** : armes pointées, motifs lumineux rouges (colère, peur). Cinématique courte, puis le joueur reprend la main.
- **Plusieurs façons de résoudre** la scène, chacune marque durablement la relation de départ :
  - **Se soumettre** (baisser la tête, poser les mains au sol, ne rien faire) : respect des Racines et des Eaux, les Hauteurs le jugent faible.
  - **Parler** : le scanner traduit tout de suite ; R-12 explique d'où il vient. Effet selon ce qu'il dit.
  - **Impressionner avec un pouvoir sans blesser** (Égide, Gravité, Élan) : respect des Hauteurs, peur chez les Racines.
  - **Fuir** avec l'Élan : méfiance générale, mais aucun blessé.
  - **Frapper** : un ennemi immédiat, des blessés, un départ très difficile.
- Ensuite, les **premiers jours sont guidés par des objectifs** (gagner la confiance d'un clan, rendre la capsule habitable, trouver de l'eau et de l'énergie, construire le premier Forgé), puis le joueur devient **totalement libre**.

---

## 6. La vallée (rappel et compléments)

Garde la vallée actuelle et ses graphismes. Territoires : **forêt lumineuse** (Racines), **falaises et canyons** (Hauteurs), **marais et lac** (Eaux), **plaine de la balise** (ruines, bunker des humains), une **rivière** qui relie tout, et le **QG au centre**, entre les villages.

### Les saisons (trois, qui tournent)
- **Saison sèche** : rivière basse, **eau rare**, herbe jaunie, poussière, **incendies** possibles dans la forêt.
- **Saison des pluies** : pluie fréquente, **crues** de la rivière, boue, **épidémies** plus probables, végétation éclatante.
- **Saison des tempêtes** : vents violents, débris, ciel chargé, **migrations de la meute**, chantiers ralentis.
- La **ressource la plus rare change selon la saison** (eau, puis médicaments, puis énergie et nourriture), ce qui crée des tensions différentes.
- Chaque saison transforme **visuellement** la vallée (couleurs, végétation, niveau de l'eau, météo, lumière).

### Les catastrophes
- **Incendies** (forêt, saison sèche), **crues** (villages près de la rivière), **épidémies** (une ou plusieurs espèces), **séismes** (quand la balise s'agite).
- Chacune est un **événement jouable** : R-12 intervient sur place avec ses pouvoirs, puis le conseil gère les conséquences (reconstruction, entraide, responsabilités).

### Ce qu'on explore en dehors des villages
- **Ruines anciennes** de la civilisation de la balise, avec énigmes et fresques (section 11).
- **Grottes et souterrains** sous la vallée : réseaux lumineux, ressources, passages secrets, lieux de refuge.
- **Nids de la meute** : dangereux, mais indispensables pour comprendre et approcher l'espèce sauvage.
- **Autres épaves** de l'Asterion tombées dans la vallée : pièces pour les Forgés, journaux, secrets du premier équipage.

---

## 7. Les Vaëls

### Design : atelier de propositions
- Avant de les modéliser, crée un **atelier de designs** (comme pour le robot) avec **3 ou 4 propositions** de Vaëls, **réalistes et crédibles** (anatomie cohérente, peau et matières convaincantes, animations naturelles), pour que je choisisse. Base de départ : être élancé, peau parcourue de **motifs lumineux** qui changent de couleur selon l'émotion. Les propositions peuvent varier la silhouette, le visage, la peau, les vêtements.
- Chaque clan a ses variations (couleurs de motifs, parures, vêtements, outils).

### Langage
- Ils parlent par la **lumière** de leurs motifs et par des sons doux. R-12 **comprend tout de suite** grâce au scanner : la traduction s'affiche en sous-titres, et la couleur des motifs reste visible (bleu calme, rouge colère, or joie, violet tristesse, blanc respect…).

### Les trois clans : alliés fragiles
Unis face aux étrangers, divisés entre eux (territoires, influence, rivalités anciennes).
- **Clan des Racines** (forêt) : guérisseurs, cultivateurs, pacifiques. **Vénèrent la balise** : toucher à ses cristaux est un sacrilège. Redoutent la force.
- **Clan des Hauteurs** (falaises) : chasseurs, éclaireurs, guerriers fiers. **Craignent la balise**, liée pour eux à une ancienne catastrophe. Respectent la force.
- **Clan des Eaux** (marais) : pêcheurs et commerçants, pragmatiques. **Exploitent la balise** avec prudence : ils échangent déjà de petits cristaux.
- Chaque clan a un **chef** avec un nom, une personnalité, des objectifs et des limites (à créer et à me proposer).

---

## 8. Les humains

### Où et comment
- Une **vingtaine** d'humains dorment dans des capsules dans un **bunker sous la balise**, construit par le premier équipage de l'Asterion. R-12 en trouve l'entrée en explorant les ruines.
- Ils se réveillent **par petits groupes**, au rythme de l'histoire. Chaque réveil est une scène (brouillard de la capsule, premiers pas, panique ou soulagement) et change l'équilibre de la vallée.

### Le chef : un ancien du premier équipage
- Il dirige les humains au réveil. Nom à me proposer (exemple : **Aldric Moreau**, ancien second de l'Asterion). Charismatique, intelligent, protecteur des siens.
- **Son secret** (révélé progressivement, par indices, jamais d'un coup) : des années plus tôt, il a voulu **s'emparer des cristaux de la balise** pour les ramener sur Terre. La balise a réagi en déclenchant la **tempête de débris** qui a détruit l'Asterion, puis frappé l'équipage de la Halcyon. Il est donc indirectement responsable de la mort d'Ilse, Tomás, Naomi, Kenji, Léa et Samir. Il le sait, et cache que la balise est un **héritage** qu'il veut toujours réserver aux humains.
- Indices à semer : journaux du premier équipage dans les épaves, fresques des ruines, réactions de la balise en sa présence, contradictions dans ses récits, réactions des Vaëls (le Clan des Hauteurs se souvient de lui).
- Sa révélation doit provoquer une **décision majeure de justice** (exil, prison, travaux, pardon), avec de lourdes conséquences dans tous les cas.

### Les factions naissent plus tard
- Au début, les humains sont **unis derrière l'ancien**.
- Selon les choix du joueur, **deux factions peuvent naître** : le **Bloc de l'Aube** (ordre strict, protection des humains, méfiance envers les autres) et les **Dérivants** (vivre avec les Vaëls, refus de la hiérarchie). Leurs chefs émergent parmi les habitants existants.

### Ce qu'ils apportent
- **Médecine** : soigner toutes les espèces, lutter contre les épidémies.
- **Ingénierie** : ponts, énergie, irrigation, défenses.
- **Écriture et savoir** : école, archives, **lois écrites**.

### Sources de conflit avec les Vaëls
- **La terre** : les humains veulent s'installer et cultiver sur des terres sacrées ou de chasse.
- **Les cristaux** : les humains veulent exploiter la balise, ce que les clans vivent chacun à sa façon.

### Avec les Forgés
- **Selon les personnes** : certains humains les respectent, d'autres veulent les commander comme des outils, d'autres en ont peur depuis le drame de l'Asterion.

---

## 9. Les Forgés

### Types (construits à l'atelier du QG)
- **Ouvriers** : petits, rapides, construction et réparation.
- **Porteurs** : grands et lourds, transport et extraction.
- **Gardiens** : défense des villages contre la meute.
- **Éclaireurs** : agiles, explorent et cartographient la vallée, découvrent ruines et grottes.
- Chaque Forgé est **unique** (nom, petits détails d'apparence, personnalité qui se révèle avec la conscience).

### La conscience, par étapes visibles
1. **Questions** : des Forgés commencent à poser des questions (« Pourquoi ce travail ? », « Que deviennent les Forgés détruits ? »).
2. **Refus** : certains refusent des ordres jugés dangereux ou injustes.
3. **Droits**, réclamés **par étapes** : d'abord **choisir leur travail**, puis **un nom et une maison** (être reconnus comme habitants), puis **une voix au conseil** (un représentant parmi les chefs).
- Chaque étape est une **décision** : accepter, refuser, négocier. Refuser trop longtemps peut mener à une **sécession** (un groupe de Forgés fonde son propre campement, voire quitte la vallée).

---

## 10. La meute (espèce sauvage)

- **Meute agile** : prédateurs de taille moyenne, rapides, chassant en groupe. Design original et crédible (à me proposer dans l'atelier de designs, 2 ou 3 versions), yeux luminescents, silhouette qu'on reconnaît de loin dans la nuit, cris qui se répondent dans la vallée.
- Trois comportements :
  - **Chasse nocturne** : attaques la nuit contre les villages, les habitants isolés, les réserves.
  - **Migrations** pendant la saison des tempêtes : la meute traverse la vallée en masse.
  - **Alliance possible** : en explorant leurs nids, R-12 peut comprendre ce qui les pousse (par exemple : leurs territoires de chasse détruits, ou leur lien avec la balise). Une longue suite de choix permet de réduire les attaques, puis d'en faire des **gardiens de la vallée**.
- **Défense** des villages : **constructions** (palissades, tours, pièges, lumières), **gardiens** (Forgés gardiens et guerriers vaëls), **R-12 lui-même** avec ses pouvoirs, et **alliances** entre villages qui s'entraident.

---

## 11. La balise : un héritage

- La balise est **la dernière mémoire d'un peuple disparu**, qui cherche un **successeur** capable de faire vivre ensemble des êtres différents.
- Son histoire se révèle **par fragments** : fresques lumineuses dans les ruines, visions quand R-12 touche certains cristaux, réactions de la balise aux grandes décisions (elle s'apaise quand la paix grandit, s'agite et provoque des séismes quand la violence domine).
- Comme le jeu ne se termine pas, l'héritage **se dévoile sans fin définitive** : chaque palier de la civilisation débloque un nouveau fragment, et parfois une **technologie commune** (énergie des cristaux, soins, communication à distance) qui change la vie de la vallée.
- Les clans y réagissent selon leur croyance (vénération, crainte, exploitation), ce qui crée des débats au conseil.

---

## 12. Les habitants

- **Tous uniques** : nom, apparence, personnalité, métier, famille, amitiés, rivalités, souvenirs des événements, opinion de R-12.
- **Routine** quotidienne (travail, repas, repos, rassemblements le soir, prières ou rituels), qui change avec les saisons et les crises.
- **Besoins** : survie (nourriture, eau, énergie, abri), sécurité, respect et liberté, sens (culture, rituels, fêtes, projets communs).
- **Générations** : les habitants **vieillissent**, ont des **enfants**, meurent de vieillesse. Les nouvelles générations ont leurs **propres idées** (des jeunes humains qui grandissent avec les Vaëls, des jeunes Vaëls fascinés par les Forgés). Propose-moi une échelle de temps (par exemple une année planétaire de quelques dizaines de jours).
- **Liens entre espèces** : **amitiés**, et **familles mixtes** (couples entre humains et Vaëls, adoptions, Forgés considérés comme membres d'une famille). Ces liens créent de l'espoir, mais aussi des débats.
- **Arrivées et départs** : des Vaëls d'autres régions arrivent dans la vallée, des exilés partent, des Forgés peuvent fonder ailleurs, des familles quittent la vallée si elles sont malheureuses.
- **Réputation de R-12** visible seulement dans **leur attitude** : saluer, sourire, venir demander de l'aide, éviter son regard, lui tourner le dos, se cacher à son passage, l'insulter.

---

## 13. Le conseil : débat interactif

- Le conseil se réunit **en cas de crise** ou **quand R-12 le convoque** depuis le QG. Le temps est en pause pendant le conseil, sauf pour les crises urgentes.
- Le lieu évolue avec la civilisation (près du QG au début, puis un lieu commun construit).
- **Déroulement** :
  1. **Exposé** : le problème est présenté, avec ce que R-12 sait.
  2. **Débat** : chaque chef donne sa position. Le joueur peut **interroger chaque chef**, demander des précisions, révéler une information.
  3. **Preuves** : le joueur peut présenter ce qu'il a trouvé (objets, enregistrements du scanner, témoignages d'habitants, journaux, fresques, souvenirs). Une bonne preuve peut faire changer un chef d'avis.
  4. **Persuasion** : convaincre, négocier, faire des promesses (qui seront à tenir).
  5. **Décision** : R-12 tranche. Les positions des chefs déterminent qui sera satisfait ou en colère.
- Mise en scène cinématographique : caméra sur chaque chef qui parle, motifs lumineux des Vaëls, gestes des humains, lumières des Forgés. Pas de musique : sons de la pièce, du vent, respirations, silences.
- **Crises urgentes minutées** : parfois, une décision doit être prise avant la fin d'un compte à rebours (incendie, attaque, crue). Ne pas décider est aussi un choix, avec ses conséquences.

### Types de décisions
- **Justice** (crimes, trahisons, vols, meurtres). Sanctions possibles : **exil**, **travaux** (réparer le tort), **prison** (cellule à construire au QG ou dans un village), **pardon**.
- **Partage des ressources** (selon la saison : eau, médicaments, énergie, nourriture, cristaux).
- **Territoires** (terres sacrées, terres de chasse, expansion d'un village, installation des humains).
- **Dilemmes moraux** (sacrifier peu pour sauver beaucoup, mentir pour préserver la paix ou dire la vérité).
- **Droits des Forgés**, **réveil des humains**, **relations avec la meute**, **usage des cristaux**, **lois écrites**.

### Exemples de dilemmes à développer (au moins 20 au total)
- Un chasseur du Clan des Hauteurs a tué un humain qui coupait des arbres sur ses terres.
- L'épidémie touche les humains ; le remède exige de récolter une plante sacrée du Clan des Racines.
- La crue menace deux villages ; R-12 ne peut en protéger qu'un à temps.
- Un couple mixte humain-Vaël est rejeté par les deux communautés.
- Les Forgés demandent un siège au conseil ; les humains menacent de partir.
- Un jeune Vaël a volé des cristaux pour les échanger avec les humains.
- La meute a tué un enfant ; certains exigent d'exterminer ses nids.
- Mentir à la vallée sur la menace d'un séisme pour éviter la panique.
- Le secret de l'ancien est révélé : que faire de lui ?
- Un groupe veut quitter la vallée en emportant une partie des réserves.

---

## 14. Les conséquences

- **Visibles dans le monde** : village déserté ou agrandi, bâtiment détruit ou construit, fête organisée, deuil, champs abandonnés, habitants qui changent de village.
- **Les habitants en parlent** : dialogues, rumeurs qui circulent d'un village à l'autre (et se déforment), chants et récits.
- **Conséquences cachées** : certaines décisions déclenchent des effets **bien plus tard**, par surprise (un pardon accordé qui mène à une trahison, un exilé qui revient avec d'autres, un enfant sauvé qui devient chef). Prévois un **système d'événements différés** qui garde la mémoire des décisions.
- **Les chefs peuvent mourir définitivement** (combat, catastrophe, maladie, vieillesse, assassinat). Un **successeur** prend leur place, avec d'autres idées, ce qui peut tout changer.
- **Trahisons possibles par n'importe qui**, même un allié proche, selon les choix du joueur : chaque personnage a des **intérêts cachés** et une loyauté qui évolue. Les trahisons doivent être **annoncées par des indices** (absences, rumeurs, contradictions, objets trouvés), jamais arbitraires.

---

## 15. La vie et l'économie de la vallée

### Ressources
Énergie, métal, nourriture, eau, médicaments, cristaux de la balise. La plus rare **change selon la saison**.

### Échanges
- **Spontanés** : les habitants échangent seuls entre villages selon leurs besoins (on voit des porteurs sur les chemins, des marchés improvisés).
- **Accords négociés** par R-12 : routes commerciales, traités d'échange, partage des récoltes.

### Bâtiments : une trentaine de types
Environ **8 par espèce** et **6 communs**, tous très soignés et qui évoluent par ère. Exemples :
- **Vaëls** : maisons (dans les arbres, creusées dans la falaise, sur pilotis), jardins de soins, sanctuaire, poste de chasse, ateliers de tressage, quais de pêche, comptoir d'échange, tour de guet.
- **Forgés** : abris, forge, atelier de récupération, générateur, tour d'énergie, foreuse à cristaux, poste de garde, dépôt.
- **Humains** : habitats, infirmerie, laboratoire, école, archives, atelier d'ingénierie, serre, digue d'irrigation.
- **Communs** : lieu de conseil, marché, ponts, prison, place des fêtes, défenses communes (palissades, tours, pièges, lumières).

### Construction
Garde le système existant : projection holographique par R-12, puis chaque espèce construit à sa manière, et R-12 peut aider (Assemblage, Gravité, travail à la main).

### Fêtes et rituels (importants)
- **Fêtes propres à chaque espèce** (rituels de lumière des Vaëls, fêtes des récoltes, cérémonie d'allumage d'un nouveau Forgé, anniversaires humains).
- **Fêtes communes**, quand les relations le permettent, qui renforcent fortement le moral et les relations.
- R-12 peut **participer** (danse de lumière, aide aux préparatifs, discours). Ce sont les moments chaleureux du jeu : soigne-les visuellement (lumières, foule, feux, lanternes).

---

## 16. Progression sans fin

- **Les ères** (survie, fondation, expansion, unité ou rupture) restent des **paliers**, annoncés par une **cinématique**. Après l'ère 4, le jeu **continue** : nouvelles générations, nouveaux défis, nouveaux fragments de l'héritage, nouvelles crises.
- **Objectifs du moment** : toujours un ou deux objectifs proposés (guidés au début, puis plus libres).
- **La vallée grandit** : on voit la civilisation évoluer.
- **Les relations** évoluent entre les groupes.

### Cinématiques (pour les grands moments seulement)
Rencontres importantes, réveil des humains, changements d'ère, mort d'un chef, trahisons, révélations sur la balise ou sur l'ancien, premières alliances, grandes catastrophes.

### Souvenirs de l'équipage de la Halcyon
**Rarement** dans l'acte 2, seulement aux moments très forts (par exemple au procès de l'ancien, ou à la première naissance dans la vallée).

---

## 17. Le son de l'acte 2 (sans musique)

- **Aucune musique.** Tout passe par les **sons du monde**, spatialisés en 3D :
  - **Nature** : vent dans les herbes et les arbres, rivière et cascades, pluie (différente sur la capsule, les feuilles, la boue), orages lointains, insectes et créatures de jour et de nuit, cris de la meute qui se répondent la nuit.
  - **Pas** de R-12 selon le sol (herbe, roche, boue, métal, eau, bois tressé), servos et petits bruits mécaniques de ses mouvements.
  - **Villages** : voix, rires, outils, forges, chants vaëls, enfants, bétail ou créatures domestiques, feux qui crépitent.
  - **Pouvoirs** : chaque pouvoir a un son reconnaissable.
- Le **mixage** change avec l'heure, la saison, la météo et la distance. Les silences comptent : au conseil, avant une décision, après une mort.

---

## 18. Interface, sauvegardes et options

- Interface minimale dans le monde (heure et jour, objectif actuel, alertes), tout le détail est **au QG**.
- **Plusieurs emplacements de sauvegarde** (au moins 5), plus une **sauvegarde automatique** régulière et à chaque grande décision. Les sauvegardes sont stockées sur l'appareil.
- Options : sous-titres (taille), voix de R-12 activée ou non, pensées à voix haute activées ou non, qualité graphique.

---

## 19. Ordre de travail proposé

1. Mettre à jour les documents dans `docs/` et me montrer le **plan**.
2. **Retirer les fins** et vérifier que le jeu continue sans limite. **Sauvegardes multiples.**
3. **Atelier de designs** des Vaëls (3 ou 4 propositions réalistes) et de la meute (2 ou 3). **Stop** : je choisis.
4. **Ouverture de l'acte 2** : l'encerclement et ses différentes résolutions, puis les premiers jours guidés. **Stop.**
5. **Voix robotique de R-12**, pensées à voix haute, personnalité façonnée par les choix, personnalisation et dégâts. **Stop.**
6. **Conseil interactif** complet (preuves, persuasion, minuteur) avec 5 premiers dilemmes, et le **système de conséquences** (visibles, rumeurs, différées). **Stop.**
7. **Saisons, catastrophes, meute** (chasse, migrations, nids, alliance) et **défenses**. **Stop.**
8. **Forgés** (quatre types, conscience par étapes, droits) puis **humains** (bunker, réveils par groupes, ancien et son secret, factions). **Stop** après chacun.
9. **Économie, échanges, trentaine de bâtiments, fêtes et rituels.** **Stop.**
10. **Générations**, arrivées et départs, **balise et héritage**, ruines, grottes, épaves. **Stop.**
11. Équilibrage, performances sur iPad, finitions.
