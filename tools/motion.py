"""30-second motion design reel for ATELIER 47 BARBIER (1080x1920, 30 fps, 120 BPM).

Usage:
  python3 tools/motion.py frames 0.5 2.0 ...   # render test frames to exports/frames/
  python3 tools/motion.py video                # render exports/atelier47_motion.mp4 (+ silent version)
"""
import math, random, subprocess, sys, wave
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
OUT = ROOT / "exports"
W, H, FPS, DUR = 1080, 1920, 30, 30.0
BEAT = 0.5

BLACK = (17, 17, 17)
GOLD = (201, 162, 75)
GOLD_LIGHT = (236, 210, 140)
GOLD_DARK = (160, 122, 45)
CREAM = (243, 238, 227)
MUTED = (185, 177, 162)
PANEL = (24, 22, 18)

ADDRESS = "12 rue de la République"
CITY = "74000 ANNECY"
HANDLE = "@atelier47barbier"
HOURS = [("MARDI – VENDREDI", "9H – 19H"), ("SAMEDI", "9H – 18H"), ("DIMANCHE & LUNDI", "FERMÉ")]
PRICES = [("COUPE", [("Coupe Homme", 22), ("Dégradé / Fade", 25), ("Coupe étudiant", 20), ("Enfant (-12 ans)", 15)]),
          ("BARBE + SOINS", [("Barbe", 15), ("Shampooing", 5), ("Coupe + barbe + shampoing", 38)])]
CUTS = [3.5, 7.5, 12.0, 17.0, 23.0, 26.5]

# ------------------------------------------------------------------ easing
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))

def prog(t, a, b):
    return clamp((t - a) / (b - a)) if b > a else float(t >= a)

def ease_out(p):
    return 1 - (1 - p) ** 3

def ease_in_out(p):
    return 4 * p ** 3 if p < 0.5 else 1 - (-2 * p + 2) ** 3 / 2

def ease_back(p, s=1.7):
    p -= 1
    return 1 + (s + 1) * p ** 3 + s * p ** 2

def lerp(a, b, p):
    return a + (b - a) * p

# ------------------------------------------------------------------ fonts & text
FONT_DIR = ASSETS / "fonts"

@lru_cache(maxsize=None)
def font(weight, size):
    return ImageFont.truetype(str(FONT_DIR / f"Poppins-{weight}.ttf"), int(size))

def layout(text, weight, size, tracking=0):
    f = font(weight, size)
    xs, x = [], 0.0
    for ch in text:
        xs.append(x)
        x += f.getlength(ch) + tracking
    return xs, (x - tracking) if text else 0

def fit_size(text, weight, size, tracking, max_w):
    _, w = layout(text, weight, size, tracking)
    return int(size * min(1.0, max_w / w)) if w else size

@lru_cache(maxsize=None)
def text_mask(text, weight, size, tracking=0):
    f = font(weight, size)
    xs, w = layout(text, weight, size, tracking)
    asc, desc = f.getmetrics()
    pad = int(size * 0.25)
    im = Image.new("L", (int(math.ceil(w)) + 2 * pad, asc + desc + 2 * pad), 0)
    d = ImageDraw.Draw(im)
    for ch, x in zip(text, xs):
        d.text((pad + x, pad), ch, font=f, fill=255)
    return im

@lru_cache(maxsize=None)
def gold_gradient(w, h):
    y = np.linspace(0, 1, h)[:, None]
    top, mid, bot = np.array(GOLD_LIGHT), np.array(GOLD), np.array(GOLD_DARK)
    up = (y < 0.5)
    t1 = (y / 0.5)
    t2 = ((y - 0.5) / 0.5)
    col = np.where(up[..., None], top + (mid - top) * t1[..., None], mid + (bot - mid) * t2[..., None])
    col = np.broadcast_to(col, (h, w, 3)).astype(np.float32)
    return col

