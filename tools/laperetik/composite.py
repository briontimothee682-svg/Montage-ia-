"""Final compositing of the L'Apéretik reel: warm grade, halation, grain, vignette, beat punches and flashes,
kinetic French titles (Oswald / Playfair Display) inside the Instagram safe zone, the end card, and the export.
Usage:
  python3 tools/laperetik/composite.py frames 0.6 4.6 ...   # test frames -> exports/laperetik_work/comp_test/
  python3 tools/laperetik/composite.py video                 # exports/laperetik_reel.mp4 (+ _sans_son)
"""
import json, math, os, subprocess, sys
from functools import lru_cache
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ig  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
ig.POSTER = lambda: Image.fromarray((base_frame(816) * 255).astype(np.uint8), 'RGB')
WORK = ROOT / "exports/laperetik_work"
F3D = WORK / "f3d"
FONTS = ROOT / "assets/laperetik/fonts"
TEX = ROOT / "assets/laperetik/tex"
B = json.loads((Path(__file__).resolve().parent / "brand.json").read_text())
W, H, FPS, DUR = 1080, 1920, 24, 56.0
NFR = int(DUR * FPS)
LAST_3D = int(54.0 * FPS) - 1          # the last 2 s hold the frame still
CREAM = (244, 236, 223); ESPRESSO = (58, 42, 31); GOLD = (201, 161, 91); GOLD_L = (232, 196, 119); CARAMEL = (168, 120, 76)
SAFE = dict(left=80, right=W - 140, top=250, bottom=int(H * 0.8))
BEAT = 0.5


def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def prog(t, a, b): return clamp((t - a) / (b - a))
def ease_out(p): return 1 - (1 - p) ** 3
def ease_in_out(p): return 4 * p ** 3 if p < 0.5 else 1 - (-2 * p + 2) ** 3 / 2
def ease_back(p, s=1.7): p -= 1; return 1 + (s + 1) * p ** 3 + s * p ** 2
def lerp(a, b, p): return a + (b - a) * p


@lru_cache(maxsize=None)
def font(name, size):
    return ImageFont.truetype(str(FONTS / f"{name}.ttf"), size)


# ------------------------------------------------------------------ look
@lru_cache(maxsize=None)
def maps():
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    r2 = ((x - W / 2) / (W * 0.62)) ** 2 + ((y - H * 0.47) / (H * 0.6)) ** 2
    vign = np.clip(1 - 0.17 * r2 ** 1.4, 0.6, 1)[..., None]
    return vign


@lru_cache(maxsize=None)
def grain_tiles():
    rng = np.random.default_rng(9)
    tiles = []
    for _ in range(8):
        g = rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32)
        g = np.asarray(Image.fromarray(g, "F").resize((W, H), Image.BILINEAR))
        tiles.append(g)
    return tiles


def grade(arr, t):
    """arr float32 0..1 RGB -> graded"""
    x = arr
    # warm split toning: espresso shadows, cream highlights
    lum = (0.2126 * x[..., 0] + 0.7152 * x[..., 1] + 0.0722 * x[..., 2])[..., None]
    sh = np.clip(1 - lum * 2.2, 0, 1); hi = np.clip(lum * 1.6 - 0.6, 0, 1)
    x = x + sh * np.array([0.010, 0.004, -0.002], np.float32) + hi * np.array([0.006, 0.002, -0.006], np.float32)
    # gentle filmic S-curve
    x = np.clip(x, 0, 1)
    x = x + 0.06 * (x - x * x) * (2 * x - 1) * -1.0
    x = np.clip(x * 1.02 - 0.004, 0, 1)
    # saturation trim on the very hot oranges, keep it appetizing
    m = x.mean(axis=2, keepdims=True)
    x = m + (x - m) * 1.0
    return np.clip(x, 0, 1)


