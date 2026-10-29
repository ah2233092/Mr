"""Synthesize the voiceover with Kokoro (offline) and write build/vo_raw.wav + build/vo_lines.json.

usage: MODELS=<dir with kokoro-v1.0.onnx, voices-v1.0.bin> python3 tts.py [voice_spec]
voice_spec: a Kokoro voice name, or a blend like "am_michael:0.7,am_fenrir:0.3"
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

from script import LINES, LEAD_IN, TAIL

MODELS = os.environ.get("MODELS", "models")
SPEC = sys.argv[1] if len(sys.argv) > 1 else "am_michael:0.7,am_fenrir:0.3"
OUT = os.environ.get("OUT", "../build")
SPEED_SCALE = float(os.environ.get("SPEED", "1.08"))

os.makedirs(OUT, exist_ok=True)
k = Kokoro(f"{MODELS}/kokoro-v1.0.onnx", f"{MODELS}/voices-v1.0.bin")


def voice(spec):
    if ":" not in spec and "," not in spec:
        return spec
    style = None
    for part in spec.split(","):
        name, w = part.split(":")
        v = k.get_voice_style(name) * float(w)
        style = v if style is None else style + v
    return style


def trim(a, sr, thr=0.006, pad_in=0.02, pad_out=0.06):
    idx = np.where(np.abs(a) > thr)[0]
    if len(idx) == 0:
        return a
    s = max(0, idx[0] - int(pad_in * sr))
    e = min(len(a), idx[-1] + int(pad_out * sr))
    return a[s:e]


style = voice(SPEC)
sr = 24000
chunks = [np.zeros(int(LEAD_IN * sr), np.float32)]
t = LEAD_IN
lines = []
for i, (scene, caption, text, pause, speed) in enumerate(LINES):
    a, sr = k.create(text, voice=style, speed=speed * SPEED_SCALE, lang="en-us")
    a = trim(a.astype(np.float32), sr)
    d = len(a) / sr
    lines.append({"i": i, "scene": scene, "text": caption, "start": round(t, 3), "end": round(t + d, 3)})
    chunks.append(a)
    t += d
    gap = pause if i < len(LINES) - 1 else TAIL
    chunks.append(np.zeros(int(gap * sr), np.float32))
    t += gap
    print(f"{i:2d} {d:5.2f}s  {caption}")

vo = np.concatenate(chunks)
vo = vo / max(1e-6, np.abs(vo).max()) * 0.89
sf.write(f"{OUT}/vo_raw.wav", vo, sr, subtype="PCM_24")
json.dump({"voice": SPEC, "duration": round(t, 3), "lines": lines}, open(f"{OUT}/vo_lines.json", "w"), indent=1, ensure_ascii=False)
words = sum(len(c.split()) for _, c, *_ in LINES)
print(f"total {t:.2f}s, {words} words, {words / (t - TAIL - LEAD_IN) * 60:.0f} wpm overall")
