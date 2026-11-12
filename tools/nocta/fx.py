"""Small image helpers shared by the NOCTA renderers (numpy float32 images, values 0..1+)."""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from timeline import FONTS, W, H


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def text_mask(text, fnt, size=(W, H), center=None, xy=None, tracking=0.0, anchor="mm", stroke=0):
    """Render text into an L mask (float 0..1). tracking is extra spacing in em."""
    im = Image.new("L", size, 0)
    d = ImageDraw.Draw(im)
    if tracking == 0:
        pos = center if center is not None else xy
        d.text(pos, text, font=fnt, fill=255, anchor=anchor if center is not None else "la",
               stroke_width=stroke, stroke_fill=255)
    else:
        em = fnt.size
        widths = [d.textlength(c, font=fnt) for c in text]
        total = sum(widths) + tracking * em * (len(text) - 1)
        cx, cy = center
        x = cx - total / 2
        for c, w_ in zip(text, widths):
            d.text((x, cy), c, font=fnt, fill=255, anchor="lm", stroke_width=stroke, stroke_fill=255)
            x += w_ + tracking * em
    return np.asarray(im, np.float32) / 255


def blur(a, r):
    """Gaussian blur of a float 2D array (0..1) via PIL."""
    if r <= 0:
        return a
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8), "L")
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), np.float32) / 255


def blur_f(a, r):
    """Gaussian blur keeping float precision (for values above 1): via mode F."""
    im = Image.fromarray(a.astype(np.float32), "F")
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), np.float32)


def smooth_noise(w, h, seed, octaves=((9, 16, 1.0), (18, 32, .5), (36, 64, .25))):
    """fractal value noise at resolution (h, w), values ~0..1"""
    rng = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32)
    tot = 0
    for gx, gy, amp in octaves:
        g = rng.random((gy, gx)).astype(np.float32)
        im = Image.fromarray(g, "F").resize((w, h), Image.BICUBIC)
        acc += np.asarray(im, np.float32) * amp
        tot += amp
    acc /= tot
    acc = (acc - acc.min()) / (acc.max() - acc.min() + 1e-6)
    return acc


def upscale(a, w=W, h=H):
    return np.asarray(Image.fromarray(a.astype(np.float32), "F").resize((w, h), Image.BICUBIC), np.float32)


def tonemap(x, exposure=1.0):
    """filmic shoulder: keeps darks linear-ish, rolls hot neon cores into white"""
    x = np.maximum(x * exposure, 0)
    lum = x.max(axis=2, keepdims=True)
    # desaturate toward white when very hot
    hot = np.clip((lum - 1.6) / 3.0, 0, 1)
    x = x * (1 - hot) + lum * hot
    return 1 - np.exp(-x * 1.15)


def to_u8(x):
    return (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)


def grain_bank(n, seed, sigma=0.022, h=H, w=W):
    rng = np.random.default_rng(seed)
    bank = []
    for _ in range(n):
        g = rng.normal(0, 1, (h // 2, w // 2)).astype(np.float32)
        g = upscale(g, w, h) * sigma
        bank.append(g[..., None])
    return bank


def vignette(strength=0.45, h=H, w=W):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (x - w / 2) / (w / 2)
    ny = (y - h / 2) / (h / 2)
    r = np.sqrt(nx ** 2 * 1.0 + ny ** 2 * 0.75)
    return (1 - strength * np.clip(r - 0.35, 0, 1) ** 1.6)[..., None].astype(np.float32)


def ease_out(t):
    t = np.clip(t, 0, 1)
    return 1 - (1 - t) ** 3


def ease_in_out(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def zoom(img_u8, s, dx=0.0, dy=0.0):
    """scale an RGB uint8 frame around its center (s >= 1) with an optional shift"""
    if abs(s - 1) < 1e-4 and dx == 0 and dy == 0:
        return img_u8
    im = Image.fromarray(img_u8)
    w, h = im.size
    cw, ch = w / s, h / s
    x0 = (w - cw) / 2 - dx / s
    y0 = (h - ch) / 2 - dy / s
    return np.asarray(im.transform((w, h), Image.EXTENT, (x0, y0, x0 + cw, y0 + ch), Image.BICUBIC))
