"""Original sound-effects library, synthesized from scratch → public/sfx/*.wav

Every effect is generated here (no samples), so there is nothing to license.
Timing-dependent effects (counter ticks, page-scroll ratchet, typing) read the
voiceover timeline so they match the animation.

usage: python3 sfx.py
"""
import json
import os

import numpy as np
import soundfile as sf

from dsp import (SR, mix, auto_pan, bp, env_adsr, exp_env, fade, glide_sine, hp, lp, noise, normalize, reverb, rng, soft_clip,
                 stereo, sweep_filter, t_axis, trim_tail)

OUT = "../public/sfx"
os.makedirs(OUT, exist_ok=True)
VO = json.load(open("../src/data/vo.json"))
W = VO["words"]


def word(line, idx):
    return [w for w in W if w["line"] == line][idx]["start"]


LIB = {}


def sfx(fn):
    LIB[fn.__name__] = fn
    return fn


def save(name, x, peak=-3.0, tail=True):
    if x.ndim == 1:
        x = stereo(x)
    x = fade(x, 0.0005, 0.02)
    if tail:
        x = trim_tail(x)
    sf.write(f"{OUT}/{name}.wav", normalize(x, peak).astype(np.float32), SR, subtype="PCM_16")


# ------------------------------------------------------------------ building blocks
def whoosh(dur, f0, f1, q=2.0, pan=(-0.6, 0.6), shape=(0.55, 0.45), color="pink", body=0.0):
    n = noise(dur, color)
    x = sweep_filter(n, f0, f1, "band", q=q)
    a = int(shape[0] * len(x))
    e = np.concatenate([np.linspace(0, 1, a) ** 2, np.linspace(1, 0, len(x) - a) ** 1.6])
    x = x * e
    if body:
        x += lp(n, 300) * e * body
    return auto_pan(x / (np.abs(x).max() + 1e-9), *pan)


def tclick(dur=0.012, f=3500, decay=0.0025):
    n = int(dur * SR)
    x = noise(dur) * exp_env(n, decay)
    return bp(x, f * 0.6, f * 1.6)


def bell(freqs, dur, decays, amps, attack=0.002):
    tt = t_axis(dur)
    x = np.zeros_like(tt)
    for f, d, a in zip(freqs, decays, amps):
        x += a * np.sin(2 * np.pi * f * tt) * np.exp(-tt / d)
    return x * np.minimum(1, tt / attack)


def boom(dur=1.6, f0=72, f1=32, decay=0.45):
    tt = t_axis(dur)
    x = glide_sine(f0, f1, dur) * np.exp(-tt / decay)
    x += 0.4 * glide_sine(f0 * 2, f1 * 2, dur) * np.exp(-tt / (decay * 0.5))
    return soft_clip(x * 1.6, 1.4)


# ------------------------------------------------------------------ effects
@sfx
def air_open():
    d = 2.6
    x = whoosh(d, 2500, 9000, q=1.2, pan=(-0.3, 0.3), shape=(0.15, 0.85)) * 0.5
    tt = t_axis(d)
    sh = sum(np.sin(2 * np.pi * f * tt + i) * 0.08 for i, f in enumerate([1760, 2217, 2637, 3520]))
    sh *= np.minimum(1, tt / 0.05) * np.exp(-tt / 1.0)
    return reverb(x + stereo(sh, width=0.6, delay_ms=9), 0.5, 2.5)


@sfx
def sparkle():
    d = 1.0
    x = np.zeros((int(d * SR), 2))
    for i in range(9):
        f = rng.uniform(2600, 7200)
        p = bell([f, f * 2.01], 0.5, [0.18, 0.08], [1, 0.3], 0.001)
        i0 = int(i * 0.045 * SR)
        x[i0:i0 + len(p)] += stereo(p[: len(x) - i0], pan=rng.uniform(-0.7, 0.7)) * (1 - i * 0.07)
    return reverb(x, 0.45, 1.6, 9000)


