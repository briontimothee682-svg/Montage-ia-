"""Builds every prompt / editing file of the TIM DESIGN reel from one source of truth.
Usage: python3 tools/build.py [path/to/page.html]"""
import html, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PH = {"addr": "12 rue de la République", "city": "Annecy", "handle": "@timdesign", "font": "Poppins"}
COLORS = {"black": "#111111", "gold": "#C9A24B", "cream": "#F3EEE3"}

REALISM = ("Photorealistic live-action footage, as if shot on an ARRI Alexa 35 with anamorphic 35mm and 100mm macro lenses: "
           "true-to-life materials (leather grain and stitching, brushed metal with micro-scratches, veined marble, real glass, real plant leaves), "
           "physically accurate light and reflections, natural film grain. Absolutely no cartoon, illustration, 3D render or CGI look.")
PALETTE = (f"Colors strictly matte black {COLORS['black']}, brushed gold {COLORS['gold']} and warm cream {COLORS['cream']}; "
           "the only other color allowed is the natural green of the plants and of the football pitch on the TV.")
LIGHT = ("Moody low-key lighting, deep blacks, warm 2700K golden highlights from brass pendant lamps, "
         "slightly desaturated warm cinematic grade, subject razor sharp, soft creamy bokeh.")
SET = ("An upscale modern barbershop called TIM DESIGN, completely empty of people: matte black walls, cream veined marble floor, "
       "dark walnut counters, brass pendant lamps, two black leather barber chairs with gold details, round gold-framed mirrors, "
       "lush green plants (monstera, olive tree, hanging pothos) in matte black pots, a dark walnut reception desk with the brushed-gold "
       "TIM DESIGN logo backlit on the black wall behind it, and a waiting lounge with a black leather sofa, two armchairs, "
       "a low marble coffee table and a wall-mounted flat TV playing a live football match.")
TV = ("The TV shows a live football match from the wide broadcast camera: bright green pitch, players tiny and distant, "
      "no readable score, no team or channel logos.")

NEGATIVE = ("people in the salon, customers, barbers, hands, fingers, arms, faces, body parts, silhouettes, people reflected in mirrors "
            "(the only people allowed are tiny distant football players on the TV screen), cartoon, illustration, anime, 3D render, CGI look, "
            "video game look, plastic textures, misspelled or garbled letters, any text other than TIM DESIGN, other brand names or logos, "
            "TV channel logos, watermark, subtitles, colors outside black/gold/cream except plant green and pitch green, blue or purple tint, "
            "neon lights, daylight, harsh flat lighting, blown-out highlights, blurry or out-of-focus subject, warped or melting objects, "
            "deformed tools, extra blades, duplicated objects, clutter, hair on the floor, dirt, flicker, jitter, shaky handheld camera, "
            "fisheye distortion, dutch angle, low resolution, noise, compression artifacts")

