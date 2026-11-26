# Plan court · personnages en métal

Référence : `docs/prompt-personnages-metal.md` (il fait foi pour l'apparence des humains, des Vaëls et des souvenirs de l'équipage). R-12, les Forgés et la meute ne changent pas.

## Méthode technique

**Base des corps : MakeHuman (licence CC0, déjà utilisé et crédité).** Tout vient du dépôt officiel `makehumancommunity/makehuman` :
- **corps** complet (13 380 sommets, mains et pieds détaillés) et **squelette** de 163 os avec ses poids ;
- **âge** : déformations enfant, jeune, vieux → curseur de vieillissement par mélange de formes ;
- **morphologie** : homme, femme, musculature, corpulence → générateur de variations ;
- **visage** : 59 mouvements du visage (sourcils, paupières, joues, lèvres, mâchoire, regard). Je les transforme en **morph targets** pour les expressions (neutre, sourire, colère, tristesse, peur, surprise, dégoût, réflexion) et les formes de bouche de la parole ;
- **yeux** détaillés, qui seront sculptés dans le métal (iris et pupille gravés en relief, sans lumière).

L'outil `tools/build_vaels.py` (déjà écrit pour les Vaëls) devient un outil général qui fabrique hors ligne chaque modèle : proportions, crâne, âge, expressions, puis réduit le modèle pour l'iPad.

**Matières** : `MeshPhysicalMaterial` à 100 % métal.
- **Acier brossé** (humains) avec la vraie **anisotropie** de Three.js : reflets étirés.
- **Cuivre** (Vaëls) avec **gravures lumineuses** creusées et émissives, animées selon l'émotion.
- **Patines** :
  - vert-de-gris pour les Racines ;
  - cuivre rouge sombre pour les Hauteurs ;
  - cuivre poli bleuté avec vernis pour les Eaux.
- **Or lumineux** pour les souvenirs, avec l'apparition en particules.

Usure des arêtes et patine dans les creux sont calculées à partir de la forme du modèle. Mouillé, boue, givre, chaleur, blessures et âge sont des **réglages du shader** que le jeu pilote.

**Vêtements** : métal sculpté plus mat ou bruni, découpé dans le corps et animé par le même squelette (méthode déjà en place pour les armures actuelles), avec des **plis sculptés** en relief.

**Cheveux** : mèches de fils de métal générées par le jeu (tubes très fins), qui bougent légèrement.

**Animations** : je chercherai des captures de mouvement libres (base de l'université Carnegie Mellon, libre pour tous usages) et je les adapterai au squelette. Si elles ne sont pas accessibles depuis ma machine, j'en resterai aux animations calculées actuelles, améliorées (plus souples pour les Vaëls).

**Performances iPad** : trois niveaux de détail (complet de près, réduit à moyenne distance, silhouette au loin). Les expressions et les cheveux ne sont calculés que de près.

## Étapes (arrêt pour validation à chaque fois)

1. **Documents et plan** (fait avec ce fichier).
2. **Atelier des personnages** : la page « Atelier des espèces » devient l'atelier des personnages, avec quatre onglets (Humains, Vaëls, Souvenirs, Meutes inchangées) et quatre éclairages (studio, jour, nuit bioluminescente, pluie).
   - 3 propositions d'humains (homme, femme, enfant, ancien chacune) ;
   - 3 propositions de Vaëls (un représentant par clan) ;
   - 3 rendus de souvenirs dorés ;
   - un gros plan de visage avec les expressions ;
   - un curseur de vieillissement (enfant → ancien).

   **Stop : tu choisis.**
3. **Matières et effets dynamiques** sur les modèles choisis (mouillé, boue, givre, chaleur, blessures, âge, nuit). **Stop : captures.**
4. **Générateur de variations**, personnages principaux faits à la main (chefs, Aldric Moreau et son éclat de cristal), enfants à l'alliage acier-cuivre.
5. **Remplacement dans le jeu**, niveaux de détail, mesure des performances sur iPad. **Stop : captures de jour, de nuit, sous la pluie et au conseil.**

## Ce qui est remplacé

- L'apparence actuelle des Vaëls de l'atelier : peau sombre à motifs, armures en cuir, écorce, jute et coquillages, images de référence « peau ». Elle devient métallique. Les silhouettes et les idées des quatre peuples (bois du Cervidé, frondes de l'Échassier, nageoires du Sylphe, quatre yeux du Veilleur) peuvent servir de base aux propositions de Vaëls.
- Les meutes de l'atelier ne changent pas.