@sfx
def impact_deep():
    d = 2.6
    b = boom(d, 78, 30, 0.6)
    tt = t_axis(d)
    thump = lp(noise(d), 180) * np.exp(-tt / 0.08) * 1.4
    crack = hp(noise(d), 1200) * np.exp(-tt / 0.02) * 0.35
    x = soft_clip(b + thump + crack, 1.2)
    return reverb(stereo(x, width=0.3, delay_ms=6), 0.3, 2.2, 3000)


@sfx
def light_off():
    d = 0.7
    tt = t_axis(d)
    tone = glide_sine(420, 55, d) * np.exp(-tt / 0.25) * 0.6
    hum = np.sin(2 * np.pi * 100 * tt) * np.exp(-tt / 0.15) * 0.3
    clk = np.concatenate([tclick(0.02, 2500, 0.004), np.zeros(int(d * SR) - int(0.02 * SR))])
    return reverb(lp(tone + hum, 2500) + clk * 0.8, 0.2, 1.0)


@sfx
def tick_low():
    return reverb(mix(tclick(0.03, 900, 0.006), 0.5 * bell([620], 0.08, [0.02], [1])), 0.15, 0.6)


@sfx
def whoosh_in():
    return reverb(whoosh(0.55, 250, 4500, q=1.6, pan=(-0.8, 0.5), shape=(0.75, 0.25), body=0.4), 0.18, 1.0)


@sfx
def whoosh_pull():
    return reverb(whoosh(0.85, 3500, 300, q=1.4, pan=(0.4, -0.4), shape=(0.35, 0.65), body=0.5), 0.25, 1.4)


@sfx
def whoosh_soft():
    return reverb(whoosh(0.65, 400, 2200, q=1.0, pan=(-0.5, 0.5), shape=(0.5, 0.5)), 0.25, 1.2) * 0.8


@sfx
def whoosh_up():
    return reverb(whoosh(0.5, 300, 3500, q=1.8, pan=(0.0, 0.2), shape=(0.7, 0.3), body=0.2), 0.2, 1.0)


@sfx
def whoosh_logo():
    return reverb(whoosh(0.7, 500, 3000, q=1.2, pan=(-0.3, 0.3), shape=(0.65, 0.35)), 0.35, 1.8)


@sfx
def whip():
    return reverb(whoosh(0.28, 700, 6000, q=3.0, pan=(0.8, -0.8), shape=(0.6, 0.4)), 0.12, 0.7)


@sfx
def whip_down():
    return reverb(whoosh(0.3, 3000, 400, q=2.5, pan=(0.0, 0.0), shape=(0.5, 0.5), body=0.3), 0.12, 0.7)


@sfx
def zoom_through():
    d = 0.65
    x = whoosh(d, 300, 5000, q=1.6, pan=(-0.2, 0.2), shape=(0.8, 0.2), body=0.3)
    tt = t_axis(d)
    tone = glide_sine(180, 900, d) * np.minimum(1, tt / 0.4) * np.exp(-np.maximum(0, tt - 0.5) / 0.05) * 0.25
    return reverb(x + stereo(tone), 0.2, 1.0)


@sfx
def slide_up():
    return reverb(whoosh(0.45, 600, 2800, q=1.2, pan=(0, 0), shape=(0.5, 0.5)), 0.2, 0.9) * 0.7


@sfx
def typing():
    d = 1.5
    x = np.zeros(int(d * SR))
    t = 0.0
    while t < d - 0.05:
        k = tclick(0.025, rng.uniform(2200, 4200), rng.uniform(0.002, 0.004))
        k += 0.6 * lp(noise(0.025), 600) * exp_env(int(0.025 * SR), 0.006)
        i = int(t * SR)
        x[i:i + len(k)] += k * rng.uniform(0.55, 1.0)
        t += rng.choice([0.06, 0.075, 0.09, 0.11, 0.14])
    return reverb(stereo(x, width=0.4, delay_ms=4), 0.12, 0.6)


