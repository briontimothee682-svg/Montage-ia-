"""Procedural textures for the L'Apéretik reel (wood, cheese, charcuterie, bread, paper...).
Every texture is generated here from noise, so there is no image-rights issue.
Usage: python3 tools/laperetik/textures.py [name ...]   ->  assets/laperetik/tex/*.png"""
import math, sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
TEX = ROOT / "assets/laperetik/tex"
TEX.mkdir(parents=True, exist_ok=True)


# ------------------------------------------------------------------ noise
def vnoise(h, w, gh, gw, rng):
    """periodic value noise (quintic fade) sampled on an h x w grid with a gh x gw lattice"""
    g = rng.random((gh, gw)).astype(np.float32)
    y = np.arange(h, dtype=np.float32) / h * gh
    x = np.arange(w, dtype=np.float32) / w * gw
    y0 = np.floor(y).astype(np.int64); x0 = np.floor(x).astype(np.int64)
    fy = y - y0; fx = x - x0
    fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10); fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
    y1 = (y0 + 1) % gh; x1 = (x0 + 1) % gw; y0 %= gh; x0 %= gw
    fx = fx[None, :]; fy = fy[:, None]
    a = g[y0][:, x0]; b = g[y0][:, x1]; c = g[y1][:, x0]; d = g[y1][:, x1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(h, w, seed, base=(4, 4), octaves=5, gain=0.5):
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32); amp, tot = 1.0, 0.0
    for o in range(octaves):
        out += vnoise(h, w, base[0] * 2 ** o, base[1] * 2 ** o, rng) * amp
        tot += amp; amp *= gain
    return out / tot


def ridged(h, w, seed, base=(4, 4), octaves=4):
    return 1 - np.abs(fbm(h, w, seed, base, octaves) * 2 - 1)


def lerpc(c0, c1, k):
    c0 = np.asarray(c0, np.float32); c1 = np.asarray(c1, np.float32)
    return c0 + (c1 - c0) * np.clip(k, 0, 1)[..., None]


def save(arr, name, mode="RGB"):
    a = np.clip(arr, 0, 255).astype(np.uint8)
    Image.fromarray(a, mode if a.ndim == 3 else "L").save(TEX / f"{name}.png", optimize=False)
    print("wrote", name, a.shape)


def gray(arr):
    return np.clip(arr * 255, 0, 255)


def dots(h, w, n, rmin, rmax, seed, soft=0.6, wrap=True):
    """random soft discs -> float mask 0..1"""
    rng = np.random.default_rng(seed)
    im = Image.new("L", (w, h), 0); d = ImageDraw.Draw(im)
    for _ in range(n):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.uniform(rmin, rmax) ** 1.0
        e = rng.uniform(0.7, 1.3)
        for ox in ((-w, 0, w) if wrap else (0,)):
            for oy in ((-h, 0, h) if wrap else (0,)):
                d.ellipse((x + ox - r * e, y + oy - r / e, x + ox + r * e, y + oy + r / e), fill=255)
    if soft:
        im = im.filter(ImageFilter.GaussianBlur(soft))
    return np.asarray(im).astype(np.float32) / 255


def blur(a, r):
    """gaussian blur (sigma r px) through the FFT, edges wrap"""
    h, w = a.shape
    fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.rfftfreq(w)[None, :]
    g = np.exp(-2 * (np.pi * r) ** 2 * (fx ** 2 + fy ** 2))
    return np.fft.irfft2(np.fft.rfft2(a.astype(np.float32)) * g, s=(h, w)).astype(np.float32)


