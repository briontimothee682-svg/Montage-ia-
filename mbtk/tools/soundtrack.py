"""Bande-son originale de la vidéo MBTK Design (≈71 s, 120 BPM, ré mineur).
Musique (house dynamique : kick à chaque temps, claps, charleston, basse qui roule, accords, mélodie) + bruitages calés sur l'image.
Tout est synthétisé ici : aucun droit à payer.
Sorties : mix.mp3 (musique + bruitages) et sfx.mp3 (bruitages seuls).
Usage : python3 soundtrack.py <dossier_sortie>
"""
import numpy as np, subprocess, sys, wave, os

import json
SR = 44100
SDUR = 58.0
_W = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'warp.json')))
_STEP = 1 / 400
_n = int(np.ceil(SDUR / _STEP)) + 1
_ss = lambda a, b, x: (lambda k: k * k * (3 - 2 * k))(np.clip((x - a) / (b - a), 0, 1))
_f = np.ones(_n); _sx = (np.arange(_n) + .5) * _STEP
for _a, _b, _k in _W['segments']:
    _e = _W['ramp']; _f += (_k - 1) * _ss(_a - _e, _a + _e, _sx) * (1 - _ss(_b - _e, _b + _e, _sx))
_WR = np.concatenate([[0], np.cumsum(_STEP * _f)])[:_n]


def R(st):
    """temps du scénario (comme dans la timeline JS) -> temps réel de la vidéo"""
    return float(np.interp(st, np.arange(_n) * _STEP, _WR))


DUR = R(SDUR)
N = int(DUR * SR)
BEAT = 0.5
O = 1.0  # origine de la grille des mesures (mesures sur les secondes impaires)
rng = np.random.default_rng(47)

# ---------------------------------------------------------------- repères (identiques à la timeline JS)
VIB = [(0, .42), (.5, .92), (1.0, 1.42), (1.5, 1.92), (2.0, 2.42), (2.5, 2.92), (3.0, 3.42), (3.5, 3.86), (57.2, 57.6)]
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


# ---------------------------------------------------------------- nouveaux sons (version dynamique)
def kick2():
    n = int(.42 * SR); t = T(n)
    f = 48 + 130 * np.exp(-t * 38)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    click = fftfilt(rng.normal(0, 1, n) * np.exp(-t * 900), lo=1500, hi=9000) * .35
    return np.tanh((body + click) * 1.6) * .95


def snare2(vol=1.0):
    n = int(.26 * SR); t = T(n)
    tone = (np.sin(2 * np.pi * 186 * t) * .7 + np.sin(2 * np.pi * 332 * t) * .35) * np.exp(-t * 28)
    nz = fftfilt(rng.normal(0, 1, n), lo=1600, hi=10000) * np.exp(-t * 22)
    return np.tanh((tone + nz * .9) * 1.2) * .7 * vol


def ohat(vol=1.0):
    n = int(.3 * SR); t = T(n)
    return fftfilt(rng.normal(0, 1, n), lo=7200, hi=15000) * np.exp(-t * 11) * np.minimum(1, t / .003) * .5 * vol


def chat(vol=1.0):
    n = int(.05 * SR); t = T(n)
    return fftfilt(rng.normal(0, 1, n), lo=7000, hi=16000) * np.exp(-t * 62) * .9 * vol


def crash(vol=1.0):
    n = int(2.4 * SR); t = T(n)
    nz = fftfilt(rng.normal(0, 1, n), lo=3800, hi=15000) * np.exp(-t * 1.9)
    met = sum(np.sin(2 * np.pi * f * t + k) for k, f in enumerate([3150, 4270, 5340, 6810, 8270, 9620])) * .05 * np.exp(-t * 2.6)
    return (nz + met) * np.minimum(1, t / .002) * .55 * vol


