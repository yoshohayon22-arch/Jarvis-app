#!/bin/sh
# Assemble le fichier unique legacy.html à partir des sources.
cd "$(dirname "$0")" && cat src/01-head.html src/02-art.js src/03-napoleon.js src/03b-napoleon-systems.js src/03c-napoleon-windows.js src/03d-ronaldo.js src/03e-trump.js src/03f-mrbeast.js src/03g-harry.js src/03h-rdv.js src/04-engine.js src/04b-agenda.js src/05-ai.js src/06-battle.js src/06b-match.js src/07-audio.js src/08-ui.js > legacy.html
