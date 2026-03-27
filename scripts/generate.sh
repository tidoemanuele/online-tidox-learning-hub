#!/bin/bash
# generate.sh — Daily episode generation orchestrator
#
# Runs the full pipeline: scrape → analyze → transform → build
# Designed for both manual execution and GitHub Actions cron.
#
# Usage:
#   ./scripts/generate.sh              # today's date
#   ./scripts/generate.sh 2026-03-27   # specific date
#   DRY_RUN=1 ./scripts/generate.sh    # skip scraping, use existing data

set -euo pipefail

DATE="${1:-$(date +%Y-%m-%d)}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RESEARCH_DIR="/Users/etido/Documents/learn/docs/research/${DATE}"
SCRAPED_DIR="${RESEARCH_DIR}/scraped"
EPISODE_FILE="${PROJECT_DIR}/src/content/episodes/${DATE}.json"

echo "========================================"
echo "  Tidox Learning Hub — Episode Generator"
echo "  Date: ${DATE}"
echo "========================================"
echo ""

# Track timing
START_TIME=$(date +%s)
STEP_TIMES=()

step_start() { STEP_START=$(date +%s); }
step_end() {
  local elapsed=$(( $(date +%s) - STEP_START ))
  STEP_TIMES+=("$1: ${elapsed}s")
  echo "  ✓ $1 completed in ${elapsed}s"
  echo ""
}

# ── Step 1: Verify or run scraping ──────────────────────────
echo "Step 1: Checking scraped data..."
step_start

if [ -d "$SCRAPED_DIR" ] && [ "$(ls "$SCRAPED_DIR"/*.json 2>/dev/null | wc -l)" -gt 0 ]; then
  SOURCE_COUNT=$(ls "$SCRAPED_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
  echo "  Found ${SOURCE_COUNT} scraped sources for ${DATE}"
else
  if [ "${DRY_RUN:-0}" = "1" ]; then
    echo "  ⚠ DRY_RUN: No scraped data, skipping scrape step"
  else
    echo "  No scraped data found. Running scraper..."
    SCRAPER="/Users/etido/Documents/learn/research-browser/scrape-daily.sh"
    if [ -x "$SCRAPER" ]; then
      "$SCRAPER" "$DATE" || echo "  ⚠ Scraper had errors (continuing with partial data)"
    else
      echo "  ⚠ Scraper not found at ${SCRAPER}"
      echo "  Checking if awesome-emerging scraper is available..."
      AE_SCRAPER="/Users/etido/Code/tidoemanuele/awesome-emerging/scripts/research.mjs"
      if [ -f "$AE_SCRAPER" ]; then
        echo "  Running Lightpanda scraper..."
        cd /Users/etido/Code/tidoemanuele/awesome-emerging && node scripts/research.mjs || echo "  ⚠ Lightpanda scraper had errors"
        cd "$PROJECT_DIR"
      else
        echo "  ⚠ No scraper available. Using existing data only."
      fi
    fi
  fi
fi

# Verify minimum data threshold (8/14 sources)
if [ -d "$SCRAPED_DIR" ]; then
  SOURCE_COUNT=$(ls "$SCRAPED_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
  if [ "$SOURCE_COUNT" -lt 8 ]; then
    echo "  ⚠ Only ${SOURCE_COUNT}/14 sources available (threshold: 8)"
    echo "  Proceeding with partial data..."
  fi
fi
step_end "Scrape verification"

# ── Step 2: Transform to EpisodeProps ───────────────────────
echo "Step 2: Generating EpisodeProps..."
step_start

cd "$PROJECT_DIR"
npx tsx scripts/scrape-to-props.ts "$DATE"

if [ ! -f "$EPISODE_FILE" ]; then
  echo "  ✗ Failed to generate episode JSON"
  exit 1
fi
step_end "Transform"

# ── Step 3: Validate with Astro build ───────────────────────
echo "Step 3: Building site..."
step_start

cd "$PROJECT_DIR"
npm run build 2>&1 | tail -5

PAGES=$(grep -c "index.html" <<< "$(find dist -name 'index.html')" 2>/dev/null || echo "?")
echo "  ${PAGES} pages generated"
step_end "Astro build"

# ── Summary ─────────────────────────────────────────────────
TOTAL_TIME=$(( $(date +%s) - START_TIME ))

echo "========================================"
echo "  Pipeline complete in ${TOTAL_TIME}s"
echo "========================================"
echo ""
for t in "${STEP_TIMES[@]}"; do
  echo "  $t"
done
echo ""
echo "  Episode: ${EPISODE_FILE}"
echo "  Preview: npm run preview"
echo ""

# Exit 0 on success (important for CI)
exit 0
