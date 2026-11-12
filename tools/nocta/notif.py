"""Shot 1: the floating glass notification card with the readable message.

AI video models garble on-screen text, so the four phones are generated without readable text and
this card is composited at 2.5 s, when the four screens light up: it rises with a 3D tilt, floats,
catches a light sweep, then drifts up and dissolves before the friends look at each other (6.0 s).

    python3 tools/nocta/notif.py --adresse "12 rue Exemple"   -> exports/nocta/nocta_notification.mov (alpha)
"""
import argparse
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from timeline import W, H, FPS, NOTIF, OUT  # noqa: E402
from fx import font, ease_out  # noqa: E402

LEN = 6.0 - NOTIF          # 3.5 s
SS = 2                      # supersampling of the flat card
CW, CH0 = 940, 0            # card width (height depends on the text)
RADIUS = 56


def message(adresse):
    return f"RDV ce soir pour la meilleure soirée de votre vie — {adresse}, Annecy"


def wrap(draw, text, fnt, width):
    words, lines, cur = text.split(" "), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if draw.textlength(t, font=fnt) <= width:
            cur = t
        else:
            lines.append(cur)
            cur = w_
    lines.append(cur)
    return lines


def ease_out_back(t, k=1.6):
    t = np.clip(t, 0, 1)
    return 1 + (k + 1) * (t - 1) ** 3 + k * (t - 1) ** 2


def find_coeffs(dst, src):
    """PIL perspective coefficients mapping output (dst quad) -> input (src quad)"""
    m = []
    for (x, y), (u, v) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    a = np.array(m, np.float64)
    b = np.array(src, np.float64).reshape(8)
    return np.linalg.solve(a, b).tolist()


