"""Builds a crisp high-resolution alpha mask of the L'Apéretik logo from the 274x268 reference PNG.
The artwork is not redrawn: the source pixels are upscaled and their edges re-sharpened.
Usage: python3 tools/laperetik/logo_mask.py <logo.png>  ->  assets/laperetik/tex/logo_mask.png (3072x3072, white = ink)"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
src = Image.open(sys.argv[1]).convert("RGBA")
bg = Image.new("RGBA", src.size, (255, 255, 255, 255)); bg.alpha_composite(src)
ink = 1 - np.asarray(bg.convert("L")).astype(np.float32) / 255
ys, xs = np.nonzero(ink > 0.5)
cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
r = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 + 2
im = Image.fromarray((ink * 255).astype(np.uint8), "L").crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r)))
N = int(sys.argv[2]) if len(sys.argv) > 2 else 3072
big = im.resize((N, N), Image.BICUBIC).filter(ImageFilter.GaussianBlur(N / 700))
a = np.asarray(big).astype(np.float32) / 255
a = np.clip((a - 0.5) / 0.09 + 0.5, 0, 1)          # re-sharpen the edge (about 2 px wide at 2048)
a = a * a * (3 - 2 * a)
Image.fromarray((a * 255).astype(np.uint8), "L").save(ROOT / "assets/laperetik/tex/logo_mask.png")
print("logo centre", cx, cy, "radius", r)
