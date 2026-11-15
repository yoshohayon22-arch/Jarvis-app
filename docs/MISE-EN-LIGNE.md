# Mise en ligne du Dashboard — guide pas à pas

Durée : environ 30 minutes. Fais les étapes dans l'ordre : chacune a besoin d'une info de la précédente.
Garde un bloc-notes ouvert pour y copier les valeurs marquées 📋 (et ne les colle jamais dans un chat).

---

## Étape 1 — Supabase (base de données + connexion)

1. Va sur **supabase.com** → **Start your project** → **Continue with GitHub**.
2. **New project** :
   - Name : `dashboard`
   - Database Password : clique sur **Generate a password** et garde-le dans ton gestionnaire de mots de passe.
   - Region : **Central EU (Zurich)** si proposée, sinon **Central EU (Frankfurt)**.
   - **Create new project**, puis attends 1 à 2 minutes.
3. Dans le menu de gauche : **SQL Editor** → **New query**.
   - Ouvre le fichier `supabase/migrations/0001_init.sql` de ce dépôt sur GitHub, copie **tout** le contenu et colle-le.
   - Tout en bas, enlève les `-- ` devant la ligne `insert into private.allowed_emails ...` et remplace l'adresse d'exemple par **ton adresse Gmail en minuscules**.
   - Clique sur **Run**. Tu dois voir « Success. No rows returned ».
4. Récupère les clés : bouton **Connect** en haut de la page (ou **Project Settings → API Keys**).
   - 📋 **Project URL** (du type `https://abcdefgh.supabase.co`)
   - 📋 **Publishable key** (commence par `sb_publishable_…`)
   - ⚠️ Ne copie **pas** la clé `secret` / `service_role` : on n'en a pas besoin pour l'instant.

## Étape 2 — Vercel (mise en ligne)

1. Va sur **vercel.com** → **Sign Up** → offre **Hobby** → **Continue with GitHub**.
2. **Add New… → Project** → choisis le dépôt **jarvis-app**.
   (S'il n'apparaît pas : **Adjust GitHub App Permissions** et autorise ce dépôt.)
3. Framework Preset : **Next.js** (détecté automatiquement). Ne touche pas aux réglages de build.
4. Ouvre **Environment Variables** et ajoute ces 3 variables :

   | Nom | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | ta Project URL 📋 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ta Publishable key 📋 |
   | `ALLOWED_EMAIL` | ton adresse Gmail, en minuscules |

5. **Deploy**. À la fin, note 📋 l'adresse du site (du type `https://dashboard-xxxx.vercel.app`).
   En ouvrant le site, tu dois arriver sur la page **Connexion** (le bouton Google ne marchera qu'après les étapes 3 et 4).

## Étape 3 — Google Cloud (bouton « Continuer avec Google »)

1. Va sur **console.cloud.google.com** avec ton compte Gmail.
2. En haut à gauche, sélecteur de projet → **New project** → nom `Dashboard` → **Create**, puis sélectionne-le.
3. Menu ☰ → **Google Auth Platform** (ou **APIs & Services → OAuth consent screen**) → **Get started** :
   - App name : `Dashboard`, User support email : ton Gmail → **Next**
   - Audience : **External** → **Next**
   - Contact information : ton Gmail → **Next** → accepte → **Create**.
4. Onglet **Audience** → section **Test users** → **Add users** → ajoute ton Gmail → **Save**.
   (L'app reste en mode « Testing » : seul ton compte peut l'utiliser, c'est voulu.)
5. Onglet **Clients** → **Create client** :
   - Application type : **Web application**, Name : `Dashboard Supabase`
   - **Authorized JavaScript origins** → **Add URI** : l'adresse Vercel 📋 (ex. `https://dashboard-xxxx.vercel.app`)
   - **Authorized redirect URIs** → **Add URI** : `https://TON-ID.supabase.co/auth/v1/callback`
     (ta Project URL Supabase + `/auth/v1/callback`)
   - **Create**. Copie 📋 **Client ID** et 📋 **Client secret** (le secret n'est affiché qu'une fois : télécharge le JSON si besoin).

## Étape 4 — Relier Google à Supabase

1. Supabase → **Authentication** → **Sign In / Providers** → **Google** :
   - **Enable Sign in with Google** : activé
   - Client IDs : ton Client ID 📋
   - Client Secret : ton Client secret 📋
   - **Save**.
2. Supabase → **Authentication** → **URL Configuration** :
   - **Site URL** : l'adresse Vercel 📋
   - **Redirect URLs** → **Add URL** : `https://dashboard-xxxx.vercel.app/auth/callback`
     (et, si tu développes un jour en local : `http://localhost:3000/auth/callback`)
   - **Save**.
3. Supabase → **Authentication** → **Sign In / Providers** → section **User Signups** : laisse « Allow new users to sign up » **activé**
   (sinon ton propre premier compte ne pourrait pas être créé). La liste blanche SQL bloque déjà tous les autres.

## Étape 5 — Test

1. Ouvre l'adresse Vercel → **Continuer avec Google** → choisis ton compte → tu arrives sur le dashboard.
2. Change de thème, réordonne un onglet dans **Réglages**, puis ouvre le site sur ton téléphone : les préférences suivent.
3. Installer sur le téléphone :
   - **iPhone (Safari)** : bouton Partager → **Sur l'écran d'accueil**.
   - **Android (Chrome)** : menu ⋮ → **Installer l'application**.
4. Test de sécurité (optionnel) : dans une fenêtre privée, connecte-toi avec un **autre** compte Google → tu dois voir « Ce compte n'est pas autorisé ».

---

### En cas de problème

| Symptôme | Cause probable |
|---|---|
| « redirect_uri_mismatch » chez Google | L'URI de redirection Google n'est pas exactement `https://TON-ID.supabase.co/auth/v1/callback`. |
| Retour sur Connexion avec « Ce compte n'est pas autorisé » alors que c'est ton compte | `ALLOWED_EMAIL` (Vercel) ou la ligne SQL n'ont pas exactement la même adresse, en minuscules. Après un changement de variable sur Vercel : **Deployments → … → Redeploy**. |
| « Database error saving new user » | Ton adresse n'est pas dans `private.allowed_emails` (étape 1.3). |
| Message « connexion pas encore configurée » | Les variables `NEXT_PUBLIC_SUPABASE_…` manquent sur Vercel, ou le site n'a pas été redéployé après leur ajout. |
