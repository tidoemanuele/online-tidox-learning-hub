#!/bin/bash
# publish.sh — Local cron job: transform today's data, build, and push.
#
# Prerequisites: scraping + AI analysis already done (manual workflow).
# This script just publishes whatever data exists for today.
#
# Usage:
#   ./scripts/publish.sh              # today
#   ./scripts/publish.sh 2026-03-28   # specific date
#
# Cron example (run at 20:00 daily, after your research session):
#   0 20 * * * cd ~/Code/tidoemanuele/online-tidox-learning-hub && ./scripts/publish.sh >> /tmp/tidox-publish.log 2>&1

set -euo pipefail

DATE="${1:-$(date +%Y-%m-%d)}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EPISODE_FILE="${PROJECT_DIR}/src/content/episodes/${DATE}.json"

cd "$PROJECT_DIR"

echo "[$(date)] Publishing episode for ${DATE}..."

# Step 0: Publish from master, always.
# 2026-08-19 postmortem: the working copy was left on feat/episode-search, so the
# commit below landed on that branch and `git push` was rejected (non-fast-forward
# against its remote counterpart). Twelve episodes were generated daily, never
# pushed, then erased by finisher.sh's reset --hard. Pin the branch here instead of
# trusting whatever branch the last interactive session left checked out.
PUBLISH_BRANCH="master"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$PUBLISH_BRANCH" ]; then
  echo "  On branch ${CURRENT_BRANCH}; switching to ${PUBLISH_BRANCH}..."
  if ! git checkout "$PUBLISH_BRANCH" --quiet; then
    echo "  ✗ Cannot switch to ${PUBLISH_BRANCH} (uncommitted work on ${CURRENT_BRANCH}?). Aborting."
    exit 1
  fi
fi

# Step 1: Transform
echo "  Transforming scraped data..."
npx tsx scripts/scrape-to-props.ts "$DATE"

if [ ! -f "$EPISODE_FILE" ]; then
  echo "  ✗ No episode generated. Missing source data?"
  exit 1
fi

# In-house podcast/visual-beats enrichment removed 2026-07-20: the real podcast is
# NotebookLM (learn-2026 audio-sweeper). write-podcast-script.ts / generate-visual-beats.ts
# stay in the repo but are no longer wired into the daily publish.

# Step 2: Build (validates via Zod schema)
echo "  Building site..."
npm run build --silent

# Step 3: Commit + push (only if there are changes)
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard src/content/episodes/)" ]; then
  echo "  No new changes. Episode may already be published."
  exit 0
fi

git add src/content/episodes/
git commit -m "episode: ${DATE} daily intelligence brief" --quiet

# Explicit refspec: never let the ambient push default decide where an episode lands.
if ! git push origin "HEAD:${PUBLISH_BRANCH}" --quiet; then
  echo "  ✗ Push to origin/${PUBLISH_BRANCH} failed. Episode is committed locally only."
  exit 1
fi

echo "  ✓ Published. Vercel will deploy automatically."
echo "[$(date)] Done."
