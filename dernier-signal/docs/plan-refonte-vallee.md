# Plan de refonte · la vallée et le gouvernement par R-12

Référence : `docs/prompt-civilisation.md`, partie 3 (elle remplace la vue du dessus et l'interface du prototype).

## Ce qu'on garde du prototype

- Le **moteur de simulation** (ressources, relations, loyauté, paix, tension, conseil, conséquences différées, sauvegarde) : il sera branché sur la vallée au lieu de la vue du dessus.
- Les **textes** déjà écrits : chefs Ancre et Ysalé, trois décisions du conseil, souvenirs de l'équipage, résumé de l'acte 1.
- Le **contrôle de R-12** de l'acte 1 : marche, saut, jetpack, scan, lampe, caméra, manette, tactile, déjà réglés et testés.

Ce qui disparaît : la vue du dessus, l'interface en bandeaux, le terrain plat, les arbres en boules et les bâtiments en formes simples.

## Étape 2 · Tranche visuelle (prochaine étape, puis arrêt pour validation)

Une zone d'environ 300 × 300 m : **la plaine de la balise et l'orée de la forêt lumineuse**, au niveau de qualité final, de jour, au coucher du soleil et de nuit, avec R-12 qui s'y promène.

| Élément | Comment |
|---|---|
| Relief | Carte de hauteur générée puis **érodée** (simulation de l'écoulement de l'eau : ravines, dépôts, rochers dégagés), découpée en tuiles avec niveaux de détail. |
| Sol | Mélange de **textures Poly Haven** selon la pente, l'altitude et l'humidité : herbe (`grass_ground`, `forest_ground_04`), terre et feuilles (`forest_leaves_02`, `brown_mud_leaves_01`), roche (`aerial_rocks_02`, `dark_rock`, `cliff_side`), mousse, sable de berge. **Triplanaire** sur les pentes fortes. Détails au sol : cailloux, branches, feuilles. |
| Rochers et ruines | **Modèles 3D Poly Haven** (rochers, falaises, troncs morts) et ruines anciennes de la balise en pierre sculptée, à moitié enfouies. |
| Herbe | Des dizaines de milliers de brins instanciés autour de R-12, **ondulant au vent**, qui **s'écartent** sous ses pas. Herbe haute dans la plaine. |
| Arbres de la forêt | Générés par le code : **troncs torsadés**, branches, racines aériennes, plusieurs couches de **feuillage translucide** (la lumière passe au travers). Versions simplifiées au loin. Sous-bois : fougères, champignons et fleurs qui s'allument la nuit. |
| Rivière | Un premier tronçon de rivière qui longe l'orée : **shader d'eau** (reflets, réfraction, vagues, mousse aux berges, fond plus sombre en profondeur), petits rapides. |
| Ciel | **Ciel physique** le jour (diffusion atmosphérique), lever et coucher colorés ; nuit avec étoiles denses, **voie lactée**, **deux lunes** qui éclairent vraiment, aurores occasionnelles. |
| Lumière | Soleil avec **ombres en cascade** (nettes près de R-12, douces au loin), lumière des lunes la nuit, éclairage d'ambiance qui suit l'heure. |
| Atmosphère | **Brouillard de hauteur** qui varie selon le lieu et l'heure (brume du matin au ras de l'herbe, air clair à midi), **rayons de lumière** sous la canopée, pollen le jour, **lucioles** la nuit. Fini le voile gris uniforme. |
| Bioluminescence | La nuit : plantes, champignons, veines de la balise et eau qui s'éclairent, avec le bloom du jeu. |
| Météo | Vent dès cette étape ; la pluie viendra avec l'étape 3 (sol mouillé, flaques, gouttes). |
| Temps | Cycle jour et nuit en temps réel, avec pause et ×1, ×2, ×4 dans le menu pause pour faire les captures. |

**Performances** : préréglage « Équilibré » sur iPad (30 images/s visées) et « Ultra » sur ordinateur. Certains effets (rayons de lumière détaillés, reflets d'écran, densité d'herbe) sont réduits sur iPad, comme dans l'acte 1. Je mesure les images par seconde et j'ajuste.

**Ce que je t'enverrai** : le lien, et des captures de jour, au coucher du soleil et de nuit, à la taille d'un écran d'iPad.

## Étape 3 · Base de R-12, construction, premier village

- **Base de R-12** dans une épave près de la balise, avec l'**écran holographique** : ressources, relations, fiches, objectifs, temps, conseil.
- **Construction holographique** : silhouette cyan ou rouge devant R-12, puis chantier visible où les habitants travaillent ; R-12 aide en maintenant un bouton.
- **Premier village vaël** (Clan des Racines, maisons dans les arbres) et premiers bâtiments réalistes.
- **Pluie**, interface minimale en exploration (heure, objectif, alertes).

## Étape 4 · Habitants, dialogues, conseil

- Habitants **uniques** (nom, apparence, personnalité, métier, amitiés et rivalités, souvenirs), routines et besoins (survie, sécurité, respect, sens).
- **Dialogues à choix**, et **dialogues libres** si tu les actives (voir la question 1).
- **Conseil** déclenché par les crises ou convoqué depuis la base ; lieu qui évolue ; justice, partage, territoires, dilemmes ; lois et diplomatie.

## Étape 5 · Affrontements, Forgés, humains, ères

- **Affrontements** : s'interposer (bouclier, onde), négocier en temps limité, ou combattre, avec des conséquences durables.
- Construction des **Forgés**, réveil des **humains**, autres territoires (falaises, marais, lac), villages de chaque espèce, chemins qui deviennent des routes éclairées.
- Les **quatre ères**, chacune validée avant la suivante, puis les fins.

## Questions

**Q1 · Dialogues libres avec les habitants** (il faut un modèle de langage, et **aucune clé ne sera jamais mise dans le code ou le dépôt**) :
- **A · Ta propre clé, stockée seulement sur ton iPad** (recommandé pour commencer) : un champ dans les Options où tu colles une clé d'API, par exemple de Claude. Elle reste dans la mémoire du navigateur de ton appareil et n'est envoyée qu'au fournisseur. C'est le plus simple, mais chaque conversation te coûte un peu. Je te donnerai le tarif exact et une estimation par partie avant de l'activer, et je prévoirai une limite.
- **B · Un petit serveur intermédiaire** (par exemple un service gratuit de type « worker ») qui garde la clé à l'abri et limite l'usage. C'est le plus sûr, utilisable par d'autres joueurs, mais il faut créer un compte sur ce service : je te guiderais en quelques étapes.
- **C · Pas de dialogues libres pour l'instant** : uniquement des dialogues à choix. On décidera plus tard.

**Q2 · Taille de la tranche visuelle** :
- **A · Compacte et très finie** (recommandé) : la plaine et l'orée de la forêt, environ 300 m, au niveau final.
- **B · Plus large mais moins finie** : toute la vallée en ébauche, avec une seule zone au niveau final.
