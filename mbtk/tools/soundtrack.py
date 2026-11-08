"""Bande-son originale de la vidéo MBTK Design (58 s, 120 BPM, ré mineur).
Musique (beat feutré, piano électrique, nappes, basse, mélodie) + bruitages calés sur l'image.
Tout est synthétisé ici : aucun droit à payer.
Sorties : mix.mp3 (musique + bruitages) et sfx.mp3 (bruitages seuls).
Usage : python3 soundtrack.py <dossier_sortie>
"""
import numpy as np, subprocess, sys, wave, os

SR = 44100
DUR = 58.0
N = int(DUR * SR)
BEAT = 0.5
O = 1.0  # origine de la grille des mesures (mesures sur les secondes impaires)
rng = np.random.default_rng(47)

# ---------------------------------------------------------------- repères (identiques à la timeline JS)
VIB = [(0, .4), (.6, 1.0), (1.6, 2.0), (2.2, 2.6), (3.2, 3.6), (3.8, 4.2), (4.8, 5.0), (57.2, 57.6)]
DROP = 5.0          # décroché : le beat démarre
CARDS = [8.5, 10.0, 11.5, 13.0]
ARGS = [15.0, 16.3, 17.6, 18.9, 20.2]
SNAPS = [36.0, 36.75, 37.5, 38.25, 39.0]
HALL = 41.0         # entrée dans le couloir
ROOM = 43.0         # entrée dans la chambre
END = 51.0          # carte de fin
LAND = [51.58, 51.72, 51.86, 52.0]  # chute des lettres M B T K


def T(n): return np.arange(n) / SR
def note(m): return 440.0 * 2 ** ((m - 69) / 12)


def place(buf, sig, t, g=1.0, pan=0.0):
    i = int(round(t * SR))
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)], 1) * np.sqrt(2)
    if i < 0:
        sig = sig[-i:]; i = 0
    if i >= len(buf): return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * g


def fftfilt(x, lo=None, hi=None, order=2, peak=None):
    n = len(x)
    m = 1 << int(np.ceil(np.log2(max(n, 2))))
    f = np.fft.rfftfreq(m, 1 / SR)
    H = np.ones_like(f)
    if hi: H *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo: H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    if peak:
        for fc, gdb, q in peak:
            H *= 1 + (10 ** (gdb / 20) - 1) * np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) * q) ** 2)
    if x.ndim == 1:
        return np.fft.irfft(np.fft.rfft(x, m) * H, m)[:n]
    return np.stack([np.fft.irfft(np.fft.rfft(x[:, c], m) * H, m)[:n] for c in range(x.shape[1])], 1)


def sweep(x, fc_of_t, q=1.2):
    """bande passante glissante (STFT)"""
    win, hop = 2048, 512
    w = np.hanning(win)
    n = len(x); out = np.zeros(n + win); norm = np.zeros(n + win)
    xp = np.pad(x, (0, win))
    f = np.fft.rfftfreq(win, 1 / SR)
    for k in range(0, n, hop):
        seg = xp[k:k + win] * w
        fc = fc_of_t(k / SR)
        H = np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) * q) ** 2)
        out[k:k + win] += np.fft.irfft(np.fft.rfft(seg) * H, win) * w
        norm[k:k + win] += w * w
    return (out / np.maximum(norm, 1e-3))[:n]


def reverb(x, sec=2.4, seed=3, pre=0.015, damp=6000):
    r = np.random.default_rng(seed)
    n = int(sec * SR); t = T(n)
    out = []
    for c in range(2):
        ir = r.normal(0, 1, n) * np.exp(-t * 6.9 / sec)
        ir = fftfilt(ir, hi=damp, order=1)
        ir[: int(pre * SR)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        xs = x[:, c] if x.ndim == 2 else x
        L = len(xs) + n; m = 1 << int(np.ceil(np.log2(L)))
        out.append(np.fft.irfft(np.fft.rfft(xs, m) * np.fft.rfft(ir, m), m)[: len(xs)])
    return np.stack(out, 1)


# ---------------------------------------------------------------- instruments
def kick(soft=1.0):
    n = int(.55 * SR); t = T(n)
    f = 44 + 95 * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5)
    click = fftfilt(rng.normal(0, 1, n) * np.exp(-t * 700), hi=3500) * .18 * soft
    return np.tanh((body + click) * 1.25) * .95


