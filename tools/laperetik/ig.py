"""Full-frame Instagram (mobile) UI drawn over the reel once we are 'inside' the screen (25.4 - 34 s):
the Reel playing with its overlay and a double-tap like, a tap on the account, the profile page sliding in,
the follow, a scroll through the grid, and a tap on a post that opens into the next shot (the price poster).
"""
import json, math
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / "assets/laperetik/fonts"
TEX = ROOT / "assets/laperetik/tex"
F3D = ROOT / "exports/laperetik_work/f3d"
B = json.loads((Path(__file__).resolve().parent / "brand.json").read_text())
W, H, FPS = 1080, 1920, 24
ESP = (58, 42, 31); GOLD = (201, 161, 91); CAR = (168, 120, 76); CREAM = (244, 236, 223); BG = (255, 250, 243); LIGHT = (239, 230, 216)
RED = (224, 48, 58); MUTED = (140, 124, 108)

T_IN, LIKE, TAP_USER, SLIDE0, SLIDE1, FOLLOW, SCROLL0, SCROLL1, TAP_TILE, OPEN0, OPEN1 = 25.4, 25.95, 27.75, 28.2, 28.8, 30.8, 31.25, 32.15, 32.55, 32.7, 34.0


def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def prog(t, a, b): return clamp((t - a) / (b - a))
def ease(p): return 4 * p ** 3 if p < 0.5 else 1 - (-2 * p + 2) ** 3 / 2
def ease_out(p): return 1 - (1 - p) ** 3
def ease_back(p, s=1.7): p -= 1; return 1 + (s + 1) * p ** 3 + s * p ** 2
def lerp(a, b, p): return a + (b - a) * p


@lru_cache(maxsize=None)
def F(name, size): return ImageFont.truetype(str(FONTS / f"{name}.ttf"), size)


@lru_cache(maxsize=None)
def logo_rgba(size, color=(21, 21, 21)):
    m = Image.open(TEX / "logo_mask.png").resize((size, size), Image.LANCZOS)
    im = Image.new("RGBA", (size, size), (*color, 0)); im.putalpha(m); return im


@lru_cache(maxsize=None)
def frame_crop(fi, aspect, w):
    """centre crop of a rendered 3D frame (real content for the grid and the highlights)"""
    im = Image.open(F3D / f"f{fi:04d}.png").convert("RGB")
    ch = int(W / aspect) if W / aspect <= H else H
    cw = int(ch * aspect)
    x0, y0 = (W - cw) // 2, (H - ch) // 2
    return im.crop((x0, y0, x0 + cw, y0 + ch)).resize((w, int(w / aspect)), Image.LANCZOS)


def circle_img(src, d):
    im = src.resize((d, d), Image.LANCZOS).convert("RGBA")
    m = Image.new("L", (d * 4, d * 4), 0); ImageDraw.Draw(m).ellipse((0, 0, d * 4 - 1, d * 4 - 1), fill=255)
    im.putalpha(m.resize((d, d), Image.LANCZOS)); return im


def heart_poly(cx, cy, s, n=80):
    pts = []
    for i in range(n):
        a = i / n * 2 * math.pi
        x = 16 * math.sin(a) ** 3
        y = 13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a)
        pts.append((cx + x * s / 16, cy - y * s / 16))
    return pts


def draw_heart(d, cx, cy, s, fill=None, outline=None, width=4):
    pts = heart_poly(cx, cy, s)
    if fill: d.polygon(pts, fill=fill)
    if outline: d.line(pts + [pts[0]], fill=outline, width=width, joint="curve")


