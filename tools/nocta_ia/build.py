"""Build the realistic NOCTA film from nocta/ia/plan.json:
  1. scenery clips: photoreal still + camera move (still_motion.py), made locally
  2. human clips: Wan 2.2 clips from animate.py; a clip not generated yet falls back to a slow camera move
     on its keyframe, so a complete film always exists (re-run once the clip arrives)
  3. every clip is brought to 24 fps (motion-compensated interpolation) and the shots are written to
     nocta/clips_ia/shot_XX.mp4, then assembled with tools/nocta/assemble.py (music, notification, flyer).

    python3 tools/nocta_ia/build.py
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PLAN = ROOT / "nocta" / "ia" / "plan.json"
SHOTS_DIR = ROOT / "nocta" / "clips_ia"
WORK = ROOT / "exports" / "nocta_ia_work"

# which clips make each shot of the film (in order)
SHOTS = {"01": ["c01", "c01b"], "02": ["c02"], "03a": ["c03a"], "03b": ["c03b"], "04": ["c04"],
         "05": ["c05"], "06": ["c06"], "07": ["c07a", "c07b", "c07c"], "08": ["c08"]}
# fallback camera move for a human clip that Wan has not generated yet
FALLBACK = ["--zoom", "1.0", "1.1", "--ease", "inout", "--blur", "3", "--shake", "3"]


def run(cmd):
    print("  $", " ".join(str(c) for c in cmd[:4]), "...", flush=True)
    subprocess.run([str(c) for c in cmd], check=True)


def duration(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                       capture_output=True, text=True)
    return float(r.stdout.strip())


def trim(src, dst, seconds):
    run(["ffmpeg", "-v", "error", "-y", "-i", src, "-t", f"{seconds:.3f}", "-an", "-c:v", "libx264", "-preset", "slow",
         "-crf", "14", "-pix_fmt", "yuv420p", dst])


def to24(src, dst, speed=1.0):
    """1080x1920 at 24 fps, slowed down by `speed` (<1 = slow motion); Wan's 16 fps frames get
    motion-compensated in-between frames so the slow motion stays fluid."""
    run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf",
         f"setpts=PTS/{speed},scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,unsharp=5:5:0.6:5:5:0.0,"
         "minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,setsar=1",
         "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", dst])


def main():
    plan = json.load(open(PLAN))
    clips = {c["id"]: c for c in plan["clips"]}
    kdir, cdir = ROOT / plan["keyframe_dir"], ROOT / plan["clip_dir"]
    WORK.mkdir(parents=True, exist_ok=True)
    SHOTS_DIR.mkdir(parents=True, exist_ok=True)
    status = {}
    for sid, ids in SHOTS.items():
        parts = []
        for cid in ids:
            c = clips[cid]
            img = kdir / f"{c['keyframe']}.jpg"
            out = WORK / f"{cid}.mp4"
            if c["engine"] == "still":
                if not out.exists():
                    run([sys.executable, HERE / "still_motion.py", img, out, *c["motion"]])
                status[cid] = "mouvement camera (photo)"
            else:
                wan = cdir / f"{cid}.mp4"
                if wan.exists():
                    if not out.exists() or out.stat().st_mtime < wan.stat().st_mtime:
                        to24(wan, out, c.get("speed", 1.0))
                    status[cid] = "Wan 2.2 (mouvement reel)"
                else:
                    fb = WORK / f"{cid}_photo.mp4"
                    if not fb.exists():
                        dur = c.get("take") or c.get("seconds", 3.5) / c.get("speed", 1.0)
                        run([sys.executable, HERE / "still_motion.py", img, fb, *c.get("fallback", FALLBACK),
                             "--dur", f"{dur:.2f}", "--crop_x", str(c.get("crop_x", 0.5))])
                    out = fb
                    status[cid] = "EN ATTENTE de Wan -> photo animee provisoire"
            if c.get("take"):        # keep only the part that lands on the beat grid (see plan.json)
                cut = WORK / f"{cid}_take.mp4"
                trim(out, cut, c["take"])
                out = cut
            parts.append(out)
        dst = SHOTS_DIR / f"shot_{sid}.mp4"
        if len(parts) == 1:
            run(["ffmpeg", "-v", "error", "-y", "-i", parts[0], "-c", "copy", dst])
        else:
            lst = WORK / f"shot_{sid}.txt"
            lst.write_text("".join(f"file '{p}'\n" for p in parts))
            run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:v", "libx264",
                 "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", dst])
        print(f"shot {sid}: {duration(dst):.2f} s", flush=True)
    print(json.dumps(status, indent=1, ensure_ascii=False))
    run([sys.executable, ROOT / "tools" / "nocta" / "assemble.py", "--config", ROOT / "nocta" / "montage_ia.json",
         "--clips", SHOTS_DIR, "--sortie", ROOT / "exports" / "nocta" / "NOCTA_realiste.mp4"])


if __name__ == "__main__":
    main()