class NotifCard:
    def __init__(self, adresse="[ADRESSE]", center_y=760):
        self.cy = center_y
        s = SS
        f_body = font("Poppins-SemiBold.ttf", 40 * s)
        f_app = font("Poppins-SemiBold.ttf", 30 * s)
        f_time = font("Poppins-Regular.ttf", 28 * s)
        tmp = ImageDraw.Draw(Image.new("L", (10, 10)))
        icon = 116 * s
        pad = 44 * s
        text_x = pad + icon + 30 * s
        body_w = CW * s - text_x - pad
        lines = wrap(tmp, message(adresse), f_body, body_w)
        lh = 52 * s
        ch = max(pad * 2 + icon, pad + 46 * s + lh * len(lines) + pad - 6 * s)
        self.cw, self.ch = CW, ch // s
        cw, ch = CW * s, ch
        card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        # glass body: dark violet tint, brighter at the top
        body = np.zeros((ch, cw, 4), np.float32)
        yy = np.linspace(0, 1, ch, dtype=np.float32)[:, None]
        body[..., 0] = 30 + 26 * (1 - yy)
        body[..., 1] = 26 + 22 * (1 - yy)
        body[..., 2] = 52 + 40 * (1 - yy)
        body[..., 3] = 168
        mask = Image.new("L", (cw, ch), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, cw - 1, ch - 1), RADIUS * s, fill=255)
        m = np.asarray(mask, np.float32) / 255
        body[..., 3] *= m
        card = Image.fromarray(body.clip(0, 255).astype(np.uint8), "RGBA")
        d = ImageDraw.Draw(card)
        # rim light
        rim = Image.new("L", (cw, ch), 0)
        ImageDraw.Draw(rim).rounded_rectangle((1, 1, cw - 2, ch - 2), RADIUS * s, outline=255, width=3 * s)
        rim_a = np.asarray(rim, np.float32) / 255 * (0.55 * (1 - yy) + 0.12)
        rim_l = np.zeros((ch, cw, 4), np.uint8)
        rim_l[..., :3] = (235, 228, 255)
        rim_l[..., 3] = (rim_a * 255).astype(np.uint8)
        card.alpha_composite(Image.fromarray(rim_l, "RGBA"))
        # app icon: black squircle with a neon N
        ic = Image.new("RGBA", (icon, icon), (0, 0, 0, 0))
        icm = Image.new("L", (icon, icon), 0)
        ImageDraw.Draw(icm).rounded_rectangle((0, 0, icon - 1, icon - 1), 27 * s, fill=255)
        grad = np.zeros((icon, icon, 4), np.uint8)
        gy = np.linspace(0, 1, icon)[:, None]
        grad[..., 0] = (22 + 18 * gy).astype(np.uint8)
        grad[..., 1] = (10 + 6 * gy).astype(np.uint8)
        grad[..., 2] = (40 + 30 * gy).astype(np.uint8)
        grad[..., 3] = np.asarray(icm)
        ic = Image.fromarray(grad, "RGBA")
        nm = Image.new("L", (icon, icon), 0)
        ImageDraw.Draw(nm).text((icon / 2, icon / 2 + 4 * s), "N", font=font("TiltNeon-Regular.ttf", 92 * s), fill=255, anchor="mm")
        for r, col, gain in ((14 * s, (170, 80, 255), 1.0), (5 * s, (200, 120, 255), 1.0), (0, (245, 225, 255), 1.0)):
            g = nm.filter(ImageFilter.GaussianBlur(r)) if r else nm
            ga = (np.asarray(g, np.float32) * (2.2 if r else 1.0) * gain).clip(0, 255) * (np.asarray(icm) / 255)
            lay = np.zeros((icon, icon, 4), np.uint8)
            lay[..., :3] = col
            lay[..., 3] = ga.astype(np.uint8)
            ic.alpha_composite(Image.fromarray(lay, "RGBA"))
        card.alpha_composite(ic, (pad, pad))
        # header + body
        d = ImageDraw.Draw(card)
        d.text((text_x, pad - 4 * s), "NOCTA", font=f_app, fill=(255, 255, 255, 235))
        d.text((cw - pad, pad - 2 * s), "maintenant", font=f_time, fill=(220, 214, 240, 150), anchor="ra")
        y = pad + 46 * s
        for ln in lines:
            d.text((text_x, y), ln, font=f_body, fill=(255, 255, 255, 255))
            y += lh
        self.card = card
        self.mask = mask
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        self.xx, self.yy = xx, yy

    def _place(self, tau):
        """card pose at local time tau: (cx, cy, scale, rot_x, rot_y, opacity, blur)"""
        a = ease_out_back(tau / 0.55)
        rise = (1 - ease_out(tau / 0.55)) * 260
        cy = self.cy + rise + 6 * np.sin(2 * np.pi * 0.45 * tau)
        scale = 0.72 + 0.28 * a
        rx = 34 * (1 - ease_out(tau / 0.6)) + 2.0 * np.sin(2 * np.pi * 0.3 * tau)
        ry = 3.5 * np.sin(2 * np.pi * 0.22 * tau + 0.6)
        op = ease_out(tau / 0.25)
        bl = 0.0
        out = np.clip((tau - (LEN - 0.6)) / 0.6, 0, 1)
        if out > 0:
            e = out * out
            cy -= 150 * e
            scale *= 1 + 0.08 * e
            op *= 1 - e
            bl = float(10 * e)
        return W / 2, cy, scale, rx, ry, op, bl

    def frame(self, tau):
        """returns (rgba float32 HxWx4 in 0..1, glass mask HxW) at local time tau"""
        cx, cy, sc, rx, ry, op, bl = self._place(tau)
        hw, hh = self.cw / 2 * sc, self.ch / 2 * sc
        f = 1700.0
        ax, ay = np.deg2rad(rx), np.deg2rad(ry)
        pts = []
        for X, Y in ((-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)):
            # rotate around Y then X (top edge tilts away when rx > 0)
            x1, z1 = X * np.cos(ay), -X * np.sin(ay)
            y2 = Y * np.cos(ax) - z1 * np.sin(ax)
            z2 = Y * np.sin(ax) + z1 * np.cos(ax)
            z2 = z2 * -1
            k = f / (f + z2)
            pts.append((cx + x1 * k, cy + y2 * k))
        sw, sh = self.card.size
        coeffs = find_coeffs(pts, [(0, 0), (sw, 0), (sw, sh), (0, sh)])
        card = self.card.transform((W, H), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
        gmask = self.mask.transform((W, H), Image.PERSPECTIVE, coeffs, Image.BILINEAR)
        if bl > 0.3:
            card = card.filter(ImageFilter.GaussianBlur(bl))
            gmask = gmask.filter(ImageFilter.GaussianBlur(bl))
        c = np.asarray(card, np.float32) / 255
        g = np.asarray(gmask, np.float32) / 255
        # light sweep across the glass
        sweep_t = (tau - 0.5) / 0.9
        if 0 <= sweep_t <= 1:
            xx, yy = self.xx, self.yy
            pos = (cx - hw - 200) + sweep_t * (2 * hw + 400)
            band = np.exp(-(((xx - pos) + (yy - cy) * 0.45) / 55) ** 2) * g * 0.22
            c[..., :3] = c[..., :3] * (1 - band[..., None]) + band[..., None]
            c[..., 3] = np.maximum(c[..., 3], band)
        # soft blue-white halo (the card emits light)
        halo = np.asarray(gmask.filter(ImageFilter.GaussianBlur(46)), np.float32) / 255
        burst = np.exp(-tau / 0.18) * 0.9
        halo_a = np.clip(halo * (0.42 + burst) - g, 0, 1)
        out = np.zeros((H, W, 4), np.float32)
        hc = np.array([0.72, 0.80, 1.0], np.float32)
        out[..., :3] = hc
        out[..., 3] = halo_a
        # card over halo
        a = c[..., 3:4]
        out[..., :3] = c[..., :3] * a + out[..., :3] * (1 - a)
        out[..., 3] = c[..., 3] + out[..., 3] * (1 - c[..., 3])
        out[..., 3] *= op
        return out, g * op


def composite(bg_u8, card, glass, backdrop_blur=26):
    """composite the card on a frame with a real frosted-glass backdrop blur"""
    bg = bg_u8.astype(np.float32) / 255
    if glass.max() > 0.01:
        bl = np.asarray(Image.fromarray(bg_u8).filter(ImageFilter.GaussianBlur(backdrop_blur)), np.float32) / 255
        bg = bg * (1 - glass[..., None]) + bl * glass[..., None]
    a = card[..., 3:4]
    return (np.clip(card[..., :3] * a + bg * (1 - a), 0, 1) * 255 + .5).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--adresse", default="[ADRESSE]")
    ap.add_argument("--y", type=int, default=760, help="vertical center of the card")
    ap.add_argument("--test", nargs="*", type=float)
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    nc = NotifCard(a.adresse, a.y)
    if a.test is not None:
        bg = np.zeros((H, W, 3), np.uint8)
        bg[:] = (40, 34, 52)
        bg[:, : W // 2] = (90, 70, 60)
        for t in a.test:
            card, g = nc.frame(t)
            Image.fromarray(composite(bg, card, g)).save(OUT / f"notif_t{t:.2f}.png")
        return
    path = OUT / "nocta_notification.mov"
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-c:v", "png", "-pix_fmt", "rgba", str(path)]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(int(round(LEN * FPS))):
        card, _ = nc.frame(i / FPS)
        ff.stdin.write((np.clip(card, 0, 1) * 255 + .5).astype(np.uint8).tobytes())
    ff.stdin.close()
    ff.wait()
    print("wrote", path)


if __name__ == "__main__":
    main()
