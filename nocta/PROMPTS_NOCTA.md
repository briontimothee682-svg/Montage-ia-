# NOCTA — pub 45 s, 9:16 : kit de production complet

Le film est découpé en **9 plans IA + 1 flyer**. Tout ce qui peut être fabriqué parfaitement sans IA est **déjà fait** dans ce dépôt ; il reste à générer les images réalistes (personnes, voiture, club) dans un outil vidéo IA, puis à lancer le montage automatique.

| Fichier | Ce que c'est |
|---|---|
| `exports/nocta/NOCTA_animatic.mp4` | Le film complet en maquette : timing exact, bande-son, notification, flyer. Chaque plan IA est un carton à remplacer. |
| `exports/nocta/nocta_flyer.mp4` | **Plan 9 terminé** : flyer animé NOCTA CLUB (néon, lasers, texte net, pulsation sur le coup final). |
| `exports/nocta/nocta_notification.mov` | Carte de notification 3D avec transparence (pour CapCut, Premiere, Resolve…). |
| `exports/nocta/nocta_bande_son.wav` | Bande-son originale 45 s, libre de droits : ambiance, 4 notifications, whoosh, tech house 130 BPM, filtre « sous l'eau », son de club, coup final. -14 LUFS. |
| `nocta/montage.json` + `tools/nocta/assemble.py` | Montage automatique de tes clips IA avec tout le reste. |

> **Pourquoi le texte n'est jamais généré par l'IA :** les modèles vidéo écrivent mal (lettres tordues, fautes). La notification et le flyer sont donc rendus à part, au pixel près, et l'adresse se change en une ligne (`"adresse"` dans `nocta/montage.json`).

---

## 1. Timeline (calée sur la musique, 130 BPM)

