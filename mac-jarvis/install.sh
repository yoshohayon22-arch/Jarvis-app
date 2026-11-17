#!/usr/bin/env bash
# Installe Jarvis (assistant vocal piloté par Claude) sur macOS.
#
#   curl -fsSL https://raw.githubusercontent.com/yoshohayon22-arch/Jarvis-app/refs/heads/claude/happy-fermat-vkaitw/mac-jarvis/install.sh | bash
#
# Tout s'installe dans ~/.mac-jarvis (aucun droit administrateur requis).
# Relancer la commande met Jarvis à jour sans perdre la clé API.

set -euo pipefail

JARVIS_SRC_URL="${JARVIS_SRC_URL:-https://raw.githubusercontent.com/yoshohayon22-arch/Jarvis-app/refs/heads/claude/happy-fermat-vkaitw/mac-jarvis}"
JARVIS_HOME="${MAC_JARVIS_HOME:-$HOME/.mac-jarvis}"
VOSK_MODEL="vosk-model-small-fr-0.22"
VOSK_URL="https://alphacephei.com/vosk/models/${VOSK_MODEL}.zip"
PYTHON_VERSION="3.12"

say_step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m[ERREUR]\033[0m %s\n' "$1" >&2; exit 1; }

if [[ "$(uname -s)" != "Darwin" ]]; then
    fail "Ce Jarvis est fait pour macOS."
fi
if [[ "$(id -u)" -eq 0 ]]; then
    fail "Lance la commande sans 'sudo'."
fi

echo "Installation de Jarvis dans $JARVIS_HOME"
mkdir -p "$JARVIS_HOME" "$HOME/.local/bin"

# ---- 1. uv (gestionnaire Python) ----
say_step "1/6 Outil Python (uv)"
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
if ! command -v uv >/dev/null 2>&1; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi
command -v uv >/dev/null 2>&1 || fail "uv n'a pas pu être installé."
echo "uv : $(uv --version)"

# ---- 2. Code de Jarvis ----
say_step "2/6 Téléchargement de Jarvis"
curl -fsSL "$JARVIS_SRC_URL/jarvis.py" -o "$JARVIS_HOME/jarvis.py.new" \
    || fail "Téléchargement de jarvis.py impossible. Vérifie ta connexion internet."
mv "$JARVIS_HOME/jarvis.py.new" "$JARVIS_HOME/jarvis.py"
echo "OK"

# ---- 3. Python + bibliothèques ----
say_step "3/6 Python $PYTHON_VERSION et bibliothèques (1 à 3 minutes)"
if [[ ! -x "$JARVIS_HOME/.venv/bin/python" ]]; then
    uv venv --python "$PYTHON_VERSION" "$JARVIS_HOME/.venv" \
        || { uv python install "$PYTHON_VERSION" && uv venv --python "$PYTHON_VERSION" "$JARVIS_HOME/.venv"; } \
        || fail "Impossible de créer l'environnement Python."
fi
# vosk 0.3.44 : dernière version publiée avec un paquet pour macOS.
uv pip install --python "$JARVIS_HOME/.venv/bin/python" --upgrade \
    "anthropic>=2.10" "vosk==0.3.44" "sounddevice>=0.5" \
    || fail "Installation des bibliothèques Python impossible."
echo "OK"

# ---- 4. Modèle de reconnaissance vocale française (hors ligne) ----
say_step "4/6 Modèle vocal français (environ 40 Mo)"
if [[ -d "$JARVIS_HOME/$VOSK_MODEL" ]]; then
    echo "Déjà présent."
else
    curl -fL --progress-bar "$VOSK_URL" -o "$JARVIS_HOME/model.zip" \
        || fail "Téléchargement du modèle vocal impossible."
    unzip -q -o "$JARVIS_HOME/model.zip" -d "$JARVIS_HOME" || fail "Décompression du modèle impossible."
    rm -f "$JARVIS_HOME/model.zip"
    echo "OK"
fi

# ---- 5. Clé API Anthropic ----
say_step "5/6 Clé API Anthropic"
if [[ -s "$JARVIS_HOME/api_key" && "${JARVIS_NEW_KEY:-0}" != "1" ]]; then
    echo "Clé déjà enregistrée. (Pour la changer : relance avec JARVIS_NEW_KEY=1 devant la commande.)"
else
    if ! { exec 3<> /dev/tty; } 2>/dev/null; then
        fail "Pas de terminal interactif pour saisir la clé. Lance la commande depuis l'app Terminal."
    fi
    cat >&3 <<'EOF'
Jarvis a besoin d'une clé API Anthropic pour réfléchir (service payant à l'usage).
Crée-la sur https://console.anthropic.com -> API Keys -> Create Key.
Elle commence par sk-ant- . Colle-la ici (rien ne s'affiche, c'est normal) puis Entrée :
EOF
    IFS= read -r -s key <&3 || true
    exec 3>&-
    key="$(printf '%s' "$key" | tr -d '[:space:]')"
    [[ "$key" == sk-ant-* ]] || fail "Ce n'est pas une clé valide (elle doit commencer par sk-ant-). Relance la commande."
    umask 077
    printf '%s\n' "$key" > "$JARVIS_HOME/api_key"
    chmod 600 "$JARVIS_HOME/api_key"
    echo "Clé enregistrée (lisible uniquement par ton compte)."
fi

# ---- 6. Raccourcis de lancement ----
say_step "6/6 Raccourcis"
cat > "$HOME/.local/bin/jarvis" <<EOF
#!/usr/bin/env bash
exec "$JARVIS_HOME/.venv/bin/python" "$JARVIS_HOME/jarvis.py" "\$@"
EOF
chmod +x "$HOME/.local/bin/jarvis"

DESKTOP_LAUNCHER="$HOME/Desktop/Jarvis.command"
cat > "$DESKTOP_LAUNCHER" <<EOF
#!/usr/bin/env bash
clear
exec "$JARVIS_HOME/.venv/bin/python" "$JARVIS_HOME/jarvis.py"
EOF
chmod +x "$DESKTOP_LAUNCHER"

for rc in "$HOME/.zshrc" "$HOME/.bash_profile"; do
    if [[ -f "$rc" || "$rc" == "$HOME/.zshrc" ]] && ! grep -q 'mac-jarvis' "$rc" 2>/dev/null; then
        printf '\n# mac-jarvis\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$rc"
    fi
done

# Vérification rapide : les bibliothèques se chargent-elles ?
"$JARVIS_HOME/.venv/bin/python" -c "import anthropic, vosk, sounddevice" \
    || fail "Les bibliothèques sont installées mais ne se chargent pas."

cat <<EOF

✅ Jarvis est installé !

Pour le lancer : double-clique sur « Jarvis.command » sur ton Bureau.
(La première fois, macOS demande l'accès au micro : clique sur OK.)

Dis « Jarvis » puis ta demande, par exemple :
  « Jarvis, ouvre Safari »
  « Jarvis, mets le volume à 30 »
  « Jarvis, quel temps fait-il à Genève ? »
EOF
