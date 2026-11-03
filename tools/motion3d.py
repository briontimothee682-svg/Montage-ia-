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
    letters(c, "VOTRE BARBIER À ANNECY", "Medium", 34, W / 2, 300, t, 0.3, CREAM, tracking=10, stagger=0.02, dur=0.4)
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
    hp = prog(t, 18.9, 19.5)
    if hp > 0:
        n = int(len(HANDLE) * hp)
        text(c, HANDLE[:max(1, n)], "Medium", 42, W / 2 - layout(HANDLE, "Medium", 42)[1] / 2, 470, CREAM, anchor="left")
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
    sp = ease_out(prog(t, 28.3, 28.8))
    text(c, "TIM DESIGN", "Light", 24, W / 2, 1450, CREAM, alpha=sp * 0.55, tracking=16)

OVERLAYS = [(0.0, 3.5, o_hook), (3.5, 7.5, o_kinetic), (7.5, 12.0, o_salon), (12.0, 17.0, o_prices),
            (17.0, 23.0, o_instagram), (23.0, 26.5, o_hours), (26.5, 30.0, o_end)]

def composite(fi):
    t = fi / FPS
    c = base_frame(fi)
    for a, b, fn in OVERLAYS:
        if a <= t < b:
            fn(c, t)
    img = c.convert("RGB")
    for cut in CUTS:
        d = t - cut
        if -0.2 <= d <= 0.2:
            k = 1 - abs(d) / 0.2
            z = 1 + 0.14 * k ** 2
            layers = [m.zoom(img, z * (1 + 0.03 * j * k)) for j in range(3)]
            img = Image.blend(Image.blend(layers[0], layers[1], 0.4), layers[2], 0.3)
            fl = max(0.0, 1 - abs(d) / 0.1) * 0.5
            if fl > 0:
                img = Image.blend(img, Image.new("RGB", (W, H), (255, 238, 200)), fl)
    if t > 29.3:
        img = Image.blend(img, Image.new("RGB", (W, H), m.BLACK), ease_in_out(prog(t, 29.3, 30.0)))
    arr = np.asarray(img).astype(np.float32) + m.GRAIN[fi % len(m.GRAIN)] * 0.6
    return np.clip(arr, 0, 255).astype(np.uint8)

def screens():
    (OUT / "screen").mkdir(parents=True, exist_ok=True)
    for fi in range(int(17 * FPS), int(23 * FPS)):
        t = fi / FPS
        scr, _ = m.draw_screen(t, t >= 19.75, 17.6)
        bg = Image.new("RGBA", scr.size, (0, 0, 0, 255))
        bg.alpha_composite(scr)
        bg.convert("RGB").save(OUT / "screen" / f"s{fi:04d}.png")

def main():
    cmd = sys.argv[1]
    if cmd == "screens":
        screens()
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
    m.synth_audio(wav)
    final = OUT / "atelier47_motion_3d.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(silent), "-i", str(wav), "-c:v", "copy",
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=7", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-shortest",
                    "-movflags", "+faststart", str(final)], check=True)
    wav.unlink()
    print("done", final)

if __name__ == "__main__":
    main()
