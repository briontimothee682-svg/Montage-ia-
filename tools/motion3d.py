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
def o_hook(c, t):
    # hook readable on the very first frame (most viewers decide in under 2 s, often with the sound off)
    hp = ease_out(prog(t, 0.0, 0.35))
    sw = lerp(-300, 1400, prog(t, 0.5, 1.3)) if 0.5 < t < 1.3 else None
    text(c, "ANNECY,", "ExtraBold", 66, W / 2, 262, "gold", tracking=8, scale=lerp(1.3, 1.0, hp) * (1 + 0.03 * beat_pulse(t, 0.0)),
         sweep=sw, glow=0.4)
    text(c, "TON BARBIER EST ICI", "Bold", 52, W / 2, 342, CREAM, tracking=4, scale=lerp(1.18, 1.0, hp))
    p = ease_back(prog(t, 1.25, 1.6))
    if p > 0:
        paste(c, icon("pin", 74), W / 2, 1185 + 6 * math.sin(t * 3), alpha=clamp(p), scale=max(0.01, p))
    letters(c, ADDRESS.upper(), "SemiBold", 44, W / 2, 1275, t, 1.35, CREAM, tracking=5, stagger=0.018, dur=0.35)
    sw = lerp(-200, 1400, prog(t, 2.6, 3.3)) if 2.6 < t < 3.3 else None
    letters(c, CITY, "Bold", 88, W / 2, 1385, t, 1.75, "gold", tracking=10, stagger=0.045, dur=0.4, style="pop", sweep=sw, glow=0.35)
    hline(c, W / 2, 1460, 520, ease_in_out(prog(t, 2.25, 2.75)), width=3)

def o_kinetic(c, t):
    letters(c, "ATELIER 47", "SemiBold", 38, W / 2, 300, t, 3.6, GOLD, tracking=18, stagger=0.03, dur=0.3)
    t0 = 3.5 if t < 5.5 else 5.5
    hline(c, W / 2, 1290, 760, ease_in_out(prog(t, t0 + 0.9, t0 + 1.3)), width=3)
    if t >= 5.5:
        letters(c, "COUPE NETTE · BARBE SOIGNÉE", "Medium", 30, W / 2, 1390, t, 6.6, MUTED, tracking=8, stagger=0.015)

@lru_cache(maxsize=None)
def small_card():
    return panel(900, 170, radius=28, fill=PANEL, border_a=90)

def o_salon(c, t):
    letters(c, "LE SALON", "Bold", 40, W / 2, 300, t, 7.55, GOLD, tracking=22, stagger=0.03)
    hline(c, W / 2, 350, 140, ease_out(prog(t, 7.8, 8.1)), width=3)
    letters(c, "Pensé pour vous", "Light", 66, W / 2, 425, t, 7.7, CREAM, stagger=0.03, dur=0.45)
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
        text(c, title, "SemiBold", 40, 295 + dx, y - 26, CREAM, alpha=a, anchor="left")
        text(c, sub, "Regular", 28, 295 + dx, y + 30, MUTED, alpha=a, anchor="left")

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
        text(c, section, "SemiBold", 40, 150, y, GOLD, alpha=sp, tracking=10, anchor="left")
        y += 90
        for name, price in items:
            st = 12.6 + row * 0.26 + si * 0.25
            p = ease_out(prog(t, st, st + 0.35))
            if p > 0:
                dx = lerp(-60, 0, p)
                text(c, name, "Medium", 38, 150 + dx, y, CREAM, alpha=p, anchor="left")
                cnt = int(round(price * ease_out(prog(t, st + 0.05, st + 0.45))))
                pop = 1 + 0.25 * (1 - ease_out(prog(t, st + 0.4, st + 0.65))) * (t > st + 0.4)
                text(c, f"{cnt}€", "Bold", 46, 930, y, "gold", alpha=p, anchor="right", scale=pop)
                _, nw = layout(name, "Medium", 38)
                lead_x0, lead_x1 = 150 + nw + 24, 930 - 110
                n = int((lead_x1 - lead_x0) / 18)
                dot = Image.new("RGBA", (4, 4), (GOLD[0], GOLD[1], GOLD[2], 140))
                for k in range(max(0, n)):
                    if k / max(1, n) <= p:
                        paste(c, dot, lead_x0 + k * 18, y + 14)
            y += 92
            row += 1

def o_instagram(c, t):
    hline(c, W / 2, 415, 560, ease_in_out(prog(t, 18.9, 19.3)), width=3)
    if t > 19.0:
        for (x, y, r, ph) in SPARKS:
            a = max(0, math.sin((t - 19.0) * 3 + ph)) ** 3
            star(c, x, y - 20, r * (0.6 + 0.4 * a), a * 0.9)

def o_hours(c, t):
    for i, (day, hours) in enumerate(HOURS):
        st = 23.5 + i * 0.5
        p = ease_out(prog(t, st, st + 0.4))
        if p <= 0:
            continue
        y = 800 + i * 165
        dx = lerp(80, 0, p)
        closed = hours == "FERMÉ"
        text(c, day, "SemiBold", 44, 150 - dx, y, CREAM if not closed else MUTED, alpha=p, anchor="left", tracking=2)
        text(c, hours, "Bold", 52, 930 + dx, y, "gold" if not closed else MUTED, alpha=p, anchor="right", tracking=2,
             scale=1 + 0.03 * beat_pulse(t, st + 0.5))
        hline(c, W / 2, y + 80, 780, ease_in_out(prog(t, st + 0.15, st + 0.55)), width=2, alpha=0.45)
    ap = ease_out(prog(t, 25.0, 25.4))
    if ap > 0:
        paste(c, icon("pin", 52), W / 2, 1335, alpha=ap)
        text(c, f"{ADDRESS} · 74000 Annecy", "Regular", 34, W / 2, 1405, CREAM, alpha=ap)

