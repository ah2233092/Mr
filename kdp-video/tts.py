"""Generate the voiceover track and the timeline every visual is synced to."""
import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

from script import SCENES

MODELS = sys.argv[1] if len(sys.argv) > 1 else "models"
VOICE = os.environ.get("VOICE", "hm_omega")
SPEED = float(os.environ.get("SPEED", "1.0"))

LEAD_IN = 0.8      # silence before the first line
LINE_GAP = 0.35    # pause between lines inside a scene
SCENE_GAP = 0.9    # pause across a scene transition
TAIL = 3.0         # music-only ending after the last line

os.makedirs("build", exist_ok=True)
k = Kokoro(f"{MODELS}/kokoro-v1.0.onnx", f"{MODELS}/voices-v1.0.bin")


def trim(a, sr, thr=0.01, pad=0.04):
    idx = np.where(np.abs(a) > thr)[0]
    if len(idx) == 0:
        return a
    s = max(0, idx[0] - int(pad * sr))
    e = min(len(a), idx[-1] + int(pad * sr))
    return a[s:e]


chunks, timeline, t, sr = [], {"scenes": []}, LEAD_IN, 24000
chunks.append(np.zeros(int(LEAD_IN * sr), dtype=np.float32))
for si, (sid, lines) in enumerate(SCENES):
    scene = {"id": sid, "start": t - (LEAD_IN if si == 0 else SCENE_GAP / 2), "lines": []}
    for li, (hi, roman) in enumerate(lines):
        a, sr = k.create(hi, voice=VOICE, speed=SPEED, lang="hi")
        a = trim(a.astype(np.float32), sr)
        d = len(a) / sr
        scene["lines"].append({"start": round(t, 3), "end": round(t + d, 3), "text": roman})
        chunks.append(a)
        t += d
        last_line = li == len(lines) - 1
        gap = LINE_GAP if not last_line else (SCENE_GAP if si < len(SCENES) - 1 else TAIL)
        chunks.append(np.zeros(int(gap * sr), dtype=np.float32))
        t += gap
        print(f"{sid}[{li}] {d:5.2f}s")
    timeline["scenes"].append(scene)

# scene end = next scene start (mid-gap), so transitions land between lines
for a, b in zip(timeline["scenes"], timeline["scenes"][1:]):
    a["end"] = round(b["start"], 3)
timeline["scenes"][-1]["end"] = round(t, 3)
for s in timeline["scenes"]:
    s["start"] = round(s["start"], 3)
timeline["duration"] = round(t, 3)

voice = np.concatenate(chunks)
voice = voice / max(1e-6, np.abs(voice).max()) * 0.89
sf.write("build/voice.wav", voice, sr)
with open("build/timeline.json", "w") as f:
    json.dump(timeline, f, indent=1, ensure_ascii=False)
print("total", round(t, 2), "s")
