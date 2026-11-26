# PERSONNAGES EN MÉTAL : DIRECTION ARTISTIQUE ET TECHNIQUE COMPLÈTE

## 0. Consignes de travail

- Cet ajout porte **uniquement sur l'apparence des personnages** (humains, Vaëls, souvenirs de l'équipage). **Ne change rien d'autre** : histoire, systèmes de jeu, vallée, QG, pouvoirs, commandes, réglages. Si un point entre en conflit avec l'existant, demande-moi avant.
- Ce document **remplace** les consignes précédentes sur l'apparence des humains (« réalistes stylisés ») et des Vaëls (peau sombre aux motifs lumineux), ainsi que l'atelier de designs prévu pour eux. Enregistre-le sous `docs/prompt-personnages-metal.md` et mets à jour les autres documents pour qu'ils restent cohérents.
- Montre-moi d'abord un **plan court**, puis avance étape par étape avec des **points de validation** (captures et lien GitHub Pages). Vérifie à chaque étape que rien d'existant ne s'est cassé.
- Réponds-moi en français, simplement. Je teste sur iPad.

---

## 1. Le principe

- Les humains, les Vaëls et les souvenirs de l'équipage sont rendus comme des **statues de métal vivantes**. C'est **uniquement un style visuel** : dans l'histoire, ce sont toujours des êtres de chair qui respirent, mangent, vieillissent, ont des enfants. Personne dans le jeu ne commente le fait qu'ils soient « en métal ».
- Pourquoi : le métal se rend de façon **très réaliste** en temps réel (matières physiques, reflets, usure), alors que la peau humaine réaliste est très difficile dans un navigateur et tombe vite dans la « vallée de l'étrange ». Le but est un rendu **élégant, cohérent et crédible**, proche de statues de musée qui prendraient vie.
- **Non concernés** : R-12, les Forgés (qui restent des robots) et la meute (qui garde son design).

## 2. Distinguer les robots des êtres vivants

