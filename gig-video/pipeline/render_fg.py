"""Process the talent layer for output frames [a, b): key, despill, edge colour,
skin retouch, grade, rim light. Cached as build/fg/rgb_N.jpg + build/fg/a_N.png
(source coordinates; framing is applied later by the compositor).

usage: python3 render_fg.py <a> <b>"""
import json, os, subprocess, sys, time
import cv2, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import look

FPS = 30
a0, b0 = int(sys.argv[1]), int(sys.argv[2])
edl = json.load(open("build/edl.json"))
segs = edl["segments"]


def src_index(n):
    t = n / FPS
    for g in segs:
        if g["dst"][0] - 1e-6 <= t < g["dst"][1] + 1e-6:
            return int(round((g["src"][0] + t - g["dst"][0]) * FPS))
    g = segs[-1]
    return int(round((g["src"][1] - 1 / FPS) * FPS))      # hold the last frame


idx = [src_index(n) for n in range(a0, b0)]
k_start, k_end = idx[0], idx[-1]
os.makedirs("build/fg", exist_ok=True)
W, H = 3840, 2160
cmd = ["ffmpeg", "-v", "error", "-ss", f"{k_start / FPS:.4f}", "-i", "src/raw.mov",
       "-vf", "tmix=frames=2:weights=1 1,framestep=2", "-f", "rawvideo", "-pix_fmt", "rgb48le", "-"]
p = subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=W * H * 6)
k, frame, t0 = k_start - 1, None, time.time()
fbox = look.face_box_from(None)
for j, (n, need) in enumerate(zip(range(a0, b0), idx)):
    while k < need:
        buf = p.stdout.read(W * H * 6)
        if len(buf) < W * H * 6:
            break
        frame = np.frombuffer(buf, np.uint16).reshape(H, W, 3)
        k += 1
    if os.path.exists(f"build/fg/a_{n:05d}.png"):
        continue
    rgb = frame.astype(np.float32) / 65535
    rvm = cv2.imread(f"build/rvm/a_{min(need, 1542):06d}.png", 0)
    a = look.key(rgb, rvm)
    fg = look.edge_color(look.despill(rgb, a), a)
    fg = look.retouch(fg, a, fbox)
    fg = look.grade_fg(fg)
    fg = np.clip(fg + look.rim_light(a), 0, 1)
    cv2.imwrite(f"build/fg/rgb_{n:05d}.jpg", (fg[:, :, ::-1] * 255 + .5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 96])
    cv2.imwrite(f"build/fg/a_{n:05d}.png", (a * 255 + .5).astype(np.uint8))
    if j % 20 == 0:
        print(f"{n} (src {need}) {(time.time() - t0) / (j + 1):.2f}s/frame", flush=True)
p.kill()
print("done", a0, b0)
