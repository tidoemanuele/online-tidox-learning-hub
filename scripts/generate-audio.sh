#!/bin/bash
# generate-audio.sh — Generate narration + sound design for a video episode
#
# Uses KittenTTS (Hugo voice) for narration and sox for sound design.
# Outputs audio files that can be layered into the video via ffmpeg.
#
# Usage:
#   ./scripts/generate-audio.sh 2026-03-27

set -euo pipefail

DATE="${1:?Usage: generate-audio.sh <date>}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EPISODE_FILE="${PROJECT_DIR}/src/content/episodes/${DATE}.json"
AUDIO_DIR="${PROJECT_DIR}/public/audio/${DATE}"

if [ ! -f "$EPISODE_FILE" ]; then
  echo "Episode file not found: $EPISODE_FILE"
  exit 1
fi

mkdir -p "$AUDIO_DIR"

echo "Generating audio for ${DATE}..."

# ── Generate narration with KittenTTS ───────────────────────
echo "  Narration (KittenTTS Hugo)..."

/opt/homebrew/bin/python3.10 - "$EPISODE_FILE" "$AUDIO_DIR" << 'PYEOF'
import json, os, sys

episode_file = sys.argv[1]
audio_dir = sys.argv[2]
episode = json.load(open(episode_file))

from kittentts import KittenTTS
model = KittenTTS("KittenML/kitten-tts-mini-0.8")

headlines = episode['scenes']['headlines']
repos = episode['trending'][:3]

narrations = {
    "masthead": f"Intelligence Brief. {episode['scenes']['masthead']['subtitle']}. Daily Edition.",
    "headline-1": f"{headlines[0]['text']}. {headlines[0]['metric']} on {headlines[0]['source']}.",
    "headline-2": f"{headlines[1]['text']}. {headlines[1]['metric']} on {headlines[1]['source']}.",
    "headline-3": f"{headlines[2]['text']}. {headlines[2]['metric']} on {headlines[2]['source']}.",
    "trending": "Trending on GitHub. " + " ".join([f"{r['name']}, {r['delta']} today." for r in repos]),
    "takeaway": episode['scenes']['takeaway']['text'],
}

for name, text in narrations.items():
    out = os.path.join(audio_dir, f"narration-{name}.wav")
    model.generate_to_file(text, out, voice="Hugo", speed=1.15)
    dur = os.path.getsize(out) / (44100 * 2)  # rough duration estimate
    print(f"    {name} ({dur:.1f}s)")
PYEOF

# ── Generate sound effects with sox ─────────────────────────
echo "  Sound effects..."

# Whoosh (filtered noise sweep)
sox -n "$AUDIO_DIR/sfx-whoosh.wav" synth 0.4 noise band 800 400 fade t 0 0.4 0.15 gain -12 2>/dev/null

# Impact (low thud for headline reveals)
sox -n "$AUDIO_DIR/sfx-impact.wav" synth 0.15 sine 80 fade t 0 0.15 0.1 gain -8 2>/dev/null

# Tick (short click for counter animation)
sox -n "$AUDIO_DIR/sfx-tick.wav" synth 0.05 sine 2000 fade t 0 0.05 0.02 gain -15 2>/dev/null

# ── Generate ambient music bed ──────────────────────────────
echo "  Ambient music bed..."

# Warm drone: layered sine waves with gentle tremolo, 58 seconds
sox -n "$AUDIO_DIR/ambient.wav" \
  synth 58 sine 110 sine 165 sine 220 \
  tremolo 0.5 20 \
  fade t 2 58 3 \
  gain -28 \
  2>/dev/null

# ── Single web brief: concat narration (scene order) → brief.mp3 (or brief.wav) ──
echo "  Merging narration for web player (Remotion / <audio>)..."
MERGED="$AUDIO_DIR/brief-narration-merged.wav"
rm -f "$AUDIO_DIR/brief.mp3" "$AUDIO_DIR/brief.wav" "$MERGED"

sox \
  "$AUDIO_DIR/narration-masthead.wav" \
  "$AUDIO_DIR/narration-headline-1.wav" \
  "$AUDIO_DIR/narration-headline-2.wav" \
  "$AUDIO_DIR/narration-headline-3.wav" \
  "$AUDIO_DIR/narration-trending.wav" \
  "$AUDIO_DIR/narration-takeaway.wav" \
  "$MERGED" 2>/dev/null || {
  echo "    ⚠ sox merge failed (missing narration WAVs?); skip brief.mp3"
}

if [ -f "$MERGED" ]; then
  if command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg -y -loglevel error -i "$MERGED" -codec:a libmp3lame -q:a 4 "$AUDIO_DIR/brief.mp3"
    rm -f "$MERGED"
    echo "    ✓ brief.mp3 (MP3, browser-safe)"
  else
    mv "$MERGED" "$AUDIO_DIR/brief.wav"
    echo "    ✓ brief.wav (PCM; install ffmpeg for smaller brief.mp3)"
  fi
fi

echo ""
echo "  ✓ Audio at $AUDIO_DIR"
ls -lh "$AUDIO_DIR"
