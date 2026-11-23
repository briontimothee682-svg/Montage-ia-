"""Animate keyframes into real human motion with Wan 2.2 (image -> video) on the free Hugging Face ZeroGPU
Space. Each clip costs about 1 minute of GPU; a free Hugging Face account gets 5 minutes per day, so the
script does the clips in the plan's priority order and simply stops when the daily quota is used up —
run it again the next day and it continues where it stopped.

The Hugging Face token is never in the code: in this cloud session the network proxy adds it to requests
to the Space. Elsewhere, set HF_TOKEN.

    python3 tools/nocta_ia/animate.py nocta/ia/plan.json          # next missing clips, by priority
    python3 tools/nocta_ia/animate.py nocta/ia/plan.json s08      # (re)do one clip
"""
import argparse
import json
import os
import shutil
import time
from pathlib import Path

from gradio_client import Client, handle_file
from PIL import Image

SPACE = "https://zerogpu-aoti-wan2-2-fp8da-aoti-faster.hf.space"
ROOT = Path(__file__).resolve().parents[2]
NEG = ("blurry, distorted face, face changing, deformed hands, extra fingers, fused fingers, cartoon, 3d render, cgi, "
       "plastic skin, static frame, text, subtitles, watermark, logo, jpeg artifacts, flicker, morphing, warped car")


def prep(img, tmp, crop_x=0.5):
    """9:16 crop of the keyframe, the format of the final film (crop_x: 0 = left edge, 0.5 = centre)."""
    im = Image.open(img).convert("RGB")
    w, h = im.size
    cw = min(w, round(h * 9 / 16))
    x0 = round((w - cw) * crop_x)
    im.crop((x0, 0, x0 + cw, round(cw * 16 / 9))).resize((576, 1024), Image.LANCZOS).save(tmp, quality=95)
    return tmp


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("plan")
    ap.add_argument("only", nargs="*")
    a = ap.parse_args()
    plan = json.load(open(a.plan))
    token = os.environ.get("HF_TOKEN")
    client = Client(SPACE, token=token, verbose=False)
    if not token:   # let the proxy's injected token through untouched
        client.headers.pop("x-hf-authorization", None)
    clips = sorted((c for c in plan["clips"] if c["engine"] == "wan"), key=lambda c: c.get("priority", 99))
    for c in clips:
        if a.only and c["id"] not in a.only:
            continue
        out = ROOT / plan["clip_dir"] / f"{c['id']}.mp4"
        if out.exists() and not a.only:
            continue
        img = prep(ROOT / plan["keyframe_dir"] / f"{c['keyframe']}.jpg", f"/tmp/wan_in_{c['id']}.jpg", c.get("crop_x", 0.5))
        t = time.time()
        try:
            r = client.predict(handle_file(img), c["prompt"], c.get("steps", 4), NEG, c.get("seconds", 3.5),
                               1, 1, c.get("seed", 42), False, api_name="/generate_video")
        except Exception as e:
            msg = str(e)
            print(json.dumps({"clip": c["id"], "error": msg[:300]}), flush=True)
            if "quota" in msg.lower() or "limit" in msg.lower():
                print("Quota GPU du jour epuise : relance demain, le script reprendra ici.", flush=True)
                return
            continue
        v = r[0] if isinstance(r[0], str) else (r[0].get("video") or r[0].get("path"))
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(v, out)
        print(json.dumps({"clip": c["id"], "out": str(out.relative_to(ROOT)), "sec": round(time.time() - t, 1)}), flush=True)


if __name__ == "__main__":
    main()