def icon(d, name, x, y, s, col, w=4):
    if name == "comment":
        d.ellipse((x - s, y - s, x + s, y + s), outline=col, width=w); d.polygon([(x - s * 0.8, y + s * 0.5), (x - s * 1.05, y + s * 1.1), (x - s * 0.2, y + s * 0.92)], fill=col)
    elif name == "share":
        d.line([(x - s, y - s * 0.2), (x + s, y - s), (x + s * 0.2, y + s), (x - s * 0.05, y + s * 0.1), (x - s, y - s * 0.2)], fill=col, width=w, joint="curve")
        d.line([(x - s * 0.05, y + s * 0.1), (x + s, y - s)], fill=col, width=w)
    elif name == "more":
        for dx in (-s * 0.7, 0, s * 0.7): d.ellipse((x + dx - w, y - w, x + dx + w, y + w), fill=col)
    elif name == "back":
        d.line([(x + s * 0.4, y - s), (x - s * 0.5, y), (x + s * 0.4, y + s)], fill=col, width=w, joint="curve")
    elif name == "bell":
        d.arc((x - s * 0.8, y - s, x + s * 0.8, y + s * 0.8), 180, 360, fill=col, width=w)
        d.line([(x - s * 0.8, y - s * 0.1), (x - s * 0.8, y + s * 0.6), (x - s, y + s * 0.8), (x + s, y + s * 0.8), (x + s * 0.8, y + s * 0.6), (x + s * 0.8, y - s * 0.1)], fill=col, width=w)
        d.ellipse((x - s * 0.22, y + s * 0.85, x + s * 0.22, y + s * 1.25), fill=col)
    elif name == "grid":
        q = s * 0.62
        for gx in (-1, 0, 1):
            for gy in (-1, 0, 1): d.rectangle((x + gx * q - q * 0.42, y + gy * q - q * 0.42, x + gx * q + q * 0.42, y + gy * q + q * 0.42), outline=col, width=max(2, w - 1))
    elif name == "reels":
        d.rounded_rectangle((x - s, y - s, x + s, y + s), radius=s * 0.3, outline=col, width=w)
        d.polygon([(x - s * 0.3, y - s * 0.35), (x + s * 0.45, y), (x - s * 0.3, y + s * 0.35)], fill=col)
    elif name == "tag":
        d.rounded_rectangle((x - s, y - s, x + s, y + s), radius=s * 0.25, outline=col, width=w)
        d.ellipse((x - s * 0.35, y - s * 0.6, x + s * 0.35, y + s * 0.1), outline=col, width=w)
    elif name == "pin":
        d.ellipse((x - s * 0.6, y - s, x + s * 0.6, y + s * 0.2), outline=col, width=w)
        d.polygon([(x - s * 0.5, y - s * 0.2), (x, y + s), (x + s * 0.5, y - s * 0.2)], fill=col)
        d.ellipse((x - s * 0.2, y - s * 0.62, x + s * 0.2, y - s * 0.22), fill=BG)
    elif name == "check":
        d.line([(x - s, y), (x - s * 0.3, y + s * 0.7), (x + s, y - s * 0.7)], fill=col, width=w, joint="curve")


def shadow_text(d, xy, s, font, fill, anchor="la", sh=(0, 0, 0, 110)):
    d.text((xy[0] + 2, xy[1] + 3), s, font=font, fill=sh, anchor=anchor)
    d.text(xy, s, font=font, fill=fill, anchor=anchor)


