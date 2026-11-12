"""Final assembly of the NOCTA commercial.

Drop the AI-generated clips in nocta/clips/ (shot_01.mp4 ... shot_08.mp4, see nocta/PROMPTS_NOCTA.md)
and run:

    python3 tools/nocta/assemble.py                 -> exports/nocta/NOCTA_final.mp4
                                                      (NOCTA_animatic.mp4 while clips are missing)
    python3 tools/nocta/assemble.py --extraire-fin nocta/clips/shot_01.mp4
                                                    -> last frame as PNG, to start the next shot from it

What it does, following nocta/montage.json:
- conforms every clip to 1080x1920 24 fps (scale to cover + centre crop, any input ratio)
- places each clip on the beat-aligned timeline, with an optional sync point
  ("synchro": {"dans_le_clip": 3.2, "sur_la_timeline": 2.5}) to land an event exactly on its cue
- speed ramps (fast into and out of every camera-driven transition) with real motion blur
- seamless transitions: "traversee" (zoom blur + light bump, for passing through glass, windshield,
  doors), "fondu" (soft blend), "coupe" (hard cut), "flash" (white strobe into the flyer)
- one shared grade so clips from different generations match (deep blue shadows, warm highlights,
  halation, grain)
- the readable 3D notification card at 2.5 s, the animated flyer at 41 s, the original soundtrack,
  plus each clip's own sound where wanted (voices, laughter)
Missing clips are replaced by labelled placeholders, so the animatic already shows timing and sound.
"""
import argparse
import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from timeline import W, H, FPS, DUR, SR, NOTIF, FLASH, DROP, BEAT, SEGMENTS, OUT, CLIPS, ROOT  # noqa: E402
from fx import font, ease_in_out, grain_bank  # noqa: E402

HANDLE = 0.125        # seconds of overlap on each side of a blended transition
RAMP_MAX = 2.2        # speed multiplier at the edges of a ramped shot
RAMP_LEN = 0.35       # seconds of ramp at each edge
SHUTTER = 0.5         # 180 degree shutter for the speed-ramp motion blur

MOODS = {"01": ("#3a2414", "#0b0705"), "02": ("#3a2414", "#0b0705"), "03a": ("#13224a", "#04060f"),
         "03b": ("#13224a", "#04060f"), "04": ("#3a0f16", "#060308"), "05": ("#13224a", "#04060f"),
         "06": ("#2c1450", "#06030d"), "07": ("#35104f", "#07020c"), "08": ("#35104f", "#07020c")}


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "stream=codec_type,r_frame_rate,avg_frame_rate:format=duration", "-of", "json", str(path)],
                       capture_output=True, text=True)
    j = json.loads(r.stdout)
    fps, audio = 24.0, False
    for st in j.get("streams", []):
        if st["codec_type"] == "video":
            num, den = (st.get("avg_frame_rate") or st["r_frame_rate"]).split("/")
            if float(den) > 0 and float(num) > 0:
                fps = float(num) / float(den)
        if st["codec_type"] == "audio":
            audio = True
    return float(j["format"]["duration"]), fps, audio


