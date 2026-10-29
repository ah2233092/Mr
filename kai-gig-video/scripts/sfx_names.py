"""List every SFX name referenced in src/ (and optionally create silent placeholders for missing ones)."""
import glob, re, sys
names = set()
for fn in glob.glob("src/**/*.tsx", recursive=True):
    s = open(fn).read()
    names |= set(re.findall(r'<Sfx[^>]*?name="([a-z0-9_]+)"', s, re.S))
    for m in re.findall(r'name=\{`([a-z_]+)\$\{\(i % (\d)\) \+ 1\}`\}', s):
        names |= {f"{m[0]}{k}" for k in range(1, int(m[1]) + 1)}
names = sorted(names)
print(" ".join(names))
if "--placeholders" in sys.argv:
    import os, numpy as np, soundfile as sf
    for n in names:
        p = f"public/sfx/{n}.wav"
        if not os.path.exists(p):
            sf.write(p, np.zeros((4800, 2), np.float32), 48000)