def snap():
    n = int(.18 * SR); t = T(n)
    s = fftfilt(rng.normal(0, 1, n), lo=1400, hi=6500) * np.exp(-t * 38)
    tone = np.sin(2 * np.pi * 1650 * t) * np.exp(-t * 90) * .25
    return (s * .9 + tone) * .8


def clap():
    n = int(.35 * SR); t = T(n)
    s = fftfilt(rng.normal(0, 1, n), lo=900, hi=7000)
    e = np.zeros(n)
    for k, off in enumerate([0, .009, .018, .028]):
        i = int(off * SR); e[i:] += np.exp(-t[: n - i] * (70 if k < 3 else 15))
    return s * e * .55


def shaker(acc=1.0):
    n = int(.09 * SR); t = T(n)
    s = fftfilt(rng.normal(0, 1, n), lo=5200, hi=13000)
    return s * np.minimum(1, t / .006) * np.exp(-t * 45) * .42 * acc


def hat():
    n = int(.06 * SR); t = T(n)
    return fftfilt(rng.normal(0, 1, n), lo=7000) * np.exp(-t * 70) * .45


def ep(m, dur=1.6, vel=.8):
    f = note(m); n = int((dur + .9) * SR); t = T(n)
    idx = (1.6 * vel + .2) * np.exp(-t * 2.8) + .25
    car = np.sin(2 * np.pi * f * t + np.sin(2 * np.pi * f * t) * idx)
    tine = np.sin(2 * np.pi * f * 14.02 * t) * np.exp(-t * 26) * .1 * vel
    bell = np.sin(2 * np.pi * f * 3.0 * t) * np.exp(-t * 7) * .06 * vel
    env = np.minimum(1, t / .004) * np.exp(-t * 1.15) * np.where(t > dur, np.exp(-(t - dur) * 9), 1)
    return (car + tine + bell) * env * vel


def pad_note(m, n, bright=7, seed=0):
    r = np.random.default_rng(seed + m)
    f = note(m); t = T(n); s = np.zeros(n)
    for det in (-.11, 0, .11):
        ratio = 2 ** (det / 12)
        for h in range(1, bright + 1):
            s += np.sin(2 * np.pi * f * ratio * h * t + r.uniform(0, 6.28)) / h * np.exp(-(h - 1) * .42)
    return s / 3


def bell(m, dur=.9, vel=.7):
    f = note(m); n = int(dur * SR); t = T(n)
    s = np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 9) + .18 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t * 16)
    return s * np.minimum(1, t / .003) * np.exp(-t * 4.2) * vel


def sub(m, dur, vel=1.0):
    f = note(m); n = int(dur * SR); t = T(n)
    s = np.tanh(1.6 * np.sin(2 * np.pi * f * t)) * .8 + .12 * np.sin(4 * np.pi * f * t)
    env = np.minimum(1, t / .012) * np.minimum(1, (dur - t) / .06) * (0.75 + .25 * np.exp(-t * 3))
    return s * env * vel


def noise(n): return rng.normal(0, 1, n)


def whoosh(dur, f0=300, f1=3500, q=1.0, shape=.7, vol=1.0):
    n = int(dur * SR); t = T(n)
    x = noise(n)
    def fc(tt):
        k = min(1, tt / dur)
        return f0 * (f1 / f0) ** (np.sin(k * np.pi / 2) if f1 > f0 else k)
    y = sweep(x, fc, q)
    peak = shape * dur
    env = np.where(t < peak, (t / peak) ** 2.2, np.exp(-(t - peak) / (dur - peak + 1e-3) * 4))
    y = y * env
    return y / (np.max(np.abs(y)) + 1e-9) * vol


