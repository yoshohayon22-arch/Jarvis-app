# Jarvis pour Mac

Assistant vocal en français qui contrôle ton Mac. Tu dis « Jarvis » puis ta demande, il agit et te répond à voix haute.

Fonctionne sur macOS Catalina (10.15) et plus récent, Mac Intel ou Apple Silicon.

## Deux modes

| | Mode gratuit (par défaut) | Mode intelligent (option) |
|---|---|---|
| Coût | Gratuit | Payant à l'usage (clé API Anthropic) |
| Internet | Pas nécessaire | Nécessaire |
| Comprend | Une liste de commandes (voir plus bas) | Presque toutes les demandes, questions libres, recherche web |

Dans les deux modes, la reconnaissance vocale (Vosk, modèle français) et la voix (`say` de macOS) tournent sur ton Mac, hors ligne.

## Installation

1. Ouvre l'app **Terminal** et colle cette ligne :

   ```
   curl -fsSL https://raw.githubusercontent.com/yoshohayon22-arch/Jarvis-app/refs/heads/claude/happy-fermat-vkaitw/mac-jarvis/install.sh | bash
   ```

2. Double-clique sur **Jarvis.command** sur ton Bureau. La première fois, autorise l'accès au micro.

## Ce que sait faire le mode gratuit

- **Applications** : « Jarvis, ouvre Safari », « ouvre le calendrier », « lance WhatsApp », « ferme Mail ». Jarvis trouve toutes les apps installées sur ton Mac.
- **Sites** : « Jarvis, ouvre YouTube », « va sur Netflix »
- **Recherche Google** : « Jarvis, cherche recette de lasagnes »
- **Volume** : « mets le volume à 30 », « monte le son », « baisse le son », « coupe le son », « volume à fond »
- **Musique** (app Musique) : « mets de la musique », « pause », « chanson suivante », « chanson précédente », « c'est quoi cette chanson ? »
- **Heure et date** : « quelle heure est-il ? », « on est quel jour ? »
- **Mac** : « fais une capture d'écran », « verrouille l'écran », « mets en veille » (avec confirmation)
- **Aide** : « Jarvis, aide »
- **Arrêter** : « Jarvis, au revoir »

Tu peux aussi écrire une demande dans la fenêtre du Terminal puis appuyer sur Entrée.

Si Jarvis ne réagit pas à « Jarvis » (la reconnaissance hors ligne comprend parfois mal ce nom), dis plutôt « Ordinateur ».

## Surnoms d'applications

Si Jarvis comprend mal le nom d'une app, crée le fichier `~/.mac-jarvis/config.json` avec des surnoms :

```json
{
  "app_aliases": {
    "ma musique": "Spotify",
    "le chat": "WhatsApp"
  }
}
```

## Passer au mode intelligent (facultatif)

Crée une clé API sur https://console.anthropic.com (avec un peu de crédit), puis relance l'installation ainsi :

```
curl -fsSL https://raw.githubusercontent.com/yoshohayon22-arch/Jarvis-app/refs/heads/claude/happy-fermat-vkaitw/mac-jarvis/install.sh | JARVIS_CLAUDE=1 bash
```

Pour revenir au mode gratuit : `rm ~/.mac-jarvis/api_key`.

## Réglages

`~/.mac-jarvis/config.json` (facultatif) peut aussi changer : `wake_words`, `voice`, `follow_up_seconds`, et pour le mode intelligent `model`, `effort`, `conversation_timeout_seconds`.

## Désinstaller

```
rm -rf ~/.mac-jarvis ~/.local/bin/jarvis ~/Desktop/Jarvis.command
```
