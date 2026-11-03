# Prompt à coller dans l'IA de montage

Colle le texte sous la ligne avec tes 23 vidéos `shot_XX.mp4`, `assets/logo_atelier47.png`, `assets/fiche_tarifs.jpg` et `instagram_screenshot.png`.

---

Tu es un monteur vidéo professionnel spécialisé dans les publicités de luxe pour Instagram. Monte un Reel vertical de 50 secondes pour le salon ATELIER 47 BARBIER (Annecy) en suivant EXACTEMENT la fiche JSON ci-dessous : ordre, durées, transitions et leurs effets, rampes de vitesse, étalonnage, textes et leurs animations, police, couleurs, son et export. Aucune personne dans le salon. Coupe sur le temps. Signale tout plan défectueux au lieu de le garder.

```json
{
  "project": {
    "name": "ATELIER 47 BARBIER - Reel",
    "resolution": "1080x1920",
    "fps": 30,
    "duration_seconds": 50.0,
    "export": {
      "container": "mp4",
      "video_codec": "H.264 High",
      "bitrate_mbps": 20,
      "audio": "AAC 320 kbps",
      "file_name": "atelier47_reel.mp4"
    }
  },
  "brand": {
    "colors": {
      "black": "#111111",
      "gold": "#C9A24B",
      "cream": "#F3EEE3"
    },
    "font": "Poppins",
    "assets": {
      "logo": "assets/logo_atelier47.png (black background: use the Screen blend mode or remove the black)",
      "price_list": "assets/fiche_tarifs.jpg (shot 15, full screen, MANDATORY, use the file exactly as provided)",
      "instagram_screenshot": "instagram_screenshot.png (real screenshot of the @atelier47barbier profile)"
    }
  },
  "global_rules": [
    "never show a person in the salon; reject any clip with a person, hand or face (game players on the TV are fine)",
    "cut on the beat; alternate close-ups and wide shots exactly as listed",
    "upscale every clip to 1080x1920 (CapCut: Enhance quality) and trim the first and last 5 frames of each generated clip",
    "speed ramps on every transition: 100% -> 200% in the last 6 frames of the outgoing shot, 200% -> 100% in the first 6 frames of the next",
    "product close-ups (shots 3-6, 11, 12, 21) slowed to 70-80% with optical-flow interpolation",
    "keep all text inside the Instagram safe zone: 250px top, 420px bottom, 140px right, 80px left",
    "text only in gold #C9A24B or cream #F3EEE3, font Poppins",
    "shots 16-18 (phone + Instagram + ABONNEZ-VOUS) are MANDATORY: never remove or shorten them",
    "shot 15 is MANDATORY and uses assets/fiche_tarifs.jpg exactly as provided; in shot 14 key out the green frame and place the same image in it",
    "the opening-hours overlays (18.3-22.4s and at the end) are MANDATORY",
    "shots 16-17: key out the green phone screen (Chroma key) and place instagram_screenshot.png on it, scaled and keyframed to follow the screen",
    "the last frame fades to black so the reel loops cleanly into the first shot"
  ],
  "color_grade": {
    "apply_to": "all clips identically (grade one clip, copy the settings to all)",
    "contrast": "+15",
    "saturation": "-10 (keep plant and pitch greens natural)",
    "temperature": "+8 warm",
    "shadows": "toward #111111",
    "highlights": "warm gold, soft roll-off",
    "vignette": "-15",
    "grain": "5%"
  },
  "timeline": [
    {
      "clip": "shot_01.mp4",
      "in": 0.0,
      "out": 2.0,
      "scale": "wide",
      "content": "Façade Atelier 47 de nuit, en entier",
      "transition_out": "push-through transition: fast push into the glass door with a warm light flare"
    },
    {
      "clip": "shot_02.mp4",
      "in": 2.0,
      "out": 3.5,
      "scale": "wide",
      "content": "Juste après la porte : le salon s'ouvre",
      "transition_out": "hard cut on the bass drop with a 3-frame camera shake"
    },
    {
      "clip": "shot_03.mp4",
      "in": 3.5,
      "out": 3.9,
      "scale": "close",
      "content": "Pot de cire TIM DESIGN",
      "transition_out": "hard cut on beat with a 2-frame white-gold flash"
    },
    {
      "clip": "shot_04.mp4",
      "in": 3.9,
      "out": 4.3,
      "scale": "close",
      "content": "Goutte d'huile à barbe",
      "transition_out": "hard cut on beat with a 2-frame white-gold flash"
    },
    {
      "clip": "shot_05.mp4",
      "in": 4.3,
      "out": 4.7,
      "scale": "close",
      "content": "Rasoir qui s'ouvre",
      "transition_out": "hard cut on beat with a 2-frame white-gold flash"
    },
    {
      "clip": "shot_06.mp4",
      "in": 4.7,
      "out": 5.1,
      "scale": "close",
      "content": "Enseigne de barbier",
      "transition_out": "hard cut on beat"
    },
    {
      "clip": "shot_07.mp4",
      "in": 5.1,
      "out": 8.0,
      "scale": "wide",
      "content": "Vue d'ensemble du salon",
      "transition_out": "speed-ramped zoom-in transition (wide to close) with strong motion blur"
    },
    {
      "clip": "shot_08.mp4",
      "in": 8.0,
      "out": 10.0,
      "scale": "close",
      "content": "Outils du barbier à plat, vus de dessus",
      "transition_out": "speed-ramped pull-back transition (close to wide) with motion blur"
    },
    {
      "clip": "shot_09.mp4",
      "in": 10.0,
      "out": 12.5,
      "scale": "wide",
      "content": "Salle d'attente, TV, PS5 et plantes",
      "transition_out": "push-in transition straight into the TV with a soft blur"
    },
    {
      "clip": "shot_10.mp4",
      "in": 12.5,
      "out": 14.0,
      "scale": "close",
      "content": "La PS5 et la manette",
      "transition_out": "whip-pan transition with motion blur and a gold light leak"
    },
    {
      "clip": "shot_11.mp4",
      "in": 14.0,
      "out": 16.5,
      "scale": "close",
      "content": "Étagère de produits TIM DESIGN",
      "transition_out": "speed-ramped zoom-in transition onto one bottle"
    },
    {
      "clip": "shot_12.mp4",
      "in": 16.5,
      "out": 18.0,
      "scale": "close",
      "content": "Bouteille TIM DESIGN en macro",
      "transition_out": "speed-ramped pull-back transition (close to wide)"
    },
    {
      "clip": "shot_13.mp4",
      "in": 18.0,
      "out": 20.5,
      "scale": "wide",
      "content": "Comptoir d'accueil complet",
      "transition_out": "hard cut on the beat"
    },
    {
      "clip": "shot_14.mp4",
      "in": 20.5,
      "out": 22.5,
      "scale": "close",
      "content": "TPE et ordinateur, puis fiche tarifs",
      "transition_out": "push-in transition into the frame, straight into the real price list"
    },
    {
      "clip": "assets/fiche_tarifs.jpg",
      "in": 22.5,
      "out": 25.5,
      "scale": "close",
      "content": "OBLIGATOIRE · Ta vraie fiche tarifs",
      "transition_out": "gold flash transition"
    },
    {
      "clip": "shot_16.mp4",
      "in": 25.5,
      "out": 28.5,
      "scale": "medium",
      "content": "OBLIGATOIRE · Téléphone sur le comptoir",
      "transition_out": "continuous push-in, no cut"
    },
    {
      "clip": "shot_17.mp4",
      "in": 28.5,
      "out": 31.5,
      "scale": "close",
      "content": "OBLIGATOIRE · Écran Instagram + ABONNEZ-VOUS",
      "transition_out": "rack focus to the salon behind"
    },
    {
      "clip": "shot_18.mp4",
      "in": 31.5,
      "out": 33.5,
      "scale": "medium",
      "content": "Le téléphone s'efface, retour au salon",
      "transition_out": "whip-pan transition with motion blur"
    },
    {
      "clip": "shot_19.mp4",
      "in": 33.5,
      "out": 35.5,
      "scale": "close",
      "content": "Fauteuil en cuir",
      "transition_out": "speed-ramped pull-back transition (close to wide)"
    },
    {
      "clip": "shot_20.mp4",
      "in": 35.5,
      "out": 38.0,
      "scale": "wide",
      "content": "Miroir qui reflète le salon",
      "transition_out": "zoom-in transition (wide to close) with a gold light leak"
    },
    {
      "clip": "shot_21.mp4",
      "in": 38.0,
      "out": 40.0,
      "scale": "close",
      "content": "Tondeuse dorée en macro",
      "transition_out": "blur dissolve"
    },
    {
      "clip": "shot_22.mp4",
      "in": 40.0,
      "out": 42.0,
      "scale": "close",
      "content": "Feuille de plante, puis salon",
      "transition_out": "speed-ramped pull-back transition"
    },
    {
      "clip": "shot_23.mp4",
      "in": 42.0,
      "out": 44.5,
      "scale": "wide",
      "content": "Le salon vers la porte d'entrée",
      "transition_out": "soft cross-dissolve"
    },
    {
      "clip": "shot_24.mp4",
      "in": 44.5,
      "out": 50.0,
      "scale": "wide",
      "content": "Fin : mur du logo Atelier 47",
      "transition_out": "gentle fade to black #111111 that loops back to the first shot"
    }
  ],
  "text_overlays": [
    {
      "a": 0.0,
      "b": 3.5,
      "what": "logo_atelier47.png",
      "style": "top center, 420px wide",
      "effect": "visible from the very first frame, scale 105% to 100%, one gold shimmer sweep at 1.0s, dissolve out at 3.5s"
    },
    {
      "a": 0.4,
      "b": 3.5,
      "what": "location pin icon + '12 RUE DE LA RÉPUBLIQUE'",
      "style": "Poppins SemiBold, cream #F3EEE3, 46px, letter spacing +80, below the logo",
      "effect": "slide up 20px + fade in over 0.4s, letter spacing expanding slightly"
    },
    {
      "a": 0.7,
      "b": 3.5,
      "what": "74000 ANNECY",
      "style": "Poppins Bold, gold #C9A24B, 60px, letter spacing +120, under the street",
      "effect": "fade in with a gold underline drawing itself from left to right under the city, soft glow"
    },
    {
      "a": 18.3,
      "b": 22.4,
      "what": "HORAIRES",
      "style": "Poppins SemiBold, gold #C9A24B, 44px, letter spacing +150, lower third",
      "effect": "slide in from the left with a thin gold line drawing itself under it"
    },
    {
      "a": 18.6,
      "b": 22.4,
      "what": "MARDI – VENDREDI · 9H – 19H / SAMEDI · 9H – 18H / FERMÉ DIMANCHE ET LUNDI",
      "style": "Poppins Medium, cream #F3EEE3, 38px, three lines under HORAIRES",
      "effect": "lines slide in one after another, 0.15s apart, fade out together"
    },
    {
      "a": 26.0,
      "b": 31.5,
      "what": "ABONNEZ-VOUS",
      "style": "Poppins Bold, gold gradient #C9A24B to a lighter gold highlight, 104px, letter spacing +60, centered above the phone",
      "effect": "letters pop in one by one (scale 120% to 100%, 0.05s apart) on the beat, then a bright gold light sweep across the word, soft outer glow, a few fine gold sparkle particles, a thin gold underline drawing itself, and a subtle pulse (100% to 104%) on every beat; no motion blur, always readable"
    },
    {
      "a": 26.6,
      "b": 31.5,
      "what": "@atelier47barbier",
      "style": "Poppins Medium, cream #F3EEE3, 46px, under ABONNEZ-VOUS",
      "effect": "typewriter reveal over 0.5s, then steady"
    },
    {
      "a": 45.0,
      "b": 50.0,
      "what": "logo_atelier47.png",
      "style": "exact center, 560px wide",
      "effect": "fade in + scale 95% to 100% over 0.6s, one gold shimmer sweep at 46.0s"
    },
    {
      "a": 45.6,
      "b": 50.0,
      "what": "ABONNEZ-VOUS",
      "style": "Poppins Bold, gold #C9A24B, 72px, 150px below the logo",
      "effect": "letters pop in one by one with a gold light sweep and soft glow, gentle pulse on the beat"
    },
    {
      "a": 46.0,
      "b": 50.0,
      "what": "@atelier47barbier",
      "style": "Poppins Medium, cream #F3EEE3, 40px, under ABONNEZ-VOUS",
      "effect": "fade in 0.4s"
    },
    {
      "a": 46.4,
      "b": 50.0,
      "what": "12 rue de la République, 74000 Annecy",
      "style": "Poppins Regular, cream #F3EEE3, 36px",
      "effect": "fade in 0.4s"
    },
    {
      "a": 46.8,
      "b": 50.0,
      "what": "MARDI – VENDREDI · 9H – 19H / SAMEDI · 9H – 18H / FERMÉ DIMANCHE ET LUNDI",
      "style": "Poppins Medium, gold #C9A24B, 32px, three centered lines",
      "effect": "lines fade in one after another, 0.2s apart"
    },
    {
      "a": 47.4,
      "b": 50.0,
      "what": "TIM DESIGN",
      "style": "Poppins Light, cream #F3EEE3 at 70% opacity, 24px, letter spacing +200, just above the bottom safe zone",
      "effect": "fade in 0.5s, discreet signature"
    }
  ],
  "audio": {
    "music": "dark luxury deep-house instrumental, no vocals, bass drop at 3.5s, fade out over the last 2s, -14 LUFS",
    "sfx": [
      [
        0.0,
        "night street ambience + door opening"
      ],
      [
        3.5,
        "deep impact on the drop"
      ],
      [
        3.5,
        "metallic click"
      ],
      [
        4.3,
        "razor ring"
      ],
      [
        7.9,
        "whoosh"
      ],
      [
        9.9,
        "reverse whoosh"
      ],
      [
        10.0,
        "muffled stadium crowd + game sounds from the TV, low"
      ],
      [
        12.4,
        "whoosh into the TV"
      ],
      [
        13.9,
        "whip-pan whoosh"
      ],
      [
        15.9,
        "whoosh"
      ],
      [
        17.9,
        "reverse whoosh"
      ],
      [
        20.8,
        "card terminal beep"
      ],
      [
        22.4,
        "whoosh into the frame"
      ],
      [
        25.4,
        "gold flash shimmer"
      ],
      [
        25.5,
        "smooth mechanical slide"
      ],
      [
        26.0,
        "notification ding"
      ],
      [
        33.4,
        "whip-pan whoosh"
      ],
      [
        35.4,
        "reverse whoosh"
      ],
      [
        41.9,
        "reverse whoosh"
      ],
      [
        44.5,
        "warm low boom"
      ]
    ]
  },
  "final_checks": [
    "duration 50.0s",
    "no person in the salon",
    "ATELIER 47 and TIM DESIGN spelled correctly everywhere",
    "prices, address, hours, ABONNEZ-VOUS and handle readable and inside the safe zone",
    "cuts on the beat",
    "same salon layout in every wide shot",
    "the ending loops cleanly into the start"
  ]
}
```