def riser(dur, vol=1.0):
    n = int(dur * SR); t = T(n); k = t / dur
    nz = sweep(noise(n), lambda tt: 250 * (7000 / 250) ** (tt / dur), .8) * k ** 2.5
    ton = np.sin(2 * np.pi * np.cumsum(note(50) * 2 ** (k * 1.5)) / SR) * k ** 3 * .25
    y = nz / (np.max(np.abs(nz)) + 1e-9) + ton
    return y * vol


def boom(vol=1.0, dec=1.4):
    n = int(2.2 * SR); t = T(n)
    f = 30 + 40 * np.exp(-t * 5)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2 / dec)
    hit = fftfilt(noise(n), hi=380) * np.exp(-t * 14) * .7
    return np.tanh((s + hit) * 1.4) * vol


def tap(vol=.6):
    n = int(.12 * SR); t = T(n)
    s = np.sin(2 * np.pi * 1250 * t) * np.exp(-t * 60) + fftfilt(noise(n), lo=2000, hi=8000) * np.exp(-t * 160) * .4
    return s * vol


def shimmer(dur=1.0, vol=.4, root=74):
    out = np.zeros(int(dur * SR) + SR)
    for k, m in enumerate([root, root + 7, root + 12, root + 14, root + 19]):
        b = bell(m, dur=1.2, vel=.5)
        i = int(k * .045 * SR); out[i:i + len(b)] += b
    return out[: int(dur * SR) + SR] * vol


def vibration(dur):
    n = int(dur * SR); t = T(n)
    f = 168 + 4 * np.sin(2 * np.pi * 6 * t) + rng.normal(0, .4, n).cumsum() * 0
    ph = 2 * np.pi * np.cumsum(f) / SR
    motor = np.sign(np.sin(ph)) * .3 + np.sin(ph) * .55 + np.sin(2 * ph + .4) * .25 + np.sin(3 * ph) * .1
    gate = (np.sin(ph * .5) > .55).astype(float)
    rattle = fftfilt(noise(n) * gate, lo=900, hi=5200) * .35
    x = motor + rattle
    # résonance du plateau en noyer
    ir_n = int(.05 * SR); ti = T(ir_n)
    ir = np.sin(2 * np.pi * 118 * ti) * np.exp(-ti * 55) + .6 * np.sin(2 * np.pi * 262 * ti) * np.exp(-ti * 70) + .35 * np.sin(2 * np.pi * 540 * ti) * np.exp(-ti * 90)
    ir[0] += 2.0
    m = 1 << int(np.ceil(np.log2(n + ir_n)))
    x = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[:n]
    x = fftfilt(x, hi=2400, lo=70)
    env = np.minimum(1, t / .025) * np.minimum(1, np.maximum(dur - t, 0) / .05)
    x = x * env
    return x / (np.max(np.abs(x)) + 1e-9)


