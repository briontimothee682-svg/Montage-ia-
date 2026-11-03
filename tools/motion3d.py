"""Composites the 3D layer (exports/frames3d, rendered by tools/render3d/render.js) with 2D text,
transitions, grain and sound into the final 3D motion design reel.

Usage:
  python3 tools/motion3d.py screens          # phone screen textures for the 3D phone (exports/screen)
  python3 tools/motion3d.py frames 1.0 ...   # composite test frames to exports/test_comp/
  python3 tools/motion3d.py video            # exports/atelier47_motion_3d.mp4 (+ silent version)
"""
import math, subprocess, sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import motion as m  # noqa: E402
from motion import (W, H, FPS, DUR, CUTS, GOLD, CREAM, MUTED, PANEL, ADDRESS, CITY, HANDLE, HOURS, PRICES,
                    prog, ease_out, ease_in_out, ease_back, lerp, clamp, text, letters, hline, icon, ring, paste, layout,
                    panel, star, beat_pulse, SPARKS, FEATURES)

ROOT = m.ROOT
DUR = 36.5                       # 8 s Instagram phone sequence + 4.5 s business-card scene
CUTS = [3.5, 7.5, 12.0, 17.0, 25.0, 28.5, 33.0]
END_T = 33.0
m.DUR, m.END_T = DUR, END_T
OUT = m.OUT
F3D = OUT / "frames3d"