def rim(vol=1.0):
    n = int(.08 * SR); t = T(n)
    return (np.sin(2 * np.pi * 1720 * t) * .6 + fftfilt(rng.normal(0, 1, n), lo=2500, hi=7000) * .5) * np.exp(-t * 80) * .5 * vol


def additive(f, n, dec0, dec1, maxf=9000, nmax=36):
    t = T(n); s = np.zeros(n)
    for h in range(1, int(min(nmax, maxf / f)) + 1):
        s += np.sin(2 * np.pi * f * h * t + h * .37) / h * np.exp(-t * (dec0 + dec1 * (h - 1)))
    return s


def bass_pluck(m, dur=.22, vel=1.0):
    f = note(m); n = int((dur + .04) * SR); t = T(n)
    s = additive(f, n, 3.0, 4.2, 7000) + .7 * np.sin(2 * np.pi * f / 2 * t)
    env = np.minimum(1, t / .003) * np.where(t > dur, np.exp(-(t - dur) * 70), 1) * np.exp(-t * 1.5)
    return np.tanh(s * env * 1.4) * .75 * vel


def stab(ms, dur=.2, vel=.6):
    n = int((dur + .25) * SR); t = T(n); s = np.zeros(n)
    for m in ms:
        for det in (-.09, .09):
            s += additive(note(m) * 2 ** (det / 12), n, 5.0, 2.6, 8000)
    env = np.minimum(1, t / .004) * np.where(t > dur, np.exp(-(t - dur) * 18), 1)
    return s * env * vel / len(ms)


def pluck_lead(m, vel=.6):
    n = int(.6 * SR); t = T(n)
    s = additive(note(m), n, 4.0, 3.0, 9000) + .4 * additive(note(m) * 2.003, n, 6.0, 5.0, 9000)
    return s * np.minimum(1, t / .002) * vel


def lpsweep(x, fc_of_t, order=2):
    """passe-bas glissant (STFT), x stéréo"""
    win, hop = 2048, 512
    w = np.hanning(win); n = len(x)
    out = np.zeros((n + win, 2)); norm = np.zeros(n + win)
    xp = np.pad(x, ((0, win), (0, 0)))
    f = np.fft.rfftfreq(win, 1 / SR)
    for k in range(0, n, hop):
        fc = fc_of_t(k / SR)
        H = 1 / np.sqrt(1 + (f / fc) ** (2 * order))
        for c in range(2):
            out[k:k + win, c] += np.fft.irfft(np.fft.rfft(xp[k:k + win, c] * w) * H, win) * w
        norm[k:k + win] += w * w
    return (out / np.maximum(norm, 1e-3)[:, None])[:n]


