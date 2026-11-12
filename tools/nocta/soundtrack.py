"""45 s soundtrack and sound design for the NOCTA commercial (stereo 48 kHz, original, rights-free).

0.0-11.5   apartment: room tone, city through the window, playing cards, a glass, then the four
           phones ping at the same moment (2.5 s); warm pad, riser and whoosh through the window
11.5       drop: 130 BPM tech house (kick, rolling bass, claps, hats, chord stabs)
13.3-29    the Golf: engine texture under the music
20.7-24.4  side profile: music muffled as if underwater (low-pass), wind and tyre hiss
24.4       music back at full power (impact)
29.9       through the club doors: big room reverb, crowd cheering, acid line
33.6-35.5  snare-roll build, drop on the DJ (35.5) with crowd scream and whistles
41.0       white strobe flash: impact, one bar of high-pass build
42.84      final bass hit, the music cuts, reverb tail

    python3 tools/nocta/soundtrack.py   -> exports/nocta/nocta_bande_son.wav
"""
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from scipy.signal import butter, fftconvolve, lfilter, sosfilt, sosfilt_zi

sys.path.insert(0, str(Path(__file__).parent))
from timeline import SR, DUR, DROP, FLASH, FINAL_HIT, BAR, BEAT, NOTIF, OUT, bar  # noqa: E402

N = int(DUR * SR)
STEP = BEAT / 4
rng = np.random.default_rng(130)


# ---------------------------------------------------------------- helpers
def s(t):
    return int(round(t * SR))


def tt(n):
    return np.arange(n, dtype=np.float64) / SR


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR / 2 * 0.95), "low", fs=SR, output="sos"), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, min(hi, SR / 2 * 0.95)], "band", fs=SR, output="sos"), x)


def noise(n):
    return rng.normal(0, 1, n)


def pink(n):
    w = rng.normal(0, 1, n)
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return lfilter(b, a, w) * 8


def saw(f, n, ph=0.0):
    f = np.broadcast_to(np.asarray(f, np.float64), (n,))
    p = (np.cumsum(f) / SR + ph) % 1.0
    return 2 * p - 1


def sine(f, n, ph=0.0):
    f = np.broadcast_to(np.asarray(f, np.float64), (n,))
    return np.sin(2 * np.pi * (np.cumsum(f) / SR + ph))


def env(n, a, d, sustain=0.0, hold=0.0):
    x = tt(n)
    att = np.minimum(1, x / max(a, 1e-4))
    dec = np.where(x < a + hold, 1.0, sustain + (1 - sustain) * np.exp(-(x - a - hold) / max(d, 1e-4)))
    return att * dec


class Bus:
    def __init__(self):
        self.x = np.zeros((N, 2))

    def add(self, sig, t, gain=1.0, pan=0.0):
        if sig.ndim == 1:
            th = (pan + 1) * np.pi / 4
            sig = np.stack([sig * np.cos(th), sig * np.sin(th)], 1) * np.sqrt(2)
        i = s(t)
        if i >= N:
            return
        j0 = max(0, -i)
        i = max(0, i)
        n = min(len(sig) - j0, N - i)
        if n > 0:
            self.x[i:i + n] += sig[j0:j0 + n] * gain


def automate(x, points):
    """multiply a (N,2) signal by a piecewise-linear gain curve [(t, g), ...]"""
    ts = np.array([p[0] for p in points]) * SR
    gs = np.array([p[1] for p in points])
    g = np.interp(np.arange(len(x)), ts, gs)
    return x * g[:, None]


def swept_filter(x, fc_of_t, kind="low", order=4, block=256):
    """block-wise time-varying Butterworth filter on a stereo signal"""
    y = np.empty_like(x)
    zi = None
    for i in range(0, len(x), block):
        t = (i + block / 2) / SR
        fc = float(np.clip(fc_of_t(t), 20, SR / 2 * 0.93))
        sos = butter(order, fc, kind, fs=SR, output="sos")
        if zi is None:
            zi = np.stack([sosfilt_zi(sos) * x[0, c] for c in range(2)], -1)
        blk = x[i:i + block]
        out = np.empty_like(blk)
        for c in range(2):
            out[:, c], zi[..., c] = sosfilt(sos, blk[:, c], zi=zi[..., c])
        y[i:i + block] = out
    return y


