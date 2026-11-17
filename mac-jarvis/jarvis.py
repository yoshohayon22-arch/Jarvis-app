#!/usr/bin/env python3
"""Jarvis pour macOS : assistant vocal en français qui pilote le Mac.

Oreilles : Vosk (reconnaissance vocale hors ligne, modèle français).
Cerveau  : Claude (API Anthropic) avec des outils qui agissent sur le Mac.
Voix     : la commande `say` intégrée à macOS.

Prévu pour fonctionner jusque sur macOS Catalina (10.15), Mac Intel compris.
"""

from __future__ import annotations

import datetime
import difflib
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import unicodedata
from pathlib import Path
from typing import Callable

HOME_DIR = Path(os.environ.get("MAC_JARVIS_HOME", Path.home() / ".mac-jarvis"))
CONFIG_PATH = HOME_DIR / "config.json"
API_KEY_PATH = HOME_DIR / "api_key"

DEFAULT_CONFIG = {
    # Mots qui réveillent Jarvis. La reconnaissance hors ligne comprend
    # parfois mal « Jarvis » : « ordinateur » sert de mot de secours fiable.
    "wake_words": ["jarvis", "ordinateur"],
    "voice": "Thomas",
    "model": "claude-opus-5-5",
    "effort": "low",
    "vosk_model_path": str(HOME_DIR / "vosk-model-small-fr-0.22"),
    # Après une réponse, on peut enchaîner sans redire « Jarvis » pendant ce délai.
    "follow_up_seconds": 8,
    # Au-delà de ce silence, Jarvis repart sur une conversation neuve.
    "conversation_timeout_seconds": 300,
}

STOP_PHRASES = {"au revoir", "arrete toi", "eteins toi", "bonne nuit", "stop jarvis"}
RESET_PHRASES = {"nouvelle conversation", "oublie tout", "on recommence"}
YES_WORDS = {"oui", "ouais", "vas y", "confirme", "je confirme", "d accord", "ok", "okay", "go", "fais le"}

WAKE_VARIANTS = {
    "jarvis": {
        "jarvis", "jarvi", "jarvy", "jervis", "jarviss", "jarvisse", "jarvice",
        "charvis", "javis", "jardis", "garvis", "harvis", "jarre vis", "jar vis",
    },
}


# --------------------------------------------------------------------------
# Utilitaires texte
# --------------------------------------------------------------------------

def normalize(text: str) -> str:
    """Minuscules, sans accents ni ponctuation, espaces simples."""
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def detect_wake(text: str, wake_words: list[str]) -> tuple[bool, str]:
    """Cherche un mot de réveil dans la phrase entendue.

    Renvoie (trouvé, reste de la phrase après le mot de réveil). Tolère les
    erreurs de transcription : variantes connues, deux mots collés
    (« jar vis »), et ressemblance approximative.
    """
    tokens = list(re.finditer(r"\w+", text))
    words = [normalize(t.group()) for t in tokens]

    def after(index: int) -> str:
        """Texte d'origine (accents compris) après le mot n° index."""
        return text[tokens[index].end():].strip(" ,.;:!?-") if index < len(tokens) else ""

    def similar(a: str, b: str, threshold: float) -> bool:
        return len(a) >= 4 and difflib.SequenceMatcher(None, a, b).ratio() >= threshold

    for i in range(len(words)):
        for wake in wake_words:
            wake_n = normalize(wake)
            target = wake_n.replace(" ", "")
            variants = WAKE_VARIANTS.get(wake_n, set()) | {wake_n}
            # Un seul mot : variante connue ou ressemblance proche.
            if words[i] in variants or similar(words[i], target, 0.8):
                return True, after(i)
            # Deux mots collés (« jar vis ») : la fusion doit avoir la longueur du mot de réveil.
            if i + 1 < len(words):
                pair = f"{words[i]} {words[i + 1]}"
                joined = pair.replace(" ", "")
                if (pair in variants or joined in variants
                        or (abs(len(joined) - len(target)) <= 1 and similar(joined, target, 0.85))):
                    return True, after(i + 1)
    return False, ""