def o_end(c, t):
    letters(c, HANDLE, "Medium", 46, W / 2, 1210, t, 27.6, CREAM, stagger=0.015, dur=0.3)
    ap = ease_out(prog(t, 27.9, 28.3))
    text(c, f"{ADDRESS} · 74000 Annecy", "Regular", 32, W / 2, 1285, CREAM, alpha=ap * 0.85)
    cp = ease_back(prog(t, 28.0, 28.4))
    if cp > 0:
        text(c, "ENREGISTRE · PARTAGE À UN POTE", "SemiBold", 30, W / 2, 1365, GOLD, alpha=clamp(cp), tracking=6,
             scale=max(0.01, cp) * (1 + 0.04 * beat_pulse(t, 28.5)))
    sp = ease_out(prog(t, 28.3, 28.8))
    text(c, "TIM DESIGN", "Light", 24, W / 2, 1450, CREAM, alpha=sp * 0.55, tracking=16)

OVERLAYS = [(0.0, 3.5, o_hook), (3.5, 7.5, o_kinetic), (7.5, 12.0, o_salon), (12.0, 17.0, o_prices),
            (17.0, 23.0, o_instagram), (23.0, 26.5, o_hours), (26.5, 30.0, o_end)]

def streaks(img):
    """Anamorphic horizontal light streaks on the brightest highlights."""
    arr = np.asarray(img).astype(np.float32)
    lum = arr.max(axis=2)
    bright = np.clip((lum - 205) / 50.0, 0, 1) ** 2
    sm = Image.fromarray((bright * 255).astype(np.uint8), "L").resize((W // 8, H // 8), Image.BOX)
    sm = sm.resize((W // 96, H // 8), Image.BOX).resize((W // 8, H // 8), Image.BILINEAR)
    st = np.asarray(sm.resize((W, H), Image.BILINEAR)).astype(np.float32)[..., None] / 255.0
    arr += st * np.array([255, 222, 165], np.float32) * 0.55
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
    for cut in CUTS:
        d = t - cut
        if abs(d) <= 0.35:  # warm light leak sweeping across the cut
            k = 1 - abs(d) / 0.35
            x0 = int(lerp(-W / 2, W, (d + 0.35) / 0.7))
            sp = leak_sprite()
            a0, a1 = max(0, x0), min(W, x0 + W // 2)
            if a1 > a0:
                arr[:, a0:a1] += sp[:, a0 - x0:a1 - x0] * 0.45 * k
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
            fl = max(0.0, 1 - abs(d) / 0.1) * 0.5
            if fl > 0:
                img = Image.blend(img, Image.new("RGB", (W, H), (255, 238, 200)), fl)
    if t > 29.3:
        img = Image.blend(img, Image.new("RGB", (W, H), m.BLACK), ease_in_out(prog(t, 29.3, 30.0)))
    arr = np.asarray(img).astype(np.float32) + m.GRAIN[fi % len(m.GRAIN)] * 0.6
    return np.clip(arr, 0, 255).astype(np.uint8)


# notifications on the black lock screen: (appears, tapped, title, body)
NOTIFS = [(18.2, 18.6, "atelier47barbier", "Nouveau : abonne-toi !"),
          (19.75, 20.05, "Nos tarifs", "Coupe Homme 22 € · Barbe 15 €"),
          (20.45, 20.75, "Atelier 47 Barbier", "12 rue de la République, Annecy"),
          (21.1, 21.4, "atelier47barbier", "9 nouvelles publications")]
BANNER_Y = 400   # banner centre on the 560x1200 screen

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

@lru_cache(maxsize=None)
def lock_bg():
    im = Image.new("RGBA", (560, 1200), (0, 0, 0, 255))
    lg = m.logo(170).copy()
    lg.putalpha(lg.getchannel("A").point(lambda v: int(v * 0.16)))
    im.alpha_composite(lg, ((560 - 170) // 2, 860))
    return im

def lock_screen(t):
    wake = ease_out(prog(t, 17.95, 18.25))
    if wake <= 0:
        return Image.new("RGB", (560, 1200), (0, 0, 0))
    scr = lock_bg().copy()
    text(scr, "18:47", "Light", 128, 280, 205, CREAM, alpha=wake)
    text(scr, "ATELIER 47 BARBIER", "Medium", 20, 280, 105, MUTED, alpha=wake, tracking=6)
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
    return bg.convert("RGB")

def screens():
    (OUT / "screen").mkdir(parents=True, exist_ok=True)
    for fi in range(int(17 * FPS), int(23 * FPS)):
        lock_screen(fi / FPS).save(OUT / "screen" / f"s{fi:04d}.png")

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
    add(click(), 19.5, 0.6)                  # follow button pressed
    for k in range(9):                       # posts flying to the wall
        add(pop(), 21.45 + k * 0.05, 0.1)
    add(shing(0.5), 21.95, 0.22)             # phone 360 spin
    add(suck(), 22.45, 0.25)                 # everything returns into the screen
    add(snip(), 26.9, 0.25)
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
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=7", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest",
                    "-movflags", "+faststart", str(final)], check=True)
    wav.unlink()
    # 17 s version for A/B testing (hook + kinetic + phone + end), cut on the beat
    short_cut(final, OUT / "atelier47_motion_3d_17s.mp4", [(0.0, 7.5), (17.0, 23.0), (26.5, 30.0)])
    print("done", final)

if __name__ == "__main__":
    main()
