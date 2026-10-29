"""Original score, composed to the voiceover timeline → public/audio/music.wav

Structure (all times come from timeline.py, i.e. the voice):
  0 → "never"        dark D-minor pad, celesta glints, low pulse, soft ticking
  "never"            hard stop (silence under the impact)
  twist → freeze     tension: drone, heartbeat, clock ticks; staccato ostinato + timpani from the problems on
  freeze → drop      silence (the freeze frame)
  drop (on "So")     uplifting D major, 104 BPM: piano arps, bass, kick/clap/shaker, harp, glockenspiel hook
  bar 13 (close)     emotional swell: strings + choir carry the hook, drums thin out
  bar 19 (end card)  final hit on the logo, then ring-out

Melodic/harmonic parts are rendered with FluidSynth + MuseScore_General (MIT), drums and
textures are synthesized. The music is then side-chain ducked under the voiceover.

usage: python3 music.py
"""
import os
import subprocess
import tempfile

import mido
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

from dsp import SR, bp, env_adsr, exp_env, glide_sine, hp, lp, mix, noise, place, reverb, rng, soft_clip, stereo, t_axis
from timeline import (BAR, BEAT, CLOSE, DROP, DURATION, FREEZE, HIT, P_KEYWORDS, PROBLEMS, T_NEVER, TWIST, beat_time)

SF = os.environ.get("SOUNDFONT", "/usr/share/sounds/sf3/MuseScore_General.sf3")
N = int((DURATION + 0.5) * SR)
TMP = tempfile.mkdtemp(prefix="kai_music_")


