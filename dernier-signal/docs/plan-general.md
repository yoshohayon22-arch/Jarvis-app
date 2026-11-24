# Dernier Signal · Plan général (mis à jour avec le document « civilisation »)

Référence : `docs/prompt-principal.md`, `docs/prompt-missions.md`, `docs/prompt-civilisation.md`.
En cas de contradiction, le document civilisation fait foi, y compris pour l'ordre des étapes.

## Où en est le projet

Déjà construit et validé (version jouable en ligne) :
- Atelier des robots : design choisi **B · « Rouille »**, nom **R-12**.
- **Zone 1 · Station Halcyon** : missions 0 à 9 et ses 3 secrets.
- **Zone 2 · Épave de l'Asterion** : missions 10 à 17 et ses 3 secrets (apesanteur, gravité qui s'inverse, bottes magnétiques, réacteur, capsules, descente).

Ce travail devient l'essentiel de l'**acte 1**. La Zone 3 (missions 18 à 24) n'a pas encore été construite : elle devient le début de l'acte 2.

## Nouvelle structure

### Acte 1 · Le signal (≈ 1 h)
Missions 0 à 17 conservées. À ajouter (étape 4) :
- **Halcyon** : gestion de l'énergie (couper une section pour en alimenter une autre : portes, lumières, gravité, chauffage), avec des chemins qui s'ouvrent ou se ferment.
- **Asterion** : les vagues de débris deviennent un outil : s'accrocher à un gros débris avec les bottes pour traverser un gouffre.
- Resserrer quelques passages pour tenir l'heure.

### Acte 2 · La fondation (≈ 5 h et plus)
1. **Arrivée** (anciennes missions 18 à 24) : atterrissage, campement, brume, spores, pluie, dernier message d'Ilse, la balise. Nouvelle mécanique : les plantes réagissent aux bips de R-12.
2. **La balise** révèle qu'elle n'appelait pas R-12 pour partir, mais pour faire naître quelque chose. Le choix « Répondre / Rester » est retiré.
3. **Gouvernance** sur 4 ères : Survie → Fondation → Expansion → Unité ou rupture.
4. **Fins de gouvernance** : Fédération, Ordre de fer, Rupture, Exode, et une fin secrète.

## Les systèmes à construire

| Système | Contenu |
|---|---|
| Deux modes | Exploration (3e personne) ↔ Gouverneur (vue du dessus inclinée), transition de caméra fluide |
| Ressources | Énergie, métal, nourriture, eau, médicaments, cristaux de la balise |
| Bases | Bâtiments par espèce et bâtiments communs, placement sur grille souple |
| Population | Habitants avec métier, santé, moral, appartenance ; ils vivent dans les bases |
| Groupes | 7 groupes, chacun avec un chef (nom, personnalité, objectifs, limites) |
| Relations | Tableau confiance / peur / rancune / dette entre groupes ; loyauté envers R-12 ; paix et tension |
| Conseil | Scènes de conseil, dilemmes à 2–4 options, conséquences immédiates **et différées** |
| Lois, diplomatie | Lois à instaurer ou abolir ; traités, échanges, pactes (qui peuvent être trahis) |
| Temps | Jour et nuit, saisons (pluies, tempêtes de débris, longue nuit), pause, ×1, ×2, ×4 |
| Crises | Événements scénarisés et aléatoires |
| Souvenirs | ~20 courtes scènes de l'équipage, surtout avant les grandes décisions |
| Sauvegarde | Emplacement séparé pour la civilisation ; bouton **Gouverner** sur l'écran titre |

## Ordre des étapes (avec un arrêt pour ta validation à chacune)

1. **Ce plan** ← nous sommes ici.
2. **Prototype du mode gouverneur**, simple visuellement :
   - une base sur un petit terrain, vue du dessus (formes simples, couleurs par espèce) ;
   - **deux groupes**, leurs chefs et quelques habitants qui se déplacent ;
   - les ressources en haut de l'écran, qui montent et descendent avec le temps ;
   - quelques bâtiments à placer ;
   - **trois décisions du conseil**, dont une à conséquence différée ;
   - le **tableau des relations**, la loyauté, la paix et la tension ;
   - pause, ×1, ×2, ×4 ;
   - le bouton **Gouverner** sur l'écran titre (Reprendre ma civilisation / Nouvelle fondation, avec le résumé de 30 s qu'on peut passer).
   → **Stop** : tu testes si c'est amusant.
3. **Atelier des Vaëls et des humains** (comme l'atelier des robots). → Stop, tu choisis.
4. **Acte 1 complet** (ajouts de mécaniques ci-dessus, resserrage). → Stop.
5. **Acte 2, une ère à la fois** (Arrivée + Survie, puis Fondation, Expansion, Unité ou rupture). → Stop après chaque ère.
6. **Fins, équilibrage, performances, finitions.**

## Questions pour toi (réponds simplement par les lettres)

**Q1 · Quels deux groupes dans le prototype ?**
- **A · Forgés + Clan des Racines** (recommandé) : l'un produit l'énergie et le métal, l'autre la nourriture ; ils ont besoin l'un de l'autre, et les Racines défendent leur forêt sacrée.
- **B · Bloc de l'Aube + Clan des Hauteurs** : le plus de tension (murs contre territoires), mais moins d'entraide.
- **C · Forgés + Dérivants** : la question de l'autonomie des machines face à des humains qui s'en méfient.

**Q2 · La vérité finale de la balise (à révéler pendant l'acte 2) ?**
- **A · La pépinière** : la civilisation disparue ne s'est pas éteinte, elle s'est mise en sommeil dans la balise. Elle sème des civilisations et choisit des machines comme jardiniers, parce qu'elles durent. L'Asterion et la Halcyon ont échoué à comprendre ; R-12, porteur de leurs souvenirs, est le premier jardinier qui se souvient d'eux.
- **B · Le miroir** : cette civilisation s'est détruite elle-même en se divisant. La balise rejoue l'épreuve qu'elle a perdue : réunir des peuples différents. Elle observe R-12 pour savoir si c'était possible ; selon la fin, elle s'éteint en paix ou recommence ailleurs.
- **C · L'écho** : les Vaëls sont les descendants oubliés de cette civilisation. La balise attendait une intelligence neutre pour les réveiller à leur histoire et les relier à d'autres peuples. Les souvenirs humains de R-12 en font le pont entre les espèces.

**Q3 · Noms des chefs** (propositions, tu peux en changer) :
- Forgés : **Ancre**, le premier Forgé construit par R-12, loyal et méthodique.
- Clan des Racines : **Ysalé**, guérisseuse âgée, douce mais inflexible sur la forêt sacrée.
- Clan des Hauteurs : **Korrun**, chasseur fier, ne pardonne jamais une trahison.
- Clan des Eaux : **Méva**, commerçante rusée, toujours prête à négocier.
- Bloc de l'Aube : **Commandante Hélène Strand**, ancienne officière de l'Asterion, autoritaire mais sincère.
- Dérivants : **Dr Ilan Moreau**, jeune médecin idéaliste.

## Mise en ligne et ressources

- **Poly Haven** : accessible depuis l'environnement de travail (API et téléchargements testés), les vraies textures CC0 continueront d'être utilisées.
- **Dépôt et GitHub Pages** : voir l'explication donnée à Yosh (création du dépôt `dernier-signal` en quelques touches, puis tout est automatique). En attendant, la version jouable reste sur le lien d'artefact habituel.
