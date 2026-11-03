"""Builds every prompt / editing file of the ATELIER 47 x TIM DESIGN reel from one source of truth.
Usage: python3 tools/build.py [path/to/page.html]"""
import html, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------- brand facts
SALON = "ATELIER 47 BARBIER"
LINE = "TIM DESIGN"
ADDR = "12 rue de la République"
CITY = "74000 Annecy"
HANDLE = "@atelier47barbier"
FONT = "Poppins"
HOURS = ["MARDI – VENDREDI · 9H – 19H", "SAMEDI · 9H – 18H", "FERMÉ DIMANCHE ET LUNDI"]
COLORS = {"black": "#111111", "gold": "#C9A24B", "cream": "#F3EEE3"}
PRICES = ("NOS TARIFS — Coupe: Coupe Homme 22€, Dégradé/Fade 25€, Coupe étudiant 20€, Enfant (-12 ans) 15€. "
          "Barbe + soins: Barbe 15€, Shampooing 5€, Coupe + barbe + shampoing 38€. @atelier47barbier")

LOGO = ("the ATELIER 47 BARBIER logo: a circular badge made of two thin concentric brushed-gold rings on matte black; at the top a pair of "
        "open gold scissors; the word 'ATELIER' in cream condensed capitals with wide letter spacing; a large bold gold '47' below it; "
        "a thin horizontal gold line; 'BARBIER' in cream spaced capitals; and the small gold tagline 'COUPE NETTE · BARBE SOIGNÉE'")

# ---------------------------------------------------------------- look
REALISM = ("Ultra-photorealistic live-action footage, indistinguishable from a real commercial shot on an ARRI Alexa 35 with anamorphic 35mm "
           "and 100mm macro lenses: true-to-life materials (leather grain and stitching, brushed metal with micro-scratches, veined marble, "
           "real glass, real plant leaves with natural imperfections), physically accurate light, shadows and reflections, real-world physics "
           "and natural camera inertia, subtle lens breathing, soft halation on highlights, natural film grain. Absolutely no cartoon, "
           "illustration, 3D render, CGI or AI-looking artifacts.")
PALETTE = (f"Colors strictly matte black {COLORS['black']}, brushed gold {COLORS['gold']} and warm cream {COLORS['cream']}; the only other "
           "colors allowed are the natural green of the plants and the green pitch on the TV.")
LIGHT = ("Moody low-key lighting, deep blacks, warm 2700K golden highlights from brass pendant lamps, slightly desaturated warm cinematic "
         "grade identical on every shot, subject razor sharp, soft creamy bokeh.")
SCALE = ("Real-world scale, identical outside and inside: the shop is a wide ground-floor commercial unit, about 9 meters wide and 15 meters "
         "deep with a 3.5-meter ceiling; the façade has two large floor-to-ceiling display windows framing a wide double glass entrance door "
         "(2.6 m tall, 1.8 m wide, slim black frames, long vertical brass handles), so the salon looks as big from the street as it is inside.")
PS5 = ("a white PlayStation 5 Pro standing vertically on its stand, exactly like the official product: a tall slim body with two glossy white "
       "side covers around a glossy black center core, three thin black horizontal stripes across the middle of the white covers, a thin "
       "blue-white light line; next to it a white DualSense controller with a black center panel, black thumbsticks and black buttons")
SET = ("The ATELIER 47 BARBIER salon in Annecy, an upscale modern barbershop, completely empty of people. " + SCALE + " Fixed layout, identical in every shot: "
       "the wide double glass entrance door on the street side; the reception and checkout desk just to the right of the entrance; two black leather "
       "barber chairs with gold details facing round gold-framed mirrors along the left wall; the waiting lounge at the back; a row of brass "
       "pendant lamps along the ceiling. Materials: matte black walls, cream veined marble floor, dark walnut counters. Lots of lush green "
       "plants everywhere: tall monstera and an olive tree in matte black pots, hanging pothos trailing from the ceiling, ferns on the shelves, "
       "small plants on the counters. Reception desk in dark walnut: a slim black all-in-one computer whose screen shows a dark booking "
       "calendar with gold accents, a black card payment terminal with a glowing screen and a contactless symbol, a black-and-gold framed price "
       f"list titled 'NOS TARIFS', and behind the desk, backlit on the black wall, {LOGO}. Waiting lounge: black leather sofa, two armchairs, a "
       "low marble coffee table with two white game controllers and a few TIM DESIGN grooming products, and a large wall-mounted flat TV above "
       "a dark walnut TV cabinet on which stands " + PS5 + ".")
REALISM_SHORT = ("Ultra-photorealistic live-action footage, like a real commercial shot on an ARRI Alexa 35 with anamorphic and macro lenses: "
                 "true-to-life materials, physically accurate light, shadows and reflections, natural film grain. No cartoon, 3D render, CGI or AI artifacts.")
