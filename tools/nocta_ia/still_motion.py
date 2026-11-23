"""Animate a photoreal still into a 1080x1920 clip with a real-camera move: push-in / pull-back, pan, roll,
handheld micro-shake and true motion blur (sub-frame accumulation). Used for the scenery shots of the
realistic NOCTA version (window pass, aerial over Annecy, car profile, club facade), where nobody has to
move but the camera does.

    python3 tools/nocta_ia/still_motion.py image.jpg out.mp4 --dur 2.5 --zoom 1.0 1.9 --ease in --blur 5
"""
import argparse
import subprocess

import cv2
import numpy as np

W, H, FPS = 1080, 1920, 24


def ease(u, kind):
    u = np.clip(u, 0, 1)
    if kind == "in":
        return u * u * u
    if kind == "out":
        return 1 - (1 - u) ** 3
    if kind == "inout":
        return u * u * (3 - 2 * u)
    return u


def shake(t, amp, seed=3):
    rng = np.random.default_rng(seed)
    f = rng.uniform(0.6, 1.7, 6)
    p = rng.uniform(0, 6.28, 6)
    x = sum(np.sin(2 * np.pi * f[i] * t + p[i]) for i in range(3)) / 3
    y = sum(np.sin(2 * np.pi * f[i] * t + p[i]) for i in range(3, 6)) / 3
    return amp * x, amp * y


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("out")
    ap.add_argument("--dur", type=float, default=3.0)
    ap.add_argument("--zoom", type=float, nargs=2, default=(1.0, 1.15))
    ap.add_argument("--pan", type=float, nargs=4, default=(0, 0, 0, 0), help="x0 y0 x1 y1 as fractions of the frame")
    ap.add_argument("--roll", type=float, nargs=2, default=(0, 0), help="degrees")
    ap.add_argument("--ease", default="inout", choices=["lin", "in", "out", "inout"])
    ap.add_argument("--blur", type=int, default=3, help="sub-frames per frame (motion blur)")
    ap.add_argument("--shutter", type=float, default=0.5, help="fraction of the frame time the shutter is open")
    ap.add_argument("--shake", type=float, default=4.0, help="handheld shake in output pixels")
    ap.add_argument("--focus", type=float, nargs=2, default=(0.5, 0.5), help="zoom centre in the 9:16 crop (fractions)")
    ap.add_argument("--crop_x", type=float, default=0.5, help="horizontal position of the 9:16 crop in the source")
    a = ap.parse_args()

    src = cv2.imread(a.image, cv2.IMREAD_COLOR)
    h0, w0 = src.shape[:2]
    cw = min(w0, int(round(h0 * 9 / 16)))
    ch = int(round(cw * 16 / 9))
    x0 = int(round((w0 - cw) * a.crop_x))
    y0 = (h0 - ch) // 2
    crop = src[y0:y0 + ch, x0:x0 + cw]
    big = cv2.resize(crop, (W * 2, H * 2), interpolation=cv2.INTER_LANCZOS4).astype(np.float32)

    n = int(round(a.dur * FPS))
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
                           "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", a.out],
                          stdin=subprocess.PIPE)
    fx, fy = a.focus[0] * W * 2, a.focus[1] * H * 2
    for i in range(n):
        acc = np.zeros((H, W, 3), np.float32)
        for k in range(a.blur):
            t = (i + (k / max(1, a.blur - 1) - 0.5) * a.shutter) / FPS if a.blur > 1 else i / FPS
            u = ease(t / a.dur, a.ease)
            s = a.zoom[0] + (a.zoom[1] - a.zoom[0]) * u
            px = (a.pan[0] + (a.pan[2] - a.pan[0]) * u) * W
            py = (a.pan[1] + (a.pan[3] - a.pan[1]) * u) * H
            r = a.roll[0] + (a.roll[1] - a.roll[0]) * u
            sx, sy = shake(t, a.shake)
            # map the big image (2x) to the output: zoom s about the focus point (which stays where it
            # is in the un-zoomed frame), then pan/shake
            M = cv2.getRotationMatrix2D((fx, fy), r, s / 2)
            M[0, 2] += fx / 2 - fx + px + sx
            M[1, 2] += fy / 2 - fy + py + sy
            acc += cv2.warpAffine(big, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        frame = np.clip(acc / a.blur, 0, 255).astype(np.uint8)
        ff.stdin.write(frame.tobytes())
    ff.stdin.close()
    ff.wait()
    print("ecrit :", a.out, n, "images")


if __name__ == "__main__":
    main()
