#!/usr/bin/env bash
# Final master: two-pass loudness normalisation (-14 LUFS, TP -1.5 dBTP) + H.264 encode
# under the Fiverr size limit, plus the thumbnail still.
# usage: scripts/finish.sh [raw.mp4] [thumbnail_frame]
set -euo pipefail
cd "$(dirname "$0")/.."
RAW=${1:-build/video_raw.mp4}
THUMB_FRAME=${2:-132}
OUT=output/KAI_gig_video.mp4
mkdir -p output

# look-ahead peak limiter first (speech/impact peaks), so the loudness gain can stay linear
PRE="alimiter=limit=0.45:attack=2:release=60:level=disabled"

# pass 1: measure
ffmpeg -hide_banner -nostats -i "$RAW" -vn -af "$PRE,loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json" -f null - 2> build/loudnorm.txt
read -r I TP LRA THRESH OFFSET < <(python3 - <<'EOF'
import json, re
s = open("build/loudnorm.txt").read()
d = json.loads(s[s.rindex("{"):s.rindex("}") + 1])
print(d["input_i"], d["input_tp"], d["input_lra"], d["input_thresh"], d["target_offset"])
EOF
)
echo "measured: I=$I TP=$TP LRA=$LRA"

# pass 2: apply (linear) + encode
CRF=${CRF:-18}
ffmpeg -y -hide_banner -loglevel warning -i "$RAW" \
  -af "$PRE,loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$I:measured_TP=$TP:measured_LRA=$LRA:measured_thresh=$THRESH:offset=$OFFSET:linear=true,aresample=48000" \
  -c:v libx264 -preset slow -crf "$CRF" -maxrate 9M -bufsize 18M -pix_fmt yuv420p -profile:v high -level 4.1 \
  -r 30 -g 60 -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$OUT"

SIZE=$(stat -c %s "$OUT")
echo "wrote $OUT ($((SIZE / 1024 / 1024)) MB)"
if [ "$SIZE" -gt $((48 * 1024 * 1024)) ]; then
  echo "over budget, re-encoding with CRF $((CRF + 3))"
  CRF=$((CRF + 3)) exec "$0" "$RAW" "$THUMB_FRAME"
fi

# verify loudness of the delivered file
ffmpeg -hide_banner -nostats -i "$OUT" -vn -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2

# thumbnail: lossless still straight from the composition
npx remotion still KAIGigVideo output/KAI_gig_thumbnail.png --frame="$THUMB_FRAME" --image-format=png --log=error
echo "wrote output/KAI_gig_thumbnail.png (frame $THUMB_FRAME)"