# ------------------------------------------------------------------ MIDI rendering
def render(notes, program, name, gain=1.0):
    """notes: list of (start_s, dur_s, midi, velocity). Rendered on a 104 BPM MIDI clock from t=0."""
    tpb = 960
    mid = mido.MidiFile(ticks_per_beat=tpb)
    tr = mido.MidiTrack()
    mid.tracks.append(tr)
    tr.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(104)))
    tr.append(mido.Message("program_change", channel=0, program=program, time=0))
    tr.append(mido.Message("control_change", channel=0, control=7, value=110, time=0))
    ev = []
    for s, d, n, v in notes:
        if s < 0:
            continue
        ev.append((s, 1, n, int(np.clip(v, 1, 127))))
        ev.append((s + d, 0, n, 0))
    ev.sort(key=lambda e: (e[0], e[1]))
    last = 0
    for s, on, n, v in ev:
        tick = int(round(s / BEAT * tpb))
        tr.append(mido.Message("note_on" if on else "note_off", channel=0, note=n, velocity=v, time=max(0, tick - last)))
        last = max(last, tick)
    midp = os.path.join(TMP, f"{name}.mid")
    wavp = os.path.join(TMP, f"{name}.wav")
    mid.save(midp)
    subprocess.run(["fluidsynth", "-ni", "-q", "-R", "0", "-C", "0", "-g", "0.6", "-r", str(SR), "-F", wavp, SF, midp],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    x, sr = sf.read(wavp)
    if sr != SR:
        x = resample_poly(x, SR, sr, axis=0)
    out = np.zeros((N, 2))
    n = min(N, len(x))
    out[:n] = x[:n]
    return out * gain


def hum(v, amt=6):
    return v + rng.integers(-amt, amt + 1)


def bar_t(b, beat=0.0):
    """Start time of (1-based) bar b of the uplifting section, plus `beat` beats."""
    return DROP + ((b - 1) * 4 + beat) * BEAT


# ------------------------------------------------------------------ harmony
# uplifting progression, one chord per bar (bar 19 = final hit)
PROG = {1: "D", 2: "A", 3: "Bm", 4: "G", 5: "D", 6: "A", 7: "Bm", 8: "G", 9: "D", 10: "A", 11: "Bm", 12: "G",
        13: "Bm", 14: "G", 15: "D", 16: "A", 17: "G", 18: "A", 19: "D"}
CHORD = {  # bass root, mid voicing, arp tones (high)
    "D": (38, [50, 54, 57, 62], [62, 66, 69, 74, 78]),
    "A": (33, [49, 52, 57, 61], [61, 64, 69, 73, 76]),
    "Bm": (35, [47, 50, 54, 59], [62, 66, 71, 74, 78]),
    "G": (31, [47, 50, 55, 59], [62, 67, 71, 74, 79]),
}
HOOK = [  # (bar offset in 4-bar phrase, beat, beats, note) — the main melody
    (0, 0, 1, 78), (0, 1, 1, 81), (0, 2, 2, 86),
    (1, 0, 1, 85), (1, 1, 0.5, 83), (1, 1.5, 0.5, 81), (1, 2, 2, 76),
    (2, 0, 1, 86), (2, 1, 1, 85), (2, 2, 1, 83), (2, 3, 1, 78),
    (3, 0, 1, 79), (3, 1, 1, 81), (3, 2, 2, 83),
]


def compose():
    st = {k: [] for k in ["piano", "strings", "strings_lo", "pad", "harp", "glock", "celesta", "choir", "bass", "timp", "ostinato"]}

    # ---------------- intro (0 → never): Dm(add9) pad, celesta glints
    for n in [38, 45, 50, 53, 57, 64]:
        st["pad"].append((0.0, T_NEVER + 0.3, n, 62))
        st["strings_lo"].append((0.0, T_NEVER + 0.3, n - 12 if n < 46 else n, 48))
    for i, (tt, n) in enumerate([(0.35, 81), (0.85, 77), (1.17, 86), (1.32, 88), (1.75, 76), (2.35, 74)]):
        st["celesta"].append((tt, 1.2, n, 70 if i != 2 else 88))

    # ---------------- tension (twist → freeze)
    k0 = int(np.ceil((TWIST - DROP) / BEAT))
    k1 = int(np.floor((FREEZE - DROP) / BEAT))
    drone_end = FREEZE + 0.2
    for n, v in [(26, 70), (38, 64), (45, 58)]:
        st["strings_lo"].append((TWIST, drone_end - TWIST, n, v))
    for n in [50, 53, 57]:
        st["pad"].append((TWIST, drone_end - TWIST, n, 54))
    # ostinato: staccato 8ths from the problems on, rising intensity
    pattern = [50, 50, 53, 50, 52, 50, 48, 50]
    kp = int(np.ceil((PROBLEMS - DROP) / BEAT))
    for k in range(kp * 2, k1 * 2):
        tt = DROP + k * BEAT / 2
        if tt >= FREEZE - 0.05:
            break
        u = (tt - PROBLEMS) / (FREEZE - PROBLEMS)
        n = pattern[k % 8]
        st["ostinato"].append((tt, BEAT * 0.32, n, hum(70 + 40 * u)))
        if tt >= P_KEYWORDS:
            st["ostinato"].append((tt, BEAT * 0.3, n + 12, hum(50 + 40 * u)))
    for k in range(kp, k1 + 1, 4):
        st["timp"].append((beat_time(k), 1.0, 38, 96))
    st["timp"].append((beat_time(k1 - 1), 0.5, 38, 110))

    # ---------------- uplifting (drop → hit)
    for b in range(1, 19):
        c = PROG[b]
        root, voicing, arp = CHORD[c]
        t0 = bar_t(b)
        swell = 13 <= b <= 16
        # piano: 8th arpeggio + left-hand octaves
        if not (13 <= b <= 14):
            seq = [arp[0], arp[2], arp[3], arp[1], arp[2], arp[3], arp[4], arp[2]]
            for i, n in enumerate(seq):
                st["piano"].append((t0 + i * BEAT / 2, BEAT * 0.9, n, hum(66 if i % 2 == 0 else 54)))
        else:
            for i, n in enumerate(voicing + [arp[1] + 12]):
                st["piano"].append((t0 + i * 0.06, BAR * 0.95, n, hum(70)))
        st["piano"].append((t0, BAR * 0.5, root + 12, hum(74)))
        st["piano"].append((t0 + 2 * BEAT, BAR * 0.5, root + 24, hum(62)))
        # warm pad every bar
        for n in voicing:
            st["pad"].append((t0, BAR, n, 50 if b < 9 else 58))
        # bass: pulsing 8ths (long notes in the breath bars)
        if 13 <= b <= 14:
            st["bass"].append((t0, BAR * 0.98, root, 92))
        else:
            for i in range(8):
                st["bass"].append((t0 + i * BEAT / 2, BEAT * 0.42, root, hum(88 if i % 2 == 0 else 70)))
        # harp plucks from bar 5
        if b >= 5 and not (13 <= b <= 14):
            for i, off in enumerate([0, 0.75, 1.5, 2, 2.75, 3.5]):
                st["harp"].append((t0 + off * BEAT, BEAT, arp[(i * 2) % 5] + 12, hum(58)))
        # glockenspiel hook bars 5-8
        if 5 <= b <= 8:
            for (bo, bt, ln, n) in HOOK:
                if bo == (b - 5):
                    st["glock"].append((t0 + bt * BEAT, ln * BEAT, n, hum(72)))
        # strings: sustained from bar 9, carrying the hook in the swell
        if b >= 9:
            for n in voicing:
                st["strings"].append((t0, BAR, n + 12, 62 + (18 if swell else 0)))
            st["strings_lo"].append((t0, BAR, root, 70 + (16 if swell else 0)))
        if 13 <= b <= 16:
            for (bo, bt, ln, n) in HOOK:
                if bo == (b - 13):
                    st["strings"].append((t0 + bt * BEAT, ln * BEAT * 1.05, n - 12, hum(96)))
            for n in voicing:
                st["choir"].append((t0, BAR, n + 12, 70))
        if 9 <= b <= 12:
            for (bo, bt, ln, n) in HOOK:
                if bo == (b - 9):
                    st["piano"].append((t0 + bt * BEAT, ln * BEAT, n, hum(72)))
    # final hit: big D major on bar 19
    for n in [26, 38, 50, 54, 57, 62, 66, 69, 74]:
        st["strings"].append((HIT, 2.6, n + (12 if n > 60 else 0), 100))
        st["piano"].append((HIT, 2.6, n, 92))
        st["choir"].append((HIT, 2.4, n + 12 if n > 45 else n + 24, 80))
    st["bass"].append((HIT, 2.4, 38, 105))
    st["timp"].append((HIT, 2.0, 38, 120))
    st["glock"].append((HIT, 1.5, 86, 90))
    return st


PROGRAMS = {"piano": 0, "strings": 48, "strings_lo": 49, "pad": 89, "harp": 46, "glock": 9, "celesta": 8, "choir": 52,
            "bass": 33, "timp": 47, "ostinato": 48}


# ------------------------------------------------------------------ synthesized drums & textures
def kick(v=1.0):
    d = 0.5
    tt = t_axis(d)
    x = glide_sine(140, 46, 0.12)
    x = np.concatenate([x, np.sin(2 * np.pi * 46 * tt[: len(tt) - len(x)] + 0.0)])
    x *= np.exp(-tt / 0.22)
    x += hp(noise(d), 2500) * np.exp(-tt / 0.004) * 0.3
    return soft_clip(x * 1.4, 1.2) * v


def clap(v=1.0):
    d = 0.4
    tt = t_axis(d)
    x = np.zeros_like(tt)
    for off in [0.0, 0.011, 0.022]:
        i = int(off * SR)
        nn = bp(noise(d), 900, 4500) * np.exp(-tt / 0.008)
        x[i:] += nn[: len(x) - i]
    x += bp(noise(d), 900, 3500) * np.exp(-np.maximum(0, tt - 0.03) / 0.09) * (tt > 0.03) * 0.5
    return reverb(stereo(x * v, width=0.3, delay_ms=7), 0.3, 1.2)


def shaker(v=1.0):
    d = 0.09
    tt = t_axis(d)
    x = hp(noise(d), 5000) * env_adsr(len(tt), 0.012, 0.06, 0, 0.01) * v
    return x


def hat(v=1.0):
    d = 0.06
    tt = t_axis(d)
    return hp(noise(d), 7000) * np.exp(-tt / 0.012) * v


def tick(v=1.0, f=1900):
    d = 0.05
    tt = t_axis(d)
    return (bp(noise(d), f * 0.7, f * 1.4) * np.exp(-tt / 0.004) + np.sin(2 * np.pi * f * 0.7 * tt) * np.exp(-tt / 0.01) * 0.4) * v


def heartbeat(v=1.0):
    d = 0.5
    tt = t_axis(d)
    beat = lambda t0, a: np.sin(2 * np.pi * 52 * np.maximum(0, tt - t0)) * np.exp(-np.maximum(0, tt - t0) / 0.07) * (tt >= t0) * a
    return lp(beat(0, 1) + beat(0.16, 0.7), 200) * v


def drums_and_textures():
    out = np.zeros((N, 2))
    # intro low pulse + soft ticks
    k = int(np.ceil((0.0 - DROP) / BEAT))
    while beat_time(k) < T_NEVER - 0.05:
        tt = beat_time(k)
        if tt >= 0:
            place(out, heartbeat(0.35), tt)
            place(out, stereo(tick(0.10)), tt + BEAT / 2)
        k += 1
    # tension: clock ticks every beat (tick/tock), heartbeat, 16th ticks near the end
    k = int(np.ceil((TWIST - DROP) / BEAT))
    while beat_time(k) < FREEZE - 0.02:
        tt = beat_time(k)
        u = (tt - TWIST) / (FREEZE - TWIST)
        place(out, stereo(tick(0.22 + 0.1 * u, 2100 if k % 2 else 1600), pan=-0.3 if k % 2 else 0.3), tt)
        if tt >= PROBLEMS or k % 2 == 0:
            place(out, heartbeat(0.5 + 0.35 * u), tt)
        if tt >= P_KEYWORDS:
            for s in (0.25, 0.5, 0.75):
                if tt + s * BEAT < FREEZE - 0.02:
                    place(out, stereo(hat(0.12 + 0.12 * u)), tt + s * BEAT)
        k += 1
    # uplifting drums
    for b in range(1, 19):
        t0 = bar_t(b)
        breath = 13 <= b <= 14
        for bt in range(4):
            tt = t0 + bt * BEAT
            if bt in (0, 2) or (b >= 9 and not breath):
                place(out, stereo(kick(0.9 if bt in (0, 2) else 0.6)), tt)
            if not breath and b >= 3 and bt in (1, 3):
                place(out, clap(0.6 if b >= 5 else 0.4), tt)
            if not breath:
                for s in range(4 if b >= 5 else 2):
                    place(out, stereo(shaker(0.28 if s % 2 == 0 else 0.18), pan=0.35), tt + s * BEAT / (4 if b >= 5 else 2))
                if b >= 5:
                    place(out, stereo(hat(0.2), pan=-0.3), tt + BEAT / 2)
        if b == 18:  # snare/clap roll building into the hit
            for i in range(16):
                place(out, clap(0.15 + 0.5 * i / 15), t0 + i * BEAT / 4)
    # final hit: boom + crash
    tt = t_axis(3.0)
    boom = soft_clip(glide_sine(80, 34, 3.0) * np.exp(-tt / 0.7) * 1.5, 1.3)
    crash = hp(noise(3.0), 4000) * np.exp(-tt / 1.1) * 0.35
    place(out, reverb(stereo(boom) + stereo(crash, width=0.8, delay_ms=12), 0.3, 2.5, 6000), HIT)
    place(out, stereo(kick(1.0)), HIT)
    return out


def riser(t_end, dur):
    tt = t_axis(dur)
    from dsp import sweep_filter
    x = sweep_filter(noise(dur, "pink"), 300, 6000, "band", q=1.0) * (tt / dur) ** 2.2
    out = np.zeros((N, 2))
    place(out, stereo(x * 0.5, width=0.5, delay_ms=9), t_end - dur)
    return out


def gate(x, cuts):
    """Hard stops: zero the signal in each (start, end) window with short ramps (tails are cut too)."""
    g = np.ones(N)
    for a, b in cuts:
        ia, ib = int(a * SR), int(b * SR)
        r = int(0.012 * SR)
        g[ia:ib] = 0
        g[max(0, ia - r):ia] *= np.linspace(1, 0, min(r, ia))
        g[ib:ib + int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    return x * g[:, None]


def kick_duck():
    """Gentle pump on the sustained layers from the kick (uplifting section only)."""
    g = np.ones(N)
    for b in range(1, 19):
        if 13 <= b <= 14:
            continue
        for bt in (0, 1, 2, 3):
            i = int(bar_t(b, bt) * SR)
            n = int(0.28 * SR)
            if i + n < N:
                g[i:i + n] *= 1 - 0.28 * np.exp(-np.arange(n) / SR / 0.09)
    return g[:, None]


def swell_curve():
    """+5 dB lift on the sustained layers through the emotional close (bars 13-16)."""
    tt = np.arange(N) / SR
    a, b = bar_t(13) - 0.6, bar_t(17)
    up = np.clip((tt - a) / 1.2, 0, 1) * np.clip((b - tt) / 2.0, 0, 1)
    return (10 ** (5 * up / 20))[:, None]


def lufs(x):
    import pyloudnorm as pyln
    return pyln.Meter(SR).integrated_loudness(x)


def main():
    st = compose()
    stems = {}
    for name, notes in st.items():
        if notes:
            stems[name] = render(notes, PROGRAMS[name], name)
    gains = {"piano": 0.9, "strings": 0.75, "strings_lo": 0.8, "pad": 0.45, "harp": 0.55, "glock": 0.45, "celesta": 0.6,
             "choir": 0.4, "bass": 0.85, "timp": 0.8, "ostinato": 0.7}
    tonal = np.zeros((N, 2))
    for name, x in stems.items():
        y = x * gains[name]
        if name in ("pad", "strings", "choir", "strings_lo"):
            y = y * kick_duck()
        if name in ("strings", "choir", "strings_lo"):
            y = y * swell_curve()
        if name in ("bass",):
            y = lp(y, 1800)
        if name in ("pad",):
            y = hp(y, 180)
        tonal += y
    tonal = reverb(tonal, 0.22, 2.4, 7000)[:N]
    perc = drums_and_textures()
    music = tonal + perc * 0.9 + riser(FREEZE, 2.2)
    # hard stops: silence on "never" and on the freeze frame
    music = gate(music, [(T_NEVER - 0.01, TWIST - 0.15), (FREEZE, DROP - 0.005)])
    # tension fade-in from the cut
    k = (np.arange(N) / SR)
    ramp = np.clip((k - (TWIST - 0.15)) / 0.6, 0, 1)
    music *= np.where((k > TWIST - 0.15) & (k < TWIST + 0.45), ramp, 1.0)[:, None]
    # end: ring out then fade to silence at the very end
    tail = np.clip((DURATION - k) / 1.2, 0, 1)
    music *= tail[:, None]
    # gentle glue + safety
    music = soft_clip(music / (np.abs(music).max() + 1e-9) * 1.05, 1.0)
    target = float(os.environ.get("MUSIC_LUFS", "-19"))
    music *= 10 ** ((target - lufs(music)) / 20)
    os.makedirs("../build", exist_ok=True)
    sf.write("../build/music_raw.wav", music.astype(np.float32), SR)

    # ---------------- side-chain ducking under the voice
    vo, vsr = sf.read("../public/audio/vo.wav")
    if vo.ndim == 2:
        vo = vo.mean(1)
    if vsr != SR:
        vo = resample_poly(vo, SR, vsr)
    vo = np.concatenate([vo, np.zeros(max(0, N - len(vo)))])[:N]
    env = np.sqrt(np.convolve(vo ** 2, np.ones(int(0.03 * SR)) / int(0.03 * SR), "same"))
    active = (env > 10 ** (-38 / 20)).astype(float)
    # hold the duck for 250 ms after each word so short pauses don't pump
    hold = int(0.25 * SR)
    active = np.convolve(active, np.ones(hold), "full")[:N] > 0
    active = active.astype(float)
    # attack 40 ms / release 380 ms smoothing of the duck amount
    duck = np.zeros(N)
    a_c, r_c = np.exp(-1 / (0.04 * SR)), np.exp(-1 / (0.6 * SR))
    lvl = 0.0
    # vectorised one-pole with different attack/release via a simple loop in blocks
    blk = 240
    for i in range(0, N, blk):
        tgt = active[i:i + blk].max()
        c = a_c if tgt > lvl else r_c
        lvl = tgt + (lvl - tgt) * c ** blk
        duck[i:i + blk] = lvl
    # duck depth per line so the music sits TARGET_GAP dB under the voice while it speaks
    import json
    import pyloudnorm as pyln
    meter = pyln.Meter(SR, block_size=0.4)
    gap = float(os.environ.get("TARGET_GAP", "19.5"))
    lines = json.load(open("../src/data/vo.json"))["lines"]
    pts_t, pts_d = [], []
    for ln in lines:
        a, b = int(ln["start"] * SR), int(ln["end"] * SR)
        if b - a < int(0.45 * SR):
            continue
        lv = meter.integrated_loudness(stereo(vo[a:b]))
        lm = meter.integrated_loudness(music[a:b])
        depth = float(np.clip(lm - (lv - gap), 3.0, 24.0)) if np.isfinite(lm) else 3.0
        pts_t.append((ln["start"], ln["end"]))
        pts_d.append(depth)
    # each line keeps its own depth; the boundary sits in the middle of the pause
    tt = np.arange(N) / SR
    depth_curve = np.full(N, pts_d[0])
    for i in range(1, len(pts_t)):
        edge = (pts_t[i - 1][1] + pts_t[i][0]) / 2
        depth_curve[tt >= edge] = pts_d[i]
    g = 10 ** (-depth_curve * duck / 20)
    ducked = music * g[:, None]
    os.makedirs("../public/audio", exist_ok=True)
    sf.write("../public/audio/music.wav", ducked.astype(np.float32), SR, subtype="PCM_16")
    print(f"music: {N / SR:.1f}s, raw {lufs(music):.1f} LUFS, ducked {lufs(ducked):.1f} LUFS, voice {lufs(stereo(vo)):.1f} LUFS")


if __name__ == "__main__":
    main()