SET_WIDE = ("Setting: the ATELIER 47 BARBIER salon, empty of people, a large room about 9 m wide and 15 m deep with a 3.5 m ceiling, "
            "same layout in every shot: wide double glass entrance door, reception desk right of the "
            "entrance, two black leather barber chairs facing round gold-framed mirrors on the left wall, waiting lounge at the back, a row of "
            "brass pendant lamps. Matte black walls, cream veined marble floor, dark walnut, lush green plants everywhere (monstera, olive tree, "
            "hanging pothos, ferns).")
SET_CLOSE = ("Setting: inside the ATELIER 47 BARBIER salon, empty of people: matte black walls, dark walnut, warm brass pendant lights and "
             "green plants in soft bokeh.")
TV = ("From the first frame to the last, the TV shows only one thing: a football video game being played on the PlayStation 5, bright "
      "green pitch seen from the wide broadcast camera angle, small game players running; the image never changes to anything else (no "
      "presenter, no person close-up, no channel change, no menu), no readable score, no team or channel logos.")
PRODUCTS = "TIM DESIGN is the premium grooming product line sold in the salon: matte black and amber glass bottles and jars with gold caps."

NEGATIVE = ("people in the salon, customers, barbers, hands, fingers, arms, faces, body parts, silhouettes, people reflected in mirrors or "
            "windows (the only people allowed are the small video game players on the TV screen), cartoon, illustration, anime, 3D render, "
            "CGI look, video game look on the real set, plastic textures, AI artifacts, misspelled or garbled letters, {TEXT}, other brand "
            "names or logos, TV channel logos, TV presenter or person close-up on the TV, TV image changing or switching channel, tiny or "
            "narrow storefront, small door, exterior and interior at different scales, watermark, subtitles, colors outside black/gold/cream except plant green and pitch green, "
            "blue or purple tint, neon lights, daylight, harsh flat lighting, blown-out highlights, blurry or out-of-focus subject, warped "
            "or melting objects, objects changing shape, deformed tools, extra blades, duplicated objects, inconsistent room layout, clutter, "
            "hair on the floor, dirt, flicker, jitter, shaky handheld camera, fisheye distortion, dutch angle, low resolution, noise, "
            "compression artifacts")

def negative(allowed="ATELIER 47 BARBIER and TIM DESIGN"):
    return NEGATIVE.replace("{TEXT}", f"any text other than {allowed}")

# ---------------------------------------------------------------- shot list
def S(a, b, scale, fr, subject, camera, motion, tr, prio=False, gen=True, note=""):
    return dict(a=a, b=b, scale=scale, fr=fr, subject=subject, camera=camera, motion=motion, tr=tr, prio=prio, gen=gen, note=note)