# start, end, scale, French label, subject, camera, motion, transition_out, priority
SHOTS = [
    (0.0, 3.0, "wide", "Façade de nuit puis entrée dans le salon",
     "Exterior at night: the TIM DESIGN storefront, matte black façade, a backlit brushed-gold 'TIM DESIGN' sign above a tall glass door, "
     "warm golden light from the salon spilling onto wet pavement with soft reflections, plants visible through the window. "
     "The camera then glides through the glass door into the salon, where the gold TIM DESIGN logo glowing on the reception wall comes into focus",
     "slow steady push-in on a gimbal, continuous single move from outside to inside",
     "light reflections sliding on the glass and the wet pavement",
     "hard cut on the beat drop", True),
    (3.0, 3.4, "close", "Pot de cire TIM DESIGN",
     "Extreme macro of a matte black pomade jar with a brushed-gold lid finely engraved 'TIM DESIGN', on dark walnut",
     "fast rack focus from a blurred foreground to the engraved lid", "a sharp glint of golden light crossing the lid",
     "hard cut on beat", False),
    (3.4, 3.8, "close", "Ciseaux dorés",
     "Extreme macro of polished gold barber scissors opening on black leather", "locked-off macro",
     "blades opening, light flashing along the edge", "hard cut on beat", False),
    (3.8, 4.2, "close", "Rasoir qui s'ouvre",
     "Extreme macro of a gold straight razor opening on a folded cream towel", "locked-off macro",
     "blade catching a flash of golden light", "hard cut on beat", False),
    (4.2, 4.6, "close", "Enseigne de barbier",
     "Vintage barber pole with black and gold spiral stripes and a glowing cream-white globe on a matte black wall",
     "low angle close-up, quick upward tilt", "spiral rotating", "hard cut on beat", False),
    (4.6, 7.0, "wide", "Vue d'ensemble du salon",
     "Wide establishing shot of the whole empty salon: the two black leather barber chairs, round gold-framed mirrors, brass pendant lamps, "
     "green plants, and the reception desk with the glowing gold logo in the background",
     "slow smooth dolly-in at chest height", "dust particles drifting in the warm light beams",
     "fast zoom-in transition (wide to close) with motion blur", False),
    (7.0, 9.0, "close", "Outils vus de dessus",
     "Top-down view of a dark walnut barber station: straight razor, black combs, gold scissors, shaving brush and a folded cream towel, "
     "perfectly aligned with equal spacing", "slow lateral slide", "warm light reflections moving across the metal",
     "fast pull-back transition (close to wide) with motion blur", False),
    (9.0, 11.5, "wide", "Salle d'attente, plantes et match à la télé",
     "Wide view of the waiting lounge: black leather sofa and two armchairs, low marble coffee table with a few TIM DESIGN products on it, "
     "monstera and olive tree in black pots, and the wall-mounted flat TV playing a live football match, its green pitch glowing in the dark room. "
     + TV, "slow lateral tracking", "the TV image moving, leaves catching the warm light",
     "whip-pan transition with motion blur", True),
    (11.5, 13.5, "close", "Étagère de produits TIM DESIGN",
     "Floating dark walnut shelves lined with matte black and amber glass bottles and jars with gold caps, every label printed "
     "'TIM DESIGN' in brushed-gold capitals, perfectly aligned, visible glass texture and clean reflections",
     "macro slider moving slowly along the shelf, very shallow depth of field", "a thin line of warm light sweeping across the gold labels",
     "fast zoom-in transition onto one bottle", True),
    (13.5, 14.5, "close", "Bouteille TIM DESIGN en macro",
     "Macro of a single matte black TIM DESIGN bottle with a gold cap standing on a black marble plinth, the gold 'TIM DESIGN' lettering "
     "razor sharp and centered", "slow orbit around the bottle", "gold rim light tracing the edges of the bottle",
     "fast pull-back transition (close to wide)", True),
    (14.5, 16.0, "wide", "Accueil avec le logo",
     "Wide view of the reception area: dark walnut desk, the brushed-gold TIM DESIGN logo backlit on the black wall behind it, "
     "tall green plants on both sides, the salon softly lit in the background",
     "slow push-in", "the logo glowing softly", "hard cut on the beat", False),
    (16.0, 18.5, "medium", "Téléphone devant le salon avec Instagram",
     "A matte black smartphone rises upright by itself from the reception counter into the foreground, nobody holding it; "
     "the whole salon stays visible and softly blurred behind it. Its screen lights up with the TIM DESIGN Instagram profile: "
     "round gold logo avatar, the name 'TIM DESIGN', a grid of nine black-and-gold photos of the salon and products, "
     "and a gold 'S'abonner' button", "low angle, slow push-in toward the screen",
     "phone sliding up smoothly, screen lighting up", "slow push-in toward the screen", True),
    (18.5, 20.5, "medium", "Le téléphone s'efface, retour au salon",
     "The same smartphone in the foreground, screen on, in front of the salon; the focus pulls from the phone to the salon behind it, "
     "then the phone slides down out of frame and the salon is sharp again",
     "rack focus from foreground to background, then very slow push-in", "phone gliding down out of frame",
     "hard cut", False),
    (20.5, 22.5, "close", "Fauteuil en cuir",
     "Close-up of a black leather barber chair headrest and polished gold armrest, leather grain and stitching clearly visible",
     "slow sideways tracking", "warm reflections gliding on the leather",
     "fast pull-back transition (close to wide)", False),
    (22.5, 24.5, "wide", "Miroir qui reflète le salon",
     "A round gold-framed mirror reflecting the whole empty salon, the plants and the warm pendant lamps, no person in the reflection",
     "slow push-in toward the mirror", "reflections shifting softly", "zoom-in transition (wide to close)", False),
    (24.5, 26.5, "close", "Tondeuse dorée en macro",
     "Macro of a professional gold hair clipper resting on black leather", "slow lateral slide along the blade",
     "sharp highlights running across the gold teeth", "soft cross-dissolve", False),
    (26.5, 30.0, "wide", "Fin : mur du logo",
     "Calm, simple shot of the reception wall with the backlit brushed-gold TIM DESIGN logo, plants framing both sides, "
     "the area below the logo left dark and empty", "almost static, very slow push-in",
     "a single soft gold light sweep across the logo, lights dimming slightly",
     "gentle fade to black #111111", True),
]

