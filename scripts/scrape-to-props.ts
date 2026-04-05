#!/usr/bin/env npx tsx
/**
 * scrape-to-props.ts — Transforms raw research data into EpisodeProps JSON.
 *
 * Input sources:
 *   1. Raw scraped JSON under {RESEARCH_BASE}/{date}/scraped/ (defaults to learn/docs/research when present)
 *   2. Per-topic technical writeups: learn/docs/analysis/research/{date}/technical-*.md (Executive Summary)
 *   3. Editorial insights from awesome-emerging/src/data/insights.ts
 *   4. Daily research summary markdown (for the takeaway)
 *
 * Output:
 *   src/content/episodes/{date}.json (validated EpisodeProps)
 *
 * Env:
 *   RESEARCH_BASE — override research root (folder containing {date}/scraped)
 *   LEARN_DOCS_ROOT — default ~/Documents/learn/docs (for analysis/research/{date})
 *
 * Usage:
 *   npx tsx scripts/scrape-to-props.ts 2026-03-27
 *   npx tsx scripts/scrape-to-props.ts          # defaults to today
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { extractTrendingFallbackFromTexts } from '../src/lib/hub-episode-utils.ts';

// --- Paths (hub root = parent of scripts/) ---
const HUB_ROOT = join(import.meta.dirname!, '..');
const HUB_RESEARCH = join(HUB_ROOT, 'research');
const HOME = process.env.HOME || '';
const DEFAULT_LEARN_DOCS = join(HOME, 'Documents', 'learn', 'docs');
const LEARN_DOCS_ROOT = process.env.LEARN_DOCS_ROOT || DEFAULT_LEARN_DOCS;
const DEFAULT_LEARN_RESEARCH = join(LEARN_DOCS_ROOT, 'research');

/**
 * When RESEARCH_BASE is unset: learn holds daily-research + topics, but hub/research
 * often has a richer scraped/ (Lobsters, PH, Show HN). We must not pick learn alone
 * when hub has more JSON — that dropped supplemental sources on the site.
 */
function resolveResearchBase(date: string): string {
  if (process.env.RESEARCH_BASE) return process.env.RESEARCH_BASE;
  const learnDateDir = join(DEFAULT_LEARN_RESEARCH, date);
  const hubDateDir = join(HUB_RESEARCH, date);
  const learnHasData =
    existsSync(join(learnDateDir, 'scraped')) ||
    existsSync(join(learnDateDir, `daily-research-${date}.md`));
  const hubHasData =
    existsSync(join(hubDateDir, 'scraped')) ||
    existsSync(join(hubDateDir, `daily-research-${date}.md`));
  if (learnHasData) return DEFAULT_LEARN_RESEARCH;
  if (hubHasData) return HUB_RESEARCH;
  return DEFAULT_LEARN_RESEARCH;
}

/** Both learn and hub scraped dirs, richest first (most JSON files) for core HN/GitHub reads. */
function resolveScrapedDirs(date: string): string[] {
  const candidates = [
    join(DEFAULT_LEARN_RESEARCH, date, 'scraped'),
    join(HUB_RESEARCH, date, 'scraped'),
  ].filter(d => existsSync(d));
  return candidates.sort((a, b) => safeReadScrapedDir(b).length - safeReadScrapedDir(a).length);
}

function readScrapedJson<T>(scrapedDirs: string[], filename: string): T | null {
  for (const d of scrapedDirs) {
    const p = join(d, filename);
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf-8')) as T;
    }
  }
  return null;
}

/** Prefer learn daily brief, then hub copy. */
function resolveDailyResearchPath(date: string): string | null {
  const paths = [
    join(DEFAULT_LEARN_RESEARCH, date, `daily-research-${date}.md`),
    join(HUB_RESEARCH, date, `daily-research-${date}.md`),
  ];
  return paths.find(p => existsSync(p)) || null;
}

function countUniqueScrapedJson(scrapedDirs: string[]): number {
  const names = new Set<string>();
  for (const d of scrapedDirs) {
    for (const f of safeReadScrapedDir(d)) names.add(f);
  }
  return names.size;
}

/** Per-topic markdown lives next to research: docs/analysis/research/{date}/ */
function resolveTopicsDir(date: string): string | null {
  const fromEnv = process.env.TOPICS_DIR;
  if (fromEnv) {
    const p = join(fromEnv, date);
    return existsSync(p) ? p : null;
  }
  const t = join(LEARN_DOCS_ROOT, 'analysis', 'research', date);
  return existsSync(t) ? t : null;
}