SHOTS = [
    S(0.0, 2.0, "wide", "Façade Atelier 47 de nuit, en entier",
      f"Exterior at night in Annecy, the whole storefront visible from across the street: the ATELIER 47 BARBIER shop, a wide matte black "
      f"façade about 9 meters across with two large floor-to-ceiling display windows framing a wide double glass entrance door (2.6 m tall, "
      f"slim black frames, long vertical brass handles); above the door a large backlit sign of {LOGO}; tall green plants in matte black "
      "planters on both sides of the door; through the windows the deep, warmly lit salon with its pendant lamps, chairs and plants; warm "
      "golden light spilling onto the wet cobblestone pavement with soft reflections",
      "ultra-wide 20mm lens at eye level from across the street, slow steady gimbal push-in toward the door, already moving on the very first frame",
      "light reflections sliding on the glass and the wet pavement", "push-through transition: fast push into the glass door with a warm light flare", prio=True),
    S(2.0, 3.5, "wide", "Juste après la porte : le salon s'ouvre",
      "View from just inside the wide double glass entrance door looking into the large salon: the full depth of the room visible, the "
      "reception desk on the right with the backlit gold ATELIER 47 logo on the wall, the two barber chairs and round mirrors on the left, "
      "the row of brass pendant lamps leading to the waiting lounge at the back, plants everywhere",
      "ultra-wide 20mm lens at chest height, smooth forward glide continuing the movement of the previous shot",
      "pendant lamps passing overhead, dust in the light beams", "hard cut on the bass drop with a 3-frame camera shake", prio=True),
    S(3.5, 3.9, "close", "Pot de cire TIM DESIGN",
      "Extreme macro of a matte black pomade jar with a brushed-gold lid finely engraved 'TIM DESIGN', on dark walnut; only the jar in frame",
      "fast rack focus from a blurred foreground to the engraved lid", "a sharp glint of golden light crossing the lid",
      "hard cut on beat with a 2-frame white-gold flash"),
    S(3.9, 4.3, "close", "Goutte d'huile à barbe",
      "Extreme macro of an amber glass beard oil bottle with a gold dropper cap labelled 'TIM DESIGN'; a single golden drop of oil falls from "
      "the dropper in slow motion; only this bottle in frame, no scissors, no razor", "locked-off macro",
      "the drop falling and catching the warm light", "hard cut on beat with a 2-frame white-gold flash"),
    S(4.3, 4.7, "close", "Rasoir qui s'ouvre",
      "Extreme macro of a gold straight razor opening on a folded cream towel; only the razor in frame, no scissors", "locked-off macro",
      "blade catching a flash of golden light", "hard cut on beat with a 2-frame white-gold flash"),
    S(4.7, 5.1, "close", "Enseigne de barbier",
      "Vintage barber pole with black and gold spiral stripes and a glowing cream-white globe on a matte black wall, a hanging pothos beside it",
      "low angle close-up, quick upward tilt", "spiral rotating", "hard cut on beat"),
    S(5.1, 8.0, "wide", "Vue d'ensemble du salon",
      "Wide establishing shot of the whole empty salon: the two black leather barber chairs, round gold-framed mirrors, the row of brass pendant "
      "lamps, lush plants everywhere (monstera, olive tree, hanging pothos), and the reception desk with the glowing gold ATELIER 47 logo in the background",
      "ultra-wide 18mm lens from the far corner, the entire room visible from floor to ceiling, slow smooth dolly-in at chest height",
      "dust particles drifting in the warm light beams",
      "speed-ramped zoom-in transition (wide to close) with strong motion blur"),
    S(8.0, 10.0, "close", "Outils du barbier à plat, vus de dessus",
      "Overhead flat lay shot straight down at 90 degrees: on a black leather mat placed on dark walnut, exactly five barber tools laid out "
      "in one clean horizontal row with equal spacing, from left to right: a closed gold straight razor, a black fine-tooth comb, a pair of "
      "closed gold barber scissors, a shaving brush with a black handle and cream bristles, and a neatly folded cream towel; every tool "
      "complete, correctly shaped, perfectly parallel and razor sharp; a small potted fern in the top corner",
      "camera pointing straight down, slow lateral slide from left to right along the row", "a warm light reflection gliding across the metal of each tool",
      "speed-ramped pull-back transition (close to wide) with motion blur"),
    S(10.0, 12.5, "wide", "Salle d'attente, TV, PS5 et plantes",
      "Wide view of the waiting lounge: black leather sofa and two armchairs, low marble coffee table with two white game controllers and a few "
      "TIM DESIGN products, monstera, olive tree and hanging pothos, and the large wall-mounted TV above a dark walnut cabinet with a white "
      f"PlayStation 5 Pro standing upright. {TV}",
      "ultra-wide 20mm lens, the whole lounge and the full TV wall in frame, slow lateral tracking", "the game moving on the TV, leaves catching the warm light",
      "push-in transition straight into the TV with a soft blur", prio=True,
      note="La télé doit montrer uniquement le match du jeu, du début à la fin. Si elle change d'image (présentateur, autre chaîne), relance la génération."),
    S(12.5, 14.0, "close", "La PS5 et la manette",
      f"Close-up of {PS5}, on the dark walnut cabinet under the TV; the controller lies sharp in the foreground on the marble coffee table; "
      "the football video game softly visible on the TV above (same game image, nothing else on the screen)",
      "slow rack focus from the controller to the console and the TV", "the TV light flickering softly on the console",
      "whip-pan transition with motion blur and a gold light leak", prio=True,
      note="Pour une PS5 fidèle : utilise le mode « image vers vidéo » (ou « image de référence ») avec ta photo de la PS5 Pro, assets/ps5_reference.jpg."),
    S(14.0, 16.5, "close", "Étagère de produits TIM DESIGN",
      "Floating dark walnut shelves lined with matte black and amber glass bottles and jars with gold caps, every label printed 'TIM DESIGN' "
      "in brushed-gold capitals, perfectly aligned, small ferns between the products, visible glass texture and clean reflections",
      "macro slider moving slowly along the shelf, very shallow depth of field", "a thin line of warm light sweeping across the gold labels",
      "speed-ramped zoom-in transition onto one bottle", prio=True),
    S(16.5, 18.0, "close", "Bouteille TIM DESIGN en macro",
      "Macro of a single matte black TIM DESIGN bottle with a gold cap standing on a black marble plinth, the gold 'TIM DESIGN' lettering "
      "razor sharp and centered", "slow orbit around the bottle", "gold rim light tracing the edges of the bottle",
      "speed-ramped pull-back transition (close to wide)", prio=True),
    S(18.0, 20.5, "wide", "Comptoir d'accueil complet",
      "Wide view of the reception and checkout desk in dark walnut: the slim black all-in-one computer showing a dark booking calendar, the black "
      "card payment terminal with its screen glowing, the black-and-gold framed 'NOS TARIFS' price list standing on the counter, and behind it, "
      f"backlit on the black wall, {LOGO}; tall plants on both sides of the desk, the salon softly lit in the background",
      "wide 24mm lens showing the whole desk and wall, slow push-in", "the logo glowing softly, screens lit", "hard cut on the beat", prio=True),
    S(20.5, 22.5, "close", "TPE et ordinateur, puis fiche tarifs",
      "Close-up of the checkout counter: the black card payment terminal with a glowing screen and a contactless symbol next to the computer "
      "keyboard; the focus then moves to the black-and-gold framed 'NOS TARIFS' price list standing beside it",
      "slow lateral slide, then rack focus onto the price list frame", "screen light reflecting on the walnut",
      "push-in transition into the price list frame"),
    S(22.5, 25.5, "close", "Fiche tarifs (ta vraie image)",
      f"Full-screen view of the real ATELIER 47 price list: {PRICES}",
      "slow push-in 100% to 106%", "a soft gold light sweep across the title", "gold flash transition", gen=False,
      note="Ne pas générer : place ta vraie image assets/fiche_tarifs.jpg en plein écran au montage, pour que les prix soient parfaitement lisibles."),
    S(25.5, 28.5, "medium", "OBLIGATOIRE · Téléphone sur le comptoir",
      "A matte black smartphone standing upright on a small brushed-gold stand on the walnut reception counter, screen facing the camera, "
      "nobody holding it; the large salon softly blurred behind it with its pendant lamps and plants. SCREEN",
      "slow push-in until the phone screen fills about 70% of the frame height", "the screen glowing, warm reflections on the phone edges",
      "continuous push-in, no cut", prio=True,
      note="Plan obligatoire, à ne jamais supprimer. L'écran est vert pour que tu colles ta vraie capture Instagram dessus (Chroma key dans CapCut)."),
    S(28.5, 31.5, "close", "OBLIGATOIRE · Écran Instagram + ABONNEZ-VOUS",
      "The same smartphone on its gold stand, held perfectly still and flat to the camera, filling about 70% of the frame height, razor sharp. SCREEN",
      "locked-off, no motion blur, very slow push-in", "nothing moves except a soft glow on the phone edges",
      "rack focus to the salon behind", prio=True,
      note="Plan obligatoire. C'est ici que « ABONNEZ-VOUS » et @atelier47barbier s'affichent par-dessus ta capture Instagram."),
    S(31.5, 33.5, "medium", "Le téléphone s'efface, retour au salon",
      "The same smartphone on its gold stand in the foreground in front of the salon, screen dark; the focus pulls from the phone to the salon behind it, then the phone slides "
      "down out of frame and the salon is sharp again", "rack focus from foreground to background, then very slow push-in",
      "phone gliding down out of frame", "whip-pan transition with motion blur"),
    S(33.5, 35.5, "close", "Fauteuil en cuir",
      "Close-up of a black leather barber chair headrest and polished gold armrest, leather grain and stitching clearly visible",
      "slow sideways tracking", "warm reflections gliding on the leather", "speed-ramped pull-back transition (close to wide)"),
    S(35.5, 38.0, "wide", "Miroir qui reflète le salon",
      "A round gold-framed mirror reflecting the whole empty salon, the plants and the warm pendant lamps, no person in the reflection",
      "wide 24mm lens, slow push-in toward the mirror", "reflections shifting softly", "zoom-in transition (wide to close) with a gold light leak"),
    S(38.0, 40.0, "close", "Tondeuse dorée en macro",
      "Macro of a professional gold hair clipper resting on black leather", "slow lateral slide along the blade",
      "sharp highlights running across the gold teeth", "blur dissolve"),
    S(40.0, 42.0, "close", "Feuille de plante, puis salon",
      "A large monstera leaf sharp in the foreground, real leaf texture and veins, then the focus moves to the barber chairs and pendant lamps behind it",
      "slow rack focus from the leaf to the salon", "the leaf moving very slightly", "speed-ramped pull-back transition"),
    S(42.0, 44.5, "wide", "Le salon vers la porte d'entrée",
      "Wide view from the back of the salon toward the wide double glass entrance door between the two large display windows, the reception desk with the glowing logo on the right, plants "
      "along the way, the night street of Annecy softly visible through the glass",
      "ultra-wide 18mm lens, the full depth of the room and the wide double door visible, slow dolly-out", "warm light glowing, faint reflections on the glass", "soft cross-dissolve"),
    S(44.5, 50.0, "wide", "Fin : mur du logo Atelier 47",
      f"Calm, simple shot of the reception wall with {LOGO} backlit, plants framing both sides, the area below the logo left dark and empty",
      "almost static, very slow push-in", "a single soft gold light sweep across the logo, lights dimming slightly",
      "gentle fade to black #111111 that loops back to the first shot", prio=True),
]

