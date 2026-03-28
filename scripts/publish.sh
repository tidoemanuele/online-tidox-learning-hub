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

# Step 1: Transform
echo "  Transforming scraped data..."
npx tsx scripts/scrape-to-props.ts "$DATE"

if [ ! -f "$EPISODE_FILE" ]; then
  echo "  ✗ No episode generated. Missing source data?"
  exit 1
fi

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
git push --quiet

echo "  ✓ Published. Vercel will deploy automatically."
echo "[$(date)] Done."