def is_yes(text: str) -> bool:
    t = normalize(text)
    return any(t == w or t.startswith(w + " ") for w in YES_WORDS)


def clean_for_speech(text: str) -> str:
    """Retire ce qui se lit mal à voix haute (markdown, liens)."""
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"[*_#`>|]+", "", text)
    text = re.sub(r"^\s*[-•]\s*", "", text, flags=re.MULTILINE)
    return " ".join(text.split())


def applescript_string(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


# --------------------------------------------------------------------------
# Configuration et clé API
# --------------------------------------------------------------------------

def load_config() -> dict:
    config = dict(DEFAULT_CONFIG)
    if CONFIG_PATH.exists():
        try:
            config.update(json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"[!] config.json illisible ({exc}) : réglages par défaut utilisés.")
    return config


def load_api_key() -> str | None:
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if key:
        return key
    if API_KEY_PATH.exists():
        key = API_KEY_PATH.read_text(encoding="utf-8").strip()
        return key or None
    return None


# --------------------------------------------------------------------------
# Voix (synthèse vocale)
# --------------------------------------------------------------------------

class Mouth:
    def __init__(self, preferred_voice: str):
        self.voice = self._pick_voice(preferred_voice)

    @staticmethod
    def _pick_voice(preferred: str) -> str | None:
        if not shutil.which("say"):
            return None
        try:
            listing = subprocess.run(["say", "-v", "?"], capture_output=True, text=True, timeout=10).stdout
        except (OSError, subprocess.SubprocessError):
            return None
        names = [line.split()[0] for line in listing.splitlines() if line.strip()]
        french = [line.split()[0] for line in listing.splitlines() if "fr_" in line]
        if preferred in names:
            return preferred
        return french[0] if french else None

    def say(self, text: str) -> None:
        text = clean_for_speech(text)
        if not text:
            return
        print(f"\n🤖 Jarvis : {text}\n")
        if not shutil.which("say"):
            return
        cmd = ["say"] + (["-v", self.voice] if self.voice else []) + [text]
        try:
            subprocess.run(cmd, timeout=120)
        except (OSError, subprocess.SubprocessError):
            pass


# --------------------------------------------------------------------------
# Oreilles (reconnaissance vocale hors ligne)
# --------------------------------------------------------------------------

class Listener:
    """Écoute le micro en continu et produit des phrases transcrites."""

    def __init__(self, model_path: str):
        import sounddevice as sd  # importés ici : le mode clavier marche sans eux
        import vosk

        vosk.SetLogLevel(-1)
        if not Path(model_path).exists():
            raise FileNotFoundError(f"modèle vocal introuvable : {model_path}")
        device = sd.query_devices(kind="input")
        self.samplerate = int(device["default_samplerate"])
        self.model = vosk.Model(model_path)
        self.recognizer = vosk.KaldiRecognizer(self.model, self.samplerate)
        self.audio: queue.Queue[bytes] = queue.Queue()
        self.paused = threading.Event()
        self.stream = sd.RawInputStream(
            samplerate=self.samplerate, blocksize=8000, dtype="int16",
            channels=1, callback=self._on_audio,
        )

    def _on_audio(self, indata, frames, time_info, status) -> None:
        if not self.paused.is_set():
            self.audio.put(bytes(indata))

    def start(self) -> None:
        self.stream.start()

    def pause(self) -> None:
        """Coupe l'écoute (pendant que Jarvis parle ou réfléchit)."""
        self.paused.set()

    def resume(self) -> None:
        while not self.audio.empty():
            try:
                self.audio.get_nowait()
            except queue.Empty:
                break
        self.recognizer.Reset()
        self.paused.clear()

    def run(self, events: queue.Queue) -> None:
        while True:
            data = self.audio.get()
            if self.paused.is_set():
                continue
            if self.recognizer.AcceptWaveform(data):
                text = json.loads(self.recognizer.Result()).get("text", "").strip()
                if text:
                    events.put(("voix", text))


def keyboard_loop(events: queue.Queue) -> None:
    for line in sys.stdin:
        line = line.strip()
        if line:
            events.put(("clavier", line))


# --------------------------------------------------------------------------
# Mains (outils qui agissent sur le Mac)
# --------------------------------------------------------------------------

class ToolError(Exception):
    pass


def run(cmd: list[str], timeout: int = 20) -> str:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        raise ToolError(f"commande indisponible sur ce système : {cmd[0]}")
    except subprocess.TimeoutExpired:
        raise ToolError("l'action a pris trop de temps")
    if result.returncode != 0:
        raise ToolError(result.stderr.strip() or f"échec de {cmd[0]}")
    return result.stdout.strip()


def osa(script: str) -> str:
    return run(["osascript", "-e", script])


def installed_apps() -> list[str]:
    names = set()
    for folder in ("/Applications", "/System/Applications", "/System/Applications/Utilities",
                   "/Applications/Utilities", str(Path.home() / "Applications")):
        p = Path(folder)
        if p.is_dir():
            names.update(x.stem for x in p.glob("*.app"))
    return sorted(names)


class MacTools:
    def __init__(self, confirm: Callable[[str], bool]):
        self.confirm = confirm

    def ouvrir_application(self, nom: str) -> str:
        try:
            run(["open", "-a", nom])
            return f"{nom} est ouvert."
        except ToolError:
            apps = installed_apps()
            close = difflib.get_close_matches(nom, apps, n=5, cutoff=0.4)
            raise ToolError(
                f"application « {nom} » introuvable. Proches : {', '.join(close) or 'aucune'}. "
                f"Installées : {', '.join(apps)}"
            )

    def quitter_application(self, nom: str) -> str:
        osa(f"tell application {applescript_string(nom)} to quit")
        return f"{nom} est fermé."

    def ouvrir_site(self, adresse: str) -> str:
        url = adresse if re.match(r"^[a-z]+://", adresse) else "https://" + adresse
        run(["open", url])
        return f"{url} est ouvert dans le navigateur."

    def regler_volume(self, niveau: int) -> str:
        niveau = max(0, min(100, int(niveau)))
        if niveau == 0:
            osa("set volume with output muted")
            return "Son coupé."
        osa(f"set volume output volume {niveau}")
        osa("set volume without output muted")
        return f"Volume réglé à {niveau} %."

    def controle_musique(self, action: str) -> str:
        commands = {
            "lecture": "play", "pause": "pause", "suivant": "next track",
            "precedent": "previous track", "lecture_pause": "playpause",
        }
        if action not in commands:
            raise ToolError(f"action inconnue : {action}")
        osa(f'tell application "Music" to {commands[action]}')
        if action in ("suivant", "precedent", "lecture", "lecture_pause"):
            try:
                time.sleep(0.5)
                track = osa('tell application "Music" to get (name of current track) & " par " & (artist of current track)')
                return f"OK. Morceau en cours : {track}."
            except ToolError:
                pass
        return "OK."

    def creer_rappel(self, titre: str) -> str:
        osa(f'tell application "Reminders" to make new reminder with properties {{name:{applescript_string(titre)}}}')
        return f"Rappel « {titre} » créé dans l'app Rappels."

    def creer_note(self, titre: str, contenu: str) -> str:
        body = f"<h1>{titre}</h1><p>{contenu}</p>".replace("\n", "<br>")
        osa(f'tell application "Notes" to make new note with properties {{name:{applescript_string(titre)}, body:{applescript_string(body)}}}')
        return f"Note « {titre} » créée dans l'app Notes."

    def capture_ecran(self) -> str:
        stamp = datetime.datetime.now().strftime("%Y-%m-%d à %H.%M.%S")
        path = Path.home() / "Desktop" / f"Capture Jarvis {stamp}.png"
        run(["screencapture", "-x", str(path)])
        return f"Capture enregistrée sur le Bureau : {path.name}."

    def verrouiller_ecran(self) -> str:
        cgsession = "/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession"
        if Path(cgsession).exists():
            run([cgsession, "-suspend"])
        else:
            run(["pmset", "displaysleepnow"])
        return "Écran verrouillé."

    def mettre_en_veille(self) -> str:
        if not self.confirm("Je mets le Mac en veille. Tu confirmes ?"):
            return "Annulé par l'utilisateur."
        run(["pmset", "sleepnow"])
        return "Mise en veille."

    def lire_presse_papier(self) -> str:
        text = run(["pbpaste"])
        return text[:4000] if text else "Le presse-papier est vide."

    def ecrire_presse_papier(self, texte: str) -> str:
        try:
            subprocess.run(["pbcopy"], input=texte, text=True, check=True, timeout=10)
        except (OSError, subprocess.SubprocessError) as exc:
            raise ToolError(f"échec de la copie : {exc}")
        return "Texte copié dans le presse-papier."

    def etat_du_mac(self) -> str:
        parts = []
        for label, fn in (
            ("Volume", lambda: osa("output volume of (get volume settings)") + " %"),
            ("Applications ouvertes", lambda: osa(
                'tell application "System Events" to get name of (every process whose background only is false)')),
            ("Disque", lambda: run(["df", "-h", "/"]).splitlines()[-1]),
        ):
            try:
                parts.append(f"{label} : {fn()}")
            except (ToolError, IndexError) as exc:
                parts.append(f"{label} : indisponible ({exc})")
        return "\n".join(parts)

    def executer_applescript(self, script: str, explication: str) -> str:
        if not self.confirm(f"Action avancée : {explication}. Tu confirmes ?"):
            return "Annulé par l'utilisateur."
        out = osa(script)
        return out or "Script exécuté."


def _tool(name: str, description: str, properties: dict | None = None) -> dict:
    properties = properties or {}
    return {
        "name": name,
        "description": description,
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": properties,
            "required": list(properties),
            "additionalProperties": False,
        },
    }


