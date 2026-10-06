"""Synthesize background music + sound effects and mix them under the voiceover.

usage: python3 audio.py <cues.json>   -> build/mix.wav
"""
import json
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfilt

SR = 44100
rng = np.random.default_rng(3)
tl = json.load(open("build/timeline.json"))
cues = json.load(open(sys.argv[1]))
DUR = tl["duration"]
N = int(DUR * SR)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x, axis=0)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x, axis=0)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)


def add(buf, sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= len(buf) or i + len(sig) <= 0:
        return
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], 1) * np.sqrt(2)
    s0 = max(0, -i)
    sig = sig[s0:]
    i = max(0, i)
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n] * gain


# ---------------------------------------------------------------- music
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
# Am - F - C - G, two bars each (inspiring minor-to-major loop)
PROG = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62])]

music = np.zeros((N, 2))


def pad_note(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.9) * np.minimum(1, (dur - t) / 1.1).clip(0)
    out = np.zeros((n, 2))
    for k, det in enumerate((-0.0035, 0.0, 0.0035)):
        for h in range(1, 7):
            ph = rng.uniform(0, 2 * np.pi)
            w = np.sin(2 * np.pi * f * (1 + det) * h * t + ph) / h ** 1.4
            out[:, k % 2] += w
            out[:, (k + 1) % 2] += w * 0.6
    return out * env[:, None] * 0.05


def pluck(f, dur=0.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * h * t) * np.exp(-t * (6 + 5 * h)) / h for h in range(1, 5))
    return s * np.minimum(1, t / 0.004)


def kick():
    t = np.arange(int(0.35 * SR)) / SR
    f = 45 + 85 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def snare():
    t = np.arange(int(0.22 * SR)) / SR
    return bp(rng.standard_normal(len(t)), 900, 6000) * np.exp(-t * 20) * 0.6 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.3


def hat():
    t = np.arange(int(0.06 * SR)) / SR
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * 70)


KICK, SNARE, HAT = kick(), snare(), hat()
beat_start = tl["scenes"][0]["lines"][1]["start"]          # drums enter on "Jawab hai — haan!"
quiet = [(s["start"], s["end"]) for s in tl["scenes"] if s["id"] == "reality"]  # breakdown section

bar_i, t = 0, 0.0
while t < DUR:
    root, chord = PROG[(bar_i // 2) % 4]
    if bar_i % 2 == 0:
        for n_ in chord:
            add(music, pad_note(midi(n_), 2 * BAR + 0.8), t, 1.0)
    in_quiet = any(a <= t < b for a, b in quiet)
    for b in range(4):
        tb = t + b * BEAT
        # bass
        bt = np.arange(int(BEAT * 0.9 * SR)) / SR
        bass = (np.sin(2 * np.pi * midi(root - 12) * bt) + 0.3 * np.sin(4 * np.pi * midi(root - 12) * bt)) * np.exp(-bt * 2.5) * np.minimum(1, bt / 0.01)
        if tb >= beat_start and not in_quiet:
            add(music, bass, tb, 0.16)
            if b in (0, 2):
                add(music, KICK, tb, 0.33)
            if b in (1, 3):
                add(music, SNARE, tb, 0.07)
            for e in (0, 0.5):
                add(music, HAT, tb + e * BEAT, 0.035 if e else 0.02, pan=0.3)
        # arpeggio, 8th notes
        for e in range(2):
            idx = (b * 2 + e) % 4
            note = (chord + [chord[1] + 12])[idx] + 12
            add(music, pluck(midi(note)), tb + e * BEAT / 2, 0.09 if not in_quiet else 0.06, pan=(-0.4 if e == 0 else 0.4))
    t += BAR
    bar_i += 1

music = lp(music, 9000)
# fades
fi = np.minimum(1, np.arange(N) / (1.5 * SR))
fo = np.clip((DUR - np.arange(N) / SR) / 3.5, 0, 1)
music *= (fi * fo)[:, None]

# ---------------------------------------------------------------- voice + ducking
v, vsr = sf.read("build/voice.wav")
v = resample_poly(v, SR, vsr)[:N]
voice = np.zeros(N)
voice[:len(v)] = v
env = np.abs(voice)
win = int(0.25 * SR)
env = np.convolve(env, np.ones(win) / win, mode="same")
active = (env > 0.01).astype(float)
k = int(0.3 * SR)
active = np.convolve(active, np.ones(k) / k, mode="same").clip(0, 1)
duck = 1 - 0.5 * active                      # ~ -6 dB while talking
music *= duck[:, None]

# ---------------------------------------------------------------- sfx


def whoosh(d=0.7):
    n = int(d * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    m = np.sin(np.pi * t / d) ** 2               # sweep: low band -> high band -> low band
    out = bp(x, 250, 1200) * (1 - m) + bp(x, 1500, 6500) * m * 0.8
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    s = out * env
    pan = np.linspace(-0.8, 0.8, n)
    return np.stack([s * np.cos((pan + 1) * np.pi / 4), s * np.sin((pan + 1) * np.pi / 4)], 1) * 1.4


def pop():
    t = np.arange(int(0.09 * SR)) / SR
    f = 520 + 600 * t / 0.09
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 45)


def ding():
    t = np.arange(int(1.0 * SR)) / SR
    return sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * dcy) for f, a, dcy in ((1318.5, 1, 5), (2637, .4, 8), (3956, .2, 12)))


def hit():
    t = np.arange(int(0.6 * SR)) / SR
    f = 38 + 90 * np.exp(-t * 18)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5)
    return boom + lp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 25) * 0.5


def click():
    t = np.arange(int(0.03 * SR)) / SR
    return np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 200) + hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 300) * 0.5


def riser(d=0.9):
    t = np.arange(int(d * SR)) / SR
    f = 200 + 900 * (t / d) ** 2
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4 + hp(rng.standard_normal(len(t)), 2000) * 0.3) * (t / d) ** 2


SFX = {"whoosh": (whoosh(), 0.22), "pop": (pop(), 0.10), "ding": (ding(), 0.07),
       "hit": (hit(), 0.38), "click": (click(), 0.25), "riser": (riser(), 0.18)}
sfx = np.zeros((N, 2))
last = {}
for c in sorted(cues, key=lambda c: c["t"]):
    sig, g = SFX[c["type"]]
    if c["t"] - last.get(c["type"], -9) < 0.12:     # avoid machine-gun stacking
        continue
    last[c["type"]] = c["t"]
    add(sfx, sig, max(0, c["t"]), g, pan=rng.uniform(-0.25, 0.25) if sig.ndim == 1 else 0)

MUSIC_GAIN = 0.35
mix = voice[:, None] * 1.0 + music * MUSIC_GAIN + sfx
if "--stems" in sys.argv:
    for name, x in (("voice", voice), ("music", music.mean(1) * MUSIC_GAIN), ("sfx", sfx.mean(1))):
        print(name, "rms dB (speech span):", round(20 * np.log10(np.sqrt(np.mean(x[int(2 * SR):int(240 * SR)] ** 2)) + 1e-9), 1))
mix /= np.abs(mix).max() / 0.95
sf.write("build/mix.wav", mix.astype(np.float32), SR, subtype="FLOAT")
print("mix ok", round(DUR, 2), "s; cues", len(cues))