@sfx
def pop_soft():
    d = 0.18
    tt = t_axis(d)
    x = glide_sine(900, 260, d) * np.exp(-tt / 0.04)
    return reverb(x, 0.2, 0.8)


def _pop(f0, f1):
    d = 0.16
    tt = t_axis(d)
    x = glide_sine(f0, f1, d) * np.exp(-tt / 0.035)
    c = np.zeros_like(x)
    k = tclick(0.01, 4500, 0.0012)
    c[: len(k)] = k * 0.4
    return reverb(x + c, 0.2, 0.7)


@sfx
def pop1():
    return _pop(780, 320)


@sfx
def pop2():
    return _pop(980, 400)


@sfx
def pop3():
    return _pop(1180, 480)


@sfx
def paper_slide():
    d = 0.45
    n = noise(d)
    x = sweep_filter(n, 1500, 4500, "band", q=0.8) * env_adsr(len(n), 0.05, 0.1, 0.6, 0.25, 0.05)
    crackle = (rng.random(len(n)) > 0.997) * rng.standard_normal(len(n)) * 0.6
    x += hp(crackle, 2000)
    return reverb(auto_pan(x, 0.5, -0.2), 0.15, 0.6)


@sfx
def error_blip():
    d = 0.42
    tt = t_axis(d)
    out = np.zeros_like(tt)
    for k, (f, t0) in enumerate([(240, 0.0), (200, 0.19)]):
        seg = (tt >= t0) & (tt < t0 + 0.15)
        ph = 2 * np.pi * f * (tt - t0)
        sq = np.sign(np.sin(ph)) * 0.5 + np.sin(ph) * 0.5
        out += sq * seg * np.exp(-(tt - t0).clip(0) / 0.12)
    return reverb(lp(out, 2200), 0.15, 0.6)


@sfx
def stamp():
    d = 0.6
    tt = t_axis(d)
    thump = np.sin(2 * np.pi * 105 * tt) * np.exp(-tt / 0.07) * 1.2
    slap = hp(noise(d), 700) * np.exp(-tt / 0.018)
    rattle = bp(noise(d), 300, 1200) * np.exp(-np.maximum(0, tt - 0.03) / 0.03) * (tt > 0.03) * 0.3
    x = soft_clip(thump + slap + rattle, 1.3)
    return reverb(stereo(x), 0.2, 0.8, 4000)


@sfx
def stamp_soft():
    return stamp() * 0.7


@sfx
def page_turn():
    d = 0.55
    n = noise(d)
    x = sweep_filter(n, 900, 5000, "band", q=0.9) * env_adsr(len(n), 0.12, 0.15, 0.5, 0.25, 0.05)
    crk = (rng.random(len(n)) > 0.994) * rng.standard_normal(len(n))
    x += hp(crk, 2500) * 0.5 * env_adsr(len(n), 0.05, 0.2, 0.4, 0.2, 0.1)
    return reverb(auto_pan(x, 0.6, -0.6), 0.15, 0.7)


@sfx
def skip():
    a = whoosh(0.22, 800, 3500, q=2.0, pan=(-0.5, 0.6), shape=(0.5, 0.5))
    return reverb(a, 0.15, 0.6)


@sfx
def bonk():
    d = 0.45
    tt = t_axis(d)
    f = 560 * (0.5 ** (np.minimum(tt, 0.08) / 0.08))
    ph = 2 * np.pi * np.cumsum(f) / SR
    wood = (np.sin(ph) + 0.35 * np.sin(2.7 * ph) + 0.15 * np.sin(5.1 * ph)) * np.exp(-tt / 0.09)
    boing = np.sin(2 * np.pi * 180 * tt + 6 * np.sin(2 * np.pi * 11 * tt)) * np.exp(-tt / 0.18) * 0.35 * (tt > 0.04)
    hit = bp(noise(d), 800, 3000) * np.exp(-tt / 0.006) * 0.6
    return reverb(stereo(wood + boing + hit), 0.18, 0.6)