def halation(img, amount=0.08):
    small = img.resize((W // 4, H // 4), Image.BILINEAR)
    a = np.asarray(small).astype(np.float32) / 255
    lum = a.mean(axis=2, keepdims=True)
    hl = np.clip((lum - 0.72) / 0.28, 0, 1) * a
    hl_img = Image.fromarray((hl * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9)).resize((W, H), Image.BILINEAR)
    h = np.asarray(hl_img).astype(np.float32) / 255
    return h * np.array([1.0, 0.72, 0.42], np.float32) * amount


# ------------------------------------------------------------------ text
def text_img(s, fname, size, color, tracking=0, glow=None, shadow=True):
    f = font(fname, size)
    w = int(sum(f.getlength(c) for c in s) + tracking * max(0, len(s) - 1)) + 40
    asc, desc = f.getmetrics()
    h = asc + desc + 40
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    x = 20
    for c in s:
        d.text((x, 20), c, font=f, fill=(*color, 255)); x += f.getlength(c) + tracking
    out = Image.new("RGBA", (w + 60, h + 60), (0, 0, 0, 0))
    if shadow:
        a = im.getchannel("A").filter(ImageFilter.GaussianBlur(size * 0.12))
        sc = (20, 12, 6) if sum(color) > 380 else (255, 246, 230)
        sh = Image.new("RGBA", im.size, (*sc, 0)); sh.putalpha(a.point(lambda v: int(v * 0.55)))
        out.alpha_composite(sh, (30, 34))
    out.alpha_composite(im, (30, 30))
    return out


def paste(canvas, im, cx, cy, alpha=1.0, scale=1.0, dy=0.0, blur=0.0):
    if alpha <= 0.003: return
    if scale != 1.0:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BICUBIC)
    if blur > 0.3:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    if alpha < 1:
        a = im.getchannel("A").point(lambda v: int(v * alpha)); im = im.copy(); im.putalpha(a)
    canvas.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2 + dy)))


def region_lum(base, cx, cy, w, h):
    x0, x1 = int(max(0, cx - w / 2)), int(min(W, cx + w / 2)); y0, y1 = int(max(0, cy - h / 2)), int(min(H, cy + h / 2))
    a = base[y0:y1:4, x0:x1:4]
    return float((0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]).mean())


def auto_color(base, cx, cy, w, h):
    """cream on dark backgrounds, espresso on light ones"""
    return ESPRESSO if region_lum(base, cx, cy, w, h) > 0.6 else CREAM


@lru_cache(maxsize=64)
def scrim_img(w, h, dark):
    im = Image.new("L", (w + 200, h + 200), 0)
    ImageDraw.Draw(im).ellipse((100, 100, w + 100, h + 100), fill=255)
    im = im.filter(ImageFilter.GaussianBlur(min(w, h) * 0.35))
    col = (24, 14, 8) if dark else (250, 240, 226)
    out = Image.new("RGBA", im.size, (*col, 0)); out.putalpha(im.point(lambda v: int(v * (0.42 if dark else 0.5))))
    return out