def O(a, b, what, style, effect):
    return dict(a=a, b=b, what=what, style=style, effect=effect)

GOLD, CREAM = COLORS["gold"], COLORS["cream"]
OVERLAYS = [
    O(0.0, 3.5, "logo_atelier47.png", "top center, 420px wide",
      "visible from the very first frame, scale 105% to 100%, one gold shimmer sweep at 1.0s, dissolve out at 3.5s"),
    O(0.4, 3.5, f"location pin icon + '{ADDR.upper()}'", f"{FONT} SemiBold, cream {CREAM}, 46px, letter spacing +80, below the logo",
      "slide up 20px + fade in over 0.4s, letter spacing expanding slightly"),
    O(0.7, 3.5, CITY.upper(), f"{FONT} Bold, gold {GOLD}, 60px, letter spacing +120, under the street",
      "fade in with a gold underline drawing itself from left to right under the city, soft glow"),
    O(18.3, 20.5, "OUVERT DU MARDI AU SAMEDI", f"{FONT} Medium, cream {CREAM}, 40px, letter spacing +100, lower third",
      "slide in from the left with a thin gold line, fade out on the cut"),
    O(26.0, 31.5, "ABONNEZ-VOUS", f"{FONT} Bold, gold gradient {GOLD} to a lighter gold highlight, 104px, letter spacing +60, centered above the phone",
      "letters pop in one by one (scale 120% to 100%, 0.05s apart) on the beat, then a bright gold light sweep across the word, soft outer glow, "
      "a few fine gold sparkle particles, a thin gold underline drawing itself, and a subtle pulse (100% to 104%) on every beat; no motion blur, always readable"),
    O(26.6, 31.5, HANDLE, f"{FONT} Medium, cream {CREAM}, 46px, under ABONNEZ-VOUS",
      "typewriter reveal over 0.5s, then steady"),
    O(45.0, 50.0, "logo_atelier47.png", "exact center, 560px wide", "fade in + scale 95% to 100% over 0.6s, one gold shimmer sweep at 46.0s"),
    O(45.6, 50.0, "ABONNEZ-VOUS", f"{FONT} Bold, gold {GOLD}, 72px, 150px below the logo",
      "letters pop in one by one with a gold light sweep and soft glow, gentle pulse on the beat"),
    O(46.0, 50.0, HANDLE, f"{FONT} Medium, cream {CREAM}, 40px, under ABONNEZ-VOUS", "fade in 0.4s"),
    O(46.4, 50.0, f"{ADDR}, {CITY}", f"{FONT} Regular, cream {CREAM}, 36px", "fade in 0.4s"),
    O(46.8, 50.0, " / ".join(HOURS), f"{FONT} Medium, gold {GOLD}, 32px, three centered lines", "lines fade in one after another, 0.2s apart"),
    O(47.4, 50.0, f"{LINE}", f"{FONT} Light, cream {CREAM} at 70% opacity, 24px, letter spacing +200, just above the bottom safe zone",
      "fade in 0.5s, discreet signature"),
]