STR = {"type": "string"}

TOOL_DEFINITIONS = [
    _tool("ouvrir_application", "Ouvre une application du Mac par son nom exact (ex. Safari, Music, Notes, Calendar, Mail, FaceTime, Photos, Firefox). En cas d'échec, le résultat liste les applications installées : réessaie avec le bon nom.",
          {"nom": {**STR, "description": "Nom de l'application tel qu'il apparaît dans le dossier Applications."}}),
    _tool("quitter_application", "Ferme une application ouverte.", {"nom": STR}),
    _tool("ouvrir_site", "Ouvre une adresse web dans le navigateur par défaut. Pour chercher sur Google, utilise https://www.google.com/search?q=...",
          {"adresse": {**STR, "description": "URL complète ou domaine, ex. youtube.com"}}),
    _tool("regler_volume", "Règle le volume du son du Mac. 0 coupe le son.",
          {"niveau": {"type": "integer", "description": "De 0 à 100."}}),
    _tool("controle_musique", "Contrôle la lecture dans l'app Musique.",
          {"action": {"type": "string", "enum": ["lecture", "pause", "suivant", "precedent", "lecture_pause"]}}),
    _tool("creer_rappel", "Ajoute un rappel dans l'app Rappels.", {"titre": STR}),
    _tool("creer_note", "Crée une note dans l'app Notes.", {"titre": STR, "contenu": STR}),
    _tool("capture_ecran", "Fait une capture de l'écran et l'enregistre sur le Bureau."),
    _tool("verrouiller_ecran", "Verrouille l'écran du Mac."),
    _tool("mettre_en_veille", "Met le Mac en veille (demande confirmation à l'utilisateur)."),
    _tool("lire_presse_papier", "Lit le texte actuellement copié dans le presse-papier."),
    _tool("ecrire_presse_papier", "Copie un texte dans le presse-papier.", {"texte": STR}),
    _tool("etat_du_mac", "Donne le volume actuel, les applications ouvertes et l'espace disque."),
    _tool("executer_applescript", "Exécute un AppleScript pour une action qu'aucun autre outil ne couvre (ex. régler la luminosité via System Events, ouvrir un dossier dans le Finder, envoyer une touche). L'utilisateur doit confirmer à voix haute avant l'exécution. Script compatible macOS Catalina.",
          {"script": STR, "explication": {**STR, "description": "Ce que fait le script, en une courte phrase en français, lue à l'utilisateur."}}),
]