@sfx
def scroll_fast():
    k0, k1 = word(6, 2) - 0.05, word(6, 7)
    d = k1 - k0 + 0.25
    x = np.zeros(int(d * SR))
    # one ratchet tick per page, pages follow the same curve as the on-screen counter (x^2.2)
    for p in range(1, 50):
        u = (p / 49) ** (1 / 2.2)
        tt = u * (k1 - k0)
        k = tclick(0.015, 2800 + p * 20, 0.0018)
        i = int(tt * SR)
        x[i:i + len(k)] += k * (0.5 + 0.5 * (1 - p / 49))
    bed = whoosh(d, 600, 3000, q=1.0, pan=(0, 0), shape=(0.9, 0.1))[:, 0] * 0.35
    return reverb(stereo(x + bed[: len(x)], width=0.3, delay_ms=5), 0.12, 0.6)


@sfx
def thud_muffled():
    d = 0.9
    tt = t_axis(d)
    x = boom(d, 90, 40, 0.18) + lp(noise(d), 250) * np.exp(-tt / 0.05)
    return reverb(lp(x, 400), 0.2, 0.9, 1500)


@sfx
def sweep():
    d = 0.75
    x = whoosh(d, 1500, 9000, q=1.0, pan=(-0.8, 0.8), shape=(0.4, 0.6)) * 0.7
    tt = t_axis(d)
    gl = sum(np.sin(2 * np.pi * np.cumsum(f * (1 + 0.6 * tt / d)) / SR) * a for f, a in [(1320, 0.2), (1980, 0.14), (2640, 0.1)])
    gl = gl * np.minimum(1, tt / 0.1) * np.exp(-tt / 0.4)
    return reverb(x + stereo(gl, width=0.5, delay_ms=8), 0.4, 1.8, 9000)


@sfx
def impact_bright():
    d = 2.0
    tt = t_axis(d)
    b = boom(d, 95, 45, 0.25) * 0.9
    crash = hp(noise(d, "white"), 4500) * np.exp(-tt / 0.7) * 0.25
    snap = bp(noise(d), 1500, 6000) * np.exp(-tt / 0.012) * 0.6
    return reverb(stereo(b + snap) + stereo(crash, width=0.7, delay_ms=11), 0.25, 2.0, 7000)


@sfx
def glint():
    tone = bell([3520, 5280, 7040], 0.9, [0.3, 0.15, 0.08], [0.6, 0.3, 0.15], 0.001)
    tt = t_axis(0.9)
    sh = sum(np.sin(2 * np.pi * (4200 + 900 * i) * tt * (1 + 0.04 * tt)) * 0.05 for i in range(4)) * np.exp(-tt / 0.25)
    return reverb(stereo(tone + sh, width=0.5, delay_ms=7), 0.4, 1.6, 10000)


@sfx
def shimmer():
    d = 1.3
    x = np.zeros((int(d * SR), 2))
    base = [1568, 1976, 2349, 2794, 3136, 3951, 4699]
    for i, f in enumerate(base):
        p = bell([f, f * 2], 0.9, [0.35, 0.12], [1, 0.25], 0.004)
        i0 = int(i * 0.06 * SR)
        x[i0:i0 + len(p)] += stereo(p[: len(x) - i0], pan=-0.6 + 1.2 * i / len(base)) * 0.6
    return reverb(x, 0.5, 2.0, 10000)


@sfx
def upload():
    d = 1.3
    tt = t_axis(d)
    x = glide_sine(300, 600, d) * 0.3 + glide_sine(450, 900, d) * 0.15
    x *= env_adsr(len(tt), 0.2, 0.2, 0.7, 0.4, 0.5)
    return reverb(lp(x, 3000), 0.3, 1.2)