PRODUCTION = [
    "Same salon in every shot: identical layout, materials, plants and light (generate the wide shots from one reference image of the salon).",
    "The first frame is already moving with the logo visible: no black or still opening.",
    "Every cut lands exactly on a beat of the music.",
    "Speed ramps on every transition: the shot accelerates just before the cut (100% to 200%) and slows down at the start of the next one.",
    "Transition effects: zoom-in and pull-back with strong motion blur, whip-pans, push-ins through the TV, the price list frame and the phone, "
    "2-frame white-gold flashes, warm gold light leaks, a 3-frame camera shake on the bass drop, blur dissolves.",
    "Product close-ups are the highlight: perfect focus, controlled reflections, premium macro quality, slowed to 70-80% with optical-flow smoothing.",
    "One identical color grade on every shot.",
    "The phone and Instagram sequence (shots 16-18) is mandatory and must never be cut or shortened.",
    "The Instagram moment is perfectly clear: the phone screen is large, steady and sharp, ABONNEZ-VOUS stays readable for the whole 5.5 seconds.",
    "The ending fades to black and loops seamlessly back to the night façade of the first shot.",
]

AUDIO = ("Dark luxury deep-house instrumental, no vocals, heavy bass drop at 3.5s, fade out over the last 2 seconds. Layered sound design: night "
         "street ambience and the door opening, a deep impact on the drop, metallic clicks on the product flashes, the razor ring, a whoosh on every "
         "zoom, pull-back and whip-pan, muffled stadium crowd and game sounds from the TV in the lounge shots, a soft beep from the card terminal, "
         "a smooth slide when the phone rises, a bright notification ding when ABONNEZ-VOUS appears, a warm low boom under the final logo.")

DURATION = SHOTS[-1]["b"]

