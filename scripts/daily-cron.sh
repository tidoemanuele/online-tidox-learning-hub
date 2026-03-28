#!/bin/bash
# daily-cron.sh — Full daily pipeline: research → transform → publish
#
# Uses /last30days skill as primary research engine, with agent-browser as fallback.
# Produces grounded research across Reddit, X, HN, Polymarket, and the web,
# then transforms into EpisodeProps and publishes to the site.
#
# Cron setup (run at 07:00 daily):
#   0 7 * * * ~/Code/tidoemanuele/online-tidox-learning-hub/scripts/daily-cron.sh >> /tmp/tidox-daily.log 2>&1

set -euo pipefail

DATE="$(date +%Y-%m-%d)"
LOG_PREFIX="[$(date '+%H:%M:%S')]"
HUB_DIR="$HOME/Code/tidoemanuele/online-tidox-learning-hub"
LEARN_DIR="$HOME/Documents/learn"
AE_DIR="$HOME/Code/tidoemanuele/awesome-emerging"
RESEARCH_DIR="${LEARN_DIR}/docs/research/${DATE}"
SCRAPED_DIR="${RESEARCH_DIR}/scraped"
LAST30DAYS_DIR="$HOME/Documents/Last30Days"

echo ""
echo "========================================"
echo "  Tidox Daily Pipeline — ${DATE}"
echo "  Started: $(date)"
echo "========================================"

export PATH="$HOME/.local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node/ 2>/dev/null | tail -1)/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

FAILED_STEPS=()
step_start() { STEP_START=$(date +%s); }
step_end() {
  local elapsed=$(( $(date +%s) - STEP_START ))
  STEP_TIMES+=("$1: ${elapsed}s")
  echo "${LOG_PREFIX}   ✓ $1 (${elapsed}s)"
}
STEP_TIMES=()
START_TIME=$(date +%s)

# ── Step 1: Research with /last30days ───────────────────────
echo ""
echo "${LOG_PREFIX} Step 1: Running /last30days research..."
step_start

mkdir -p "$RESEARCH_DIR/last30days"

# Research topics matching our research-config.yaml
TOPICS=(
  "AI coding tools and AI agents trending this week"
  "GitHub trending repositories and open source projects today"
  "developer productivity tools and solo developer workflows"
  "AI security vulnerabilities and supply chain attacks"
)

for topic in "${TOPICS[@]}"; do
  SLUG=$(echo "$topic" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | cut -c1-40)
  echo "${LOG_PREFIX}   Researching: ${topic:0:50}..."

  cd "$HUB_DIR"
  claude -p "/last30days $topic --days=1 --quick" --max-turns 15 \
    > "$RESEARCH_DIR/last30days/${SLUG}.md" 2>/dev/null || true
done

L30D_COUNT=$(ls "$RESEARCH_DIR/last30days/"*.md 2>/dev/null | wc -l | tr -d ' ')
echo "${LOG_PREFIX}   /last30days produced ${L30D_COUNT} reports"

step_end "last30days research"

# ── Step 1b: Fallback scraping (if last30days insufficient) ─
echo ""
echo "${LOG_PREFIX} Step 1b: Running agent-browser scraping..."
step_start