# ---------------------------------------------------------------- musique
def music():
    drums = np.zeros((N, 2)); bass = np.zeros((N, 2)); keys = np.zeros((N, 2)); pads = np.zeros((N, 2)); lead = np.zeros((N, 2)); fx = np.zeros((N, 2)); perc = np.zeros((N, 2))
    r = R
    # sections en temps réel
    B_ARGS, B_SOCIAL, B_TRADES, B_PORTAL = r(14.6), r(26.5), r(34.5), r(39.95)
    B_HALL, B_ROOM, B_SITE, B_END, B_LAND, B_OUT = r(41.0), r(42.9), r(46.3), r(51.0), r(52.0), r(56.0)
    GAPS = [(4.78, 5.0), (B_HALL - .16, B_HALL), (B_END - .12, B_END)]

    def section(t):
        if t < DROP: return 'intro'
        for a, b in GAPS:
            if a <= t < b: return 'gap'
        if t < B_ARGS: return 'A'
        if t < B_PORTAL - .5: return 'B'
        if t < B_HALL: return 'build'
        if t < B_ROOM: return 'hall'
        if t < B_SITE - 1.0: return 'room'
        if t < B_SITE: return 'build2'
        if t < B_END: return 'B'
        if t < B_LAND: return 'A'
        if t < B_OUT: return 'C'
        return 'outro'
    # progression (2 s par mesure) : Rém9 | Si♭maj9 | Solm9 | La7sus4→La7
    prog = [(38, [53, 57, 60, 64], [62, 65, 69, 72, 76], [62, 65, 69, 72]),
            (34, [53, 57, 60, 62], [58, 62, 65, 69, 72], [58, 62, 65, 69]),
            (31, [53, 57, 58, 62], [55, 58, 62, 65, 69], [55, 58, 62, 65]),
            (33, [52, 55, 57, 62], [57, 61, 64, 67, 69], [57, 61, 64, 67])]
    kicks = []
    bar0 = O - 2.0; b = 0
    while bar0 + b * 2 < DUR:
        ts = bar0 + b * 2
        root, epv, padv, stv = prog[b % 4]
        # nappe continue
        n = int(2.6 * SR); s = np.zeros(n)
        for mm in padv[:4]: s += pad_note(mm, n, seed=b)
        tt = T(n); env = np.minimum(1, tt / .9) * np.minimum(1, (2.6 - tt) / .7)
        sc = section(ts + .01)
        pv = .07 if sc in ('room', 'outro', 'intro', 'build2') else .045
        place(pads, s * env * pv, max(ts - .2, 0), 1.0, -.25); place(pads, s * env * pv * .95, max(ts - .18, 0), 1.0, .25)
        for k in range(16):
            t16 = ts + k * .125
            if t16 < 0 or t16 >= DUR: continue
            sc = section(t16 + .001)
            if sc == 'gap': continue
            beat = k % 4 == 0; off8 = k % 4 == 2
            pan_h = .3 if k % 2 else -.15
            if sc in ('A', 'B', 'C', 'hall', 'intro', 'build'):
                if beat: place(drums, kick2(), t16, 1.0); kicks.append(t16)
                if k in (4, 12): place(drums, clap(), t16 + .003, .95, -.08); place(drums, snare2(.7), t16, .75, .08)
                if sc == 'hall' and k in (0, 8): place(drums, snare2(.5), t16, .6)
                hv = [1, .45, .7, .5][k % 4] * (.6 if sc == 'intro' else 1)
                if not off8 or sc in ('intro',): place(perc, chat(hv), t16 + (.008 if k % 2 else 0), .8, pan_h)
                if off8 and sc != 'intro': place(perc, ohat(.8), t16, .7, .25)
                if sc in ('B', 'C', 'hall') and k in (3, 7, 11, 14): place(perc, rim(.7), t16, .7, -.4)
                if sc in ('B', 'C') and k % 2 == 0: place(perc, shaker(.9), t16 + .062, .55, .45)
            if sc == 'room':  # demi-tempo : kick sur 1 et le « et » du 3, clap sur 3
                if k in (0, 10): place(drums, kick2(), t16, .85); kicks.append(t16)
                if k == 8: place(drums, clap(), t16, .8); place(drums, snare2(.55), t16, .6)
                if k % 2 == 0: place(perc, chat(.7 if k % 4 else .45), t16, .7, .3)
                if k == 14: place(perc, ohat(.6), t16, .6, -.2)
            if sc == 'build2':
                place(drums, snare2(.25 + .75 * ((t16 - (B_SITE - 1.0)) / 1.0)), t16, .8)
                if beat: place(drums, kick2(), t16, .8); kicks.append(t16)
            if sc == 'build':
                prog_b = np.clip((t16 - (B_PORTAL - .5)) / (B_HALL - (B_PORTAL - .5)), 0, 1)
                place(drums, snare2(.2 + .8 * prog_b), t16, .8, .05)
                if prog_b > .5: place(drums, snare2(.15 + .6 * prog_b), t16 + .0625, .7, -.05)
            # basse : croches à contretemps qui roulent (+ doubles en couloir)
            if sc in ('A', 'B', 'C', 'build'):
                if off8: place(bass, bass_pluck(root + 12, .2, 1.0), t16, 1.0)
                if k in (7, 15) and sc in ('B', 'C'): place(bass, bass_pluck(root + 24, .1, .6), t16, 1.0)
            if sc == 'hall' and not beat: place(bass, bass_pluck(root + 12 + (12 if k % 4 == 3 else 0), .1, .85), t16, 1.0)
            if sc == 'intro' and off8 and ts >= 1.0: place(bass, bass_pluck(root + 12, .16, .5), t16, 1.0)
            # accords plaqués syncopés
            if sc in ('B', 'C') and k in (0, 3, 6, 10): place(keys, stab(stv, .14, .55), t16, 1.0, -.2 if k % 2 else .2)
            if sc == 'A' and k in (3, 10): place(keys, stab(stv, .14, .45), t16, 1.0, .15)
        # piano électrique (nappe harmonique) : sections calmes et groove A
        sc = section(ts + .01)
        if sc in ('A', 'room', 'outro', 'build2') or (sc == 'C' and ts >= B_LAND):
            for k2, mm in enumerate(epv):
                place(keys, ep(mm, 1.1, .5 + .05 * k2), ts + .012 * k2, .9, -.3 + .2 * k2)
                place(keys, ep(mm, .4, .3), ts + 1.25 + .01 * k2, .9, .3 - .2 * k2)
        if sc in ('room',):
            place(bass, sub(root + 12, 1.8, .7), ts, .9)
        # mélodie : cloches + pluck en écho
        if sc in ('B', 'C', 'room') and not (B_HALL <= ts < B_ROOM):
            motif = [(0, 69), (.75, 72), (1.0, 74), (1.5, 76), (1.75, 74)] if b % 2 == 0 else [(0, 77), (.5, 76), (.75, 74), (1.25, 72), (1.5, 69)]
            vel = .3 if sc == 'room' else .5
            for off, mm in motif:
                place(lead, bell(mm, 1.0, vel), ts + off, 1, .2 if mm > 72 else -.2)
                if sc != 'room':
                    pl = pluck_lead(mm - 12, .32)
                    place(lead, pl, ts + off, 1, -.15)
                    place(lead, pl * .35, ts + off + .375, 1, .55); place(lead, pl * .15, ts + off + .75, 1, -.55)
        b += 1
    # sidechain marqué : tout respire avec le kick
    duck = np.ones(N)
    for tk in kicks:
        i = int(tk * SR); m = min(N, i + int(.32 * SR)); tt = T(m - i)
        duck[i:m] = np.minimum(duck[i:m], 1 - .62 * np.exp(-tt / .085))
    duck = duck[:, None]
    pads = fftfilt(pads, hi=5600, lo=150, peak=[(300, -3, 1.0)])
    mus = drums * 1.05 + perc * .8 + bass * duck * .62 + keys * duck * .7 + pads * duck * .85 + lead * duck ** .5 * .62
    wet = reverb(keys * .6 + lead * .7 + pads * .4 + drums * .08 + perc * .1, sec=2.2, damp=9000)
    mus = mus + wet * .28
    mus = fftfilt(mus, lo=30, peak=[(60, 2.0, 1.2), (250, -2.5, 1.0), (9500, 4.0, .6), (3200, 1.5, .8)])
    # accroche : filtre qui s'ouvre jusqu'au décroché, couloir/chambre : couleur
    t = T(N)
    def fc(tt):
        if tt < DROP: return 380 * (2600 / 380) ** min(1, (tt / 4.6) ** 1.5)
        if B_ROOM <= tt < B_SITE - 1.0: return 3200 + 5500 * np.sin(np.pi * .5 * np.clip((tt - B_ROOM) / (B_SITE - 1.0 - B_ROOM), 0, 1))
        if B_SITE - 1.0 <= tt < B_SITE: return 1800 * (14000 / 1800) ** ((tt - (B_SITE - 1.0)) / 1.0)
        if tt >= B_OUT: return 14000 * (500 / 14000) ** min(1, (tt - B_OUT) / (DUR - B_OUT))
        return 16000
    mus = lpsweep(mus, fc)
    # fin : extinction douce pour boucler sur l'accroche
    fade = np.clip((DUR - t) / 1.6, 0, 1)[:, None]
    mus = mus * (.3 + .7 * fade)
    # transitions
    place(fx, boom(1.0, 1.3), 0.0, 1)
    place(fx, crash(.8), 0.0, 1)
    place(fx, riser(1.75, .6), DROP - 1.95, 1)
    place(fx, boom(.9, 1.6), DROP, 1); place(fx, crash(1.0), DROP, 1)
    place(fx, crash(.6), B_ARGS, 1); place(fx, crash(.5), B_SOCIAL, 1); place(fx, crash(.5), B_TRADES, 1)
    place(fx, riser(B_HALL - B_PORTAL + .2, .55), B_PORTAL - .36, 1)
    place(fx, boom(.9), B_HALL, 1); place(fx, crash(.9), B_HALL, 1)
    place(fx, crash(.45), B_ROOM, 1)
    place(fx, riser(1.0, .5), B_SITE - 1.0, 1); place(fx, crash(.7), B_SITE, 1); place(fx, boom(.6), B_SITE, 1)
    place(fx, riser(.9, .45), B_END - .9, 1)
    place(fx, boom(1.0, 1.8), B_LAND, 1); place(fx, crash(.9), B_LAND, 1)
    fxw = reverb(fx, 2.0) * .3 + fx
    return mus + fxw * .7


