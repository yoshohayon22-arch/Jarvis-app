# Chronos : plan d'architecture (V1)

> Statut : **proposition, en attente de validation**. Aucun code de jeu n'est écrit tant que ce plan n'est pas validé.

---

## 0. Décisions de cadrage

| Sujet | Décision proposée | Pourquoi |
|---|---|---|
| Emplacement | Dossier `chronos/` à la racine du dépôt, à côté de l'app Jarvis (Flask) existante, qui reste intacte | Ne rien casser. On pourra extraire le dossier dans son propre dépôt plus tard |
| Monorepo | npm workspaces : `shared/`, `client/`, `server/` | Les types et schémas sont partagés entre le jeu et le proxy |
| Langage | TypeScript strict partout | Demandé |
| Client | Vite + Three.js (une seule dépendance de rendu) | Demandé |
| Validation | `zod` (≈ 13 ko gzip) pour les schémas de missions, de dialogues et de sauvegardes | Plus léger et plus sûr que d'écrire un validateur maison |
| Proxy | Node 22 avec `node:http` natif + `@anthropic-ai/sdk`. Pas d'Express | Moins de dépendances, et la surface est petite (4 routes) |
| Physique | Moteur cinématique maison (gravité, collisions sphère/AABB, impulsions) | Suffisant pour la télékinésie et les objets légers. Pas besoin de cannon/rapier en V1 |
| Assets 3D | Modèles **glTF CC0** (KayKit) chargés depuis `/assets`, rendu **stylisé-réaliste** (détails de surface PBR, HDRI, post-traitement). Géométrie codée uniquement en placeholder | Décision révisée au J1 à la demande du joueur-commanditaire |
| Tests | Vitest (simulation, IA, validateurs, sauvegarde) + Playwright (test de fumée de la démo à chaque jalon) | Chaque jalon a un test automatisé et une démo |
| Langue | Code et identifiants en anglais, textes du jeu en français (fichiers de données) | Demandé, et prêt pour la localisation |

---

## 1. Vue d'ensemble

```
┌──────────────────────────── NAVIGATEUR ─────────────────────────────┐
│                                                                     │
│  RENDU (Three.js)        UI (HTML/CSS par-dessus le canvas)         │
│  scène, caméra 3e pers.  dialogue · journal · carte · debug (F3)    │
│        ▲ lit des snapshots          │ intentions du joueur          │
│        │                            ▼                               │
│  ┌──────────────── SIMULATION (déterministe, sans IA) ───────────┐  │
│  │ WorldClock · Agents · Needs · Schedules · Navigation           │  │
│  │ Perception/Witnesses · EventLog · Memory · Rumors              │  │
│  │ Reputation · Consequences · Powers engine · Missions runtime   │  │
│  └───────────────▲─────────────────────────────┬──────────────────┘  │
│                  │ effets VALIDÉS              │ requêtes (contexte) │
│  ┌───────────────┴──── COUCHE IA (client) ─────▼──────────────────┐  │
│  │ AiGateway : cache · budget · prompts · validation zod · repli  │  │
│  └────────────────────────────────┬───────────────────────────────┘  │
│  SAVE : IndexedDB (auto-save)     │ HTTPS (aucune clé côté client)   │
└───────────────────────────────────┼─────────────────────────────────┘
                                    ▼
                 ┌──── PROXY NODE (server/) ────┐
                 │ /api/dialogue  /api/mission  │
                 │ /api/summarize /api/budget   │
                 │ clé API (variable d'env.)    │
                 │ plafonds de tokens, budget,  │
                 │ cache disque, limite d'appels│
                 └──────────────┬───────────────┘
                                ▼
                         API Claude (Anthropic)
```

**Règle d'or** : la simulation est la seule source de vérité. L'IA ne fait que *proposer* (une réplique, une mission, un résumé). Le code valide la proposition avec un schéma puis l'applique via des commandes bornées. Le rendu ne modifie jamais l'état ; il lit des snapshots.

---

## 2. Arborescence