OVERLAYS = [
    {"in": 0.2, "out": 3.0, "what": "TIM DESIGN logo", "style": "gold, top center, 520px wide", "anim": "fade in + scale 95%->100% over 0.5s, dissolve out at 3.0s"},
    {"in": 0.5, "out": 3.0, "what": f"location pin icon + '{PH['addr']} · {PH['city']}'", "style": f"{PH['font']}, cream {COLORS['cream']}, 44px, below the logo", "anim": "slide up 20px + fade in 0.4s"},
    {"in": 16.6, "out": 20.3, "what": "ABONNEZ-VOUS", "style": f"{PH['font']}, gold {COLORS['gold']}, 96px, wide letter spacing, centered above the phone", "anim": "letters reveal left to right over 0.4s with a gold shimmer, ding sound"},
    {"in": 17.0, "out": 20.3, "what": PH['handle'], "style": f"{PH['font']}, cream {COLORS['cream']}, 44px, under ABONNEZ-VOUS", "anim": "fade in 0.3s"},
    {"in": 27.0, "out": 30.0, "what": "TIM DESIGN logo", "style": "gold, exact center, 600px wide", "anim": "fade in 0.6s, fade out with the final fade"},
    {"in": 27.5, "out": 30.0, "what": "ABONNEZ-VOUS", "style": f"{PH['font']}, gold {COLORS['gold']}, 64px, 160px below the logo", "anim": "fade in 0.4s"},
    {"in": 27.9, "out": 30.0, "what": f"{PH['handle']} · {PH['addr']}, {PH['city']}", "style": f"{PH['font']}, cream {COLORS['cream']}, 38px, under ABONNEZ-VOUS", "anim": "fade in 0.4s"},
]

def t(x):
    s = f"{x:04.1f}".replace(".", ",")
    return f"0:{s}"

def ts(x):
    return f"{x:.1f}s"

def negative(allowed="TIM DESIGN"):
    return NEGATIVE.replace("any text other than TIM DESIGN", f"any text other than {allowed}")

def shot_prompt(s):
    a, b, scale, fr, subj, cam, mot, tr, _ = s
    extra = " Keep the area below the logo dark and empty for text added in editing." if a == 26.5 else ""
    if a == 16.0:
        extra = " The only readable words on the screen are 'TIM DESIGN' and 'S'abonner'."
    return (f"{subj.rstrip('.')}. Camera: {cam}. Motion: {mot}.{extra} Vertical 9:16. {REALISM} {PALETTE} {LIGHT} Setting: {SET}")

def master_prompt():
    lines = [
        f"Create a {SHOTS[-1][1]:.0f}-second vertical 9:16 video (1080x1920, 30 fps): a cinematic commercial for TIM DESIGN, a luxury barbershop, for an Instagram Reel.",
        "", "LOOK: " + REALISM, "",
        "BRAND: " + PALETTE + f" The TIM DESIGN logo appears as a backlit brushed-gold sign. All on-screen text uses the font {PH['font']}: "
        f"main text in Poppins SemiBold, gold {COLORS['gold']}, capitals with wide letter spacing; secondary text in Poppins Light, cream {COLORS['cream']}.",
        "", "SET: " + SET + " " + TV, "", "LIGHT AND GRADE: " + LIGHT, "",
        "EDITING: fast cuts on the beat, constantly alternating extreme close-ups of products and tools with wide views of the whole salon, "
        "linked by smooth zoom-in, pull-back, whip-pan and rack-focus transitions with motion blur. Product close-ups are the highlight: "
        "perfect focus, controlled reflections, premium macro quality.",
        "", "SHOT LIST:",
    ]
    for i, s in enumerate(SHOTS, 1):
        a, b, scale, fr, subj, cam, mot, tr, _ = s
        lines.append(f"{i}. {ts(a)}-{ts(b)} [{scale.upper()}] {subj.rstrip('.')}. Camera: {cam}. Motion: {mot}. Transition out: {tr}.")
    lines += ["", "ON-SCREEN TEXT:"]
    for o in OVERLAYS:
        lines.append(f"- {ts(o['in'])}-{ts(o['out'])}: {o['what']} ({o['style']}; {o['anim']}).")
    lines += ["",
        "AUDIO: dark luxury deep-house instrumental, no vocals, cuts on the beat, heavy bass drop at 3.0s. Sound design: metallic clicks, "
        "razor ring, whooshes on every zoom and whip-pan, muffled stadium crowd from the TV in the lounge shot, a soft notification ding when "
        "ABONNEZ-VOUS appears, a warm low boom under the final logo, fade out over the last 1.5 seconds.",
        "", "AVOID: " + negative(f"TIM DESIGN, ABONNEZ-VOUS, S'abonner, the address and the Instagram handle") + "."]
    return "\n".join(lines)

