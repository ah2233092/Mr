"""Final compositor: background plate (parallax + mood) -> back graphics -> talent
(framing, light wrap, rack focus) -> front graphics -> film finish.

usage: python3 compose.py <a> <b> [--preview gfxdir outdir]   (preview: half-res jpgs)"""
import glob, json, os, sys, time
import cv2, numpy as np
cv2.setNumThreads(2)
sys.path.insert(0, os.path.dirname(__file__))
import look

FPS, W, H = 30, 3840, 2160
SH = json.load(open("pipeline/shots.json"))
FACE = SH["face"]
args = sys.argv[1:]
preview = "--preview" in args
if preview:
    i = args.index("--preview"); GFX, OUT = args[i + 1], args[i + 2]; frames = [int(x) for x in args[0].split(",")]
else:
    GFX, OUT = "build/gfx", "build/comp"; frames = list(range(int(args[0]), int(args[1])))
os.makedirs(OUT, exist_ok=True)
SCALE = 0.5 if preview else 1.0
OW, OH = int(W * SCALE), int(H * SCALE)

plate = cv2.imread("build/bg_plate.png", -1)[:, :, ::-1].astype(np.float32) / 65535
PH, PW = plate.shape[:2]

yy, xx = np.mgrid[0:OH, 0:OW].astype(np.float32)
VIG = np.clip(1 - 0.30 * (((xx - OW * .56) / (OW * .78)) ** 2 + ((yy - OH * .5) / (OH * .9)) ** 2), 0.55, 1)[..., None]
del yy, xx
VIG8 = np.repeat((VIG * 255).astype(np.uint8), 3, axis=2)
# film curve as per-channel LUTs: teal shadows, warm highlights, soft S
_x = np.arange(256, dtype=np.float32) / 255
_lut = []
for c, (sh, hi) in enumerate(((0.035, -0.03), (0.01, 0.01), (-0.03, 0.03))):     # B, G, R order
    y = _x + np.clip(0.35 - _x, 0, 0.35) * sh + np.clip(_x - 0.55, 0, 0.45) * hi
    y = np.clip(y, 0, 1); y = y * y * (3 - 2 * y) * 0.22 + y * 0.78
    _lut.append(np.clip(y * 255 + .5, 0, 255).astype(np.uint8))
