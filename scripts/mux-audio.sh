#!/bin/bash
# mux-audio.sh — Layer narration + sound design + ambient onto video
#
# Takes the silent Remotion MP4 and produces a cinematic version with:
# - Ambient music bed (low, continuous)
# - Narration synced to each scene
# - Sound effects at transitions
#
# Usage:
#   ./scripts/mux-audio.sh 2026-03-27

set -euo pipefail

DATE="${1:?Usage: mux-audio.sh <date>}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VIDEO_IN="/tmp/tidox-videos/episode-${DATE}.mp4"
AUDIO_DIR="${PROJECT_DIR}/public/audio/${DATE}"
OUTPUT="/tmp/tidox-videos/episode-${DATE}-final.mp4"

if [ ! -f "$VIDEO_IN" ]; then
  echo "Silent video not found: $VIDEO_IN"
  echo "Run: cd packages/video && npx remotion render Episode $VIDEO_IN"
  exit 1
fi

echo "Muxing audio into video for ${DATE}..."

# Scene timing (in seconds, matching Remotion constants.ts):
# Masthead: 0-3s
# Headlines: 3-21s (3 x 6s each)
# Trending: 21-31s
# Numbers: 31-41s
# Takeaway: 41-49s
# Close: 49-54s

# Get video duration
VID_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$VIDEO_IN" 2>/dev/null | cut -d. -f1)
echo "  Video duration: ${VID_DUR}s"

# Build the ffmpeg complex filter
# Inputs:
#   0 = silent video
#   1 = ambient bed
#   2 = narration-masthead
#   3 = narration-headline-1
#   4 = narration-headline-2
#   5 = narration-headline-3
#   6 = narration-trending
#   7 = narration-takeaway
#   8 = sfx-whoosh
#   9 = sfx-impact
#  10 = sfx-tick

echo "  Mixing audio layers..."

ffmpeg -y \
  -i "$VIDEO_IN" \
  -i "$AUDIO_DIR/ambient.wav" \
  -i "$AUDIO_DIR/narration-masthead.wav" \
  -i "$AUDIO_DIR/narration-headline-1.wav" \
  -i "$AUDIO_DIR/narration-headline-2.wav" \
  -i "$AUDIO_DIR/narration-headline-3.wav" \
  -i "$AUDIO_DIR/narration-trending.wav" \
  -i "$AUDIO_DIR/narration-takeaway.wav" \
  -i "$AUDIO_DIR/sfx-whoosh.wav" \
  -i "$AUDIO_DIR/sfx-impact.wav" \
  -i "$AUDIO_DIR/sfx-tick.wav" \
  -filter_complex "
    [1:a]volume=0.12,atrim=0:${VID_DUR},afade=t=in:st=0:d=2,afade=t=out:st=$((VID_DUR-3)):d=3[ambient];

    [2:a]volume=0.85,adelay=500|500[masthead];
    [3:a]volume=0.85,adelay=3500|3500[h1];
    [4:a]volume=0.85,adelay=9500|9500[h2];
    [5:a]volume=0.85,adelay=15500|15500[h3];
    [6:a]volume=0.80,adelay=22000|22000[trending];
    [7:a]volume=0.85,adelay=41500|41500[takeaway];

    [8:a]volume=0.25[whoosh_src];
    [whoosh_src]asplit=4[w0][w1][w2][w3];
    [w0]adelay=0|0[w0d];
    [w1]adelay=21000|21000[w1d];
    [w2]adelay=31000|31000[w2d];
    [w3]adelay=41000|41000[w3d];

    [9:a]volume=0.20[impact_src];
    [impact_src]asplit=3[i0][i1][i2];
    [i0]adelay=3000|3000[i0d];
    [i1]adelay=9000|9000[i1d];
    [i2]adelay=15000|15000[i2d];

    [10:a]volume=0.15[tick_src];
    [tick_src]asplit=4[t0][t1][t2][t3];
    [t0]adelay=32000|32000[t0d];
    [t1]adelay=33200|33200[t1d];
    [t2]adelay=34400|34400[t2d];
    [t3]adelay=35600|35600[t3d];

    [ambient][masthead][h1][h2][h3][trending][takeaway][w0d][w1d][w2d][w3d][i0d][i1d][i2d][t0d][t1d][t2d][t3d]amix=inputs=18:duration=first:dropout_transition=0:normalize=0[mixed];
    [mixed]loudnorm=I=-16:TP=-1.5:LRA=11[out]
  " \
  -map 0:v:0 -map "[out]" \
  -c:v copy \
  -c:a aac -b:a 192k \
  -shortest \
  "$OUTPUT" \
  2>&1 | tail -5

if [ -f "$OUTPUT" ]; then
  SIZE=$(ls -lh "$OUTPUT" | awk '{print $5}')
  echo ""
  echo "  ✓ Final video: $OUTPUT ($SIZE)"
  echo "  Opening..."
  open "$OUTPUT"
else
  echo "  ✗ Failed to produce output"
  exit 1
fi
