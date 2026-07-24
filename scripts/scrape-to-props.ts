#!/usr/bin/env npx tsx
/**
 * scrape-to-props.ts — Transforms raw research data into EpisodeProps JSON.
 *
 * Input sources:
 *   1. Raw scraped JSON files from learn/docs/research/{date}/scraped/
 *   2. Editorial insights from awesome-emerging/src/data/insights.ts
 *   3. Daily research summary markdown (for the takeaway)
 *
 * Output:
 *   src/content/episodes/{date}.json (validated EpisodeProps)
 *
 * Usage:
 *   npx tsx scripts/scrape-to-props.ts 2026-03-27
 *   npx tsx scripts/scrape-to-props.ts          # defaults to today
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

// --- Paths ---
const RESEARCH_BASE = process.env.RESEARCH_BASE ?? join(import.meta.dirname!, '..', 'research');
// Learn 2026 pipeline emits a structured insights.json per day (docs/DESIGN-2026.md).
// Preferred over the legacy awesome-emerging regex parse; both are optional fallbacks.
const LEARN_RESEARCH_BASE = process.env.LEARN_RESEARCH_BASE ?? join(import.meta.dirname!, '..', '..', 'learn-2026', 'docs', 'research');
const INSIGHTS_FILE = join(import.meta.dirname!, '..', '..', 'awesome-emerging', 'src', 'data', 'insights.ts');
const OUTPUT_DIR = join(import.meta.dirname!, '..', 'src', 'content', 'episodes');

// --- Types (mirrors packages/video/src/types.ts) ---
interface RawGithubRepo {
  name: string;
  fullName?: string;
  description?: string;
  language: string;
  stars_today: string;
  total_stars: string;
  url?: string;
}

interface RawHNStory {
  rank: number;
  title: string;
  url: string;
  points: number;
  comments: number;
}

interface RawLobstersStory {
  title: string;
  score: number;
  tags: string[];
  url: string;
  comments_url: string;
}

interface RawDevtoArticle {
  rank: number;
  title: string;
  url: string;
  reactions: number;
  comments: number;
  tags: string[];
}

// --- Helpers ---

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

function extractUrlFromInsight(text: string): string | undefined {
  // Try https:// URL in parentheses
  const httpsParens = text.match(/\(https?:\/\/([^\s\)]+)\)/);
  if (httpsParens) return `https://${httpsParens[1]}`;

  // Try bare domain URL in parentheses like (domain.com/path)
  const bareParens = text.match(/\((?!https?:\/\/)([a-z0-9-]+(?:\.[a-z]{2,6})+\/[^\s\)\]"]+)\)/i);
  if (bareParens) return `https://${bareParens[1]}`;

  // Try "at domain.com/path" pattern
  const atUrl = text.match(/\bat\s+([a-z0-9-]+(?:\.[a-z]{2,6})+\/[^\s,\]"]+)/i);
  if (atUrl) return `https://${atUrl[1]}`;

  // Try github.com/owner/repo
  const github = text.match(/github\.com\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)/);
  if (github) return `https://github.com/${github[1]}`;

  // Try arxiv.org/abs/...
  const arxiv = text.match(/arxiv\.org\/abs\/[\d.]+/);
  if (arxiv) return `https://${arxiv[0]}`;

  return undefined;
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
  console.log(`Generating EpisodeProps for ${date}...`);

  const researchDir = join(RESEARCH_BASE, date);
  const scrapedDir = join(researchDir, 'scraped');

  // Episode number = position of this date in the sorted episode list (backfill-safe,
  // and re-running the same date keeps its number stable)
  const episodeDates = existsSync(OUTPUT_DIR)
    ? readdirSync(OUTPUT_DIR)
        .filter((f: string) => f.endsWith('.json'))
        .map((f: string) => f.replace(/\.json$/, ''))
    : [];
  const allDates = [...new Set([...episodeDates, date])].sort();
  const episodeNumber = allDates.indexOf(date) + 1;

  // --- Load sources ---

  // 1. GitHub trending
  let githubRepos: RawGithubRepo[] = [];
  const ghFile = join(scrapedDir, 'github-trending.json');
  if (existsSync(ghFile)) {
    githubRepos = JSON.parse(readFileSync(ghFile, 'utf-8'));
    console.log(`  GitHub trending: ${githubRepos.length} repos`);
  } else {
    console.warn('  ⚠ github-trending.json not found');
  }

  // 2. Hacker News
  let hnStories: RawHNStory[] = [];
  const hnFile = join(scrapedDir, 'hacker-news.json');
  if (existsSync(hnFile)) {
    hnStories = JSON.parse(readFileSync(hnFile, 'utf-8'));
    console.log(`  Hacker News: ${hnStories.length} stories`);
  } else {
    console.warn('  ⚠ hacker-news.json not found');
  }

  // 2b. Lobsters
  let lobstersStories: RawLobstersStory[] = [];
  const lobFile = join(scrapedDir, 'lobsters.json');
  if (existsSync(lobFile)) {
    lobstersStories = JSON.parse(readFileSync(lobFile, 'utf-8'));
    console.log(`  Lobsters: ${lobstersStories.length} stories`);
  } else {
    console.warn('  ⚠ lobsters.json not found');
  }

  // 2c. Dev.to
  let devtoArticles: RawDevtoArticle[] = [];
  const devtoFile = join(scrapedDir, 'devto.json');
  if (existsSync(devtoFile)) {
    devtoArticles = JSON.parse(readFileSync(devtoFile, 'utf-8'));
    console.log(`  Dev.to: ${devtoArticles.length} articles`);
  } else {
    console.warn('  ⚠ devto.json not found');
  }

  // 3a. Structured insights from the Learn 2026 pipeline (preferred)
  interface StructuredInsight { text: string; tags?: string[]; source?: string; url?: string }
  let structuredInsights: StructuredInsight[] = [];
  let learnHeroStat: { value: string; label: string } | undefined;
  let learnTakeaway: string | undefined;
  for (const base of [LEARN_RESEARCH_BASE, RESEARCH_BASE]) {
    const insightsJson = join(base, date, 'insights.json');
    if (existsSync(insightsJson)) {
      try {
        const parsed = JSON.parse(readFileSync(insightsJson, 'utf-8'));
        structuredInsights = (parsed.insights ?? []).filter((i: StructuredInsight) => i?.text);
        if (parsed.heroStat?.value && parsed.heroStat?.label) learnHeroStat = parsed.heroStat;
        if (typeof parsed.takeaway === 'string' && parsed.takeaway.trim()) learnTakeaway = parsed.takeaway.trim();
        console.log(`  Learn 2026 insights.json: ${structuredInsights.length} entries (${insightsJson})`);
        break;
      } catch (e) {
        console.warn(`  ⚠ Failed to parse ${insightsJson}: ${e}`);
      }
    }
  }

  // 3b. Legacy editorial insights from awesome-emerging (fallback)
  let editorialInsights: string[] = [];
  if (structuredInsights.length === 0 && existsSync(INSIGHTS_FILE)) {
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

  // 4. Daily research summary (legacy name, then Learn 2026 daily-brief.md)
  let summaryMd = '';
  for (const f of [
    join(researchDir, `daily-research-${date}.md`),
    join(LEARN_RESEARCH_BASE, date, 'daily-brief.md'),
  ]) {
    if (existsSync(f)) {
      summaryMd = readFileSync(f, 'utf-8');
      console.log(`  Research summary: loaded (${f})`);
      break;
    }
  }

  // --- Validate minimum data ---
  const sourceCount =
    (githubRepos.length > 0 ? 1 : 0) +
    (hnStories.length > 0 ? 1 : 0) +
    (lobstersStories.length > 0 ? 1 : 0) +
    (devtoArticles.length > 0 ? 1 : 0) +
    (structuredInsights.length > 0 ? 1 : 0) +
    (editorialInsights.length > 0 ? 1 : 0);
  if (sourceCount === 0) {
    console.error(`ERROR: No data sources available for ${date}. Need at least GitHub trending, HN, Lobsters, Dev.to, or editorial insights.`);
    process.exit(1);
  }

  // --- Build EpisodeProps ---

  // Trending repos (top 5 by star velocity)
  const trending = githubRepos
    .sort((a, b) => {
      const aStars = parseInt(a.stars_today.replace(/[^\d]/g, ''), 10) || 0;
      const bStars = parseInt(b.stars_today.replace(/[^\d]/g, ''), 10) || 0;
      return bStars - aStars;
    })
    .slice(0, 5)
    .map(repo => ({
      name: repo.name.split('/').pop() || repo.name,
      fullName: repo.fullName || repo.name,
      stars: parseTotalStars(repo.total_stars),
      language: repo.language || 'Unknown',
      delta: parseStarDelta(repo.stars_today),
      url: repo.url || (repo.fullName ? `https://github.com/${repo.fullName}` : undefined),
    }));

  // Insights (from editorial layer, fallback to scraped stories across sources)
  const scrapedInsightPool = [
    ...hnStories.slice(0, 4).map(story => ({
      text: `${story.title} (${story.points} pts, ${story.comments} comments)`,
      tags: ['hacker-news'],
      source: `HN ${story.points}pts`,
      url: story.url || story.hn_url,
    })),
    ...lobstersStories.slice(0, 2).map(story => ({
      text: `${story.title} (${story.score} pts on Lobsters)`,
      tags: ['lobsters', ...story.tags.slice(0, 2)].slice(0, 3),
      source: `Lobsters ${story.score}pts`,
      url: story.url,
    })),
    ...devtoArticles.slice(0, 2).map(article => ({
      text: `${article.title} (${article.reactions} reactions on Dev.to)`,
      tags: ['devto', ...article.tags.slice(0, 2)].slice(0, 3),
      source: `Dev.to ${article.reactions}❤`,
      url: article.url,
    })),
  ];

  const insights = structuredInsights.length > 0
    ? structuredInsights.slice(0, 8).map(i => ({
        text: i.text,
        tags: (i.tags && i.tags.length > 0 ? i.tags : extractTagsFromInsight(i.text)).slice(0, 3).map(t => t.slice(0, 20)),
        source: i.source ?? extractSourceFromInsight(i.text),
        url: i.url ?? extractUrlFromInsight(i.text),
      }))
    : editorialInsights.length > 0
    ? editorialInsights.slice(0, 8).map(text => ({
        text,
        tags: extractTagsFromInsight(text),
        source: extractSourceFromInsight(text),
        url: extractUrlFromInsight(text),
      }))
    : scrapedInsightPool.slice(0, 8);

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
    { label: 'Sources Scraped', value: String(existsSync(scrapedDir) ? readdirSync(scrapedDir).filter((f: string) => f.endsWith('.json')).length : sourceCount), unit: 'sites' },
    { label: 'Insights Today', value: String(insights.length), unit: 'stories' },
  ];

  // Subtitle (first 3 insights summarized)
  const subtitle = headlines.map(h => h.text.slice(0, 50)).join(', ');

  // Hero stat (Learn 2026 bundle may supply one directly)
  const heroStat = learnHeroStat
    ?? pickHeroStat(
      structuredInsights.length > 0 ? structuredInsights.map(i => i.text) : editorialInsights,
      hnStories,
    );

  // Takeaway
  const takeawayText = learnTakeaway ?? extractTakeaway(summaryMd);

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