def write_files():
    master = master_prompt()
    (ROOT / "PROMPT_COMPLET.md").write_text(
        "# Prompt complet — reel TIM DESIGN\n\n"
        "Le prompt entier, à coller d'un coup dans un outil qui accepte un long texte. "
        "\n\n```\n" + master + "\n```\n")
    md = ["# Prompts plan par plan", "",
          "Pour les générateurs qui font des clips de 5 à 10 s (Kling, Google Flow, Dreamina…). Réglages : **9:16**, durée la plus courte, qualité maximale. "
          "Nomme chaque vidéo `shot_XX.mp4`. Les textes (adresse, ABONNEZ-VOUS, pseudo) s'ajoutent au montage, pas ici.", "",
          "**Negative prompt (le même pour tous les plans) :**", "", "```", NEGATIVE, "```", ""]
    for i, s in enumerate(SHOTS, 1):
        md += [f"## shot_{i:02d} — {s[3]} ({t(s[0])} → {t(s[1])})", "", "```", shot_prompt(s), "```", ""]
    (ROOT / "PROMPTS_PAR_PLAN.md").write_text("\n".join(md))

    src = {
        "format": {"aspect_ratio": "9:16", "resolution": "1080x1920", "fps": 30, "duration_seconds": SHOTS[-1][1],
                   "use": "Instagram Reel for the luxury barbershop TIM DESIGN"},
        "brand": {"name": "TIM DESIGN", "colors": COLORS, "font": PH["font"], "address": f"{PH['addr']}, {PH['city']}", "instagram": PH["handle"]},
        "global_style": {"realism": REALISM, "palette": PALETTE, "lighting_and_grade": LIGHT, "set": SET, "tv": TV},
        "shots": [{"id": i, "file": f"shot_{i:02d}.mp4", "time": f"{s[0]}-{s[1]}s", "scale": s[2], "label_fr": s[3], "subject": s[4],
                   "camera": s[5], "motion": s[6], "transition_out": s[7]} for i, s in enumerate(SHOTS, 1)],
        "on_screen_text": OVERLAYS, "negative_prompt": NEGATIVE,
    }
    (ROOT / "reel_barbershop.json").write_text(json.dumps(src, indent=2, ensure_ascii=False) + "\n")

    montage = {
        "project": {"name": "TIM DESIGN - Reel salon", "resolution": "1080x1920", "fps": 30, "duration_seconds": SHOTS[-1][1],
                    "export": {"container": "mp4", "video_codec": "H.264 High", "bitrate_mbps": 20, "audio": "AAC 320 kbps", "file_name": "tim_design_reel.mp4"}},
        "brand": {"colors": COLORS, "font": PH["font"],
                  "assets": {"logo": "logo_tim_design.png (transparent background)",
                             "instagram_screenshot": "instagram_screenshot.png (real screenshot of the TIM DESIGN Instagram profile)"}},
        "global_rules": [
            "never show a person in the salon; reject any clip with a person, hand or face (tiny players on the TV are fine)",
            "cut on the beat; alternate close-ups and wide shots exactly as listed",
            "keep all text inside the Instagram safe zone: 250px top, 420px bottom, 140px right, 80px left",
            "text only in gold #C9A24B (main) or cream #F3EEE3 (secondary), font " + PH["font"],
            "if the Instagram page generated on the phone (shots 12-13) has garbled text, pin instagram_screenshot.png onto the phone screen with corner-pin tracking",
        ],
        "color_grade": {"apply_to": "all clips identically", "contrast": "+15", "saturation": "-10 (keep plant and pitch greens natural)",
                        "temperature": "+8 warm", "shadows": "toward #111111", "highlights": "warm gold, soft roll-off", "vignette": "-15", "grain": "5%"},
        "timeline": [{"clip": f"shot_{i:02d}.mp4", "in": s[0], "out": s[1], "scale": s[2], "content": s[3], "transition_out": s[7]}
                     for i, s in enumerate(SHOTS, 1)],
        "text_overlays": OVERLAYS,
        "audio": {"music": "dark luxury deep-house instrumental, no vocals, bass drop at 3.0s, fade out over the last 1.5s, -14 LUFS",
                  "sfx": [[0.0, "night street ambience + door opening"], [3.0, "deep impact on the drop"], [3.0, "metallic click"],
                          [3.8, "razor ring"], [6.9, "whoosh"], [8.9, "reverse whoosh"], [9.0, "muffled stadium crowd from the TV, low"],
                          [11.4, "whip-pan whoosh"], [13.4, "whoosh"], [14.4, "reverse whoosh"], [16.0, "smooth mechanical slide"],
                          [16.6, "notification ding"], [20.4, "reverse whoosh"], [22.4, "whoosh"], [26.5, "warm low boom"]]},
        "final_checks": ["duration 30.0s", "no person in the salon", "TIM DESIGN spelled correctly everywhere",
                         "address, ABONNEZ-VOUS and handle readable and inside the safe zone", "cuts on the beat"],
    }
    mj = json.dumps(montage, indent=2, ensure_ascii=False)
    (ROOT / "montage_ia.json").write_text(mj + "\n")
    (ROOT / "PROMPT_MONTAGE.md").write_text(
        "# Prompt à coller dans l'IA de montage\n\nColle le texte sous la ligne avec tes fichiers `shot_01.mp4` à `shot_17.mp4`, "
        "`logo_tim_design.png` et `instagram_screenshot.png`.\n\n---\n\n"
        "Tu es un monteur vidéo professionnel spécialisé dans les publicités de luxe pour Instagram. Monte un Reel vertical de 30 secondes "
        "pour le salon de barbier TIM DESIGN en suivant EXACTEMENT la fiche JSON ci-dessous : ordre, durées, transitions, étalonnage, textes, "
        "police, couleurs, son et export. Aucune personne dans le salon. Coupe sur le temps. Signale tout plan défectueux au lieu de le garder.\n\n"
        "```json\n" + mj + "\n```\n")
    return master