def reverb_ir(length, decay, lp_fc=6000, predelay=0.02, seed=1):
    r = np.random.default_rng(seed)
    n = int(length * SR)
    x = tt(n)
    e = np.exp(-x * 6.9 / decay)
    irs = []
    for c in range(2):
        ir = r.normal(0, 1, n) * e
        ir = lp(ir, lp_fc)
        ir = np.concatenate([np.zeros(int(predelay * SR)), ir])
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    return np.stack(irs, 1)


def convolve(x, ir):
    return np.stack([fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)


# ---------------------------------------------------------------- instruments
def kick(vel=1.0):
    n = s(0.42)
    x = tt(n)
    f = 46 + 150 * np.exp(-x * 38) + 40 * np.exp(-x * 300)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 7.0)
    click = hp(noise(n), 2500) * np.exp(-x * 700) * 0.35
    return np.tanh((body + click) * 1.8) * 0.9 * vel


def clap(vel=1.0):
    n = s(0.38)
    x = tt(n)
    e = np.zeros(n)
    for k, off in enumerate([0, 0.009, 0.019, 0.03]):
        i = s(off)
        e[i:] += np.exp(-x[:n - i] * (70 if k < 3 else 17))
    sig = bp(noise(n), 900, 6500) * e
    return sig * 0.7 * vel


def snare(vel=1.0, pitch=1.0):
    n = s(0.22)
    x = tt(n)
    tone = np.sin(2 * np.pi * 190 * pitch * x) * np.exp(-x * 30) * 0.5
    nz = bp(noise(n), 1500, 9000) * np.exp(-x * 22)
    return (tone + nz) * 0.6 * vel


def hat(open_=False, vel=1.0):
    n = s(0.32 if open_ else 0.06)
    x = tt(n)
    sig = hp(noise(n), 7500, 4) * np.exp(-x * (11 if open_ else 75))
    return sig * 0.5 * vel


def shaker(vel=1.0):
    n = s(0.08)
    x = tt(n)
    e = np.minimum(1, x / 0.01) * np.exp(-x * 45)
    return bp(noise(n), 4000, 12000) * e * 0.35 * vel


def rim(vel=1.0):
    n = s(0.08)
    x = tt(n)
    sig = (np.sin(2 * np.pi * 820 * x) + 0.5 * np.sin(2 * np.pi * 1630 * x)) * np.exp(-x * 60)
    return sig * 0.35 * vel


def bass_note(midi, dur, vel=1.0):
    n = s(dur)
    x = tt(n)
    f = mtof(midi)
    sub = np.sin(2 * np.pi * f * x)
    sw = lp(saw(f * 1.0, n) + saw(f * 1.005, n), 650 + 900 * vel)
    e = np.minimum(1, x / 0.003) * np.exp(-x / (dur * 0.55))
    return np.tanh((sub * 0.9 + sw * 0.35) * e * 1.6) * 0.62 * vel


def stab(notes, vel=1.0):
    n = s(0.42)
    x = tt(n)
    sig = np.zeros(n)
    for m in notes:
        for det in (-0.09, 0.0, 0.08):
            sig += saw(mtof(m + det), n, rng.random())
    sig = lp(sig, 2600, 2) * np.exp(-x / 0.12) * np.minimum(1, x / 0.004)
    return sig * 0.085 * vel


def pad(notes, dur, cutoff=900, att=1.5):
    n = s(dur)
    x = tt(n)
    sig = np.zeros((n, 2))
    for m in notes:
        for c, det in enumerate((-0.07, 0.07)):
            sig[:, c] += saw(mtof(m + det), n, rng.random()) + 0.6 * saw(mtof(m - det * 1.5), n, rng.random())
    for c in range(2):
        sig[:, c] = lp(sig[:, c], cutoff, 2)
    e = np.minimum(1, x / att) * np.minimum(1, (dur - x) / 0.6).clip(0, 1)
    return sig * e[:, None] * 0.03


