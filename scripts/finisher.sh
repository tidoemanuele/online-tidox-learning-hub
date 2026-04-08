#!/bin/zsh
# finisher.sh — Runs after the remote trigger to add TTS audio + deploy
#
# The remote trigger (Anthropic cloud) generates the episode data and pushes.
# This local script pulls the new episode, generates TTS narration with
# Edge TTS (local only), and deploys to Vercel.
#
# Cron: runs 30 minutes after remote trigger (06:30 UTC = 07:30 Lisbon)
#   30 7 * * * ~/Code/tidoemanuele/online-tidox-learning-hub/scripts/finisher.sh >> /tmp/tidox-finisher.log 2>&1

DATE="$(date +%Y-%m-%d)"
HUB_DIR="$HOME/Code/tidoemanuele/online-tidox-learning-hub"
AUDIO_DIR="$HUB_DIR/public/audio/${DATE}"

export HOME="/Users/etido"
[[ -f "$HOME/.zprofile" ]] && source "$HOME/.zprofile" 2>/dev/null
[[ -f "$HOME/.zshrc" ]] && source "$HOME/.zshrc" 2>/dev/null
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

echo ""
echo "========================================"
echo "  Tidox Finisher — ${DATE}"
echo "  Started: $(date)"
echo "========================================"

cd "$HUB_DIR"

# Step 1: Pull latest from remote trigger
echo "[$(date '+%H:%M:%S')] Pulling latest..."
git stash 2>/dev/null
git fetch origin 2>/dev/null
git reset --hard origin/master 2>&1 | tail -1

EPISODE="$HUB_DIR/src/content/episodes/${DATE}.json"
if [[ ! -f "$EPISODE" ]]; then
  echo "[$(date '+%H:%M:%S')] No episode for ${DATE}. Remote trigger may not have run yet."
  exit 0
fi

# Step 2: Check if audio already exists
if [[ -f "$AUDIO_DIR/brief.mp3" ]] || [[ -f "$AUDIO_DIR/brief.wav" ]]; then
  echo "[$(date '+%H:%M:%S')] Audio already exists. Skipping TTS."
else
  echo "[$(date '+%H:%M:%S')] Generating TTS audio..."
  mkdir -p "$AUDIO_DIR"

  # Generate narration per scene using Edge TTS (local, free, neural voices)
  /opt/homebrew/bin/python3.10 - "$EPISODE" "$AUDIO_DIR" << 'PYEOF'
import json, os, sys, subprocess

episode = json.load(open(sys.argv[1]))
audio_dir = sys.argv[2]
headlines = episode.get('scenes', {}).get('headlines', [])
takeaway = episode.get('scenes', {}).get('takeaway', {}).get('text', '')
masthead = episode.get('scenes', {}).get('masthead', {})

VOICE = "en-US-ChristopherNeural"

narrations = {
    "masthead": f"Intelligence Brief. {masthead.get('subtitle', '')}.",
    "headline-1": headlines[0]['text'] if len(headlines) > 0 else "",
    "headline-2": headlines[1]['text'] if len(headlines) > 1 else "",
    "headline-3": headlines[2]['text'] if len(headlines) > 2 else "",
    "trending": "Trending on GitHub today.",
    "takeaway": takeaway[:200] if takeaway else "That's your brief for today.",
}

for name, text in narrations.items():
    if not text:
        continue
    mp3 = os.path.join(audio_dir, f"narration-{name}.mp3")
    wav = os.path.join(audio_dir, f"narration-{name}.wav")
    try:
        subprocess.run(["edge-tts", "--voice", VOICE, "--rate", "+5%",
                       "--text", text, "--write-media", mp3],
                      capture_output=True, check=True, timeout=30)
        subprocess.run(["ffmpeg", "-y", "-i", mp3, "-ar", "44100", "-ac", "1", wav],
                      capture_output=True, timeout=15)
        os.remove(mp3)
        print(f"  {name}: ok")
    except Exception as e:
        print(f"  {name}: FAILED ({e})")
PYEOF

  # Merge narrations into brief.mp3
  if command -v sox > /dev/null 2>&1 && command -v ffmpeg > /dev/null 2>&1; then
    MERGED="$AUDIO_DIR/brief-merged.wav"
    sox \
      "$AUDIO_DIR/narration-masthead.wav" \
      "$AUDIO_DIR/narration-headline-1.wav" \
      "$AUDIO_DIR/narration-headline-2.wav" \
      "$AUDIO_DIR/narration-headline-3.wav" \
      "$AUDIO_DIR/narration-trending.wav" \
      "$AUDIO_DIR/narration-takeaway.wav" \
      "$MERGED" 2>/dev/null

    if [[ -f "$MERGED" ]]; then
      ffmpeg -y -loglevel error -i "$MERGED" -codec:a libmp3lame -q:a 4 "$AUDIO_DIR/brief.mp3"
      rm -f "$MERGED"
      echo "[$(date '+%H:%M:%S')] ✓ brief.mp3 generated"
    fi
  fi
fi

# Step 3: Build and deploy
echo "[$(date '+%H:%M:%S')] Building..."
npm run build --silent 2>&1 | tail -2

echo "[$(date '+%H:%M:%S')] Committing audio..."
git add public/audio/ 2>/dev/null
git diff --cached --quiet || {
  git commit -m "audio: ${DATE} TTS narration" --quiet
  git push --quiet 2>&1
}

echo "[$(date '+%H:%M:%S')] Deploying to Vercel..."
vercel --prod --yes 2>&1 | tail -2

echo ""
echo "========================================"
echo "  Finisher complete — $(date)"
echo "========================================"