# ---------------------------------------------------------------- outputs
def tfr(x):
    m, s = divmod(x, 60)
    return f"{int(m)}:{s:04.1f}".replace(".", ",")

def ts(x):
    return f"{x:.1f}s"

IG_SCREEN = ("Its screen shows the ATELIER 47 BARBIER Instagram profile: the round gold-and-black logo as avatar, the name "
             "'atelier47barbier', a grid of nine black-and-gold photos of the salon and products, and a gold 'S'abonner' button that glows and "
             "switches to 'Abonné'; every element clearly readable")
GREEN_SCREEN = ("Its screen is a uniform, evenly lit pure green (#00FF00) chroma-key screen with no image, no text and no reflection, "
                "so a real screenshot can be keyed onto it in editing (this green is allowed in this shot only)")

def subj(s, master=False):
    return s["subject"].replace("SCREEN", IG_SCREEN if master else GREEN_SCREEN)

def shot_prompt(s):
    extra = ""
    if s["a"] == SHOTS[-1]["a"]:
        extra = " Keep the area below the logo dark and empty for text added in editing."
    setting = SET_WIDE if s["scale"] == "wide" else SET_CLOSE
    prod = f" {PRODUCTS}" if "TIM DESIGN" in s["subject"] else ""
    if "PlayStation" in s["subject"] and TV not in s["subject"]:
        prod += " " + TV
    return (f"{subj(s).rstrip('.')}. Camera: {s['camera']}. Motion: {s['motion']}.{extra} Vertical 9:16. "
            f"{REALISM_SHORT} {PALETTE} {LIGHT} {setting}{prod}")

def master_prompt():
    L = [f"Create a {DURATION:.0f}-second vertical 9:16 video (1080x1920, 30 fps): a cinematic commercial for {SALON}, a luxury barbershop at "
         f"{ADDR}, {CITY}, for an Instagram Reel. Make it as realistic as humanly possible.",
         "", "LOOK: " + REALISM, "",
         f"BRAND: the salon is {SALON}; its logo is {LOGO}. {PRODUCTS} {PALETTE} All on-screen text uses the font {FONT}: main text in gold "
         f"{GOLD} capitals with wide letter spacing, secondary text in cream {CREAM}.",
         "", "SET: " + SET + " " + TV, "", "LIGHT AND GRADE: " + LIGHT, "",
         "PRODUCTION RULES:"] + [f"- {r}" for r in PRODUCTION] + ["", "SHOT LIST:"]
    for i, s in enumerate(SHOTS, 1):
        ins = " (insert the real image fiche_tarifs.jpg here, do not generate it)" if not s["gen"] else ""
        L.append(f"{i}. {ts(s['a'])}-{ts(s['b'])} [{s['scale'].upper()}] {subj(s, True).rstrip('.')}{ins}. Camera: {s['camera']}. "
                 f"Motion: {s['motion']}. Transition out: {s['tr']}.")
    L += ["", "ON-SCREEN TEXT AND EFFECTS:"]
    for o in OVERLAYS:
        L.append(f"- {ts(o['a'])}-{ts(o['b'])}: {o['what']} ({o['style']}; {o['effect']}).")
    L += ["", "AUDIO: " + AUDIO, "",
          "AVOID: " + negative("ATELIER 47 BARBIER, TIM DESIGN, the price list, ABONNEZ-VOUS, S'abonner, the address, the opening hours and the Instagram handle") + "."]
    return "\n".join(L)

