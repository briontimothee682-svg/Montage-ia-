# Reel L'Apéretik (lancement Annecy)

Pub Instagram verticale de 56 s (1080×1920, 24 i/s), entièrement générée par le code de ce dossier :
scène 3D Three.js rendue image par image, titres et étalonnage en Python, musique et bruitages synthétisés
(aucun problème de droits).

## Plans

| Temps | Plan |
|---|---|
| 0–4 s | Présentation : la box fermée dans une salle à manger chaleureuse (plantes, eucalyptus, olivier), logo noir entier, « Nouveau à Annecy », adresse, horaires, @laperetik |
| 4–10 s | Slogan, orbite, le couvercle s'ouvre sur le drop (6 s), vue de dessus de la box pleine |
| 10–15 s | Explosion au ralenti, étiquettes 3D « Fromages », « Saucisson sec », « Jambon cru » |
| 15–20 s | Zooms secs sur le temps (fromages, saucisson, jambon), retour dans la boîte, le couvercle se referme |
| 20–25,4 s | Le Mac : défilement des Reels à deux doigts, la box sort de l'écran, tourne en rond, puis zoom en spirale qui aspire dans l'écran |
| 25,4–34 s | À l'intérieur : le Reel défile, double-tap like, visite du profil @laperetik, abonnement, défilement de la grille, ouverture d'une publication qui devient l'affiche |
| 34–42 s | Affiche des prix dans un décor avec olivier et eucalyptus |
| 42–48 s | Boutique (plantes suspendues), puis trinquage |
| 48–56 s | Carte de visite qui tombe et se retourne, le QR code sort de la carte en 3D, carton de fin |

La box ne contient que du fromage, du saucisson et du jambon. Pas de flash ni de bloom ; bois et logo mats.

## Changer les prix, le numéro ou les horaires

1. Modifier `tools/laperetik/brand.json` (`prices`, `street_number`, `hours`).
2. `python3 tools/laperetik/print.py` (affiche, carte de visite).
3. Supprimer puis re-rendre les images de l'affiche et de la carte :
   `tools/laperetik/render_ranges.sh exports/laperetik_work/f3d 816:1008 1152:1296`
4. `FORCE=1 python3 tools/laperetik/composite.py video`

## Chaîne complète

```
python3 tools/laperetik/logo_mask.py assets/laperetik/logo_laperetik.png   # masque HD du logo (sans le redessiner)
python3 tools/laperetik/textures.py                  # textures procédurales
python3 tools/laperetik/print.py                     # affiche, carte, étiquettes
(cd tools/render3d && npm install)                   # three.js
tools/laperetik/render_ranges.sh exports/laperetik_work/f3d 0:1296
python3 tools/laperetik/music.py exports/laperetik_work/music.wav
python3 tools/laperetik/composite.py video           # exports/laperetik_reel.mp4 (+ _sans_son)
```
