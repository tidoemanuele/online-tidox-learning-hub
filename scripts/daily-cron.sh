#!/bin/zsh
# daily-cron.sh — Full daily pipeline: research → transform → publish
#
# Uses /last30days skill as primary research engine, with agent-browser as fallback.
# Produces grounded research across Reddit, X, HN, Polymarket, and the web,
# then transforms into EpisodeProps and publishes to the site.
#
# Cron setup (run at 07:00 daily):
#   0 7 * * * ~/Code/tidoemanuele/online-tidox-learning-hub/scripts/daily-cron.sh >> /tmp/tidox-daily.log 2>&1

# No set -e or -u. Cron scripts must be resilient.
# Steps fail individually. Critical failures exit explicitly.

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

# Load full shell environment (cron has minimal PATH)
export HOME="/Users/etido"
[[ -f "$HOME/.zprofile" ]] && source "$HOME/.zprofile" 2>/dev/null
[[ -f "$HOME/.zshrc" ]] && source "$HOME/.zshrc" 2>/dev/null
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
NVM_NODE="$(ls -d "$HOME/.nvm/versions/node/"*(/) 2>/dev/null | tail -1)"
[[ -n "$NVM_NODE" ]] && export PATH="$NVM_NODE/bin:$PATH"

FAILED_STEPS=()
step_start() { STEP_START=$(date +%s); }
step_end() {
  local elapsed=$(( $(date +%s) - STEP_START ))
  STEP_TIMES+=("$1: ${elapsed}s")
  echo "${LOG_PREFIX}   ✓ $1 (${elapsed}s)"
}
STEP_TIMES=()
START_TIME=$(date +%s)

# ── Step 1: Scraping ────────────────────────────────────────
echo ""
echo "${LOG_PREFIX} Step 1: Running scrapers..."
step_start

SCRAPER="/Users/etido/Documents/learn/research-browser/scrape-daily.sh"
if [[ -f "$SCRAPER" ]]; then
  cd "/Users/etido/Documents/learn"
  /bin/zsh "$SCRAPER" "$DATE" 2>&1 | tail -5 || FAILED_STEPS+=("scrape")
  SOURCE_COUNT=$(ls "$SCRAPED_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
  echo "${LOG_PREFIX}   Scraped ${SOURCE_COUNT} sources"
else
  echo "${LOG_PREFIX}   ⚠ Scraper not found at ${SCRAPER}"
  FAILED_STEPS+=("scrape")
fi

step_end "Scraping"

# ── Step 2: AI Research + Synthesis (single Claude session) ─
echo ""
echo "${LOG_PREFIX} Step 2: AI research + synthesis..."
step_start

mkdir -p "$RESEARCH_DIR"

# Single Claude session: search the web, read scraped data, produce everything
RESEARCH_PROMPT="You are running the daily tech intelligence research for ${DATE}.

STEP 1 — GATHER DATA:
- Read scraped data at ${SCRAPED_DIR}/ if it exists (JSON files from HN, GitHub Trending, Reddit, etc.)
- Use web search to find: what's trending on GitHub today, top Hacker News stories, major AI/dev tool news, any security incidents
- Look at: https://news.ycombinator.com, GitHub trending, and search for '${DATE} AI developer tools news'

STEP 2 — WRITE RESEARCH SUMMARY:
Write a daily research summary to: ${RESEARCH_DIR}/daily-research-${DATE}.md
Include: top signal, hypotheses with evidence, confidence assessments.
Follow the format of previous summaries in ${RESEARCH_DIR}/../

STEP 3 — WRITE EDITORIAL INSIGHTS:
Update ${AE_DIR}/src/data/insights.ts — add a new entry at the TOP of the insights array for date '${DATE}'.
Each insight: 1-2 sentences with specific data points (HN points, GitHub stars/day, names).
Write 6-8 insights. Follow the exact format and voice of existing entries.
Read the existing file first to match the style precisely.

STEP 4 — VERIFY:
Confirm both files were written. Print the insight texts you wrote."

cd "$LEARN_DIR"
# Try claude CLI first. If not logged in, fall back to direct HN fetch + template insights.
CLAUDE_OUT=$(claude -p "$RESEARCH_PROMPT" --max-turns 40 --dangerously-skip-permissions 2>&1)
if echo "$CLAUDE_OUT" | grep -qi "not logged in\|login\|unauthorized"; then
  echo "${LOG_PREFIX}   ⚠ Claude not authenticated. Falling back to direct data fetch..."

  # Direct HN fetch via curl
  mkdir -p "$SCRAPED_DIR"
  python3 -c "
import json, urllib.request
ids = json.loads(urllib.request.urlopen('https://hacker-news.firebaseio.com/v0/topstories.json').read())[:15]
stories = []
for id in ids:
    try:
        item = json.loads(urllib.request.urlopen(f'https://hacker-news.firebaseio.com/v0/item/{id}.json').read())
        stories.append({'rank': len(stories)+1, 'title': item.get('title',''), 'url': item.get('url',''), 'points': item.get('score',0), 'comments': item.get('descendants',0)})
    except: pass
with open('$SCRAPED_DIR/hacker-news.json', 'w') as f:
    json.dump(stories, f, indent=2)
print(f'Fetched {len(stories)} HN stories directly')
" 2>&1

  echo "${LOG_PREFIX}   ✓ Direct data fetch complete (no Claude synthesis — insights.ts not updated)"
  echo "${LOG_PREFIX}   ⚠ Run research manually: cd $HUB_DIR && claude"
  FAILED_STEPS+=("claude-auth")
else
  echo "$CLAUDE_OUT" | tail -10
  echo "${LOG_PREFIX}   ✓ Research + synthesis complete"
fi

step_end "AI research + synthesis"

# ── Step 3: Transform to EpisodeProps ───────────────────────
echo ""
echo "${LOG_PREFIX} Step 3: Transforming to EpisodeProps..."
step_start

cd "$HUB_DIR"
export RESEARCH_BASE="${LEARN_DIR}/docs/research"
export LEARN_DOCS_ROOT="${LEARN_DIR}/docs"
EPISODE_FILE="${HUB_DIR}/src/content/episodes/${DATE}.json"

if npx tsx scripts/scrape-to-props.ts "$DATE" 2>&1 | tail -8; then
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
  echo "${LOG_PREFIX}   ✓ Pushed."

  # Deploy to Vercel
  echo "${LOG_PREFIX}   Waiting 60s for push to settle..."
  sleep 60
  cd "$HUB_DIR"
  vercel --prod --yes 2>&1 | tail -3
  echo "${LOG_PREFIX}   ✓ Vercel deployed."
fi

# ── Summary ─────────────────────────────────────────────────
TOTAL_TIME=$(( $(date +%s) - START_TIME ))
echo ""
echo "========================================"
echo "  Pipeline complete — ${TOTAL_TIME}s total"
echo "========================================"
for t in "${STEP_TIMES[@]+"${STEP_TIMES[@]}"}"; do
  [ -n "$t" ] && echo "  $t"
done
if [ ${#FAILED_STEPS[@]+"${#FAILED_STEPS[@]}"} -eq 0 ] 2>/dev/null; then
  echo "  Status: ALL STEPS SUCCEEDED"
else
  echo "  Status: COMPLETED WITH WARNINGS: ${FAILED_STEPS[*]+"${FAILED_STEPS[*]}"}"
fi
echo "========================================"
