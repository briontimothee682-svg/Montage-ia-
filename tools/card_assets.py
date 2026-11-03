"""Textures for the 3D business card (recto / verso, gold-foil metal masks) and the QR code matrix.
Usage: python3 tools/card_assets.py   -> exports/holo/card_*.png + qr.json"""
import json, sys
from pathlib import Path

import numpy as np
import segno
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import motion as m  # noqa: E402
from motion import GOLD, CREAM, MUTED, ADDRESS, HANDLE, text, icon  # noqa: E402

OUT = m.OUT / "holo"
CW, CH = 1720, 1114           # 2x of the 860 x 557 card (85 x 55 mm ratio)
QR_URL = "https://www.instagram.com/atelier47barbier/"
QR_CENTER, QR_SIZE = (1340, 500), 560
HOURS_CARD = ["Mardi – Vendredi · 9h – 19h", "Samedi · 9h – 18h", "Dimanche & lundi · fermé"]

def paper():
    rng = np.random.default_rng(5)
    base = np.full((CH, CW, 3), 12, np.float32)
    base += rng.normal(0, 2.2, (CH, CW, 1))
    y, x = np.mgrid[0:CH, 0:CW].astype(np.float32)
    base *= (1 - 0.18 * (((x - CW / 2) / CW) ** 2 + ((y - CH / 2) / CH) ** 2))[..., None]
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

def foil_border(layer):
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((40, 40, CW - 40, CH - 40), radius=36, outline=(*GOLD, 255), width=8)

def compose(ink, foil):
    """ink: printed (non metallic) RGBA layer, foil: gold foil RGBA layer -> colour map + metal mask."""
    col = paper()
    col.alpha_composite(ink)
    col.alpha_composite(foil)
    metal = foil.getchannel("A")
    return col.convert("RGB"), metal

def recto():
    ink = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    foil = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    foil_border(foil)
    lg = m.logo(820)
    arr = np.asarray(lg).astype(np.int16)
    gold = (arr[..., 0] - arr[..., 2] > 45) & (arr[..., 3] > 40)
    g_layer = np.asarray(lg).copy()
    g_layer[..., 3] = np.where(gold, g_layer[..., 3], 0)
    c_layer = np.asarray(lg).copy()
    c_layer[..., 3] = np.where(gold, 0, c_layer[..., 3])
    pos = ((CW - 820) // 2, (CH - 820) // 2)
    foil.alpha_composite(Image.fromarray(g_layer.astype(np.uint8), "RGBA"), pos)
    ink.alpha_composite(Image.fromarray(c_layer.astype(np.uint8), "RGBA"), pos)
    return compose(ink, foil)

def qr_matrix():
    q = segno.make(QR_URL, error="m")
    return [[int(v) for v in row] for row in q.matrix]

def verso(mat):
    ink = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    foil = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    foil_border(foil)
    text(foil, "ATELIER 47 BARBIER", "Bold", 62, 110, 170, "gold", anchor="left", tracking=4)
    d = ImageDraw.Draw(foil)
    d.line((110, 230, 860, 230), fill=(*GOLD, 255), width=3)
    pin = icon("pin", 64, GOLD, 6)
    foil.alpha_composite(pin, (110, 300))
    text(ink, ADDRESS, "SemiBold", 52, 200, 316, CREAM, anchor="left")
    text(ink, "74000 Annecy", "Medium", 44, 200, 378, CREAM, anchor="left")
    clk = icon("clock", 64, GOLD, 6, 25)
    foil.alpha_composite(clk, (110, 488))
    for k, line in enumerate(HOURS_CARD):
        text(ink, line, "Medium", 42, 200, 504 + k * 62, CREAM, anchor="left")
    text(foil, HANDLE, "SemiBold", 50, 110, 800, "gold", anchor="left")
    text(ink, "Coupe nette · Barbe soignée", "Regular", 36, 110, 864, CREAM, anchor="left")
    # printed QR on a cream plate (the 3D one rises from here)
    n = len(mat) + 8
    cell = QR_SIZE / n
    x0, y0 = QR_CENTER[0] - QR_SIZE / 2, QR_CENTER[1] - QR_SIZE / 2
    dd = ImageDraw.Draw(ink)
    dd.rounded_rectangle((x0 - 10, y0 - 10, x0 + QR_SIZE + 10, y0 + QR_SIZE + 10), radius=26, fill=(214, 207, 192, 255))
    for r, row in enumerate(mat):
        for c, v in enumerate(row):
            if v:
                xx, yy = x0 + (c + 4) * cell, y0 + (r + 4) * cell
                dd.rectangle((xx, yy, xx + cell + 0.5, yy + cell + 0.5), fill=(17, 17, 17, 255))
    d.rounded_rectangle((x0 - 22, y0 - 22, x0 + QR_SIZE + 22, y0 + QR_SIZE + 22), radius=32, outline=(*GOLD, 255), width=4)
    text(foil, "SCANNE-MOI", "Bold", 40, QR_CENTER[0], y0 + QR_SIZE + 76, "gold", tracking=8)
    return compose(ink, foil)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    mat = qr_matrix()
    for name, (col, metal) in [("recto", recto()), ("verso", verso(mat))]:
        col.save(OUT / f"card_{name}.png")
        metal.save(OUT / f"card_{name}_metal.png")
        metal.filter(ImageFilter.GaussianBlur(1.5)).save(OUT / f"card_{name}_bump.png")
        mk = np.asarray(metal).astype(np.float32) / 255
        Image.fromarray((255 * (0.78 * (1 - mk) + 0.22 * mk)).astype(np.uint8), "L").save(OUT / f"card_{name}_rough.png")
    (OUT / "qr.json").write_text(json.dumps({"url": QR_URL, "matrix": mat, "center": QR_CENTER, "size": QR_SIZE,
                                             "card": [CW, CH]}))
    print("qr", len(mat), "modules,", sum(map(sum, mat)), "dark")

if __name__ == "__main__":
    main()
