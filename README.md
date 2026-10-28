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
| 👁 : vue 1re / 3e personne | |
| 🏠 : construire son refuge | |
| ☾ : heure, vitesse du temps, pixels, horizon, carnet, monde | |

### Manette (AYN Thor, DualSense PS5, Xbox…)

Brancher ou appairer la manette en Bluetooth, puis appuyer sur un bouton pour qu'elle soit détectée.

| Action | PS5 | AYN Thor / Xbox |
| --- | --- | --- |
| Marcher | Stick gauche (ou croix directionnelle) | Stick gauche |
| Courir | Stick à fond, R2 ou L3 | Stick à fond, RT ou L3 |
| Regarder | Stick droit | Stick droit |
| Vue 1re / 3e personne | Triangle | Y |
| Menu | Options | Start |
| Construire | Carré ou Create | X ou Select |
| Dans un panneau | Croix directionnelle pour choisir, Croix pour valider, Rond pour fermer | idem avec A / B |

La progression (position, heure, constructions, lieux découverts) est sauvegardée sur l'appareil.

## Structure

Aucune étape de build : modules ES servis tels quels, Three.js r170 copié dans `lib/`.

- `src/world.js` : relief, rivières, biomes, points d'intérêt (déterministe, sans Three.js)
- `src/chunks.js` : chargement progressif des zones, terrain, végétation, herbes en sprites
- `src/props.js` : arbres, rochers, maisons, ruines, cabanes, îles flottantes
- `src/sky.js`, `src/water.js`, `src/particles.js` : ciel, cycle jour/nuit, eau, lucioles
- `src/player.js`, `src/input.js` : déplacements, caméra, joystick
- `src/build.js`, `src/ui.js`, `src/save.js` : refuge, interface, sauvegarde