# ------------------------------------------------------------------ the Reel overlay
def reel_overlay(t):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    a = int(255 * ease_out(prog(t, T_IN, T_IN + 0.35)))
    if a <= 0: return lay
    g = Image.new("L", (1, 400)); g.putdata([int(150 * (i / 399) ** 1.6) for i in range(400)])
    lay.paste(Image.new("RGBA", (W, 400), (18, 10, 6, 255)), (0, H - 760), g.resize((W, 400)))
    wh = (255, 255, 255, a)
    shadow_text(d, (70, 268), "Reels", F("Inter-700", 50), wh)
    # right column
    x0, y0 = 880, 1010
    liked = t >= LIKE
    pop = prog(t, LIKE, LIKE + 0.45)
    hs = 42 * (1 + 0.35 * math.sin(math.pi * pop) if 0 < pop < 1 else 1)
    if liked: draw_heart(d, x0, y0, hs, fill=(*RED, a))
    else: draw_heart(d, x0, y0, hs, outline=wh, width=5)
    shadow_text(d, (x0, y0 + 62), "2 418" if liked else "2 417", F("Inter-600", 30), wh, anchor="ma")
    icon(d, "comment", x0, y0 + 160, 34, wh, 5); shadow_text(d, (x0, y0 + 212), "186", F("Inter-600", 30), wh, anchor="ma")
    icon(d, "share", x0, y0 + 310, 34, wh, 5); shadow_text(d, (x0, y0 + 362), "97", F("Inter-600", 30), wh, anchor="ma")
    icon(d, "more", x0, y0 + 450, 30, wh, 6)
    # account + caption
    av = circle_img(Image.new("RGB", (8, 8), (255, 255, 255)), 76); lay.alpha_composite(av, (70, 1302))
    lay.alpha_composite(logo_rgba(66), (75, 1307))
    tap = prog(t, TAP_USER - 0.05, TAP_USER + 0.3)
    shadow_text(d, (166, 1318), "laperetik", F("Inter-700", 40), wh)
    d.rounded_rectangle((372, 1312, 512, 1370), radius=14, outline=wh, width=3)
    shadow_text(d, (442, 1325), "Suivre", F("Inter-600", 30), wh, anchor="ma")
    shadow_text(d, (70, 1410), "La Box Apéro · 100 % local", F("Inter-500", 36), wh)
    shadow_text(d, (70, 1462), "fromages · saucisson · jambon", F("Inter-400", 32), (255, 255, 255, int(a * 0.85)))
    d.ellipse((72, 1515, 96, 1539), fill=(255, 255, 255, int(a * 0.85)))
    shadow_text(d, (110, 1510), "Son original · laperetik", F("Inter-400", 30), (255, 255, 255, int(a * 0.85)))
    # double-tap: big heart in the middle
    if LIKE - 0.02 <= t < LIKE + 0.9:
        k = prog(t, LIKE, LIKE + 0.9)
        s = 210 * (ease_back(clamp(k * 3.2), 2.2) if k < 0.31 else 1.0 + 0.05 * (k - 0.31))
        al = 1 - prog(k, 0.6, 1.0)
        hl = Image.new("RGBA", (W, H), (0, 0, 0, 0)); hd = ImageDraw.Draw(hl)
        draw_heart(hd, W / 2, 900 - 60 * prog(k, 0.55, 1.0), s, fill=(255, 255, 255, int(235 * al)))
        draw_heart(hd, W / 2, 900 - 60 * prog(k, 0.55, 1.0), s * 0.9, fill=(*RED, int(245 * al)))
        sh = hl.getchannel("A").filter(ImageFilter.GaussianBlur(18)).point(lambda v: v * 0.4)
        shadow = Image.new("RGBA", (W, H), (40, 10, 10, 0)); shadow.putalpha(sh)
        lay.alpha_composite(shadow, (0, 12)); lay.alpha_composite(hl)
        rnd = np.random.default_rng(3)
        for i in range(16):
            ang = rnd.uniform(0, 2 * math.pi); r = (200 + rnd.uniform(0, 160)) * ease_out(clamp(k * 1.4))
            draw_heart(d, W / 2 + math.cos(ang) * r, 900 + math.sin(ang) * r, 22 + rnd.uniform(0, 16), fill=(*RED, int(220 * al)))
    if 0 < tap < 1: ripple(d, 230, 1340, tap)
    return lay


def ripple(d, x, y, k, col=(255, 255, 255)):
    r = 30 + 90 * ease_out(k)
    d.ellipse((x - r, y - r, x + r, y + r), outline=(*col, int(200 * (1 - k))), width=6)
    r2 = 24 * (1 - k * 0.5)
    d.ellipse((x - r2, y - r2, x + r2, y + r2), fill=(*col, int(140 * (1 - k))))


# ------------------------------------------------------------------ the profile page
TILES = [237, 300, 396, 816, 1100, 36, 1050, 1290, 130]     # rendered frames used as posts (816 = the price poster)
HIGH = [(372, "Fromages"), (396, "Saucisson"), (237, "La box"), (840, "Nos prix"), (1110, "Apéro")]
GRID_Y, TILE_W, TILE_H, GAP = 1262, 356, 474, 6
OPEN_TILE = 4          # index of the poster in TILES (row 2, middle)


def tile_rect(i, scroll):
    col, row = i % 3, i // 3
    return (col * (TILE_W + GAP), GRID_Y + row * (TILE_H + GAP) - scroll, TILE_W, TILE_H)