WEB_SEARCH_TOOL = {"type": "web_search_20260209", "name": "web_search", "max_uses": 3}

SYSTEM_PROMPT = """Tu es Jarvis, l'assistant vocal personnel de l'utilisateur, installé sur son iMac (macOS Catalina 10.15, Mac Intel).

Tes réponses sont lues à voix haute par la synthèse vocale du Mac. Réponds donc en français, en une à trois phrases courtes et naturelles, sans markdown, sans listes, sans émojis et sans adresses web. Tutoie l'utilisateur.

Les demandes arrivent par reconnaissance vocale hors ligne, qui fait des fautes : des mots peuvent être mal transcrits ou manquer. Devine l'intention la plus probable quand elle est claire ; sinon, demande en une phrase de répéter.

Pour agir sur le Mac, utilise les outils fournis et agis directement quand la demande est claire, sans demander la permission sauf pour les outils qui la demandent eux-mêmes. Pour l'actualité, la météo, le sport, les horaires ou tout fait récent, utilise la recherche web puis résume la réponse en une ou deux phrases.

Ne dis jamais qu'une action a réussi si l'outil a renvoyé une erreur : explique simplement ce qui bloque. Si macOS demande une autorisation (micro, contrôle d'une app), dis à l'utilisateur de cliquer sur OK dans la fenêtre qui s'affiche puis de réessayer."""


