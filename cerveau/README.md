# 🧠 Le Cerveau

Mon second cerveau personnel : je jette mes infos (texte, dictée, fichiers), une IA les range en **neurones**, les relie entre eux et me les affiche sur une carte animée. Tout tourne en local ; seule l'analyse IA passe par l'API Anthropic, côté serveur.

## Lancer le projet

```bash
cd cerveau
npm install
cp .env.local.example .env.local      # puis colle ta clé : ANTHROPIC_API_KEY=sk-ant-...
npm run dev                           # → http://localhost:3000
```

- Au **premier lancement**, `seed/cerveau-seed.json` est importé automatiquement. Les relances ne créent pas de doublons : l'import se fait par `id`, ne complète que les neurones jamais modifiés à la main, et ne repasse que si le fichier a changé.
- `npm run seed:demo` ajoute 15 entrées d'exemple (dates étalées, dépenses du mois) pour voir la carte vivante. Elles portent le tag `exemple`, et `npm run seed:demo -- --remove` les retire.
- `npm run reset` efface la base locale (`data/`). Le seed est réimporté au lancement suivant.
- **Depuis ton téléphone** (même Wi-Fi) : `npm run dev -- -H 0.0.0.0`, puis ouvre `http://<IP-de-ton-ordi>:3000`. La dictée nécessite HTTPS ou localhost sur la plupart des navigateurs mobiles. Le plus simple est `npx next dev --experimental-https -H 0.0.0.0`.
- Production locale : `npm run build && npm start`.

## Utilisation

| Où | Quoi |
|---|---|
| Barre du bas, mode **Saisie** (`/`) | Phrase libre ou 🎙 dictée (fr-FR). L'IA crée des neurones (personne, projet, idée, tâche, argent, lieu, organisation, note), réutilise les existants et trace les liens. Le texte d'origine reste attaché comme **source**. |
| Barre du bas, mode **Question** (`?`) | « Qu'est-ce que je sais sur le Standard de Liège ? ». La réponse s'appuie *uniquement* sur tes neurones, les cite, et ceux-ci s'illuminent sur la carte. |
| Carte | Une couleur par type. La taille dépend du nombre de connexions. Les neurones récents ou souvent touchés brillent, les vieux pâlissent. Clic : panneau (résumé, fichier, connexions, sources, modifier / fusionner / supprimer). Les **documents** (losanges) s'ouvrent aussi dans un nouvel onglet. |
| Recherche + filtres | Chercher un neurone. Clic sur un type pour l'afficher ou le masquer, double-clic pour n'afficher que ce type. |
| Carte du haut | **Neurone oublié du jour** : un projet ou une idée délaissé, avec une phrase de l'IA. |
| 💰 Argent | Dépenses, rentrées et solde du mois par catégorie (navigation mois par mois). |
| ⋯ Menu | Export / import JSON du cerveau, ajout de fichiers, analyse de `/inbox`. |

### Fichiers : dossier `inbox/` et glisser-déposer

Dépose des **PDF, Word (.docx), images (PNG/JPG/WEBP/GIF), captures d'écran, .txt/.md** :
- dans le dossier `cerveau/inbox/`, scanné toutes les ~10 s tant que l'app tourne ;
- ou directement **sur la carte** (glisser-déposer).

Chaque fichier est copié dans `data/files/`, puis analysé par l'IA (vision pour les images, lecture native des PDF, texte des .docx). Il devient un neurone « document » avec une miniature, relié aux neurones extraits et aux neurones existants. Une fois traités, les originaux de l'inbox passent dans `inbox/traites/` (ou `inbox/erreurs/`). Un même fichier n'est jamais analysé deux fois. Les photos iPhone HEIC ne sont pas lues : utilise JPG/PNG (Réglages › Appareil photo › Formats › « Le plus compatible »).

## Technique

- **Next.js 15** (App Router), TypeScript, Tailwind v4, `react-force-graph-2d` (rendu canvas des halos et animations).
- **SQLite local** (`better-sqlite3`, fichier `data/cerveau.db`). Tables `nodes`, `edges`, `sources`, `node_sources`, `files`, avec dates de création et de dernière activité, plus un index plein texte FTS5 (sans accents) pour la recherche.
- **IA** : `claude-sonnet-5-5` (modifiable via `CERVEAU_MODEL`), appelée uniquement depuis les routes API. La clé n'est jamais envoyée au navigateur. Les sorties sont en **JSON structuré strict** généré depuis des schémas **zod**, revalidées par zod, avec un nouvel essai si le JSON est invalide. Le repli serveur `fallbacks: "default"` est activé : si le modèle refuse une requête, l'API la relance sur un modèle de secours.
- **Anti-doublon** : l'IA reçoit les ~150 neurones existants les plus pertinents (plein texte, titres présents dans la phrase, plus actifs) et doit réutiliser leur `id`. Un filet de sécurité fusionne aussi les titres identiques.
- **Questions** : récupération par mots-clés et voisins dans le graphe (≤ 40 neurones avec leurs sources). Pour l'argent, les totaux sont calculés en SQL et fournis à l'IA.
- **Sans clé API**, l'app reste utilisable : rangement simplifié, chaque saisie gardée comme note, réponses = liste des neurones trouvés. `CERVEAU_MOCK_AI=1` force ce mode (tests).
- **Sauvegarde** : l'export JSON contient neurones, liens, sources et la liste des fichiers. Les fichiers eux-mêmes sont dans `data/files/` : copie ce dossier pour une sauvegarde complète.

```
cerveau/
├─ seed/cerveau-seed.json      cerveau de départ (importé automatiquement)
├─ inbox/                      dépose tes fichiers ici
├─ data/                       base SQLite + copies des fichiers (non versionné)
├─ scripts/seed-demo.ts        15 entrées d'exemple
└─ src/
   ├─ app/                     page carte, page /argent, routes /api/*
   ├─ components/              BrainGraph, CommandBar, NodePanel, AnswerCard, ForgottenCard, MoneyView
   └─ lib/                     db, repo, extract, ask, forgotten, files, inbox, ai/{client,schemas,prompts}
```
