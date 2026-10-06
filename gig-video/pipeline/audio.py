"""Voice edit + polish, original score (two moods), sound design, ducking, loudness.
usage: python3 audio.py <graphics cues.json>  -> build/mix.wav"""
import json, subprocess, sys
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
SH = json.load(open("pipeline/shots.json"))
EDL = json.load(open("build/edl.json"))
WORDS = EDL["words"]
TOTAL = SH["total"]
N = int(TOTAL * SR)
rng = np.random.default_rng(7)

# ------------------------------------------------------------------ voice
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "src/raw.mov", "-vn", "-ac", "1", "-ar", str(SR), "build/raw48.wav"], check=True)
raw, _ = sf.read("build/raw48.wav")
parts, xf = [], int(0.015 * SR)
for g in EDL["segments"]:
    c = raw[int(g["src"][0] * SR):int(g["src"][1] * SR)].copy()
    c[:xf] *= np.linspace(0, 1, xf); c[-xf:] *= np.linspace(1, 0, xf)
    parts.append(c)
v = np.concatenate(parts)
voice = np.zeros(N); voice[:min(N, len(v))] = v[:N]
sf.write("build/voice_cut.wav", voice, SR)
chain = ("highpass=f=78,afftdn=nf=-62:nr=8,equalizer=f=220:t=q:w=1.1:g=-2.5,equalizer=f=3600:t=q:w=0.9:g=2.6,"
         "equalizer=f=120:t=q:w=0.8:g=1.5,treble=g=2.2:f=9500,deesser=i=0.35,"
         "acompressor=threshold=0.07:ratio=3.2:attack=6:release=110:makeup=2.2:knee=4,"
         "acompressor=threshold=0.25:ratio=6:attack=1:release=40:makeup=1")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "build/voice_cut.wav", "-af", chain, "build/voice_fx.wav"], check=True)
voice, _ = sf.read("build/voice_fx.wav")
voice = voice[:N] if len(voice) >= N else np.pad(voice, (0, N - len(voice)))


# ------------------------------------------------------------------ helpers
def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x, axis=0)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x, axis=0)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], "band", fs=SR, output="sos"), x, axis=0)
def midi(m): return 440 * 2 ** ((m - 69) / 12)


def add(buf, sig, t, g=1.0, pan=0.0):
    i = int(t * SR)
    if sig.ndim == 1:
        sig = np.stack([sig * np.cos((pan + 1) * np.pi / 4), sig * np.sin((pan + 1) * np.pi / 4)], 1) * np.sqrt(2)
    if i < 0: sig, i = sig[-i:], 0
    n = min(len(sig), len(buf) - i)
    if n > 0: buf[i:i + n] += sig[:n] * g


def ir(sec=2.6, damp=5200):
    n = int(sec * SR); t = np.arange(n) / SR
    out = np.stack([lp(rng.standard_normal(n), damp) * np.exp(-t * 3.2), lp(rng.standard_normal(n), damp) * np.exp(-t * 3.0)], 1)
    out[: int(0.012 * SR)] = 0
    return out / np.sqrt((out ** 2).sum(0))


IR = ir()


def reverb(x, wet=0.35):
    y = np.stack([fftconvolve(x[:, c], IR[:, c])[: len(x)] for c in range(2)], 1)
    return x * (1 - wet) + y * wet * 2.2


def piano(f, dur=3.0, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    for k in range(1, 10):
        fk = f * k * np.sqrt(1 + 0.00035 * k * k)
        if fk > SR / 2.2: break
        s += np.sin(2 * np.pi * fk * t + rng.uniform(0, 6)) * (1 / k ** 1.15) * np.exp(-t * (0.9 + 0.55 * k) * (0.6 + f / 900))
    s += lp(rng.standard_normal(n), 3000) * np.exp(-t * 90) * 0.15
    s *= np.minimum(1, t / 0.003) * np.minimum(1, (dur - t) / 0.08)
    return s * vel * 0.32


def pad(notes, dur, bright=1400, att=1.2):
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for m in notes:
        f = midi(m)
        for ch, det in ((0, -0.004), (1, 0.004)):
            for d2 in (0, 0.0021):
                w = np.zeros(n)
                for k in range(1, 14):
                    if f * k > 8000: break
                    w += np.sin(2 * np.pi * f * (1 + det + d2) * k * t + rng.uniform(0, 6)) / k
                out[:, ch] += w
    out = lp(out, bright)
    env = np.minimum(1, t / att) * np.minimum(1, (dur - t) / 1.4).clip(0)
    return out * env[:, None] * 0.018


def sub(f, dur=0.5):
    t = np.arange(int(dur * SR)) / SR
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 4.5) * np.minimum(1, t / 0.006)


def kick():
    t = np.arange(int(0.45 * SR)) / SR
    return np.sin(2 * np.pi * np.cumsum(42 + 90 * np.exp(-t * 30)) / SR) * np.exp(-t * 8)