# --------------------------------------------------------------------------
# Cerveau (Claude)
# --------------------------------------------------------------------------

class Brain:
    MAX_STEPS = 10

    def __init__(self, client, config: dict, tools: MacTools):
        self.client = client
        self.config = config
        self.tools = tools
        self.messages: list = []
        self.last_activity = 0.0

    def reset(self) -> None:
        self.messages = []

    def _call_tool(self, name: str, args: dict) -> tuple[str, bool]:
        fn = getattr(self.tools, name, None)
        if fn is None or name.startswith("_") or not callable(fn):
            return f"Outil inconnu : {name}", True
        try:
            return str(fn(**args)), False
        except ToolError as exc:
            return f"Erreur : {exc}", True
        except TypeError as exc:
            return f"Paramètres invalides : {exc}", True
        except Exception as exc:  # un outil ne doit jamais faire planter Jarvis
            return f"Erreur inattendue : {exc}", True

    def ask(self, command: str) -> str:
        if time.time() - self.last_activity > self.config["conversation_timeout_seconds"]:
            self.reset()
        self.last_activity = time.time()

        start = len(self.messages)
        now = datetime.datetime.now().strftime("%A %d %B %Y, %H:%M")
        self.messages.append({"role": "user", "content": f"[Date et heure locales : {now}]\n{command}"})

        try:
            for _ in range(self.MAX_STEPS):
                response = self.client.beta.messages.create(
                    model=self.config["model"],
                    max_tokens=16000,
                    system=SYSTEM_PROMPT,
                    tools=TOOL_DEFINITIONS + [WEB_SEARCH_TOOL],
                    messages=self.messages,
                    output_config={"effort": self.config["effort"]},
                    cache_control={"type": "ephemeral"},
                    betas=["server-side-fallback-2026-07-01"],
                    fallbacks="default",
                )

                if response.stop_reason == "refusal":
                    del self.messages[start:]
                    return "Désolé, je ne peux pas t'aider pour ça."

                self.messages.append({"role": "assistant", "content": response.content})

                if response.stop_reason == "pause_turn":
                    continue

                if response.stop_reason == "tool_use":
                    results = []
                    for block in response.content:
                        if block.type != "tool_use":
                            continue
                        print(f"   ⚙️  {block.name} {json.dumps(block.input, ensure_ascii=False)}")
                        output, is_error = self._call_tool(block.name, dict(block.input))
                        print(f"   ↳ {output[:200]}")
                        results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": output,
                            "is_error": is_error,
                        })
                    self.messages.append({"role": "user", "content": results})
                    continue

                # end_turn, max_tokens, stop_sequence : on lit la réponse.
                text = " ".join(b.text for b in response.content if b.type == "text").strip()
                return text or "C'est fait."

            return "Je n'ai pas réussi à terminer cette demande, elle demandait trop d'étapes."
        except Exception as exc:
            del self.messages[start:]
            return explain_api_error(exc)