@sfx
def card_flip():
    d = 0.16
    tt = t_axis(d)
    x = bp(noise(d), 1500, 7000) * np.exp(-tt / 0.02) + lp(noise(d), 500) * np.exp(-tt / 0.01) * 0.5
    return reverb(x, 0.12, 0.5)


@sfx
def chime_success():
    d = 1.6
    x = np.zeros((int(d * SR), 2))
    for i, f in enumerate([1046.5, 1318.5, 1568.0, 2093.0]):
        p = bell([f, f * 2.0, f * 3.0], 1.2, [0.5, 0.2, 0.08], [1, 0.25, 0.08], 0.003)
        i0 = int(i * 0.07 * SR)
        x[i0:i0 + len(p)] += stereo(p[: len(x) - i0], pan=-0.3 + 0.2 * i)
    return reverb(x, 0.4, 1.8, 9000)


@sfx
def snap_lines():
    d = 0.9
    x = np.zeros(int(d * SR))
    for i in range(14):
        tt = 0.75 * (i / 13) ** 0.7
        k = tclick(0.012, 3000 + i * 120, 0.0015)
        x[int(tt * SR):int(tt * SR) + len(k)] += k * 0.8
    return reverb(stereo(x, width=0.3, delay_ms=4), 0.15, 0.6)


@sfx
def tick_soft():
    return reverb(mix(tclick(0.02, 2400, 0.003), 0.4 * bell([1800], 0.06, [0.015], [1])), 0.15, 0.5)


@sfx
def hover():
    d = 0.12
    tt = t_axis(d)
    return reverb(np.sin(2 * np.pi * 1400 * tt) * np.exp(-tt / 0.03) * 0.5, 0.2, 0.6)


@sfx
def rocket():
    d = 0.8
    x = whoosh(d, 400, 7000, q=1.8, pan=(-0.2, 0.3), shape=(0.75, 0.25), body=0.3)
    tt = t_axis(d)
    tone = glide_sine(220, 1400, d) * np.minimum(1, tt / 0.3) * np.exp(-np.maximum(0, tt - 0.6) / 0.06) * 0.3
    return reverb(x + stereo(tone), 0.25, 1.2)


def mouse_click():
    d = 0.06
    a = tclick(0.01, 3800, 0.0012)
    b = tclick(0.01, 2600, 0.0015)
    x = np.zeros(int(d * SR))
    x[: len(a)] += a
    x[int(0.035 * SR):int(0.035 * SR) + len(b)] += b * 0.7
    return reverb(x, 0.1, 0.4)


LIB["click"] = mouse_click


@sfx
def cha_ching():
    d = 1.8
    tt = t_axis(d)
    cha = bp(noise(d), 2000, 8000) * np.exp(-tt / 0.03) * 0.8
    rattle = bp(noise(d), 3000, 9000) * (np.sin(2 * np.pi * 38 * tt) > 0.2) * np.exp(-tt / 0.06) * 0.4
    ching = np.zeros_like(tt)
    t0 = 0.11
    tc = np.maximum(0, tt - t0)
    for f, dc, a in [(2093, 0.9, 1.0), (3136, 0.6, 0.6), (4186, 0.4, 0.4), (5274, 0.3, 0.25), (6272, 0.2, 0.15)]:
        ching += a * np.sin(2 * np.pi * f * tc) * np.exp(-tc / dc) * (tt > t0)
    ching *= 0.55
    return reverb(stereo(cha + rattle) + stereo(ching, width=0.5, delay_ms=9), 0.35, 1.6, 10000)


