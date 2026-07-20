#!/bin/zsh
# finisher.sh — Pull the day's episode and deploy.
#
# Single-engine era: learn-2026 (06:15) runs publish.sh which transforms, builds,
# and pushes the episode to origin. This script (07:30) pulls that and deploys to
# Vercel. In-house Edge-TTS narration was removed 2026-07-20 — the hub is text-only;
# the real podcast is NotebookLM, kept privately in the Obsidian vault.
#
# Cron: 30 7 * * * ~/Code/tidoemanuele/online-tidox-learning-hub/scripts/finisher.sh >> /tmp/tidox-finisher.log 2>&1

DATE="$(date +%Y-%m-%d)"
HUB_DIR="$HOME/Code/tidoemanuele/online-tidox-learning-hub"

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

# Step 1: Pull latest (learn-2026's publish.sh push)
echo "[$(date '+%H:%M:%S')] Pulling latest..."
git stash 2>/dev/null
git fetch origin 2>/dev/null
git reset --hard origin/master 2>&1 | tail -1

EPISODE="$HUB_DIR/src/content/episodes/${DATE}.json"
if [[ ! -f "$EPISODE" ]]; then
  echo "[$(date '+%H:%M:%S')] No episode for ${DATE}. learn-2026 publish may not have run yet."
  exit 0
fi

# Step 2: Build + deploy (publish.sh already built/pushed; this guarantees a prod deploy)
echo "[$(date '+%H:%M:%S')] Building..."
npm run build --silent 2>&1 | tail -2

echo "[$(date '+%H:%M:%S')] Deploying to Vercel..."
vercel --prod --yes 2>&1 | tail -2

echo ""
echo "========================================"
echo "  Finisher complete — $(date)"
echo "========================================"
