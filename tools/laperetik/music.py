"""Original soundtrack of the L'Apéretik reel: warm funk / house at 120 BPM in D dorian, 56 s, stereo 48 kHz,
plus sound design (ember sizzle, wooden lid clap, whooshes, mouse clicks, like pop, bottle and glass clinks, card).
Everything is synthesised here, so there is no rights issue.
Usage: python3 tools/laperetik/music.py <out.wav> [--stems]"""
import sys, wave
from pathlib import Path

import numpy as np

SR = 48000
BPM = 120
BEAT = 60 / BPM          # 0.5 s
BAR = 4 * BEAT           # 2 s
DUR = 56.0
N = int(DUR * SR)
rng = np.random.default_rng(1974)

DROP, HITS = 6.0, (10.0, 20.0, 34.0, 52.0)


# ------------------------------------------------------------------ dsp helpers
def t_(n):
    return np.arange(n) / SR


def env(n, a, d, s=0.0, r=None):
    x = t_(n)
    e = np.minimum(1, x / max(a, 1e-4)) * (s + (1 - s) * np.exp(-np.maximum(0, x - a) / max(d, 1e-4)))
    if r:
        e *= np.clip((n / SR - x) / r, 0, 1)
    return e


def lp1(x, fc):
    """one-pole low-pass, fc may be an array (time-varying)"""
    fc = np.broadcast_to(np.asarray(fc, np.float64), x.shape)
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x, dtype=np.float64); acc = 0.0
    xs, as_ = x.astype(np.float64), a
    for i in range(len(xs)):
        acc += as_[i] * (xs[i] - acc); y[i] = acc
    return y


def svf(x, fc, q=0.7, mode="lp"):
    """Chamberlin state-variable filter (time-varying cutoff)"""
    fc = np.broadcast_to(np.asarray(fc, np.float64), x.shape)
    f = 2 * np.sin(np.pi * np.minimum(fc, SR / 6) / SR)
    damp = 1 / q
    low = band = 0.0
    out = np.empty(len(x))
    for i in range(len(x)):
        high = x[i] - low - damp * band
        band += f[i] * high
        low += f[i] * band
        out[i] = low if mode == "lp" else band if mode == "bp" else high
    return out


def hp1(x, fc):
    return x - lp1(x, fc)


