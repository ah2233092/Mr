#!/usr/bin/env bash
# Full pipeline: voice -> page -> frames -> audio -> mp4
# usage: ./make.sh <kokoro-models-dir>
set -euo pipefail
MODELS=${1:?path to dir with kokoro-v1.0.onnx and voices-v1.0.bin}
python3 tts.py "$MODELS"
python3 build.py
rm -rf build/frames && node render.js build/frames 30 4
python3 audio.py build/frames/cues.json
mkdir -p output
ffmpeg -y -hide_banner -loglevel warning -framerate 30 -i build/frames/f_%06d.jpg -i build/mix.wav \
  -c:v libx264 -preset slow -crf 20 -maxrate 10M -bufsize 20M -pix_fmt yuv420p -profile:v high \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart \
  output/KDP_Video_1080p.mp4