const INSIGHTS_FILE =
  process.env.INSIGHTS_FILE || join(HUB_ROOT, '..', 'awesome-emerging', 'src', 'data', 'insights.ts');
const OUTPUT_DIR = join(HUB_ROOT, 'src', 'content', 'episodes');

const MAX_INSIGHTS = 30;
const EDITORIAL_CAP = 8;

// --- Types (mirrors packages/video/src/types.ts) ---
interface RawGithubRepo {
  name: string;
  description: string;
  language: string;
  stars_today: string;
  total_stars: string;
}

interface RawHNStory {
  rank: number;
  title: string;
  url: string;
  points: number;
  comments: number;
}

interface InsightRow {
  text: string;
  tags: string[];
  source?: string;
  url?: string;
}

// --- Helpers ---

function safeReadScrapedDir(scrapedDir: string): string[] {
  if (!existsSync(scrapedDir)) return [];
  return readdirSync(scrapedDir).filter((f: string) => f.endsWith('.json'));
}

/** First paragraph under ### Executive Summary (learn technical reports). */
function extractExecutiveSummary(md: string): string | null {
  const m = md.match(/### Executive Summary\s*\n+([\s\S]*?)(?=\n## |\n### [^E]|\Z)/);
  if (!m) return null;
  const block = m[1].trim();
  const para = block.split(/\n\n+/)[0]?.trim();
  return para || null;
}

/** technical-ai-powered-...-research-2026-04-04.md → readable label */
function topicLabelFromFilename(filename: string): string {
  const base = filename.replace(/^technical-/, '').replace(/-research-\d{4}-\d{2}-\d{2}\.md$/i, '');
  return base.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function loadTopicInsights(topicsDir: string | null): InsightRow[] {
  if (!topicsDir) return [];
  const files = readdirSync(topicsDir).filter(
    (f: string) => f.startsWith('technical-') && f.endsWith('.md')
  );
  const out: InsightRow[] = [];
  for (const file of files.sort()) {
    const path = join(topicsDir, file);
    const md = readFileSync(path, 'utf-8');
    const summary = extractExecutiveSummary(md);
    if (!summary) continue;
    const label = topicLabelFromFilename(file);
    const text =
      summary.length > 900 ? `${summary.slice(0, 897).trim()}…` : summary;
    const extraTags = extractTagsFromInsight(summary).filter(t => t !== 'research');
    const slugTag = label
      .split(/\s+/)
      .slice(0, 2)
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 20);
    const tags = ['topic', slugTag || 'digest', ...extraTags]
      .filter(t => t.length > 0 && t.length <= 20);
    const uniqueTags = [...new Set(tags)].slice(0, 3);

    out.push({
      text,
      tags: uniqueTags,
      source: `Topic: ${label}`,
    });
  }
  console.log(`  Topic digests: ${out.length} technical reports`);
  return out;
}

function loadLobsterInsights(scrapedDirs: string[], limit: number): InsightRow[] {
  type Row = { title: string; score: number; tags?: string[]; url?: string };
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const d of scrapedDirs) {
    const f = join(d, 'lobsters.json');
    if (!existsSync(f)) continue;
    const part = JSON.parse(readFileSync(f, 'utf-8')) as Row[];
    for (const r of part) {
      const k = r.title.toLowerCase().slice(0, 80);
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push(r);
    }
  }
  return rows
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => ({
      text: `${r.title} (${r.score} pts, Lobsters)`,
      tags: [...(r.tags || []).slice(0, 2).map(t => t.slice(0, 20)), 'lobsters'].filter(Boolean).slice(0, 3),
      source: 'Lobsters',
      ...(r.url?.startsWith('http') ? { url: r.url } : {}),
    }));
}

function loadProductHuntInsights(scrapedDirs: string[], limit: number): InsightRow[] {
  type Row = { name: string; tagline: string; upvotes: number; url?: string };
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const d of scrapedDirs) {
    const f = join(d, 'product-hunt.json');
    if (!existsSync(f)) continue;
    const part = JSON.parse(readFileSync(f, 'utf-8')) as Row[];
    for (const r of part) {
      const k = `${r.name}`.toLowerCase().slice(0, 40);
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push(r);
    }
  }
  return rows
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, limit)
    .map(r => ({
      text: `${r.name}: ${r.tagline} (${r.upvotes} votes)`,
      tags: ['product-hunt', 'launch'],
      source: 'Product Hunt',
      ...(r.url?.startsWith('http') ? { url: r.url } : {}),
    }));
}

