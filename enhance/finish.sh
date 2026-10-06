#!/usr/bin/env bash
# wait for the 4 workers, then mux enhanced frames with the ORIGINAL audio (untouched)
cd /home/user/Mr/enhance
until [ "$(grep -l '^done' build/enh_*.log 2>/dev/null | wc -l)" -ge 4 ]; do
  grep -q Traceback build/enh_*.log && { echo ERROR; exit 1; }
  sleep 10
done
mkdir -p output
ffmpeg -y -v error -framerate 30 -i build/out/e_%05d.jpg -i src/cowork.mp4 -map 0:v -map 1:a -c:a copy \
  -c:v libx264 -preset slow -crf 15 -maxrate 18M -bufsize 36M -pix_fmt yuv420p -profile:v high -level 5.1 -tune film \
  -movflags +faststart output/MrAhmad_KDP_4K_Enhanced.mp4
ls -la output; echo FINISHED