def note(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def place(buf, sig, at, gain=1.0, pan=0.0):
    i = int(round(at * SR))
    if i >= len(buf) or i + len(sig) <= 0: return
    j0 = max(0, -i); i0 = max(0, i); n = min(len(sig) - j0, len(buf) - i0)
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        buf[i0:i0 + n, 0] += sig[j0:j0 + n] * gain * l * 1.414
        buf[i0:i0 + n, 1] += sig[j0:j0 + n] * gain * r * 1.414
    else:
        buf[i0:i0 + n] += sig[j0:j0 + n] * gain


def haas(x, d):
    """widen a stereo bus: delay one side by |d| seconds (d>0: right late)"""
    k = int(abs(d) * SR); y = x.copy()
    ch = 1 if d > 0 else 0
    y[k:, ch] = x[:-k, ch] * 0.35 + x[k:, ch] * 0.65
    return y


def reverb(x, seconds=2.4, wet=0.25, seed=3, predelay=0.02, damp=3.0):
    r = np.random.default_rng(seed)
    n = int(seconds * SR); tt = t_(n)
    out = np.zeros_like(x)
    for ch in range(2):
        ir = r.normal(0, 1, n) * np.exp(-tt * 6.9 / seconds)
        ir = lp1(ir, 9000 * np.exp(-tt * damp) + 600)
        ir[: int(predelay * SR)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        L = len(x) + n; M = 1 << int(np.ceil(np.log2(L)))
        out[:, ch] = np.fft.irfft(np.fft.rfft(x[:, ch], M) * np.fft.rfft(ir, M), M)[: len(x)]
    return x * (1 - wet) + out * wet


# ------------------------------------------------------------------ instruments
def kick():
    n = int(0.5 * SR); x = t_(n)
    f = 56 + 130 * np.exp(-x * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 9)
    click = hp1(rng.normal(0, 1, n), 2500) * np.exp(-x * 500) * 0.6
    return np.tanh((body * 1.0 + click) * 1.4) * 0.55


def clap():
    n = int(0.4 * SR); x = t_(n)
    s = svf(rng.normal(0, 1, n), 1500, 1.2, "bp")
    e = np.zeros(n)
    for k, off in enumerate([0, 0.009, 0.018, 0.028]):
        i = int(off * SR); e[i:] += np.exp(-x[: n - i] * (80 if k < 3 else 13))
    snare = np.sin(2 * np.pi * 185 * x) * np.exp(-x * 30) * 0.35
    return (s * e * 1.1 + snare) * 0.85


def hat(open_=False, v=1.0):
    n = int((0.3 if open_ else 0.06) * SR); x = t_(n)
    s = hp1(rng.normal(0, 1, n), 7000)
    return s * np.exp(-x * (11 if open_ else 75)) * 0.55 * v


def shaker(v=1.0):
    n = int(0.09 * SR); x = t_(n)
    s = svf(rng.normal(0, 1, n), 6500, 0.9, "bp")
    return s * np.minimum(1, x / 0.012) * np.exp(-x * 45) * 0.4 * v


def rhodes(m, dur=1.2, v=1.0):
    n = int(dur * SR); x = t_(n); f = note(m)
    I = 1.6 * np.exp(-x * 3.0) * v + 0.25
    car = np.sin(2 * np.pi * f * x + I * np.sin(2 * np.pi * f * x))
    tine = np.sin(2 * np.pi * f * 7.02 * x) * np.exp(-x * 18) * 0.12 * v
    trem = 1 + 0.12 * np.sin(2 * np.pi * 5.2 * x)
    return (car + tine) * env(n, 0.003, 1.1, 0.0) * trem * 0.32 * v * np.clip((dur - x) / 0.08, 0, 1)


def bass_note(m, dur, v=1.0, slide_from=None):
    n = int(dur * SR); x = t_(n)
    f = np.full(n, note(m))
    if slide_from is not None:
        f = note(slide_from) + (note(m) - note(slide_from)) * np.minimum(1, x / 0.06)
    ph = np.cumsum(f) / SR
    sig = 0.55 * (2 * (ph % 1) - 1) + 0.6 * np.sin(2 * np.pi * ph)
    cut = 320 + 2200 * np.exp(-x * 16) * v
    y = svf(sig, cut, 1.6, "lp")
    return np.tanh(y * 1.6) * env(n, 0.004, 0.5, 0.65, 0.03) * 0.55 * v


GUIT = {}


def guitar(m, dur=0.14, mute=True, v=1.0):
    key = (m, round(dur, 3), mute)
    if key not in GUIT:
        n = int(dur * SR); p = max(2, int(round(SR / note(m))))
        buf = rng.uniform(-1, 1, p) * (0.6 if mute else 1.0)
        buf = buf - buf.mean()
        out = np.empty(n); damp = 0.94 if mute else 0.996
        for i in range(n):
            j = i % p
            out[i] = buf[j]
            buf[j] = damp * 0.5 * (buf[j] + buf[(j + 1) % p])
        out = hp1(out, 180) * env(n, 0.001, dur * (0.35 if mute else 0.8))
        GUIT[key] = out
    return GUIT[key] * v


def strum(chord, dur, mute, v=1.0, down=True):
    n = int((dur + 0.05) * SR); out = np.zeros(n)
    notes = chord if down else chord[::-1]
    for k, m in enumerate(notes):
        g = guitar(m, dur, mute, 1.0)
        i = int(k * 0.007 * SR); out[i:i + len(g)] += g[: n - i] * (0.8 + 0.2 * (k / len(notes)))
    return out * v * 0.42


def brass(chord, dur=0.35, v=1.0):
    n = int(dur * SR); x = t_(n); out = np.zeros(n)
    for m in chord:
        for det in (-0.08, 0.08):
            ph = np.cumsum(np.full(n, note(m + det))) / SR
            out += 2 * (ph % 1) - 1
    cut = 600 + 3800 * np.exp(-x * 9) * np.minimum(1, x / 0.02)
    y = svf(out / len(chord), cut, 1.0, "lp")
    return np.tanh(y * 1.4) * env(n, 0.012, 0.25, 0.4, 0.06) * 0.42 * v


def pad(chord, dur, v=1.0, cut=900):
    n = int(dur * SR); x = t_(n); out = np.zeros(n)
    for m in chord:
        for det in (-0.1, 0.0, 0.11):
            ph = np.cumsum(np.full(n, note(m + det))) / SR
            out += 2 * (ph % 1) - 1
    y = lp1(out / (3 * len(chord)), cut)
    return y * np.minimum(1, x / 0.4) * np.clip((dur - x) / 0.5, 0, 1) * 0.35 * v


# ------------------------------------------------------------------ sound design
def whoosh(dur=0.7, f0=300, f1=4000, v=1.0, rev=False):
    n = int(dur * SR); x = np.linspace(0, 1, n)
    sh = np.sin(np.pi * x) ** 2 if not rev else x ** 2.5
    fc = f0 + (f1 - f0) * (x if not rev else x ** 2)
    s = svf(rng.normal(0, 1, n), fc, 1.4, "bp")
    return s * sh * 0.6 * v


def riser(dur=1.5, v=1.0):
    n = int(dur * SR); x = np.linspace(0, 1, n)
    s = svf(rng.normal(0, 1, n), 300 + 7000 * x ** 2, 2.0, "bp") * x ** 2
    tone = np.sin(2 * np.pi * np.cumsum(200 + 700 * x ** 2) / SR) * x ** 3 * 0.15
    return (s * 0.7 + tone) * v


def impact(v=1.0):
    n = int(2.2 * SR); x = t_(n)
    sub = np.sin(2 * np.pi * np.cumsum(38 + 70 * np.exp(-x * 9)) / SR) * np.exp(-x * 2.2)
    crash = hp1(rng.normal(0, 1, n), 4500) * np.exp(-x * 2.6) * 0.32
    thump = lp1(rng.normal(0, 1, n), 400) * np.exp(-x * 25) * 1.2
    return np.tanh((sub * 0.95 + crash + thump) * 1.2) * 0.8 * v


def wood_clap(v=1.0):
    n = int(0.6 * SR); x = t_(n)
    tap = svf(rng.normal(0, 1, n), 900, 2.5, "bp") * np.exp(-x * 60)
    body = (np.sin(2 * np.pi * 172 * x) * 0.8 + np.sin(2 * np.pi * 410 * x) * 0.5 + np.sin(2 * np.pi * 980 * x) * 0.25) * np.exp(-x * 22)
    air = lp1(rng.normal(0, 1, n), 300) * np.exp(-x * 14) * 0.8
    return np.tanh((tap * 1.3 + body + air) * 1.1) * 0.8 * v


def wood_pop(v=1.0):
    n = int(0.25 * SR); x = t_(n)
    f = 180 + 520 * np.minimum(1, x / 0.03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 26) * 0.45 * v


def click(v=1.0):
    n = int(0.05 * SR); x = t_(n)
    a = hp1(rng.normal(0, 1, n), 2500) * np.exp(-x * 900)
    b = np.sin(2 * np.pi * 3200 * x) * np.exp(-x * 500) * 0.3
    s = a + b
    rel = np.zeros(n); i = int(0.035 * SR); rel[i:] = s[: n - i] * 0.5
    return (s + rel) * 0.5 * v


def like_pop(v=1.0):
    n = int(0.3 * SR); x = t_(n)
    f = 300 + 700 * np.exp(-x * 45)
    p = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 20)
    sp = np.zeros(n)
    for k, ff in enumerate([2400, 3200, 4200, 5200]):
        i = int((0.03 + k * 0.035) * SR); xx = t_(n - i)
        sp[i:] += np.sin(2 * np.pi * ff * xx) * np.exp(-xx * 30) * 0.12
    return (p * 0.6 + sp) * v


def clink(base=2300, v=1.0, dur=1.0):
    n = int(dur * SR); x = t_(n); out = np.zeros(n)
    for k, (r, d, a) in enumerate([(1.0, 5, 1), (1.62, 7, 0.6), (2.31, 9, 0.45), (3.05, 12, 0.3), (4.2, 16, 0.2)]):
        out += np.sin(2 * np.pi * base * r * x + k) * np.exp(-x * d) * a
    tick = hp1(rng.normal(0, 1, n), 5000) * np.exp(-x * 700) * 0.4
    return (out * 0.28 + tick) * v


def sizzle(dur, v=1.0):
    n = int(dur * SR)
    s = hp1(rng.normal(0, 1, n), 3500) * 0.12
    cr = np.zeros(n)
    for _ in range(int(dur * 45)):
        i = rng.integers(0, n - 400); L = rng.integers(40, 300)
        cr[i:i + L] += rng.normal(0, 1, L) * np.exp(-np.arange(L) / (L / 4)) * rng.uniform(0.3, 1.0)
    cr = hp1(cr, 1500)
    e = np.minimum(1, t_(n) / 0.2) * np.clip((dur - t_(n)) / 0.5, 0, 1)
    return (s + cr * 0.5) * e * v


def paper(v=1.0, dur=0.18):
    n = int(dur * SR); x = t_(n)
    return svf(rng.normal(0, 1, n), 2500, 0.8, "bp") * np.exp(-x * 30) * 0.5 * v


# ------------------------------------------------------------------ arrangement
# D dorian vamp, one chord per bar: Dm9 | G9 | Fmaj9 | Em7-A7
CH = [
    {"root": 38, "rh": [53, 57, 60, 64], "g": [62, 65, 69, 72], "br": [65, 69, 72]},     # Dm9  (F A C E)
    {"root": 43, "rh": [53, 57, 59, 64], "g": [59, 65, 69, 71], "br": [65, 69, 71]},     # G9   (F A B E)
    {"root": 41, "rh": [52, 55, 57, 64], "g": [60, 64, 67, 69], "br": [64, 67, 72]},     # Fmaj9 (E G A E)
    {"root": 40, "rh": [55, 59, 62, 66], "g": [59, 62, 67, 71], "br": [62, 67, 71]},     # Em7 -> A7 on beat 3
]
BASS_PAT = [  # (step 0-15, semitone offset from root, length in steps, velocity)
    (0, 0, 2, 1.0), (3, 12, 1, 0.7), (4, 0, 1, 0.8), (6, 10, 1, 0.75), (7, 12, 1, 0.8), (10, 7, 2, 0.9), (12, 0, 1, 0.85), (14, 3, 1, 0.75), (15, 5, 1, 0.8),
]
S16 = BEAT / 4
SWING = 0.018


def sixteenth(bar_t, k):
    return bar_t + k * S16 + (SWING if k % 2 else 0)


def build(stems=False):
    drums = np.zeros((N, 2)); bass = np.zeros((N, 2)); keys = np.zeros((N, 2)); gtr = np.zeros((N, 2))
    fx = np.zeros((N, 2)); padb = np.zeros((N, 2)); brs = np.zeros((N, 2))
    K, C = kick(), clap()
    nbars = int(DUR / BAR)
    for b in range(nbars):
        t0 = b * BAR
        ch = CH[b % 4]
        full = t0 >= DROP
        quiet_slowmo = 10.4 <= t0 < 14.0
        breakdown = 48.0 <= t0 < 52.0
        outro = t0 >= 54.0
        stop = (19.0 <= t0 < 20.0)
        # drums
        for beat in range(4):
            bt = t0 + beat * BEAT
            if full and not breakdown and not outro and not (19.75 <= bt < 20.0):
                place(drums, K, bt, 1.0 if not quiet_slowmo else 0.75)
                if beat in (1, 3): place(drums, C, bt, 0.7, 0.05)
            elif breakdown and beat in (0, 2):
                place(drums, K, bt, 0.55)
        for k in range(16):
            tt = sixteenth(t0, k)
            if t0 < 2.0 or outro: continue
            if 19.75 <= tt < 20.0: continue
            acc = 1.0 if k % 4 == 2 else 0.55 if k % 2 == 0 else 0.4
            if full and not breakdown:
                place(drums, hat(k % 4 == 2, acc * (0.7 if quiet_slowmo else 1.0)), tt, 0.9, 0.3)
                place(drums, shaker(0.6 + 0.4 * (k % 2)), tt, 0.5, -0.35)
            elif t0 >= 2.0:
                place(drums, shaker(0.5 + 0.3 * (k % 2)), tt, 0.45, -0.3)
        # bass
        if full and not outro:
            for st, off, ln, v in BASS_PAT:
                if breakdown and st % 4: continue
                root = ch["root"] + (5 if (b % 4 == 3 and st >= 8) else 0)   # A7 on the second half of bar 4
                tt = sixteenth(t0, st)
                if 19.75 <= tt < 20.0: continue
                slide = root + off - 2 if st == 15 else None
                place(bass, bass_note(root + off, ln * S16 * 0.95, v, slide), tt, 0.95)
        # rhodes stabs (syncopated), also in the intro
        rh = ch["rh"] if not (b % 4 == 3) else ch["rh"]
        hits = [0, 3, 6, 10, 14] if full else [0, 6, 10]
        if outro: hits = [0]
        for st in hits:
            tt = sixteenth(t0, st)
            if 19.75 <= tt < 20.0: continue
            dur = 0.45 if st else 0.9
            if outro: dur = 2.2
            for k, m in enumerate(rh):
                place(keys, rhodes(m, dur, 0.85 if st else 1.0), tt + k * 0.004, 0.55, -0.25 + k * 0.15)
        # funk guitar chops on 16ths + chord on the 'and' of 2 & 4
        if full and not breakdown and not outro and not quiet_slowmo:
            for k in range(16):
                tt = sixteenth(t0, k)
                if 19.75 <= tt < 20.0: continue
                if k in (6, 14):
                    place(gtr, strum(ch["g"], 0.22, False, 0.9, k == 6), tt, 0.8, 0.45)
                elif k % 2 == 1 or k in (0, 8):
                    place(gtr, strum(ch["g"][:3], 0.06, True, 0.55, k % 2 == 0), tt, 0.7, 0.45)
        # pad bed
        place(padb, pad(ch["rh"], BAR + 0.4, 0.9 if not full else 0.55, 700 if t0 < DROP else 1100), t0, 0.7)
    # brass stabs on the hits
    for h in (DROP,) + HITS:
        ch = CH[int(h / BAR) % 4]
        place(brs, brass(ch["br"], 0.42), h, 0.85, 0.15)
        place(brs, brass(ch["br"], 0.22, 0.8), h + 0.75, 0.7, -0.15)
    for t in (36.75, 38.75, 40.75):
        place(brs, brass(CH[int(t / BAR) % 4]["br"], 0.18, 0.7), t, 0.55, 0.2)
    final = CH[0]
    place(brs, brass(final["br"] + [74], 1.6, 1.0), 52.0, 0.8)
    # ---------------- sound design
    place(fx, sizzle(2.5, 0.9), 0.22, 0.7)
    for i in range(10):
        place(fx, paper(0.3, 0.05), 0.3 + i * 0.23 + rng.uniform(0, 0.08), 0.5, rng.uniform(-0.5, 0.5))
    place(fx, whoosh(0.9, 200, 3000, 1.0, rev=True), 2.15, 0.6)        # into the pull-back
    place(fx, whoosh(0.8, 3000, 300, 0.9), 2.95, 0.6, -0.3)
    place(fx, riser(1.6, 0.8), 4.4, 0.55)
    place(fx, impact(1.0), DROP, 0.9)
    place(fx, wood_pop(1.0), DROP + 0.02, 0.6)
    place(fx, whoosh(0.6, 400, 2500, 0.8), 6.05, 0.45, 0.4)
    place(fx, riser(1.2, 0.8), 8.8, 0.55)
    place(fx, impact(1.1), 10.0, 0.95)
    place(fx, whoosh(1.0, 2000, 200, 1.0), 10.0, 0.7)
    place(fx, whoosh(0.7, 300, 5000, 0.7, rev=True), 18.0, 0.5)
    place(fx, riser(1.0, 0.7), 18.75, 0.45)
    place(fx, wood_clap(1.0), 19.93, 1.0)
    place(fx, impact(0.9), 20.0, 0.75)
    place(fx, whoosh(0.5, 4000, 300, 1.0), 19.98, 0.6, 0.3)
    for tc in (21.2, 24.45, 27.98):
        place(fx, click(1.0), tc - 0.01, 0.7, 0.1)
    place(fx, like_pop(1.0), 24.47, 0.8, 0.2)
    place(fx, whoosh(0.8, 300, 4000, 1.0), 21.22, 0.25)
    place(fx, impact(0.7), 28.02, 0.6)
    place(fx, whoosh(1.1, 200, 5000, 1.0), 28.05, 0.7, -0.2)
    for i in range(5):
        place(fx, whoosh(0.5, 600 + i * 300, 3500, 0.6), 28.4 + i * 0.35, 0.35, (-1) ** i * 0.6)
    place(fx, riser(1.8, 0.9), 32.2, 0.6)
    place(fx, whoosh(1.2, 300, 6000, 1.0, rev=True), 32.8, 0.6)
    place(fx, impact(1.1), 34.0, 0.95)
    place(fx, whoosh(0.6, 3000, 300, 0.9), 42.0, 0.5)
    place(fx, wood_pop(0.8), 42.4, 0.3)
    place(fx, whoosh(0.6, 3000, 300, 0.9), 45.0, 0.5)
    place(fx, clink(1700, 1.0, 0.8), 46.25, 0.75, -0.1)
    place(fx, clink(2600, 1.0, 1.2), 47.2, 0.75, 0.1)
    place(fx, whoosh(0.6, 3000, 300, 0.9), 48.0, 0.5)
    place(fx, whoosh(1.2, 300, 1500, 0.5), 48.1, 0.35)
    place(fx, paper(1.0, 0.12), 49.45, 0.7)
    place(fx, whoosh(0.45, 500, 3500, 0.6), 49.75, 0.45)
    place(fx, paper(0.8, 0.08), 50.55, 0.5)
    place(fx, riser(1.6, 0.9), 50.4, 0.55)
    place(fx, impact(1.2), 52.0, 1.0)
    place(fx, like_pop(0.8), 52.05, 0.45)

    # ---------------- mix
    kick_env = np.zeros(N)
    for b in range(int(DUR / BEAT)):
        bt = b * BEAT
        if bt >= DROP and not (48 <= bt < 52) and bt < 54 and not (19.75 <= bt < 20):
            i = int(bt * SR); L = int(0.28 * SR)
            kick_env[i:i + L] = np.maximum(kick_env[i:i + L], np.exp(-np.arange(min(L, N - i)) / (0.08 * SR)))
    duck = (1 - 0.55 * kick_env)[:, None]
    # intro/slow-mo filters on the musical bed
    tt = t_(N)
    bed_cut = np.where(tt < DROP, 600 + 2400 * (tt / DROP) ** 2, np.where((tt > 10.2) & (tt < 14.6), 1800, 16000))
    keys = reverb(keys, 2.0, 0.22, 4)
    gtr = reverb(gtr, 1.2, 0.12, 5)
    brs = reverb(brs, 1.8, 0.2, 6)
    padb = reverb(padb, 3.0, 0.35, 7)
    fxr = reverb(fx, 1.6, 0.18, 8)
    for ch in range(2):
        bass[:, ch] = hp1(bass[:, ch], 38)
    keys = haas(keys, 0.011); gtr = haas(gtr, -0.014)
    music = drums + bass * duck * 0.5 + keys * duck * 1.9 + gtr * 1.45 + brs * 1.25 + padb * duck * 0.8
    for ch in range(2):
        music[:, ch] = lp1(music[:, ch], bed_cut) if True else music[:, ch]
    # outro fade
    fade = np.clip((DUR - tt) / 1.6, 0, 1) ** 1.5
    mix = (music * 0.95 + fxr * 1.0) * fade[:, None]
    # master: gentle glue + soft clip
    mix = np.tanh(mix * 1.25) / 1.25
    peak = np.max(np.abs(mix)); mix = mix / peak * 0.89
    return mix.astype(np.float32)


def write_wav(path, x):
    y = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(y.tobytes())


if __name__ == "__main__":
    out = Path(sys.argv[1])
    write_wav(out, build())
    print("wrote", out)
