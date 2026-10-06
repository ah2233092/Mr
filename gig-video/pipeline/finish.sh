#!/usr/bin/env bash
# Runs after the talent layer (build/fg) and graphics layers (build/gfx) are complete.
set -euo pipefail
cd "$(dirname "$0")/.."
N=$(python3 -c "import json;print(round(json.load(open('pipeline/shots.json'))['total']*30))")
python3 pipeline/audio.py build/gfx/cues.json --remix > build/audio_final.log 2>&1
mkdir -p build/comp output
Q=$(( (N + 3) / 4 ))
for i in 0 1 2 3; do a=$((i*Q)); b=$(( (i+1)*Q < N ? (i+1)*Q : N )); python3 pipeline/compose.py $a $b > build/comp_$i.log 2>&1 & done; wait
ffmpeg -y -v error -framerate 30 -i build/comp/c_%05d.png -i build/mix.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -profile:v high -level 5.1 -tune film \
  -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart output/MrAhmad_KDP_Gig_4K_Master.mp4
ffmpeg -y -v error -i output/MrAhmad_KDP_Gig_4K_Master.mp4 -c:v libx264 -preset slow -b:v 7200k -pass 1 -passlogfile build/fv -an -f mp4 /dev/null
ffmpeg -y -v error -i output/MrAhmad_KDP_Gig_4K_Master.mp4 -c:v libx264 -preset slow -b:v 7200k -maxrate 11M -bufsize 16M -pass 2 -passlogfile build/fv \
  -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart output/MrAhmad_KDP_Gig_Fiverr.mp4
ls -la output
echo FINISHED
