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
m.GOLD_LIGHT, m.GOLD, m.GOLD_DARK = (252, 232, 168), (230, 192, 100), (198, 156, 66)
GOLD = m.GOLD
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
    top = np.exp(-(((x - W * 0.2) / (W * 0.75)) ** 2 + ((y - H * 0.15) / (H * 0.5)) ** 2))
    low = np.exp(-(((x - W * 0.85) / (W * 0.7)) ** 2 + ((y - H * 0.9) / (H * 0.45)) ** 2))
    add = np.array([16, 12, 5], np.float32) * glow[..., None]
    night = add + np.array([8, 16, 52], np.float32) * top[..., None] + np.array([6, 10, 34], np.float32) * low[..., None]
    indigo = add + np.array([24, 12, 60], np.float32) * top[..., None] + np.array([10, 8, 40], np.float32) * low[..., None]
    vign = np.clip(1 - 0.5 * ((((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2) / 2) ** 1.2, 0, 1)[..., None]
    return (night, indigo), vign

def base_frame(fi):
    im = Image.open(F3D / f"f{fi:04d}.png").convert("RGB")
    arr = np.asarray(im).astype(np.float32)
    (night, indigo), vign = grade_maps()
    k = 0.5 + 0.5 * math.sin(fi / FPS * 0.33 - 1.2)     # the blue slowly drifts between midnight and indigo
    arr = (arr + night * (1 - k) + indigo * k) * vign
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

# ------------------------------------------------------------------ 2D overlays (the 3D layer carries logo, titles, tools, phone)
# ------------------------------------------------------------------ typography: solid colour tags instead of gold-framed plates
m.SHADOW = 0.6
m.GLOW_SCALE = 0.3
TEAL, TEAL_D, AMBER, INK = (24, 36, 88), (11, 17, 44), (240, 196, 98), (14, 14, 14)   # bleu nuit, nuit profonde, or clair, encre
MUTED = (224, 218, 206)

@lru_cache(maxsize=None)
def bar_img(w, h, bg, r):
    return panel(w, h, radius=r, fill=bg, border_a=0, bw=1)

def tag(c, s, weight, size, cx, cy, fg, bg, alpha=1.0, reveal=1.0, padx=None, pady=None, tracking=0, anchor="center", r=None):
    """Text on a solid rounded bar; reveal wipes the bar in from the left, the text follows."""
    if alpha <= 0.01 or reveal <= 0:
        return
    _, tw = layout(s, weight, size, tracking)
    padx = padx if padx is not None else int(size * 0.45)
    pady = pady if pady is not None else int(size * 0.22)
    w, h = int(tw + 2 * padx), int(size * 1.18 + 2 * pady)
    x0 = {"center": cx - w / 2, "left": cx, "right": cx - w}[anchor]
    bar = bar_img(w, h, bg, r if r is not None else max(8, h // 5))
    rv = ease_out(clamp(reveal))
    if rv < 1:
        bar = bar.crop((0, 0, max(1, int(w * rv)), h))
    paste(c, bar, x0, cy, alpha=alpha, anchor="left")
    ta = alpha * clamp((reveal - 0.45) / 0.4)
    if ta > 0.01:
        sh, m.SHADOW = m.SHADOW, 0.0
        text(c, s, weight, size, x0 + padx, cy + size * 0.03, fg, alpha=ta, anchor="left", tracking=tracking)
        m.SHADOW = sh

def plate(c, cx, cy, w, h, alpha):  # kept for compatibility: plain dark-teal panel, no gold border
    if alpha > 0.01:
        paste(c, bar_img(int(w), int(h), TEAL_D, 28), cx, cy, alpha=clamp(alpha) * 0.88)

def o_hook(c, t):
    hp = ease_out(prog(t, 0.0, 0.35))
    sc = lerp(1.12, 1.0, hp)
    tag(c, "ANNECY,", "ExtraBold", 72 * sc, W / 2, 258, INK, GOLD)
    tag(c, "TON BARBIER EST ICI", "Bold", 50 * sc, W / 2, 360, CREAM, TEAL)
    p = ease_back(prog(t, 1.2, 1.55))
    if p > 0:
        paste(c, icon("pin", 70, AMBER, 6), W / 2, 1180 + 6 * math.sin(t * 3), alpha=clamp(p), scale=max(0.01, p))
    tag(c, ADDRESS.upper(), "SemiBold", 44, W / 2, 1278, CREAM, TEAL_D, reveal=prog(t, 1.35, 1.75), tracking=3)
    sw = lerp(-200, 1400, prog(t, 2.6, 3.3)) if 2.6 < t < 3.3 else None
    tag(c, CITY, "ExtraBold", 84, W / 2, 1396, INK, CREAM, reveal=prog(t, 1.7, 2.1), tracking=6)

def o_kinetic(c, t):
    tag(c, "ATELIER 47", "SemiBold", 40, W / 2, 300, CREAM, TEAL, reveal=prog(t, 3.55, 3.85), tracking=10)
    if t >= 5.5:
        tag(c, "COUPE NETTE · BARBE SOIGNÉE", "Bold", 34, W / 2, 1392, INK, AMBER, reveal=prog(t, 6.5, 6.9), tracking=4)

@lru_cache(maxsize=None)
def small_card():
    return panel(900, 170, radius=28, fill=TEAL_D, border_a=0, bw=1)

def o_salon(c, t):
    tag(c, "LE SALON", "Bold", 40, W / 2, 292, INK, GOLD, reveal=prog(t, 7.55, 7.85), tracking=12)
    tag(c, "Pensé pour vous", "SemiBold", 58, W / 2, 400, CREAM, TEAL, reveal=prog(t, 7.75, 8.15))
    for i, (ic, title, sub) in enumerate(FEATURES):
        st = 8.4 + i * 0.5
        p = ease_out(prog(t, st, st + 0.45))
        if p <= 0:
            continue
        y = 1010 + i * 190 + 5 * math.sin(t * 2.2 + i)
        dx = lerp(700, 0, p)
        a = clamp(p * 1.5)
        paste(c, small_card(), W / 2 + dx, y, alpha=a * 0.94)
        paste(c, bar_img(10, 120, AMBER, 5), 108 + dx, y, alpha=a)
        pul = 1 + 0.07 * beat_pulse(t, st)
        paste(c, icon(ic, 72, AMBER, 6), 195 + dx, y, alpha=a, scale=pul)
        text(c, title, "SemiBold", 42, 285 + dx, y - 28, CREAM, alpha=a, anchor="left")
        text(c, sub, "Medium", 31, 285 + dx, y + 32, MUTED, alpha=a, anchor="left")

@lru_cache(maxsize=None)
def price_panel2():
    return panel(900, 1010, radius=30, fill=TEAL_D, border_a=0, bw=1)

def o_prices(c, t):
    pp = ease_out(prog(t, 12.15, 12.6))
    if pp <= 0:
        return
    oy = lerp(120, 0, pp)
    paste(c, price_panel2(), W / 2, 960 + oy, alpha=clamp(pp * 1.4) * 0.95)
    y = 540 + oy
    row = 0
    for si, (section, items) in enumerate(PRICES):
        if si == 1:
            hline(c, W / 2, y - 20, 760, ease_in_out(prog(t, 13.5, 13.9)), width=2, alpha=0.5, color=CREAM)
            y += 40
        sp = prog(t, 12.4 + si * 1.1, 12.75 + si * 1.1)
        tag(c, section, "Bold", 34, 150, y, INK, AMBER, reveal=sp, tracking=6, anchor="left")
        y += 90
        for name, price in items:
            st = 12.6 + row * 0.26 + si * 0.25
            p = ease_out(prog(t, st, st + 0.35))
            if p > 0:
                dx = lerp(-60, 0, p)
                text(c, name, "SemiBold", 40, 150 + dx, y, CREAM, alpha=p, anchor="left")
                cnt = int(round(price * ease_out(prog(t, st + 0.05, st + 0.45))))
                pop = 1 + 0.25 * (1 - ease_out(prog(t, st + 0.4, st + 0.65))) * (t > st + 0.4)
                text(c, f"{cnt} €", "ExtraBold", 50, 930, y, AMBER, alpha=p, anchor="right", scale=pop)
                _, nw = layout(name, "SemiBold", 40)
                lead_x0, lead_x1 = 150 + nw + 24, 930 - 130
                n = int((lead_x1 - lead_x0) / 18)
                dot = Image.new("RGBA", (4, 4), (CREAM[0], CREAM[1], CREAM[2], 90))
                for k in range(max(0, n)):
                    if k / max(1, n) <= p:
                        paste(c, dot, lead_x0 + k * 18, y + 14)
            y += 92
            row += 1

def o_instagram(c, t):
    if t > 20.7:
        for (x, y, r, ph) in SPARKS:
            a = max(0, math.sin((t - 20.7) * 3 + ph)) ** 3
            star(c, x, y - 20, r * (0.6 + 0.4 * a), a * 0.7)

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
        if closed:
            text(c, hours, "Bold", 50, 930 + dx, y, MUTED, alpha=p, anchor="right", tracking=2)
        else:
            tag(c, hours, "ExtraBold", 46, 930 + dx, y, INK, AMBER, alpha=p, reveal=prog(t, st + 0.1, st + 0.45), anchor="right")
        if i < len(HOURS) - 1:
            hline(c, W / 2, y + 82, 780, ease_in_out(prog(t, st + 0.15, st + 0.55)), width=2, alpha=0.35, color=CREAM)
    ap = ease_out(prog(t, 27, 27.4))
    if ap > 0:
        paste(c, icon("pin", 52, AMBER, 6), W / 2, 1330, alpha=ap)
        tag(c, f"{ADDRESS} · 74000 Annecy", "SemiBold", 36, W / 2, 1408, CREAM, TEAL, reveal=prog(t, 27, 27.4))

def o_card(c, t):
    out = ease_in_out(prog(t, 31.1, 31.35))
    if out < 1:
        tag(c, "NOTRE CARTE", "Bold", 42, W / 2, 300, INK, GOLD, alpha=1 - out, reveal=prog(t, 28.6, 28.95), tracking=12)
    cp = ease_back(prog(t, 31.35, 31.75))
    if cp > 0:
        tag(c, "SCANNE · ABONNE-TOI", "ExtraBold", 46, W / 2, 300, CREAM, TEAL, alpha=clamp(cp), reveal=prog(t, 31.35, 31.7), tracking=4)

def o_end(c, t):
    tag(c, HANDLE, "SemiBold", 48, W / 2, 1210, CREAM, TEAL, reveal=prog(t, 34.1, 34.45))
    ap = ease_out(prog(t, 34.4, 34.8))
    text(c, f"{ADDRESS} · 74000 Annecy", "Medium", 34, W / 2, 1296, CREAM, alpha=ap)
    tag(c, "ENREGISTRE · PARTAGE À UN POTE", "Bold", 32, W / 2, 1376, INK, AMBER, reveal=prog(t, 34.5, 34.9), tracking=3)
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
        arr += c_ * np.array([255, 250, 240], np.float32) * 1.0 + g_ * np.array([130, 150, 255], np.float32) * 1.5
        burst = max(0.0, 1 - abs(d) / 0.09)          # convergence burst
        if burst > 0:
            yy, xx = np.ogrid[0:H, 0:W]
            rad = np.exp(-(((xx - cx) / 260.0) ** 2 + ((yy - cy) / 260.0) ** 2))
            arr += rad[..., None] * np.array([210, 220, 255], np.float32) * 0.7 * burst
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
FOLLOW_PILL = (330, 986)
HEART_ICON, COMMENT_ICON = (515, 700), (515, 815)
POST_START, PROFILE_AT, TILES_OUT = 18.0, 20.25, 22.3
LIKE_AT, FOLLOW_CLICK = 19.35, 20.12
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
    """The Reel video: the TIM DESIGN product film rendered by tools/render3d/product.js."""
    fi = int(min(89, max(0, (t - POST_START) * FPS * 1.2)))
    f = OUT / "postvid" / f"f{fi:04d}.png"
    if not f.exists():
        return Image.new("RGB", (560, 1200), (14, 40, 46))
    im = Image.open(f).convert("RGB").resize((675, 1200), Image.LANCZOS).crop((57, 0, 617, 1200))
    return im

@lru_cache(maxsize=None)
def reel_gradients():
    y = np.arange(1200, dtype=np.float32)[:, None]
    bottom = np.clip((y - 820) / 380, 0, 1) ** 1.3 * 0.85
    top = np.clip((170 - y) / 170, 0, 1) * 0.6
    a = np.broadcast_to(np.maximum(bottom, top), (1200, 560))
    out = np.zeros((1200, 560, 4), np.uint8)
    out[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")

def nav_bar(scr):
    for i, n in enumerate(["home", "search", "plus", "reels"]):
        paste(scr, ig_icon(n, size=40), 70 + i * 140, 1160)
    paste(scr, m.avatar(40), 70 + 3.85 * 140, 1160)

def post_screen(t):
    """Instagram Reel UI: full-screen video, actions on the right, account and caption at the bottom."""
    scr = Image.new("RGBA", (560, 1200), (0, 0, 0, 255))
    scr.paste(post_media(t), (0, 0))
    scr.alpha_composite(reel_gradients())
    text(scr, "Reels", "Bold", 30, 26, 62, CREAM, anchor="left")
    liked = t >= LIKE_AT
    lk = int(lerp(IG["likes"][0], IG["likes"][1], ease_in_out(prog(t, LIKE_AT, 20.2))))
    cm = int(lerp(IG["comments"][0], IG["comments"][1], ease_in_out(prog(t, 19.6, 20.2))))
    paste(scr, ig_icon("heart", liked, 50), *HEART_ICON, scale=1 + 0.35 * math.sin(math.pi * prog(t, LIKE_AT, LIKE_AT + 0.25)))
    text(scr, fr_num(lk), "SemiBold", 18, HEART_ICON[0], HEART_ICON[1] + 44, CREAM)
    paste(scr, ig_icon("comment", size=46), *COMMENT_ICON)
    text(scr, fr_num(cm), "SemiBold", 18, COMMENT_ICON[0], COMMENT_ICON[1] + 44, CREAM)
    paste(scr, ig_icon("share", size=44), 515, 925)
    text(scr, "Partager", "Regular", 14, 515, 965, CREAM)
    for k in range(3):
        paste(scr, Image.new("RGBA", (6, 6), (243, 238, 227, 255)), 503 + k * 12, 1030)
    scr.alpha_composite(m.avatar(52), (22, 960))
    text(scr, "atelier47barbier", "SemiBold", 21, 86, 986, CREAM, anchor="left")
    followed = t >= FOLLOW_CLICK
    pill = panel(120, 40, radius=12, fill=GOLD if not followed else (40, 38, 34), border_a=0 if not followed else 160, bw=1)
    paste(scr, pill, *FOLLOW_PILL)
    text(scr, "Abonné" if followed else "S'abonner", "SemiBold", 18, FOLLOW_PILL[0], FOLLOW_PILL[1], m.BLACK if not followed else CREAM)
    text(scr, "Nouveaux produits TIM DESIGN", "Medium", 20, 24, 1036, CREAM, anchor="left")
    text(scr, "Disponibles au salon · Annecy", "Regular", 18, 24, 1066, MUTED, anchor="left")
    text(scr, "Son original · atelier47barbier", "Regular", 16, 24, 1098, MUTED, anchor="left")
    pr = clamp((t - POST_START) / 2.25)
    paste(scr, Image.new("RGBA", (560, 3), (243, 238, 227, 70)), 0, 1128, anchor="left")
    paste(scr, Image.new("RGBA", (int(560 * pr) + 1, 3), (243, 238, 227, 230)), 0, 1128, anchor="left")
    nav_bar(scr)
    draw_cursor(scr, t)
    return scr

@lru_cache(maxsize=None)
def cursor_img():
    from PIL import ImageDraw
    k = 3
    pts = [(0, 0), (0, 36), (9, 27), (16, 42), (23, 39), (16, 25), (28, 25)]
    im = Image.new("RGBA", (34 * k, 46 * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    big = [(x * k + 3 * k, y * k + 2 * k) for x, y in pts]
    d.polygon(big, fill=(255, 255, 255, 255), outline=(10, 10, 10, 255), width=2 * k)
    return im.resize((34, 46), Image.LANCZOS)

CURSOR_PATH = [(19.0, (440, 1190)), (19.28, (HEART_ICON[0] - 2, HEART_ICON[1] + 4)), (19.72, (HEART_ICON[0] - 2, HEART_ICON[1] + 4)),
               (20.04, (FOLLOW_PILL[0] - 10, FOLLOW_PILL[1] + 4)), (20.4, (FOLLOW_PILL[0] - 10, FOLLOW_PILL[1] + 4))]

def draw_cursor(scr, t):
    if not (CURSOR_PATH[0][0] <= t < CURSOR_PATH[-1][0]):
        return
    for (t0, a), (t1, b) in zip(CURSOR_PATH, CURSOR_PATH[1:]):
        if t0 <= t < t1:
            q = ease_in_out(prog(t, t0, t1))
            x, y = lerp(a[0], b[0], q), lerp(a[1], b[1], q)
            break
    press = max(math.sin(math.pi * prog(t, LIKE_AT - 0.04, LIKE_AT + 0.08)), math.sin(math.pi * prog(t, FOLLOW_CLICK - 0.04, FOLLOW_CLICK + 0.08)))
    al = clamp((t - CURSOR_PATH[0][0]) / 0.12) * clamp((CURSOR_PATH[-1][0] - t) / 0.15)
    for ct in (LIKE_AT, FOLLOW_CLICK):
        q = prog(t, ct - 0.02, ct + 0.32)
        if 0 < q < 1:
            paste(scr, m.ring_img(int(lerp(6, 46, ease_out(q))), 3, CREAM, 255, 1000), x, y, alpha=(1 - q) * al)
    c = cursor_img()
    paste(scr, c, x + c.width * 0.42, y + c.height * 0.45, alpha=al, scale=1 - 0.15 * press)

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
    for tx, ty, tt in [(146, 490, 20.92)]:
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
    add(click(), LIKE_AT, 0.55)              # cursor clicks the heart
    for k in range(18):                      # hearts flying out
        add(pop(), LIKE_AT + 0.02 + k * 0.05, 0.06)
    for k in range(5):                       # comment bubbles
        add(pop(), 19.6 + k * 0.12, 0.12)
    add(click(), FOLLOW_CLICK, 0.55)         # cursor clicks follow -> profile
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
