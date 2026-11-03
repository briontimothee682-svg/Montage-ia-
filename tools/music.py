"""Original music for the 3D reel (stereo, 48 kHz): 120 BPM luxury deep-house / trap hybrid in A minor,
arranged on the reel's sections. Everything is synthesised here, so there is no rights issue.
music(dur, sections) -> np.ndarray (n, 2) float32 in -1..1"""
import numpy as np

SR = 48000
BPM = 120
BEAT = 60 / BPM
rng = np.random.default_rng(47)

def env_ad(n, a, d):
    x = np.arange(n) / SR
    return np.minimum(1, x / max(a, 1e-4)) * np.exp(-x / max(d, 1e-4))

def onepole_lp(x, cutoff):
    """vectorised-ish one pole low-pass (cutoff can be an array)"""
    c = np.broadcast_to(np.asarray(cutoff, np.float32), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y

def saw(freq, n, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((freq * t + phase) % 1.0) - 1

def note(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)

def kick():
    n = int(0.45 * SR); x = np.arange(n) / SR
    f = 45 + 110 * np.exp(-x * 28)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 7.5)
    click = rng.normal(0, 1, n) * np.exp(-x * 900) * 0.4
    return np.tanh((body + click) * 1.6) * 0.95

def clap():
    n = int(0.35 * SR); x = np.arange(n) / SR
    s = rng.normal(0, 1, n)
    s = s - onepole_lp(s, 900)                  # high-pass
    e = np.zeros(n)
    for k, off in enumerate([0, 0.008, 0.017, 0.026]):
        i = int(off * SR); e[i:] += np.exp(-(x[: n - i]) * (60 if k < 3 else 16))
    tone = np.sin(2 * np.pi * 190 * x) * np.exp(-x * 40) * 0.3
    return (s * e * 0.55 + tone) * 0.8

def hat(open_=False):
    n = int((0.22 if open_ else 0.05) * SR); x = np.arange(n) / SR
    s = rng.normal(0, 1, n); s = s - onepole_lp(s, 6500)
    return s * np.exp(-x * (14 if open_ else 90)) * 0.45

def pluck(freq, dur=0.5, bright=0.5):
    n = int(dur * SR); p = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, p); out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * (0.993 + 0.006 * bright)
    return out * env_ad(n, 0.002, dur * 0.6)

def reverb(x, seconds=2.2, wet=0.25, seed=1):
    r = np.random.default_rng(seed)
    n = int(seconds * SR); t = np.arange(n) / SR
    ir = r.normal(0, 1, n) * np.exp(-t * 3.2 / seconds * 2.2)
    ir[: int(0.012 * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2))
    L = len(x) + n
    N = 1 << int(np.ceil(np.log2(L)))
    y = np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[: len(x)]
    return x * (1 - wet) + y * wet