# ---------------------------------------------------------------- musique
def music():
    drums = np.zeros((N, 2)); bass = np.zeros((N, 2)); keys = np.zeros((N, 2)); pads = np.zeros((N, 2)); lead = np.zeros((N, 2)); fx = np.zeros((N, 2))
    # énergie par mesure (0 = silence de batterie, 1 = feutré, 2 = groove, 3 = plein, 4 = couloir)
    def energy(t):
        if t < DROP: return 0
        if 40.5 <= t < HALL: return 0
        if t < 15: return 2
        if t < 40.5: return 3
        if t < ROOM: return 4
        if t < 45: return 1
        if t < 50.5: return 2
        if t < END: return 0
        if t < 52.0: return 0
        if t < 56: return 2
        return 0
    # progression (2 s par mesure) : Rém9 | Si♭maj9 | Solm9 | La7sus4→La7
    prog = [(38, [53, 57, 60, 64], [62, 65, 69, 72, 76]),
            (34, [53, 57, 60, 62], [58, 62, 65, 69, 72]),
            (31, [53, 57, 58, 62], [55, 58, 62, 65, 69]),
            (33, [52, 55, 57, 62], [57, 61, 64, 67, 69])]
    kicks = []
    bar0 = O - 2.0
    b = 0
    while bar0 + b * 2 < DUR:
        ts = bar0 + b * 2
        root, epv, padv = prog[b % 4]
        # nappe (toujours là, plus présente dans l'intro et la fin)
        n = int(2.6 * SR); s = np.zeros(n)
        for mm in padv[:4]: s += pad_note(mm, n, seed=b)
        tt = T(n); env = np.minimum(1, tt / .9) * np.minimum(1, (2.6 - tt) / .7)
        ps = s * env * .05
        place(pads, ps, max(ts - .2, 0), 1.0, -.25); place(pads, ps[::-1][::-1] * .95, max(ts - .18, 0), 1.0, .25)
        e = energy(ts + .01)
        if ts + .01 >= DROP:
            # piano électrique : accord sur le 1, rappel sur le "et" du 3
            if e >= 1 or ts >= END:
                for k, mm in enumerate(epv):
                    place(keys, ep(mm, 1.1, .55 + .05 * k), ts + .012 * k, 1, -.3 + .2 * k)
                    if b % 4 == 3 and mm == 62: mm = 61
                    place(keys, ep(mm, .4, .32), ts + 1.25 + .01 * k, 1, .3 - .2 * k)
            # basse
            if e >= 2:
                place(bass, sub(root + 12, .95), ts, .95)
                place(bass, sub(root + 12, .3, .7), ts + 1.25, .95)
                place(bass, sub(root + 24 if b % 2 else root + 12, .4, .6), ts + 1.5, .9)
            elif e == 1:
                place(bass, sub(root + 12, 1.8, .7), ts, .9)
        # batterie (croches)
        for k in range(8):
            t8 = ts + k * .5 / 2 * 2 if False else ts + k * .25
            if t8 < 0 or t8 >= DUR: continue
            e = energy(t8 + .001)
            if e == 0: continue
            if e >= 2:
                if k in (0, 4) or (e >= 3 and k == 7 and b % 2 == 1) or (e == 4 and k % 2 == 0):
                    place(drums, kick(), t8, .95); kicks.append(t8)
                if k in (2, 6): place(drums, snap(), t8, .55, .1)
                if e >= 3 and k in (2, 6): place(drums, clap(), t8 + .004, .45, -.1)
            if e == 1 and k in (2, 6): place(drums, snap(), t8, .4, .1)
            # shaker en doubles croches
            for h in range(2):
                t16 = t8 + h * .125
                acc = 1.0 if h == 1 else .55
                place(drums, shaker(acc), t16 + (.012 if h else 0), .7 if e >= 2 else .45, .35)
            if e >= 3 and k % 2 == 1: place(drums, hat(), t8, .6, -.3)
        # mélodie (cloches) à partir de "Pourquoi nous"
        if 15 <= ts < 40.5 or 52 <= ts < 56:
            motif = [(0, 69), (.75, 72), (1.0, 74), (1.5, 76), (1.75, 74)] if b % 2 == 0 else [(0, 77), (.5, 76), (.75, 74), (1.25, 72), (1.5, 69)]
            for off, mm in motif:
                place(lead, bell(mm, 1.0, .42), ts + off, 1, .2 if mm > 72 else -.2)
        b += 1
    # sidechain : la nappe, la basse et les claviers respirent avec le kick
    duck = np.ones(N)
    for tk in kicks:
        i = int(tk * SR); m = min(N, i + int(.3 * SR)); tt = T(m - i)
        duck[i:m] = np.minimum(duck[i:m], 1 - .45 * np.exp(-tt / .09))
    duck = duck[:, None]
    # couleur : intro feutrée, couloir ouvert
    pads = fftfilt(pads, hi=5200, lo=150, peak=[(300, -3, 1.0)])
    keys = keys * (1 + .22 * np.sin(2 * np.pi * 4.6 * T(N)))[:, None] * np.array([1, .9])
    mus = drums * 1.15 + bass * duck * .55 + keys * duck * .8 + pads * duck * .8 + lead * .6
    wet = reverb(keys * .7 + lead * .6 + pads * .4 + drums * .15, sec=2.6, damp=9000)
    mus = mus + wet * .32
    mus = fftfilt(mus, lo=32, peak=[(250, -2.5, 1.0), (9000, 4.5, .6), (3500, 1.5, .8)])
    # filtre d'intro : sourd jusqu'au décroché
    t = T(N)
    intro = np.clip((t - 0) / DROP, 0, 1)
    lp_mix = fftfilt(mus, hi=700)
    w = np.where(t < DROP, 1.0, 0.0)[:, None]
    mus = mus * (1 - w) + lp_mix * w * (0.6 + .4 * intro[:, None])
    # fin : extinction douce pour boucler sur l'intro
    fade = np.clip((DUR - t) / 2.0, 0, 1)[:, None]
    mus = mus * (.35 + .65 * fade) * np.where(t > 56, 1, 1)[:, None]
    # transitions musicales
    place(fx, riser(1.5, .55), DROP - 1.5, 1)
    place(fx, riser(1.0, .5), HALL - 1.0, 1)
    place(fx, boom(.8), HALL, 1)
    place(fx, riser(.9, .45), END - .9, 1)
    place(fx, boom(1.0, 1.8), LAND[-1], 1)
    place(fx, boom(.5), DROP, 1)
    fxw = reverb(fx, 2.0) * .3 + fx
    return mus + fxw * .7