# ------------------------------------------------------------------ woods
def wood(h, w, seed, light, dark, rings=26, warp=0.9, fiber=0.18, streak=0.25, knots=0):
    """plank grain running along x (tileable in x and y)"""
    y = np.arange(h, dtype=np.float32)[:, None] / h
    wp = fbm(h, w, seed, (3, 2), 4) - 0.5
    wp2 = fbm(h, w, seed + 1, (8, 2), 3) - 0.5
    phase = (y + wp * warp * 0.35 + wp2 * 0.05) * rings
    ring = 0.5 + 0.5 * np.sin(2 * np.pi * phase)
    ring = ring ** 2.2
    fib = fbm(h, w, seed + 2, (64, 2), 3)                  # long fibres along x
    st = fbm(h, w, seed + 3, (24, 3), 3)
    k = ring * 0.38 + (fib - 0.5) * fiber * 2 + (st - 0.5) * streak + 0.28
    if knots:
        rng = np.random.default_rng(seed + 9)
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        for _ in range(knots):
            cx, cy, r = rng.uniform(0, w), rng.uniform(0, h), rng.uniform(0.012, 0.03) * w
            dd = np.sqrt(((xx - cx) / 2.2) ** 2 + (yy - cy) ** 2) / r
            k += np.exp(-dd ** 2) * 0.9
    col = lerpc(light, dark, k)
    col *= (0.93 + 0.14 * fbm(h, w, seed + 4, (2, 2), 3))[..., None]
    return col, np.clip(k, 0, 1)


def t_birch():
    # box band: grain along the circumference (u), slight veneer stripes
    col, k = wood(512, 4096, 11, (222, 192, 146), (204, 168, 118), rings=11, warp=0.5, fiber=0.3, streak=0.14)
    fl = dots(512, 4096, 260, 0.8, 2.2, 12, 0.6)
    col = col * (1 - 0.35 * fl[..., None]) + np.array([150, 110, 70]) * 0.35 * fl[..., None]
    save(col, "birch_band"); save(gray(0.5 + 0.5 * (k - 0.5)), "birch_band_bump")
    col, k = wood(2048, 2048, 21, (224, 194, 148), (206, 172, 124), rings=17, warp=0.25, fiber=0.3, streak=0.14)
    fl = dots(2048, 2048, 220, 1, 2.6, 22, 0.8)
    col = col * (1 - 0.3 * fl[..., None]) + np.array([150, 110, 70]) * 0.3 * fl[..., None]
    # pressed-lid edge: slightly darker ring where the band overlaps
    yy, xx = np.mgrid[0:2048, 0:2048].astype(np.float32)
    r = np.sqrt((xx - 1024) ** 2 + (yy - 1024) ** 2) / 1024
    col *= (1 - 0.10 * np.clip((r - 0.93) / 0.07, 0, 1))[..., None]
    save(col, "birch_top"); save(gray(0.5 + 0.4 * (k - 0.5)), "birch_top_bump")
    # inside of the box (paler, end-grain look of the bottom disk)
    col, k = wood(1024, 1024, 31, (220, 190, 146), (204, 170, 122), rings=14, warp=0.5, fiber=0.22, streak=0.12)
    save(col, "birch_inner")


FX_PAD = 0.72   # the logo fills the central 72 % of logo_fx (keeps blurred halos away from the edges)