@sfx
def ripple():
    d = 0.9
    tt = t_axis(d)
    x = glide_sine(70, 140, d) * env_adsr(len(tt), 0.25, 0.3, 0.4, 0.3, 0.05) * 0.8
    x += sweep_filter(noise(d, "pink"), 200, 2500, "band", q=1.0) * env_adsr(len(tt), 0.35, 0.2, 0.3, 0.3, 0.05) * 0.6
    return reverb(stereo(x, width=0.4, delay_ms=10), 0.35, 1.8)


@sfx
def ticks_roll():
    start = word(13, 0) + 0.1
    land = word(13, 3) + 0.3
    dur = land - start
    x = np.zeros(int((dur + 0.2) * SR))
    # counter value v(u) = 1-(1-u)^3; tick every 25 books
    for k in range(1, 40):
        v = k / 40
        u = 1 - (1 - v) ** (1 / 3)
        tt = u * dur
        a = mix(bell([2600 + (k % 3) * 180], 0.04, [0.012], [1]), tclick(0.02, 3200, 0.002) * 0.6)
        i = int(tt * SR)
        x[i:i + len(a)] += a[: max(0, len(x) - i)] * 0.85
    return reverb(stereo(x, width=0.3, delay_ms=5), 0.18, 0.7)


@sfx
def light_burn():
    d = 1.0
    x = whoosh(d, 600, 6000, q=0.9, pan=(-0.4, 0.4), shape=(0.55, 0.45)) * 0.6
    tt = t_axis(d)
    pad = sum(np.sin(2 * np.pi * f * tt) for f in [587, 740, 880]) * env_adsr(len(tt), 0.4, 0.2, 0.5, 0.4, 0.0) * 0.08
    return reverb(x + stereo(pad, width=0.5, delay_ms=12), 0.5, 2.2, 8000)


@sfx
def pen_write():
    d = 1.3
    n = noise(d)
    x = bp(n, 2500, 7000)
    tt = t_axis(d)
    strokes = np.clip(np.sin(2 * np.pi * 3.2 * tt) * 0.6 + np.sin(2 * np.pi * 7.3 * tt) * 0.4, 0, 1)
    x *= strokes * env_adsr(len(tt), 0.05, 0.1, 0.9, 0.2, 1.0)
    return reverb(stereo(x * 0.6), 0.12, 0.5)


@sfx
def box_open():
    d = 0.9
    tt = t_axis(d)
    rustle = bp(noise(d), 300, 2500) * env_adsr(len(tt), 0.05, 0.2, 0.5, 0.4, 0.2)
    creak = np.sin(2 * np.pi * np.cumsum(140 + 40 * np.sin(2 * np.pi * 3 * tt)) / SR) * env_adsr(len(tt), 0.1, 0.3, 0.3, 0.3, 0.1) * 0.15
    flap = lp(noise(d), 400) * np.exp(-np.maximum(0, tt - 0.5) / 0.04) * (tt > 0.5) * 0.8
    return reverb(stereo(rustle * 0.7 + creak + flap), 0.2, 0.9)


@sfx
def send():
    a = whoosh(0.32, 900, 4500, q=2.0, pan=(-0.2, 0.5), shape=(0.6, 0.4))
    p = _pop(1100, 600)
    out = np.zeros((max(len(a), int(0.22 * SR) + len(p)), 2))
    out[: len(a)] += a
    out[int(0.22 * SR):int(0.22 * SR) + len(p)] += p * 0.6
    return reverb(out, 0.15, 0.7)


@sfx
def riser_short():
    d = 1.4
    tt = t_axis(d)
    x = sweep_filter(noise(d, "pink"), 400, 5000, "band", q=1.2) * (tt / d) ** 2 * 0.8
    x += glide_sine(160, 320, d) * (tt / d) ** 2 * 0.15
    return reverb(stereo(x, width=0.4, delay_ms=8), 0.3, 1.5)


if __name__ == "__main__":
    for name, fn in LIB.items():
        x = fn()
        save(name, np.asarray(x))
    print(len(LIB), "sfx written:", " ".join(sorted(LIB)))
