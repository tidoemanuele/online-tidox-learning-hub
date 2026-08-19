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
#
# 2026-08-19 postmortem: this step used to `git reset --hard origin/master` from
# whatever branch was checked out. When publish.sh's push failed, the day's episode
# commit lived only in the local branch — and this reset destroyed it, so the log
# said "No episode" and the real failure (a rejected push) stayed invisible for
# twelve days. Now: switch to master first, and never discard local commits that
# origin does not already have.
echo "[$(date '+%H:%M:%S')] Pulling latest..."
git fetch origin 2>/dev/null

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "master" ]]; then
  echo "[$(date '+%H:%M:%S')] ⚠ On branch ${CURRENT_BRANCH}, expected master. Switching..."
  git checkout master --quiet || {
    echo "[$(date '+%H:%M:%S')] ✗ Cannot switch to master. Deploy skipped — fix the working copy."
    exit 1
  }
fi

# Unpushed episode commits mean publish.sh failed to push. Retry the push instead of
# resetting them away.
UNPUSHED="$(git rev-list --count origin/master..master)"
if [[ "$UNPUSHED" -gt 0 ]]; then
  echo "[$(date '+%H:%M:%S')] ⚠ ${UNPUSHED} local commit(s) not on origin/master — retrying push..."
  git push origin master 2>&1 | tail -1
fi

git merge --ff-only origin/master 2>&1 | tail -1

# Step 1b: Backfill. Any day with a research bundle but no published episode never
# reached the site (failed push, Mac asleep, publish crash). Without this, a single
# missed day stays missed forever — that is how 2026-08-07..08-19 went dark. Bounded
# to the last 14 days so this stays a heal, not a rebuild.
RESEARCH_DIR="$HOME/Code/tidoemanuele/learn-2026/docs/research"
if [[ -d "$RESEARCH_DIR" ]]; then
  for i in {13..1}; do
    D="$(date -v-${i}d +%Y-%m-%d)"
    [[ -f "$HUB_DIR/src/content/episodes/${D}.json" ]] && continue
    [[ -f "$RESEARCH_DIR/${D}/insights.json" || -f "$RESEARCH_DIR/${D}/daily-brief.md" ]] || continue
    echo "[$(date '+%H:%M:%S')] ⚠ Missing episode ${D} — backfilling from research bundle..."
    RESEARCH_BASE="$RESEARCH_DIR" LEARN_RESEARCH_BASE="$RESEARCH_DIR" \
      ./scripts/publish.sh "$D" 2>&1 | tail -2 \
      || echo "[$(date '+%H:%M:%S')] ⚠ backfill of ${D} failed"
  done
fi

EPISODE="$HUB_DIR/src/content/episodes/${DATE}.json"
if [[ ! -f "$EPISODE" ]]; then
  echo "[$(date '+%H:%M:%S')] ✗ No episode for ${DATE}. Check /Users/etido/Library/Logs/learn-2026.log for the learn-2026 run and its hub publish step."
  "$HOME/bin/claude-speak" --chime "Tidox hub has no episode for today. Check the learn 2026 log." 2>/dev/null || true
  exit 1
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
