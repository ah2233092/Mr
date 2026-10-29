"""Tile review stills into one labelled contact sheet. usage: sheet.py <dir> [cols] [width]"""
import glob, sys
from PIL import Image, ImageDraw
d = sys.argv[1]; cols = int(sys.argv[2]) if len(sys.argv) > 2 else 2; tw = int(sys.argv[3]) if len(sys.argv) > 3 else 960
files = sorted(glob.glob(f"{d}/f*.png"))
th = tw * 9 // 16
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * th), (40, 40, 40))
for i, fn in enumerate(files):
    im = Image.open(fn).convert("RGB").resize((tw, th), Image.LANCZOS)
    dr = ImageDraw.Draw(im); fr = int(fn.split("/f")[-1][:5])
    dr.rectangle([0, 0, 150, 26], fill=(0, 0, 0)); dr.text((6, 6), f"{fr/30:6.2f}s f{fr}", fill=(255, 255, 0))
    sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
sheet.save(f"{d}/sheet.jpg", quality=88)
print(f"{d}/sheet.jpg", len(files))