def rumble(dur, vol=1.0):
    n = int(dur * SR); t = T(n)
    s = np.sin(2 * np.pi * 47 * t) * (.75 + .25 * np.sin(2 * np.pi * 21 * t)) + .3 * np.sin(2 * np.pi * 94 * t)
    env = np.minimum(1, t / .02) * np.minimum(1, np.maximum(dur - t, 0) / .06)
    return np.tanh(s * env * 1.3) * .8 * vol


def glitch_sfx(dur=.2, vol=.5, seed=5):
    r = np.random.default_rng(seed)
    n = int(dur * SR); out = np.zeros(n); i = 0
    while i < n:
        seg = int(r.uniform(.007, .028) * SR); f = r.choice([90, 180, 360, 720, 1440, 2880]); tt = T(seg)
        sig = np.sign(np.sin(2 * np.pi * f * tt)) * r.uniform(.3, 1) if r.random() > .35 else r.normal(0, .6, seg)
        out[i:i + seg] = sig[:n - i]; i += seg
    out = np.round(out * 5) / 5
    return fftfilt(out, hi=9000) * vol * np.minimum(1, (n - np.arange(n)) / (.012 * SR))


# ---------------------------------------------------------------- bruitages (temps du scénario -> temps réel)
def sfx():
    s = np.zeros((N, 2)); r = R
    for a, b in VIB:
        place(s, vibration(r(b) - r(a)), r(a), .34)
        if a < 4: place(s, rumble(r(b) - r(a), .55), r(a), 1)
    for k, a in enumerate((0.0, .96, 1.96)): place(s, glitch_sfx(.22 if k == 0 else .16, .42, seed=5 + k), a, 1, -.2 + .2 * k)
    # accroche : crash zoom, coupes, impacts des mots
    place(s, whoosh(.7, 4200, 250, shape=.12), 0.0, .5)
    for a in (.93, 1.93): place(s, whoosh(.3, 900, 6500, shape=.6), a, .45, .5 if a < 1.5 else -.5)
    for a in (0, .5, 1.0, 1.5, 2.0, 2.5): place(s, fftfilt(boom(.35, .25), hi=500), a, 1)
    place(s, whoosh(1.0, 180, 4200, shape=.85), 2.95, .5)
    # curseur « faire glisser pour répondre »
    place(s, whoosh(.85, 500, 2600, shape=.65), 4.0, .2, .3)
    place(s, tap(.8), 4.95, 1, .3)
    place(s, shimmer(1.0, .28), 5.0, 1)
    place(s, whoosh(.6, 400, 2600, shape=.5), 5.3, .25, -.2)
    place(s, whoosh(.7, 300, 1800, shape=.6), 7.3, .35, .2)
    for i, c in enumerate(CARDS): place(s, whoosh(.45, 700, 5200, shape=.35), r(c) - .05, .32, -.5 + i * .33)
    place(s, whoosh(.7, 2600, 300, shape=.3), r(14.5), .35)
    for i, a in enumerate(ARGS):
        place(s, whoosh(.45, 500, 3000, shape=.6), r(a) - .05, .25, .6 if i % 2 else -.6)
        place(s, tap(.25), r(a) + .42, 1, .6 if i % 2 else -.6)
    place(s, whoosh(.45, 3000, 300, shape=.2), r(22.3), .35)
    place(s, whoosh(.5, 300, 3200, shape=.6), r(22.7), .4)
    place(s, whoosh(.9, 200, 3600, shape=.9), r(25.5), .45)
    for a in (26.5, 30.5): place(s, whoosh(.32, 800, 7000, shape=.5), r(a), .5, .4)
    for a in (26.8, 30.8): place(s, whoosh(.6, 400, 2400, shape=.5), r(a), .22)
    for a in (28.1, 28.6, 32.1, 32.6): place(s, tap(.3), r(a), 1, .3)
    place(s, whoosh(.7, 2400, 300, shape=.3), r(34.5), .35)
    place(s, shimmer(1.2, .2, 69), r(34.7), 1)
    for i, a in enumerate(SNAPS): place(s, whoosh(.4, 500, 2000, shape=.6), r(a), .18, -.3 + .15 * i)
    place(s, shimmer(1.0, .25, 74), r(40.0), 1)
    place(s, whoosh(1.0, 200, 4200, shape=.95), r(40.1), .5)
    # couloir : souffle de vitesse + passages
    d = r(43.0) - r(41.0) + .5; n = int(d * SR); tt = T(n)
    rush = fftfilt(noise(n), hi=900, lo=60) * (np.sin(np.pi * np.clip(tt / d, 0, 1)) ** 1.5) * (1 + .3 * np.sin(2 * np.pi * 9 * tt))
    place(s, rush / np.max(np.abs(rush)), r(41.0) - .1, .35)
    for i, a in enumerate([41.35, 41.75, 42.15, 42.5]): place(s, whoosh(.35, 600, 3000, shape=.5), r(a), .3, .8 if i % 2 else -.8)
    place(s, whoosh(.55, 300, 2000, shape=.5), r(42.85), .4)
    place(s, whoosh(1.1, 250, 2600, shape=.7), r(43.1), .3, -.3)
    place(s, whoosh(.9, 200, 4200, shape=.9), r(45.3), .5)
    place(s, shimmer(.9, .2, 76), r(45.85), 1)
    for a in (46.7, 47.7, 48.7, 49.7): place(s, whoosh(.5, 900, 3800, shape=.4), r(a), .14, .2)
    place(s, whoosh(.6, 200, 3600, shape=.9), r(END) - .5, .45)
    place(s, shimmer(1.0, .22, 74), r(END), 1)
    for a in LAND[:3]: place(s, fftfilt(boom(.25, .3), hi=600), r(a), 1)
    place(s, whoosh(.4, 1200, 5000, shape=.5), r(52.0), .15)
    place(s, shimmer(1.2, .2, 81), r(52.1), 1)
    place(s, whoosh(.5, 2000, 400, shape=.4), r(56.0), .25)
    place(s, whoosh(.5, 2600, 250, shape=.25), r(57.5), .4)
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
