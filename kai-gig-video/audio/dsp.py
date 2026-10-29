"""Small DSP toolkit shared by the SFX and music generators (numpy/scipy only)."""
import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt, sosfilt_zi

SR = 48000
rng = np.random.default_rng(2024)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def noise(dur, color="white"):
    n = rng.standard_normal(int(dur * SR))
    if color == "pink":
        f = np.fft.rfft(n)
        k = np.arange(len(f))
        k[0] = 1
        n = np.fft.irfft(f / np.sqrt(k), len(n))
    elif color == "brown":
        n = np.cumsum(n)
        n -= np.convolve(n, np.ones(2000) / 2000, "same")
    return n / (np.abs(n).max() + 1e-9)


def sos(kind, f, order=2):
    if kind == "band":
        lo, hi = f
        return butter(order, [max(20, lo), min(SR / 2 - 100, hi)], "band", fs=SR, output="sos")
    return butter(order, min(max(f, 20), SR / 2 - 100), kind, fs=SR, output="sos")


def lp(x, f, order=2):
    return sosfilt(sos("low", f, order), x, axis=0)


def hp(x, f, order=2):
    return sosfilt(sos("high", f, order), x, axis=0)


def bp(x, lo, hi, order=2):
    return sosfilt(sos("band", (lo, hi), order), x, axis=0)


def sweep_filter(x, f_start, f_end, kind="band", q=1.5, block=256, curve="exp"):
    """Time-varying filter (block-wise, filter state carried between blocks)."""
    n = len(x)
    out = np.zeros(n)
    nb = int(np.ceil(n / block))
    zi = None
    for b in range(nb):
        u = b / max(1, nb - 1)
        if callable(f_start):
            fc = f_start(u)
        elif curve == "exp":
            fc = f_start * (f_end / f_start) ** u
        else:
            fc = f_start + (f_end - f_start) * u
        if kind == "band":
            s = sos("band", (fc / (1 + 1 / q), fc * (1 + 1 / q)), 2)
        else:
            s = sos(kind, fc, 2)
        seg = x[b * block:(b + 1) * block]
        if zi is None or zi.shape != (s.shape[0], 2):
            zi = sosfilt_zi(s) * seg[0] if len(seg) else None
        y, zi = sosfilt(s, seg, zi=zi)
        out[b * block:b * block + len(y)] = y
    return out


def env_adsr(n, a=0.005, d=0.1, s=0.0, r=0.1, sustain_time=0.0):
    a_n, d_n, s_n, r_n = int(a * SR), int(d * SR), int(sustain_time * SR), int(r * SR)
    e = np.concatenate([
        np.linspace(0, 1, max(1, a_n)),
        np.linspace(1, s, max(1, d_n)),
        np.full(max(0, s_n), s),
        np.linspace(s, 0, max(1, r_n)),
    ])
    if len(e) < n:
        e = np.concatenate([e, np.zeros(n - len(e))])
    return e[:n]


def exp_env(n, tau):
    return np.exp(-np.arange(n) / SR / tau)


def fade(x, fin=0.002, fout=0.01):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a)[:, None] if x.ndim == 2 else np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)[:, None] if x.ndim == 2 else np.linspace(1, 0, b)
    return x


def glide_sine(f0, f1, dur, curve="exp", phase=0.0):
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    f = f0 * (f1 / f0) ** u if curve == "exp" else f0 + (f1 - f0) * u
    return np.sin(phase + 2 * np.pi * np.cumsum(f) / SR)


def stereo(x, pan=0.0, width=0.0, delay_ms=0.0):
    """Mono → stereo with constant-power pan, optional Haas widening."""
    l = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2)
    r = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
    L, R = x * l, x * r
    if width > 0 and delay_ms > 0:
        d = int(delay_ms * SR / 1000)
        R = (1 - width) * R + width * np.concatenate([np.zeros(d), R[:-d]]) if d else R
    return np.stack([L, R], 1)


def auto_pan(x, p0, p1):
    n = len(x)
    p = np.linspace(p0, p1, n)
    return np.stack([x * np.cos((p + 1) * np.pi / 4), x * np.sin((p + 1) * np.pi / 4)], 1) * np.sqrt(2)


_IR_CACHE = {}


def reverb_ir(seconds=1.8, damp=6000, predelay=0.012, seed=1):
    key = (seconds, damp, predelay, seed)
    if key in _IR_CACHE:
        return _IR_CACHE[key]
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    tt = np.arange(n) / SR
    decay = np.exp(-6.9 * tt / seconds)
    ir = np.zeros((n, 2))
    for c in range(2):
        nn = r.standard_normal(n) * decay
        # darker as it decays
        nn = 0.65 * lp(nn, damp) + 0.35 * lp(nn, damp * 0.35)
        ir[:, c] = nn
    pd = int(predelay * SR)
    ir = np.concatenate([np.zeros((pd, 2)), ir])
    ir[:, :] /= np.sqrt((ir ** 2).sum(0, keepdims=True)) + 1e-9
    _IR_CACHE[key] = ir
    return ir


def reverb(x, mix=0.25, seconds=1.8, damp=6000, predelay=0.012):
    if x.ndim == 1:
        x = stereo(x)
    ir = reverb_ir(seconds, damp, predelay)
    wet = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x) + len(ir) - 1] for c in range(2)], 1)
    dry = np.concatenate([x, np.zeros((len(wet) - len(x), 2))])
    return dry * (1 - mix * 0.5) + wet * mix


def normalize(x, peak_db=-3.0):
    p = np.abs(x).max() + 1e-9
    return x * (10 ** (peak_db / 20) / p)


def trim_tail(x, thr_db=-70):
    a = np.abs(x).max(1) if x.ndim == 2 else np.abs(x)
    idx = np.where(a > 10 ** (thr_db / 20) * a.max())[0]
    return x[: idx[-1] + int(0.02 * SR)] if len(idx) else x


def soft_clip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


def place(buf, sig, t, gain=1.0):
    i = int(round(t * SR))
    if sig.ndim == 1 and buf.ndim == 2:
        sig = stereo(sig)
    if i < 0:
        sig = sig[-i:]
        i = 0
    n = min(len(sig), len(buf) - i)
    if n > 0:
        buf[i:i + n] += sig[:n] * gain


def mix(*sigs):
    """Sum signals of different lengths (mono or stereo), zero-padding the shorter ones."""
    st = any(s.ndim == 2 for s in sigs)
    sigs = [stereo(s) if (st and s.ndim == 1) else s for s in sigs]
    n = max(len(s) for s in sigs)
    out = np.zeros((n, 2) if st else n)
    for s in sigs:
        out[: len(s)] += s
    return out
