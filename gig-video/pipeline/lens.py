"""Lens blur (disc bokeh) for the background plate -> build/bg_plate.png (16-bit)"""
import cv2, numpy as np, sys
src = cv2.imread(sys.argv[1] if len(sys.argv) > 1 else "build/bg_sharp.png").astype(np.float32) / 255
lin = src ** 2.2                                   # blur in linear light so highlights bloom like glass
hi = np.clip(lin - 0.55, 0, None) * 6              # boost bright points -> bright bokeh discs
lin = lin + hi
r = int(sys.argv[2]) if len(sys.argv) > 2 else 46
k = np.zeros((2 * r + 1, 2 * r + 1), np.float32)
cv2.circle(k, (r, r), r, 1, -1, cv2.LINE_AA)
k /= k.sum()
small = cv2.resize(lin, None, fx=.5, fy=.5, interpolation=cv2.INTER_AREA)      # blur at half res, then upsample
kb = cv2.resize(k, (r + 1 | 1, r + 1 | 1), interpolation=cv2.INTER_AREA); kb /= kb.sum()
bl = cv2.filter2D(small, -1, kb)
bl = cv2.resize(bl, (src.shape[1], src.shape[0]), interpolation=cv2.INTER_CUBIC)
out = np.clip(bl / (1 + bl * .15), 0, None) ** (1 / 2.2)                       # soft highlight roll-off
cv2.imwrite(sys.argv[3] if len(sys.argv) > 3 else "build/bg_plate.png", (np.clip(out, 0, 1) * 65535).astype(np.uint16))
print(out.shape)
