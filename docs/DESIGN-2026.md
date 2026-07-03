# Hub 2026 — Design (validated against OKF / Learn 2026)

**Date:** 2026-07-03 · **Companion doc:** `~/Documents/learn/LEARN-2026.md` (master architecture)

## 1. Verdict: do NOT adopt OKF here

The hub was audited against the Google Open Knowledge Format (OKF v0.1) / Karpathy LLM-wiki pattern that Learn 2026 standardizes on. Conclusion: **genre mismatch — keep the episode model.**

- OKF is for **durable, cross-linked concepts** (markdown + YAML frontmatter, index/log, link graph).
- The hub is a **time-series of daily news snapshots**: date-keyed JSON episodes validated by a strict Zod schema (`src/content.config.ts`), rendered by 4 Astro routes and a Remotion video pipeline that reads the same schema. Episodes are ephemeral by nature; they don't want to be concept pages.
- Adopting OKF would mean rewriting the content collection, all pages, and `packages/video` — for content that gains nothing from a concept graph.

**Division of labor (from the master design):** the OKF store and LLM wiki live in the Obsidian vault, fed by the `learn` pipeline. The hub stays what it already is — a healthy public **publishing target** (103 consecutive episodes, current through today, audio + video). One optional bridge later: episodes may carry `related` slugs pointing at vault wiki concepts if a public wiki export ever ships.

## 2. The actual 10x for the hub: one upstream, not two pipelines

Today three repos are entangled:

1. `learn` scrapes 14 sources via agent-browser → its own research tree.
2. The hub *also* scrapes 4 sources via `scripts/refresh-scraped.ts` → its own `research/{date}/scraped/`.
3. Episode insights are regex-parsed out of a 347 KB hand/AI-edited TS file in a **third repo** (`awesome-emerging/src/data/insights.ts`, `scrape-to-props.ts:246-262`) — brittle, no package boundary.
4. Bonus bug: `scrape-to-props.ts:22` hardcodes `RESEARCH_BASE = ../research`, ignoring the env var `daily-cron.sh:132` exports — the two local paths silently diverge; only the GitHub-Actions path is self-consistent.

**Target flow:**

```
learn daily run (single grounded pass)
  └── docs/research/{date}/insights.json   ← NEW structured handoff
        └── hub scrape-to-props.ts reads it directly
              └── episode JSON → build → TTS → Remotion → Vercel
```

- `insights.json` schema = exactly what the episode needs: `{date, insights[{text, tags, source, url}], trending[], numbers[], heroStat?}`. Produced by the same research pass that writes the daily brief — one analysis, two renderings (vault knowledge + public episode).
- **Delete** the awesome-emerging regex path and the hub's duplicate scraper as the primary path; keep `refresh-scraped.ts` only as the GitHub-Actions *fallback* when no `insights.json` was committed (unattended-day resilience — this fallback already exists and works).
- Fix `RESEARCH_BASE` to honor the env var, defaulting to the learn repo path.

## 3. Fix list (mechanical)

| Item | Action |
|---|---|
| `awesome-emerging` regex dependency | replace with `insights.json` (above) |
| `RESEARCH_BASE` env-vs-hardcode mismatch | honor env var in `scrape-to-props.ts` |
| `astro.config.mjs` `site: 'https://tidox.hub'` placeholder | set real Vercel domain (sitemap/canonicals currently wrong) |
| `episodeNumber` = `readdirSync().length + 1` | derive from date ordering (backfill-safe) |
| No README | add one describing the episode pipeline + the Learn-2026 handoff |
| TODOS.md items (Remotion CI render cost, atomic deploy, Blob-vs-R2 for ~25 MB/day media) | keep as-is — still valid, orthogonal |

## 4. What explicitly stays

- Astro 5 static + Vercel deploy, episode Zod schema, 4 routes, prev/next nav.
- `packages/video` Remotion pipeline (the product's differentiator).
- Edge-TTS audio per episode — this plus NotebookLM Deep Dive (vault side) are the two daily audio channels; the learn repo's dead `media-pipeline/` is retired instead of resurrected.
- GitHub Actions daily-episode fallback + deploy workflow.
