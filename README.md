# Éverlune

Un petit monde 3D cozy et onirique, généré à partir d'une graine, à explorer à pied depuis un navigateur d'iPhone.

## Jouer

- **En ligne** : activer GitHub Pages sur la branche `main` (dossier racine), puis ouvrir l'URL dans Safari et faire *Partager → Sur l'écran d'accueil* pour le plein écran.
- **En local** : `python3 -m http.server` à la racine puis ouvrir `http://localhost:8000`.

## Commandes

| iPhone | Ordinateur |
| --- | --- |
| Pouce gauche : joystick (pousser à fond = courir) | ZQSD / WASD, Maj pour courir |
| Glisser à droite : regarder | Glisser à la souris, flèches |
| 🏠 : construire son refuge | |
| ☾ : heure, vitesse du temps, pixels, horizon, carnet, monde | |

### Manette (AYN Thor, DualSense PS5, Xbox…)

Brancher ou appairer la manette en Bluetooth, puis appuyer sur un bouton pour qu'elle soit détectée.

| Action | PS5 | AYN Thor / Xbox |
| --- | --- | --- |
| Marcher | Stick gauche (ou croix directionnelle) | Stick gauche |
| Courir | Stick à fond, R2 ou L3 | Stick à fond, RT ou L3 |
| Regarder | Stick droit | Stick droit |
| Menu | Options | Start |
| Construire | Carré ou Create | X ou Select |
| Dans un panneau | Croix directionnelle pour choisir, Croix pour valider, Rond pour fermer | idem avec A / B |

### Son

Tout le son est synthétisé en direct (Web Audio API), sans aucun fichier : il fonctionne hors-ligne et réagit au monde.

- **Pas** différents sur l'herbe, le sable, la pierre, la neige, la terre battue et dans l'eau ; la foulée suit la vitesse.
- **Nature** : vent (plus fort en altitude, sifflant sur les cimes), feuillages en forêt, rivières et clapotis, oiseaux le jour (chœur de l'aube), grillons, chouette et grenouilles la nuit, carillons dans les villages, crépitement des feux de camp, scintillements dans la Prairie de Lune.
- **Musique générative** douce (fa majeur le jour, ré mineur la nuit), avec de longs silences entre les morceaux.
- Réglages séparés dans le menu ☾ : musique, sons de la nature, pas et effets.
- Sur iPhone, le son démarre au premier toucher (écran-titre) et joue même en mode silencieux (iOS 17+).

La progression (position, heure, constructions, lieux découverts) est sauvegardée sur l'appareil.

## Structure

Aucune étape de build : modules ES servis tels quels, Three.js r170 copié dans `lib/`.

- `src/world.js` : relief, rivières, biomes, points d'intérêt (déterministe, sans Three.js)
- `src/chunks.js` : chargement progressif des zones, terrain, végétation, herbes en sprites
- `src/props.js` : arbres, rochers, maisons, ruines, cabanes, îles flottantes
- `src/sky.js`, `src/water.js`, `src/particles.js` : ciel, cycle jour/nuit, eau, lucioles
- `src/player.js`, `src/input.js`, `src/gamepad.js` : déplacements, caméra, joystick, manettes
- `src/audio.js` : moteur sonore (ambiance, pas, musique)
- `src/build.js`, `src/ui.js`, `src/save.js` : refuge, interface, sauvegarde