def clap():
    t = np.arange(int(0.3 * SR)) / SR
    e = sum(np.exp(-np.clip(t - d, 0, None) * 60) * (t >= d) for d in (0, 0.011, 0.023))
    return bp(rng.standard_normal(len(t)), 900, 5000) * (e * 0.5 + np.exp(-t * 18) * 0.35)


def shaker():
    t = np.arange(int(0.09 * SR)) / SR
    return hp(rng.standard_normal(len(t)), 6500) * np.sin(np.pi * np.clip(t / 0.09, 0, 1)) ** 2


def tick_clock():
    t = np.arange(int(0.03 * SR)) / SR
    return hp(rng.standard_normal(len(t)), 4000) * np.exp(-t * 260) + np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 300) * 0.4


# ------------------------------------------------------------------ score
music = np.zeros((N, 2))
GN = SH["good_news"]
# act 1: tension in A minor, 92 bpm, downbeat on "And there are three"
B1, T1 = 60 / 92, 1.81
# opening swell + impact under the first word
add(music, pad([45, 52, 57], 2.4, 700, 0.15), 0.0, 1.3)
prog1 = [[45, 52, 57, 60], [41, 48, 53, 57], [38, 45, 50, 53], [40, 47, 52, 56]]     # Am F Dm E
roots1 = [33, 29, 26, 28]
bar, t = 0, T1
while t < GN - 0.05:
    ch = prog1[bar % 4]
    add(music, pad(ch, 4 * B1 + 1.2, 1100 + 120 * min(bar, 5), 0.6), t, 1.0)
    for q in range(8):                                   # pulsing 8th-note sub ostinato
        tq = t + q * B1 / 2
        if tq >= GN - 0.3: break
        add(music, lp(sub(midi(roots1[bar % 4] + 12), B1 / 2), 220), tq, 0.11 + 0.012 * min(bar, 5))
    for q in range(16):                                   # clock tick
        tq = t + q * B1 / 4
        if tq >= GN - 0.6: break
        add(music, tick_clock(), tq, 0.035 if q % 4 else 0.06, pan=0.35)
    motif = [(0, 69), (1.5, 72), (2.5, 76), (3, 74)] if bar % 2 == 0 else [(0, 67), (1.5, 69), (2.5, 72)]
    for off, m in motif:
        if t + off * B1 < GN - 0.4:
            add(music, piano(midi(m), 2.4, 0.55), t + off * B1, 1.0, pan=-0.2)
    bar += 1; t += 4 * B1
# act 2: lift in C major, 96 bpm, downbeat on "good"
B2, T2 = 60 / 96, WORDS[58]["T"]
prog2 = [[48, 55, 60, 64], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]]    # C G Am F
roots2 = [36, 31, 33, 29]
add(music, pad([48, 55, 60, 64, 67], 3.0, 2400, 0.25), T2 - 0.15, 1.3)            # warm bloom
add(music, piano(midi(72), 4, 0.8), T2, 1.0); add(music, piano(midi(76), 4, 0.6), T2 + 0.02, 1.0)
bar, t = 0, T2
END = SH["end"]
while t < END + 0.2:
    ch = prog2[bar % 4]
    add(music, pad(ch, 4 * B2 + 1.2, 2200, 0.5), t, 1.0)
    arp = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12]
    for e in range(8):
        te = t + e * B2 / 2
        if te > END: break
        add(music, piano(midi(arp[e % 4]), 1.6, 0.42 + 0.06 * (e % 2 == 0)), te, 1.0, pan=0.25 if e % 2 else -0.25)
    full = t >= 26.0
    for q in range(4):
        tq = t + q * B2
        if tq > END - 0.1: break
        add(music, lp(sub(midi(roots2[bar % 4] + 12), B2 * 0.95), 300), tq, 0.10 if full else 0.05)
        if full:
            if q in (0, 2): add(music, kick(), tq, 0.20)
            if q in (1, 3): add(music, clap(), tq, 0.045)
        for s8 in (0, .5):
            add(music, shaker(), tq + s8 * B2, 0.022 if full else 0.012, pan=0.4)
    bar += 1; t += 4 * B2
# finale: resolve on the end card
add(music, pad([36, 48, 55, 60, 64, 67, 72], 4.2, 2600, 0.05), END + 0.05, 1.6)
for k, m in enumerate([60, 64, 67, 72, 76]):
    add(music, piano(midi(m), 4.0, 0.55), END + 0.9 + k * 0.16, 1.0, pan=-0.3 + k * 0.15)
music = reverb(music, 0.32)
music = hp(music, 35)

