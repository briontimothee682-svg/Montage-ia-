# Montage-ia-

## NOCTA — pub 45 s (boîte de nuit, Annecy)

- Guide complet et prompts plan par plan : [`nocta/PROMPTS_NOCTA.md`](nocta/PROMPTS_NOCTA.md)
- Maquette du film (timing, son, notification, flyer) : `exports/nocta/NOCTA_animatic.mp4`
- Flyer final animé : `exports/nocta/nocta_flyer.mp4` · bande-son originale : `exports/nocta/nocta_bande_son.wav`
- Montage automatique des clips IA : `python3 tools/nocta/assemble.py` (réglages dans `nocta/montage.json`)

### Version animation 3D (fabriquée entièrement ici)

- Film final : `exports/nocta/NOCTA_animation_3D.mp4` (45 s, 1080×1920, 24 i/s, avec la bande-son)
- Personnages, décors, Golf, club : code three.js dans `tools/nocta3d/` (rendu sans GPU via Chromium)
- Re-rendre : `cd tools/nocta3d && npm install`, puis `python3 tools/nocta3d/render_film.py render 01 02 03a 03b 04 05 06 07 08`,
  `python3 tools/nocta3d/render_film.py encode`, et
  `python3 tools/nocta/assemble.py --config nocta/montage_animation.json --clips nocta/clips_anim --sortie exports/nocta/NOCTA_animation_3D.mp4`