def t_logo_fx():
    """R = ink mask, G = scorch halo, B = burn order (when each ink pixel is branded, 0..1)"""
    src = Image.open(TEX / "logo_mask.png")
    N = 4096; n = int(N * FX_PAD)
    canvas = Image.new("L", (N, N), 0); canvas.paste(src.resize((n, n), Image.LANCZOS), ((N - n) // 2, (N - n) // 2))
    m = np.asarray(canvas).astype(np.float32) / 255
    halo = blur(m, n / 260) * 0.8 + blur(m, n / 90) * 0.45
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    dx, dy = (xx - N / 2) / (n / 2), (yy - N / 2) / (n / 2)
    r = np.sqrt(dx ** 2 + dy ** 2)
    th = (np.arctan2(dx, -dy) / (2 * np.pi)) % 1.0          # 0 at the top, clockwise
    ly = (yy - (N - n) / 2) / n
    # outer ring -> lettering & arcs -> inner ring -> monogram, each traced clockwise
    order = np.where(r > 0.9, 0.0 + 0.30 * th,
             np.where(r > 0.58, 0.12 + 0.40 * th,
             np.where(r > 0.47, 0.42 + 0.22 * th, 0.58 + 0.40 * ((ly - 0.28) / 0.44))))
    order = np.clip(order, 0, 1)
    save(np.dstack([m * 255, np.clip(halo, 0, 1) * 255, order * 255]), "logo_fx")


def t_tables():
    col, k = wood(2048, 2048, 41, (92, 60, 40), (54, 34, 22), rings=34, warp=0.3, fiber=0.45, streak=0.3, knots=0)
    save(col, "walnut"); save(gray(0.5 + 0.5 * (k - 0.5)), "walnut_bump")
    col, k = wood(2048, 2048, 51, (176, 128, 82), (106, 72, 44), rings=24, warp=0.6, fiber=0.38, streak=0.4, knots=3)
    # rustic: plank seams and small cracks
    for yy in (0, 512, 1024, 1536):
        col[yy:yy + 6] *= 0.35; k[yy:yy + 6] = 1
    cr = ridged(2048, 2048, 52, (40, 3), 3)
    crack = np.clip((cr - 0.94) / 0.06, 0, 1) * (fbm(2048, 2048, 53, (6, 2), 2) > 0.62)
    col *= (1 - 0.55 * crack)[..., None]
    save(col, "oak"); save(gray(0.5 + 0.45 * (k - 0.5) - 0.4 * crack), "oak_bump")
    col, k = wood(2048, 2048, 61, (190, 140, 92), (130, 88, 54), rings=20, warp=0.4, fiber=0.3, streak=0.3)
    save(col, "desk"); save(gray(0.5 + 0.4 * (k - 0.5)), "desk_bump")


def t_linen():
    N = 1024
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    f = 2 * np.pi * 96 / N
    jitter = (fbm(N, N, 71, (16, 16), 3) - 0.5) * 3
    warp = 0.5 + 0.5 * np.sin(xx * f + jitter)
    weft = 0.5 + 0.5 * np.sin(yy * f + jitter * 1.3)
    checker = (np.sin(xx * f / 2) * np.sin(yy * f / 2) > 0)
    h = np.where(checker, warp * 0.7 + weft * 0.3, weft * 0.7 + warp * 0.3)
    slub = fbm(N, N, 72, (2, 64), 3)                        # thicker irregular threads (slubs)
    slub2 = fbm(N, N, 73, (64, 2), 3)
    h = h * 0.6 + (slub - 0.5) * 0.5 + (slub2 - 0.5) * 0.5 + 0.2
    col = lerpc((238, 228, 210), (204, 190, 166), 1 - h)
    col *= (0.96 + 0.08 * fbm(N, N, 74, (3, 3), 3))[..., None]
    save(col, "linen"); save(gray(np.clip(h, 0, 1)), "linen_bump")


# ------------------------------------------------------------------ cheese
def t_cheese():
    N = 1024
    # Alpine hard cheese (comté style): pale gold paste, tyrosine crystals, a few small eyes
    base = fbm(N, N, 81, (4, 4), 5)
    col = lerpc((246, 214, 132), (226, 178, 86), base * 0.9)
    cr = dots(N, N, 900, 0.6, 1.8, 82, 0.5)
    col = col * (1 - 0.6 * cr[..., None]) + np.array([255, 250, 232]) * 0.6 * cr[..., None]
    eyes = dots(N, N, 14, 6, 18, 83, 1.5)
    col *= (1 - 0.28 * eyes)[..., None]
    h = 0.6 + 0.12 * (fbm(N, N, 84, (24, 24), 3) - 0.5) - 0.5 * eyes + 0.15 * cr
    save(col, "comte"); save(gray(h), "comte_bump")
    # rind of the alpine cheese (brushed, brown-orange)
    rb = fbm(N, N, 85, (6, 6), 5)
    col = lerpc((196, 140, 70), (120, 78, 38), rb)
    col *= (0.9 + 0.2 * fbm(N, N, 86, (80, 80), 2))[..., None]
    save(col, "comte_rind"); save(gray(0.5 + 0.5 * (fbm(N, N, 87, (60, 60), 3) - 0.5)), "comte_rind_bump")
    # tomme: ivory paste with many small irregular eyes, grey mottled rind
    base = fbm(N, N, 91, (5, 5), 4)
    col = lerpc((246, 236, 208), (230, 214, 176), base)
    eyes = dots(N, N, 160, 1.5, 6, 92, 1.0)
    col *= (1 - 0.35 * eyes)[..., None]
    save(col, "tomme"); save(gray(0.6 - 0.55 * eyes + 0.1 * (base - 0.5)), "tomme_bump")
    m = fbm(N, N, 93, (8, 8), 5)
    sp = dots(N, N, 1200, 1, 3.5, 94, 1.2)
    col = lerpc((150, 142, 128), (92, 86, 78), m)
    col = col * (1 - 0.5 * sp[..., None]) + np.array([210, 204, 192]) * 0.5 * sp[..., None]
    save(col, "tomme_rind"); save(gray(0.5 + 0.5 * (m - 0.5) + 0.2 * sp), "tomme_rind_bump")
    # blue: ivory paste with blue-grey veins in cracks
    base = fbm(N, N, 101, (4, 4), 4)
    v1 = ridged(N, N, 102, (5, 5), 4); v2 = fbm(N, N, 103, (10, 10), 4)
    veins = np.clip((v1 - 0.82) / 0.12, 0, 1) * np.clip((v2 - 0.35) / 0.2, 0, 1)
    blot = np.clip((fbm(N, N, 104, (14, 14), 3) - 0.62) / 0.1, 0, 1) * np.clip((v1 - 0.6) / 0.2, 0, 1)
    vv = np.clip(veins + blot, 0, 1)
    col = lerpc((244, 238, 222), (228, 220, 198), base)
    col = col * (1 - vv[..., None]) + lerpc((78, 96, 112), (44, 58, 72), fbm(N, N, 105, (30, 30), 2)) * vv[..., None]
    save(col, "blue"); save(gray(0.6 - 0.35 * vv + 0.08 * (base - 0.5)), "blue_bump")


# ------------------------------------------------------------------ charcuterie
def t_charcuterie():
    # dry-cured ham ribbon: u along the slice, v across; fat band along the top edge
    H_, W_ = 512, 2048
    y = np.arange(H_, dtype=np.float32)[:, None] / H_
    edge = 0.87 + 0.04 * (fbm(H_, W_, 111, (2, 6), 3) - 0.5) * 2
    fat = np.clip((y - edge) / 0.025, 0, 1)
    m = fbm(H_, W_, 112, (3, 10), 5)
    lean = lerpc((196, 70, 78), (128, 30, 40), m)
    flecks = np.clip((fbm(H_, W_, 113, (5, 20), 4) - 0.6) / 0.12, 0, 1) * (y < edge - 0.04) * 0.35
    lean = lerpc((206, 84, 92), (150, 40, 50), m * 0.9 + (fbm(H_, W_, 115, (2, 6), 3) - 0.5) * 0.4)
    lean = lean * (1 - flecks[..., None]) + np.array([232, 170, 166]) * flecks[..., None]
    fatc = lerpc((246, 226, 218), (232, 196, 188), fbm(H_, W_, 114, (4, 16), 3))
    col = lean * (1 - fat[..., None]) + fatc * fat[..., None]
    col = col * (1 - 0.25 * np.exp(-((y - edge) / 0.01) ** 2))[..., None]
    alpha = np.clip((0.985 - y) / 0.01, 0, 1) * np.clip((y - 0.015) / 0.01, 0, 1)
    save(np.dstack([col, np.broadcast_to(alpha, (H_, W_)) * 255]), "ham", "RGBA")
    save(gray(0.5 + 0.2 * (m - 0.5) + 0.15 * fat), "ham_bump")
    # saucisson face: burgundy meat, dense white fat dots, pepper corns
    N = 1024
    m = fbm(N, N, 121, (6, 6), 5)
    col = lerpc((150, 46, 52), (96, 24, 30), m)
    fatd = np.clip(dots(N, N, 520, 3, 11, 122, 1.2) * 1.6, 0, 1)
    col = col * (1 - fatd[..., None]) + lerpc((246, 236, 224), (226, 210, 196), fbm(N, N, 123, (20, 20), 2)) * fatd[..., None]
    pep = dots(N, N, 60, 2, 4, 124, 0.8)
    col *= (1 - 0.8 * pep)[..., None]
    save(col, "saucisson_face"); save(gray(0.5 + 0.25 * fatd - 0.1 * pep + 0.1 * (m - 0.5)), "saucisson_face_bump")
    # peppered skin: grey-white bloom with crushed black pepper
    H2, W2 = 256, 1024
    b = fbm(H2, W2, 125, (4, 16), 5)
    col = lerpc((226, 220, 208), (150, 140, 128), b)
    pep = np.clip(dots(H2, W2, 5200, 0.6, 2.0, 126, 0.5) * 1.4, 0, 1)
    col = col * (1 - 0.85 * pep[..., None]) + np.array([34, 28, 24]) * 0.85 * pep[..., None]
    cr = np.clip((ridged(H2, W2, 127, (3, 12), 3) - 0.93) / 0.05, 0, 1)
    col *= (1 - 0.3 * cr)[..., None]
    save(col, "saucisson_skin"); save(gray(0.5 + 0.4 * pep - 0.2 * cr + 0.1 * (b - 0.5)), "saucisson_skin_bump")
    # coppa: deep red with fat marbling swirls and a spiced edge
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    r = np.sqrt((xx - N / 2) ** 2 + (yy - N / 2) ** 2) / (N / 2)
    m = fbm(N, N, 131, (4, 4), 5)
    col = lerpc((176, 46, 56), (110, 22, 32), m)
    w = fbm(N, N, 132, (3, 3), 4)
    sw = np.clip((fbm(N, N, 133, (4, 4), 4) - 0.58) / 0.07, 0, 1) * np.clip((w - 0.35) / 0.2, 0, 1)
    sw = np.clip(sw + np.clip((fbm(N, N, 136, (14, 14), 3) - 0.66) / 0.08, 0, 1) * 0.45, 0, 1)
    col = col * (1 - 0.85 * sw[..., None]) + np.array([244, 226, 216]) * 0.85 * sw[..., None]
    spice = np.clip((r - 0.86) / 0.06, 0, 1)
    col = col * (1 - spice[..., None]) + lerpc((140, 50, 30), (90, 30, 20), fbm(N, N, 134, (40, 40), 2)) * spice[..., None]
    alpha = np.clip((0.985 - r) / 0.012 - (fbm(N, N, 135, (12, 12), 3) - 0.5) * 2.5, 0, 1)
    save(np.dstack([col, alpha * 255]), "coppa", "RGBA"); save(gray(0.5 + 0.15 * sw + 0.1 * (m - 0.5)), "coppa_bump")


# ------------------------------------------------------------------ bread, nuts, fruit
def t_bread():
    N = 1024
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    dx, dy = (xx - N / 2) / (N / 2), (yy - N / 2) / (N / 2)
    r = np.sqrt(dx ** 2 + dy ** 2)
    pores_big = dots(N, N, 90, 4, 16, 141, 1.5, wrap=False)
    pores = np.clip(dots(N, N, 2600, 1.2, 5, 142, 0.8, wrap=False) + pores_big, 0, 1)
    cell = fbm(N, N, 143, (32, 32), 3)
    toast = np.clip((r - 0.35) / 0.6, 0, 1) ** 1.6 + (fbm(N, N, 144, (5, 5), 4) - 0.5) * 0.5
    col = lerpc((238, 206, 150), (178, 112, 52), np.clip(toast + 0.15, 0, 1))
    col *= (0.9 + 0.2 * cell)[..., None]
    lip = np.clip(np.roll(np.roll(pores, 3, 0), 2, 1) - pores, 0, 1)
    col = col * (1 - 0.6 * pores[..., None]) + np.array([112, 64, 30]) * 0.6 * pores[..., None]
    col = col * (1 - 0.35 * lip[..., None]) + np.array([250, 226, 180]) * 0.35 * lip[..., None]
    crust = np.clip((r - 0.9) / 0.05, 0, 1)
    col = col * (1 - crust[..., None]) + lerpc((128, 74, 34), (78, 42, 20), fbm(N, N, 145, (30, 30), 2)) * crust[..., None]
    save(col, "toast"); save(gray(0.62 - 0.5 * pores + 0.12 * (cell - 0.5) + 0.1 * crust), "toast_bump")
    H2, W2 = 256, 1024
    c = fbm(H2, W2, 146, (6, 24), 5)
    col = lerpc((150, 90, 42), (82, 46, 22), c)
    fl = dots(H2, W2, 300, 1, 3, 147, 0.7)
    col = col * (1 - 0.4 * fl[..., None]) + np.array([214, 190, 150]) * 0.4 * fl[..., None]   # flour dust
    save(col, "crust"); save(gray(0.5 + 0.5 * (c - 0.5)), "crust_bump")
    # walnut shell / kernel
    w = ridged(N, N, 151, (8, 8), 4)
    col = lerpc((176, 124, 72), (104, 66, 34), w)
    save(col, "walnut_kernel"); save(gray(w), "walnut_kernel_bump")
    # dried apricot
    a = fbm(N, N, 161, (6, 6), 5); wr = ridged(N, N, 162, (5, 9), 4)
    col = lerpc((238, 150, 54), (196, 96, 30), a * 0.7 + wr * 0.3)
    save(col, "apricot"); save(gray(0.4 + 0.6 * wr), "apricot_bump")
    # terrine (rustic pâté): coarse pink-brown mince with fat and pepper
    m = fbm(N, N, 171, (10, 10), 5)
    col = lerpc((176, 110, 92), (120, 70, 56), m)
    chunks = np.clip(dots(N, N, 700, 2, 9, 172, 1.2) * 1.3, 0, 1)
    col = col * (1 - 0.6 * chunks[..., None]) + np.array([214, 168, 150]) * 0.6 * chunks[..., None]
    pep = dots(N, N, 200, 1.5, 3, 173, 0.6)
    col *= (1 - 0.7 * pep)[..., None]
    save(col, "terrine"); save(gray(0.5 + 0.3 * (m - 0.5) + 0.2 * chunks), "terrine_bump")


# ------------------------------------------------------------------ studio & misc
def t_misc():
    N = 512
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    r = np.sqrt((xx - N / 2) ** 2 + (yy - N / 2) ** 2) / (N / 2)
    n = fbm(N, N, 181, (4, 4), 5)
    smoke = np.clip(1 - r, 0, 1) ** 1.6 * np.clip(n * 1.6 - 0.35, 0, 1)
    save(np.dstack([np.full((N, N, 3), 255.0), smoke * 255]), "smoke", "RGBA")
    soft = np.clip(1 - r, 0, 1) ** 2
    save(np.dstack([np.full((N, N, 3), 255.0), soft * 255]), "softdot", "RGBA")
    # condensation droplets (normal-ish height + alpha)
    H2, W2 = 1024, 512
    d = dots(H2, W2, 900, 1, 5, 182, 1.4)
    d2 = dots(H2, W2, 90, 4, 10, 183, 2.5)
    save(gray(np.clip(d + d2, 0, 1)), "droplets")
    # warm plaster wall
    col = lerpc((232, 214, 186), (204, 178, 142), fbm(1024, 1024, 184, (3, 3), 6))
    save(col, "wall")


ALL = {"birch": t_birch, "logo": t_logo_fx, "tables": t_tables, "linen": t_linen, "cheese": t_cheese,
       "charcuterie": t_charcuterie, "bread": t_bread, "misc": t_misc}

if __name__ == "__main__":
    names = sys.argv[1:] or list(ALL)
    for n in names:
        ALL[n]()