```
chronos/
├─ package.json                 # workspaces + scripts (dev, test, build)
├─ README.md
├─ docs/ARCHITECTURE.md
├─ shared/src/
│  ├─ schemas/                  # zod : mission, dialogue, pack, save, events
│  ├─ types.ts
│  └─ ids.ts                    # identifiants typés (CharacterId, LocationId…)
├─ client/
│  ├─ index.html
│  ├─ src/
│  │  ├─ main.ts                # boot : charge le pack, la sauvegarde, lance la boucle
│  │  ├─ core/                  # GameLoop (pas fixe), SeededRng, EventBus, Commands
│  │  ├─ sim/
│  │  │  ├─ world.ts            # WorldState (données pures, sérialisables)
│  │  │  ├─ clock.ts            # temps du monde, jour/nuit, timeScale par zone
│  │  │  ├─ agents/             # KeyCharacter, Extra, besoins, IA d'utilité, routines
│  │  │  ├─ nav/                # grille de navigation + A* + graphe de points de passage
│  │  │  ├─ perception.ts       # témoins : distance, ligne de vue, lumière, invisibilité
│  │  │  ├─ eventLog.ts         # journal global (vérité terrain)
│  │  │  ├─ memory.ts           # souvenirs par personnage, oubli, résumé
│  │  │  ├─ rumors.ts           # propagation, délai, déformation
│  │  │  ├─ reputation.ts       # 4 groupes, -100..+100, avis individuels
│  │  │  ├─ consequences.ts     # moteur de règles (conditions → effets visibles)
│  │  │  └─ physics.ts          # cinématique légère pour les objets
│  │  ├─ powers/
│  │  │  ├─ engine.ts           # énergie, cooldowns, déblocage, voies héros/sombre
│  │  │  ├─ primitives/         # timeBubble, freeze, rewind, force, lift, invisibility,
│  │  │  │                      # echoRead, disguise   (briques réutilisables)
│  │  │  └─ classify.ts         # contexte → acte (héroïque / sombre / neutre)
│  │  ├─ ai/
│  │  │  ├─ gateway.ts          # appels au proxy, cache local, budget, repli
│  │  │  ├─ prompts/            # construction des prompts (dialogue, mission, résumé)
│  │  │  └─ fallback.ts         # répliques locales selon l'archétype et l'humeur
│  │  ├─ missions/
│  │  │  ├─ generator.ts        # contexte → IA → validation → régénération → secours
│  │  │  ├─ validator.ts        # références réelles, effets bornés, étapes autorisées
│  │  │  └─ runtime.ts          # suivi des étapes via le journal d'événements
│  │  ├─ render/                # scène, matériaux, village procédural, PNJ (InstancedMesh),
│  │  │                         # PlayerController, ThirdPersonCamera, DayNight, VFX des pouvoirs
│  │  ├─ ui/                    # dialogue, journal, carte, HUD (énergie), panneau debug
│  │  └─ save/                  # IndexedDB, versions + migrations
│  ├─ data/packs/medieval/      # ← PACK D'ÉPOQUE (voir §9)
│  └─ test/                     # Vitest (la simulation tourne sans navigateur)
├─ server/src/
│  ├─ index.ts                  # node:http, routes, CORS restreint
│  ├─ anthropic.ts              # client SDK, sorties structurées, cache de prompt
│  ├─ budget.ts                 # compteur de dépense, plafond journalier
│  ├─ cache.ts                  # cache de réponses (mémoire + fichier JSON)
│  └─ rateLimit.ts
└─ e2e/                         # Playwright : test de fumée par jalon
```

---

## 3. Couche SIMULATION