def title(canvas, base, s, fname, size, cx, cy, t, t_in, t_out, color=None, tracking=0, mode="rise", accent=None, scrim=True):
    """kinetic title: letters rise with a stagger on t_in, leave fast on t_out"""
    if t < t_in - 0.01 or t > t_out + 0.35: return
    if scrim:
        f0 = font(fname, size); tw = int(f0.getlength(s) + tracking * len(s))
        col0 = color or auto_color(base, cx, cy, tw + 40, size * 1.3)
        k0 = ease_out(prog(t, t_in, t_in + 0.35)) * (1 - prog(t, t_out, t_out + 0.3))
        paste(canvas, scrim_img(int(tw * 1.15) // 8 * 8, int(size * 1.6) // 8 * 8, sum(col0) > 380), cx, cy + size * 0.1, k0)
    f = font(fname, size)
    fb = font("Inter-700", size)
    glen = lambda c: size * 0.9 if c == "→" else (fb if (c == "·" and fname.startswith("Oswald")) else f).getlength(c)
    total = sum(glen(c) for c in s) + tracking * (len(s) - 1)
    col = color or auto_color(base, cx, cy, total + 40, size * 1.3)
    x = cx - total / 2
    n = len(s)
    for i, c in enumerate(s):
        cw = glen(c)
        if c != " ":
            k = ease_out(prog(t, t_in + i * 0.022, t_in + i * 0.022 + 0.32))
            ko = prog(t, t_out + i * 0.01, t_out + i * 0.01 + 0.22)
            a = k * (1 - ko)
            if a > 0.003:
                im = letter(c, fname, size, col if not (accent and i in accent) else GOLD)
                dy = (1 - k) * size * 0.55 - ease_out(ko) * size * 0.4
                paste(canvas, im, x + cw / 2, cy, a, 1.0, dy, (1 - k) * 6 + ko * 6)
        x += cw + tracking


@lru_cache(maxsize=4096)
def letter(c, fname, size, color):
    if c == "→":
        return arrow_img(size, color)
    if c in "·" and fname.startswith("Oswald"):
        fname = "Inter-700"
    return text_img(c, fname, size, color, 0, shadow=True)


def arrow_img(size, color):
    """drawn arrow (the web font subsets have no arrow glyph)"""
    f = font("Oswald-700", size); asc, desc = f.getmetrics()
    w, h = int(size * 0.9) + 40, asc + desc + 40
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    cy = 20 + asc * 0.62; lw = max(4, int(size * 0.11)); x0, x1 = 24, w - 24
    d.line((x0, cy, x1 - lw, cy), fill=(*color, 255), width=lw)
    d.line((x1 - size * 0.32, cy - size * 0.3, x1, cy), fill=(*color, 255), width=lw, joint="curve")
    d.line((x1 - size * 0.32, cy + size * 0.3, x1, cy), fill=(*color, 255), width=lw, joint="curve")
    out = Image.new("RGBA", (w + 60, h + 60), (0, 0, 0, 0))
    a = im.getchannel("A").filter(ImageFilter.GaussianBlur(size * 0.12))
    sc = (20, 12, 6) if sum(color) > 380 else (255, 246, 230)
    sh = Image.new("RGBA", im.size, (*sc, 0)); sh.putalpha(a.point(lambda v: int(v * 0.55)))
    out.alpha_composite(sh, (30, 34)); out.alpha_composite(im, (30, 30))
    return out


def line(canvas, base, s, fname, size, cx, cy, t, t_in, t_out, color=None, tracking=0, scrim=True):
    """whole line slides up + fades (for small copy)"""
    if t < t_in or t > t_out + 0.3: return
    k = ease_out(prog(t, t_in, t_in + 0.4)); ko = prog(t, t_out, t_out + 0.25)
    col = color or auto_color(base, cx, cy, 700, size * 1.4)
    im = text_img(s, fname, size, col, tracking)
    tw = im.width - 100
    if scrim: paste(canvas, scrim_img(int(tw * 1.1) // 8 * 8, int(size * 1.9) // 8 * 8, sum(col) > 380), cx, cy + size * 0.1, k * (1 - ko))
    paste(canvas, im, cx, cy, k * (1 - ko), 1.0, (1 - k) * 30 - ko * 20, (1 - k) * 4)


def gold_rule(canvas, cx, cy, w, t, t_in, t_out):
    k = ease_in_out(prog(t, t_in, t_in + 0.4)) * (1 - prog(t, t_out, t_out + 0.2))
    if k <= 0: return
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle((cx - w * k / 2, cy - 2, cx + w * k / 2, cy + 2), radius=2, fill=(*GOLD, int(255 * k)))


# ------------------------------------------------------------------ end card pieces
@lru_cache(maxsize=None)
def logo_disc(size):
    """the logo exactly in its colours: black (#151515) on white"""
    m = Image.open(TEX / "logo_mask.png").resize((int(size * 0.9), int(size * 0.9)), Image.LANCZOS)
    im = Image.new("RGBA", (size + 80, size + 80), (0, 0, 0, 0))
    sh = Image.new("L", im.size, 0); ImageDraw.Draw(sh).ellipse((40, 50, 40 + size, 50 + size), fill=120)
    im.alpha_composite(Image.merge("RGBA", (Image.new("L", im.size, 10),) * 3 + (sh.filter(ImageFilter.GaussianBlur(22)),)))
    ImageDraw.Draw(im).ellipse((40, 40, 40 + size, 40 + size), fill=(255, 255, 255, 255))
    ink = Image.new("RGBA", m.size, (21, 21, 21, 0)); ink.putalpha(m)
    im.alpha_composite(ink, (40 + (size - m.width) // 2, 40 + (size - m.height) // 2))
    return im


def sweep_band(im, k, width=0.18):
    """golden light sweep across an RGBA image (k: 0..1 position)"""
    if k <= 0 or k >= 1: return im
    w, h = im.size
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    u = (x / w * 0.75 + y / h * 0.45) / 1.2
    band = np.exp(-((u - lerp(-0.2, 1.2, k)) / width) ** 2)
    a = np.asarray(im).astype(np.float32)
    add = band[..., None] * np.array([255, 214, 140], np.float32) * 0.55 * (a[..., 3:4] / 255)
    a[..., :3] = np.clip(a[..., :3] + add, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def pill(canvas, cx, cy, w, h, fill, alpha):
    lay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(lay).rounded_rectangle((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), radius=h / 2, fill=(*fill, int(255 * alpha)))
    canvas.alpha_composite(lay)


# ------------------------------------------------------------------ per-frame overlays
def overlays(canvas, base, t):
    cx = (SAFE["left"] + SAFE["right"]) / 2       # 510: text centred inside the safe zone
    # 0:00-0:04 the logo on the box, with the address
    title(canvas, base, "NOUVEAU À ANNECY", "Oswald-700", 96, cx, 300, t, 0.35, 3.7, tracking=5)
    line(canvas, base, f"{B['street_number']} {B['street']} · {B['city']}", "Inter-600", 38, cx, 392, t, 0.75, 3.7)
    line(canvas, base, B["hours"], "Oswald-500", 38, cx, 448, t, 1.0, 3.7, color=GOLD_L, tracking=2)
    line(canvas, base, B["handle"], "Inter-700", 44, cx, 506, t, 1.2, 3.7, color=GOLD_L)
    # 0:04-0:06 the tagline
    title(canvas, base, "Chassez le naturel,", "PlayfairDisplay-700i", 82, cx, 330, t, 4.0, 5.85)
    title(canvas, base, "il revient à l'apéro", "PlayfairDisplay-700i", 82, cx, 425, t, 4.35, 5.85)
    # 0:06-0:10
    title(canvas, base, "LA BOX APÉRO", "Oswald-700", 128, cx, 360, t, 6.15, 7.75, tracking=6)
    gold_rule(canvas, cx, 452, 300, t, 6.4, 7.75)
    title(canvas, base, "Produits locaux", "Oswald-700", 92, cx, 340, t, 7.95, 9.75, tracking=3)
    title(canvas, base, "circuit court", "PlayfairDisplay-700i", 78, cx, 440, t, 8.15, 9.75)
    # 0:10-0:15
    title(canvas, base, "Fromages & charcuterie", "Oswald-700", 86, cx, 330, t, 10.35, 14.65, tracking=2)
    title(canvas, base, "à la découpe", "PlayfairDisplay-700i", 76, cx, 430, t, 10.6, 14.65)
    # 0:15-0:20
    title(canvas, base, "Producteurs locaux", "Oswald-700", 96, cx, 330, t, 18.05, 19.85, tracking=3)
    title(canvas, base, "Bio · AOP · IGP", "Oswald-500", 70, cx, 430, t, 18.3, 19.85, color=GOLD_L, tracking=6)
    # 0:27-0:34
    if 25.4 <= t < 34.0:
        ig.inside(canvas, t)          # inside the screen: Reel, like, profile, follow, open the post
    # 0:42-0:48
    title(canvas, base, "Un accueil au top", "Oswald-700", 104, cx, 330, t, 42.4, 44.75, tracking=3)
    title(canvas, base, "Un très bon rapport", "Oswald-700", 92, cx, 320, t, 45.3, 47.75, tracking=2)
    title(canvas, base, "qualité-prix", "PlayfairDisplay-700i", 92, cx, 424, t, 45.55, 47.75, color=GOLD_L)
    # 0:48-0:56 end card
    if t >= 51.9:
        title(canvas, base, "NOUVEAU À ANNECY", "Oswald-700", 96, cx, 300, t, 52.2, 99, color=CREAM, tracking=5)
        line(canvas, base, f"{B['street_number']} {B['street']} · {B['city']}", "Inter-600", 36, cx, 392, t, 52.55, 99, color=CREAM)
        line(canvas, base, B["hours"], "Oswald-500", 38, cx, 448, t, 52.75, 99, color=GOLD_L, tracking=2)
        line(canvas, base, B["handle"], "Inter-700", 46, cx, 512, t, 52.95, 99, color=GOLD_L)


def end_darkening(arr, t):
    if t < 51.9: return arr
    k = ease_in_out(prog(t, 51.9, 52.6))
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    top = np.clip(1 - y / 0.3, 0, 1) ** 1.4 * 0.5
    return arr * (1 - k * (0.16 + top))


# beat punches & flashes on the strong hits
HITS = [6.0, 10.0, 20.0, 34.0, 52.0]
CUTS = [4.0, 10.0, 20.0, 34.0, 42.0, 45.0, 48.0]


def punch(t):
    s = 1.0
    for h in HITS:
        if h <= t < h + 0.4: s += 0.035 * (1 - ease_out(prog(t, h, h + 0.4)))
    for b in np.arange(6.0, 52.0, 2.0):          # soft pulse on every bar after the drop
        if b <= t < b + 0.25 and b not in HITS: s += 0.008 * (1 - prog(t, b, b + 0.25))
    return s


def flash(t):
    return 0.0          # no flashes or glare at all: every cut is clean


TEST_T = None


def frame_3d(fi):
    if os.environ.get("TESTDIR") and TEST_T is not None:
        p = Path(os.environ["TESTDIR"]) / f"t{TEST_T:.2f}.png"
        if p.exists(): return Image.open(p).convert("RGB")
    fi = min(fi, LAST_3D)
    p = F3D / f"f{fi:04d}.png"
    if not p.exists():
        return None
    return Image.open(p).convert("RGB")


def composite(fi):
    base = base_frame(fi)
    t = fi / FPS
    canvas = Image.fromarray((base * 255).astype(np.uint8), "RGB").convert("RGBA")
    overlays(canvas, base, t)
    return canvas.convert("RGB")


def base_frame(fi):
    t = fi / FPS
    im = frame_3d(fi)
    if im is None:
        im = Image.new("RGB", (W, H), (40, 30, 22))
    s = punch(t)
    if s > 1.0005:
        w2, h2 = int(W * s), int(H * s)
        im = im.resize((w2, h2), Image.BICUBIC).crop(((w2 - W) // 2, (h2 - H) // 2, (w2 - W) // 2 + W, (h2 - H) // 2 + H))
    arr = np.asarray(im).astype(np.float32) / 255
    arr = grade(arr, t)
    arr = end_darkening(arr, t)
    f = flash(t)
    if f > 0: arr = arr * (1 - f) + np.array([1.0, 0.95, 0.86], np.float32) * f
    arr = arr * maps()
    g = grain_tiles()[fi % 8] if fi <= LAST_3D else grain_tiles()[fi % 8]
    lum = arr.mean(axis=2, keepdims=True)
    arr = arr + g[..., None] * (0.010 + 0.010 * (1 - lum))
    return np.clip(arr, 0, 1)


def test(ts):
    out = Path(os.environ.get("OUT", WORK / "comp_test")); out.mkdir(parents=True, exist_ok=True)
    global TEST_T
    for t in ts:
        fi = int(round(float(t) * FPS)); TEST_T = float(t)
        composite(fi).save(out / f"c{float(t):05.2f}.jpg", quality=92)
        print("frame", t)


def _job(fi):
    composite(fi).save(WORK / "comp" / f"c{fi:04d}.jpg", quality=95)
    return fi


def video(workers=4):
    (WORK / "comp").mkdir(parents=True, exist_ok=True)
    todo = [fi for fi in range(NFR) if not (WORK / "comp" / f"c{fi:04d}.jpg").exists() or os.environ.get("FORCE")]
    with Pool(workers) as p:
        for k, fi in enumerate(p.imap_unordered(_job, todo, chunksize=4)):
            if k % 96 == 0: print("composited", k, "/", len(todo), flush=True)
    wav = WORK / "music.wav"
    out = WORK / "laperetik_reel_master.mp4"; silent = WORK / "laperetik_reel_sans_son_master.mp4"
    vargs = ["-framerate", str(FPS), "-i", str(WORK / "comp" / "c%04d.jpg")]
    enc = ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", str(FPS)]
    subprocess.run(["ffmpeg", "-y", "-v", "error", *vargs, *enc, str(silent)], check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(silent), "-i", str(wav), "-c:v", "copy",
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=9", "-ar", "48000", "-c:a", "aac", "-b:a", "320k", "-shortest", str(out)], check=True)
    light = ["-c:v", "libx264", "-preset", "slow", "-crf", "19", "-maxrate", "14M", "-bufsize", "28M", "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(out), *light, "-c:a", "copy", str(ROOT / "exports/laperetik_reel.mp4")], check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(silent), *light, "-an", str(ROOT / "exports/laperetik_reel_sans_son.mp4")], check=True)
    print("wrote exports/laperetik_reel.mp4 and exports/laperetik_reel_sans_son.mp4 (masters in", WORK, ")")


def preview(a, b, workers=2):
    """composite frames a..b and encode a quick preview with the matching slice of the music"""
    (WORK / "comp").mkdir(parents=True, exist_ok=True)
    todo = [fi for fi in range(a, b) if not (WORK / "comp" / f"c{fi:04d}.jpg").exists() or os.environ.get("FORCE")]
    with Pool(workers) as p:
        list(p.imap_unordered(_job, todo, chunksize=4))
    out = WORK / f"preview_{a}_{b}.mp4"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-framerate", str(FPS), "-start_number", str(a), "-i", str(WORK / "comp" / "c%04d.jpg"),
                    "-ss", f"{a / FPS:.3f}", "-t", f"{(b - a) / FPS:.3f}", "-i", str(WORK / "music.wav"), "-frames:v", str(b - a),
                    "-c:v", "libx264", "-crf", "20", "-preset", "fast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", str(out)], check=True)
    print("wrote", out)


if __name__ == "__main__":
    if sys.argv[1] == "frames": test(sys.argv[2:])
    elif sys.argv[1] == "preview": preview(int(sys.argv[2]), int(sys.argv[3]))
    elif sys.argv[1] == "video": video(int(os.environ.get("WORKERS", "4")))