# ---------------------------------------------------------------- bruitages
def sfx():
    s = np.zeros((N, 2))
    for a, b in VIB: place(s, vibration(b - a), a, .2)
    place(s, whoosh(1.1, 180, 3800, shape=.9), 3.4, .5)
    place(s, tap(.7), DROP, 1)
    place(s, shimmer(1.0, .25), DROP + .15, 1)
    place(s, whoosh(.6, 400, 2600, shape=.5), 5.3, .25, -.2)
    place(s, whoosh(.7, 300, 1800, shape=.6), 7.3, .35, .2)
    for i, c in enumerate(CARDS): place(s, whoosh(.45, 700, 5200, shape=.35), c - .05, .32, -.5 + i * .33)
    place(s, whoosh(.7, 2600, 300, shape=.3), 14.5, .35)
    for i, a in enumerate(ARGS):
        place(s, whoosh(.45, 500, 3000, shape=.6), a - .05, .25, .6 if i % 2 else -.6)
        place(s, tap(.25), a + .42, 1, .6 if i % 2 else -.6)
    place(s, whoosh(.45, 3000, 300, shape=.2), 22.3, .35)
    place(s, whoosh(.5, 300, 3200, shape=.6), 22.7, .4)
    place(s, whoosh(.9, 200, 3600, shape=.9), 25.5, .45)
    for a in (26.5, 30.5): place(s, whoosh(.32, 800, 7000, shape=.5), a, .5, .4)
    for a in (26.8, 30.8): place(s, whoosh(.6, 400, 2400, shape=.5), a, .22)
    for a in (28.1, 28.6, 32.1, 32.6): place(s, tap(.3), a, 1, .3)
    place(s, whoosh(.7, 2400, 300, shape=.3), 34.5, .35)
    place(s, shimmer(1.2, .2, 69), 34.7, 1)
    for i, a in enumerate(SNAPS): place(s, whoosh(.4, 500, 2000, shape=.6), a, .18, -.3 + .15 * i)
    place(s, shimmer(1.0, .25, 74), 40.0, 1)
    place(s, whoosh(1.0, 200, 4200, shape=.95), 40.1, .5)
    # couloir : souffle de vitesse + passages
    n = int(2.6 * SR); tt = T(n)
    rush = fftfilt(noise(n), hi=900, lo=60) * (np.sin(np.pi * np.clip(tt / 2.6, 0, 1)) ** 1.5) * (1 + .3 * np.sin(2 * np.pi * 9 * tt))
    place(s, rush / np.max(np.abs(rush)), HALL - .1, .35)
    for i, a in enumerate([41.35, 41.75, 42.15, 42.5]): place(s, whoosh(.35, 600, 3000, shape=.5), a, .3, .8 if i % 2 else -.8)
    place(s, whoosh(.55, 300, 2000, shape=.5), 42.85, .4)
    place(s, whoosh(.9, 250, 2600, shape=.7), 43.1, .3, -.3)
    place(s, whoosh(.6, 200, 4200, shape=.9), 45.45, .5)
    place(s, shimmer(.9, .2, 76), 45.85, 1)
    for a in (46.8, 47.85, 48.9, 49.95): place(s, whoosh(.5, 900, 3800, shape=.4), a, .14, .2)
    place(s, whoosh(.6, 200, 3600, shape=.9), END - .5, .45)
    place(s, shimmer(1.0, .22, 74), END, 1)
    for a in LAND[:3]: place(s, fftfilt(boom(.25, .3), hi=600), a, 1)
    place(s, whoosh(.4, 1200, 5000, shape=.5), 52.0, .15)
    place(s, shimmer(1.2, .2, 81), 52.1, 1)
    place(s, whoosh(.5, 2000, 400, shape=.4), 56.0, .25)
    place(s, whoosh(.5, 2600, 250, shape=.25), 57.5, .4)
    return s