# ------------------------------------------------------------------ grade
class Grade:
    def __init__(self, strength, grain):
        self.k = strength
        self.grain = grain_bank(6, 9, 0.024 * grain) if grain > 0 else None
        self.i = 0

    def __call__(self, u8):
        k = self.k
        f = u8.astype(np.float32) / 255
        if k > 0:
            lum = f @ np.array([0.2126, 0.7152, 0.0722], np.float32)
            f = f * (1 - 0.3 * k) + (f * f * (3 - 2 * f)) * 0.3 * k                       # gentle S-curve
            sw = ((1 - lum) ** 3)[..., None]
            hw = (lum ** 3)[..., None]
            f += k * sw * np.array([-0.012, -0.006, 0.040], np.float32)                     # blue-violet shadows
            f += k * hw * np.array([0.025, 0.006, -0.018], np.float32)                      # warm highlights
            g = f.mean(2, keepdims=True)
            f = g + (f - g) * (1 + 0.05 * k)
            hl = np.clip(lum - 0.78, 0, 1)
            small = Image.fromarray((hl * 255).astype(np.uint8), "L").resize((W // 4, H // 4), Image.BILINEAR)
            halo = np.asarray(small.filter(ImageFilter.GaussianBlur(5)).resize((W, H), Image.BILINEAR), np.float32) / 255
            f += k * 0.35 * halo[..., None] * np.array([1.0, 0.42, 0.30], np.float32)       # halation
            f = f * (1 - 0.025 * k) + 0.025 * k * np.array([0.16, 0.12, 0.30], np.float32)  # violet blacks
        if self.grain is not None:
            f += self.grain[self.i % len(self.grain)]
            self.i += 1
        return (np.clip(f, 0, 1) * 255 + .5).astype(np.uint8)


# ------------------------------------------------------------------ zoom blur
def zoom_blur(u8, amount, bright=0.0):
    if amount <= 0.002 and bright <= 0.001:
        return u8
    im = Image.fromarray(u8)
    acc = np.zeros((H, W, 3), np.float32)
    n = 7
    for i in range(n):
        s = 1 + amount * i / (n - 1)
        cw, ch = W / s, H / s
        x0, y0 = (W - cw) / 2, (H - ch) / 2
        acc += np.asarray(im.transform((W, H), Image.EXTENT, (x0, y0, x0 + cw, y0 + ch), Image.BILINEAR), np.float32)
    acc /= n
    acc = acc * (1 + bright) + 255 * bright * 0.35
    return np.clip(acc, 0, 255).astype(np.uint8)


# ------------------------------------------------------------------ segments
class Segment:
    def __init__(self, sid, a, b, title, desc, cfg, clips_dir, grade):
        self.sid, self.a, self.b, self.title, self.desc = sid, a, b, title, desc
        self.dur = b - a
        self.cfg = cfg or {}
        self.grade = grade
        f = self.cfg.get("fichier", f"shot_{sid}.mp4")
        self.path = Path(clips_dir) / f
        self.real = self.path.exists()
        self.v = float(self.cfg.get("vitesse", 1.0))
        self.ramp = bool(self.cfg.get("rampe", False))
        self.trans = self.cfg.get("transition_suivante", "fondu")
        self.frames = None
        self.base = None
        self.warned = False
        taus = np.arange(-HANDLE - 0.05, self.dur + HANDLE + 0.05, 0.001)
        rr = np.ones_like(taus)
        if self.ramp:
            rr += (RAMP_MAX - 1) * ease_in_out(np.clip(1 - taus / RAMP_LEN, 0, 1))
            rr += (RAMP_MAX - 1) * ease_in_out(np.clip((taus - (self.dur - RAMP_LEN)) / RAMP_LEN, 0, 1))
        R = np.cumsum(rr) * 0.001
        R -= np.interp(0, taus, R)
        self._taus, self._R = taus, R
        self.src_in = float(self.cfg.get("debut_source", 0.0))
        sync = self.cfg.get("synchro")
        if sync:
            tau = float(sync["sur_la_timeline"]) - a
            self.src_in = float(sync["dans_le_clip"]) - self.v * self.R(tau)
        if self.real:
            self.clip_dur, self.src_fps, self.has_audio = probe(self.path)

    def R(self, tau):
        return float(np.interp(tau, self._taus, self._R))

    def u(self, tau):
        return self.src_in + self.v * self.R(tau)

    def source_range(self):
        return self.u(-HANDLE), self.u(self.dur + HANDLE)

    def load(self):
        if self.frames is not None or not self.real:
            return
        u0, u1 = self.source_range()
        start = max(0.0, u0 - 0.1)
        length = min(self.clip_dur, u1 + 0.2) - start
        if u1 > self.clip_dur + 0.05 or u0 < -0.3:
            print(f"  ! plan {self.sid}: il faut {u0:.2f}s -> {u1:.2f}s du clip, il dure {self.clip_dur:.2f}s "
                  f"(baisse 'vitesse' ou 'debut_source' dans montage.json) - image figee aux bords")
        cmd = ["ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-t", f"{max(length, 0.1):.3f}", "-i", str(self.path),
               "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},setsar=1",
               "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
        raw = subprocess.run(cmd, capture_output=True).stdout
        n = len(raw) // (W * H * 3)
        self.frames = np.frombuffer(raw[:n * W * H * 3], np.uint8).reshape(n, H, W, 3)
        self.load_t0 = start
        print(f"  plan {self.sid}: {self.path.name} {n} images ({self.src_fps:.2f} i/s), source {u0:.2f}s -> {u1:.2f}s")

    def release(self):
        self.frames = None

    def _src_frame(self, u):
        idx = int(round((u - self.load_t0) * self.src_fps))
        return self.frames[min(max(idx, 0), len(self.frames) - 1)]

    def frame(self, t):
        tau = t - self.a
        if not self.real:
            return self.placeholder(tau)
        self.load()
        u0 = self.u(tau)
        u1 = self.u(tau + SHUTTER / FPS)
        nsub = int(np.clip(abs(u1 - u0) * self.src_fps * 1.5, 1, 8))
        if nsub == 1:
            f = self._src_frame(u0)
        else:
            f = np.mean([self._src_frame(x).astype(np.float32) for x in np.linspace(u0, u1, nsub)], 0).astype(np.uint8)
        return self.grade(f)

    # placeholder card for the animatic
    def placeholder(self, tau):
        if self.base is None:
            top, bot = MOODS.get(self.sid, ("#202020", "#050505"))
            y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
            img = hexc(top) * (1 - y) + hexc(bot) * y
            img = np.broadcast_to(img, (H, W, 3)).copy()
            im = Image.fromarray(img.astype(np.uint8))
            d = ImageDraw.Draw(im)
            d.text((W / 2, 560), f"PLAN {self.sid.upper()}", font=font("Unbounded-Bold.ttf", 118), fill=(255, 255, 255), anchor="mm")
            d.text((W / 2, 700), self.title, font=font("Poppins-SemiBold.ttf", 56), fill=(235, 225, 255), anchor="mm")
            d.text((W / 2, 790), f"{self.a:05.2f}s  ->  {self.b:05.2f}s   ({self.dur:.2f}s)",
                   font=font("Poppins-Medium.ttf", 40), fill=(190, 180, 220), anchor="mm")
            fb = font("Poppins-Regular.ttf", 40)
            words, lines, cur = self.desc.split(), [], ""
            for w_ in words:
                tt = (cur + " " + w_).strip()
                if d.textlength(tt, font=fb) <= 900:
                    cur = tt
                else:
                    lines.append(cur)
                    cur = w_
            lines.append(cur)
            for i, ln in enumerate(lines):
                d.text((W / 2, 920 + i * 58), ln, font=fb, fill=(225, 220, 235), anchor="mm")
            d.text((W / 2, 1330), f"a generer : nocta/clips/{self.cfg.get('fichier', 'shot_' + self.sid + '.mp4')}",
                   font=font("Poppins-Medium.ttf", 34), fill=(160, 150, 190), anchor="mm")
            self.base = np.asarray(im)
        f = self.base.copy()
        p = np.clip(tau / self.dur, 0, 1)
        f[1420:1428, 90:90 + int(900 * p)] = (200, 170, 255)
        f[1420:1428, 90 + int(900 * p):990] = (70, 60, 90)
        t = self.a + tau
        if t >= DROP:
            ph = ((t - DROP) / BEAT) % 1
            r = int(26 + 20 * np.exp(-ph * 8))
            col = (int(120 + 135 * np.exp(-ph * 6)), 90, 255)
            yy, xx = np.ogrid[-r:r, -r:r]
            m = xx * xx + yy * yy <= r * r
            f[1530 - r:1530 + r, W // 2 - r:W // 2 + r][m] = col
        return f


# ------------------------------------------------------------------ audio
def read_wav(path):
    with wave.open(str(path)) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, w.getnchannels()) / 32768
    return x.astype(np.float64)


def write_wav(path, x):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def clip_audio(seg, gain):
    if not (seg.real and seg.has_audio) or gain <= 0:
        return None
    if seg.ramp:
        print(f"  ! plan {seg.sid}: son du clip ignore (rampe de vitesse active)")
        return None
    af = [f"atempo={seg.v:.4f}"] if abs(seg.v - 1) > 1e-3 and 0.5 <= seg.v <= 2 else []
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{max(seg.src_in, 0):.3f}", "-t", f"{seg.dur * seg.v:.3f}", "-i", str(seg.path),
           "-vn", "-ac", "2", "-ar", str(SR)] + (["-af", ",".join(af)] if af else []) + ["-f", "s16le", "-"]
    raw = subprocess.run(cmd, capture_output=True).stdout
    x = np.frombuffer(raw, np.int16).reshape(-1, 2) / 32768 * gain
    n = len(x)
    fade = min(n // 2, int(0.08 * SR))
    if fade > 0:
        ramp = np.linspace(0, 1, fade)[:, None]
        x = x.copy()
        x[:fade] *= ramp
        x[-fade:] *= ramp[::-1]
    return x


def build_audio(segs, cfg, out_wav):
    music = OUT / "nocta_bande_son.wav"
    if not music.exists():
        import soundtrack
        soundtrack.main()
    mix = read_wav(music)
    n = int(DUR * SR)
    mix = np.pad(mix, ((0, max(0, n - len(mix))), (0, 0)))[:n]
    for seg in segs:
        x = clip_audio(seg, float(seg.cfg.get("son_du_clip", 0)))
        if x is None:
            continue
        i = int(seg.a * SR)
        m = min(len(x), n - i)
        mix[i:i + m] += x[:m]
    peak = np.abs(mix).max()
    if peak > 0.93:
        mix *= 0.93 / peak
    write_wav(out_wav, mix)


# ------------------------------------------------------------------ main render
def render(cfg, clips_dir, out_path, preview=False):
    from notif import NotifCard, composite
    from flyer import Flyer

    grade = Grade(float(cfg.get("etalonnage", 0.5)), float(cfg.get("grain", 0.5)))
    plans = cfg.get("plans", {})
    segs = [Segment(sid, a, b, ti, de, plans.get(sid), clips_dir, grade) for sid, a, b, ti, de in SEGMENTS if sid != "09"]
    real = [s.sid for s in segs if s.real]
    print(f"clips trouves : {', '.join(real) if real else 'aucun (animatic)'}")
    flyer = Flyer(cfg.get("adresse", "[ADRESSE]"))
    ncfg = cfg.get("notification", {})
    card = NotifCard(cfg.get("adresse", "[ADRESSE]"), int(ncfg.get("hauteur_centre_px", 760))) if ncfg.get("active", True) else None

    wav = OUT / "_mix_tmp.wav"
    build_audio(segs, cfg, wav)
    vf = ["-vf", "scale=540:960"] if preview else []
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", str(wav), "-map", "0:v", "-map", "1:a"] + vf + [
           "-c:v", "libx264", "-preset", "medium" if preview else "slow", "-crf", "20" if preview else "19",
           "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
           "-c:a", "aac", "-b:a", "320k", "-shortest", "-movflags", "+faststart", str(out_path)]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    total = int(round(DUR * FPS))
    boundaries = [(segs[i], segs[i + 1]) for i in range(len(segs) - 1)]
    for k in range(total):
        t = k / FPS
        if t >= FLASH:
            frame = flyer.frame(k - int(round(FLASH * FPS)))
        else:
            j = next(i for i, s in enumerate(segs) if s.a <= t < s.b)
            seg = segs[j]
            frame = None
            for P, Q in boundaries:
                if P.trans in ("fondu", "traversee") and abs(t - P.b) < HANDLE:
                    w = float(ease_in_out((t - P.b + HANDLE) / (2 * HANDLE)))
                    fa = P.frame(t).astype(np.float32)
                    fb = Q.frame(t).astype(np.float32)
                    frame = (fa * (1 - w) + fb * w).astype(np.uint8)
                    bump = np.sin(np.pi * w)
                    if P.trans == "traversee":
                        frame = zoom_blur(frame, 0.16 * bump, 0.18 * bump)
                    else:
                        frame = zoom_blur(frame, 0.03 * bump)
                    break
            if frame is None:
                frame = seg.frame(t)
            if seg.trans == "flash" and t > seg.b - 3.5 / FPS:
                wf = (t - (seg.b - 3.5 / FPS)) / (3.5 / FPS)
                frame = (frame.astype(np.float32) * (1 - wf) + 255 * wf).astype(np.uint8)
            if card is not None and NOTIF <= t < 6.0:
                c, g = card.frame(t - NOTIF)
                frame = composite(frame, c, g)
            for s in segs:
                if s.frames is not None and t > s.b + HANDLE:
                    s.release()
        ff.stdin.write(np.ascontiguousarray(frame).tobytes())
        if k % 48 == 0:
            print(f"  {t:5.1f}s / {DUR:.0f}s", flush=True)
    ff.stdin.close()
    ff.wait()
    wav.unlink(missing_ok=True)
    print("ecrit :", out_path)
    return real


def last_frame(path):
    path = Path(path)
    out = path.with_name(path.stem + "_derniere_image.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-sseof", "-0.5", "-i", str(path), "-update", "1", "-q:v", "1", str(out)], check=True)
    print("ecrit :", out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=str(ROOT / "nocta" / "montage.json"))
    ap.add_argument("--clips", default=str(CLIPS))
    ap.add_argument("--sortie", default=None)
    ap.add_argument("--apercu", action="store_true", help="fast 540x960 preview")
    ap.add_argument("--extraire-fin", default=None, help="save the last frame of a clip as PNG")
    a = ap.parse_args()
    if a.extraire_fin:
        last_frame(a.extraire_fin)
        return
    cfg = json.loads(Path(a.config).read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    clips = Path(a.clips)
    n_real = sum((clips / (cfg.get("plans", {}).get(sid, {}) or {}).get("fichier", f"shot_{sid}.mp4")).exists()
                 for sid, *_ in SEGMENTS if sid != "09")
    name = "NOCTA_final.mp4" if n_real == len(SEGMENTS) - 1 else "NOCTA_animatic.mp4"
    if a.apercu:
        name = name.replace(".mp4", "_apercu.mp4")
    render(cfg, clips, Path(a.sortie) if a.sortie else OUT / name, a.apercu)


if __name__ == "__main__":
    main()