# ------------------------------------------------------------------ look
@lru_cache(maxsize=None)
def grade_maps():
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    glow = np.exp(-(((x - W / 2) / (W * 0.8)) ** 2 + ((y - H * 0.4) / (H * 0.5)) ** 2))
    add = (np.array([30, 22, 8], np.float32) * glow[..., None])
    vign = np.clip(1 - 0.5 * ((((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2) / 2) ** 1.2, 0, 1)[..., None]
    return add, vign

def base_frame(fi):
    im = Image.open(F3D / f"f{fi:04d}.png").convert("RGB")
    arr = np.asarray(im).astype(np.float32)
    add, vign = grade_maps()
    arr = (arr + add) * vign
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

# ------------------------------------------------------------------ 2D overlays (the 3D layer carries logo, titles, tools, phone)
# ------------------------------------------------------------------ legibility: dark plates behind every text block
m.SHADOW = 0.9
m.GLOW_SCALE = 0.4
MUTED = (226, 220, 208)          # secondary text, brighter than the 2D reel

@lru_cache(maxsize=None)
def plate_img(w, h, r=30):
    return panel(w, h, radius=r, fill=(10, 10, 10), border_a=110, bw=2)

def plate(c, cx, cy, w, h, alpha):
    if alpha > 0.01:
        paste(c, plate_img(int(w), int(h)), cx, cy, alpha=clamp(alpha) * 0.84)

def o_hook(c, t):
    # hook readable on the very first frame (most viewers decide in under 2 s, often with the sound off)
    hp = ease_out(prog(t, 0.0, 0.35))
    plate(c, W / 2, 302, 800, 205, 1.0)
    sw = lerp(-300, 1400, prog(t, 0.5, 1.3)) if 0.5 < t < 1.3 else None
    text(c, "ANNECY,", "ExtraBold", 70, W / 2, 260, "gold", tracking=8, scale=lerp(1.3, 1.0, hp) * (1 + 0.03 * beat_pulse(t, 0.0)),
         sweep=sw, glow=0.4)
    text(c, "TON BARBIER EST ICI", "Bold", 56, W / 2, 344, CREAM, tracking=4, scale=lerp(1.18, 1.0, hp))
    plate(c, W / 2, 1322, 900, 340, prog(t, 1.15, 1.45))
    p = ease_back(prog(t, 1.25, 1.6))
    if p > 0:
        paste(c, icon("pin", 74), W / 2, 1192 + 6 * math.sin(t * 3), alpha=clamp(p), scale=max(0.01, p))
    letters(c, ADDRESS.upper(), "SemiBold", 48, W / 2, 1278, t, 1.35, CREAM, tracking=5, stagger=0.018, dur=0.35)
    sw = lerp(-200, 1400, prog(t, 2.6, 3.3)) if 2.6 < t < 3.3 else None
    letters(c, CITY, "Bold", 92, W / 2, 1388, t, 1.75, "gold", tracking=10, stagger=0.045, dur=0.4, style="pop", sweep=sw, glow=0.35)
    hline(c, W / 2, 1462, 540, ease_in_out(prog(t, 2.25, 2.75)), width=3)

def o_kinetic(c, t):
    plate(c, W / 2, 300, 470, 88, prog(t, 3.55, 3.8))
    letters(c, "ATELIER 47", "SemiBold", 42, W / 2, 300, t, 3.6, GOLD, tracking=18, stagger=0.03, dur=0.3)
    t0 = 3.5 if t < 5.5 else 5.5
    hline(c, W / 2, 1290, 760, ease_in_out(prog(t, t0 + 0.9, t0 + 1.3)), width=3)
    if t >= 5.5:
        plate(c, W / 2, 1392, 900, 84, prog(t, 6.5, 6.75))
        letters(c, "COUPE NETTE · BARBE SOIGNÉE", "SemiBold", 34, W / 2, 1392, t, 6.6, CREAM, tracking=8, stagger=0.015)

@lru_cache(maxsize=None)
def small_card():
    return panel(900, 170, radius=28, fill=(14, 13, 11), border_a=130)

def o_salon(c, t):
    plate(c, W / 2, 368, 740, 225, prog(t, 7.55, 7.8))
    letters(c, "LE SALON", "Bold", 44, W / 2, 300, t, 7.55, GOLD, tracking=22, stagger=0.03)
    hline(c, W / 2, 352, 150, ease_out(prog(t, 7.8, 8.1)), width=3)
    letters(c, "Pensé pour vous", "Regular", 70, W / 2, 428, t, 7.7, CREAM, stagger=0.03, dur=0.45)
    for i, (ic, title, sub) in enumerate(FEATURES):
        st = 8.4 + i * 0.5
        p = ease_out(prog(t, st, st + 0.45))
        if p <= 0:
            continue
        y = 1010 + i * 190 + 5 * math.sin(t * 2.2 + i)
        dx = lerp(700, 0, p)
        a = clamp(p * 1.5)
        paste(c, small_card(), W / 2 + dx, y, alpha=a)
        ring(c, 205 + dx, y, 56, 2, 1.0, alpha=a * 0.9)
        pul = 1 + 0.07 * beat_pulse(t, st)
        paste(c, icon(ic, 72), 205 + dx, y, alpha=a, scale=pul)
        text(c, title, "SemiBold", 42, 295 + dx, y - 28, CREAM, alpha=a, anchor="left")
        text(c, sub, "Medium", 31, 295 + dx, y + 32, MUTED, alpha=a, anchor="left")

def o_prices(c, t):
    pp = ease_out(prog(t, 12.15, 12.6))
    if pp <= 0:
        return
    oy = lerp(120, 0, pp)
    paste(c, m.price_panel(), W / 2, 960 + oy, alpha=clamp(pp * 1.4))
    y = 540 + oy
    row = 0
    for si, (section, items) in enumerate(PRICES):
        if si == 1:
            hline(c, W / 2, y - 20, 760, ease_in_out(prog(t, 13.5, 13.9)), width=2, alpha=0.7)
            y += 40
        sp = ease_out(prog(t, 12.4 + si * 1.1, 12.75 + si * 1.1))
        text(c, section, "Bold", 42, 150, y, GOLD, alpha=sp, tracking=10, anchor="left")
        y += 90
        for name, price in items:
            st = 12.6 + row * 0.26 + si * 0.25
            p = ease_out(prog(t, st, st + 0.35))
            if p > 0:
                dx = lerp(-60, 0, p)
                text(c, name, "SemiBold", 40, 150 + dx, y, CREAM, alpha=p, anchor="left")
                cnt = int(round(price * ease_out(prog(t, st + 0.05, st + 0.45))))
                pop = 1 + 0.25 * (1 - ease_out(prog(t, st + 0.4, st + 0.65))) * (t > st + 0.4)
                text(c, f"{cnt}€", "Bold", 50, 930, y, "gold", alpha=p, anchor="right", scale=pop)
                _, nw = layout(name, "SemiBold", 40)
                lead_x0, lead_x1 = 150 + nw + 24, 930 - 120
                n = int((lead_x1 - lead_x0) / 18)
                dot = Image.new("RGBA", (4, 4), (GOLD[0], GOLD[1], GOLD[2], 160))
                for k in range(max(0, n)):
                    if k / max(1, n) <= p:
                        paste(c, dot, lead_x0 + k * 18, y + 14)
            y += 92
            row += 1

def o_instagram(c, t):
    hline(c, W / 2, 415, 560, ease_in_out(prog(t, 20.6, 21.0)), width=3)
    if t > 20.7:
        for (x, y, r, ph) in SPARKS:
            a = max(0, math.sin((t - 20.7) * 3 + ph)) ** 3
            star(c, x, y - 20, r * (0.6 + 0.4 * a), a * 0.9)

def o_hours(c, t):
    plate(c, W / 2, 968, 940, 560, prog(t, 25.4, 25.7))
    for i, (day, hours) in enumerate(HOURS):
        st = 25.5 + i * 0.5
        p = ease_out(prog(t, st, st + 0.4))
        if p <= 0:
            continue
        y = 800 + i * 165
        dx = lerp(80, 0, p)
        closed = hours == "FERMÉ"
        text(c, day, "Bold", 46, 150 - dx, y, CREAM if not closed else MUTED, alpha=p, anchor="left", tracking=2)
        text(c, hours, "Bold", 56, 930 + dx, y, "gold" if not closed else MUTED, alpha=p, anchor="right", tracking=2,
             scale=1 + 0.03 * beat_pulse(t, st + 0.5))
        if i < len(HOURS) - 1:
            hline(c, W / 2, y + 82, 780, ease_in_out(prog(t, st + 0.15, st + 0.55)), width=2, alpha=0.5)
    ap = ease_out(prog(t, 27, 27.4))
    if ap > 0:
        plate(c, W / 2, 1378, 940, 170, ap)
        paste(c, icon("pin", 52), W / 2, 1340, alpha=ap)
        text(c, f"{ADDRESS} · 74000 Annecy", "SemiBold", 38, W / 2, 1408, CREAM, alpha=ap)

def o_card(c, t):
    plate(c, W / 2, 304, 820, 108, prog(t, 28.6, 28.85))
    out = ease_in_out(prog(t, 31.1, 31.35))
    if out < 1:  # "NOTRE CARTE" first, then the scan call-to-action takes its place above the card
        if t < 31.1:
            letters(c, "NOTRE CARTE", "Bold", 44, W / 2, 300, t, 28.6, GOLD, tracking=20, stagger=0.03)
        else:
            text(c, "NOTRE CARTE", "Bold", 44, W / 2, 300, GOLD, alpha=1 - out, tracking=20)
    cp = ease_back(prog(t, 31.35, 31.75))
    if cp > 0:
        text(c, "SCANNE · ABONNE-TOI", "ExtraBold", 48, W / 2, 300, CREAM, alpha=clamp(cp), tracking=8,
             scale=max(0.01, cp) * (1 + 0.04 * beat_pulse(t, 31.5)))

def o_end(c, t):
    plate(c, W / 2, 1300, 940, 300, prog(t, 34, 34.3))
    letters(c, HANDLE, "SemiBold", 50, W / 2, 1210, t, 34.1, CREAM, stagger=0.015, dur=0.3)
    ap = ease_out(prog(t, 34.4, 34.8))
    text(c, f"{ADDRESS} · 74000 Annecy", "Medium", 36, W / 2, 1288, CREAM, alpha=ap)
    cp = ease_back(prog(t, 34.5, 34.9))
    if cp > 0:
        text(c, "ENREGISTRE · PARTAGE À UN POTE", "Bold", 36, W / 2, 1370, GOLD, alpha=clamp(cp), tracking=6,
             scale=max(0.01, cp) * (1 + 0.04 * beat_pulse(t, 35)))
    sp = ease_out(prog(t, 34.8, 35.3))
    text(c, "TIM DESIGN", "Light", 26, W / 2, 1468, CREAM, alpha=sp * 0.7, tracking=16)

OVERLAYS = [(0.0, 3.5, o_hook), (3.5, 7.5, o_kinetic), (7.5, 12.0, o_salon), (12.0, 17.0, o_prices),
            (17.0, 25, o_instagram), (25, 28.5, o_hours), (28.5, 33, o_card), (33, DUR, o_end)]

# ------------------------------------------------------------------ light-line transitions (like the reference reel)
TRAIL_EVENTS = [(0.5, (540, 740))] + [(c_, (540, 940)) for c_ in CUTS]

def light_trails(arr, t):
    from PIL import ImageDraw, ImageFilter
    for ev, (cx, cy) in TRAIL_EVENTS:
        d = t - ev
        if not (-0.36 <= d <= 0.06):
            continue
        k = ease_in_out(prog(t, ev - 0.36, ev))
        core = Image.new("L", (W // 2, H // 2), 0)
        dr = ImageDraw.Draw(core)
        rng = np.random.default_rng(int(ev * 100))
        for j in range(6):
            a = rng.uniform(0, 2 * math.pi)
            r0 = rng.uniform(1300, 1700)
            sx, sy = cx + math.cos(a) * r0, cy + math.sin(a) * r0
            ox, oy = cx + rng.uniform(-60, 60), cy + rng.uniform(-60, 60)
            hk, tk = min(1.0, k * 1.15), max(0.0, k * 1.15 - 0.42)
            hx, hy = lerp(sx, ox, hk), lerp(sy, oy, hk)
            tx, ty = lerp(sx, ox, tk), lerp(sy, oy, tk)
            if d > 0:
                continue
            dr.line((tx / 2, ty / 2, hx / 2, hy / 2), fill=255, width=2)
        glow = core.filter(ImageFilter.GaussianBlur(7))
        c_ = np.asarray(core.resize((W, H), Image.BILINEAR)).astype(np.float32)[..., None] / 255
        g_ = np.asarray(glow.resize((W, H), Image.BILINEAR)).astype(np.float32)[..., None] / 255
        arr += c_ * np.array([255, 250, 240], np.float32) * 1.0 + g_ * np.array([110, 220, 255], np.float32) * 1.5
        burst = max(0.0, 1 - abs(d) / 0.09)          # convergence burst
        if burst > 0:
            yy, xx = np.ogrid[0:H, 0:W]
            rad = np.exp(-(((xx - cx) / 260.0) ** 2 + ((yy - cy) / 260.0) ** 2))
            arr += rad[..., None] * np.array([200, 240, 255], np.float32) * 0.7 * burst
    return arr

def streaks(img):
    """Anamorphic horizontal light streaks on the brightest highlights."""
    arr = np.asarray(img).astype(np.float32)
    lum = arr.max(axis=2)
    bright = np.clip((lum - 228) / 27.0, 0, 1) ** 2
    sm = Image.fromarray((bright * 255).astype(np.uint8), "L").resize((W // 8, H // 8), Image.BOX)
    sm = sm.resize((W // 96, H // 8), Image.BOX).resize((W // 8, H // 8), Image.BILINEAR)
    st = np.asarray(sm.resize((W, H), Image.BILINEAR)).astype(np.float32)[..., None] / 255.0
    arr += st * np.array([255, 222, 165], np.float32) * 0.22
    return arr

@lru_cache(maxsize=None)
def leak_sprite():
    y, x = np.mgrid[0:H, 0:W // 2].astype(np.float32)
    g = np.exp(-(((x - W / 4) / (W * 0.22)) ** 2 + ((y - H * 0.45) / (H * 0.42)) ** 2))
    return g[..., None] * np.array([255, 150, 60], np.float32)

def composite(fi):
    t = fi / FPS
    c = base_frame(fi)
    for a, b, fn in OVERLAYS:
        if a <= t < b:
            fn(c, t)
    arr = streaks(c.convert("RGB"))
    arr = light_trails(arr, t)
    for cut in CUTS:
        d = t - cut
        if abs(d) <= 0.35:  # warm light leak sweeping across the cut
            k = 1 - abs(d) / 0.35
            x0 = int(lerp(-W / 2, W, (d + 0.35) / 0.7))
            sp = leak_sprite()
            a0, a1 = max(0, x0), min(W, x0 + W // 2)
            if a1 > a0:
                arr[:, a0:a1] += sp[:, a0 - x0:a1 - x0] * 0.22 * k
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
    for cut in CUTS:
        d = t - cut
        if -0.2 <= d <= 0.2:
            k = 1 - abs(d) / 0.2
            z = 1 + 0.14 * k ** 2
            layers = [m.zoom(img, z * (1 + 0.03 * j * k)) for j in range(3)]
            img = Image.blend(Image.blend(layers[0], layers[1], 0.4), layers[2], 0.3)
            sh = int(10 * k)
            if sh > 0:  # chromatic aberration
                r, g, b = img.split()
                r = Image.fromarray(np.roll(np.asarray(r), sh, axis=1))
                b = Image.fromarray(np.roll(np.asarray(b), -sh, axis=1))
                img = Image.merge("RGB", (r, g, b))
            fl = max(0.0, 1 - abs(d) / 0.1) * 0.32
            if fl > 0:
                img = Image.blend(img, Image.new("RGB", (W, H), (255, 238, 200)), fl)
    if t > DUR - 0.7:
        img = Image.blend(img, Image.new("RGB", (W, H), m.BLACK), ease_in_out(prog(t, DUR - 0.7, DUR)))
    arr = np.asarray(img).astype(np.float32) + m.GRAIN[fi % len(m.GRAIN)] * 0.6
    return np.clip(arr, 0, 255).astype(np.uint8)


# ------------------------------------------------------------------ Instagram-style phone screens (post that plays, then profile)
# Counters are illustrative: replace with the real figures of the account before publishing.
IG = {"posts": 47, "followers": (1230, 1316), "following": 180, "likes": (318, 542), "comments": (24, 61)}
NOTIFS = [(20.9, 21.3, "Nos tarifs", "Coupe Homme 22 € · Barbe 15 €"),
          (21.6, 22.0, "Atelier 47 Barbier", "12 rue de la République, Annecy")]
BANNER_Y = 130          # banner centre on the 560x1200 screen (top, over the app)
FOLLOW_PILL = (470, 118)
HEART_ICON, COMMENT_ICON = (40, 770), (100, 770)
POST_START, PROFILE_AT, TILES_OUT = 18.0, 20.25, 22.3
GRID_Y, GRID_T = 580, 172

def fr_num(n):
    return f"{n:,}".replace(",", " ")

@lru_cache(maxsize=None)
def banner(i, S=1):
    _, _, title, body = NOTIFS[i]
    w, h = 520 * S, 130 * S
    im = panel(w, h, radius=30 * S, fill=(30, 28, 24), border_a=90, bw=2 * S)
    av = m.avatar(84 * S)
    im.alpha_composite(av, (22 * S, (h - av.height) // 2))
    text(im, title, "SemiBold", 26 * S, 124 * S, h / 2 - 20 * S, CREAM, anchor="left")
    text(im, body, "Regular", 22 * S, 124 * S, h / 2 + 22 * S, MUTED, anchor="left")
    text(im, "maintenant", "Regular", 18 * S, w - 22 * S, h / 2 - 22 * S, MUTED, anchor="right")
    return im

def _heart_pts(cx, cy, s):
    pts = []
    for k in range(60):
        a = k / 60 * 2 * math.pi
        x = 16 * math.sin(a) ** 3
        y = 13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a)
        pts.append((cx + x * s, cy - y * s))
    return pts

@lru_cache(maxsize=None)
def ig_icon(name, filled=False, size=44):
    from PIL import ImageDraw
    S3 = 3
    im = Image.new("RGBA", (size * S3, size * S3), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c, s, w = size * S3 / 2, size * S3, int(3.2 * S3)
    col = (243, 238, 227, 255)
    if name == "heart":
        pts = _heart_pts(c, c + s * 0.02, s / 38)
        if filled:
            d.polygon(pts, fill=(255, 48, 84, 255))
        else:
            d.line(pts + [pts[0]], fill=col, width=w, joint="curve")
    elif name == "comment":
        d.ellipse((s * 0.12, s * 0.12, s * 0.88, s * 0.86), outline=col, width=w)
        d.polygon([(s * 0.2, s * 0.72), (s * 0.12, s * 0.92), (s * 0.38, s * 0.82)], fill=col)
    elif name == "share":
        d.line([(s * 0.1, s * 0.45), (s * 0.9, s * 0.12), (s * 0.62, s * 0.9), (s * 0.45, s * 0.55), (s * 0.1, s * 0.45)], fill=col, width=w, joint="curve")
        d.line([(s * 0.45, s * 0.55), (s * 0.9, s * 0.12)], fill=col, width=w)
    elif name == "save":
        d.line([(s * 0.22, s * 0.1), (s * 0.78, s * 0.1), (s * 0.78, s * 0.9), (s * 0.5, s * 0.66), (s * 0.22, s * 0.9), (s * 0.22, s * 0.1)], fill=col, width=w, joint="curve")
    elif name == "home":
        d.line([(s * 0.12, s * 0.5), (s * 0.5, s * 0.14), (s * 0.88, s * 0.5), (s * 0.88, s * 0.88), (s * 0.12, s * 0.88), (s * 0.12, s * 0.5)], fill=col, width=w, joint="curve")
    elif name == "search":
        d.ellipse((s * 0.12, s * 0.12, s * 0.7, s * 0.7), outline=col, width=w); d.line([(s * 0.62, s * 0.62), (s * 0.9, s * 0.9)], fill=col, width=w)
    elif name == "reels":
        d.rounded_rectangle((s * 0.12, s * 0.12, s * 0.88, s * 0.88), radius=s * 0.2, outline=col, width=w)
        d.polygon([(s * 0.42, s * 0.38), (s * 0.42, s * 0.68), (s * 0.66, s * 0.53)], fill=col)
    elif name == "plus":
        d.rounded_rectangle((s * 0.12, s * 0.12, s * 0.88, s * 0.88), radius=s * 0.2, outline=col, width=w)
        d.line([(s * 0.5, s * 0.3), (s * 0.5, s * 0.7)], fill=col, width=w); d.line([(s * 0.3, s * 0.5), (s * 0.7, s * 0.5)], fill=col, width=w)
    return im.resize((size, size), Image.LANCZOS)

def post_media(t):
    """The post 'video' is the 3D tool showcase of the reel itself."""
    fi = int(min(355, 238 + (t - POST_START) * FPS))
    f = F3D / f"f{fi:04d}.png"
    if not f.exists():
        return Image.new("RGB", (560, 560), (20, 18, 14))
    im = Image.open(f).convert("RGB").crop((140, 320, 940, 1120)).resize((560, 560), Image.LANCZOS)
    arr = np.asarray(im).astype(np.float32) * 1.25 + np.array([10, 8, 4], np.float32)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")

def nav_bar(scr):
    for i, n in enumerate(["home", "search", "plus", "reels"]):
        paste(scr, ig_icon(n, size=40), 70 + i * 140, 1150)
    paste(scr, m.avatar(40), 70 + 3.85 * 140, 1150)

def post_screen(t):
    scr = Image.new("RGBA", (560, 1200), (0, 0, 0, 255))
    text(scr, "Pour toi", "Bold", 28, 280, 55, CREAM)
    scr.alpha_composite(m.avatar(56), (20, 90))
    text(scr, "atelier47barbier", "SemiBold", 22, 88, 108, CREAM, anchor="left")
    text(scr, "Annecy", "Regular", 17, 88, 134, MUTED, anchor="left")
    followed = t >= PROFILE_AT
    pill = panel(120, 40, radius=12, fill=GOLD if not followed else (40, 38, 34), border_a=0 if not followed else 160, bw=1)
    paste(scr, pill, *FOLLOW_PILL)
    text(scr, "Abonné" if followed else "S'abonner", "SemiBold", 18, FOLLOW_PILL[0], FOLLOW_PILL[1], m.BLACK if not followed else CREAM)
    scr.paste(post_media(t), (0, 170))
    pr = clamp((t - POST_START) / 2.2)
    bar = Image.new("RGBA", (int(540 * pr) + 1, 4), (243, 238, 227, 200)); paste(scr, bar, 10, 726, anchor="left")
    big = prog(t, 18.42, 18.95)                       # double-tap heart on the media
    if 0 < big < 1:
        sc = ease_back(clamp(big * 2.2), 2.0) * (1 - 0.15 * big)
        h = ig_icon("heart", True, 180)
        paste(scr, h, 280, 450, alpha=clamp((1 - big) * 2.5), scale=max(0.01, sc))
    liked = t >= 18.45
    paste(scr, ig_icon("heart", liked, 44), *HEART_ICON, scale=1 + 0.35 * math.sin(math.pi * prog(t, 18.45, 18.7)))
    paste(scr, ig_icon("comment", size=42), *COMMENT_ICON)
    paste(scr, ig_icon("share", size=42), 160, 770)
    paste(scr, ig_icon("save", size=42), 520, 770)
    lk = int(lerp(IG["likes"][0], IG["likes"][1], ease_in_out(prog(t, 18.45, 20.1))))
    cm = int(lerp(IG["comments"][0], IG["comments"][1], ease_in_out(prog(t, 18.9, 20.1))))
    text(scr, f"{fr_num(lk)} J'aime", "Bold", 22, 22, 820, CREAM, anchor="left")
    text(scr, "atelier47barbier", "Bold", 20, 22, 856, CREAM, anchor="left")
    text(scr, "Coupe nette, barbe soignée.", "Regular", 20, 200, 856, CREAM, anchor="left")
    text(scr, f"Voir les {cm} commentaires", "Regular", 19, 22, 892, MUTED, anchor="left")
    text(scr, "12 rue de la République · Annecy", "Regular", 17, 22, 926, MUTED, anchor="left")
    nav_bar(scr)
    return scr

def profile_screen(t, lifted):
    scr = Image.new("RGBA", (560, 1200), (0, 0, 0, 255))
    text(scr, "atelier47barbier", "Bold", 28, 30, 70, CREAM, anchor="left")
    scr.alpha_composite(m.avatar(150), (24, 120))
    rc = m.ring_img(80, 3, GOLD, 255, 1000)
    scr.alpha_composite(rc, (24 + 75 - rc.width // 2, 120 + 75 - rc.height // 2))
    fo = int(lerp(IG["followers"][0], IG["followers"][1], ease_in_out(prog(t, 21.0, 23.2))))
    if t >= 20.95:
        fo = max(fo, IG["followers"][0] + 1)
    bump = 1 + 0.12 * math.sin(math.pi * ((t * 6) % 1)) * (21.0 < t < 23.2)
    for x, val, lab, sc in [(270, fr_num(IG["posts"]), "publications", 1), (385, fr_num(fo), "abonnés", bump), (500, fr_num(IG["following"]), "abonnements", 1)]:
        text(scr, val, "Bold", 30, x, 175, CREAM if lab != "abonnés" else (255, 236, 190), scale=sc)
        text(scr, lab, "Regular", 16, x, 212, MUTED)
    text(scr, "Atelier 47 Barbier", "SemiBold", 24, 30, 315, CREAM, anchor="left")
    text(scr, "Barbier · Annecy", "Regular", 20, 30, 350, MUTED, anchor="left")
    text(scr, "Coupe nette · Barbe soignée", "Regular", 20, 30, 380, CREAM, anchor="left")
    text(scr, "12 rue de la République", "Regular", 20, 30, 410, CREAM, anchor="left")
    followed = t >= 20.95
    for x, lab, gold_ in [(146, "Abonné" if followed else "S'abonner", not followed), (414, "Message", False)]:
        b = panel(248, 54, radius=14, fill=GOLD if gold_ else (38, 36, 32), border_a=0, bw=1)
        paste(scr, b, x, 490)
        text(scr, lab, "SemiBold", 21, x, 490, m.BLACK if gold_ else CREAM)
    tl, T = m.tiles()
    for i, tile in enumerate(tl):
        r, col = divmod(i, 3)
        x, y = 6 + col * (GRID_T + 4), GRID_Y + r * (GRID_T + 4)
        if lifted:
            scr.alpha_composite(panel(GRID_T, GRID_T, radius=6, fill=(20, 19, 16), border_a=70, bw=1), (x, y))
        else:
            scr.alpha_composite(tile.resize((GRID_T, GRID_T), Image.LANCZOS), (x, y))
    nav_bar(scr)
    return scr

def app_screen(t):
    wake = ease_out(prog(t, 17.95, 18.25))
    if wake <= 0:
        return Image.new("RGB", (560, 1200), (0, 0, 0))
    if t < PROFILE_AT:
        scr = post_screen(t)
    else:
        sl = ease_in_out(prog(t, PROFILE_AT, PROFILE_AT + 0.3))   # profile slides in from the right
        lifted = TILES_OUT + 0.05 <= t < 24.75
        prof = profile_screen(t, lifted)
        if sl < 1:
            scr = Image.new("RGBA", (560, 1200), (0, 0, 0, 255))
            scr.alpha_composite(post_screen(t), (int(-560 * sl * 0.35), 0))
            scr.alpha_composite(prof, (int(560 * (1 - sl)), 0))
        else:
            scr = prof
    # taps (ripples) and notification banners over the app
    for tx, ty, tt in [(280, 450, 18.42), (FOLLOW_PILL[0], FOLLOW_PILL[1], PROFILE_AT), (146, 490, 20.92)]:
        q = prog(t, tt - 0.03, tt + 0.3)
        if 0 < q < 1:
            paste(scr, m.ring_img(int(lerp(8, 90, ease_out(q))), 3, CREAM, 255, 1000), tx, ty, alpha=1 - q)
    for i, (ap, tap, _, _) in enumerate(NOTIFS):
        if not (ap <= t < tap + 0.08):
            continue
        p = ease_out(prog(t, ap, ap + 0.25))
        y = lerp(-90, BANNER_Y, p)
        sc = 1 - 0.04 * math.sin(math.pi * prog(t, tap - 0.06, tap + 0.08))
        paste(scr, banner(i), 280, y, alpha=clamp(p * 1.5), scale=sc)
        q = prog(t, tap - 0.05, tap + 0.3)
        if 0 < q < 1:
            paste(scr, m.ring_img(int(lerp(10, 120, ease_out(q))), 3, CREAM, 255, 1000), 280, y, alpha=1 - q)
    bg = Image.new("RGBA", scr.size, (0, 0, 0, 255))
    bg.alpha_composite(scr)
    arr = np.asarray(bg.convert("RGB")).astype(np.float32) * wake
    return Image.fromarray(arr.astype(np.uint8), "RGB")

def screens():
    (OUT / "screen").mkdir(parents=True, exist_ok=True)
    for fi in range(int(17 * FPS), int(25 * FPS)):
        app_screen(fi / FPS).save(OUT / "screen" / f"s{fi:04d}.png")
    # the JS side needs the 3D source positions of what leaves the screen
    import json
    (OUT / "holo").mkdir(parents=True, exist_ok=True)
    loc = lambda x, y: [x - 280, 600 - y]
    (OUT / "holo" / "ig_layout.json").write_text(json.dumps({
        "follow": loc(*FOLLOW_PILL), "banner": loc(280, BANNER_Y), "heart": loc(*HEART_ICON), "comment": loc(*COMMENT_ICON),
        "grid": [loc(6 + (i % 3) * (GRID_T + 4) + GRID_T / 2, GRID_Y + (i // 3) * (GRID_T + 4) + GRID_T / 2) for i in range(9)],
        "gridT": GRID_T, "notifs": [[a, b] for a, b, _, _ in NOTIFS], "profileAt": PROFILE_AT, "tilesOut": TILES_OUT,
        "followers": list(IG["followers"])}))

def holo_assets():
    """Textures for the 3D sections that rise out of the phone."""
    d = OUT / "holo"
    d.mkdir(parents=True, exist_ok=True)
    tl, T = m.tiles()
    for i, tile in enumerate(tl):
        tile.resize((T * 2, T * 2), Image.LANCZOS).save(d / f"tile{i}.png")
    for i in range(len(NOTIFS)):
        banner(i, 2).save(d / f"banner{i}.png")
    S = 2

    def base(w, h):
        return panel(w * S, h * S, radius=34 * S, fill=(16, 15, 13), border_a=210, bw=3 * S)

    def follow(followed):
        w, h = 820, 260
        im = base(w, h)
        av = m.avatar(120 * S)
        im.alpha_composite(av, (36 * S, 26 * S))
        rc = m.ring_img(62 * S, 2 * S, GOLD, 255, 1000)
        im.alpha_composite(rc, (36 * S + 60 * S - rc.width // 2, 26 * S + 60 * S - rc.height // 2))
        text(im, HANDLE, "Bold", 38 * S, 186 * S, 62 * S, CREAM, anchor="left")
        text(im, "Atelier 47 Barbier · Annecy", "Regular", 26 * S, 186 * S, 108 * S, MUTED, anchor="left")
        bw_, bh_ = 760 * S, 74 * S
        btn, dr = m.ss_layer(bw_, bh_)
        if followed:
            dr.rounded_rectangle((9, 9, bw_ * 3 - 9, bh_ * 3 - 9), radius=20 * S * 3, fill=(30, 28, 24, 255), outline=(243, 238, 227, 210), width=9)
        else:
            dr.rounded_rectangle((0, 0, bw_ * 3, bh_ * 3), radius=20 * S * 3, fill=(GOLD[0], GOLD[1], GOLD[2], 255))
        btn = m.ss_done(btn)
        if followed:
            text(btn, "Abonné", "SemiBold", 32 * S, bw_ / 2 + 22 * S, bh_ / 2, CREAM)
            ck = icon("check", 36 * S, CREAM, 9)
            btn.alpha_composite(ck, (int(bw_ / 2 - 100 * S), int(bh_ / 2 - ck.height / 2)))
        else:
            text(btn, "S'abonner", "SemiBold", 34 * S, bw_ / 2, bh_ / 2, m.BLACK)
        im.alpha_composite(btn, (30 * S, 166 * S))
        return im

    follow(False).save(d / "card_follow.png")
    follow(True).save(d / "card_followed.png")

    im = base(560, 340)
    text(im, "NOS TARIFS", "Bold", 34 * S, 280 * S, 52 * S, "gold", tracking=6 * S)
    rows = [("Coupe Homme", 22), ("Dégradé / Fade", 25), ("Barbe", 15), ("Coupe + barbe + shampoing", 38)]
    for k, (name, price) in enumerate(rows):
        y = (118 + k * 58) * S
        text(im, name, "Medium", 25 * S, 34 * S, y, CREAM, anchor="left")
        text(im, f"{price} €", "Bold", 28 * S, (560 - 34) * S, y, "gold", anchor="right")
        if k < len(rows) - 1:
            hline(im, 280 * S, y + 29 * S, 492 * S, 1.0, width=S, alpha=0.35)
    im.save(d / "card_prices.png")

    im = base(560, 230)
    rc = m.ring_img(52 * S, 2 * S, GOLD, 255, 1000)
    im.alpha_composite(rc, (int(76 * S - rc.width / 2), int(88 * S - rc.height / 2)))
    pin = icon("pin", 58 * S, GOLD, 6 * S)
    im.alpha_composite(pin, (int(76 * S - pin.width / 2), int(88 * S - pin.height / 2)))
    text(im, ADDRESS, "SemiBold", 30 * S, 150 * S, 66 * S, CREAM, anchor="left")
    text(im, "74000 Annecy", "Regular", 28 * S, 150 * S, 112 * S, GOLD, anchor="left")
    hline(im, 280 * S, 160 * S, 492 * S, 1.0, width=S, alpha=0.35)
    ci = icon("card", 40 * S, GOLD, 5 * S)
    im.alpha_composite(ci, (int(76 * S - ci.width / 2), int(196 * S - ci.height / 2)))
    text(im, "Paiement par carte accepté", "Regular", 24 * S, 150 * S, 196 * S, MUTED, anchor="left")
    im.save(d / "card_address.png")

def synth_audio_3d(path):
    """Music + sound design from motion.py, plus ASMR barber sounds synced to the 3D action."""
    import wave
    tmp = OUT / "_base.wav"
    m.synth_audio(tmp)
    with wave.open(str(tmp)) as wf:
        sr = wf.getframerate()
        base = np.frombuffer(wf.readframes(wf.getnframes()), np.int16).astype(np.float32) / 32767
    tmp.unlink()
    n = len(base)
    out = base * 0.8
    r = np.random.default_rng(3)

    def add(sig, at, gain):
        i = int(at * sr)
        j = min(n, i + len(sig))
        if i < n:
            out[i:j] += sig[: j - i] * gain

    def snip():  # scissors: bright metallic transient
        x = np.arange(int(0.09 * sr)) / sr
        ring_ = (np.sin(2 * np.pi * 3150 * x) + 0.6 * np.sin(2 * np.pi * 4720 * x) + 0.3 * np.sin(2 * np.pi * 6900 * x)) * np.exp(-x * 55)
        noise = np.diff(r.normal(0, 1, len(x)), prepend=0) * np.exp(-x * 160)
        return ring_ * 0.5 + noise * 0.6

    def shing(length=0.7):  # razor opening: rising metallic ring
        x = np.arange(int(length * sr)) / sr
        f = 2400 + 1800 * x / length
        return np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-x * 4) * np.minimum(1, x / 0.01) * 0.6

    def buzz(length):  # clipper motor: 110 Hz buzz with harmonics and blade hiss
        x = np.arange(int(length * sr)) / sr
        ph = 2 * np.pi * 110 * x + 0.3 * np.sin(2 * np.pi * 7 * x)
        sig = sum(np.sin(ph * k) / k ** 0.8 for k in range(1, 12))
        hiss = np.diff(r.normal(0, 1, len(x)), prepend=0) * 0.25
        env = np.minimum(1, x / 0.08) * np.minimum(1, (length - x) / 0.25)
        return (np.tanh(sig * 0.6) * 0.5 + hiss) * env

    def pop():
        x = np.arange(int(0.12 * sr)) / sr
        return np.sin(2 * np.pi * (520 + 900 * np.exp(-x * 40)) * x) * np.exp(-x * 30) * 0.7

    def click():
        x = np.arange(int(0.03 * sr)) / sr
        return (np.sin(2 * np.pi * 1800 * x) * np.exp(-x * 120) + np.diff(r.normal(0, 1, len(x)), prepend=0) * np.exp(-x * 300) * 0.5)

    def suck(length=0.45):
        s_ = r.normal(0, 1, int(length * sr))
        x = np.linspace(0, 1, len(s_))
        return np.convolve(s_, np.ones(40) / 40, "same") * x ** 2 * 2.2

    for k in range(4):                       # scissors closing on the beat
        add(snip(), 3.75 + k * 0.5, 0.35)
    add(shing(), 5.7, 0.3)                   # razor
    add(buzz(1.8), 7.8, 0.16)                # clipper arriving in the tool showcase
    def chime():  # soft two-tone notification
        x = np.arange(int(0.5 * sr)) / sr
        e = np.exp(-x * 7) * np.minimum(1, x / 0.004)
        return (np.sin(2 * np.pi * 1318.5 * x) * (x < 0.12) + np.sin(2 * np.pi * 1760 * x) * (x >= 0.1)) * e * 0.6

    for ap, tap, _, _ in NOTIFS:
        add(chime(), ap, 0.22)               # notification arrives
        add(click(), tap, 0.55)              # tapped
        add(pop(), tap + 0.08, 0.25)         # section rises out of the phone
    add(suck(0.4), 17.95, 0.15)              # camera pushes in on the post
    add(click(), 18.42, 0.5)                 # double tap
    for k in range(18):                      # hearts flying out
        add(pop(), 18.45 + k * 0.075, 0.06)
    for k in range(5):                       # comment bubbles
        add(pop(), 18.9 + k * 0.2, 0.12)
    add(click(), PROFILE_AT, 0.55)           # follow tapped -> profile
    add(click(), 20.92, 0.6)                 # follow pressed on the card
    add(chime(), 21.0, 0.18)                 # new follower
    for k in range(9):                       # posts flying to the wall
        add(pop(), TILES_OUT + k * 0.05, 0.1)
    add(shing(0.5), 23.4, 0.22)              # phone 360 spin
    add(suck(), 24.45, 0.25)                 # everything returns into the screen
    add(snip(), 33.4, 0.25)
    add(shing(0.9), 28.6, 0.2)               # business card spinning in
    add(suck(0.35), 29.6, 0.18)              # card flip
    for k in range(6):                       # QR modules rising
        add(click(), 30.2 + k * 0.08, 0.25)
    add(chime(), 31.35, 0.2)                 # scan
    out /= max(1e-6, np.abs(out).max()) / 0.89
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes((out * 32767).astype(np.int16).tobytes())

def short_cut(src, dst, segments):
    """Builds a shorter version from beat-aligned segments of the full reel."""
    parts, labels = [], []
    for i, (a, b) in enumerate(segments):
        parts.append(f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS[v{i}];[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS,"
                     f"afade=t=in:d=0.01,afade=t=out:st={b - a - 0.01}:d=0.01[a{i}]")
        labels.append(f"[v{i}][a{i}]")
    fc = ";".join(parts) + ";" + "".join(labels) + f"concat=n={len(segments)}:v=1:a=1[v][a]"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                    "-c:v", "libx264", "-preset", "slow", "-b:v", "9M", "-maxrate", "12M", "-bufsize", "18M", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dst)], check=True)

def main():
    cmd = sys.argv[1]
    if cmd == "screens":
        screens()
        holo_assets()
        return
    if cmd == "frames":
        d = OUT / "test_comp"
        d.mkdir(exist_ok=True)
        for ts in sys.argv[2:]:
            fi = int(round(float(ts) * FPS))
            Image.fromarray(composite(fi)).save(d / f"t{float(ts):05.2f}.png")
        return
    silent = OUT / "atelier47_motion_3d_sans_son.mp4"
    proc = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                             "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-b:v", "9M", "-maxrate", "12M",
                             "-bufsize", "18M", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(silent)], stdin=subprocess.PIPE)
    total = int(DUR * FPS)
    for fi in range(total):
        proc.stdin.write(composite(fi).tobytes())
        if fi % 90 == 0:
            print(f"frame {fi}/{total}", flush=True)
    proc.stdin.close()
    proc.wait()
    wav = OUT / "son3d.wav"
    synth_audio_3d(wav)
    final = OUT / "atelier47_motion_3d.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(silent), "-i", str(wav), "-c:v", "copy",
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=7,aresample=48000,volume=-1.3dB,alimiter=limit=0.75:level=false", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest",
                    "-movflags", "+faststart", str(final)], check=True)
    wav.unlink()
    # 17 s version for A/B testing (hook + kinetic + phone + end), cut on the beat
    short_cut(final, OUT / "atelier47_motion_3d_court.mp4", [(0.0, 3.5), (17.0, 25.0), (28.5, DUR)])
    print("done", final)

if __name__ == "__main__":
    main()
