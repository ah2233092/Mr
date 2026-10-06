"""Build the edit decision list: tighten long pauses in the raw take and
map every word onto the new timeline.  -> build/edl.json"""
import json, os
import numpy as np, soundfile as sf

a, sr = sf.read("analysis/raw16k.wav")
words = json.load(open("analysis/raw_words.json"))
FIX = {"other": "authors'", "is@3.6": "are", "merchants": "margins", "own": "on", "Fully": "Full",
       "Amal,": "Ahmad,", "word.": "words.", "sale.": "sell.", "best.": "bestseller.", "a@25.36": "the"}
for w in words:
    w["w"] = FIX.get(f'{w["w"]}@{w["t"]}', FIX.get(w["w"], w["w"]))

# silence detection (20 ms frames, -42 dBFS)
f = int(0.02 * sr)
db = np.array([20 * np.log10(np.sqrt(np.mean(a[i:i + f] ** 2)) + 1e-9) for i in range(0, len(a) - f, f)])
sil, st = [], None
for i, v in enumerate(db):
    if v < -42 and st is None: st = i
    if v >= -42 and st is not None:
        sil.append((st * .02, i * .02)); st = None
DUR = len(a) / sr
PAD = 0.13                                   # breathing room kept on each side of a cut
DRAMATIC = {24.36: 0.5}                      # longer beat before "But here's the good news"
keep, cur = [], 0.30                         # start just before "Most"
for s, e in sil:
    if s < 0.6: continue
    L = e - s
    if L < 0.40: continue
    gap = DRAMATIC.get(round(s, 2), 2 * PAD)
    keep.append([cur, s + gap / 2]); cur = e - gap / 2
keep.append([cur, DUR])

out_t, segs = 0.0, []
for s, e in keep:
    segs.append({"src": [round(s, 3), round(e, 3)], "dst": [round(out_t, 3), round(out_t + e - s, 3)]})
    out_t += e - s

def remap(t):
    for g in segs:
        if g["src"][0] - 1e-6 <= t <= g["src"][1] + 1e-6:
            return round(g["dst"][0] + t - g["src"][0], 3)
    return None
for w in words:
    w["T"] = remap(w["t"])
os.makedirs("build", exist_ok=True)
json.dump({"segments": segs, "words": words, "duration": round(out_t, 3)}, open("build/edl.json", "w"), indent=1)
print(len(segs), "segments; new duration", round(out_t, 2), "s (raw", round(DUR, 2), ")")
print(" ".join(f'{w["w"]}@{w["T"]}' for w in words))