### 3.1 Boucle et déterminisme
- **Pas fixe** : la simulation tourne à 10 Hz (pas de 100 ms). Le rendu tourne à 60 fps et interpole entre les états.
- **RNG à graine** (mulberry32) : même graine + mêmes entrées = même monde. C'est indispensable pour les tests, la sauvegarde et le rembobinage.
- **Temps du monde** : 1 journée de jeu = 24 min réelles (réglable). Phases : aube, jour, crépuscule, nuit.
- **Commandes** : toute modification d'état passe par une `Command` (`MoveAgent`, `ApplyReputationDelta`, `SpawnRumor`…). Cela donne un point unique de validation, de journalisation et de rejouabilité.
- **LOD de simulation** : les PNJ proches sont simulés à chaque tick. Les PNJ lointains sont mis à jour tous les 10 ticks, avec un déplacement simplifié le long de leur trajet.

### 3.2 Habitants
| | Personnages clés (~12) | Figurants (~100) |
|---|---|---|
| Fiche | traits (Big Five simplifié + traits de jeu : *bavard*, *loyal*, *cupide*, *peureux*…), besoins, emploi du temps, relations, objectifs, inventaire, secrets | archétype (marchand, paysan, enfant, garde…), routine, 2-3 besoins |
| Décision | IA d'utilité : `score = besoin × trait × contexte`, contrainte par l'emploi du temps | machine à états simple |
| Mémoire | complète (§3.4) | seulement les événements marquants (peur, colère) |
| Dialogue | IA en texte libre | répliques locales tirées de modèles |
| Rendu | maillage individuel | `InstancedMesh` (un seul appel de dessin) |

Besoins V1 : faim, repos, social, travail, sécurité. Les routines sont décrites dans le pack (`06:00 forge`, `12:00 taverne`…). Les besoins urgents et les événements (fuir, appeler la garde) peuvent interrompre une routine.

> Mise à jour J2 : implémenté dans `client/src/sim/agents/`. Tous les habitants utilisent la même IA d'utilité légère (emploi du temps + 3 besoins : faim, fatigue, compagnie) ; les personnages clés se distinguent par leur fiche complète. Il n'y a pas de LOD de simulation : 114 habitants à 10 Hz coûtent très peu. Le rendu de la foule passe par des textures d'animation de sommets (`render/crowd.ts`).

### 3.3 Événements, témoins et journal
Chaque acte significatif produit un `WorldEvent` :
```ts
{ id, t, locationId, pos, type: "steal" | "assault" | "rescue" | "power_used" | …,
  actorId,            // vrai auteur (vérité terrain)
  apparentActorId,    // qui les témoins croient voir (≠ actorId si changement de visage)
  targetIds, tags: ["violent","magic","public"], importance: 0..1, powerId? }
```
- **Perception** : un témoin doit être à portée (réduite la nuit), avoir une ligne de vue (rayon contre les boîtes des bâtiments) et l'auteur doit être visible (l'Ombre bloque la perception). La perception produit des souvenirs *subjectifs* qui contiennent `apparentActorId`.
- Le **journal global** stocke la vérité terrain. Il est borné (fenêtre glissante + archivage par lieu) et l'**Écho du passé** le lit directement.

