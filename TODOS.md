# TODOS

## Phase 5: Benchmark Remotion render time on GitHub Actions
**What:** Benchmark Remotion CLI render of the 60s video brief on a GitHub Actions runner (2-core, 7GB RAM) before committing to the daily pipeline time budget.
**Why:** Outside voice flagged that the design doc estimates 2-3min but realistic renders on constrained runners could take 8-15min. At 50-60min/day total, the 2000min/month GitHub Actions free tier would have no margin for retries.
**How to apply:** Run a test workflow in Phase 5 that renders one episode and measures wall time. If >10min, evaluate: (a) self-hosted runner on a home machine, (b) Remotion Lambda for serverless render ($0.01-0.05/render), (c) render locally and upload MP4 to R2.
**Depends on:** Phase 2 (Remotion scenes must exist to benchmark)

## Phase 5: Design pipeline-to-deploy handoff
**What:** Define how the daily pipeline signals "episode ready" to trigger the Vercel rebuild, and ensure partial failures don't deploy broken episodes.
**Why:** The pipeline takes 30-45min. There's no mechanism connecting "pipeline finished" to "Vercel rebuilds." A naive git push after each step could deploy half-baked episodes if a later step fails.
**How to apply:** Options: (a) atomic git push only after ALL steps succeed, (b) GitHub Actions workflow_dispatch for deploy as a separate job, (c) Vercel deploy hook URL called by the orchestrator script after validation. Recommend (a) for simplicity.
**Depends on:** Phase 5 orchestrator script (generate.sh)

## Phase 4: Evaluate Vercel Blob vs Cloudflare R2 for asset hosting
**What:** When first MP3/MP4 assets are ready, compare Vercel Blob (same ecosystem, 500MB free) vs Cloudflare R2 (10GB free, no egress, separate ecosystem) for audio/video hosting.
**Why:** R2 wins on storage limits but adds operational complexity (two auth configs, two failure domains). Vercel Blob is simpler but may run out of space in ~20 days at 25MB/day.
**How to apply:** Start with Vercel Blob if the first month's assets fit in 500MB. Migrate to R2 when approaching limits. This is a reversible decision.
**Depends on:** Phase 4 (first real assets generated)