def acid(notes_steps, step_dur, cut_base, cut_env, res=0.82):
    """Chamberlin state-variable low-pass on a saw, one value per sample (python loop)"""
    n = s(len(notes_steps) * step_dur) + s(0.2)
    out = np.zeros(n)
    f_arr = np.zeros(n)
    amp = np.zeros(n)
    cut = np.zeros(n)
    for k, st in enumerate(notes_steps):
        if st is None:
            continue
        midi, accent, slide = st
        i0, i1 = s(k * step_dur), s((k + 1) * step_dur)
        x = tt(i1 - i0)
        f_arr[i0:i1] = mtof(midi)
        amp[i0:i1] = np.minimum(1, x / 0.002) * np.exp(-x / (0.09 if not slide else 0.4)) * (1.3 if accent else 0.8)
        cut[i0:i1] = cut_base[k] + cut_env * (1.6 if accent else 1.0) * np.exp(-x / 0.07)
    # glide frequencies a little
    f_arr = np.maximum(f_arr, 1)
    osc = saw(f_arr, n)
    lo = ba = 0.0
    q = 1 - res
    fc = 2 * np.sin(np.pi * np.clip(cut, 40, 9000) / SR)
    for i in range(n):
        hi_ = osc[i] - lo - q * ba
        ba += fc[i] * hi_
        lo += fc[i] * ba
        out[i] = lo
    return np.tanh(out * amp * 2.2) * 0.32


def notification_ping():
    n = s(0.9)
    x = tt(n)
    sig = np.zeros(n)
    for k, (f, t0, g) in enumerate([(1318.5, 0.0, 1.0), (1975.5, 0.085, 0.85)]):
        i = s(t0)
        xx = x[:n - i]
        tone = (np.sin(2 * np.pi * f * xx + 0.6 * np.sin(2 * np.pi * f * 2 * xx) * np.exp(-xx * 20))
                + 0.25 * np.sin(2 * np.pi * f * 2.0 * xx) * np.exp(-xx * 9)
                + 0.08 * np.sin(2 * np.pi * f * 3.01 * xx) * np.exp(-xx * 14))
        sig[i:] += tone * np.minimum(1, xx / 0.002) * np.exp(-xx / 0.22) * g
    return sig * 0.22


def card_flick():
    n = s(0.06)
    x = tt(n)
    snap = hp(noise(n), 2500) * np.exp(-x * 160)
    thump = lp(noise(n), 300) * np.exp(-x * 90) * 0.6
    return (snap + thump) * 0.10


def glass_clink():
    n = s(0.7)
    x = tt(n)
    sig = sum(np.sin(2 * np.pi * f * x) * np.exp(-x * d) * g
              for f, d, g in [(2380, 7, 1), (3640, 10, .6), (5510, 14, .35), (6890, 18, .2)])
    knock = lp(noise(n), 800) * np.exp(-x * 120) * 0.8
    return (sig * 0.05 + knock * 0.08)