def write_page(path, master):
    prio = [i for i, s in enumerate(SHOTS, 1) if s[8]]
    cards = []
    for i, s in enumerate(SHOTS, 1):
        tags = []
        if s[8]: tags.append('<span class="tag tag-prio">À faire en premier</span>')
        if "TIM DESIGN" in s[4] and i not in (1, 6, 11, 17): tags.append('<span class="tag">Vérifie « TIM DESIGN »</span>')
        tags.append(f'<span class="tag">{ {"wide": "Vue large", "close": "Gros plan", "medium": "Plan moyen"}[s[2]] }</span>')
        cards.append(f'''<article class="shot">
  <header class="shot-head">
    <label class="done"><input type="checkbox" id="done-{i:02d}" data-shot="{i:02d}"><span class="box" aria-hidden="true"></span><span class="sr">Plan terminé</span></label>
    <div class="shot-title"><p class="file">shot_{i:02d}.mp4 · {t(s[0])} → {t(s[1])}</p><h3>{html.escape(s[3])}</h3><div class="tags">{"".join(tags)}</div></div>
  </header>
  <pre class="prompt" id="p-{i:02d}">{html.escape(shot_prompt(s))}</pre>
  <button class="copy" type="button" data-target="p-{i:02d}">Copier le prompt</button>
</article>''')
    tpl = (ROOT / "tools" / "page_template.html").read_text()
    page = (tpl.replace("{{MASTER}}", html.escape(master)).replace("{{NEG}}", html.escape(NEGATIVE))
               .replace("{{CARDS}}", "\n".join(cards)).replace("{{COUNT}}", str(len(SHOTS)))
               .replace("{{DURATION}}", f"{SHOTS[-1][1]:.0f}"))
    Path(path).write_text(page)

if __name__ == "__main__":
    prev = 0.0
    for s in SHOTS:
        assert abs(s[0] - prev) < 1e-9, f"gap at {prev}"
        prev = s[1]
    m = write_files()
    if len(sys.argv) > 1:
        write_page(sys.argv[1], m)
    print("ok", len(SHOTS), "shots,", prev, "s,", len(m.split()), "words in master prompt")