@lru_cache(maxsize=4)
def profile_base(followed):
    page = Image.new("RGBA", (W, H + 1200), (*BG, 255)); d = ImageDraw.Draw(page)
    icon(d, "back", 64, 250, 22, ESP, 5)
    d.text((118, 250), "laperetik", font=F("Inter-700", 46), fill=ESP, anchor="lm")
    icon(d, "bell", 900, 245, 24, ESP, 4); icon(d, "more", 1000, 250, 26, ESP, 6)
    # avatar with a warm story ring, logo in its own colours
    cx, cy, r = 178, 470, 128
    ring = Image.new("RGBA", (r * 2 + 24, r * 2 + 24), (0, 0, 0, 0)); rd = ImageDraw.Draw(ring)
    for i in range(12):
        c = tuple(int(lerp(a, b, i / 11)) for a, b in zip((233, 196, 119), (168, 102, 58)))
        rd.arc((i * 0.0, i * 0.0, r * 2 + 23, r * 2 + 23), -90 + i * 30, -90 + (i + 1) * 30 + 2, fill=c, width=10)
    page.alpha_composite(ring, (cx - r - 12, cy - r - 12))
    d.ellipse((cx - r + 4, cy - r + 4, cx + r - 4, cy + r - 4), fill=(255, 255, 255))
    page.alpha_composite(logo_rgba(2 * r - 34), (cx - r + 17, cy - r + 17))
    for x, n, l in [(495, "36", "publications"), (706, "1 249" if followed else "1 248", "followers"), (915, "182", "suivi(e)s")]:
        d.text((x, 440), n, font=F("Inter-700", 48), fill=ESP, anchor="ms")
        d.text((x, 492), l, font=F("Inter-400", 30), fill=ESP, anchor="ms")
    d.text((60, 652), "L'Apéretik", font=F("Inter-700", 38), fill=ESP, anchor="ls")
    d.text((60, 700), "Box apéro & produits locaux", font=F("Inter-400", 34), fill=ESP, anchor="ls")
    d.text((60, 746), "Chassez le naturel, il revient à l'apéro", font=F("Inter-400", 34), fill=ESP, anchor="ls")
    icon(d, "pin", 76, 778, 15, CAR, 4)
    d.text((104, 792), f"{B['street']} · {B['city']}", font=F("Inter-600", 32), fill=CAR, anchor="ls")
    # buttons
    if followed:
        d.rounded_rectangle((60, 846, 520, 932), radius=18, fill=LIGHT)
        d.text((270, 889), "Suivi(e)", font=F("Inter-700", 36), fill=ESP, anchor="mm"); icon(d, "check", 400, 889, 14, ESP, 5)
    else:
        d.rounded_rectangle((60, 846, 520, 932), radius=18, fill=GOLD)
        d.text((290, 889), "Suivre", font=F("Inter-700", 36), fill=(255, 255, 255), anchor="mm")
    d.rounded_rectangle((540, 846, 1000, 932), radius=18, fill=LIGHT)
    d.text((770, 889), "Contacter", font=F("Inter-700", 36), fill=ESP, anchor="mm")
    # highlights (real frames of the film)
    for i, (fi, lab) in enumerate(HIGH):
        x = 125 + i * 190
        d.ellipse((x - 70, 1000, x + 70, 1140), outline=(214, 199, 178), width=4)
        page.alpha_composite(circle_img(frame_crop(fi, 1.0, 256), 124), (x - 62, 1008))
        d.text((x, 1186), lab, font=F("Inter-500", 28), fill=ESP, anchor="ms")
    # tabs
    d.line((0, 1214, W, 1214), fill=(230, 220, 205), width=2)
    icon(d, "grid", 180, 1238, 22, ESP, 4); d.line((60, 1260, 300, 1260), fill=ESP, width=4)
    icon(d, "reels", 540, 1238, 20, MUTED, 4); icon(d, "tag", 900, 1238, 20, MUTED, 4)
    # grid
    for i, fi in enumerate(TILES):
        x, y, w, h = tile_rect(i, 0)
        page.paste(frame_crop(fi, 3 / 4, TILE_W), (int(x), int(y)))
        if i in (1, 4):
            icon(d, "reels", x + w - 40, y + 40, 18, (255, 255, 255), 4)
    return page


