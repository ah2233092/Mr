"""Per-frame footage treatment: green-screen key, despill, skin retouch,
DSLR-style grade and compositing over the designed background."""
import cv2
import numpy as np

W, H = 3840, 2160
STRIP_X = 3410          # right edge of the green cloth (grey wall beyond it)
WALL_X = 3755           # dark wall starts here; the mic arm is synthesised beyond it
LEFT_X = 70
PAD = 640               # extra canvas on the right so the arm can run off any framing
ARM_SLOPE = -0.118      # the boom arm rises ~7 degrees to the right


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def key(rgb, rvm):
    """rgb float32 0..1 (H,W,3); rvm uint8 alpha at any size -> alpha float32"""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    green = g - np.maximum(r, b)
    a = 1 - smooth(0.045, 0.19, green)
    a[:, STRIP_X:] = 0
    a[:, :LEFT_X] = 0
    # the boom arm over the grey wall: keep only the dark bars inside a sloped band
    xs = np.arange(STRIP_X, WALL_X)
    lum = rgb[:, STRIP_X:WALL_X].mean(2)
    arm = 1 - smooth(0.14, 0.24, lum)
    yy = np.arange(H)[:, None]
    yc = 1460 + ARM_SLOPE * (xs[None, :] - 3550)               # band centre follows the arm
    band = (np.abs(yy - yc) < 190).astype(np.float32)
    a[:, STRIP_X:WALL_X] = arm * band
    a[1240:1345, 3330:3480] = 0                                # orange tape on the wall
    # the desk corner at the bottom right is not part of the talent
    q_lo = cv2.resize(rvm, (W, H), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255
    a[1950:, 3000:] = np.minimum(a[1950:, 3000:], np.clip(q_lo[1950:, 3000:] * 1.5, 0, 1))
    q = cv2.resize(rvm, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    core = cv2.erode((q > 200).astype(np.uint8), np.ones((9, 9), np.uint8))
    core = cv2.resize(core * 255, (W, H), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255
    a = np.maximum(a, core)                                    # fill reflections inside the body
    near = cv2.resize(cv2.dilate((q > 20).astype(np.uint8), np.ones((31, 31), np.uint8)), (W, H), interpolation=cv2.INTER_NEAREST)
    lone = (near == 0)
    if lone.any():                                             # speckle clean-up far from the person
        clean = cv2.morphologyEx((a > .5).astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8)).astype(np.float32)
        a[lone] = np.minimum(a[lone], clean[lone])
    a = cv2.GaussianBlur(a, (0, 0), 1.1)                      # soften the edge by ~1px
    a = np.clip((a - 0.04) / 0.96, 0, 1)                       # choke the outermost fringe
    return a


def extend_arm(rgb, a, ref=3735):
    """pad the canvas to the right and continue the boom arm along its slope,
    copying the last clean column so it always runs off frame"""
    h, w = a.shape
    big = np.zeros((h, w + PAD, 3), np.float32); big[:, :w] = rgb
    ab = np.zeros((h, w + PAD), np.float32); ab[:, :w] = a
    cols = np.arange(ref, w + PAD)
    src_x = np.full_like(cols, ref)
    for j, x in enumerate(cols):
        dy = int(round(-ARM_SLOPE * (x - ref)))               # shift the reference column up
        colr, cola = rgb[:, ref], a[:, ref]
        if dy > 0:
            big[:-dy, x] = colr[dy:]; ab[:-dy, x] = cola[dy:]; ab[-dy:, x] = 0
        else:
            big[:, x] = colr; ab[:, x] = cola
    ab[:, ref:] *= (np.abs(np.arange(h)[:, None] - (1460 + ARM_SLOPE * (cols[None, :] - 3550))) < 190)
    return big, ab


def despill(rgb, a):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lim = np.maximum(r, b)
    edge = 1 - smooth(0.6, 0.98, a)                            # stronger near the edge
    lim2 = (r + b) * 0.5
    lim_e = lim * (1 - edge) + np.minimum(lim, lim2 + 0.02) * edge
    g2 = np.minimum(g, lim_e)
    out = rgb.copy()
    out[..., 1] = g2
    lost = (g - g2)                                            # keep brightness: give back a neutral part
    out += (lost * 0.08)[..., None]
    return out


def skin_mask(rgb, a):
    u8 = (np.clip(rgb, 0, 1) * 255).astype(np.uint8)
    ycc = cv2.cvtColor(u8, cv2.COLOR_RGB2YCrCb)
    cr, cb, y = ycc[..., 1].astype(np.float32), ycc[..., 2].astype(np.float32), ycc[..., 0].astype(np.float32)
    m = smooth(132, 142, cr) * (1 - smooth(176, 186, cr)) * smooth(78, 88, cb) * (1 - smooth(128, 138, cb)) * smooth(45, 70, y)
    m *= smooth(0.9, 1.0, a)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    return cv2.GaussianBlur(m, (0, 0), 6)


def guided(I, r, eps):
    """self-guided filter (He et al.), per channel"""
    k = (2 * r + 1, 2 * r + 1)
    m = cv2.boxFilter(I, -1, k)
    v = cv2.boxFilter(I * I, -1, k) - m * m
    A = v / (v + eps)
    B = m - A * m
    return cv2.boxFilter(A, -1, k) * I + cv2.boxFilter(B, -1, k)


def retouch(rgb, a, face_box, amount=0.68, shine_amt=0.5):
    """natural skin: edge-aware smoothing of blotches, texture kept, oily shine tamed"""
    x0, y0, x1, y1 = face_box
    crop = rgb[y0:y1, x0:x1]
    m = skin_mask(crop, a[y0:y1, x0:x1])
    smooth_ = guided(crop, 14, 0.0016)
    fine = crop - cv2.GaussianBlur(crop, (0, 0), 1.3)          # pores, stubble: keep most of it
    res = smooth_ + fine * 0.75
    lum = crop @ np.array([.2126, .7152, .0722], np.float32)
    mx, mn = crop.max(2), crop.min(2)
    sat = (mx - mn) / (mx + 1e-4)
    shine = smooth(0.40, 0.70, lum) * (1 - smooth(0.30, 0.52, sat)) * m
    shine = cv2.GaussianBlur(shine, (0, 0), 6)
    local = cv2.GaussianBlur(res, (0, 0), 26) * np.array([1.0, 0.96, 0.92], np.float32)
    res = res * (1 - shine[..., None] * shine_amt) + np.minimum(local, res) * (shine[..., None] * shine_amt)
    k = (m * amount)[..., None]
    out = rgb.copy()
    out[y0:y1, x0:x1] = np.clip(crop * (1 - k) + res * k, 0, 1)
    return out


def edge_color(fg, a):
    """replace the colour of semi-transparent edge pixels with the colour of the
    nearby solid interior, so no grey/green fringe survives the key"""
    core = (a > 0.97).astype(np.float32)
    s = 8
    h, w = a.shape
    num = cv2.GaussianBlur(cv2.resize(fg * core[..., None], (w // 2, h // 2), interpolation=cv2.INTER_AREA), (0, 0), s / 2)
    den = cv2.GaussianBlur(cv2.resize(core, (w // 2, h // 2), interpolation=cv2.INTER_AREA), (0, 0), s / 2)[..., None] + 1e-5
    ext = cv2.resize(num / den, (w, h), interpolation=cv2.INTER_LINEAR)
    w = (1 - smooth(0.75, 0.97, a))[..., None]
    return fg * (1 - w) + ext * w


def face_box_from(a):
    """the face is the upper part of the person matte; static framing so a coarse box is enough"""
    return (1500, 120, 2700, 1500)


def filmic(x):
    # gentle S-curve with soft highlight roll-off
    x = np.clip(x, 0, None)
    return (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)


def grade_fg(rgb):
    x = np.clip(rgb, 0, 1) ** 2.2
    x = x * np.array([1.0, 0.985, 0.985], np.float32)
    x = filmic(x * 0.8) ** (1 / 2.2)
    lum = x @ np.array([.2126, .7152, .0722], np.float32)
    x = lum[..., None] + (x - lum[..., None]) * 0.92
    # clarity: local contrast on mid frequencies
    h, w = x.shape[:2]
    blur = cv2.resize(cv2.GaussianBlur(cv2.resize(x, (w // 4, h // 4), interpolation=cv2.INTER_AREA), (0, 0), 3.5), (w, h), interpolation=cv2.INTER_LINEAR)
    x = x + (x - blur) * 0.12
    sharp = cv2.GaussianBlur(x, (0, 0), 1.0)
    x = x + (x - sharp) * 0.35
    return np.clip(x, 0, 1)


def rim_light(a, color=(1.0, 0.74, 0.48), strength=0.32, dx=26):
    """warm edge light from the right/back, shaped by the matte"""
    sh = np.zeros_like(a)
    sh[:, :-dx] = a[:, dx:]
    rim = np.clip(a - sh, 0, 1)
    rim = cv2.GaussianBlur(rim, (0, 0), 9) * a
    return rim[..., None] * np.array(color, np.float32) * strength


def composite(fg, a, bg, wrap=0.22):
    inv = 1 - a
    occl = cv2.GaussianBlur(a, (0, 0), 70)                        # soft ambient occlusion on the wall
    bg = bg * (1 - occl[..., None] * 0.28)
    out = fg * a[..., None] + bg * inv[..., None]
    bgb = cv2.GaussianBlur(bg, (0, 0), 24)
    edge = cv2.GaussianBlur(inv, (0, 0), 14) * a
    out = out + bgb * edge[..., None] * wrap                    # light wrap
    return out


def finish(img, t, seed=0):
    """vignette + fine film grain"""
    h, w = img.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    v = 1 - 0.32 * (((xx - w * .55) / (w * .75)) ** 2 + ((yy - h * .5) / (h * .85)) ** 2)
    img = img * np.clip(v, 0.55, 1)[..., None]
    rng = np.random.default_rng(seed)
    n = rng.standard_normal((h // 2, w // 2)).astype(np.float32)
    n = cv2.resize(cv2.GaussianBlur(n, (0, 0), .7), (w, h))
    lum = img.mean(2, keepdims=True)
    img = img + n[..., None] * 0.018 * (1 - np.abs(lum - .45) * 1.2)
    return np.clip(img, 0, 1)