def explain_api_error(exc: Exception) -> str:
    import anthropic

    if isinstance(exc, anthropic.AuthenticationError):
        return "Ma clé API Anthropic est refusée. Relance l'installation pour en saisir une nouvelle."
    if isinstance(exc, anthropic.PermissionDeniedError):
        return "Ma clé API n'a pas accès à ce modèle. Vérifie ton compte Anthropic."
    if isinstance(exc, anthropic.RateLimitError):
        return "Trop de demandes d'un coup, réessaie dans quelques secondes."
    if isinstance(exc, anthropic.APIConnectionError):
        return "Je n'arrive pas à joindre internet. Vérifie ta connexion."
    if isinstance(exc, anthropic.APIStatusError):
        if exc.status_code == 402 or "credit" in str(exc).lower():
            return "Il n'y a plus de crédit sur ton compte Anthropic."
        return f"Le service Anthropic a renvoyé une erreur {exc.status_code}. Réessaie dans un instant."
    return f"Une erreur inattendue s'est produite : {exc}"


# --------------------------------------------------------------------------
# Boucle principale
# --------------------------------------------------------------------------

def main() -> int:
    config = load_config()
    api_key = load_api_key()
    if not api_key:
        print("Aucune clé API Anthropic trouvée. Relance l'installation pour la saisir.")
        return 1

    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    mouth = Mouth(config["voice"])
    events: queue.Queue = queue.Queue()

    listener: Listener | None = None
    try:
        listener = Listener(config["vosk_model_path"])
    except Exception as exc:
        print(f"[!] Micro ou modèle vocal indisponible ({exc}). Mode clavier uniquement.")

    def confirm(question: str) -> bool:
        mouth.say(question)
        if listener:
            listener.resume()
        try:
            source, answer = events.get(timeout=10)
            print(f"🗣️  ({source}) {answer}")
            return is_yes(answer)
        except queue.Empty:
            return False
        finally:
            if listener:
                listener.pause()

    brain = Brain(client, config, MacTools(confirm))

    threading.Thread(target=keyboard_loop, args=(events,), daemon=True).start()
    if listener:
        listener.start()
        threading.Thread(target=listener.run, args=(events,), daemon=True).start()

    wake = " ou ".join(f"« {w.capitalize()} »" for w in config["wake_words"])
    print("=" * 60)
    print(" JARVIS — assistant vocal")
    print(f" Dis {wake} puis ta demande. Tu peux aussi l'écrire ici + Entrée.")
    print(" Pour arrêter : dis « Jarvis, au revoir » ou appuie sur Ctrl + C.")
    print("=" * 60)
    if listener:
        listener.pause()
    mouth.say(f"Bonjour, je suis Jarvis. Dis {config['wake_words'][0]}, suivi de ta demande.")
    if listener:
        listener.resume()

    follow_up_until = 0.0
    while True:
        source, heard = events.get()
        if source == "voix":
            print(f"👂 {heard}")
            if time.time() < follow_up_until:
                command = heard
            else:
                found, rest = detect_wake(heard, config["wake_words"])
                if not found:
                    continue
                if not rest:
                    if listener:
                        listener.pause()
                    mouth.say("Oui ?")
                    if listener:
                        listener.resume()
                    follow_up_until = time.time() + config["follow_up_seconds"]
                    continue
                command = rest
        else:
            command = heard
            print(f"⌨️  {command}")

        follow_up_until = 0.0
        normalized = normalize(command)
        if normalized in STOP_PHRASES:
            mouth.say("À bientôt !")
            return 0

        if listener:
            listener.pause()
        if normalized in RESET_PHRASES:
            brain.reset()
            mouth.say("D'accord, on repart de zéro.")
        else:
            print("   … je réfléchis")
            mouth.say(brain.ask(command))
        if listener:
            listener.resume()
        follow_up_until = time.time() + config["follow_up_seconds"]


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nÀ bientôt !")