def riser(dur, f0=300, f1=5000, gain=0.5):
    n = s(dur)
    x = tt(n) / dur
    nz = noise(n)
    out = np.zeros(n)
    blk = 512
    for i in range(0, n, blk):
        fc = f0 * (f1 / f0) ** (x[min(i + blk // 2, n - 1)])
        seg = nz[max(0, i - 2048):i + blk]
        out[i:i + blk] = bp(seg, fc * 0.7, fc * 1.4)[-len(nz[i:i + blk]):]
    tone = saw(200 * 4 ** x, n) * 0.15
    tone = lp(tone, 3000)
    return (out + tone) * (x ** 2.2) * gain


def whoosh(dur, peak, gain=0.6):
    n = s(dur)
    x = tt(n)
    pos = x / dur
    e = np.where(x < peak, (x / peak) ** 2.5, np.exp(-(x - peak) / 0.09))
    nz = noise(n)
    out = np.zeros(n)
    for i in range(0, n, 512):
        fc = 250 + 4500 * min(1, (x[min(i + 256, n - 1)] / peak)) ** 1.5
        seg = nz[max(0, i - 2048):i + 512]
        out[i:i + 512] = bp(seg, fc * 0.6, fc * 1.6)[-len(nz[i:i + 512]):]
    pan = np.clip(pos * 2 - 1, -1, 1)
    th = (pan + 1) * np.pi / 4
    sig = out * e * gain
    return np.stack([sig * np.cos(th), sig * np.sin(th)], 1) * np.sqrt(2)


def impact(size=1.0):
    n = s(2.2)
    x = tt(n)
    f = 38 + 60 * np.exp(-x * 18)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / (0.5 * size))
    burst = lp(noise(n), 2500) * np.exp(-x * 14) * 0.5
    return np.tanh((sub * 1.1 + burst) * 1.4) * 0.7 * size


def crash(dur=2.4, gain=0.25):
    n = s(dur)
    x = tt(n)
    nz = hp(noise(n), 4500, 2)
    metal = np.sign(np.sin(2 * np.pi * 437 * x)) * np.sign(np.sin(2 * np.pi * 619 * x)) * np.sign(np.sin(2 * np.pi * 1123 * x))
    metal = hp(metal, 3000)
    e = np.minimum(1, x / 0.003) * np.exp(-x / (dur * 0.33))
    return (nz * 0.8 + metal * 0.25) * e * gain


def final_boom():
    n = s(2.3)
    x = tt(n)
    f = 55 * (1 - 0.12 * (1 - np.exp(-x * 2))) + 70 * np.exp(-x * 30)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR)
    e = np.minimum(1, x / 0.002) * np.exp(-x / 0.75)
    click = hp(noise(n), 1500) * np.exp(-x * 200) * 0.4
    sig = np.tanh((sub * 1.4 + click) * e * 2.2) * 0.85
    return sig


def crowd_cheer(dur, voices, seed, f_lo=170, f_hi=480, gain=0.05):
    """many 'woo' voices: glottal-ish pulse through two vowel formants, pitch gliding up"""
    r = np.random.default_rng(seed)
    n = s(dur)
    out = np.zeros((n, 2))
    for v in range(voices):
        t0 = r.uniform(0, dur * 0.35)
        ln = r.uniform(0.5, 1.4)
        nn = min(s(ln), n - s(t0))
        if nn <= 100:
            continue
        x = tt(nn)
        f0 = r.uniform(f_lo, f_hi)
        f = f0 * (1 + r.uniform(0.1, 0.45) * np.sin(np.pi * np.minimum(x / ln, 1) * 0.7)) * (1 + 0.012 * np.sin(2 * np.pi * 5.5 * x))
        src = saw(f, nn) + 0.3 * noise(nn)
        f1, f2 = r.choice([[650, 1100], [450, 850], [350, 750], [750, 1250]])
        sig = bp(src, f1 * 0.8, f1 * 1.25) + 0.6 * bp(src, f2 * 0.85, f2 * 1.2)
        e = np.minimum(1, x / r.uniform(0.05, 0.2)) * np.clip((ln - x) / 0.25, 0, 1)
        pan = r.uniform(-0.9, 0.9)
        th = (pan + 1) * np.pi / 4
        i = s(t0)
        out[i:i + nn, 0] += sig * e * np.cos(th)
        out[i:i + nn, 1] += sig * e * np.sin(th)
    bed = np.stack([bp(pink(n), 300, 3200), bp(pink(n), 300, 3200)], 1) * 0.25
    bed *= (np.minimum(1, tt(n) / 0.4) * np.clip((dur - tt(n)) / 0.8, 0, 1))[:, None]
    return (out + bed) * gain


def whistle(dur=0.6, f=2600):
    n = s(dur)
    x = tt(n)
    fr = f * (1 + 0.08 * np.sin(np.pi * x / dur)) + 30 * np.sin(2 * np.pi * 7 * x)
    e = np.minimum(1, x / 0.04) * np.clip((dur - x) / 0.1, 0, 1)
    return (sine(fr, n) + 0.08 * noise(n)) * e * 0.05


def engine(t0, t1, rpm_curve, gain_curve, cabin=False):
    n = s(t1 - t0)
    x = tt(n)
    rpm = np.interp(x + t0, *zip(*rpm_curve))
    g = np.interp(x + t0, *zip(*gain_curve))
    fire = rpm / 30.0
    jitter = 1 + 0.01 * lp(noise(n), 30) * 8
    base = saw(fire * jitter, n) * 0.6 + saw(fire * 0.5 * jitter, n) * 0.5 + 0.5 * sine(fire * 2, n)
    rough = lp(noise(n), 500) * 0.4
    sig = lp(base + rough, 260 if cabin else 900, 2)
    if not cabin:
        sig += hp(noise(n), 1500) * 0.02
    return np.tanh(sig * 1.3) * g * 0.25


def wind(dur, gain=0.12):
    n = s(dur)
    out = []
    for c in range(2):
        nz = noise(n)
        gust = 0.6 + 0.4 * lp(rng.normal(0, 1, n), 1.5, 1) * 30
        out.append(bp(nz, 250, 2200) * np.clip(gust, 0.2, 1.4))
    return np.stack(out, 1) * gain


# ---------------------------------------------------------------- arrangement
def build():
    amb, music, drums, send_small, sfx, crowd = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()
    kicks = []

    # --- apartment ambience 0 -> ~12 s
    n = s(12.5)
    room = np.stack([lp(pink(n), 220), lp(pink(n), 220)], 1) * 0.028
    city = np.stack([bp(pink(n), 80, 900), bp(pink(n), 80, 900)], 1) * 0.022
    swell = (0.6 + 0.4 * np.sin(2 * np.pi * tt(n) / 7.0))[:, None]
    hum = (np.sin(2 * np.pi * 100 * tt(n)) * 0.0012)[:, None]
    a = room + city * swell + hum
    a *= np.clip((12.2 - tt(n)) / 0.9, 0, 1)[:, None]
    amb.add(a, 0.0)
    amb.add(lp(noise(s(3.0)), 600) * env(s(3.0), 1.2, 0.8) * 0.01, 4.2, pan=-0.5)    # distant car outside
    for t, p in [(0.42, -0.3), (0.58, -0.25), (0.74, -0.2), (1.18, 0.35), (1.31, 0.3), (8.2, -0.1)]:
        sfx.add(card_flick(), t, pan=p)
    sfx.add(glass_clink(), 1.72, pan=0.25)
    # the four phones ping at the exact same moment
    ping = notification_ping()
    for off, pan in [(0.0, -0.65), (0.0015, -0.2), (0.003, 0.25), (0.0045, 0.65)]:
        sfx.add(ping, NOTIF + off, gain=0.55, pan=pan)
    sfx.add(convolve(np.stack([ping, ping], 1) * 0.25, reverb_ir(0.6, 0.45, 5000, seed=2)), NOTIF)
    # anticipation: warm pad, riser, whoosh through the window
    music.add(pad([45, 52, 55, 59, 60], DROP - 6.0 + 0.4, 700, 2.0), 6.0, gain=2.2)
    sfx.add(riser(DROP - 9.66, 250, 6000, 0.09), 9.66, pan=0.0)
    sfx.add(whoosh(1.0, 0.5, 0.35), DROP - 0.5)
    sfx.add(crash(1.2, 0.12)[::-1], DROP - 1.2)                                          # reversed cymbal
    sfx.add(hp(np.sum([np.sin(2 * np.pi * f * tt(s(1.2))) * np.exp(-tt(s(1.2)) * d) for f, d in
                       [(3100, 6), (4730, 8), (6210, 9), (8020, 11)]], 0), 2000) * 0.035, DROP, pan=0.2)  # glass shimmer

    # --- groove from the drop to the final hit
    am = [45, 45, 45, 43, 45, 45, 48, 45]
    bass_steps = [2, 3, 6, 7, 10, 11, 14, 15]
    bass_vel = [1.0, .55, 1.0, .5, 1.0, .55, 1.0, .65]
    stab_pat = [[3, 6, 11], [3, 8, 14]]
    chords = [[57, 60, 64, 67], [57, 60, 64, 67], [55, 59, 62, 65], [57, 60, 64, 69]]
    acid_notes = [33, 33, 45, 33, 36, 33, 43, 33, 33, 45, 33, 31, 33, 40, 45, 33]
    acid_acc = [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0]
    acid_sl = [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0]

    n_bars = 16
    for b in range(n_bars):
        t_bar = bar(b)
        in_build = 12 <= b < 13       # snare roll before the DJ drop
        for st in range(16):
            t = t_bar + st * STEP
            beat_i, sub = divmod(st, 4)
            # kick: four on the floor, gap on the last beat of the build
            if sub == 0 and not (in_build and beat_i == 3):
                kicks.append(t)
                drums.add(kick(1.0 if beat_i == 0 else 0.92), t)
            # claps on 2 and 4
            if st in (4, 12) and not in_build:
                c = clap(1.0)
                drums.add(c, t, gain=0.8, pan=0.05)
                send_small.add(c, t, gain=0.5)
            # hats
            if sub == 2:
                drums.add(hat(True, 0.75), t, pan=0.2)
            elif sub in (1, 3):
                drums.add(hat(False, 0.45 if sub == 1 else 0.6), t, pan=-0.25)
            drums.add(shaker(0.5 + 0.3 * (sub == 2)), t + 0.006, pan=0.45)
            if st in (7, 13) and b % 2 == 1:
                drums.add(rim(0.8), t, pan=-0.4)
        # rolling bass
        if not in_build:
            for k, st in enumerate(bass_steps):
                note = am[(b * 2 + k // 4) % len(am)] if k in (0, 4) else 45
                music.add(bass_note(note - 12, STEP * 1.6, bass_vel[k]), t_bar + st * STEP, gain=0.9)
        # stabs (with dotted-eighth echoes)
        if not in_build:
            ch = chords[(b // 2) % 4]
            for st in stab_pat[b % 2]:
                sg = stab(ch, 1.0)
                t = t_bar + st * STEP
                music.add(sg, t, gain=1.0, pan=0.0)
                for e_k, (dt, pan) in enumerate([(3, -0.6), (6, 0.6), (9, -0.4)]):
                    music.add(lp(sg, 1800 - 400 * e_k), t + dt * STEP, gain=0.32 * 0.55 ** e_k, pan=pan)
                send_small.add(sg, t, gain=0.6)
        # acid line in the club, from bar 10
        if b >= 10 and not in_build:
            cut_base = [500 + 1400 * ((b - 10) / 6) + 300 * np.sin(k / 16 * np.pi * 2) for k in range(16)]
            steps = [(acid_notes[k] + 12, acid_acc[k], acid_sl[k]) for k in range(16)]
            music.add(acid(steps, STEP, cut_base, 2200, 0.84), t_bar, gain=0.55, pan=0.1)
        # extra pad layer in the club
        if b >= 10:
            music.add(pad([57, 60, 64, 67, 71], BAR + 0.3, 1600, 0.4), t_bar, gain=0.55)

    # build: snare roll 8ths -> 16ths -> 32nds with rising pitch, riser
    t_b = bar(12)
    k = 0
    for div, beats in [(2, 1), (4, 1), (8, 1.75)]:
        for j in range(int(div * beats)):
            t = t_b + k
            frac = (t - t_b) / BAR
            drums.add(snare(0.35 + 0.65 * frac, 1 + 0.5 * frac), t, pan=0.1)
            k += BEAT / div
    sfx.add(riser(BAR, 400, 8000, 0.16), t_b)

    # flash bar (41.0 -> 42.84): kick on 1 only, 16th snare roll and riser, then cut
    drums.add(kick(1.0), FLASH)
    kicks.append(FLASH)
    for j in range(16):
        t = FLASH + j * STEP
        frac = j / 16
        drums.add(snare(0.25 + 0.75 * frac, 1 + 0.7 * frac), t, gain=0.85, pan=0.1)
    music.add(pad([57, 60, 64, 67, 71], BAR, 2600, 0.05), FLASH, gain=0.9)
    sfx.add(riser(BAR, 600, 9000, 0.2), FLASH)

    # impacts and crashes
    for t, sz in [(DROP, 1.0), (bar(7), 0.85), (bar(10), 0.9), (bar(13), 1.15), (FLASH, 0.9)]:
        sfx.add(impact(sz), t, gain=0.85)
        sfx.add(crash(2.4, 0.22), t, pan=0.15)
    sfx.add(hp(noise(s(0.25)), 3000) * np.exp(-tt(s(0.25)) * 18) * 0.25, FLASH)          # strobe flash burst
    # final bass hit
    fb = final_boom()
    sfx.add(fb, FINAL_HIT, gain=1.0)
    sfx.add(crash(2.2, 0.3), FINAL_HIT, pan=-0.1)
    sfx.add(convolve(np.stack([fb, fb], 1) * 0.35, reverb_ir(2.0, 1.8, 3000, seed=4)), FINAL_HIT)
    sfx.add(clap(1.0), FINAL_HIT, gain=0.6)

    # --- the Golf
    sfx.add(engine(13.0, 15.4, [(13.0, 3600), (15.4, 4300)], [(13.0, 0), (14.2, 0.6), (15.1, 1.0), (15.4, 0.4)]), 13.0, pan=0.1)
    sfx.add(engine(15.19, 20.9, [(15.19, 3800), (18.0, 4400), (20.9, 4100)], [(15.19, 0.35), (20.9, 0.35)], cabin=True), 15.19)
    sfx.add(engine(20.72, 25.5, [(20.72, 4300), (24.4, 4700), (25.5, 4700)], [(20.72, 0.9), (24.0, 0.9), (25.5, 0)]), 20.72, pan=-0.2)
    sfx.add(engine(27.4, 29.2, [(27.4, 2600), (29.2, 1100)], [(27.4, 0), (27.8, 0.35), (29.2, 0)]), 27.4, pan=0.3)
    sfx.add(wind(bar(7) - bar(5) + 0.3, 0.10) * env(s(bar(7) - bar(5) + 0.3), 0.08, 3)[:, None], bar(5))
    tyre = np.stack([hp(noise(s(3.8)), 900), hp(noise(s(3.8)), 900)], 1) * 0.012
    sfx.add(tyre, bar(5))

    # --- club crowd
    crowd.add(crowd_cheer(3.5, 60, 21, gain=0.045), bar(10) - 0.3)
    crowd.add(crowd_cheer(4.0, 90, 22, 220, 560, gain=0.06), bar(13) - 0.05)
    crowd.add(crowd_cheer(6.0, 30, 23, gain=0.03), bar(11.5))
    crowd.add(crowd_cheer(5.0, 30, 24, gain=0.028), bar(14))
    for t, f in [(bar(13) + 0.2, 2700), (bar(13) + 0.9, 3000), (bar(10) + 0.6, 2500)]:
        crowd.add(whistle(0.55, f), t, pan=rng.uniform(-0.6, 0.6))
    # crowd murmur outside the club
    nn = s(bar(9.5) - 26.0)
    out_crowd = np.stack([bp(pink(nn), 250, 1800), bp(pink(nn), 250, 1800)], 1) * 0.02
    out_crowd *= env(nn, 1.5, 4, 0.5)[:, None]
    crowd.add(out_crowd, 26.0)

    # ---------------- mix
    # sidechain pumping on the music bus
    sc = np.ones(N)
    x = np.arange(N) / SR
    for t in kicks:
        i = s(t)
        m = min(N - i, s(0.35))
        sc[i:i + m] = np.minimum(sc[i:i + m], 1 - 0.6 * np.exp(-x[:m] / 0.075))
    mus = music.x * sc[:, None]
    dr = drums.x
    small = convolve(send_small.x, reverb_ir(1.1, 0.9, 5000, seed=5)) * 0.35
    groove = mus + dr + small
    # club: big room reverb on the whole groove from the doors, more width and weight
    big = convolve(groove, reverb_ir(2.4, 2.2, 4000, 0.03, seed=6))
    send = np.interp(x, [0, bar(9.5), bar(10), FLASH, FINAL_HIT, FINAL_HIT + 0.01], [0.05, 0.05, 0.42, 0.42, 0.25, 0])
    groove = groove + big * send[:, None]
    # side profile: underwater low-pass, opening on the riser
    lo_a, lo_b = bar(5), bar(7)

    def lp_curve(t):
        if t < lo_a - 0.1 or t >= lo_b:
            return 20000
        if t < lo_a + 0.05:                       # quick plunge, no dropout
            u = (t - (lo_a - 0.1)) / 0.15
            return 20000 * (360 / 20000) ** u
        if t < lo_b - BAR * 0.5:
            return 360 + 40 * np.sin(2 * np.pi * 0.7 * t)
        u = (t - (lo_b - BAR * 0.5)) / (BAR * 0.5)
        return 360 * (20000 / 360) ** (u ** 2.2)
    groove = swept_filter(groove, lp_curve, "low", 4)
    # flash bar: high-pass build
    groove = swept_filter(groove, lambda t: 20 if t < FLASH else 20 + 1200 * ((t - FLASH) / BAR) ** 1.6, "high", 2)
    # music cuts on the final hit
    groove = automate(groove, [(0, 1), (FINAL_HIT - 0.004, 1), (FINAL_HIT + 0.02, 0), (DUR, 0)])
    sfx_x = sfx.x
    crowd_x = crowd.x
    # muffle the cabin engine and wind section a touch, keep crowd in the club only
    crowd_x = automate(crowd_x, [(0, 1), (FLASH, 1), (FLASH + 0.25, 0.25), (FINAL_HIT, 0), (DUR, 0)])
    amb_x = amb.x
    mix = groove * 0.9 + sfx_x + crowd_x + amb_x * 1.0
    mix = automate(mix, [(0, 0), (0.05, 1), (DUR - 0.5, 1), (DUR, 0)])
    return mix


# ---------------------------------------------------------------- mastering
def limiter(x, ceiling=0.89, look=0.004, release=0.06):
    peak = np.max(np.abs(x), 1)
    env_ = maximum_filter1d(peak, size=s(look) * 2 + 1)
    g = np.minimum(1, ceiling / np.maximum(env_, 1e-9))
    g = np.minimum(g, uniform_filter1d(g, s(release)))
    g = uniform_filter1d(g, s(look))
    return x * g[:, None]


def glue(x, thr=0.35, ratio=2.5, att=0.01, rel=0.15):
    lvl = np.sqrt(uniform_filter1d(np.mean(x ** 2, 1), s(att * 3)))
    lvl = uniform_filter1d(lvl, s(rel))
    over = np.maximum(lvl / thr, 1)
    g = over ** (1 / ratio - 1)
    return x * g[:, None]


def write_wav(path, x):
    y = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(y.tobytes())


def loudness(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    txt = r.stderr
    i = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", txt)[-1])
    tp = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", txt)[-1])
    return i, tp


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    mix = build()
    mix = glue(mix)
    path = OUT / "nocta_bande_son.wav"
    target = -14.0
    gain = 1.0
    for _ in range(3):
        y = limiter(mix * gain, 0.80)
        write_wav(path, y)
        i, tp = loudness(path)
        gain *= 10 ** ((target - i) / 20)
        if abs(i - target) < 0.3:
            break
    i, tp = loudness(path)
    print(json.dumps({"file": str(path), "integrated_LUFS": i, "true_peak_dBTP": tp}))


if __name__ == "__main__":
    main()