Les robots et les êtres vivants sont tous en métal : il faut qu'on ne les confonde **jamais**.
- **R-12 et les Forgés restent clairement mécaniques** : vis, plaques assemblées, câbles, joints, écrans, lumières, articulations de machine, formes géométriques.
- **Les humains et les Vaëls sont organiques** : anatomie réelle, formes continues et douces, muscles, peau sculptée, aucune vis, aucun câble, aucune lumière de machine (sauf les gravures des Vaëls, qui ont l'air vivantes).

## 3. Un métal par espèce

### Humains : acier brossé
- Acier gris froid, **finition brossée** (micro-rayures dans une direction, reflets étirés : utilise l'anisotropie du matériau physique de Three.js si la version le permet, sinon une carte de normales brossée).
- Nuances légères selon les personnes (acier plus clair, plus foncé, légèrement bleuté ou chaud) pour les distinguer.

### Vaëls : cuivre
- Cuivre chaud aux reflets orangés et rosés.
- **Motifs lumineux gravés dans le métal** : de fins sillons sculptés dans le cuivre qui **s'illuminent de l'intérieur** selon l'émotion (bleu calme, rouge colère, or joie, violet tristesse, blanc respect…). La lumière doit avoir l'air de venir du métal lui-même (carte émissive animée par shader, avec un léger halo grâce au bloom).
- **Les trois clans se distinguent par la patine et les ornements** :
  - **Clan des Racines** : cuivre couvert de **vert-de-gris** dans les creux, ornements en forme de racines, feuilles et spirales, parures tressées en fil de cuivre.
  - **Clan des Hauteurs** : **cuivre rouge** sombre, marques de chasse gravées, ornements anguleux, pièces de protection.
  - **Clan des Eaux** : **cuivre poli aux reflets bleutés**, ornements en forme de vagues et d'écailles, bijoux de coquillages en métal.
- Ils sont élancés et non humains (propose les formes exactes dans l'atelier, section 11).

### Souvenirs de l'équipage : statues de lumière dorée
- Ilse, Tomás, Naomi, Kenji, Léa et Samir apparaissent comme des **statues d'or lumineuses** : or brillant, lueur intérieure douce, contour lumineux, fines particules dorées qui s'en échappent.
- Ils apparaissent et disparaissent en se **matérialisant** à partir de particules, comme un souvenir qui se reconstitue.
- C'est la seule matière dorée du jeu pour les personnages : elle doit immédiatement signifier « souvenir ».

### Familles mixtes : un alliage
- Les enfants d'un humain et d'un Vaël sont faits d'un **alliage unique d'acier et de cuivre mêlés** (veines, marbrures ou dégradés qui se mélangent différemment sur chaque enfant). Ils ont aussi quelques fines gravures lumineuses héritées du parent vaël.

## 4. Le niveau de détail

- **Visages sculptés et détaillés** : nez, lèvres, paupières, pommettes, rides, cicatrices, comme une statue réaliste de musée.
- **Yeux sculptés dans le métal**, comme sur une statue classique (iris et pupilles gravés), sans lumière.
- **Expressions faciales** si elles restent réalistes : regard, sourcils, bouche, clignements, et mouvements de la bouche quand ils parlent (synchronisés avec le son ou le texte). Utilise des **morph targets** (expressions de base : neutre, sourire, colère, tristesse, peur, surprise, dégoût, réflexion, et des formes de bouche pour la parole). Si une expression rend mal, réduis son amplitude plutôt que de la garder.
- **Corps le plus réaliste possible** : anatomie juste, mains détaillées, articulations naturelles. Le métal se plie comme une peau (pas de plaques).
- **Cheveux en fils de métal** : mèches de fins fils d'acier (humains) ou de cuivre (Vaëls, s'ils en ont), avec un reflet métallique anisotrope et un léger mouvement au vent et aux déplacements.

## 5. Les vêtements (choix pour le rendu le plus réaliste)

- Les vêtements sont **aussi en métal**, mais avec une **finition différente** du corps pour qu'on les distingue : plis et tissus **sculptés** comme sur une statue, métal plus mat, plus sombre ou bruni (acier bleui, fer sombre, cuivre oxydé). C'est le choix le plus cohérent et le plus réaliste : de vrais tissus simulés à côté de corps en métal auraient l'air étranges et coûteraient cher en performance.
- Les plis peuvent bouger légèrement avec le corps (déformation par le squelette), sans simulation de tissu.
- Les accessoires (sacs, outils, armes, bijoux) peuvent mélanger les métaux, avec quelques éléments non métalliques discrets (cordes, cuir, verre) si ça renforce le réalisme.

## 6. Distinguer chaque personne

Chaque habitant est unique. On le reconnaît par :
- **Morphologie** : taille, carrure, âge, forme du visage, posture.
- **Gravures et ornements** : motifs, marques, bijoux propres à chacun.
- **Accessoires** liés au métier : outils de soin, armes de chasse, filets, instruments d'ingénieur, livres.
- **Nuances du métal** : teintes légèrement différentes d'une personne à l'autre.

Prévois un **générateur de variations** (morphologie, visage, ornements, accessoires, nuance, patine) pour créer facilement les nombreux habitants à partir de quelques modèles de base, tout en gardant des **personnages principaux faits à la main** (chefs, ancien, personnages clés).

### Factions humaines (quand elles apparaissent)
- **Bloc de l'Aube** : tenues strictes, plaques de protection, lignes droites, **insigne émaillé** (couleur de faction) sur l'épaule ou la poitrine.
- **Dérivants** : tenues plus libres, **ornements vaëls en cuivre** mêlés à l'acier, insigne émaillé de leur couleur.

### L'ancien (Aldric Moreau)
- Acier ancien et marqué, et surtout un **éclat de cristal de la balise incrusté** dans son corps (par exemple sur la tempe ou dans la poitrine, partiellement caché par sa tenue). Il pulse faiblement, plus fort quand il est près de la balise. C'est un **indice discret de son secret** : ne le mets pas en évidence, mais un joueur attentif doit pouvoir le remarquer.

## 7. L'âge

- **Enfants** : plus petits, métal **plus brillant et poli**, proportions d'enfant, mouvements vifs.
- **Adultes** : patine légère.
- **Anciens** : métal **patiné et terni** (oxydation dans les creux, reflets plus doux), **rides gravées** plus profondes, **posture voûtée**, démarche plus lente.
- Le vieillissement est **progressif** au fil des années de jeu (la patine et les rides augmentent graduellement).

## 8. Les mouvements et les sons

- **Humains** : mouvements naturels et fluides, comme de vraies personnes.
- **Vaëls** : plus **souples et félins**, gestes amples, déplacements silencieux.
- Les animations doivent être **réelles et variées** (marche, course, travail, repos, conversation, gestes d'émotion, combat, deuil, fête, danse). Utilise des animations de capture de mouvement **libres de droits** si possible, adaptées aux squelettes.
- **Sons discrets** : légers frottements métalliques dans les mouvements, pas un peu plus mats que la normale. Ils ne doivent pas sonner comme des robots.

## 9. Le métal réagit au monde

C'est ce qui rend les personnages vivants et crédibles :
- **Lumière** : le métal reflète l'environnement (ciel, feux, néons du QG, bioluminescence). Les reflets doivent être justes : utilise l'environnement PMREM de chaque zone et des **sondes de réflexion** dans les intérieurs (QG, grottes, bunker).
- **Pluie** : métal mouillé plus sombre et plus brillant, **gouttes qui ruissellent** sur les surfaces (carte de normales animée), gouttes sur les visages.
- **Boue et poussière** : salissures sur les pieds et les jambes selon le terrain et la saison, qui s'estompent avec le temps ou sous la pluie.
- **Froid** : fine couche de **givre** sur les surfaces exposées la nuit et pendant la saison des tempêtes.
- **Chaleur** : teinte légèrement chauffée et reflets orangés près des forges et des feux.
- **Nuit** : le métal capte les **reflets de la bioluminescence** ; les gravures des Vaëls **s'allument** ; les humains portent des **lampes** et des lanternes qui éclairent leur visage.

## 10. Les blessures

- Une blessure se voit comme du **métal bosselé ou fissuré** à l'endroit touché (décalques de normales et de couleur, éventuellement légère déformation).
- Les marques **guérissent progressivement** et peuvent laisser une **cicatrice** gravée permanente pour les blessures graves.

## 11. L'atelier de designs (avant tout)

- Crée un **atelier** comme celui des robots : un showroom où les modèles tournent sur des socles, avec **4 éclairages** à alterner : studio, jour dans la vallée, nuit bioluminescente, pluie.
- **3 propositions** pour chaque groupe :
  - **humains** (homme, femme, enfant, ancien pour chaque proposition) ;
  - **Vaëls** (un représentant par clan pour chaque proposition, avec leurs gravures lumineuses animées selon les émotions) ;
  - **souvenirs de l'équipage** (rendu des statues dorées, avec l'effet d'apparition).
- Montre aussi un **gros plan de visage** avec les expressions, et un personnage qui **vieillit** (enfant → ancien) avec un curseur.
- **Stop** : je choisis avant que tu remplaces les personnages dans le jeu.

## 12. Technique

- Utilise la méthode qui donne le **résultat le plus réaliste** sur iPad. Pistes :
  - partir de **modèles humains de base riggés** sous licence libre compatible avec un dépôt public (par exemple des exports de MakeHuman en CC0, ou d'autres modèles CC0), avec un squelette standard et des morph targets pour le visage ;
  - les retravailler (proportions, visages, détails) et leur appliquer les matières métalliques ;
  - pour les Vaëls, partir d'une base humanoïde modifiée ou d'un modèle dédié.
  Vérifie et note chaque licence dans `CREDITS.md`. Explique-moi ton choix avant de te lancer.
- **Matières** : `MeshPhysicalMaterial` avec métal à 100 %, cartes de rugosité, de normales et d'occlusion ; usure des arêtes (bords plus brillants), patine dans les creux (masques par courbure ou occlusion), vert-de-gris pour le cuivre des Racines, anisotropie pour l'acier brossé, vernis (clearcoat) léger pour les enfants et le cuivre poli des Eaux. Les effets dynamiques (mouillé, boue, givre, chaleur, blessures, âge) sont des **paramètres de shader** pilotés par le jeu.
- **Performances sur iPad** : priorité au **détail en gros plan** (dialogues, conseil, cinématiques), simplification au loin :
  - niveau 0 (proche) : modèle complet, expressions, cheveux en fils, effets dynamiques ;
  - niveau 1 (moyen) : moins de polygones, expressions réduites, cheveux simplifiés ;
  - niveau 2 (loin) : silhouette simplifiée, animations allégées, voire imposteurs.
  Limite le nombre de personnages au niveau 0 en même temps, et garde au moins 30 images/s sur iPad.
- **Partout le même rendu** : dans le jeu, au conseil et dans les cinématiques, avec un éclairage encore plus soigné en cinématique et au conseil (lumière de contour, reflets travaillés, profondeur de champ).

## 13. Organisation

1. Mets à jour les documents dans `docs/` et montre-moi le plan, avec ta méthode technique et les sources des modèles.
2. **Atelier de designs** (section 11). **Stop** : je choisis.
3. Matières et effets dynamiques (mouillé, boue, givre, chaleur, blessures, âge, nuit) sur les modèles choisis. **Stop** : captures.
4. Générateur de variations, personnages principaux (chefs, ancien), enfants mixtes.
5. Remplacement des personnages dans le jeu, niveaux de détail, vérification des performances sur iPad. **Stop** : captures dans la vallée de jour, de nuit et sous la pluie, et au conseil.
