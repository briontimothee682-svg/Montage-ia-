"""Photoreal keyframes for the realistic NOCTA version, generated for free with the HiDream-I1-Dev Space on
Hugging Face (API-backed Space: no account, no GPU quota).

    python3 tools/nocta_ia/keyframes.py nocta/ia/plan.json            # every shot whose keyframe is missing
    python3 tools/nocta_ia/keyframes.py nocta/ia/plan.json k08 --seed 5   # redo one keyframe with another seed
"""
import argparse
import json
import time
from pathlib import Path

import numpy as np
from gradio_client import Client
from PIL import Image

SPACE = "https://hidream-ai-hidream-i1-dev.hf.space"
ROOT = Path(__file__).resolve().parents[2]


def generate(client, prompt, out, seed, ar="3:4"):
    for attempt in range(3):
        try:
            r = client.predict(prompt, ar, seed, api_name="/generate_with_status")
            path = r[0] if isinstance(r[0], str) else r[0].get("path")
            im = Image.open(path).convert("RGB")
            a = np.asarray(im.convert("L"), dtype=float)
            white = [i for i in range(a.shape[0]) if a[i].mean() > 245 and a[i].std() < 4]
            if white:                      # the Space pads some aspect ratios with white rows
                im = im.crop((0, 0, im.width, white[0]))
            out.parent.mkdir(parents=True, exist_ok=True)
            im.save(out, quality=95)
            print(json.dumps({"out": str(out.relative_to(ROOT)), "size": im.size}), flush=True)
            return True
        except Exception as e:  # queue full / transient Space errors
            print("retry", attempt, str(e)[:200], flush=True)
            time.sleep(20)
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("plan")
    ap.add_argument("only", nargs="*")
    ap.add_argument("--seed", type=int)
    a = ap.parse_args()
    plan = json.load(open(a.plan))
    style, cast = plan["style"], plan["cast"]
    client = Client(SPACE, verbose=False)
    for kf in plan["keyframes"]:
        if a.only and kf["id"] not in a.only:
            continue
        out = ROOT / plan["keyframe_dir"] / f"{kf['id']}.jpg"
        if out.exists() and not a.only:
            continue
        prompt = kf["prompt"].replace("{cast}", cast) + " " + style
        generate(client, prompt, out, a.seed if a.seed is not None else kf.get("seed", 11))


if __name__ == "__main__":
    main()