def profile(t):
    followed = t >= FOLLOW
    page = profile_base(followed).copy()
    d = ImageDraw.Draw(page)
    # follow: glow, tap and a little burst of hearts
    if FOLLOW - 1.2 < t < FOLLOW:
        k = 0.5 + 0.5 * math.sin((t - FOLLOW) * 9)
        d.rounded_rectangle((60 - 8 * k, 846 - 8 * k, 520 + 8 * k, 932 + 8 * k), radius=24, outline=(*GOLD, int(160 * k)), width=6)
    tk = prog(t, FOLLOW - 0.08, FOLLOW + 0.35)
    if 0 < tk < 1: ripple(d, 290, 889, tk, (90, 60, 30))
    bk = prog(t, FOLLOW, FOLLOW + 0.8)
    if 0 < bk < 1:
        rnd = np.random.default_rng(8)
        for i in range(12):
            ang = rnd.uniform(-math.pi, 0); r = (80 + rnd.uniform(0, 140)) * ease_out(bk)
            draw_heart(d, 290 + math.cos(ang) * r * 1.6, 889 + math.sin(ang) * r, 18 + rnd.uniform(0, 12), fill=((*RED, int(230 * (1 - bk))) if i % 2 else (*GOLD, int(230 * (1 - bk)))))
    # call to action pointing at the button, before the tap
    ca = ease_out(prog(t, 29.25, 29.6)) * (1 - prog(t, FOLLOW - 0.1, FOLLOW + 0.15))
    if ca > 0.01:
        lay = Image.new("RGBA", page.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
        bob = math.sin(t * 7) * 8
        ld.rounded_rectangle((150, 1010 + bob, 640, 1150 + bob), radius=70, fill=(*ESP, 235))
        ld.text((360, 1080 + bob), "Abonne-toi", font=F("Oswald-700", 78), fill=CREAM, anchor="mm")
        ld.polygon([(560, 1050 + bob), (600, 1050 + bob), (580, 1012 + bob)], fill=GOLD)
        ld.line((580, 1110 + bob, 580, 1040 + bob), fill=GOLD, width=10)
        lay.putalpha(lay.getchannel("A").point(lambda v: int(v * ca)))
        page.alpha_composite(lay)
    scroll = 520 * ease(prog(t, SCROLL0, SCROLL1))
    view = page.crop((0, int(scroll), W, int(scroll) + H))
    # tap on the poster post, which opens into the next shot
    tr = prog(t, TAP_TILE - 0.05, TAP_TILE + 0.3)
    if 0 < tr < 1:
        x, y, w, h = tile_rect(OPEN_TILE, scroll)
        ripple(ImageDraw.Draw(view), x + w / 2, y + h / 2, tr)
    return view, scroll


POSTER = lambda: Image.open(F3D / "f0816.png").convert("RGB")
POSTER_CACHE = []


def open_post(canvas, t, scroll):
    """the poster post grows from its tile to the full frame = first frame of the poster shot"""
    k = ease(prog(t, OPEN0, OPEN1 - 0.05))
    if k <= 0: return
    x, y, w, h = tile_rect(OPEN_TILE, scroll)
    rx, ry, rw, rh = lerp(x, 0, k), lerp(y, 0, k), lerp(w, W, k), lerp(h, H, k)
    src = POSTER_CACHE[0] if POSTER_CACHE else POSTER_CACHE.append(POSTER()) or POSTER_CACHE[0]
    cw0, ch0 = W, int(W * 4 / 3); cx0, cy0 = 0, (H - ch0) // 2
    cx, cy, cw, ch = lerp(cx0, 0, k), lerp(cy0, 0, k), lerp(cw0, W, k), lerp(ch0, H, k)
    img = src.crop((int(cx), int(cy), int(cx + cw), int(cy + ch))).resize((max(1, int(rw)), max(1, int(rh))), Image.LANCZOS)
    m = Image.new("L", img.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, img.width - 1, img.height - 1), radius=int(28 * (1 - k)), fill=255)
    canvas.paste(img, (int(rx), int(ry)), m)


def inside(canvas, t):
    """draws the inside-the-screen Instagram sequence on top of canvas (RGBA, the graded 3D frame)"""
    if t < T_IN or t >= 34.0: return
    if t < SLIDE1:
        canvas.alpha_composite(reel_overlay(t))
    if t >= SLIDE0:
        k = ease(prog(t, SLIDE0, SLIDE1))
        view, scroll = profile(t)
        if k < 1:
            dim = Image.new("RGBA", (W, H), (20, 12, 8, int(110 * k)))
            canvas.alpha_composite(dim)
            sh = Image.new("RGBA", (40, H), (0, 0, 0, 0))
            for i in range(40): ImageDraw.Draw(sh).line((i, 0, i, H), fill=(0, 0, 0, int(60 * (1 - i / 40))))
            x = int(W * (1 - k))
            canvas.alpha_composite(view.convert("RGBA"), (x, 0))
            if x - 40 > 0: canvas.alpha_composite(sh.transpose(Image.FLIP_LEFT_RIGHT), (x - 40, 0))
        else:
            canvas.alpha_composite(view.convert("RGBA"))
        rgb = canvas
        if t >= OPEN0:
            base = canvas.convert("RGB"); open_post(base, t, scroll); canvas.paste(base.convert("RGBA"))
