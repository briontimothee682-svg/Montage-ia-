"""Printed items of the reel, rendered from brand.json: price poster, business card (front/back + foil and
deboss masks), bottle and jar labels, Instagram post thumbnails background art.
Usage: python3 tools/laperetik/print.py   ->  assets/laperetik/tex/*.png"""
import json, sys
from pathlib import Path

import numpy as np
import segno
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from textures import fbm, dots, lerpc, TEX  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / "assets/laperetik/fonts"
B = json.loads((Path(__file__).resolve().parent / "brand.json").read_text())

ESPRESSO = (58, 42, 31); GOLD = (201, 161, 91); CARAMEL = (168, 120, 76); CREAM = (244, 236, 223); INK = (21, 21, 21)
BIRCH = (216, 185, 138)


def F(name, size):
    return ImageFont.truetype(str(FONTS / f"{name}.ttf"), size)


def ctext(d, xy, s, font, fill, anchor="mm", tracking=0):
    if not tracking:
        d.text(xy, s, font=font, fill=fill, anchor=anchor); return
    w = sum(font.getlength(c) for c in s) + tracking * (len(s) - 1)
    x = xy[0] - (w / 2 if anchor[0] == "m" else 0 if anchor[0] == "l" else w)
    for c in s:
        d.text((x, xy[1]), c, font=font, fill=fill, anchor="l" + anchor[1]); x += font.getlength(c) + tracking


def fit(s, name, size, max_w, tracking=0):
    while size > 10:
        f = F(name, size)
        if f.getlength(s) + tracking * (len(s) - 1) <= max_w: return f
        size -= 2
    return F(name, size)


def logo(size, color=INK):
    m = Image.open(TEX / "logo_mask.png").resize((size, size), Image.LANCZOS)
    im = Image.new("RGBA", (size, size), (*color, 0)); im.putalpha(m)
    return im


def kraft(w, h, seed=1):
    n = fbm(h, w, seed, (4, 4), 5); fib = fbm(h, w, seed + 1, (2, 60), 3)
    col = lerpc((206, 168, 118), (176, 134, 88), n * 0.7 + fib * 0.3)
    fl = dots(h, w, int(w * h / 900), 0.5, 1.6, seed + 2, 0.4)
    col = col * (1 - 0.3 * fl[..., None]) + np.array([120, 90, 60]) * 0.3 * fl[..., None]
    return Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def paper(w, h, base=(246, 240, 228), seed=3, amt=0.05):
    n = fbm(h, w, seed, (6, 6), 5); f2 = fbm(h, w, seed + 1, (60, 60), 2)
    col = np.array(base, np.float32)[None, None, :] * (1 - amt + amt * 2 * (0.6 * n + 0.4 * f2))[..., None]
    return Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def price(v):
    return f"{v} €"


