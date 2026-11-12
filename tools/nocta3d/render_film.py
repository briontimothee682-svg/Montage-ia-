"""Render every animated shot of the NOCTA film (with 0.125 s handles for the transitions), encode
one clip per shot into nocta/clips_anim/, ready for tools/nocta/assemble.py.

    python3 tools/nocta3d/render_film.py render 01 02 08     # render frames of these shots
    python3 tools/nocta3d/render_film.py encode               # encode all rendered shots to clips
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FRAMES = ROOT / "exports" / "nocta3d_frames"
CLIPS = ROOT / "nocta" / "clips_anim"
FPS = 24
HANDLE = 0.125
DROP = 11.5
BAR = (41.0 - DROP) / 16
bar = lambda n: DROP + n * BAR
SHOTS = {
    "01": (0.0, 6.0), "02": (6.0, 11.0), "03a": (11.0, bar(1)), "03b": (bar(1), bar(2)), "04": (bar(2), bar(5)),
    "05": (bar(5), bar(7)), "06": (bar(7), bar(9.5)), "07": (bar(9.5), bar(13.5)), "08": (bar(13.5), 41.0),
}


def span(sid):
    a, b = SHOTS[sid]
    return max(0.0, a - HANDLE), b + HANDLE


def render(ids, w=1080, h=1920):
    for sid in ids:
        t0, t1 = span(sid)
        out = FRAMES / sid
        print(f"render {sid}: {t0:.3f} -> {t1:.3f}", flush=True)
        subprocess.run(["node", str(HERE / "render.js"), "shot", sid, f"{t0}", f"{t1}", str(out), str(FPS), str(w), str(h)], check=True)


def encode():
    CLIPS.mkdir(parents=True, exist_ok=True)
    for sid in SHOTS:
        d = FRAMES / sid
        files = sorted(d.glob("f*.png")) if d.exists() else []
        if not files:
            print("missing", sid)
            continue
        first = int(files[0].stem[1:])
        out = CLIPS / f"shot_{sid}.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-start_number", str(first), "-i", str(d / "f%05d.png"),
                        "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p", str(out)], check=True)
        print("encoded", out.name, len(files), "frames")


if __name__ == "__main__":
    if sys.argv[1] == "render":
        render(sys.argv[2:])
    else:
        encode()