def write_files():
    master = master_prompt()
    (ROOT / "PROMPT_COMPLET.md").write_text(
        f"# Prompt complet — reel {SALON}\n\nLe prompt entier, à coller d'un coup dans un outil qui accepte un long texte.\n\n```\n" + master + "\n```\n")

    md = ["# Prompts plan par plan", "",
          "Pour les générateurs qui font des clips de 5 à 10 s (Google Flow, Dreamina, Kling…). Réglages : **9:16**, durée la plus courte, qualité maximale. "
          "Nomme chaque vidéo `shot_XX.mp4`. Les textes (adresse, horaires, ABONNEZ-VOUS, pseudo) s'ajoutent au montage, pas ici.", "",
          "**Astuce cohérence :** génère d'abord le shot_06 (vue d'ensemble). Fais une capture de la meilleure image, puis génère les autres vues "
          "larges en mode « image vers vidéo » avec cette capture comme référence.", "",
          "**Negative prompt (le même pour tous les plans) :**", "", "```", negative(), "```", ""]
    for i, s in enumerate(SHOTS, 1):
        md += [f"## shot_{i:02d} — {s['fr']} ({tfr(s['a'])} → {tfr(s['b'])})", ""]
        if s["gen"]:
            md += ["```", shot_prompt(s), "```", ""]
        if s["note"]:
            md += [f"> {s['note']}", ""]
    (ROOT / "PROMPTS_PAR_PLAN.md").write_text("\n".join(md))

    src = {
        "format": {"aspect_ratio": "9:16", "resolution": "1080x1920", "fps": 30, "duration_seconds": DURATION,
                   "use": f"Instagram Reel for {SALON}, Annecy"},
        "brand": {"salon": SALON, "logo": LOGO, "logo_file": "assets/logo_atelier47.png", "product_line": LINE, "colors": COLORS,
                  "font": FONT, "address": f"{ADDR}, {CITY}", "instagram": HANDLE, "hours": HOURS,
                  "price_list_file": "assets/fiche_tarifs.jpg", "price_list": PRICES},
        "global_style": {"realism": REALISM, "palette": PALETTE, "lighting_and_grade": LIGHT, "set": SET, "tv": TV, "products": PRODUCTS},
        "production_rules": PRODUCTION,
        "shots": [{"id": i, "file": f"shot_{i:02d}.mp4" if s["gen"] else "assets/fiche_tarifs.jpg", "time": f"{s['a']}-{s['b']}s",
                   "scale": s["scale"], "label_fr": s["fr"], "subject": s["subject"], "camera": s["camera"], "motion": s["motion"],
                   "transition_out": s["tr"], "generate": s["gen"], **({"note_fr": s["note"]} if s["note"] else {})}
                  for i, s in enumerate(SHOTS, 1)],
        "on_screen_text": OVERLAYS, "audio": AUDIO, "negative_prompt": negative(),
    }
    (ROOT / "reel_barbershop.json").write_text(json.dumps(src, indent=2, ensure_ascii=False) + "\n")

    montage = {
        "project": {"name": f"{SALON} - Reel", "resolution": "1080x1920", "fps": 30, "duration_seconds": DURATION,
                    "export": {"container": "mp4", "video_codec": "H.264 High", "bitrate_mbps": 20, "audio": "AAC 320 kbps",
                               "file_name": "atelier47_reel.mp4"}},
        "brand": {"colors": COLORS, "font": FONT,
                  "assets": {"logo": "assets/logo_atelier47.png (black background: use the Screen blend mode or remove the black)",
                             "price_list": "assets/fiche_tarifs.jpg (shot 14, full screen)",
                             "instagram_screenshot": "instagram_screenshot.png (real screenshot of the @atelier47barbier profile)"}},
        "global_rules": [
            "never show a person in the salon; reject any clip with a person, hand or face (game players on the TV are fine)",
            "cut on the beat; alternate close-ups and wide shots exactly as listed",
            "upscale every clip to 1080x1920 (CapCut: Enhance quality) and trim the first and last 5 frames of each generated clip",
            "speed ramps on every transition: 100% -> 200% in the last 6 frames of the outgoing shot, 200% -> 100% in the first 6 frames of the next",
            "product close-ups (shots 3-6, 11, 12, 21) slowed to 70-80% with optical-flow interpolation",
            "keep all text inside the Instagram safe zone: 250px top, 420px bottom, 140px right, 80px left",
            f"text only in gold {GOLD} or cream {CREAM}, font {FONT}",
            "shots 16-18 (phone + Instagram + ABONNEZ-VOUS) are MANDATORY: never remove or shorten them",
            "shots 16-17: key out the green phone screen (Chroma key) and place instagram_screenshot.png on it, scaled and keyframed to follow the screen",
            "the last frame fades to black so the reel loops cleanly into the first shot",
        ],
        "color_grade": {"apply_to": "all clips identically (grade one clip, copy the settings to all)", "contrast": "+15",
                        "saturation": "-10 (keep plant and pitch greens natural)", "temperature": "+8 warm", "shadows": "toward #111111",
                        "highlights": "warm gold, soft roll-off", "vignette": "-15", "grain": "5%"},
        "timeline": [{"clip": f"shot_{i:02d}.mp4" if s["gen"] else "assets/fiche_tarifs.jpg", "in": s["a"], "out": s["b"],
                      "scale": s["scale"], "content": s["fr"], "transition_out": s["tr"]} for i, s in enumerate(SHOTS, 1)],
        "text_overlays": OVERLAYS,
        "audio": {"music": "dark luxury deep-house instrumental, no vocals, bass drop at 3.5s, fade out over the last 2s, -14 LUFS",
                  "sfx": [[0.0, "night street ambience + door opening"], [3.5, "deep impact on the drop"], [3.5, "metallic click"],
                          [4.3, "razor ring"], [7.9, "whoosh"], [9.9, "reverse whoosh"], [10.0, "muffled stadium crowd + game sounds from the TV, low"],
                          [12.4, "whoosh into the TV"], [13.9, "whip-pan whoosh"], [15.9, "whoosh"], [17.9, "reverse whoosh"],
                          [20.8, "card terminal beep"], [22.4, "whoosh into the frame"], [25.4, "gold flash shimmer"],
                          [25.5, "smooth mechanical slide"], [26.0, "notification ding"], [33.4, "whip-pan whoosh"],
                          [35.4, "reverse whoosh"], [41.9, "reverse whoosh"], [44.5, "warm low boom"]]},
        "final_checks": [f"duration {DURATION}s", "no person in the salon", "ATELIER 47 and TIM DESIGN spelled correctly everywhere",
                         "prices, address, hours, ABONNEZ-VOUS and handle readable and inside the safe zone", "cuts on the beat",
                         "same salon layout in every wide shot", "the ending loops cleanly into the start"],
    }
    mj = json.dumps(montage, indent=2, ensure_ascii=False)
    (ROOT / "montage_ia.json").write_text(mj + "\n")
    gen_count = sum(s["gen"] for s in SHOTS)
    (ROOT / "PROMPT_MONTAGE.md").write_text(
        "# Prompt à coller dans l'IA de montage\n\n"
        f"Colle le texte sous la ligne avec tes {gen_count} vidéos `shot_XX.mp4`, `assets/logo_atelier47.png`, `assets/fiche_tarifs.jpg` "
        "et `instagram_screenshot.png`.\n\n---\n\n"
        f"Tu es un monteur vidéo professionnel spécialisé dans les publicités de luxe pour Instagram. Monte un Reel vertical de {DURATION:.0f} secondes "
        f"pour le salon {SALON} (Annecy) en suivant EXACTEMENT la fiche JSON ci-dessous : ordre, durées, transitions et leurs effets, rampes de vitesse, "
        "étalonnage, textes et leurs animations, police, couleurs, son et export. Aucune personne dans le salon. Coupe sur le temps. "
        "Signale tout plan défectueux au lieu de le garder.\n\n```json\n" + mj + "\n```\n")
    return master