LUT = np.stack(_lut, 1).reshape(1, 256, 3)
_g = np.random.default_rng(1)
GRAIN = []
for _ in range(6):
    g = cv2.resize(_g.standard_normal((OH // 2, OW // 2)).astype(np.float32), (OW, OH)) * 3.0
    gi = np.repeat(np.clip(np.round(g), -12, 12).astype(np.int16)[..., None], 3, axis=2)
    GRAIN.append((np.clip(gi, 0, None).astype(np.uint8), np.clip(-gi, 0, None).astype(np.uint8)))


def blend_into(dst, rgb, a):
    """alpha-blend only inside the bounding box of the non-transparent pixels"""
    x, y, w, h = cv2.boundingRect((a > 0.002).astype(np.uint8))
    if w == 0:
        return dst
    sl = (slice(y, y + h), slice(x, x + w))
    aa = a[sl][..., None]
    dst[sl] = dst[sl] * (1 - aa) + rgb[sl] * aa
    return dst


def smoothstep(x):
    x = min(1.0, max(0.0, x)); return x * x * (3 - 2 * x)


def shot_at(t):
    sh = SH["shots"]
    k = max(i for i, s in enumerate(sh) if s["t"] <= t + 1e-6)
    s0 = sh[k]; t1 = sh[k + 1]["t"] if k + 1 < len(sh) else SH["total"]
    return s0, (t - s0["t"]) / max(1e-3, t1 - s0["t"])


def camera(t):
    s0, prog = shot_at(t)
    if s0["p"] == "BROLL":
        return None
    pr = SH["presets"][s0["p"]]
    s = pr["s"] * (1 + s0.get("push", 0) * smoothstep(prog))
    return s, pr["fx"], pr["fy"]


def mood(t):
    """problem half: darker, cooler, less saturated. good news: warm light comes up."""
    k = smoothstep((t - SH["good_news"] - 0.05) / 0.9)
    expo = 0.80 + 0.22 * k
    sat = 0.82 + 0.18 * k
    tint = np.array([0.95 + 0.09 * k, 1.0, 1.05 - 0.09 * k], np.float32)
    return expo, sat, tint


def load_rgba(path):
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if im is None:
        return None, None
    if SCALE != 1:
        im = cv2.resize(im, (OW, OH), interpolation=cv2.INTER_AREA)
    if im.ndim == 2:
        im = cv2.cvtColor(im, cv2.COLOR_GRAY2BGR)
    rgb = im[:, :, 2::-1].astype(np.float32) / 255
    a = im[:, :, 3].astype(np.float32) / 255 if im.shape[2] == 4 else np.ones(im.shape[:2], np.float32)
    return rgb, a


def fg_frame(n):
    n = min(n, 1397)                                       # after the last spoken frame: hold it
    p = f"build/fg/rgb_{n:05d}.jpg"
    if not os.path.exists(p):
        if not preview:
            raise FileNotFoundError(p)
        have = sorted(int(os.path.basename(f)[4:9]) for f in glob.glob("build/fg/rgb_*.jpg"))
        n = min(have, key=lambda x: abs(x - n))
    rgb = cv2.imread(f"build/fg/rgb_{n:05d}.jpg")[:, :, ::-1].astype(np.float32) / 255
    a = cv2.imread(f"build/fg/a_{n:05d}.png", 0).astype(np.float32) / 255
    return rgb, a


def render(n):
    t = n / FPS
    cam = camera(t)
    # ---- background plate with parallax
    s, fx, fy = cam if cam else (1.0, 1920, 700)
    bs = 1 + (s - 1) * 0.22
    px = (fx - 1920) * 0.14 + np.sin(t * 0.21) * 9
    py = (fy - 700) * 0.10 + np.cos(t * 0.17) * 5
    M = np.float32([[bs, 0, W / 2 - bs * PW / 2 + px], [0, bs, H / 2 - bs * PH / 2 + py]]) * SCALE
    bg = cv2.warpAffine(plate, M, (OW, OH), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    expo, sat, tint = mood(t)
    k = expo * (1 + 0.015 * np.sin(t * 1.3))               # mood + breathing practicals, one matrix
    Mc = (np.diag(tint) @ (sat * np.eye(3) + (1 - sat) / 3 * np.ones((3, 3)))) * k
    bg = cv2.transform(bg, Mc.astype(np.float32))
    # ---- back graphics
    brgb, ba = load_rgba(f"{GFX}/back_{n:05d}.png")
    if brgb is not None:
        bg = blend_into(bg, brgb, ba)
    out = bg
    # ---- talent
    if cam:
        fg, a = fg_frame(n)
        M = np.float32([[s, 0, fx - s * FACE[0]], [0, s, fy - s * FACE[1]]]) * SCALE
        fgw = cv2.warpAffine(fg, M, (OW, OH), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT)
        aw = cv2.warpAffine(a, M, (OW, OH), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        fgw *= (0.94 + 0.06 * (expo - 0.8) / 0.22)
        if t > SH["end"] + 0.5:                             # rack focus to the end card
            r = smoothstep((t - SH["end"] - 0.5) / 1.1) * 26 * SCALE
            if r > 0.3:
                fgw = cv2.GaussianBlur(fgw * aw[..., None], (0, 0), r)
                aw = cv2.GaussianBlur(aw, (0, 0), r)
                fgw = fgw / np.maximum(aw[..., None], 1e-4)
        out = look.composite(np.clip(fgw, 0, 1), np.clip(aw, 0, 1), bg)
    # ---- front graphics
    frgb, fa = load_rgba(f"{GFX}/front_{n:05d}.png")
    if frgb is not None:
        out = blend_into(out, frgb, fa)
    # ---- film finish: halation, gentle curve, teal shadows / warm highlights, vignette, grain
    q = cv2.resize(out, (OW // 4, OH // 4), interpolation=cv2.INTER_AREA)
    hl = np.clip(q - 0.72, 0, None)
    hal = cv2.resize(cv2.GaussianBlur(hl, (0, 0), 10), (OW, OH)) * np.array([1.0, 0.55, 0.3], np.float32)
    cv2.scaleAdd(hal, 0.35, out, dst=out)
    o8 = cv2.convertScaleAbs(cv2.cvtColor(out, cv2.COLOR_RGB2BGR), alpha=255)
    o8 = cv2.LUT(o8, LUT)
    o8 = cv2.multiply(o8, VIG8, scale=1 / 255)
    gp, gn = GRAIN[n % len(GRAIN)]
    o8 = cv2.subtract(cv2.add(o8, gp), gn)
    return o8


t0 = time.time()
for j, n in enumerate(frames):
    if not preview and os.path.exists(f"{OUT}/c_{n:05d}.jpg"):
        continue
    o8 = render(n)
    if preview:
        cv2.imwrite(f"{OUT}/c_{n:05d}.jpg", o8, [cv2.IMWRITE_JPEG_QUALITY, 90])
    else:
        cv2.imwrite(f"{OUT}/c_{n:05d}.jpg", o8, [cv2.IMWRITE_JPEG_QUALITY, 97])
    if j % 25 == 0:
        print(n, f"{(time.time() - t0) / (j + 1):.2f}s/frame", flush=True)
print("done")
