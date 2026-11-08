# MBTK Design — vidéo de lancement

`mbtk_lancement.html` : la vidéo complète (9:16, 1080×1920, 60 fps, 58 s), en un seul fichier.
Ouvre-la sur ton téléphone, touche « ▶ Lancer », enregistre l'écran. Touche l'écran à la fin pour rejouer.

## Options dans l'adresse
- `?son=sfx` : bruitages seuls, sans la musique (si tu mets ta propre musique dans TikTok)
- `?son=0` : muet
- `?q=0.8` : rendu plus léger si ça saccade (par défaut 1 sur téléphone, 1.5 sur ordinateur)
- `?fit=cover` : remplit tout l'écran (rogne un peu les bords)

Sur iPhone : désactive le mode silencieux, puis Partager → « Sur l'écran d'accueil » et ouvre depuis l'icône pour un vrai plein écran.

## Modifier
Ton site et ton pseudo : ligne `const CFG` au début du script de `tools/src_v1.html`, puis reconstruire.

```
cd mbtk/tools
python3 soundtrack.py /chemin/audio      # musique + bruitages (mix.mp3, sfx.mp3)
python3 assemble.py                      # src_v1.html + part_*.js -> src.html
python3 build.py /chemin/audio           # -> ../mbtk_lancement.html
```