### 3.4 Mémoire
```ts
Memory { eventId?, rumorId?, t, about: actorId, what, where, importance, confidence, emotion }
```
- **Oubli** : `poids = importance × e^(−âge/τ)` avec un τ qui dépend du trait *rancunier*. Sous un seuil, le souvenir est effacé.
- **Résumé** : les souvenirs importants vieux de plus de N jours sont condensés en `MemorySummary` (« Kael m'a sauvé du feu, je lui dois la vie »). Par défaut, le résumé vient d'un **modèle local** (gabarits). Le résumé IA est optionnel, groupé en lot et réservé aux personnages clés pendant les pauses (nuit), dans la limite du budget.
- Le prompt de dialogue ne reçoit que les **k souvenirs les plus pertinents** (score = poids × lien avec le joueur ou le sujet de la scène) et les résumés.

### 3.5 Rumeurs
```ts
Rumor { id, sourceEventId, claim: { actorId, act, targetId, locationId, severity },
        confidence, distortion, hops, knownBy: Map<agentId, heardAt> }
```
- **Propagation** : quand deux habitants socialisent (taverne, marché), la probabilité de transmission dépend de *bavard* chez l'émetteur, de la relation entre les deux et de la gravité. Un délai minimal sépare chaque saut.
- **Déformation** : à chaque saut, une petite probabilité de modifier un champ (gravité exagérée, lieu approximatif, auteur confondu avec un habitant au profil voisin). `confidence` baisse avec le nombre de sauts.
- **Changement de visage** : la rumeur part de `apparentActorId`, donc le crime est attribué à la personne imitée.
- **Effet** : quand un membre d'un groupe entend une rumeur, la réputation de ce groupe envers l'auteur présumé change de `delta × confidence × poids_rumeur` (0,5 par défaut ; un témoin direct compte 1,0).

### 3.6 Réputations
- Groupes : `villagers`, `royal_guard`, `thieves_guild`, `mages_order`, chacun de −100 à +100.
- **Table des actes** (données) : `steal → villagers −6, royal_guard −8, thieves_guild +4`, etc. Le contexte module ces valeurs (victime pauvre ou riche, membre du groupe…).
- Chaque personnage clé a aussi un **avis individuel** sur le joueur, plus des drapeaux relationnels (`saved_by_player`, `betrayed_by_player`).
- Pas de jauge morale globale : le HUD et le journal montrent un « portrait » du joueur déduit des 4 réputations (« Héros des pauvres, ennemi de la garde »).

### 3.7 Conséquences (moteur de règles, défini dans les données)
```json
{ "id": "guard_manhunt", "when": { "rep.royal_guard": { "lt": -40 } },
  "then": [ { "setWantedLevel": 2 }, { "spawnPatrols": { "count": 4, "near": "player_last_seen" } } ] }
```
Règles V1, toutes **visibles** à l'écran :
| Déclencheur | Effet visible |
|---|---|
| Réputation garde < −40 / −70 | patrouilles, avis de recherche affichés, arrestation à vue, portes fermées la nuit |
| Indice de terreur d'un quartier > seuil | échoppes fermées, rues vides, débris et brasiers, couleurs ternes, figurants qui fuient le joueur |
| Indice de terreur en baisse / aide apportée | retour des marchands, lanternes, fête au marché |
| `betrayed_by_player` sur un allié | l'allié peut monter un piège (le donneur de mission ment, une embuscade se prépare) |
| Réputation guilde > +50 | accès au repaire, prix réduits au marché noir |
| Réputation ordre des mages < −50 | chasseurs de mages, temple fermé au joueur |

Les quartiers ont un état (`prosperity`, `terror`, `guardPresence`) que le rendu traduit en props, en éclairage et en densité de foule.

---

## 4. Pouvoirs (définis dans les données)

### 4.1 Principe
Le moteur ne connaît que des **primitives d'effet**. Un pouvoir est une **composition de primitives** décrite en JSON. Ajouter un pouvoir revient à écrire du JSON, sauf s'il faut une primitive inédite.

Primitives V1 : `timeScaleZone`, `freezeTarget`, `rewindLocal`, `applyForce`, `lift`, `invisibility`, `echoRead`, `disguise`, `fear` (aura), `shield`.

```json
{
  "id": "time_control", "enabled": true, "energyMax": 100,
  "abilities": [
    { "id": "slow", "path": "base", "cost": 15, "cooldown": 4, "duration": 5,
      "effects": [{ "primitive": "timeScaleZone", "radius": 6, "scale": 0.3 }] },
    { "id": "freeze", "path": "base", "cost": 30, "duration": 3,
      "effects": [{ "primitive": "freezeTarget", "maxTargets": 3 }] },
    { "id": "rewind", "path": "base", "cost": 40, "window": 4,
      "effects": [{ "primitive": "rewindLocal", "radius": 8 }] },
    { "id": "guardian_stasis", "path": "hero", "unlock": { "rep.villagers": { "gte": 30 } },
      "effects": [{ "primitive": "freezeTarget", "targets": "projectiles_and_falling" }, { "primitive": "shield" }] },
    { "id": "time_loop", "path": "dark", "unlock": { "darkActs": { "gte": 5 } },
      "effects": [{ "primitive": "rewindLocal", "loops": 3, "target": "single" }, { "primitive": "fear", "amount": 40 }] }
  ],
  "witnessTags": ["magic", "time"]
}
```
Les V2 (`summon_dead`, `possession`, `portals`, `beast_mastery`) sont présents avec `"enabled": false` et des primitives marquées `planned`.

### 4.2 Voies héroïque et sombre
- Chaque pouvoir a des capacités **de base** et deux **branches** (héros et sombre).
- Les branches se débloquent par des **conditions** (réputations, nombre d'actes héroïques ou sombres, drapeaux de mission), puis le joueur dépense des points d'**Essence** gagnés par les missions et les actes marquants.
- **Classification de l'acte** (`classify.ts`) : un même pouvoir peut produire un acte héroïque ou sombre selon le contexte (cible innocente ou hostile, danger évité ou causé, vol). C'est l'acte qui alimente témoins, rumeurs et réputations.

### 4.3 Règles communes
- Une jauge d'énergie unique avec recharge (plus rapide au repos et la nuit pour l'Ombre). Chaque capacité a son coût, son cooldown, sa portée et sa durée.
- Un pouvoir utilisé devant témoins génère un `WorldEvent` `power_used` avec les tags du pouvoir (l'ordre des mages réagit à `magic`, la garde à `violent`).
- **Interactions** entre pouvoirs, gérées par le moteur et non au cas par cas :
  - temps + télékinésie : un objet gelé reste déplaçable et reprend son élan au dégel ;
  - ombre + changement de visage : imitation silencieuse ;
  - rembobiner + écho : rembobiner une scène écrit un « pli temporel » dans le journal, que l'écho peut révéler (accroche pour le mystère).
- **Rembobinage local** : un tampon circulaire de snapshots (5 s à 10 Hz) pour les entités de la zone : positions, vitesses, PV, état des objets. Le monde lointain n'est pas rembobiné ; la cohérence est garantie en n'annulant que les événements de la zone et de la fenêtre (ils sont marqués `undone` dans le journal, et les témoins de la zone « oublient »).

> Mise à jour J5 : implémenté dans `client/src/sim/powers/` (moteur), `sim/physics.ts` (objets mobiles) et `sim/consequences.ts` (règles). Écarts avec le plan : les branches se débloquent directement par les actes (3 actes héroïques ou sombres), sans points d'Essence pour l'instant (ils arriveront avec les missions) ; la primitive `fear` est remplacée par l'indice de terreur des quartiers ; le rembobinage restaure aussi la position du joueur et sa bourse.

### 4.4 Écho du passé et changement de visage (J6)
- **Écho** : sur un lieu ou un objet, il interroge le journal global (`eventLog.query({ locationId | objectId, window })`) et rejoue les événements sous forme de silhouettes fantômes. Il n'y a **aucune invention par l'IA**. Il montre le vrai `actorId`, ce qui permet de démasquer un imitateur.
- **Changement de visage** : il faut avoir observé la cible de près pendant X secondes. La durée est limitée. Un personnage clé intime de la personne imitée peut percer le déguisement (jet basé sur la relation). Les actes commis sous ce visage reçoivent `apparentActorId = cible`.

> Mise à jour J6 : implémenté dans `sim/powers/engine.ts` (primitives `echoRead` et `disguise`), `sim/ambient.ts` (méfaits et rencontres des habitants eux-mêmes) et `sim/consequences.ts` (accusation et arrestation d'un habitant). Écarts avec le plan : l'écho interroge le journal par position et rayon, pas par objet ; le déguisement n'est pas percé par un jet de dés mais par une règle déterministe (la personne imitée ou un proche, relation > 30, qui voit Kael de face, sans obstacle, à portée) ; le dialogue sous déguisement envoie au proxy le nom de la personne imitée (`context.speaker`).

---

## 5. Couche IA

### 5.1 Quand l'IA est appelée (et seulement là)
1. Dialogue libre avec un personnage clé.
2. Génération de mission.
3. Résumé de mémoire (optionnel, en lot).

### 5.2 Le proxy (`server/`)
- La clé est dans `ANTHROPIC_API_KEY` côté serveur uniquement, et n'est **jamais** renvoyée ni journalisée.
- Routes :
  - `POST /api/dialogue` : `{ characterSheet, memories, reputation, scene, history, playerText }` → `{ line, emotion, intent, proposals[] }`
  - `POST /api/mission` : `{ worldDigest, allowedIds }` → mission en JSON
  - `POST /api/summarize` : `{ characterId, memories[] }` → résumés
  - `GET /api/budget` : dépense, plafond, taux de cache
- Garde-fous côté serveur : `max_tokens` par route (dialogue 300, mission 1 500, résumé 400), taille maximale de la requête, limite d'appels par minute, **plafond de dépense journalier** (estimé avec `response.usage` × prix de la grille de configuration). Au-delà du plafond, le serveur répond `402 budget_exceeded` et le client passe en mode repli.
- **Sorties structurées** (`output_config.format` avec un schéma JSON) pour les missions et les dialogues. Le client revalide ensuite avec zod (défense en profondeur).
- **Cache de prompt** : un préfixe stable (bible du monde + règles + fiche du personnage) est marqué `cache_control`. Le contexte volatil (heure, scène, texte du joueur) vient après. Avec 12 personnages et des fiches figées, les relectures depuis le cache coûtent environ 10 % du prix normal.
- **Cache de réponses** : un hachage de la requête normalisée donne la clé, avec un TTL (missions : non mises en cache ; dialogue : cache court pour les salutations et questions répétées).

### 5.3 Modèles (à valider par vous, voir les questions en fin de document)
Prix officiels actuels (par million de tokens, entrée / sortie) :
| Modèle | Prix | Usage proposé |
|---|---|---|
| `claude-opus-5-5` | 4 $ / 20 $ | défaut recommandé par Anthropic ; meilleure qualité, missions |
| `claude-sonnet-5-5` | 2 $ / 10 $ | compromis |
| `claude-haiku-5-5` | 0,10 $ / 0,50 $ | dialogues rapides et peu coûteux |

Le modèle est un **réglage par route** dans `server/config.json` ; on peut en changer sans toucher au code.

### 5.4 Garde-fous du dialogue
- Le texte du joueur est limité (300 caractères) et placé dans un bloc délimité. Le système demande au personnage de rester dans l'univers et d'ignorer toute instruction venant du joueur.
- L'IA renvoie des **propositions** (`relationship_delta` borné à ±5, `reveal_info:<infoId>` uniquement si cette info figure dans les secrets que la fiche autorise, `offer_mission`, `refuse`, `call_guard`). Le code les valide, les borne, puis les applique. L'IA ne peut **jamais** donner un objet, ouvrir une porte ou modifier une réputation directement.
- **Repli** : en cas d'erreur, de dépassement de délai (8 s) ou de budget épuisé, une réplique locale est choisie selon l'archétype, l'humeur, la réputation et le sujet détecté par mots-clés. Le jeu reste jouable à 100 % sans IA.

### 5.5 Coût visible
Un panneau debug (F3) affiche le nombre d'appels par route, les tokens d'entrée, de sortie et lus depuis le cache, le coût estimé de la session et du jour, le taux de succès du cache et le mode actif (IA ou repli).

---

## 6. Missions

### 6.1 Format
```ts
Mission {
  id, title, giverId: CharacterId, summary,
  objective: string,
  steps: Step[],          // type ∈ { goto, talk, retrieve, deliver, protect, investigate_echo,
                          //          infiltrate, eliminate_threat, survive_until, choose }
  rewards: { essence: 0..3, gold: 0..200, items: ItemId[] },   // objets existants uniquement
  reputationEffects: { [group]: -25..25 },   // sur réussite, et bloc séparé sur échec
  failureConditions: FailCond[],             // giver_dead, time_exceeded, detected, rep_below…
  moralFork?: { heroOutcome, darkOutcome }   // la plupart des missions ont deux issues
}
```

### 6.2 Chaîne de génération
1. **Résumé de l'état du monde** (`worldDigest`) : tensions entre groupes, réputations, 10 événements récents importants, PNJ disponibles, **listes fermées** des identifiants autorisés (lieux, personnages, objets).
2. Appel IA avec sortie structurée.
3. **Validation par le code** : schéma zod ; tous les identifiants existent dans le pack ; le donneur est vivant et présent ; les étapes sont réalisables (lieu accessible, cible existante) ; les effets sont bornés ; pas de doublon avec une mission active.
4. Échec → **régénération** (au plus 2), en renvoyant la liste des erreurs à l'IA.
5. Nouvel échec → **mission de secours** : un modèle local paramétré (« X a perdu Y au lieu Z ») rempli avec des données réelles.
6. Application : la mission est enregistrée ; le runtime suit les étapes en écoutant le journal d'événements.

Pour la V1, trois **intentions** de mission guident la génération (enquête, protection, infiltration), ce qui garantit 3 missions jouables de genres différents.

---

## 7. Rendu

> Mise à jour J1 : le village est construit à partir de `visuals.json` (modèles KayKit instanciés), d'un sol peint avec normal maps, d'un éclairage HDRI et d'une chaîne `postprocessing` (SSAO, DOF, bloom, ACES, étalonnage, vignette) avec préréglages basse/haute. Les lignes ci-dessous décrivent la version d'origine.

- **Village procédural** à partir des données du pack : taverne, forge, temple, caserne, quartier pauvre, place du marché, remparts. Les bâtiments sont composés de primitives low-poly (flat shading), avec des palettes par quartier.
- **Personnages** faits de primitives assemblées (tête, torse, membres) et animés en code (marche, course, idle, peur). Les figurants utilisent un `InstancedMesh` avec variations de couleur.
- **Caméra** troisième personne : orbite à la souris (pointer lock), collision avec les murs, zoom.
- **Contrôles** : ZQSD/WASD, Maj pour courir, Espace pour esquiver, E pour interagir, 1 à 5 pour les pouvoirs, J journal, M carte, F3 debug.
- **Jour/nuit** : soleil et lune directionnels, ciel en dégradé, brouillard teinté, lanternes allumées la nuit, ombres limitées à la zone proche.
- **VFX des pouvoirs** : bulle temporelle (shader de distorsion + désaturation), traînées de télékinésie, silhouette translucide pour l'Ombre, fantômes bleutés pour l'Écho.
- **Budget de performance** : 60 fps sur un portable récent, moins de 150 appels de dessin, géométrie statique fusionnée.

---

## 8. Sauvegarde
- IndexedDB, avec un petit wrapper maison (pas de dépendance).
- `SaveGame { version, packId, seed, rngState, worldTime, world, agents, memories, rumors, eventLog (fenêtre), reputations, powers, missions, flags }`.
- Sauvegarde automatique toutes les 2 heures de jeu, à chaque fin de mission et à la fermeture de l'onglet (`visibilitychange`), sur 3 emplacements tournants. Chargement manuel depuis le menu.
- Format versionné avec des migrations. Un test unitaire vérifie que `save → load → state` donne un état identique (comparaison profonde) et qu'une simulation rechargée suit exactement la même trajectoire grâce à la graine.

---

## 9. Packs d'époque et voyage dans le temps (préparé, pas implémenté)

```
data/packs/<era>/
  pack.json         # { id, era, name, version, startLocation, calendar }
  locations.json    # lieux, quartiers, géométrie déclarative
  factions.json     # groupes + table des actes
  characters.json   # personnages clés
  extras.json       # archétypes de figurants + routines
  powers.json       # (peut surcharger des pouvoirs globaux, ex. visuel cyberpunk)
  consequences.json # règles
  dialogue_fallback.json
  mission_templates.json
  lore.md           # bible de l'époque (préfixe mis en cache pour l'IA)
```
- Le moteur ne contient **aucune** référence à « médiéval ». Tout vient du pack.
- `TimelineManager` (vide en V1) contient `eras: Map<eraId, WorldState>` et une table de **liens causaux** dans les packs :
  `{ "if": { "era": "medieval", "flag": "temple_burned" }, "then": { "era": "modern", "patch": { "location.old_temple": "ruins" } } }`
  Cela permettra plus tard que les actes passés modifient l'état initial ou courant d'une autre époque.
- Époques futures prévues : `modern_city`, `cyberpunk`, `interwar_1920_1950`.

---

## 10. Héros et pitch (proposition)

**Kael**, 19 ans, orphelin. Il porte un éclat de verre ambré **fusionné dans sa paume**, seul vestige du royaume de **Valdren**, effacé en une nuit il y a quinze ans : personne ne se souvient de sa chute, seulement qu'il « n'est plus ». Recueilli à **Brumeval**, un bourg-marché frontalier, il s'éveille au pouvoir du temps le jour où l'éclat se fissure.

Le mystère : certains habitants vivent des *déjà-vu*, le journal du monde contient des « plis » inexplicables, et l'Écho du passé révèle parfois des scènes **qui n'ont pas encore eu lieu**. Valdren n'a peut-être pas été détruit, mais *déplacé dans le temps*. C'est l'accroche du voyage entre époques.

Ton : humour léger au quotidien (le forgeron qui rate tout, le prêtre trop bavard), mais des choix aux conséquences dures.

Les 12 personnages clés, ébauche à détailler en J2 et J3 :
aubergiste, forgeron, prêtresse, capitaine de la garde, garde corruptible, maîtresse de la guilde des voleurs, pickpocket enfant, mage de l'ordre, apprentie mage, marchand riche, veuve du quartier pauvre, vieux conteur (gardien du mystère).

---

## 11. Jalons (rappel) et critère de « terminé »

| Jalon | Démo jouable | Tests automatisés |
|---|---|---|
| J1 | se déplacer dans le village vide, caméra, cycle jour/nuit accéléré | horloge, contrôleur (unitaire) + fumée Playwright (le canvas s'affiche, aucune erreur console) |
| J2 | ~12 personnages clés + 100 figurants qui suivent leurs routines | déterminisme sur 1 000 ticks, emplois du temps, A* |
| J3 | commettre un acte, voir les témoins réagir et la rumeur se propager ; panneau réputations | **mémoire, oubli, rumeurs, déformation, réputations** |
| J4 | parler librement à un personnage clé (avec clé API) ou en mode repli | proxy simulé : budget, cache, validation, repli |
| J5 | temps, télékinésie, ombre + conséquences visibles (patrouilles, quartier dégradé) | coûts et cooldowns, interactions temps + télékinésie, règles de conséquences |
| J6 | enquêter avec l'Écho, piéger quelqu'un avec un faux visage | écho = vérité du journal ; attribution des rumeurs sous déguisement |
| J7 | 3 missions générées et jouables | validateur (cas invalides), régénération, secours |
| J8 | sauvegarde et chargement, réglages de coût, finitions | aller-retour de sauvegarde identique, migrations |

À chaque fin de jalon : compte rendu (ce qui marche, ce qui ne marche pas, ce que vous devez tester vous-même), commit et push sur la branche, puis **arrêt jusqu'à votre accord**.

---

## 12. Risques identifiés

| Risque | Parade |
|---|---|
| Rembobinage incohérent avec le reste du monde | rembobinage **local** et borné, événements annulés marqués `undone` |
| Coût IA qui dérape | plafonds serveur, cache, modèles réglables, repli complet |
| L'IA invente des lieux ou des objets | listes fermées dans le prompt, sorties structurées, validateur, secours local |
| Injection via le texte du joueur | bloc délimité, l'IA ne fait que proposer, effets bornés par le code |
| Performances avec 100+ PNJ | instancing, LOD de simulation, pathfinding mis en cache |
| Taille du périmètre | V1 stricte ; tout ce qui sort du cadre est noté pour la V2 |