function loadShowHNInsights(scrapedDirs: string[], limit: number): InsightRow[] {
  const seen = new Set<string>();
  const rows: RawHNStory[] = [];
  for (const d of scrapedDirs) {
    const f = join(d, 'hn-show.json');
    if (!existsSync(f)) continue;
    const part = JSON.parse(readFileSync(f, 'utf-8')) as RawHNStory[];
    for (const r of part) {
      const k = r.title.toLowerCase().slice(0, 80);
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push(r);
    }
  }
  return rows
    .sort((a, b) => b.points - a.points)
    .slice(0, limit)
    .map(r => ({
      text: `${r.title} (${r.points} pts, ${r.comments} comments)`,
      tags: ['show-hn', 'hacker-news'],
      source: `Show HN ${r.points}pts`,
      ...(r.url?.startsWith('http') ? { url: r.url } : {}),
    }));
}

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .slice(0, 48)
    .trim();
}

function mergeInsights(
  editorial: string[],
  topicRows: InsightRow[],
  hnStories: RawHNStory[],
  lob: InsightRow[],
  ph: InsightRow[],
  show: InsightRow[]
): InsightRow[] {
  const seen = new Set<string>();
  const merged: InsightRow[] = [];

  const push = (row: InsightRow) => {
    if (merged.length >= MAX_INSIGHTS) return;
    const k = normalizeKey(row.text);
    if (!k || seen.has(k)) return;
    seen.add(k);
    merged.push(row);
  };

  // Build a lookup: HN title → url, for matching editorial insights to sources
  const hnUrlMap = new Map<string, string>();
  for (const story of hnStories) {
    if (story.url) hnUrlMap.set(normalizeKey(story.title), story.url);
    if (story.hn_url) hnUrlMap.set(normalizeKey(story.title), story.hn_url);
    // Prefer story URL over HN comments URL
    if (story.url?.startsWith('http')) hnUrlMap.set(normalizeKey(story.title), story.url);
  }
  // Also index lobsters, PH, show
  for (const row of [...lob, ...ph, ...show]) {
    if (row.url) hnUrlMap.set(normalizeKey(row.text), row.url);
  }

  for (const text of editorial.slice(0, EDITORIAL_CAP)) {
    // Try to find a matching URL from scraped data
    let url: string | undefined;
    const textKey = normalizeKey(text);
    // Check if any scraped title is a substring of the insight text (or vice versa)
    for (const [key, u] of hnUrlMap) {
      if (textKey.includes(key) || key.includes(textKey.slice(0, 40))) {
        url = u;
        break;
      }
    }
    // Also try matching by extracting a title-like phrase before the first em-dash
    if (!url) {
      const titlePart = text.split('—')[0].replace(/\s*\([^)]*\)\s*/g, '').trim();
      const titleKey = normalizeKey(titlePart);
      for (const [key, u] of hnUrlMap) {
        if (key.includes(titleKey.slice(0, 30)) || titleKey.includes(key.slice(0, 30))) {
          url = u;
          break;
        }
      }
    }

    push({
      text,
      tags: extractTagsFromInsight(text),
      source: extractSourceFromInsight(text),
      ...(url ? { url } : {}),
    });
  }

  for (const row of topicRows) push(row);

  const editorialKeys = new Set(editorial.map(t => normalizeKey(t)));
  const sortedHn = [...hnStories].sort((a, b) => b.points - a.points);
  for (const story of sortedHn) {
    if (editorialKeys.has(normalizeKey(story.title))) continue;
    push({
      text: `${story.title} (${story.points} pts, ${story.comments} comments)`,
      tags: ['hacker-news'],
      source: `HN ${story.points}pts`,
      ...(story.url?.startsWith('http') ? { url: story.url } : {}),
    });
  }

  for (const row of lob) push(row);
  for (const row of ph) push(row);
  for (const row of show) push(row);

  return merged;
}

function parseStarDelta(starsToday: string): string {
  // "2,685 stars today" → "+2,685/d"
  const match = starsToday.match(/([\d,]+)/);
  return match ? `+${match[1]}/d` : starsToday;
}

function parseTotalStars(total: string): string {
  // "11157" → "11.2K", "108000" → "108K"
  const num = parseInt(total.replace(/,/g, ''), 10);
  if (num >= 1000) {
    const k = num / 1000;
    return k >= 100 ? `${Math.round(k)}K` : `${k.toFixed(1)}K`;
  }
  return String(num);
}

