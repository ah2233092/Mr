"""Word-level timestamps for the voiceover.

Runs Parakeet (sherpa-onnx) on each line of the processed voiceover and maps the
recognized tokens back onto the exact script words, so captions keep the script's
spelling ("KDP", "1,000", "A+") while timing comes from the audio.

usage: MODELS=<dir> python3 align.py  -> src/data/vo.json
"""
import difflib
import json
import os
import re

import numpy as np
import sherpa_onnx
import soundfile as sf
from scipy.signal import resample_poly

M = os.environ.get("MODELS", "models")
P = f"{M}/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8"
rec = sherpa_onnx.OfflineRecognizer.from_transducer(
    encoder=f"{P}/encoder.int8.onnx", decoder=f"{P}/decoder.int8.onnx", joiner=f"{P}/joiner.int8.onnx",
    tokens=f"{P}/tokens.txt", model_type="nemo_transducer", num_threads=4)

meta = json.load(open("../build/vo_lines.json"))
audio, sr = sf.read("../public/audio/vo.wav", dtype="float32")
SPOKEN = {"kdp": ["k", "d", "p", "kdp"], "1,000": ["1000", "one", "thousand", "1,000"], "a+": ["a", "aplus", "plus"],
          "fiverr": ["fiverr", "fiver"], "fifty": ["50", "fifty"]}


def norm(w):
    return re.sub(r"[^a-z0-9+,']", "", w.lower()).strip(",")


def asr_words(seg):
    a16 = resample_poly(seg, 1, 3).astype(np.float32)  # 48k -> 16k
    pad = np.zeros(int(0.3 * 16000), np.float32)
    st = rec.create_stream()
    st.accept_waveform(16000, np.concatenate([pad, a16, pad]))
    rec.decode_stream(st)
    r = st.result
    out, cur, t0 = [], "", None
    for tok, ts in zip(r.tokens, r.timestamps):
        ts -= 0.3
        if tok.startswith("▁") or tok.startswith(" ") or cur == "":
            if cur:
                out.append((cur, t0))
            cur, t0 = tok.lstrip("▁ "), ts
        else:
            cur += tok
    if cur:
        out.append((cur, t0))
    return [(norm(w), max(0.0, t)) for w, t in out if norm(w)]


def voiced_end(seg, start_s, sr):
    """Last voiced sample after start_s (seconds into seg)."""
    env = np.convolve(np.abs(seg), np.ones(480) / 480, "same")
    idx = np.where(env > 0.01)[0]
    return idx[-1] / sr if len(idx) else len(seg) / sr


words_out = []
for ln in meta["lines"]:
    s, e = int(ln["start"] * sr), int(ln["end"] * sr)
    seg = audio[s:e]
    rec_words = asr_words(seg)
    script = ln["text"].split()
    keys = [norm(w) for w in script]
    # expand script words into the forms ASR may produce
    flat, owner = [], []
    for wi, kk in enumerate(keys):
        forms = SPOKEN.get(kk, [kk])
        flat.append(forms[-1] if kk in SPOKEN else kk)
        owner.append(wi)
    rec_keys = [w for w, _ in rec_words]
    # map tokens like "1,000" / "kdp" to script slots, only for terms this line contains
    line_aliases = {k: f for k, f in SPOKEN.items() if k in keys}
    rk2 = []
    for w in rec_keys:
        hit = next((k for k, forms in line_aliases.items() if w in forms), None)
        rk2.append(line_aliases[hit][-1] if hit else w)
    sm = difflib.SequenceMatcher(a=flat, b=rk2, autojunk=False)
    times = [None] * len(script)
    for a0, b0, n in sm.get_matching_blocks():
        for j in range(n):
            wi = owner[a0 + j]
            if times[wi] is None:
                times[wi] = rec_words[b0 + j][1]
    # fill gaps by interpolation weighted by word length
    known = [i for i, t in enumerate(times) if t is not None]
    if not known:
        raise SystemExit(f"no alignment for line {ln['i']}")
    if times[0] is None:
        times[0] = 0.0
    seg_end = voiced_end(seg, 0, sr)
    for i in range(len(times)):
        if times[i] is None:
            prev = max(j for j in range(i) if times[j] is not None)
            nxt = next((j for j in range(i + 1, len(times)) if times[j] is not None), None)
            t_next = times[nxt] if nxt is not None else seg_end
            n_next = nxt if nxt is not None else len(times)
            lens = [len(keys[j]) + 1 for j in range(prev, n_next)]
            frac = sum(lens[: i - prev]) / sum(lens)
            times[i] = times[prev] + (t_next - times[prev]) * frac
    missing = len(script) - len(known)
    for i, w in enumerate(script):
        st = ln["start"] + times[i]
        en = ln["start"] + (times[i + 1] if i + 1 < len(script) else seg_end)
        words_out.append({"w": w, "line": ln["i"], "start": round(st, 3), "end": round(min(en, ln["end"]), 3)})
    print(f"{ln['i']:2d} matched {len(known)}/{len(script)}  asr: {' '.join(rec_keys)}")

os.makedirs("../src/data", exist_ok=True)
out = {"duration": meta["duration"], "voice": meta["voice"], "lines": meta["lines"], "words": words_out}
json.dump(out, open("../src/data/vo.json", "w"), indent=1, ensure_ascii=False)
print("words:", len(words_out))
