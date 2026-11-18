#!/bin/sh
# Assemble le fichier unique legacy.html à partir des sources.
cd "$(dirname "$0")" && cat src/01-head.html src/02-art.js src/03-napoleon.js src/03b-napoleon-systems.js src/04-engine.js src/05-ai.js src/06-battle.js src/07-audio.js src/08-ui.js > legacy.html