| Plan | Début → fin | Durée | À générer | Contenu |
|---|---|---|---|---|
| 01 | 0,00 → 6,00 | 6,00 s | **8 s** | La notification (les 4 écrans s'allument à **2,5 s**) |
| 02 | 6,00 → 11,00 | 5,00 s | **8 s** | Les regards, la caméra monte vers la baie vitrée |
| 03a | 11,00 → 13,34 | 2,34 s | **5 s** (accéléré ×1,5) | FPV : traverse la vitre (**11,5 s = le drop**), plonge sur Annecy |
| 03b | 13,34 → 15,19 | 1,84 s | **5 s** (accéléré ×1,9) | FPV : rattrape la Golf, traverse le pare-brise |
| 04 | 15,19 → 20,72 | 5,53 s | **8 s** | POV conducteur le long du lac |
| 05 | 20,72 → 24,41 | 3,69 s | **5 s** | Sort par la vitre, Golf de profil (musique « sous l'eau ») |
| 06 | 24,41 → 29,02 | 4,61 s | **8 s** | Monte dans le ciel, révèle le club NOCTA |
| 07 | 29,02 → 36,39 | 7,38 s | **8 à 10 s** | FPV jusqu'au DJ (drop à 35,47 s) |
| 08 | 36,39 → 41,00 | 4,61 s | **5 s** | Les 4 amis en VIP, flash blanc |
| 09 | 41,00 → 45,00 | 4,00 s | **déjà fait** | Flyer, coup de basse final à 42,84 s |

Réglages de génération pour tous les plans : **9:16, résolution maximale (1080p), 24 i/s**, qualité maximale, sans musique.

---

## 2. La méthode qui donne le rendu le plus réel et des visages identiques

1. **Fiches personnages d'abord** (section 4) : une image de référence par personnage, dans un générateur d'images photoréaliste. Garde la meilleure, toujours la même.
2. **Images clés ensuite** (section 5) : la première image des plans importants, générée **avec les fiches personnages en référence** (fonction « ingrédients / références / éléments / personnage » selon l'outil). Une image fixe se corrige facilement ; une vidéo, non. Vérifie les mains, les yeux et les visages **avant** d'animer.
3. **Vidéo en mode image → vidéo** (section 6), avec **première image + dernière image** quand l'outil le permet. La dernière image d'un plan devient la première du suivant : c'est ce qui donne un seul plan-séquence sans coupure.
   Pour récupérer la dernière image d'un clip :
   ```
   python3 tools/nocta/assemble.py --extraire-fin nocta/clips/shot_01.mp4
   ```
4. **Génère 3 ou 4 variantes par plan** et garde la meilleure (mains, regards, voiture sans déformation). C'est ce que font les pubs IA qui ont l'air vraies.
5. **Recopie mot pour mot** le bloc personnages (section 3) dans chaque prompt où ils apparaissent : le moindre changement de description change le visage.
6. Une seule action principale par clip, un seul mouvement de caméra nommé. Les modèles se trompent quand on leur demande trois choses en 5 secondes.

---

## 3. Bloc personnages (à copier tel quel)

```
LUCAS: a 24-year-old white French man, short brown textured crop with a low fade, light stubble, hazel eyes, slim athletic build, black cotton overshirt worn open over a plain white crew-neck t-shirt, thin silver chain necklace.
MALIK: a 25-year-old Black French man, short black twists with a tapered fade, neatly trimmed short beard, dark brown eyes, oversized cream chunky-knit sweater, gold chain necklace.
CHLOÉ: a 23-year-old French woman, long straight platinum-blonde hair, light blue eyes, fair skin with light freckles, black satin camisole top, small gold hoop earrings.
INÈS: a 24-year-old mixed-race French woman, light brown skin, voluminous dark brown curly hair, brown eyes, fitted burgundy ribbed top, delicate gold necklace.
```

**Bloc style (à la fin de chaque prompt) :**
```
Shot on ARRI Alexa 35 with anamorphic lenses, 24fps, real live-action footage, natural skin texture with visible pores and fine imperfections, realistic hands with five fingers, realistic eyes and natural blinking, shallow depth of field, subtle film grain, realistic light falloff and reflections, moody night grade with deep blues and violet and magenta neon accents, warm practical lights.
```

**Negative prompt (le même partout) :**
```
cartoon, illustration, anime, 3D render, CGI look, video game look, plastic or waxy skin, airbrushed skin, doll face, deformed hands, extra fingers, missing fingers, fused fingers, distorted face, asymmetric eyes, crossed eyes, morphing, face changing between frames, outfit changing, flickering, jitter, warped car body, melting wheels, wrong car brand, misspelled text, garbled letters, random text, subtitles, watermark, logo other than NOCTA and Volkswagen, oversaturated colors, HDR look, blown highlights, low resolution, blurry subject, compression artifacts, slow motion when not asked, fisheye distortion
```

---

## 4. Fiches personnages (générateur d'images)

Une image par personnage, format 3:4 ou 9:16. Tu peux ajouter « character reference sheet, front view, three-quarter view and profile on the same image » si ton outil le gère bien.

**Lucas**
```
Photorealistic medium portrait photograph of LUCAS: a 24-year-old white French man, short brown textured crop with a low fade, light stubble, hazel eyes, slim athletic build, black cotton overshirt worn open over a plain white crew-neck t-shirt, thin silver chain necklace. Relaxed confident half smile, looking at the camera, waist-up, standing against a plain dark grey backdrop, soft warm key light from the left and a faint violet rim light, 85mm lens at f/2.8. Natural skin texture with visible pores, no retouching, real photograph, shot on ARRI Alexa 35.
```

**Malik**
```
Photorealistic medium portrait photograph of MALIK: a 25-year-old Black French man, short black twists with a tapered fade, neatly trimmed short beard, dark brown eyes, oversized cream chunky-knit sweater, gold chain necklace. Warm easy smile, looking at the camera, waist-up, standing against a plain dark grey backdrop, soft warm key light from the left and a faint violet rim light, 85mm lens at f/2.8. Natural skin texture with visible pores and realistic skin sheen, no retouching, real photograph, shot on ARRI Alexa 35.
```

**Chloé**
```
Photorealistic medium portrait photograph of CHLOÉ: a 23-year-old French woman, long straight platinum-blonde hair, light blue eyes, fair skin with light freckles, black satin camisole top, small gold hoop earrings. Playful smile, looking at the camera, waist-up, standing against a plain dark grey backdrop, soft warm key light from the left and a faint violet rim light, 85mm lens at f/2.8. Natural skin texture with visible pores and fine baby hairs, light natural makeup, no retouching, real photograph, shot on ARRI Alexa 35.
```

**Inès**
```
Photorealistic medium portrait photograph of INÈS: a 24-year-old mixed-race French woman, light brown skin, voluminous dark brown curly hair, brown eyes, fitted burgundy ribbed top, delicate gold necklace. Bright confident smile, looking at the camera, waist-up, standing against a plain dark grey backdrop, soft warm key light from the left and a faint violet rim light, 85mm lens at f/2.8. Natural skin texture with visible pores, defined natural curls with flyaways, no retouching, real photograph, shot on ARRI Alexa 35.
```

**La voiture (référence, sans personne)**
```
Photorealistic photograph of a black Volkswagen Golf 8 GTI (2021 model), glossy deep black paint, thin red line across the front between the slim LED headlights, LED light bar in the grille, honeycomb lower grille with X-shaped fog lights, GTI badges, black 18-inch alloy wheels, red brake calipers, parked on a wet street at night under orange streetlights, three-quarter front view, reflections on the paint, 35mm lens, real automotive photograph.
```

---

## 5. Images clés (générateur d'images, avec les fiches en référence)

**K1 — première image du plan 01 (les 4 amis dans le salon)**
```
Wide shot from a low camera at coffee-table height. A modern apartment living room at night in Annecy, France. A large floor-to-ceiling window behind a dark grey fabric sofa shows the city lights of Annecy and dark mountain silhouettes under a deep blue night sky. MALIK and CHLOÉ sit on the sofa; LUCAS sits in an armchair on the left, INÈS in an armchair on the right; the four form a circle around a low oak coffee table on a thick beige wool rug. On the table: unlabeled bottles of whisky and vodka, brown glass beer bottles, tumblers, a spread-out deck of playing cards. A warm table lamp and a floor lamp, soft shadows. All four look down at their smartphones, faces softly lit by the screens. [bloc personnages] [bloc style]
```

**K4 — première image du plan 04 (POV conducteur)**
```
First-person point of view from the driver's seat of a black Volkswagen Golf 8 GTI at night. Only the driver's two hands are visible, a young man's hands with natural knuckles and short nails, resting on the flat-bottomed black leather steering wheel with red stitching and a chrome VW logo in the center. Red ambient interior lighting along the dashboard and doors, glowing digital cockpit behind the wheel showing a speedometer, central touchscreen glowing softly. Through the windshield: a road along Lake Annecy at night, orange streetlights, city lights reflecting on the calm black water, dark mountain silhouettes. [bloc style]
```

**K5 — dernière image du plan 05 (profil)**
```
Low tracking shot at wheel height of a black Volkswagen Golf 8 GTI driving fast at night, seen in pure side profile, glossy paint reflecting the orange streetlights, black alloy wheels with red brake calipers, wet asphalt with long reflections, strong horizontal motion blur in the background with light streaks, the car body sharp. [bloc style]
```

**K6 — dernière image du plan 06 (le club)**
```
High drone shot tilting down on a large modern nightclub building on the outskirts of Annecy at night. The black facade glows with blue, violet and magenta neon lines and a big glowing neon sign reading exactly "NOCTA" in clean rounded capital letters above the entrance. A long queue of stylish young people in their twenties waits behind velvet ropes, two bouncers dressed in black at the entrance, light haze, colored light spilling onto the wet pavement. A black Volkswagen Golf 8 GTI pulls up in front of the entrance. Mountains faintly visible against the night sky. [bloc style]
```
Astuce : génère K6 dans un outil d'image qui écrit bien (le mot NOCTA doit être parfait), puis anime-le. Si l'enseigne reste fausse, régénère jusqu'à ce que les 5 lettres soient justes.

**K7 — dernière image du plan 07 (le DJ)**
```
Close medium shot in front of the DJ booth of a huge packed nightclub. A DJ in his late twenties, black t-shirt, over-ear headphones, dances behind the mixer with both hands raised toward the ceiling, backlit by blinding white beams, blue and violet lasers cutting through thick haze, LED walls behind, confetti falling, the raised hands of the crowd in the foreground slightly out of focus. [bloc style]
```

**K8 — première image du plan 08 (VIP)**
```
Medium shot in a raised VIP booth to the right of the DJ, overlooking a dancing crowd in a large nightclub. LUCAS, MALIK, CHLOÉ and INÈS, in the same outfits, laugh, dance and sing along with their arms around each other, authentic candid joy. Blue and violet lasers and strobes light their faces, thick haze, the crowd and the DJ booth visible behind them. [bloc personnages] [bloc style]
```

---

## 6. Prompts vidéo plan par plan

Nomme chaque vidéo exactement comme indiqué et dépose-la dans `nocta/clips/`. Ajoute le **bloc style** à la fin et le **negative prompt** quand l'outil a un champ prévu.

### shot_01.mp4 — La notification (8 s) · première image : K1
```
Slow push-in, low camera at coffee-table height, wide shot of a modern apartment living room at night in Annecy. MALIK and CHLOÉ sit on a dark grey sofa, LUCAS in an armchair on the left, INÈS in an armchair on the right, around a low oak coffee table with unlabeled bottles, beer bottles, glasses and spread playing cards. Behind the sofa a floor-to-ceiling window shows the city lights of Annecy and mountain silhouettes under a deep blue night sky. Warm lamp light. All four look down at their smartphones, faces lit by the screens. At 2.5 seconds all four phone screens light up brighter at the exact same moment, a soft white-blue glow blooms on their faces and they blink in surprise. No readable text on the screens, no floating text. [bloc personnages] [bloc style]
```
Son (si l'outil en génère) : `quiet apartment ambience, soft relaxed voices in French, playing cards on a wooden table, no music`.
Montage : si les écrans s'allument à 3,1 s dans le clip au lieu de 2,5 s, mets `"synchro": {"dans_le_clip": 3.1, "sur_la_timeline": 2.5}` pour le plan 01. La carte de notification lisible s'ajoute toute seule.

### shot_02.mp4 — Les regards (8 s) · première image : dernière image de shot_01
```
Same apartment, same four friends, same outfits and lighting. Slow circular camera move around the coffee table at seated eye level. The four friends lower their phones and look at each other one after another: LUCAS looks at MALIK, MALIK looks at CHLOÉ, CHLOÉ looks at INÈS, INÈS looks back at LUCAS. Each breaks into a knowing, excited smile. Natural micro-expressions, realistic eye contact and blinking. At the end the camera rises and turns toward the large window behind the sofa, the city lights of Annecy filling the frame. [bloc personnages] [bloc style]
```
Son : `quiet apartment ambience, a short excited laugh, no music`.

### shot_03a.mp4 — À travers la vitre (5 s) · première image : dernière image de shot_02
```
Continuous FPV drone shot, fast and smooth. The camera flies forward over the coffee table toward the floor-to-ceiling window, passes straight through the glass and dives into the night above the rooftops of Annecy old town: slate and terracotta roofs, a church spire, the canals, Lake Annecy and the dark mountains in the distance under a deep blue sky. Strong motion blur, speed ramp, real drone footage. [bloc style]
```
Montage : le passage de la vitre doit tomber sur le drop (11,5 s). Repère le moment dans le clip (ex. 1,3 s) et mets `"synchro": {"dans_le_clip": 1.3, "sur_la_timeline": 11.5}`.

### shot_03b.mp4 — La Golf (5 s) · première image : dernière image de shot_03a · dernière image : K4
```
Continuous FPV drone shot. The camera swoops down from above the rooftops to a road lit by orange sodium streetlights along Lake Annecy, catches up with a black Volkswagen Golf 8 GTI driving fast, flies low over its roof, drops in front of the windshield and pushes through the glass into the cabin, ending in the driver's point of view looking forward. Strong motion blur, speed ramp, glossy black paint reflecting the streetlights. [bloc style]
```

### shot_04.mp4 — POV conducteur (8 s) · première image : K4
```
First-person driver point of view inside a black Volkswagen Golf 8 GTI at night. Only the driver's hands on the flat-bottomed leather steering wheel with the VW logo, red ambient interior lighting, glowing digital cockpit. Through the windshield: the road along Lake Annecy at night, streetlights streaking past, city lights reflecting on the water, mountains in the distance. Slight engine vibration, natural handheld camera shake, the driver lightly taps the wheel with his right hand to a beat. Fast but controlled driving, the hands stay natural and still otherwise. [bloc style]
```

### shot_05.mp4 — Profil (5 s) · première image : dernière image de shot_04 · dernière image : K5
```
The camera slides sideways through the open front-right passenger window, exits the car and pulls back into a low tracking shot at wheel height: the black Volkswagen Golf 8 GTI driving fast at night in pure side profile, glossy paint reflecting the orange streetlights, spinning black alloy wheels with red brake calipers, wet asphalt reflections, strong background motion blur and light streaks. [bloc style]
```

### shot_06.mp4 — Le club (8 s) · première image : dernière image de shot_05 · dernière image : K6
```
Smooth curved drone move: the camera arcs upward from the speeding black Golf GTI into the night sky, then tilts down to reveal a large nightclub building on the outskirts of Annecy. The black facade glows with blue, violet and magenta neon and a big neon sign reading "NOCTA". A long queue of stylish young people waits behind velvet ropes, two bouncers in black at the entrance, light haze, colored light spilling onto the pavement. The black Golf pulls up in front of the entrance. [bloc style]
```

### shot_07.mp4 — Jusqu'au DJ (8 à 10 s) · première image : dernière image de shot_06 · dernière image : K7
```
Continuous FPV drone shot: the camera flies past the two bouncers, through the open entrance doors and into a huge packed dance floor. Hundreds of young people dance with their hands in the air, blue and violet lasers cut through thick haze, strobe flashes, LED walls. The camera weaves just above the raised hands toward the stage and ends in front of the DJ booth: a DJ with headphones on, both hands raised to the ceiling, dancing behind the mixer, backlit by blinding white beams, confetti falling. [bloc style]
```
Montage : le moment où le DJ lève les mains doit tomber sur le drop à 35,47 s (`"synchro"` comme plus haut).

### shot_08.mp4 — VIP (5 s) · première image : K8
```
Handheld camera slowly orbiting a raised VIP booth to the right of the DJ, overlooking the dancing crowd. LUCAS, MALIK, CHLOÉ and INÈS, same faces and outfits, laugh, dance and sing along with their arms around each other, authentic candid joy. Lasers and strobes light their faces, thick haze, the crowd and the DJ visible behind them. It ends with a bright white strobe flash filling the frame. [bloc personnages] [bloc style]
```
Son : `friends laughing and cheering, crowd noise` — si le clip contient de la musique, mets `"son_du_clip": 0` pour ce plan.

### Plan 09 — Flyer : rien à générer
Rendu fourni (`exports/nocta/nocta_flyer.mp4`). Il se met à jour avec ta vraie adresse au prochain montage.

---

## 7. Montage automatique

1. Mets ta vraie adresse dans `nocta/montage.json` (`"adresse": "12 rue ..."`).
2. Dépose les clips dans `nocta/clips/` (`shot_01.mp4` … `shot_08.mp4`, n'importe quel format ou ratio : tout est recadré en 1080×1920).
3. Lance :
   ```
   python3 tools/nocta/assemble.py --apercu      # aperçu rapide 540x960
   python3 tools/nocta/assemble.py               # version finale -> exports/nocta/NOCTA_final.mp4
   ```
   Il faut Python 3 avec `numpy`, `scipy`, `pillow` et `ffmpeg`. Tant qu'il manque des clips, le résultat s'appelle `NOCTA_animatic.mp4` et les plans manquants sont des cartons.

Réglages par plan dans `nocta/montage.json` :

| Clé | Rôle |
|---|---|
| `debut_source` | À quelle seconde du clip le plan commence. |
| `vitesse` | 1 = normal, 2 = deux fois plus rapide. Le script prévient si le clip est trop court. |
| `rampe` | Accélère à l'entrée et à la sortie du plan (effet speed ramp avec vrai flou de mouvement). |
| `synchro` | `{"dans_le_clip": 3.1, "sur_la_timeline": 2.5}` : cale un instant précis du clip sur un temps précis du film (notification, vitre, drop du DJ). |
| `son_du_clip` | Volume du son généré par l'IA (voix, rires) sous la musique. 0 = coupé. Ignoré si `rampe` est active. |
| `transition_suivante` | `traversee` (flou de zoom + éclair, pour vitre, pare-brise, portes), `fondu`, `coupe`, `flash` (flash blanc vers le flyer). |

Réglages généraux : `etalonnage` (0 à 1, unifie la couleur des clips : ombres bleu-violet, hautes lumières chaudes, halation) et `grain` (0 à 1). `notification.hauteur_centre_px` déplace la carte verticalement si elle cache un visage.

---

## 8. Si un plan ne sort pas bien

- **Les visages changent d'un plan à l'autre** : repars toujours des mêmes fiches personnages, recopie le bloc personnages sans le modifier, et privilégie les plans où ils sont un peu plus loin (plans 01, 08).
- **Mains déformées** : régénère ; demande « hands relaxed, natural » ; évite de faire faire des gestes compliqués aux mains. Au plan 04, une main peut juste tapoter le volant.
- **Voiture qui se déforme ou mauvais logo** : donne la photo de référence de la Golf ; réduis la vitesse de la caméra dans le prompt (« controlled »).
- **Enseigne NOCTA mal écrite** : génère K6 à part jusqu'à ce que le mot soit parfait, puis anime cette image.
- **Look trop « IA » (trop lisse, trop saturé)** : ajoute « documentary realism, slight handheld imperfection, natural color, no HDR » et baisse les mots « epic / cinematic ».
- **Le plan 03 est trop compliqué en une fois** : c'est pour ça qu'il est coupé en 03a et 03b ; si besoin, génère encore plus court et mets `vitesse` plus haut.

> Note : en France la loi Évin encadre la publicité pour l'alcool. Si la pub est diffusée en sponsorisé, tu peux remplacer les bouteilles d'alcool du plan 01 par des softs sans rien changer d'autre.
