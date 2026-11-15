# Mise en ligne du Dashboard

Le site est en ligne sur Netlify : https://dashboard-perso-ge.netlify.app

## Comment ça marche aujourd'hui

- **Hébergement** : Netlify (site « dashboard-perso-ge »). Le fichier `netlify.toml` indique comment construire l'app.
- **Connexion** : une phrase de passe personnelle. Le site n'en garde qu'une empreinte chiffrée (scrypt salé),
  jamais la phrase elle-même. Après 5 erreurs de suite, la connexion se bloque 15 minutes. La session dure 90 jours par appareil.
- **Préférences** (thème, ordre des onglets) : gardées sur chaque appareil, pas encore synchronisées.

## Variables d'environnement (Netlify → Project configuration → Environment variables)

| Nom | Rôle |
|---|---|
| `NEXT_PUBLIC_AUTH_MODE` | `motdepasse` |
| `SESSION_SECRET` | Clé secrète qui signe les sessions (au moins 32 caractères aléatoires) |
| `PASSWORD_HASH` | Empreinte de la phrase de passe |

Après tout changement de variable, il faut relancer une mise en ligne (Deploys → Trigger deploy).

## Changer de phrase de passe

1. Sur un ordinateur avec Node.js, dans le dossier du projet : `node scripts/empreinte-mot-de-passe.mjs`
2. Tape la nouvelle phrase (au moins 10 caractères) : le script affiche une empreinte.
3. Dans Netlify, remplace la valeur de `PASSWORD_HASH` par cette empreinte, puis relance une mise en ligne.

Pour déconnecter tous les appareils d'un coup : remplace `SESSION_SECRET` par une nouvelle valeur aléatoire et relance une mise en ligne.

## Plus tard : Supabase et Google

Quand le Dashboard aura besoin d'une base de données (budget, listes de films, synchronisation des préférences) et de Gmail,
on branchera Supabase et la connexion Google. Le code est déjà prêt : `supabase/migrations/0001_init.sql`,
le mode `supabase` de `src/lib/auth/mode.ts`, et les variables `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et `ALLOWED_EMAIL`.

## À savoir

- Netlify Blobs (stockage clé/valeur de Netlify) ne répondait pas depuis le serveur Next.js 16 : c'est pourquoi
  l'empreinte du mot de passe est dans une variable d'environnement.
- Netlify insère un commentaire dans `<head>` : le script de thème est donc placé en tête de `<body>`
  (sinon React signale une erreur d'hydratation).
- Open-Meteo limite les requêtes gratuites par adresse IP : la météo est demandée par le navigateur, pas par le serveur.