SCRAPER="${LEARN_DIR}/research-browser/scrape-daily.sh"
if [ -x "$SCRAPER" ]; then
  cd "$LEARN_DIR"
  "$SCRAPER" "$DATE" 2>&1 | tail -3 || FAILED_STEPS+=("scrape")
  SOURCE_COUNT=$(ls "$SCRAPED_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
  echo "${LOG_PREFIX}   Scraped ${SOURCE_COUNT} sources"
else
  echo "${LOG_PREFIX}   ⚠ Scraper not found (continuing with last30days data)"
fi

step_end "agent-browser scraping"

# ── Step 2: AI Analysis + Synthesis ─────────────────────────
echo ""
echo "${LOG_PREFIX} Step 2: AI synthesis session..."
step_start

cd "$LEARN_DIR"

# Build a prompt that uses BOTH last30days reports and scraped data
RESEARCH_PROMPT="Run the daily research synthesis for ${DATE}.

PRIMARY SOURCES (read these first):
- /last30days research reports at: ${RESEARCH_DIR}/last30days/
  These contain grounded findings from Reddit, X, HN, Polymarket with real citations.

SECONDARY SOURCES (cross-reference):
- Scraped data at: ${RESEARCH_DIR}/scraped/ (raw JSON from 14 tech sources)

TASK:
1. Read all /last30days reports and scraped data
2. Synthesize into a daily research summary at: ${RESEARCH_DIR}/daily-research-${DATE}.md
3. Extract the top 6-8 editorial insights and update: ${AE_DIR}/src/data/insights.ts
   Add a new entry for date '${DATE}' following the exact existing format.
   Each insight should be 1-2 sentences with specific data points and source attribution.
4. Follow the existing format and voice from previous entries in insights.ts exactly."

if claude -p "$RESEARCH_PROMPT" --max-turns 30 2>&1 | tail -10; then
  echo "${LOG_PREFIX}   ✓ Synthesis complete"
else
  echo "${LOG_PREFIX}   ⚠ Synthesis had issues"
  FAILED_STEPS+=("synthesis")
fi

step_end "AI synthesis"

# ── Step 3: Transform to EpisodeProps ───────────────────────
echo ""
echo "${LOG_PREFIX} Step 3: Transforming to EpisodeProps..."
step_start

cd "$HUB_DIR"
EPISODE_FILE="${HUB_DIR}/src/content/episodes/${DATE}.json"

if npx tsx scripts/scrape-to-props.ts "$DATE" 2>&1 | tail -3; then
  echo "${LOG_PREFIX}   ✓ Episode JSON generated"
else
  echo "${LOG_PREFIX}   ✗ Transform failed"
  FAILED_STEPS+=("transform")
  exit 1
fi

step_end "Transform"

# ── Step 4: Generate audio ──────────────────────────────────
echo ""
echo "${LOG_PREFIX} Step 4: Generating audio..."
step_start

if [ -x "$HUB_DIR/scripts/generate-audio.sh" ]; then
  "$HUB_DIR/scripts/generate-audio.sh" "$DATE" 2>&1 | tail -3 || FAILED_STEPS+=("audio")
else
  echo "${LOG_PREFIX}   ⚠ generate-audio.sh not found (skipping)"
fi

step_end "Audio generation"

# ── Step 5: Build ───────────────────────────────────────────
echo ""
echo "${LOG_PREFIX} Step 5: Building site..."
step_start

cd "$HUB_DIR"
npm run build --silent 2>&1 | tail -3

step_end "Astro build"

# ── Step 6: Publish ─────────────────────────────────────────
echo ""
echo "${LOG_PREFIX} Step 6: Publishing..."

cd "$HUB_DIR"
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard src/content/episodes/ public/audio/)" ]; then
  echo "${LOG_PREFIX}   No new changes to publish."
else
  git add src/content/episodes/ public/audio/ 2>/dev/null || true
  git add src/content/episodes/
  git commit -m "episode: ${DATE} daily intelligence brief" --quiet
  git push --quiet
  echo "${LOG_PREFIX}   ✓ Pushed. Vercel deploying."
fi

# ── Summary ─────────────────────────────────────────────────
TOTAL_TIME=$(( $(date +%s) - START_TIME ))
echo ""
echo "========================================"
echo "  Pipeline complete — ${TOTAL_TIME}s total"
echo "========================================"
for t in "${STEP_TIMES[@]}"; do
  echo "  $t"
done
if [ ${#FAILED_STEPS[@]} -eq 0 ]; then
  echo "  Status: ALL STEPS SUCCEEDED"
else
  echo "  Status: COMPLETED WITH WARNINGS: ${FAILED_STEPS[*]}"
fi
echo "========================================"
