# Crédits — Dernier Signal

## Moteur et bibliothèques
| Élément | Licence | Source |
|---|---|---|
| three.js r187 | MIT | https://threejs.org |
| postprocessing (pmndrs) | Zlib | https://github.com/pmndrs/postprocessing |
| N8AO (occlusion ambiante) | CC0 | https://github.com/N8python/n8ao |
| Vite, TypeScript | MIT / Apache-2.0 | https://vitejs.dev |
| Polices Barlow / Barlow Condensed | SIL OFL 1.1 | https://fonts.google.com/specimen/Barlow |

## Textures et HDRI — Poly Haven (CC0, domaine public)
Téléchargées via l'API publique (`scripts/fetch-polyhaven.mjs`), recompressées.

| Élément | Auteur·rice | Lien |
|---|---|---|
| Rusty Painted Metal | Poly Haven | https://polyhaven.com/a/rusty_painted_metal |
| Metal Plate | Poly Haven | https://polyhaven.com/a/metal_plate |
| Smooth Concrete Floor | Poly Haven | https://polyhaven.com/a/smooth_concrete_floor |
| Rust Coarse 01 | Poly Haven | https://polyhaven.com/a/rust_coarse_01 |
| Blue Metal Plate | Poly Haven | https://polyhaven.com/a/blue_metal_plate |
| Painted Metal Shutter | Poly Haven | https://polyhaven.com/a/painted_metal_shutter |
| Container Side | Poly Haven | https://polyhaven.com/a/container_side |
| Metal Grate Rusty | Poly Haven | https://polyhaven.com/a/metal_grate_rusty |
| Corrugated Iron 02 | Poly Haven | https://polyhaven.com/a/corrugated_iron_02 |
| Concrete Floor Worn 001 | Poly Haven | https://polyhaven.com/a/concrete_floor_worn_001 |
| HDRI Studio Small 09 | Poly Haven | https://polyhaven.com/a/studio_small_09 |

## Son
- **Musique** : composée en direct par le jeu (Web Audio API, `src/audio/music.ts`) — accords, mélodie et cloches générés à chaque partie, différents selon le lieu et l'heure. Aucun fichier externe.
- **Bruitages et ambiances enregistrés** (`public/assets/audio/`) : générés pour ce projet avec ElevenLabs Sound Effects (compte du propriétaire du projet), puis normalisés et découpés : pas sur herbe, terre, métal et grille ; vent de la plaine, nuit, forêt, rivière, épave fumante, cabine de la capsule, station ; atterrissage, saut, porte, étincelles, vapeur, jetpack, démarrage de générateur, hologramme.
- **Sons d'interface** : « Interface Sounds » de Kenney (CC0, domaine public) — https://kenney.nl/assets/interface-sounds
- Les bips de R-12, le scanner, l'arc électrique et l'alarme restent synthétisés en direct.
Voix des journaux : synthèse vocale du navigateur (speechSynthesis), en attendant de vrais enregistrements.

## Modèles
Robots, socles, station (murs, portes, consoles, mobilier), hologrammes, planète et Asterion : modélisés de façon procédurale dans le code (aucun modèle externe pour l'instant).
