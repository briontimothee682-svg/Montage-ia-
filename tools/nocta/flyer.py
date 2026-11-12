"""Shot 9: animated NOCTA CLUB flyer (1080x1920, 24 fps, 4 s).

White strobe flash resolving into a black flyer: haze, blue/violet laser fans, a real neon-tube
"NOCTA" logo that flickers on letter by letter, "CLUB" in electric blue, the venue info, and a
pulse with camera punch, chromatic split and laser burst on the final bass hit.

    python3 tools/nocta/flyer.py --adresse "12 rue Exemple"     -> exports/nocta/nocta_flyer.mp4
"""
import argparse
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from timeline import W, H, FPS, FLASH, FINAL_HIT, DUR, OUT  # noqa: E402
from fx import (font, hex_rgb, text_mask, blur, smooth_noise, upscale, tonemap, to_u8,  # noqa: E402
                grain_bank, vignette, ease_out, ease_in_out, zoom)

LEN = DUR - FLASH                  # 4.0 s
T_HIT = FINAL_HIT - FLASH          # 1.84 s
N_FRAMES = int(round(LEN * FPS))

VIOLET = hex_rgb("#A64DFF")
MAGENTA = hex_rgb("#FF45D6")
BLUE = hex_rgb("#2F7BFF")
CYAN = hex_rgb("#5FB6FF")
WHITE = np.ones(3, np.float32)

LOGO_Y = 740
CLUB_Y = 960
SEP_Y = 1170
INFO_Y = [1290, 1385, 1472]


def default_lines(adresse):
    return [f"{adresse} – Annecy", "Jeudi au samedi · 23h – 5h", "Entrée 15 € · Carré VIP sur réservation"]


