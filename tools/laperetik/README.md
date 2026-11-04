# Reel L'Apéretik (lancement Annecy)

Pub Instagram verticale de 56 s (1080×1920, 24 i/s), entièrement générée par le code de ce dossier :
scène 3D Three.js rendue image par image, titres et étalonnage en Python, musique et bruitages synthétisés
(aucun problème de droits).

## Plans

| Temps | Plan |
|---|---|
| 0–4 s | Logo gravé au fer sur le couvercle en bouleau (braise, fumée, étincelles, reflet doré), recul rapide |
| 4–10 s | La Box Apéro sur table en chêne et nappe en lin, orbite, le couvercle s'ouvre sur le drop (6 s), vue de dessus |
| 10–15 s | Explosion au ralenti des produits en couches au-dessus de la boîte |
| 15–20 s | Macros (comté, saucisson poivré, pain grillé, tomme), retour dans la boîte, clap du couvercle |
| 20–27 s | Laptop, main sur le trackpad, profil @laperetik, reel 3D façon site produit, like |
| 27–34 s | Clic sur « Suivre », l'écran s'ouvre comme une fenêtre, les produits sortent et tournent autour |
| 34–42 s | Affiche des prix (kraft, liseré doré), bière, vin et terrine en lévitation |
| 42–48 s | Boutique (étagères, suspensions, ardoise « Bienvenue ! »), puis trinquage bières et vins |
| 48–56 s | Carte de visite qui tombe, se retourne sur le QR code, vue de dessus, logo, carton de fin |

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
