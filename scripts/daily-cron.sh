#!/bin/bash
# daily-cron.sh — Full daily pipeline: scrape → research → transform → publish
#
# Runs the entire intelligence brief pipeline locally on this machine.
# Sources research data from ~/Documents/learn, publishes to this project.
#
# Cron setup (run at 07:00 daily):
#   0 7 * * * ~/Code/tidoemanuele/online-tidox-learning-hub/scripts/daily-cron.sh >> /tmp/tidox-daily.log 2>&1
#
# Prerequisites:
#   - agent-browser installed (npm install -g agent-browser)
#   - Claude Code CLI (claude) in PATH
#   - Node.js + npx available
#   - Git configured with push access

set -euo pipefail

DATE="$(date +%Y-%m-%d)"
LOG_PREFIX="[$(date '+%H:%M:%S')]"
HUB_DIR="$HOME/Code/tidoemanuele/online-tidox-learning-hub"
LEARN_DIR="$HOME/Documents/learn"
AE_DIR="$HOME/Code/tidoemanuele/awesome-emerging"
RESEARCH_DIR="${LEARN_DIR}/docs/research/${DATE}"
SCRAPED_DIR="${RESEARCH_DIR}/scraped"

echo ""
echo "========================================"
echo "  Tidox Daily Pipeline — ${DATE}"
echo "  Started: $(date)"
echo "========================================"

# Ensure PATH includes common tool locations
export PATH="$HOME/.local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node/ 2>/dev/null | tail -1)/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

FAILED_STEPS=()

# ── Step 1: Scrape ──────────────────────────────────────────
echo ""
echo "${LOG_PREFIX} Step 1: Scraping 14 sources..."

SCRAPER="${LEARN_DIR}/research-browser/scrape-daily.sh"
if [ -x "$SCRAPER" ]; then
  cd "$LEARN_DIR"
  if "$SCRAPER" "$DATE" 2>&1 | tail -5; then
    SOURCE_COUNT=$(ls "$SCRAPED_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
    echo "${LOG_PREFIX}   ✓ Scraped ${SOURCE_COUNT} sources"
  else
    echo "${LOG_PREFIX}   ⚠ Scraper had errors (continuing)"
    FAILED_STEPS+=("scrape")
  fi
else
  echo "${LOG_PREFIX}   ✗ Scraper not found at ${SCRAPER}"
  FAILED_STEPS+=("scrape")
fi

# Check minimum sources
if [ -d "$SCRAPED_DIR" ]; then
  SOURCE_COUNT=$(ls "$SCRAPED_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
  if [ "$SOURCE_COUNT" -lt 5 ]; then
    echo "${LOG_PREFIX}   ✗ Only ${SOURCE_COUNT} sources. Aborting."
    exit 1
  fi
fi

# ── Step 2: AI Research Session ─────────────────────────────
echo ""
echo "${LOG_PREFIX} Step 2: Running AI research session..."

cd "$LEARN_DIR"
RESEARCH_PROMPT="Run the daily research for ${DATE}. The scraped data is at docs/research/${DATE}/scraped/. Read the research-config.yaml for topics. Produce the daily research summary at docs/research/${DATE}/daily-research-${DATE}.md and update the insights in the awesome-emerging repo at ${AE_DIR}/src/data/insights.ts with today's entries. Follow the existing format exactly."

if claude -p "$RESEARCH_PROMPT" --max-turns 30 2>&1 | tail -20; then
  echo "${LOG_PREFIX}   ✓ Research session complete"
else
  echo "${LOG_PREFIX}   ⚠ Research session had issues"
  FAILED_STEPS+=("research")
fi

# Verify outputs exist
if [ ! -f "${RESEARCH_DIR}/daily-research-${DATE}.md" ]; then
  echo "${LOG_PREFIX}   ⚠ No research summary generated"
  FAILED_STEPS+=("research-output")
fi

# ── Step 3: Transform to EpisodeProps ───────────────────────
echo ""
echo "${LOG_PREFIX} Step 3: Transforming to EpisodeProps..."

cd "$HUB_DIR"
if npx tsx scripts/scrape-to-props.ts "$DATE" 2>&1 | tail -5; then
  echo "${LOG_PREFIX}   ✓ Episode JSON generated"
else
  echo "${LOG_PREFIX}   ✗ Transform failed"
  FAILED_STEPS+=("transform")
  exit 1
fi

# ── Step 4: Build ───────────────────────────────────────────
echo ""
echo "${LOG_PREFIX} Step 4: Building site..."

cd "$HUB_DIR"
if npm run build --silent 2>&1 | tail -3; then
  echo "${LOG_PREFIX}   ✓ Build succeeded"
else
  echo "${LOG_PREFIX}   ✗ Build failed"
  FAILED_STEPS+=("build")
  exit 1
fi

# ── Step 5: Publish ─────────────────────────────────────────
echo ""
echo "${LOG_PREFIX} Step 5: Publishing..."

cd "$HUB_DIR"
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard src/content/episodes/)" ]; then
  echo "${LOG_PREFIX}   No new changes to publish."
else
  git add src/content/episodes/
  git commit -m "episode: ${DATE} daily intelligence brief" --quiet
  git push --quiet
  echo "${LOG_PREFIX}   ✓ Pushed to GitHub. Vercel deploying."
fi

# ── Summary ─────────────────────────────────────────────────
echo ""
echo "========================================"
echo "  Pipeline complete — $(date)"
if [ ${#FAILED_STEPS[@]} -eq 0 ]; then
  echo "  Status: ALL STEPS SUCCEEDED"
else
  echo "  Status: COMPLETED WITH WARNINGS"
  echo "  Failed steps: ${FAILED_STEPS[*]}"
fi
echo "========================================"