function extractMetricFromInsight(text: string): { metric: string; source: string } | null {
  // Try to extract HN points: "(276 HN pts)" or "(121 HN pts)"
  const hnMatch = text.match(/\((\d+)\s+HN\s+pts?\)/i);
  if (hnMatch) return { metric: `${hnMatch[1]} pts`, source: 'HN' };

  // Try GitHub star velocity: "+2,685 stars/day" or "+2,685/day"
  const ghMatch = text.match(/\+([\d,]+)\s*(?:stars?\/day|\/day)/i);
  if (ghMatch) return { metric: `+${ghMatch[1]}/d`, source: 'GitHub' };

  // Try star count: "10.2K total" or "108K stars"
  const starMatch = text.match(/([\d.]+K)\s+(?:total|stars)/i);
  if (starMatch) return { metric: starMatch[1], source: 'GitHub' };

  return null;
}

function extractTagsFromInsight(text: string): string[] {
  const tags: string[] = [];
  const lower = text.toLowerCase();

  if (lower.includes('supply chain') || lower.includes('malware') || lower.includes('security') || lower.includes('compromised')) tags.push('security');
  if (lower.includes('supply chain') || lower.includes('dependency')) tags.push('supply-chain');
  if (lower.includes('github trending') || lower.includes('github') || lower.includes('stars/day') || lower.includes('stars today')) tags.push('github-trending');
  if (lower.includes('claude code') || lower.includes('claude-code')) tags.push('claude-code');
  if (lower.includes('agent') || lower.includes('multi-agent')) tags.push('agents');
  if (lower.includes('meta\'s') || lower.includes('facebook')) tags.push('meta');
  if (lower.includes('bytedance')) tags.push('bytedance');
  if (lower.includes('research') || lower.includes('arxiv') || lower.includes('benchmark')) tags.push('research');
  if (lower.includes('open source') || lower.includes('open-source')) tags.push('open-source');
  if (lower.includes('stripe') || lower.includes('payment')) tags.push('fintech');
  if (lower.includes('rust')) tags.push('rust');
  if (lower.includes('ecosystem') || lower.includes('plugin')) tags.push('ecosystem');

  // Cap at 3, max 20 chars
  return [...new Set(tags)].slice(0, 3).filter(t => t.length <= 20);
}

function extractSourceFromInsight(text: string): string | undefined {
  const hnMatch = text.match(/(\d+)\s+HN\s+pts?/i);
  if (hnMatch) return `HN ${hnMatch[1]}pts`;

  const ghMatch = text.match(/\+([\d,]+)\s*(?:stars?\/day|\/day)/i);
  if (ghMatch) return `GitHub +${ghMatch[1]}/day`;

  const starMatch = text.match(/([\d.]+K)\s+stars/i);
  if (starMatch) return `GitHub ${starMatch[1]} stars`;

  return undefined;
}

function pickHeroStat(insights: string[], hnStories: RawHNStory[]): { value: string; label: string } | undefined {
  // Look for a dramatic number in the top insight
  for (const text of insights.slice(0, 3)) {
    // Match patterns like "97M monthly downloads" or "$500k/year"
    const bigNum = text.match(/(\d+[MBK]|\$[\d,]+[kKmM]?)\s+([\w\s]{3,30})/);
    if (bigNum) {
      return { value: bigNum[1], label: bigNum[2].trim().toLowerCase() };
    }
  }

  // Fallback: highest HN points
  if (hnStories.length > 0) {
    const top = hnStories.reduce((a, b) => a.points > b.points ? a : b);
    return { value: String(top.points), label: `points on "${top.title.slice(0, 60)}"` };
  }

  return undefined;
}