def music(dur, drops=(3.5,), breaks=((17.0, 20.25),), outro=33.0):
    n = int(dur * SR)
    L = np.zeros(n, np.float32); R = np.zeros(n, np.float32)
    drums = np.zeros(n, np.float32); bassbus = np.zeros(n, np.float32)
    def add(buf, sig, at, g=1.0):
        i = int(at * SR)
        if i >= n or i + len(sig) <= 0:
            return
        j = min(n, i + len(sig)); buf[i:j] += sig[: j - i] * g
    first_drop = drops[0]
    in_break = lambda t: any(a <= t < b for a, b in breaks)
    # chords: Am - F - C - G (2 s per bar), with 9ths for a luxurious colour
    prog = [(57, [57, 60, 64, 71]), (53, [53, 57, 60, 67]), (48, [55, 60, 64, 67]), (55, [55, 59, 62, 69])]
    bars = int(np.ceil(dur / (4 * BEAT)))
    t = np.arange(n) / SR
    pad = np.zeros(n, np.float32)
    for b in range(bars):
        root, ch = prog[b % 4]
        a, e = int(b * 4 * BEAT * SR), min(n, int((b + 1) * 4 * BEAT * SR))
        if a >= n: break
        seg = e - a
        env = np.minimum(1, np.arange(seg) / (0.3 * SR)) * np.minimum(1, (seg - np.arange(seg)) / (0.25 * SR))
        voice = np.zeros(seg)
        for m_ in ch:
            for det in (-0.07, 0.0, 0.07):
                voice += saw(note(m_ + 12) * (1 + det / 12), seg, rng.uniform())
        pad[a:e] += voice * env * 0.055
        # bass: root on the 1, syncopated octave on the "and" of 2 and 4
        for k, (off, oc, ln) in enumerate([(0, 0, 0.9), (1.5, 12, 0.35), (2, 0, 0.8), (3.5, 12, 0.35)]):
            st = b * 4 * BEAT + off * BEAT
            if st < first_drop - 0.01 or st >= dur: continue
            ns = int(ln * BEAT * SR); x = np.arange(ns) / SR
            f = note(root - 12 + oc)
            bs = np.tanh(2.5 * np.sin(2 * np.pi * f * x) + 0.6 * saw(f, ns)) * env_ad(ns, 0.005, ln * BEAT * 0.9)
            add(bassbus, bs, st, 0.22 * (0.55 if in_break(st) else 1.0))
    # filter sweep on the pad: closed in the intro, opens on the drop, dips in the break
    cut = np.where(t < first_drop, 1200 + 3000 * (t / first_drop) ** 2, 4800).astype(np.float32)
    for a_, b_ in breaks:
        m_ = (t >= a_) & (t < b_)
        cut[m_] = 900 + 2300 * ((t[m_] - a_) / (b_ - a_)) ** 2
    pad = onepole_lp(pad.astype(np.float32), cut)
    # drums
    beat_t = np.arange(0, dur, BEAT)
    for i, bt in enumerate(beat_t):
        if bt < first_drop - 1e-3 or bt >= dur - 1.0:
            continue
        brk = in_break(bt)
        if not brk or (bt % 1.0) < 1e-3:
            add(drums, kick(), bt, 0.6 if not brk else 0.38)
        if i % 2 == 1 and not brk:
            add(drums, clap(), bt, 0.42)
        for sub in (0.0, 0.25, 0.5, 0.75):
            v = 0.45 if sub == 0.5 else 0.3 + 0.1 * rng.random()
            if sub == 0.5 and not brk:
                add(drums, hat(True), bt + sub * BEAT, 0.4)
            elif not brk or sub == 0.5:
                add(drums, hat(), bt + sub * BEAT + (0.012 if sub in (0.25, 0.75) else 0), v)
    # intro & break ticks so the energy never drops to zero
    for bt in np.arange(0, first_drop, BEAT / 2):
        add(drums, hat(), bt, 0.2 + 0.25 * bt / first_drop)
    # sidechain from the kick
    side = np.ones(n, np.float32)
    for bt in beat_t:
        if bt < first_drop or in_break(bt): continue
        i = int(bt * SR); Lh = int(0.22 * SR); j = min(n, i + Lh)
        side[i:j] = np.minimum(side[i:j], 0.3 + 0.7 * (np.arange(j - i) / Lh) ** 0.8)
    # pluck hook: A minor arpeggio in 16ths, panned, with a dotted-8th delay
    motif = [69, 72, 76, 79, 76, 72, 74, 76]
    plL = np.zeros(n, np.float32); plR = np.zeros(n, np.float32)
    step = BEAT / 4
    for k, st in enumerate(np.arange(0, dur - 0.5, step)):
        if st >= outro + 1.5: break
        if not (k % 2 == 0 or st >= first_drop):
            continue
        midi = motif[k % len(motif)] + (-12 if (int(st / (4 * BEAT)) % 4) in (1, 2) else 0)
        g = 0.3 if st >= first_drop else 0.24
        pl = pluck(note(midi), 0.45, 0.6)
        pan = 0.5 + 0.35 * np.sin(k * 0.7)
        add(plL, pl, st, g * (1 - pan) * 2); add(plR, pl, st, g * pan * 2)
    d = int(0.75 * BEAT * SR)
    for _ in range(3):
        plL[d:] += plR[:-d] * 0.35; plR[d:] += plL[:-d] * 0.35
    # risers and impacts
    fx = np.zeros(n, np.float32)
    def riser(length):
        s = rng.normal(0, 1, int(length * SR)).astype(np.float32); x = np.linspace(0, 1, len(s))
        s = onepole_lp(s, 400 + 9000 * x ** 2) * x ** 2.2
        tone = np.sin(2 * np.pi * np.cumsum(200 + 1400 * x ** 2) / SR) * x ** 3 * 0.25
        return s * 1.4 + tone
    def impact():
        x = np.arange(int(1.6 * SR)) / SR
        boom = np.sin(2 * np.pi * np.cumsum(34 + 70 * np.exp(-x * 9)) / SR) * np.exp(-x * 2.4)
        noise = rng.normal(0, 1, len(x)) * np.exp(-x * 6) * 0.35
        return np.tanh((boom + noise) * 1.3)
    for dp in list(drops) + [b for _, b in breaks]:
        add(fx, riser(2.0), dp - 2.0, 0.15)
        add(fx, impact(), dp, 0.34)
    # bus processing
    music_mono = pad * side * 1.0 + bassbus * side + fx
    L = music_mono + plL + drums * 0.9
    R = music_mono + plR + drums * 0.9
    # stereo width on the pad (Haas)
    hz = int(0.012 * SR)
    R[hz:] += pad[:-hz] * side[:-hz] * 0.35; L += pad * side * 0.1
    L = reverb(L.astype(np.float64), 2.4, 0.22, 3); R = reverb(R.astype(np.float64), 2.4, 0.22, 4)
    out = np.stack([L, R], 1)
    # outro fade
    fade = np.clip((dur - t) / 2.5, 0, 1)[:, None]
    out *= fade
    out /= max(1e-6, np.abs(out).max()) / 0.8
    return out.astype(np.float32)