def write_page(path, master):
    labels = {"wide": "Vue large", "close": "Gros plan", "medium": "Plan moyen"}
    cards = []
    for i, s in enumerate(SHOTS, 1):
        n = f"{i:02d}"
        tags = []
        if s["prio"]: tags.append('<span class="tag tag-prio">À faire en premier</span>')
        if not s["gen"]: tags.append('<span class="tag tag-prio">Ne pas générer</span>')
        if "'TIM DESIGN'" in s["subject"]: tags.append('<span class="tag">Vérifie « TIM DESIGN »</span>')
        if "ATELIER 47 BARBIER logo" in s["subject"]: tags.append('<span class="tag">Vérifie le logo</span>')
        tags.append(f'<span class="tag">{labels[s["scale"]]}</span>')
        name = f"shot_{n}.mp4" if s["gen"] else "fiche_tarifs.jpg"
        body = (f'<pre class="prompt" id="p-{n}">{html.escape(shot_prompt(s))}</pre>\n  '
                f'<button class="copy" type="button" data-target="p-{n}">Copier le prompt</button>') if s["gen"] else ""
        note = f'<p class="note">{html.escape(s["note"])}</p>' if s["note"] else ""
        cards.append(f'''<article class="shot">
  <header class="shot-head">
    <label class="done"><input type="checkbox" id="done-{n}" data-shot="{n}"><span class="box" aria-hidden="true"></span><span class="sr">Plan terminé</span></label>
    <div class="shot-title"><p class="file">{name} · {tfr(s['a'])} → {tfr(s['b'])}</p><h3>{html.escape(s['fr'])}</h3><div class="tags">{"".join(tags)}</div></div>
  </header>
  {note}
  {body}
</article>''')
    fill = "".join(f"<code>{html.escape(x)}</code>" for x in [SALON, ADDR, CITY, HANDLE, FONT] + HOURS[:2])
    tpl = (ROOT / "tools" / "page_template.html").read_text()
    page = (tpl.replace("{{MASTER}}", html.escape(master)).replace("{{NEG}}", html.escape(negative()))
               .replace("{{CARDS}}", "\n".join(cards)).replace("{{COUNT}}", str(len(SHOTS)))
               .replace("{{GEN}}", str(sum(s["gen"] for s in SHOTS)))
               .replace("{{DURATION}}", f"{DURATION:.0f}").replace("{{FILL}}", fill))
    Path(path).write_text(page)

if __name__ == "__main__":
    prev = 0.0
    for s in SHOTS:
        assert abs(s["a"] - prev) < 1e-9, f"gap at {prev}"
        assert s["b"] > s["a"]
        prev = s["b"]
    for o in OVERLAYS:
        assert 0 <= o["a"] < o["b"] <= DURATION, o
    m = write_files()
    if len(sys.argv) > 1:
        write_page(sys.argv[1], m)
    print("ok", len(SHOTS), "shots,", prev, "s,", len(m), "chars in master prompt")
