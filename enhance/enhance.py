"""Polish an already-edited 4K video without touching its graphics or audio:
compression clean-up, natural skin tone + shine control on the person only,
and fine sharpening.

usage: python3 enhance.py <a> <b>       frames [a, b) -> build/out/e_NNNNN.jpg
       python3 enhance.py --still in.png rvm.png out.jpg"""
import os, subprocess, sys, time
import cv2, numpy as np
cv2.setNumThreads(2)

W, H, FPS = 3840, 2160, 30
SRC = "src/cowork.mp4"


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def guided(I, r, eps):
    k = (2 * r + 1, 2 * r + 1)
    m = cv2.boxFilter(I, -1, k)
    v = cv2.boxFilter(I * I, -1, k) - m * m
    A = v / (v + eps)
    B = m - A * m
    return cv2.boxFilter(A, -1, k) * I + cv2.boxFilter(B, -1, k)


def person_matte(rvm):
    a = cv2.resize(rvm, (W, H), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255
    a = cv2.erode(a, np.ones((9, 9), np.uint8))                 # stay off the hair/background edge
    return cv2.GaussianBlur(a, (0, 0), 4)


def skin_mask(rgb, person):
    u8 = (np.clip(rgb, 0, 1) * 255).astype(np.uint8)
    ycc = cv2.cvtColor(u8, cv2.COLOR_RGB2YCrCb).astype(np.float32)
    y, cr, cb = ycc[..., 0], ycc[..., 1], ycc[..., 2]
    m = smooth(132, 141, cr) * (1 - smooth(178, 188, cr)) * smooth(76, 86, cb) * (1 - smooth(130, 140, cb)) * smooth(40, 65, y)
    m *= person
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    return cv2.GaussianBlur(m, (0, 0), 5)


def enhance(rgb, rvm):
    person = person_matte(rvm)
    sk = skin_mask(rgb, person)
    x, y, w, h = cv2.boundingRect((sk > 0.05).astype(np.uint8))
    out = rgb.copy()
    if w > 20 and h > 20:
        pad = 40
        x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(W, x + w + pad), min(H, y + h + pad)
        c = rgb[y0:y1, x0:x1]; m = sk[y0:y1, x0:x1][..., None]
        # 1) even out blotches, keep pores/stubble
        base = guided(c, 9, 0.0007)
        fine = c - cv2.GaussianBlur(c, (0, 0), 1.6)
        s = base + fine * 1.0
        # 2) oily shine: bright, desaturated skin highlights -> back toward local skin colour
        lum = c @ np.array([.2126, .7152, .0722], np.float32)
        mx, mn = c.max(2), c.min(2)
        sat = (mx - mn) / (mx + 1e-4)
        shine = smooth(0.46, 0.78, lum) * (1 - smooth(0.26, 0.48, sat)) * m[..., 0]
        shine = cv2.GaussianBlur(shine, (0, 0), 5)[..., None]
        local = cv2.GaussianBlur(s, (0, 0), 24)
        s = s * (1 - shine * 0.5) + np.minimum(local, s) * (shine * 0.5)
        # 3) tone: warm, healthy, slightly less sallow/green; keep luminance
        l0 = s @ np.array([.2126, .7152, .0722], np.float32)
        t = s * np.array([1.025, 0.99, 0.975], np.float32)
        l1 = t @ np.array([.2126, .7152, .0722], np.float32)
        t = t * (l0 / np.maximum(l1, 1e-4))[..., None]
        t = l0[..., None] + (t - l0[..., None]) * 1.03              # a touch more colour
        k = m * 0.6
        out[y0:y1, x0:x1] = np.clip(c * (1 - k) + t * k, 0, 1)
    # 4) eyes/face clarity + whole-frame fine sharpening (graphics stay crisp, not haloed)
    detail = out - cv2.GaussianBlur(out, (0, 0), 1.1)
    out = out + detail * 0.7
    mid = out - cv2.resize(cv2.GaussianBlur(cv2.resize(out, (W // 4, H // 4), interpolation=cv2.INTER_AREA), (0, 0), 3), (W, H))
    out = out + mid * 0.08 * person[..., None]                    # local contrast on the person only
    return np.clip(out, 0, 1)


if __name__ == "__main__":
    if sys.argv[1] == "--still":
        rgb = cv2.imread(sys.argv[2], -1)[:, :, ::-1].astype(np.float32) / 65535
        rvm = cv2.imread(sys.argv[3], 0)
        t0 = time.time(); o = enhance(rgb, rvm); print(f"{time.time() - t0:.2f}s")
        cv2.imwrite(sys.argv[4], (o[:, :, ::-1] * 255 + .5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 95])
        sys.exit()
    a0, b0 = int(sys.argv[1]), int(sys.argv[2])
    os.makedirs("build/out", exist_ok=True)
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{a0 / FPS:.4f}", "-i", SRC, "-frames:v", str(b0 - a0),
           "-vf", "hqdn3d=1.2:1.0:2.5:2.0", "-f", "rawvideo", "-pix_fmt", "rgb48le", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=W * H * 6)
    t0 = time.time()
    for j, n in enumerate(range(a0, b0)):
        buf = p.stdout.read(W * H * 6)
        if len(buf) < W * H * 6:
            break
        if os.path.exists(f"build/out/e_{n:05d}.jpg"):
            continue
        rgb = np.frombuffer(buf, np.uint16).reshape(H, W, 3).astype(np.float32) / 65535
        rvm = cv2.imread(f"build/rvm/a_{min(n, 1460):06d}.png", 0)
        o = enhance(rgb, rvm)
        cv2.imwrite(f"build/out/e_{n:05d}.jpg", (o[:, :, ::-1] * 255 + .5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 97])
        if j % 25 == 0:
            print(n, f"{(time.time() - t0) / (j + 1):.2f}s/frame", flush=True)
    print("done", a0, b0)