# ------------------------------------------------------------------ sound design
def whoosh(d=0.6, up=True):
    n = int(d * SR); t = np.arange(n) / SR; x = rng.standard_normal(n)
    m = np.sin(np.pi * t / d) ** 2
    s = bp(x, 200, 1100) * (1 - m) + bp(x, 1400, 7000) * m * 0.8
    s *= np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2.2
    pan = np.linspace(-0.7, 0.7, n) if up else np.linspace(0.7, -0.7, n)
    return np.stack([s * np.cos((pan + 1) * np.pi / 4), s * np.sin((pan + 1) * np.pi / 4)], 1) * 1.4


def impact(big=1.0):
    t = np.arange(int(2.2 * SR)) / SR
    boom = np.sin(2 * np.pi * np.cumsum(30 + 70 * np.exp(-t * 14)) / SR) * np.exp(-t * 2.6)
    crack = lp(rng.standard_normal(len(t)), 3500) * np.exp(-t * 22) * 0.6
    return (boom + crack) * big


def tick():
    t = np.arange(int(0.05 * SR)) / SR
    return np.sin(2 * np.pi * 1750 * t) * np.exp(-t * 120) * 0.6 + np.sin(2 * np.pi * 3500 * t) * np.exp(-t * 200) * 0.3


def ding():
    t = np.arange(int(1.4 * SR)) / SR
    return sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in ((1568, 1, 4), (3136, .35, 7), (4704, .15, 10)))


def shimmer(d=1.4):
    t = np.arange(int(d * SR)) / SR
    s = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) for f in (2093, 2637, 3136, 4186))
    return s * np.minimum(1, t / 0.25) * np.exp(-t * 2.2) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * t)) * 0.18


def riser(d=1.6):
    t = np.arange(int(d * SR)) / SR
    f = 180 + 1400 * (t / d) ** 2.5
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25 + hp(rng.standard_normal(len(t)), 1500) * 0.35
    return s * (t / d) ** 2.4


def key_click():
    t = np.arange(int(0.025 * SR)) / SR
    return hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 300)


sfx = np.zeros((N, 2))
add(sfx, impact(0.9), WORDS[0]["T"] - 0.02, 0.32)                       # cold open
for t0 in (3.57, 8.75, 13.57, 15.57, 26.17, 28.97, 32.87, 34.73, 38.69):
    add(sfx, whoosh(0.55, up=True), t0 - 0.30, 0.20)
add(sfx, impact(0.8), WORDS[9]["T"] - 0.15, 0.26)                       # big "3"
add(sfx, impact(0.7), WORDS[42]["T"] - 0.25, 0.22)                      # "03"
add(sfx, riser(1.5), GN - 1.5, 0.24)                                    # into the good news
add(sfx, shimmer(1.6), GN + 0.05, 0.5)
add(sfx, impact(0.6), WORDS[64]["T"] - 0.15, 0.16)                      # "Ahmad"
for k in range(7):                                                      # typing "my book"
    add(sfx, key_click(), WORDS[29]["T"] + k / 14, 0.18, pan=-0.3)
add(sfx, riser(1.1), WORDS[120]["T"] - 1.1, 0.22)
add(sfx, impact(1.0), WORDS[120]["T"] - 0.04, 0.36)                     # Bestseller
add(sfx, shimmer(2.0), WORDS[120]["T"], 0.6)
add(sfx, whoosh(0.9, up=False), END + 0.45, 0.12)
SFX = {"tick": (tick(), 0.16), "ding": (ding(), 0.07), "hit": (impact(0.5), 0.2), "shimmer": (shimmer(), 0.35)}
last = {}
for c in sorted(json.load(open(sys.argv[1])), key=lambda c: c["t"]):
    if c["type"] not in SFX or c["t"] - last.get(c["type"], -9) < 0.12: continue
    last[c["type"]] = c["t"]
    s, g = SFX[c["type"]]
    add(sfx, s, c["t"], g, pan=rng.uniform(-0.2, 0.2))
sfx = reverb(sfx, 0.18)

# ------------------------------------------------------------------ mix
env = np.convolve(np.abs(voice), np.ones(int(0.2 * SR)) / int(0.2 * SR), mode="same")
act = np.convolve((env > 0.012).astype(float), np.ones(int(0.25 * SR)) / int(0.25 * SR), mode="same").clip(0, 1)
duck = 1 - 0.42 * act
fade = np.clip((TOTAL - np.arange(N) / SR) / 1.2, 0, 1)
mix = np.stack([voice, voice], 1) * 1.0 + music * (duck * fade)[:, None] * 0.62 + sfx * fade[:, None]
mix /= np.abs(mix).max() / 0.9
sf.write("build/mix_pre.wav", mix.astype(np.float32), SR, subtype="FLOAT")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "build/mix_pre.wav", "-af",
                "loudnorm=I=-14:TP=-1.2:LRA=9:print_format=summary", "-ar", str(SR), "build/mix.wav"], check=True)
for name, x in (("voice", voice), ("music", music.mean(1) * 0.62 * duck), ("sfx", sfx.mean(1))):
    print(name, "rms dB", round(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9), 1))
print("mix ok", TOTAL)
