"""Person matting with Robust Video Matting (recurrent, temporally stable).
usage: python3 matte.py <video> <out_dir> [width] [start_s] [dur_s] [model]
writes out_dir/a_000000.png (8-bit alpha) per frame"""
import os, subprocess, sys, time
import numpy as np, onnxruntime as ort
from PIL import Image

vid, out = sys.argv[1], sys.argv[2]
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1920
ss = sys.argv[4] if len(sys.argv) > 4 else "0"
dur = sys.argv[5] if len(sys.argv) > 5 else None
model = sys.argv[6] if len(sys.argv) > 6 else os.environ.get("RVM", "rvm_resnet50_fp32.onnx")
H = W * 9 // 16
os.makedirs(out, exist_ok=True)
so = ort.SessionOptions(); so.intra_op_num_threads = 4
sess = ort.InferenceSession(model, so, providers=["CPUExecutionProvider"])
cmd = ["ffmpeg", "-v", "error", "-ss", ss] + (["-t", dur] if dur else []) + ["-i", vid, "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
rec = [np.zeros([1, 1, 1, 1], dtype=np.float32)] * 4
dr = np.array([0.25 if W <= 1920 else 0.125], dtype=np.float32)
i, t0 = 0, time.time()
while True:
    buf = p.stdout.read(W * H * 3)
    if len(buf) < W * H * 3:
        break
    src = np.frombuffer(buf, np.uint8).reshape(H, W, 3).transpose(2, 0, 1)[None].astype(np.float32) / 255
    fgr, pha, *rec = sess.run(None, {"src": src, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3], "downsample_ratio": dr})
    Image.fromarray((pha[0, 0] * 255).clip(0, 255).astype(np.uint8)).save(f"{out}/a_{i:06d}.png")
    i += 1
    if i % 50 == 0:
        print(i, f"{(time.time() - t0) / i:.2f}s/frame", flush=True)
print("frames", i)