def limiter(x, ceiling=.89, look=.006):
    a = np.max(np.abs(x), 1)
    g = np.minimum(1, ceiling / np.maximum(a, 1e-9))
    w = int(look * SR)
    def movmin(v, w):
        n = len(v); m = -(-n // w) * w
        vp = np.pad(v, (0, m - n + w), constant_values=1.0)
        bl = vp.reshape(-1, w)
        pre = np.minimum.accumulate(bl, 1).ravel(); suf = np.minimum.accumulate(bl[:, ::-1], 1)[:, ::-1].ravel()
        return np.minimum(suf[:n], pre[w - 1:w - 1 + n])
    gm = movmin(np.concatenate([np.ones(w), g]), 2 * w)[:len(g)]
    k = np.hanning(w * 2 + 1); k /= k.sum()
    gs = np.convolve(np.pad(gm, (w, w), constant_values=1), k, 'same')[w:-w]
    gs = np.minimum(gs, 1)
    return x * gs[:, None]


def loud(x):
    y = fftfilt(x, lo=80, order=1, peak=[(3000, 3, .8)])
    return 10 * np.log10(np.mean(y ** 2) + 1e-12) - .691 + 3.0


def write(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    m = music(); s = sfx()
    m *= 10 ** ((-18.0 - loud(m)) / 20)
    s *= 10 ** ((-17.0 - loud(s)) / 20)
    mix = limiter(m + s)
    g = 10 ** ((-14.0 - loud(mix)) / 20)
    mix = limiter(mix * g)
    sf = limiter(s * g)
    print('mix LUFS≈%.1f peak %.2f | sfx LUFS≈%.1f' % (loud(mix), np.max(np.abs(mix)), loud(sf)))
    for name, x, br in (('mix', mix, '192k'), ('sfx', sf, '128k')):
        wav = os.path.join(out, name + '.wav'); write(wav, x)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'libmp3lame', '-b:a', br, os.path.join(out, name + '.mp3')], check=True)
    print('ok')
