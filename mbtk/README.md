# MBTK Design — vidéo de lancement

- `mbtk_lancement.mp4` : la vidéo prête à publier (1080×1920, 30 i/s, 72 s, avec musique et bruitages).
- `mbtk_lancement_sans_musique.mp4` : la même avec les bruitages seuls (pour mettre une musique TikTok).
- `mbtk_lancement.html` : la version animée en direct (Three.js), à ouvrir dans Safari ou Chrome.

## Ouvrir la version HTML sur téléphone
Le fichier .html ne fonctionne pas s'il est ouvert depuis l'app Fichiers ou un aperçu (le code n'y est pas exécuté) :
il faut l'ouvrir dans le navigateur, via le lien de l'artefact claude.ai, ou en hébergeant le fichier.
Touche « ▶ Lancer », enregistre l'écran, touche l'écran à la fin pour rejouer.
En cas de souci, un message d'erreur s'affiche sous le bouton.

Options dans l'adresse :
- `?son=sfx` : bruitages seuls · `?son=0` : muet
- `?q=0.8` : rendu plus léger si ça saccade (par défaut 1 sur téléphone, 1.5 sur ordinateur)
- `?fit=cover` : remplit tout l'écran (rogne un peu les bords)

## Modifier
Ton site et ton pseudo : ligne `const CFG` au début du script de `tools/src_v1.html`, puis reconstruire.
Temps de lecture : `tools/warp.json` liste les passages ralentis (début, fin, facteur) ; la vidéo et la bande-son s'y calent toutes les deux.

```
cd mbtk/tools
python3 soundtrack.py /chemin/audio      # musique + bruitages (mix.mp3, sfx.mp3)
python3 assemble.py                      # src_v1.html + part_*.js -> src.html
python3 build.py /chemin/audio           # -> ../mbtk_lancement.html
```
