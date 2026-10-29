#!/usr/bin/env bash
# Voice chain: 48 kHz, high-pass 80 Hz, a little low-mid warmth, tamed boxiness,
# gentle presence, de-ess, gentle 2.5:1 compression, peak safety. Dry, no reverb.
set -euo pipefail
IN=${1:-../build/vo_raw.wav}
OUT=${2:-../public/audio/vo.wav}
mkdir -p "$(dirname "$OUT")"
ffmpeg -y -hide_banner -loglevel error -i "$IN" -af "\
aresample=48000:resampler=soxr,\
highpass=f=80:poles=2,\
equalizer=f=190:t=q:w=0.9:g=1.8,\
equalizer=f=420:t=q:w=1.4:g=-1.2,\
equalizer=f=3200:t=q:w=1.2:g=1.0,\
deesser=i=0.35:m=0.5:f=0.5,\
acompressor=threshold=-20dB:ratio=2.5:attack=6:release=140:knee=6:makeup=2,\
alimiter=limit=0.89:attack=3:release=60:level=disabled" \
  -ac 1 -c:a pcm_s24le "$OUT"
echo "wrote $OUT"