# ------------------------------------------------------------------ price poster (40 x 60 cm)
def poster():
    W, H = 1200, 1800
    im = kraft(W, H, 11)
    d = ImageDraw.Draw(im)
    pad = 70
    panel = paper(W - 2 * pad, H - 2 * pad, (246, 238, 222), 12, 0.04)
    im.alpha_composite(panel, (pad, pad))
    d.rectangle((pad + 22, pad + 22, W - pad - 22, H - pad - 22), outline=GOLD, width=6)
    d.rectangle((pad + 36, pad + 36, W - pad - 36, H - pad - 36), outline=GOLD, width=2)
    lg = logo(300, INK); im.alpha_composite(lg, ((W - 300) // 2, 150))
    ctext(d, (W / 2, 520), "NOS BOX & COFFRETS", F("Oswald-600", 54), CARAMEL, tracking=6)
    d.line((W / 2 - 220, 570, W / 2 + 220, 570), fill=GOLD, width=3)
    rows = [("BOX APÉRO", f"dès {price(B['prices']['box'])}"),
            ("Coffrets cadeaux S · L · XL", price(B['prices']['coffrets'])),
            ("Bières & vins locaux", f"dès {price(B['prices']['boissons'])}")]
    y = 690
    for i, (a, b) in enumerate(rows):
        fa = fit(a, "Oswald-700", 112 if i == 0 else 82, W - 2 * pad - 140)
        ctext(d, (W / 2, y), a, fa, ESPRESSO)
        ctext(d, (W / 2, y + (118 if i == 0 else 100)), b, F("PlayfairDisplay-900", 104 if i == 0 else 88), GOLD)
        y += 330
        if i < 2:
            d.line((W / 2 - 60, y - 75, W / 2 + 60, y - 75), fill=CARAMEL, width=3)
    ctext(d, (W / 2, H - 205), "Chassez le naturel, il revient à l'apéro", F("PlayfairDisplay-400i", 46), ESPRESSO)
    ctext(d, (W / 2, H - 140), "PRODUITS LOCAUX · CIRCUIT COURT", F("Oswald-500", 34), CARAMEL, tracking=5)
    im.convert("RGB").save(TEX / "poster.png"); print("poster")


# ------------------------------------------------------------------ business card 85 x 55 mm
CW, CH = 1700, 1100


def card_front():
    col = paper(CW, CH, (247, 242, 232), 21, 0.035)
    ink = Image.new("RGBA", (CW, CH), (0, 0, 0, 0)); foil = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    deb = Image.new("L", (CW, CH), 0)
    lg = logo(560, INK); x0, y0 = 120, (CH - 560) // 2 - 20
    ink.alpha_composite(lg, (x0, y0)); deb.paste(255, (x0, y0), lg.getchannel("A"))
    d = ImageDraw.Draw(ink); df = ImageDraw.Draw(foil)
    tx = 790
    d.text((tx, 300), "L'APÉRETIK", font=F("PlayfairDisplay-800", 118), fill=ESPRESSO, anchor="ls")
    ctext(d, (tx, 370), "CHASSEZ LE NATUREL, IL REVIENT À L'APÉRO", F("Oswald-500", 30), CARAMEL, anchor="ls", tracking=2.5)
    df.line((tx, 420, CW - 120, 420), fill=(*GOLD, 255), width=5)
    addr = f"{B['street_number']} {B['street']}"
    d.text((tx, 520), addr, font=fit(addr, "Inter-600", 50, CW - tx - 110), fill=ESPRESSO, anchor="ls")
    d.text((tx, 588), B["city"], font=F("Inter-500", 46), fill=ESPRESSO, anchor="ls")
    d.text((tx, 690), B["hours"], font=fit(B["hours"], "Inter-500", 42, CW - tx - 110), fill=CARAMEL, anchor="ls")
    d.text((tx, 790), B["handle"], font=F("Inter-600", 44), fill=ESPRESSO, anchor="ls")
    df.rectangle((40, 40, CW - 40, CH - 40), outline=(*GOLD, 255), width=4)
    col.alpha_composite(ink); col.alpha_composite(foil)
    col.convert("RGB").save(TEX / "card_front.png")
    foil.getchannel("A").save(TEX / "card_front_foil.png")
    deb.filter(ImageFilter.GaussianBlur(3)).save(TEX / "card_front_deboss.png")
    print("card front")


def card_back():
    n = fbm(CH, CW, 31, (2, 10), 5); fib = fbm(CH, CW, 32, (3, 80), 3)
    k = 0.5 + 0.5 * np.sin((np.arange(CH)[:, None] / CH * 9 + (n - 0.5) * 2.5) * np.pi * 2)
    arr = lerpc((66, 47, 34), (44, 31, 23), k * 0.5 + fib * 0.5)
    col = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    ink = Image.new("RGBA", (CW, CH), (0, 0, 0, 0)); foil = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    d = ImageDraw.Draw(ink); df = ImageDraw.Draw(foil)
    df.rectangle((40, 40, CW - 40, CH - 40), outline=(*GOLD, 255), width=4)
    q = segno.make(B["qr_url"], error="m"); mat = np.array([[int(v) for v in r] for r in q.matrix])
    n_ = mat.shape[0]; box = 520; quiet = 2; cell = box // (n_ + 2 * quiet)
    qs = cell * (n_ + 2 * quiet); qx, qy = (CW - qs) // 2, 250
    d.rounded_rectangle((qx - 24, qy - 24, qx + qs + 24, qy + qs + 24), radius=26, fill=CREAM)
    for yy in range(n_):
        for xx in range(n_):
            if mat[yy, xx]:
                d.rectangle((qx + (xx + quiet) * cell, qy + (yy + quiet) * cell, qx + (xx + quiet + 1) * cell - 1, qy + (yy + quiet + 1) * cell - 1), fill=ESPRESSO)
    ctext(df, (CW / 2, 160), "SCANNEZ POUR NOUS TROUVER", F("Oswald-600", 64), (*GOLD, 255), tracking=4)
    ctext(d, (CW / 2, qy + qs + 120), "Produits locaux · Box apéro · Bières & vins", F("PlayfairDisplay-400i", 54), CREAM)
    df.line((CW / 2 - 180, qy + qs + 190, CW / 2 + 180, qy + qs + 190), fill=(*GOLD, 255), width=4)
    col.alpha_composite(ink); col.alpha_composite(foil)
    col.convert("RGB").save(TEX / "card_back.png"); foil.getchannel("A").save(TEX / "card_back_foil.png")
    print("card back")


# ------------------------------------------------------------------ labels
def mountains(d, cx, cy, w, h, fill, width=5):
    pts = [(-0.5, 0.3), (-0.32, -0.15), (-0.2, 0.08), (-0.02, -0.5), (0.12, -0.12), (0.22, -0.3), (0.5, 0.3)]
    d.line([(cx + x * w, cy + y * h) for x, y in pts], fill=fill, width=width, joint="curve")
    d.line([(cx - 0.08 * w, cy - 0.28 * h), (cx - 0.02 * w, cy - 0.5 * h), (cx + 0.05 * w, cy - 0.3 * h)], fill=fill, width=width)


def labels():
    W, H = 1024, 768
    im = kraft(W, H, 41); d = ImageDraw.Draw(im)
    d.rounded_rectangle((150, 70, W - 150, H - 70), radius=60, fill=CREAM, outline=GOLD, width=8)
    mountains(d, W / 2, 230, 360, 150, ESPRESSO, 7)
    ctext(d, (W / 2, 390), "BIÈRE BLONDE", F("Oswald-700", 104), ESPRESSO, tracking=3)
    ctext(d, (W / 2, 480), "artisanale & locale", F("PlayfairDisplay-400i", 60), CARAMEL)
    ctext(d, (W / 2, 600), "33 cl · 5 % vol.", F("Oswald-500", 42), ESPRESSO, tracking=3)
    im.convert("RGB").save(TEX / "label_beer.png")
    im = Image.new("RGB", (1024, 160), ESPRESSO); d = ImageDraw.Draw(im)
    ctext(d, (512, 80), "BLONDE · BLONDE · BLONDE", F("Oswald-600", 70), GOLD, tracking=8)
    im.save(TEX / "label_beer_neck.png")
    W, H = 1024, 1024
    im = paper(W, H, (240, 230, 210), 42, 0.06); d = ImageDraw.Draw(im)
    d.rectangle((120, 90, W - 120, H - 90), outline=ESPRESSO, width=4)
    d.rectangle((140, 110, W - 140, H - 110), outline=GOLD, width=2)
    # vine leaf ornament
    cx, cy = W / 2, 300
    for a in range(5):
        ang = np.radians(-90 + (a - 2) * 34)
        d.ellipse((cx + np.cos(ang) * 60 - 46, cy + np.sin(ang) * 60 - 46, cx + np.cos(ang) * 60 + 46, cy + np.sin(ang) * 60 + 46), fill=(120, 30, 40))
    ctext(d, (W / 2, 500), "Vin rouge", F("PlayfairDisplay-700i", 130), (90, 20, 30))
    ctext(d, (W / 2, 620), "SÉLECTION LOCALE", F("Oswald-600", 58), ESPRESSO, tracking=6)
    ctext(d, (W / 2, 760), "75 cl · 13 % vol.", F("Oswald-400", 40), ESPRESSO, tracking=3)
    im.convert("RGB").save(TEX / "label_wine.png")
    W, H = 1024, 512
    im = kraft(W, H, 43); d = ImageDraw.Draw(im)
    ctext(d, (W / 2, 190), "TERRINE", F("Oswald-700", 120), ESPRESSO, tracking=6)
    ctext(d, (W / 2, 310), "de campagne", F("PlayfairDisplay-400i", 76), CARAMEL)
    d.line((W / 2 - 150, 380, W / 2 + 150, 380), fill=GOLD, width=5)
    im.convert("RGB").save(TEX / "label_terrine.png")
    print("labels")


def qr_json():
    q = segno.make(B["qr_url"], error="m")
    mat = [[int(v) for v in r] for r in q.matrix]
    (TEX / "qr.json").write_text(json.dumps({"url": B["qr_url"], "n": len(mat), "m": mat}))
    print("qr", len(mat))


if __name__ == "__main__":
    poster(); card_front(); card_back(); labels(); qr_json()
