"""Procedural textures: animated film grain tiles and a soft paper fibre texture."""
import numpy as np
from PIL import Image, ImageFilter

rng = np.random.default_rng(7)
# full-frame grain plates (slightly larger than 1080p so they can be offset per frame)
for i in range(6):
    n = rng.normal(0.5, 0.16, (1280, 2048))
    img = Image.fromarray((np.clip(n, 0, 1) * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(0.55))
    img.save(f"public/tex/grain_full{i}.jpg", quality=80)

# paper: low-frequency mottling + fine fibres, centred on mid grey (used with multiply/overlay)
h = w = 1024
base = np.zeros((h, w))
for s, a in ((256, 0.5), (64, 0.3), (16, 0.15)):
    small = rng.normal(0, 1, (h // s + 2, w // s + 2))
    big = np.array(Image.fromarray(small.astype(np.float32)).resize((w + 2 * s, h + 2 * s), Image.BICUBIC))[s:s + h, s:s + w]
    base += big * a
from scipy.ndimage import gaussian_filter
fib = gaussian_filter(rng.normal(0, 1, (h, w)), (0.6, 2.5))  # streaky fibres
paper = 0.5 + base * 0.035 + fib * 0.04
Image.fromarray((np.clip(paper, 0, 1) * 255).astype(np.uint8), "L").save("public/tex/paper.png", optimize=True)
print("textures ok")