def colorize(mask, color, alpha=1.0, sweep=None, x0=0, y0=0):
    """mask: L image. color: RGB tuple or 'gold'. sweep: absolute x position of a diagonal light band."""
    w, h = mask.size
    a = np.asarray(mask, dtype=np.float32) / 255.0
    if color == "gold":
        rgb = gold_gradient(w, h).copy()
    else:
        rgb = np.empty((h, w, 3), np.float32)
        rgb[:] = color
    if sweep is not None:
        xx = np.arange(w)[None, :] + x0
        yy = np.arange(h)[:, None] + y0
        band = np.clip(1 - np.abs(xx + 0.35 * yy - sweep) / 70.0, 0, 1) ** 2
        rgb = rgb + (np.array([255, 246, 220], np.float32) - rgb) * band[..., None] * 0.85
    out = np.dstack([np.clip(rgb, 0, 255), np.clip(a * alpha * 255, 0, 255)]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")

@lru_cache(maxsize=None)
def glow_mask(text, weight, size, tracking, radius):
    m = text_mask(text, weight, size, tracking)
    big = Image.new("L", (m.width + 4 * radius, m.height + 4 * radius), 0)
    big.paste(m, (2 * radius, 2 * radius))
    return big.filter(ImageFilter.GaussianBlur(radius))

def paste(canvas, img, cx, cy, alpha=1.0, scale=1.0, anchor="center"):
    if alpha <= 0.003 or img is None:
        return
    if abs(scale - 1.0) > 1e-3:
        nw, nh = max(1, int(img.width * scale)), max(1, int(img.height * scale))
        img = img.resize((nw, nh), Image.BICUBIC)
    if alpha < 0.999:
        a = img.getchannel("A").point(lambda v: int(v * alpha))
        img = img.copy()
        img.putalpha(a)
    if anchor == "center":
        x, y = int(round(cx - img.width / 2)), int(round(cy - img.height / 2))
    elif anchor == "left":
        x, y = int(round(cx)), int(round(cy - img.height / 2))
    else:  # right
        x, y = int(round(cx - img.width)), int(round(cy - img.height / 2))
    sx0, sy0 = max(0, -x), max(0, -y)
    sx1, sy1 = min(img.width, W - x), min(img.height, H - y)
    if sx1 <= sx0 or sy1 <= sy0:
        return
    if (sx0, sy0, sx1, sy1) != (0, 0, img.width, img.height):
        img = img.crop((sx0, sy0, sx1, sy1))
    canvas.alpha_composite(img, (x + sx0, y + sy0))

def text(canvas, s, weight, size, cx, cy, color=CREAM, alpha=1.0, tracking=0, anchor="center",
         sweep=None, glow=0.0, scale=1.0):
    m = text_mask(s, weight, size, tracking)
    if anchor == "center":
        x0, y0 = cx - m.width / 2, cy - m.height / 2
    elif anchor == "left":
        x0, y0 = cx, cy - m.height / 2
    else:
        x0, y0 = cx - m.width, cy - m.height / 2
    if glow > 0:
        r = max(6, size // 6)
        g = glow_mask(s, weight, size, tracking, r)
        gc = {"center": cx, "left": cx - 2 * r, "right": cx + 2 * r}[anchor]
        paste(canvas, colorize(g, GOLD, alpha * glow), gc, cy, scale=scale, anchor=anchor)
    img = colorize(m, color, alpha, sweep, x0, y0)
    paste(canvas, img, cx, cy, scale=scale, anchor=anchor)

def letters(canvas, s, weight, size, cx, cy, t, start, color=CREAM, tracking=0, stagger=0.035, dur=0.35,
            style="rise", sweep=None, glow=0.0):
    """Per-letter animated text, centered on cx."""
    xs, w = layout(s, weight, size, tracking)
    f = font(weight, size)
    x_left = cx - w / 2
    for i, ch in enumerate(s):
        if ch == " ":
            continue
        p = prog(t, start + i * stagger, start + i * stagger + dur)
        if p <= 0:
            continue
        chw = f.getlength(ch)
        ccx = x_left + xs[i] + chw / 2
        if style == "pop":
            sc, dy, al = lerp(1.9, 1.0, ease_back(p, 1.4)), 0, clamp(p * 2.5)
        else:
            sc, dy, al = 1.0, lerp(size * 0.6, 0, ease_out(p)), clamp(p * 1.6)
        m = text_mask(ch, weight, size, 0)
        if glow > 0 and p > 0.5:
            r = max(6, size // 6)
            paste(canvas, colorize(glow_mask(ch, weight, size, 0, r), GOLD, glow * al), ccx, cy + dy, scale=sc)
        img = colorize(m, color, al, sweep, ccx - m.width / 2, cy + dy - m.height / 2)
        paste(canvas, img, ccx, cy + dy, scale=sc)

# ------------------------------------------------------------------ drawing helpers (supersampled)
SS = 3

def ss_layer(w, h):
    im = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)

def ss_done(im):
    return im.resize((im.width // SS, im.height // SS), Image.LANCZOS)

def rgba(c, a=255):
    return (c[0], c[1], c[2], int(a))

@lru_cache(maxsize=None)
def ring_img(radius, width, color=GOLD, alpha=255, frac_q=1000):
    frac = frac_q / 1000
    size = 2 * radius + 4 * width
    im, d = ss_layer(size, size)
    c = size * SS / 2
    r = radius * SS
    if frac >= 0.999:
        d.ellipse((c - r, c - r, c + r, c + r), outline=rgba(color, alpha), width=width * SS)
    elif frac > 0:
        d.arc((c - r, c - r, c + r, c + r), -90, -90 + 360 * frac, fill=rgba(color, alpha), width=width * SS)
    return ss_done(im)

def ring(canvas, cx, cy, radius, width, frac, alpha=1.0, color=GOLD):
    q = int(round(clamp(frac) * 60)) * 1000 // 60
    if q <= 0:
        return
    paste(canvas, ring_img(radius, width, color, 255, q), cx, cy, alpha)

def hline(canvas, cx, cy, length, frac, width=3, alpha=1.0, color=GOLD, anchor="center"):
    L = int(length * clamp(frac))
    if L <= 1:
        return
    im = Image.new("RGBA", (L, width), rgba(color, 255 * alpha))
    paste(canvas, im, cx, cy, anchor=anchor)

# --- icons, drawn once at 3x then downsampled
@lru_cache(maxsize=None)
def icon(name, size=120, color=GOLD, stroke=6, angle_q=0):
    im, d = ss_layer(size, size)
    s = size * SS
    st = stroke * SS
    col = rgba(color)

    def P(x, y):
        return (x * s, y * s)

    if name == "pin":
        d.ellipse((*P(0.22, 0.08), *P(0.78, 0.64)), outline=col, width=st)
        d.line([P(0.27, 0.48), P(0.5, 0.92), P(0.73, 0.48)], fill=col, width=st, joint="curve")
        d.ellipse((*P(0.41, 0.27), *P(0.59, 0.45)), fill=col)
    elif name == "leaf":
        d.ellipse((*P(0.2, 0.08), *P(0.8, 0.82)), outline=col, width=st)
        d.line([P(0.5, 0.12), P(0.5, 0.95)], fill=col, width=st)
        for k in range(3):
            y = 0.3 + k * 0.15
            d.line([P(0.5, y + 0.08), P(0.3, y - 0.02)], fill=col, width=st // 2 + 2)
            d.line([P(0.5, y + 0.08), P(0.7, y - 0.02)], fill=col, width=st // 2 + 2)
    elif name == "tv":
        d.rounded_rectangle((*P(0.06, 0.12), *P(0.94, 0.66)), radius=0.05 * s, outline=col, width=st)
        d.line([P(0.4, 0.78), P(0.6, 0.78)], fill=col, width=st)
        d.line([P(0.5, 0.66), P(0.5, 0.78)], fill=col, width=st)
        d.rounded_rectangle((*P(0.74, 0.70), *P(0.84, 0.96)), radius=0.03 * s, outline=col, width=st // 2 + 2)
        d.rounded_rectangle((*P(0.14, 0.82), *P(0.36, 0.96)), radius=0.05 * s, outline=col, width=st // 2 + 2)
        d.polygon([P(0.42, 0.28), P(0.42, 0.50), P(0.60, 0.39)], fill=col)
    elif name == "card":
        d.rounded_rectangle((*P(0.06, 0.22), *P(0.86, 0.78)), radius=0.07 * s, outline=col, width=st)
        d.line([P(0.06, 0.38), P(0.86, 0.38)], fill=col, width=st)
        d.rounded_rectangle((*P(0.16, 0.50), *P(0.34, 0.64)), radius=0.02 * s, fill=col)
        for k, r in enumerate([0.08, 0.15, 0.22]):
            d.arc((*P(0.84 - r, 0.5 - r), *P(0.84 + r, 0.5 + r)), -40, 40, fill=col, width=st // 2 + 2)
    elif name == "clock":
        d.ellipse((*P(0.06, 0.06), *P(0.94, 0.94)), outline=col, width=st)
        a = angle_q / 100.0
        for ang, ln, wd in [(a * 12, 0.30, st), (a, 0.22, st)]:
            x = 0.5 + ln * math.sin(ang)
            y = 0.5 - ln * math.cos(ang)
            d.line([P(0.5, 0.5), P(x, y)], fill=col, width=wd)
        d.ellipse((*P(0.46, 0.46), *P(0.54, 0.54)), fill=col)
    elif name == "check":
        d.line([P(0.15, 0.55), P(0.40, 0.80), P(0.88, 0.22)], fill=col, width=st, joint="curve")
    return ss_done(im)

@lru_cache(maxsize=None)
def scissors(size, angle_q, color=GOLD):
    """Open scissors, angle in degrees*10 between the blades."""
    ang = math.radians(angle_q / 10)
    im, d = ss_layer(size, size)
    s = size * SS
    col = rgba(color)
    st = int(0.035 * s)
    px, py = 0.5 * s, 0.42 * s
    for sign in (-1, 1):
        tip = (px + sign * math.sin(ang / 2) * 0.40 * s * -1, py - math.cos(ang / 2) * 0.40 * s)
        hx = px - (tip[0] - px) * 0.55
        hy = py - (tip[1] - py) * 0.55
        d.line([tip, (px, py), (hx, hy)], fill=col, width=st)
        r = 0.09 * s
        d.ellipse((hx - r, hy - r, hx + r, hy + r), outline=col, width=st)
    d.ellipse((px - st, py - st, px + st, py + st), fill=col)
    return ss_done(im)

@lru_cache(maxsize=None)
def razor(size, open_q, color=GOLD):
    """Straight razor; open_q 0..100 (closed..open)."""
    o = open_q / 100
    im, d = ss_layer(size, size)
    s = size * SS
    col = rgba(color)
    st = int(0.03 * s)
    pivot = (0.30 * s, 0.62 * s)
    d.rounded_rectangle((0.08 * s, 0.58 * s, 0.32 * s, 0.67 * s), radius=0.04 * s, outline=col, width=st)
    d.line([(0.32 * s, 0.625 * s), (0.62 * s, 0.625 * s)], fill=col, width=st)
    ang = math.radians(lerp(170, 25, o))
    L = 0.55 * s
    bx = (math.cos(ang), -math.sin(ang))
    nx = (-bx[1], bx[0])
    p0 = pivot
    p1 = (pivot[0] + bx[0] * L, pivot[1] + bx[1] * L)
    wdt = 0.11 * s
    poly = [p0, p1, (p1[0] + nx[0] * wdt, p1[1] + nx[1] * wdt), (p0[0] + nx[0] * wdt * 0.7, p0[1] + nx[1] * wdt * 0.7)]
    d.polygon(poly, fill=col)
    d.ellipse((pivot[0] - st * 1.2, pivot[1] - st * 1.2, pivot[0] + st * 1.2, pivot[1] + st * 1.2), fill=rgba(BLACK))
    return ss_done(im)

def star(canvas, cx, cy, r, alpha):
    if alpha <= 0.02 or r < 1:
        return
    size = int(r * 2.4) + 4
    im, d = ss_layer(size, size)
    c = size * SS / 2
    R = r * SS
    k = R * 0.18
    d.polygon([(c, c - R), (c + k, c - k), (c + R, c), (c + k, c + k), (c, c + R), (c - k, c + k), (c - R, c), (c - k, c - k)],
              fill=rgba(GOLD_LIGHT, 255 * alpha))
    paste(canvas, ss_done(im), cx, cy)

def panel(w, h, radius=28, fill=PANEL, border=GOLD, border_a=110, bw=2):
    im, d = ss_layer(w, h)
    d.rounded_rectangle((bw * SS, bw * SS, (w - bw) * SS, (h - bw) * SS), radius=radius * SS, fill=rgba(fill),
                        outline=rgba(border, border_a), width=bw * SS)
    return ss_done(im)

# ------------------------------------------------------------------ assets
@lru_cache(maxsize=None)
def logo(size):
    im = Image.open(ASSETS / "logo_atelier47.png").convert("RGBA")
    im = im.resize((size, size), Image.LANCZOS)
    arr = np.asarray(im).astype(np.float32)
    lum = arr[..., :3].max(axis=2)
    alpha = np.clip((lum - 22) / 60.0, 0, 1)  # remove the #111111 background
    arr[..., 3] = alpha * 255
    return Image.fromarray(arr.astype(np.uint8), "RGBA")

def logo_draw(canvas, cx, cy, size, t, start, sweep_at=None, alpha=1.0):
    p = ease_out(prog(t, start, start + 0.8))
    if p <= 0:
        return
    lg = logo(size)
    r = int(size * 0.55 * p)
    mask = Image.new("L", lg.size, 0)
    ImageDraw.Draw(mask).ellipse((size / 2 - r, size / 2 - r, size / 2 + r, size / 2 + r), fill=255)
    a = np.minimum(np.asarray(lg.getchannel("A")), np.asarray(mask.filter(ImageFilter.GaussianBlur(8))))
    img = lg.copy()
    if sweep_at is not None:
        sp = prog(t, sweep_at, sweep_at + 0.8)
        if 0 < sp < 1:
            arr = np.asarray(img).astype(np.float32)
            xx = np.arange(size)[None, :]
            yy = np.arange(size)[:, None]
            pos = lerp(-0.4 * size, 1.4 * size, sp)
            band = np.clip(1 - np.abs(xx + 0.4 * yy - pos) / (size * 0.09), 0, 1) ** 2
            arr[..., :3] += (255 - arr[..., :3]) * band[..., None] * 0.7
            img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
    img.putalpha(Image.fromarray((a * alpha).astype(np.uint8)))
    paste(canvas, img, cx, cy, scale=lerp(0.92, 1.0, p))

@lru_cache(maxsize=None)
def price_photo():
    return Image.open(ASSETS / "fiche_tarifs.jpg").convert("RGB")

# ------------------------------------------------------------------ background
rng = np.random.default_rng(47)

@lru_cache(maxsize=None)
def background():
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    base = np.empty((H, W, 3), np.float32)
    base[:] = BLACK
    glow = np.exp(-(((x - W / 2) / (W * 0.75)) ** 2 + ((y - H * 0.38) / (H * 0.45)) ** 2))
    base += np.array([36, 26, 8], np.float32) * glow[..., None]
    vign = np.clip(1 - 0.55 * ((((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2) / 2) ** 1.2, 0, 1)
    base *= vign[..., None]
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

@lru_cache(maxsize=None)
def bokeh_sprite(r):
    s = 4 * r
    y, x = np.mgrid[0:s, 0:s].astype(np.float32)
    d = np.sqrt((x - s / 2) ** 2 + (y - s / 2) ** 2) / r
    a = np.clip(1 - d, 0, 1) ** 1.6
    out = np.zeros((s, s, 4), np.uint8)
    out[..., :3] = GOLD_LIGHT
    out[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")

BOKEH = [dict(x=rng.uniform(0, W), y=rng.uniform(0, H), r=int(rng.uniform(18, 60)), a=rng.uniform(0.04, 0.12),
              v=rng.uniform(12, 40), ph=rng.uniform(0, 6.28)) for _ in range(16)]
GRAIN = [rng.normal(0, 4.0, (H, W, 1)).astype(np.float32) for _ in range(6)]

def draw_bokeh(canvas, t):
    for b in BOKEH:
        y = (b["y"] - b["v"] * t) % (H + 200) - 100
        x = b["x"] + 30 * math.sin(t * 0.4 + b["ph"])
        a = b["a"] * (0.6 + 0.4 * math.sin(t * 0.8 + b["ph"]))
        paste(canvas, bokeh_sprite(b["r"]), x, y, alpha=a)

# ------------------------------------------------------------------ scenes
def beat_pulse(t, start):
    """1 on each beat, decaying."""
    if t < start:
        return 0.0
    ph = ((t - start) % BEAT) / BEAT
    return math.exp(-ph * 6)

def scene_hook(c, t):
    letters(c, "VOTRE BARBIER À ANNECY", "Medium", 34, W / 2, 300, t, 0.3, CREAM, tracking=10, stagger=0.02, dur=0.4)
    ring(c, W / 2, 740, 345, 3, ease_out(prog(t, 0.0, 0.9)))
    ring(c, W / 2, 740, 362, 1, ease_out(prog(t, 0.2, 1.1)), alpha=0.45)
    logo_draw(c, W / 2, 740, 620, t, 0.15, sweep_at=1.2)
    p = ease_back(prog(t, 1.25, 1.6))
    if p > 0:
        paste(c, icon("pin", 74), W / 2, 1185, alpha=clamp(p), scale=max(0.01, p))
    letters(c, ADDRESS.upper(), "SemiBold", 44, W / 2, 1275, t, 1.35, CREAM, tracking=5, stagger=0.018, dur=0.35)
    sw = lerp(-200, 1400, prog(t, 2.6, 3.3)) if 2.6 < t < 3.3 else None
    letters(c, CITY, "Bold", 88, W / 2, 1385, t, 1.75, "gold", tracking=10, stagger=0.045, dur=0.4, style="pop", sweep=sw, glow=0.35)
    hline(c, W / 2, 1460, 520, ease_in_out(prog(t, 2.25, 2.75)), width=3)

def scene_kinetic(c, t):
    letters(c, "ATELIER 47", "SemiBold", 38, W / 2, 300, t, 3.6, GOLD, tracking=18, stagger=0.03, dur=0.3)
    first = t < 5.5
    big1, big2 = ("COUPE", "NETTE") if first else ("BARBE", "SOIGNÉE")
    t0 = 3.5 if first else 5.5
    size = fit_size(big2, "ExtraBold", 220, 6, 900)
    size1 = min(size, fit_size(big1, "ExtraBold", 220, 6, 900))
    p1 = prog(t, t0, t0 + 0.18)
    p2 = prog(t, t0 + 0.5, t0 + 0.68)
    pulse = 1 + 0.025 * beat_pulse(t, t0)
    if p1 > 0:
        text(c, big1, "ExtraBold", size1, W / 2, 900, CREAM, alpha=clamp(p1 * 2), tracking=6, scale=lerp(1.6, 1.0, ease_out(p1)) * pulse)
    if p2 > 0:
        sw = lerp(-300, 1500, prog(t, t0 + 1.0, t0 + 1.7))
        text(c, big2, "ExtraBold", size, W / 2, 1120, "gold", alpha=clamp(p2 * 2), tracking=6,
             scale=lerp(1.6, 1.0, ease_out(p2)) * pulse, sweep=sw, glow=0.4)
    hline(c, W / 2, 1290, 760, ease_in_out(prog(t, t0 + 0.9, t0 + 1.3)), width=3)
    ip = ease_back(prog(t, t0 + 0.1, t0 + 0.45))
    if ip > 0:
        if first:
            ang = 34 + 14 * math.sin((t - t0) * math.pi * 2 / BEAT / 2)
            ic = scissors(260, int(ang * 10))
        else:
            ic = razor(280, int(clamp(prog(t, t0 + 0.1, t0 + 0.9)) * 100))
        paste(c, ic, W / 2, 600, alpha=clamp(ip), scale=max(0.01, ip))
    letters(c, "COUPE NETTE · BARBE SOIGNÉE" if not first else "", "Medium", 30, W / 2, 1390, t, 6.6, MUTED, tracking=8, stagger=0.015)

FEATURES = [("leaf", "Une ambiance chaleureuse", "Plantes, lumière dorée, détente"),
            ("tv", "Coin détente & PS5", "Le match en attendant votre tour"),
            ("card", "Paiement par carte", "Sans contact accepté")]

@lru_cache(maxsize=None)
def feature_card():
    return panel(900, 230, radius=30, fill=PANEL, border_a=90)

def scene_salon(c, t):
    letters(c, "LE SALON", "Bold", 40, W / 2, 320, t, 7.55, GOLD, tracking=22, stagger=0.03)
    hline(c, W / 2, 372, 140, ease_out(prog(t, 7.8, 8.1)), width=3)
    letters(c, "Pensé pour vous", "Light", 84, W / 2, 470, t, 7.7, CREAM, tracking=0, stagger=0.03, dur=0.45)
    for i, (ic, title, sub) in enumerate(FEATURES):
        st = 8.0 + i * 0.5
        p = ease_out(prog(t, st, st + 0.45))
        if p <= 0:
            continue
        y = 740 + i * 270
        dx = lerp(700, 0, p)
        paste(c, feature_card(), W / 2 + dx, y, alpha=clamp(p * 1.5))
        ring(c, 215 + dx, y, 66, 2, 1.0, alpha=clamp(p * 1.5) * 0.9)
        pul = 1 + 0.06 * beat_pulse(t, st) * (t < st + 3)
        paste(c, icon(ic, 84), 215 + dx, y, alpha=clamp(p * 1.5), scale=pul)
        text(c, title, "SemiBold", 44, 315 + dx, y - 30, CREAM, alpha=clamp(p * 1.5), anchor="left")
        text(c, sub, "Regular", 30, 315 + dx, y + 34, MUTED, alpha=clamp(p * 1.5), anchor="left")

@lru_cache(maxsize=None)
def price_panel():
    return panel(900, 1010, radius=30, fill=PANEL, border_a=100)

def scene_prices(c, t):
    sw = lerp(-300, 1500, prog(t, 15.2, 16.0)) if 15.2 < t < 16.0 else None
    letters(c, "NOS TARIFS", "Bold", 104, W / 2, 330, t, 12.0, "gold", tracking=8, stagger=0.04, dur=0.4, style="pop", sweep=sw, glow=0.35)
    pp = ease_out(prog(t, 12.15, 12.6))
    if pp <= 0:
        return
    oy = lerp(120, 0, pp)
    paste(c, price_panel(), W / 2, 960 + oy, alpha=clamp(pp * 1.4))
    y = 540 + oy
    row = 0
    for si, (section, items) in enumerate(PRICES):
        if si == 1:
            hline(c, W / 2, y - 20, 760, ease_in_out(prog(t, 13.5, 13.9)), width=2, alpha=0.7)
            y += 40
        sp = ease_out(prog(t, 12.4 + si * 1.1, 12.75 + si * 1.1))
        text(c, section, "SemiBold", 40, 150, y, GOLD, alpha=sp, tracking=10, anchor="left")
        y += 90
        for name, price in items:
            st = 12.6 + row * 0.26 + si * 0.25
            p = ease_out(prog(t, st, st + 0.35))
            if p > 0:
                dx = lerp(-60, 0, p)
                text(c, name, "Medium", 38, 150 + dx, y, CREAM, alpha=p, anchor="left")
                cnt = int(round(price * ease_out(prog(t, st + 0.05, st + 0.45))))
                text(c, f"{cnt}€", "Bold", 46, 930, y, "gold", alpha=p, anchor="right")
                _, nw = layout(name, "Medium", 38)
                lead_x0, lead_x1 = 150 + nw + 24, 930 - 110
                n = int((lead_x1 - lead_x0) / 18)
                for k in range(max(0, n)):
                    if k / max(1, n) <= p:
                        paste(c, Image.new("RGBA", (4, 4), rgba(GOLD, 140)), lead_x0 + k * 18, y + 14)
            y += 92
            row += 1

# --- Instagram phone mockup
PH_W, PH_H = 600, 1240
SCR_PAD = 20

@lru_cache(maxsize=None)
def phone_body():
    im, d = ss_layer(PH_W, PH_H)
    d.rounded_rectangle((0, 0, PH_W * SS, PH_H * SS), radius=78 * SS, fill=rgba((10, 10, 10)), outline=rgba(GOLD, 200), width=3 * SS)
    d.rounded_rectangle((SCR_PAD * SS, SCR_PAD * SS, (PH_W - SCR_PAD) * SS, (PH_H - SCR_PAD) * SS), radius=60 * SS, fill=rgba((0, 0, 0)))
    d.rounded_rectangle(((PH_W / 2 - 70) * SS, 38 * SS, (PH_W / 2 + 70) * SS, 70 * SS), radius=16 * SS, fill=rgba((10, 10, 10)))
    return ss_done(im)

@lru_cache(maxsize=None)
def avatar(size):
    lg = Image.open(ASSETS / "logo_atelier47.png").convert("RGBA").resize((size, size), Image.LANCZOS)
    m = Image.new("L", (size * SS, size * SS), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size * SS, size * SS), fill=255)
    lg.putalpha(m.resize((size, size), Image.LANCZOS))
    return lg

@lru_cache(maxsize=None)
def tiles():
    photo = price_photo()
    T = 176
    out = []

    def crop(box):
        return photo.crop(box).resize((T, T), Image.LANCZOS).convert("RGBA")

    def solid(col, label=None, lcol=CREAM, size=40, icon_name=None):
        im = Image.new("RGBA", (T, T), rgba(col))
        if label:
            m = text_mask(label, "Bold", size, 2)
            im.alpha_composite(colorize(m, lcol), ((T - m.width) // 2, (T - m.height) // 2))
        if icon_name:
            ic = icon(icon_name, 96, GOLD if col != GOLD else BLACK)
            im.alpha_composite(ic, ((T - ic.width) // 2, (T - ic.height) // 2))
        return im

    lg = logo(T).copy()
    bg = Image.new("RGBA", (T, T), rgba(BLACK))
    bg.alpha_composite(lg)
    fiche = photo.resize((T, int(T * photo.height / photo.width)), Image.LANCZOS).crop((0, 20, T, 20 + T)).convert("RGBA")
    sc = Image.new("RGBA", (T, T), rgba(BLACK))
    sc.alpha_composite(scissors(150, 340), ((T - 150) // 2, (T - 150) // 2))
    out = [bg, crop((0, 0, 260, 260)), solid(GOLD, "47", BLACK, 80),
           sc, fiche, crop((560, 0, 786, 226)),
           solid(PANEL, None, icon_name="leaf"), solid(CREAM, "ANNECY", BLACK, 30), solid(BLACK, "BARBIER", GOLD, 28)]
    return out, T

def check_img(size, color):
    return icon("check", size, color, 9)

def draw_screen(t, subscribed, tile_t0):
    sw, sh = PH_W - 2 * SCR_PAD, PH_H - 2 * SCR_PAD
    scr = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    text(scr, "atelier47barbier", "Bold", 32, 36, 100, CREAM, anchor="left")
    av = avatar(170)
    scr.alpha_composite(av, (30, 150))
    rimg = ring_img(88, 3, GOLD, 255, 1000)
    scr.alpha_composite(rimg, (30 + 85 - rimg.width // 2, 150 + 85 - rimg.height // 2))
    text(scr, "Atelier 47 Barbier", "SemiBold", 32, 230, 205, CREAM, anchor="left")
    text(scr, "Barbier · Annecy", "Regular", 25, 230, 250, MUTED, anchor="left")
    text(scr, "Coupe nette · Barbe soignée", "Regular", 26, 36, 370, CREAM, anchor="left")
    text(scr, "12 rue de la République, Annecy", "Regular", 26, 36, 410, MUTED, anchor="left")
    bw, bh, by = sw - 64, 76, 480
    im, d = ss_layer(bw, bh)
    if subscribed:
        d.rounded_rectangle((2 * SS, 2 * SS, (bw - 2) * SS, (bh - 2) * SS), radius=18 * SS, fill=rgba((28, 26, 22)), outline=rgba(CREAM, 160), width=2 * SS)
    else:
        d.rounded_rectangle((0, 0, bw * SS, bh * SS), radius=18 * SS, fill=rgba(GOLD))
    btn = ss_done(im)
    scr.alpha_composite(btn, (32, by - bh // 2))
    if subscribed:
        text(scr, "Abonné", "SemiBold", 30, sw / 2 + 18, by, CREAM)
        scr.alpha_composite(check_img(34, CREAM), (int(sw / 2 - 92), by - 17))
    else:
        text(scr, "S'abonner", "SemiBold", 32, sw / 2, by, BLACK)
    tl, T = tiles()
    gap = 4
    gx = (sw - 3 * T - 2 * gap) // 2
    for i, tile in enumerate(tl):
        p = ease_out(prog(t, tile_t0 + i * 0.07, tile_t0 + i * 0.07 + 0.3))
        if p <= 0:
            continue
        r, col = divmod(i, 3)
        x = gx + col * (T + gap)
        y = 580 + r * (T + gap)
        img = tile.copy()
        if p < 1:
            img.putalpha(img.getchannel("A").point(lambda v: int(v * p)))
        scr.alpha_composite(img, (x, y))
    return scr, (32 + bw // 2, by)

SPARKS = [(rng.uniform(80, 1000), rng.uniform(220, 470), rng.uniform(8, 18), rng.uniform(0, 6.28)) for _ in range(12)]

def scene_instagram(c, t):
    p = ease_out(prog(t, 17.0, 17.75))
    py = lerp(H + 100, 560 + PH_H / 2, p)
    subscribed = t >= 19.75
    scr, btn_c = draw_screen(t, subscribed, 17.6)
    body = phone_body().copy()
    body.alpha_composite(scr, (SCR_PAD, SCR_PAD))
    paste(c, body, W / 2, py)
    top = py - PH_H / 2
    rp = prog(t, 19.5, 20.1)
    if 0 < rp < 1:
        bx, by = W / 2 - PH_W / 2 + SCR_PAD + btn_c[0], top + SCR_PAD + btn_c[1]
        rimg = ring_img(int(lerp(10, 140, ease_out(rp))), 3, CREAM, 255, 1000)
        paste(c, rimg, bx, by, alpha=1 - rp)
    size = fit_size("ABONNEZ-VOUS", "ExtraBold", 120, 4, 920)
    t0 = 18.3
    sw = lerp(-300, 1500, ((t - 19.0) % 1.6) / 1.6) if t > 19.0 else None
    settled = t > t0 + 12 * 0.04 + 0.4
    if not settled:
        letters(c, "ABONNEZ-VOUS", "ExtraBold", size, W / 2, 330, t, t0, "gold", tracking=4, stagger=0.04, dur=0.4, style="pop", glow=0.5)
    else:
        pulse = 1 + 0.035 * beat_pulse(t, 19.0)
        text(c, "ABONNEZ-VOUS", "ExtraBold", size, W / 2, 330, "gold", tracking=4, sweep=sw, glow=0.5 + 0.3 * beat_pulse(t, 19.0), scale=pulse)
    hp = prog(t, 18.9, 19.5)
    if hp > 0:
        n = int(len(HANDLE) * hp)
        text(c, HANDLE[:max(1, n)], "Medium", 42, W / 2 - layout(HANDLE, "Medium", 42)[1] / 2, 455, CREAM, anchor="left")
    hline(c, W / 2, 400, 560, ease_in_out(prog(t, 18.9, 19.3)), width=3)
    if t > 19.0:
        for (x, y, r, ph) in SPARKS:
            a = max(0, math.sin((t - 19.0) * 3 + ph)) ** 3
            star(c, x, y, r * (0.6 + 0.4 * a), a * 0.9)

def scene_hours(c, t):
    cp = ease_back(prog(t, 23.0, 23.4))
    if cp > 0:
        ang = lerp(0, math.pi * 2 * 1.5, ease_out(prog(t, 23.0, 24.2)))
        paste(c, icon("clock", 150, GOLD, 6, int(ang * 100) // 8 * 8), W / 2, 420, alpha=clamp(cp), scale=max(0.01, cp))
    letters(c, "HORAIRES", "Bold", 96, W / 2, 610, t, 23.15, "gold", tracking=14, stagger=0.04, dur=0.4, style="pop",
            sweep=lerp(-300, 1500, prog(t, 24.6, 25.4)) if 24.6 < t < 25.4 else None, glow=0.35)
    for i, (day, hours) in enumerate(HOURS):
        st = 23.5 + i * 0.5
        p = ease_out(prog(t, st, st + 0.4))
        if p <= 0:
            continue
        y = 800 + i * 165
        dx = lerp(80, 0, p)
        closed = hours == "FERMÉ"
        text(c, day, "SemiBold", 44, 150 - dx, y, CREAM if not closed else MUTED, alpha=p, anchor="left", tracking=2)
        text(c, hours, "Bold", 52, 930 + dx, y, "gold" if not closed else MUTED, alpha=p, anchor="right", tracking=2)
        hline(c, W / 2, y + 80, 780, ease_in_out(prog(t, st + 0.15, st + 0.55)), width=2, alpha=0.45)
    ap = ease_out(prog(t, 25.0, 25.4))
    if ap > 0:
        paste(c, icon("pin", 52), W / 2, 1335, alpha=ap)
        text(c, f"{ADDRESS} · 74000 Annecy", "Regular", 34, W / 2, 1405, CREAM, alpha=ap)

def scene_end(c, t):
    ring(c, W / 2, 700, 310, 3, ease_out(prog(t, 26.5, 27.3)))
    logo_draw(c, W / 2, 700, 560, t, 26.6, sweep_at=27.6)
    size = fit_size("ABONNEZ-VOUS", "ExtraBold", 96, 4, 760)
    sw = lerp(-300, 1500, prog(t, 28.2, 29.0)) if 28.2 < t < 29.0 else None
    letters(c, "ABONNEZ-VOUS", "ExtraBold", size, W / 2, 1100, t, 27.1, "gold", tracking=4, stagger=0.035, dur=0.35,
            style="pop", sweep=sw, glow=0.45)
    letters(c, HANDLE, "Medium", 46, W / 2, 1205, t, 27.6, CREAM, stagger=0.015, dur=0.3)
    ap = ease_out(prog(t, 27.9, 28.3))
    text(c, f"{ADDRESS} · 74000 Annecy", "Regular", 32, W / 2, 1280, CREAM, alpha=ap * 0.85)
    sp = ease_out(prog(t, 28.3, 28.8))
    text(c, "TIM DESIGN", "Light", 24, W / 2, 1450, CREAM, alpha=sp * 0.55, tracking=16)

SCENES = [(0.0, 3.5, scene_hook), (3.5, 7.5, scene_kinetic), (7.5, 12.0, scene_salon), (12.0, 17.0, scene_prices),
          (17.0, 23.0, scene_instagram), (23.0, 26.5, scene_hours), (26.5, 30.0, scene_end)]

# ------------------------------------------------------------------ frame
def zoom(img, z):
    if abs(z - 1) < 1e-3:
        return img
    nw, nh = int(W * z), int(H * z)
    big = img.resize((nw, nh), Image.BILINEAR)
    x, y = (nw - W) // 2, (nh - H) // 2
    return big.crop((x, y, x + W, y + H))

def render(t, fi=0):
    c = background().copy()
    draw_bokeh(c, t)
    for a, b, fn in SCENES:
        if a <= t < b:
            fn(c, t)
    img = c.convert("RGB")
    # transitions: zoom punch with blur trails + warm flash around each cut
    for cut in CUTS:
        d = t - cut
        if -0.2 <= d <= 0.2:
            k = 1 - abs(d) / 0.2
            z = 1 + 0.12 * k ** 2
            layers = [zoom(img, z * (1 + 0.025 * j * k)) for j in range(3)]
            img = Image.blend(Image.blend(layers[0], layers[1], 0.4), layers[2], 0.3)
            fl = max(0.0, 1 - abs(d) / 0.1) * 0.55
            if fl > 0:
                img = Image.blend(img, Image.new("RGB", (W, H), (255, 238, 200)), fl)
    if t > 29.3:
        img = Image.blend(img, Image.new("RGB", (W, H), BLACK), ease_in_out(prog(t, 29.3, 30.0)))
    arr = np.asarray(img).astype(np.float32) + GRAIN[fi % len(GRAIN)]
    return np.clip(arr, 0, 255).astype(np.uint8)

# ------------------------------------------------------------------ audio
SR = 48000

def synth_audio(path):
    n = int(SR * DUR)
    out = np.zeros(n, np.float32)
    tt = np.arange(n) / SR
    r = np.random.default_rng(7)

    def add(sig, at, gain=1.0):
        i = int(at * SR)
        if i >= n:
            return
        j = min(n, i + len(sig))
        out[i:j] += sig[: j - i] * gain

    def env(length, attack, decay):
        x = np.arange(int(length * SR)) / SR
        return np.minimum(1, x / max(attack, 1e-4)) * np.exp(-x * decay)

    def kick():
        x = np.arange(int(0.4 * SR)) / SR
        f = 45 + 90 * np.exp(-x * 30)
        ph = 2 * np.pi * np.cumsum(f) / SR
        return np.sin(ph) * np.exp(-x * 9)

    def hat():
        s = r.normal(0, 1, int(0.06 * SR))
        s = np.diff(s, prepend=0)
        return s * env(0.06, 0.0005, 70) * 0.5

    def lowpass(sig, a):
        y = np.empty_like(sig)
        acc = 0.0
        for i, v in enumerate(sig):
            acc += a * (v - acc)
            y[i] = acc
        return y

    def whoosh(length=0.55, rev=False):
        s = r.normal(0, 1, int(length * SR)).astype(np.float32)
        x = np.linspace(0, 1, len(s))
        e = np.sin(np.pi * x) ** 2
        s = lowpass(s, 0.08) * e
        return (s[::-1] if rev else s) * 1.6

    def impact():
        x = np.arange(int(1.2 * SR)) / SR
        f = 38 + 60 * np.exp(-x * 12)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 3.2)
        s[: int(0.03 * SR)] += r.normal(0, 0.5, int(0.03 * SR)) * np.exp(-np.arange(int(0.03 * SR)) / SR * 80)
        return s

    def ding():
        x = np.arange(int(1.6 * SR)) / SR
        return (np.sin(2 * np.pi * 1567.98 * x) * 0.6 + np.sin(2 * np.pi * 2093.0 * x) * 0.4
                + np.sin(2 * np.pi * 3135.96 * x) * 0.15) * np.exp(-x * 3.5) * np.minimum(1, x / 0.004)

    def click():
        s = r.normal(0, 1, int(0.012 * SR))
        return np.diff(s, prepend=0) * env(0.012, 0.0003, 300) * 0.6

    def riser(length):
        s = r.normal(0, 1, int(length * SR)).astype(np.float32)
        x = np.linspace(0, 1, len(s))
        return lowpass(s, 0.03) * x ** 2 * 2.0

    # chords (A minor feel): Am - F - C - G, 2 s per bar
    bars = [(55.0, [220.0, 261.63, 329.63]), (43.65, [174.61, 220.0, 261.63]),
            (65.41, [196.0, 261.63, 329.63]), (49.0, [196.0, 246.94, 293.66])]
    pad = np.zeros(n, np.float32)
    bass = np.zeros(n, np.float32)
    for k in range(int(DUR / 2) + 1):
        root, ch = bars[k % 4]
        a, b = int(k * 2 * SR), min(n, int((k + 1) * 2 * SR))
        if a >= n:
            break
        x = tt[a:b] - k * 2
        e = np.minimum(1, x / 0.25) * np.minimum(1, (2 - x) / 0.25)
        pad[a:b] += sum(np.sin(2 * np.pi * f * tt[a:b]) + 0.3 * np.sin(2 * np.pi * 2 * f * tt[a:b] + 0.3) for f in ch) * e * 0.045
        bass[a:b] += np.tanh(2.2 * np.sin(2 * np.pi * root * tt[a:b])) * e * 0.20
    # sidechain on the kick from the drop
    side = np.ones(n, np.float32)
    beats = np.arange(3.5, 29.0, BEAT)
    for bt in beats:
        i = int(bt * SR)
        L = int(0.25 * SR)
        j = min(n, i + L)
        side[i:j] = np.minimum(side[i:j], 0.35 + 0.65 * (np.arange(j - i) / L))
    music = pad * np.where(tt < 3.5, 1.0, side) + bass * np.where(tt < 3.5, 0.0, side)
    out += music
    for bt in beats:
        add(kick(), bt, 0.9)
        add(hat(), bt + BEAT / 2, 0.35)
    add(riser(3.0), 0.5, 0.25)
    add(impact(), 3.5, 0.9)
    for cut in CUTS[1:]:
        add(whoosh(), cut - 0.3, 0.22)
        add(impact(), cut, 0.35)
    for k in range(3):
        add(click(), 8.0 + k * 0.5, 0.5)
    for k in range(7):
        add(click(), 12.6 + k * 0.26 + (0.25 if k >= 4 else 0), 0.4)
    add(ding(), 18.3, 0.28)
    add(click(), 19.5, 0.6)
    add(ding(), 27.1, 0.22)
    fade = np.clip((DUR - tt) / 1.5, 0, 1)
    out *= fade
    out /= max(1e-6, np.abs(out).max()) / 0.89
    pcm = (out * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())

# ------------------------------------------------------------------ main
def main():
    OUT.mkdir(exist_ok=True)
    if sys.argv[1] == "frames":
        (OUT / "frames").mkdir(exist_ok=True)
        for ts in sys.argv[2:]:
            t = float(ts)
            Image.fromarray(render(t, int(t * FPS))).save(OUT / "frames" / f"t{t:05.2f}.png")
        return
    silent = OUT / "atelier47_motion_sans_son.mp4"
    proc = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                             "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17",
                             "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(silent)], stdin=subprocess.PIPE)
    total = int(DUR * FPS)
    for fi in range(total):
        proc.stdin.write(render(fi / FPS, fi).tobytes())
        if fi % 60 == 0:
            print(f"frame {fi}/{total}", flush=True)
    proc.stdin.close()
    proc.wait()
    wav = OUT / "son.wav"
    synth_audio(wav)
    final = OUT / "atelier47_motion.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(silent), "-i", str(wav), "-c:v", "copy", "-c:a", "aac",
                    "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(final)], check=True)
    wav.unlink()
    print("done", final)

if __name__ == "__main__":
    main()