function extractTakeaway(summaryMd: string): string {
  // Try to extract from "Top Signal" section
  const topSignalMatch = summaryMd.match(/## Top Signal\s*\n\s*\n([\s\S]*?)(?=\n## )/);
  if (topSignalMatch) {
    // Take first 2 sentences
    const sentences = topSignalMatch[1].trim().split(/(?<=[.!?])\s+/);
    return sentences.slice(0, 2).join(' ');
  }

  // Fallback: first conditional implication
  const implMatch = summaryMd.match(/- If H\d is true, then (.+)/);
  if (implMatch) return implMatch[1];

  return 'Today\'s brief covers the most interesting signals across the tech landscape.';
}

// --- Main ---

function main() {
  const date = process.argv[2] || new Date().toISOString().split('T')[0];
  const RESEARCH_BASE = resolveResearchBase(date);
  const scrapedDirs = resolveScrapedDirs(date);
  console.log(`Generating EpisodeProps for ${date}...`);
  console.log(`  RESEARCH_BASE (metadata): ${RESEARCH_BASE}`);
  if (scrapedDirs.length) {
    console.log(
      `  SCRAPED_DIRS (${scrapedDirs.length}): ${scrapedDirs.map(d => `${d} (${safeReadScrapedDir(d).length} json)`).join(' | ')}`
    );
  }

  const outFileEarly = join(OUTPUT_DIR, `${date}.json`);
  let episodeNumber = existsSync(OUTPUT_DIR)
    ? readdirSync(OUTPUT_DIR).filter((f: string) => f.endsWith('.json')).length + 1
    : 1;
  if (existsSync(outFileEarly)) {
    try {
      const prev = JSON.parse(readFileSync(outFileEarly, 'utf-8')) as { episodeNumber?: number };
      if (typeof prev.episodeNumber === 'number') episodeNumber = prev.episodeNumber;
    } catch {
      /* keep computed */
    }
  }

  // --- Load sources ---

  // 1. GitHub trending (first hit among scraped dirs, richest dir first)
  let githubRepos: RawGithubRepo[] = [];
  const ghData = readScrapedJson<RawGithubRepo[]>(scrapedDirs, 'github-trending.json');
  if (ghData?.length) {
    githubRepos = ghData;
    console.log(`  GitHub trending: ${githubRepos.length} repos`);
  } else {
    console.warn('  ⚠ github-trending.json not found');
  }

  // 2. Hacker News
  let hnStories: RawHNStory[] = [];
  const hnData = readScrapedJson<RawHNStory[]>(scrapedDirs, 'hacker-news.json');
  if (hnData?.length) {
    hnStories = hnData;
    console.log(`  Hacker News: ${hnStories.length} stories`);
  } else {
    console.warn('  ⚠ hacker-news.json not found');
  }

  // 3. Editorial insights from awesome-emerging
  let editorialInsights: string[] = [];
  if (existsSync(INSIGHTS_FILE)) {
    const insightsSource = readFileSync(INSIGHTS_FILE, 'utf-8');
    // Parse the TS file to find the entry for this date
    const datePattern = new RegExp(`date:\\s*["']${date}["'][\\s\\S]*?entries:\\s*\\[([\\s\\S]*?)\\]`, 'm');
    const match = insightsSource.match(datePattern);
    if (match) {
      // Extract string entries from the array
      const entriesBlock = match[1];
      const stringMatches = [...entriesBlock.matchAll(/"((?:[^"\\]|\\.)*)"/g)];
      editorialInsights = stringMatches.map(m => m[1].replace(/\\"/g, '"').replace(/\\'/g, "'"));
      console.log(`  Editorial insights: ${editorialInsights.length} entries`);
    } else {
      console.warn(`  ⚠ No insights found for ${date}`);
    }
  }

  // 4. Daily research summary (learn first, then hub)
  let summaryMd = '';
  const summaryPath = resolveDailyResearchPath(date);
  if (summaryPath) {
    summaryMd = readFileSync(summaryPath, 'utf-8');
    console.log(`  Research summary: loaded (${summaryPath})`);
  }

  const topicsDir = resolveTopicsDir(date);
  const topicRows = loadTopicInsights(topicsDir);
  const lobRows = scrapedDirs.length ? loadLobsterInsights(scrapedDirs, 4) : [];
  const phRows = scrapedDirs.length ? loadProductHuntInsights(scrapedDirs, 4) : [];
  const showRows = scrapedDirs.length ? loadShowHNInsights(scrapedDirs, 5) : [];
  if (lobRows.length) console.log(`  Lobsters: ${lobRows.length} insight rows`);
  if (phRows.length) console.log(`  Product Hunt: ${phRows.length} insight rows`);
  if (showRows.length) console.log(`  Show HN: ${showRows.length} insight rows`);

  // --- Validate minimum data ---
  const scrapedJsonCount = countUniqueScrapedJson(scrapedDirs);
  const sourceCount =
    (githubRepos.length > 0 ? 1 : 0) +
    (hnStories.length > 0 ? 1 : 0) +
    (editorialInsights.length > 0 ? 1 : 0) +
    (topicRows.length > 0 ? 1 : 0) +
    (scrapedJsonCount > 0 && (lobRows.length + phRows.length + showRows.length > 0) ? 1 : 0);
  if (sourceCount === 0) {
    console.error(
      `ERROR: No data sources available for ${date}. Need GitHub trending, HN, editorial insights, topic reports, or supplemental scrapes.`
    );
    process.exit(1);
  }

  // --- Build EpisodeProps ---

  const insights = mergeInsights(
    editorialInsights,
    topicRows,
    hnStories,
    lobRows,
    phRows,
    showRows
  );

  if (insights.length === 0) {
    console.error('ERROR: merge produced zero insights.');
    process.exit(1);
  }

  // Trending repos (top 5 by star velocity); fallback when github-trending.json is missing
  let trending = githubRepos
    .sort((a, b) => {
      const aStars = parseInt(a.stars_today.replace(/[^\d]/g, ''), 10) || 0;
      const bStars = parseInt(b.stars_today.replace(/[^\d]/g, ''), 10) || 0;
      return bStars - aStars;
    })
    .slice(0, 5)
    .map(repo => ({
      name: repo.name.includes('/') ? (repo.name.split('/').pop() || repo.name) : repo.name,
      fullName: repo.name,
      stars: parseTotalStars(repo.total_stars),
      language: repo.language || 'Unknown',
      delta: parseStarDelta(repo.stars_today),
    }));

  if (trending.length === 0) {
    const recovered = extractTrendingFallbackFromTexts(insights.map(i => i.text), 5);
    if (recovered.length) {
      trending = recovered;
      console.log(`  Trending fallback: ${trending.length} repos from insight text`);
    }
  }

  // Headlines (top 3 insights with metrics)
  const headlines = insights
    .slice(0, 3)
    .map(insight => {
      const extracted = extractMetricFromInsight(insight.text);
      // Shorten the text for video display (first clause only)
      const shortText = insight.text.split('—')[0].trim().replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      return {
        text: shortText,
        metric: extracted?.metric || '—',
        source: extracted?.source || 'web',
      };
    });

  // Numbers grid
  const topHN = hnStories.length > 0
    ? hnStories.reduce((a, b) => a.points > b.points ? a : b)
    : null;
  const topRepo = githubRepos.length > 0
    ? githubRepos.sort((a, b) => {
        const aS = parseInt(a.stars_today.replace(/[^\d]/g, ''), 10) || 0;
        const bS = parseInt(b.stars_today.replace(/[^\d]/g, ''), 10) || 0;
        return bS - aS;
      })[0]
    : null;

  const numbers = [
    topHN ? { label: 'Top HN Story', value: String(topHN.points), unit: 'pts' } : { label: 'Stories', value: String(hnStories.length), unit: 'items' },
    topRepo ? { label: 'Fastest Repo', value: topRepo.stars_today.replace(/\s*stars?\s*today/i, '').trim(), unit: 'stars/day' } : { label: 'Repos', value: String(githubRepos.length), unit: 'tracked' },
    { label: 'Sources Scraped', value: String(scrapedJsonCount), unit: 'sites' },
    { label: 'Insights Today', value: String(insights.length), unit: 'stories' },
    { label: 'Topic Reports', value: String(topicRows.length), unit: 'files' },
  ];

  // Subtitle (first 3 insights summarized)
  const subtitle = headlines.map(h => h.text.slice(0, 50)).join(', ');

  const heroStat = pickHeroStat(
    insights.map(i => i.text),
    hnStories
  );

  // Takeaway
  const takeawayText = extractTakeaway(summaryMd);

  const episode = {
    date,
    episodeNumber,
    locale: 'en-US',
    title: 'Intelligence Brief',
    subtitle,
    ...(heroStat && { heroStat }),
    insights,
    trending,
    numbers,
    scenes: {
      masthead: { title: 'INTELLIGENCE BRIEF', subtitle: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
      headlines,
      takeaway: { text: takeawayText },
    },
  };

  // --- Write output ---
  const outFile = join(OUTPUT_DIR, `${date}.json`);
  writeFileSync(outFile, JSON.stringify(episode, null, 2));
  console.log(`\n✓ Written to ${outFile}`);
  console.log(`  ${insights.length} insights, ${trending.length} trending repos, ${headlines.length} headlines`);
  if (heroStat) console.log(`  Hero stat: ${heroStat.value} ${heroStat.label}`);
}

main();
