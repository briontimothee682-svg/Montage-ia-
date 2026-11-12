"""Shared timeline of the NOCTA commercial (45 s, 9:16, 24 fps).

The music is 130.17 BPM: 16 bars fit exactly between the drop (11.5 s, the camera passes
through the window) and the white strobe flash (41.0 s), and the final bass hit lands one bar
later (42.84 s). Every camera-driven transition sits on a bar or half bar of that grid.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / "assets" / "fonts"
OUT = ROOT / "exports" / "nocta"
CLIPS = ROOT / "nocta" / "clips"

W, H, FPS = 1080, 1920, 24
DUR = 45.0
SR = 48000

DROP = 11.5                    # camera passes through the window, the track drops
FLASH = 41.0                   # white strobe flash, flyer starts
BAR = (FLASH - DROP) / 16      # 1.84375 s
BEAT = BAR / 4                 # 0.4609 s
BPM = 60 / BEAT                # 130.17
FINAL_HIT = FLASH + BAR        # 42.84 s, last bass hit, the logo pulses
NOTIF = 2.5                    # the four phones light up at the same time


def bar(n):
    """time of bar n of the grid (bar 0 = the drop)"""
    return DROP + n * BAR


# id, start, end, title, what has to be seen (French, shown on the animatic placeholders)
SEGMENTS = [
    ("01",  0.0,       6.0,       "LA NOTIFICATION",   "Salon, les 4 amis sur leurs telephones. 2,5 s : les 4 ecrans s'allument en meme temps."),
    ("02",  6.0,       DROP - .5, "LES REGARDS",       "Ils baissent les telephones, se regardent, sourient. La camera monte vers la baie vitree."),
    ("03a", DROP - .5, bar(1),    "A TRAVERS LA VITRE", "Drone FPV : survole la table, traverse la vitre (11,5 s), plonge au-dessus des toits."),
    ("03b", bar(1),    bar(2),    "LA GOLF",           "Plonge vers la route, rattrape la Golf GTI noire, traverse le pare-brise."),
    ("04",  bar(2),    bar(5),    "POV CONDUCTEUR",    "Mains sur le volant VW, cockpit, route le long du lac d'Annecy."),
    ("05",  bar(5),    bar(7),    "PROFIL",            "Sort par la vitre passager, travelling bas, Golf de profil, reflets."),
    ("06",  bar(7),    bar(9.5),  "LE CLUB",           "Monte dans le ciel, revele la facade neon NOCTA, la file, les videurs."),
    ("07",  bar(9.5),  bar(13.5), "JUSQU'AU DJ",       "FPV : passe les videurs, la piste bondee, lasers, jusqu'au DJ mains en l'air."),
    ("08",  bar(13.5), FLASH,     "VIP",               "Les 4 amis dansent dans le carre VIP. Flash stroboscopique blanc a la fin."),
    ("09",  FLASH,     DUR,       "FLYER",             "Flyer anime NOCTA CLUB (rendu fourni)."),
]


def segment(seg_id):
    for s in SEGMENTS:
        if s[0] == seg_id:
            return s
    raise KeyError(seg_id)


if __name__ == "__main__":
    print(f"BPM {BPM:.2f}  bar {BAR:.4f}s  beat {BEAT:.4f}s  final hit {FINAL_HIT:.3f}s")
    for sid, a, b, title, _ in SEGMENTS:
        print(f"{sid:>4}  {a:6.2f} -> {b:6.2f}  ({b - a:4.2f}s)  {title}")