class Flyer:
    def __init__(self, adresse="[ADRESSE]", lines=None):
        self.lines = lines or default_lines(adresse)
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        self.X, self.Y = xx, yy
        y2, x2 = np.mgrid[0:H // 2, 0:W // 2].astype(np.float32)
        self.X2, self.Y2 = x2 * 2 + 0.5, y2 * 2 + 0.5
        self._club_lines = None
        self._build_logo()
        self._build_text()
        self.haze_src = smooth_noise(64, 220, 7, ((6, 20, 1.0), (12, 40, .55), (24, 80, .3)))
        self.vig = vignette(0.5)
        self.grain = grain_bank(8, 3, 0.020)
        rng = np.random.default_rng(11)
        self.dust = np.stack([rng.uniform(0, W, 260), rng.uniform(0, H, 260), rng.uniform(0.3, 1, 260),
                              rng.uniform(8, 40, 260)], 1)
        bg = np.zeros((H, W, 3), np.float32)
        r = np.sqrt(((self.X - W / 2) / 900) ** 2 + ((self.Y - LOGO_Y) / 1000) ** 2)
        self.backglow = (np.exp(-r * r * 2.2))[..., None] * (VIOLET * .55 + BLUE * .25)
        grad = np.clip((self.Y - 900) / 1100, 0, 1)[..., None]
        self.bg = bg + grad * hex_rgb("#120A2A") * .35 + hex_rgb("#010103")

    # ---------- static layers ----------
    def _build_logo(self):
        f = font("TiltNeon-Regular.ttf", 300)
        full = text_mask("NOCTA", f, center=(W / 2, LOGO_Y))
        cols = np.where(full.max(0) > 0.02)[0]
        x0, x1 = cols.min(), cols.max()
        # split into letters by the gaps between glyphs
        on = full.max(0) > 0.02
        letters, inside, start = [], False, 0
        for x in range(x0, x1 + 2):
            v = on[x] if x < W else False
            if v and not inside:
                start, inside = x, True
            elif not v and inside:
                letters.append((start, x))
                inside = False
        # glyphs like 'A' may split if not connected; merge to 5 groups by largest gaps
        while len(letters) > 5:
            gaps = [letters[i + 1][0] - letters[i][1] for i in range(len(letters) - 1)]
            i = int(np.argmin(gaps))
            letters[i] = (letters[i][0], letters[i + 1][1])
            del letters[i + 1]
        self.logo_box = (x0, x1)
        self.letters = []
        grad_t = np.clip((self.X - x0) / max(1, x1 - x0), 0, 1)[..., None]
        tint = VIOLET * (1 - grad_t) * 1.0 + MAGENTA * grad_t * 0.9 + VIOLET * grad_t * 0.25
        for a, b in letters:
            m = np.zeros_like(full)
            m[:, a:b] = full[:, a:b]
            im = Image.fromarray((m * 255).astype(np.uint8), "L")
            core = np.asarray(im.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(2.2)), np.float32) / 255
            tube = blur(m, 1.2)
            glow = blur(m, 7) * 1.1 + blur(m, 22) * .9 + blur(m, 60) * .6 + blur(m, 140) * .45
            layer = tube[..., None] * tint * 1.25 + core[..., None] * (WHITE * .5 + tint * .5) * 0.75 + glow[..., None] * tint * 1.15
            self.letters.append(layer.astype(np.float32))
        # CLUB, electric blue, with side lines
        fc = font("Unbounded-Light.ttf", 74)
        club = text_mask("CLUB", fc, center=(W / 2, CLUB_Y), tracking=0.62)
        cols = np.where(club.max(0) > 0.02)[0]
        cx0, cx1 = cols.min(), cols.max()
        self.club_extent = (cx0, cx1)
        line = np.zeros_like(club)
        line[CLUB_Y - 2:CLUB_Y + 2, 120:cx0 - 46] = 1
        line[CLUB_Y - 2:CLUB_Y + 2, cx1 + 46:W - 120] = 1
        self.club_line_raw = line
        self.club = (blur(club, .8)[..., None] * (BLUE * .9 + WHITE * .55) * 1.4
                     + (blur(club, 6) * .9 + blur(club, 24) * .7 + blur(club, 70) * .45)[..., None] * BLUE * 1.3)

    def _build_text(self):
        fonts = [font("Poppins-SemiBold.ttf", 60), font("Poppins-Medium.ttf", 52), font("Poppins-Medium.ttf", 44)]
        colors = [hex_rgb("#FFFFFF"), hex_rgb("#E2D6FF"), hex_rgb("#CFE0FF")]
        self.info = []
        for i, (txt, f, c) in enumerate(zip(self.lines, fonts, colors)):
            size = f.size
            while True:
                m = text_mask(txt, f, center=(W / 2, INFO_Y[i]))
                cols = np.where(m.max(0) > 0.02)[0]
                if cols.max() - cols.min() <= 940 or size < 26:
                    break
                size -= 2
                f = font(f.path.split("/")[-1], size)
            shadow = blur(m, 10)
            glow = blur(m, 16)
            self.info.append((m, shadow, glow, c))
        sep = np.zeros((H, W), np.float32)
        sep[SEP_Y - 1:SEP_Y + 1, :] = 1
        fade = np.exp(-((self.X[0] - W / 2) / 330) ** 2)
        self.sep = sep * fade[None, :]

    # ---------- dynamic ----------
    def lasers(self, tau, energy, spread):
        # computed at half resolution (4x faster), then upscaled
        X, Y = self.X2, self.Y2
        acc = np.zeros(X.shape, np.float32)
        col = np.zeros(X.shape + (3,), np.float32)
        emitters = [
            # x, y, base angle (deg, 0 = right, 90 = down), n beams, fan (deg), color
            (-40, 300, 22, 4, 18, BLUE),
            (W + 40, 300, 158, 4, 18, VIOLET),
            (W / 2, -60, 90, 7, 56, None),
        ]
        for k, (ox, oy, base, n, fan, c) in enumerate(emitters):
            sway = 9 * np.sin(2 * np.pi * (0.13 * tau + 0.21 * k)) + 5 * np.sin(2 * np.pi * 0.31 * tau + k)
            for j in range(n):
                frac = (j - (n - 1) / 2) / max(1, (n - 1) / 2)
                ang = np.deg2rad(base + sway * (1 if k != 1 else -1) + frac * fan * spread)
                ca, sa = np.cos(ang), np.sin(ang)
                dx, dy = X - ox, Y - oy
                along = dx * ca + dy * sa
                perp = np.abs(-dx * sa + dy * ca)
                wc = 1.9 + along * 0.0009
                wg = 10 + along * 0.012
                fade = np.clip(along / 120, 0, 1) * np.exp(-np.maximum(along, 0) / 2600)
                b = (np.exp(-(perp / wc) ** 2) * 1.0 + np.exp(-(perp / wg) ** 2) * 0.12) * fade
                cc = c if c is not None else (BLUE if j % 2 == 0 else VIOLET)
                acc += b
                col += b[..., None] * cc
        acc = upscale(acc, W, H)
        col = np.stack([upscale(col[..., c], W, H) for c in range(3)], -1)
        return acc * energy, col * energy

    def frame(self, i):
        tau = i / FPS
        p = np.exp(-(tau - T_HIT) / 0.22) if tau >= T_HIT else 0.0          # final-hit pulse
        pre = ease_in_out((tau - (T_HIT - 0.5)) / 0.5) if tau < T_HIT else 0.0  # breath before the hit

        # haze drifting upward
        off = (tau * 6.0) % 120
        o = int(off)
        hz = self.haze_src[o:o + 100, :]
        hz = upscale(hz, W, H)
        haze = 0.35 + 0.9 * hz

        img = self.bg.copy()
        img += self.backglow * (0.25 + 0.75 * ease_out(tau / 0.6)) * (1 + 1.5 * p) * haze[..., None] * 0.32
        img += haze[..., None] * hex_rgb("#1A1040") * 0.08

        energy = (0.24 + 0.04 * np.sin(tau * 9)) * (1 - 0.35 * pre) * (1 + 2.6 * p)
        spread = 1.0 - 0.55 * pre + 0.9 * p
        beam, bcol = self.lasers(tau, energy, spread)
        img += bcol * haze[..., None]

        # dust lit by the beams
        d = self.dust
        xs = (d[:, 0] + np.sin(tau * 0.7 + d[:, 3]) * 6).astype(int) % W
        ys = (d[:, 1] - tau * d[:, 3]).astype(int) % H
        lit = (0.04 + beam[ys, xs] * 1.4) * d[:, 2]
        for ddx in (0, 1):
            for ddy in (0, 1):
                img[(ys + ddy) % H, (xs + ddx) % W] += lit[:, None] * hex_rgb("#C8B8FF")

        # neon logo flicker-on
        order = [1, 0, 3, 2, 4]
        patterns = [1, 0, 0, 1, 1, 0, .4, 1, 0, 1, 1, 1]
        for li, layer in enumerate(self.letters):
            t_on = 0.10 + 0.075 * order[li]
            k = int((tau - t_on) * FPS)
            if k < 0:
                continue
            lv = patterns[k] if k < len(patterns) else 1.0
            hum = 1 + 0.03 * np.sin(2 * np.pi * 7.3 * tau + li * 1.7)
            lv *= hum * (1 - 0.18 * pre) * (1 + 1.4 * p)
            img += layer * lv

        # CLUB + side lines
        k = int((tau - 0.55) * FPS)
        if k >= 0:
            lv = [1, 0, .6, 1, 0, 1][k] if k < 6 else 1.0
            img += self.club * lv * (1 + 0.8 * p)
        g = ease_out((tau - 0.62) / 0.42)
        if g >= 1 and self._club_lines is not None:
            img += self._club_lines * (1 + p)
        elif g > 0:
            cx0, cx1 = self.club_extent
            line = np.zeros((H, W), np.float32)
            reach_l = int((cx0 - 46 - 120) * g)
            reach_r = int((W - 120 - cx1 - 46) * g)
            line[:, cx0 - 46 - reach_l:cx0 - 46] = self.club_line_raw[:, cx0 - 46 - reach_l:cx0 - 46]
            line[:, cx1 + 46:cx1 + 46 + reach_r] = self.club_line_raw[:, cx1 + 46:cx1 + 46 + reach_r]
            gl = blur(line, 1) * 1.2 + blur(line, 8) * .8 + blur(line, 28) * .5
            lines = gl[..., None] * BLUE * 1.4
            if g >= 1:
                self._club_lines = lines
            img += lines * (1 + p)

        # separator
        g = ease_out((tau - 0.78) / 0.4)
        if g > 0:
            reach = np.abs(self.X[0] - W / 2) <= g * W / 2
            img += (self.sep * reach[None, :])[..., None] * (VIOLET * .6 + WHITE * .5) * 0.9

        # info lines: dark halo for readability, then text
        for j, (m, shadow, glow, c) in enumerate(self.info):
            t0 = 0.88 + 0.16 * j
            a = ease_out((tau - t0) / 0.38)
            if a <= 0:
                continue
            dy = int(round((1 - a) * 26))
            mm, sh, gl = (np.roll(x, dy, 0) for x in (m, shadow, glow))
            img *= (1 - 0.75 * sh * a)[..., None]
            img += gl[..., None] * c * 0.22 * a
            img = img * (1 - mm[..., None] * a) + mm[..., None] * c * a * 1.05

        # hit flash
        img += p * 0.10 * (WHITE * .5 + CYAN * .5)

        out = tonemap(img) * self.vig
        # white strobe resolving into the flyer
        wf = 0.62 * np.exp(-tau / 0.09) if tau < 0.5 else 0.0
        out = out * (1 - wf) + wf * np.array([0.78, 0.69, 0.96], np.float32)

        # chromatic split on the hit
        k = int(round(9 * p))
        if k:
            out[..., 0] = np.roll(out[..., 0], k, 1)
            out[..., 2] = np.roll(out[..., 2], -k, 1)
        out += self.grain[i % len(self.grain)]
        u8 = to_u8(out)
        z = 1 + 0.025 * tau / LEN + 0.04 * p
        rng = np.random.default_rng(i)
        sh = 12 * p if tau - T_HIT < 3 / FPS else 0
        return zoom(u8, z, rng.uniform(-sh, sh), rng.uniform(-sh, sh))

    def frames(self):
        for i in range(N_FRAMES):
            yield self.frame(i)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--adresse", default="[ADRESSE]")
    ap.add_argument("--test", nargs="*", type=float, help="only render stills at these local times")
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    fl = Flyer(a.adresse)
    if a.test is not None:
        for t in a.test:
            Image.fromarray(fl.frame(int(round(t * FPS)))).save(OUT / f"flyer_t{t:.2f}.png")
        return
    path = OUT / "nocta_flyer.mp4"
    wav = OUT / "nocta_bande_son.wav"
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-"]
    if wav.exists():
        cmd += ["-ss", f"{FLASH}", "-t", f"{LEN}", "-i", str(wav), "-c:a", "aac", "-b:a", "256k"]
    cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(path)]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i, f in enumerate(fl.frames()):
        ff.stdin.write(f.tobytes())
        if i == int(round((T_HIT + 0.6) * FPS)):
            Image.fromarray(f).save(OUT / "nocta_flyer.png")
    ff.stdin.close()
    ff.wait()
    print("wrote", path)


if __name__ == "__main__":
    main()
