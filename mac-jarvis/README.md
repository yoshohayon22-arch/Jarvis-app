# Jarvis pour Mac

Assistant vocal en français qui contrôle ton Mac. Tu dis « Jarvis » puis ta demande, il agit et te répond à voix haute.

Fonctionne sur macOS Catalina (10.15) et plus récent, Mac Intel ou Apple Silicon.

## Comment ça marche

| Partie | Outil | Où ça tourne |
|---|---|---|
| Oreilles | Vosk, modèle français | Sur ton Mac, hors ligne |
| Cerveau | Claude Opus 5.5, via l'API Anthropic | Sur internet (payant à l'usage) |
| Voix | La commande `say` de macOS | Sur ton Mac |

## Installation

1. Crée une clé API sur https://console.anthropic.com (API Keys → Create Key). Il faut ajouter un peu de crédit sur le compte.
2. Ouvre l'app **Terminal** et colle cette ligne :

   ```
   curl -fsSL https://raw.githubusercontent.com/yoshohayon22-arch/Jarvis-app/refs/heads/claude/happy-fermat-vkaitw/mac-jarvis/install.sh | bash
   ```

3. Quand on te la demande, colle ta clé API puis appuie sur Entrée.
4. Double-clique sur **Jarvis.command** sur ton Bureau. La première fois, autorise l'accès au micro.

## Exemples de demandes

- « Jarvis, ouvre Safari » / « Jarvis, ferme Mail »
- « Jarvis, mets le volume à 30 » / « Jarvis, coupe le son »
- « Jarvis, mets la musique » / « Jarvis, morceau suivant »
- « Jarvis, quel temps fait-il à Genève ? » (recherche web)
- « Jarvis, crée un rappel : appeler le médecin »
- « Jarvis, prends une note : idées pour le week-end… »
- « Jarvis, fais une capture d'écran » / « Jarvis, verrouille l'écran »
- « Jarvis, nouvelle conversation » : repartir de zéro
- « Jarvis, au revoir » : arrêter Jarvis

Tu peux aussi écrire une demande dans la fenêtre du Terminal puis appuyer sur Entrée.

Si Jarvis ne réagit pas à « Jarvis » (la reconnaissance hors ligne comprend parfois mal ce nom), dis plutôt « Ordinateur ».

## Sécurité

- La clé API est stockée dans `~/.mac-jarvis/api_key`, lisible seulement par ton compte.
- La mise en veille et les actions avancées (AppleScript) demandent ta confirmation à voix haute (« oui ») avant de s'exécuter.
- Le son du micro reste sur ton Mac : seul le texte transcrit est envoyé à Claude.

## Réglages

`~/.mac-jarvis/config.json` (facultatif) peut remplacer : `wake_words`, `voice`, `model`, `effort`, `follow_up_seconds`, `conversation_timeout_seconds`.

## Désinstaller

```
rm -rf ~/.mac-jarvis ~/.local/bin/jarvis ~/Desktop/Jarvis.command
```
