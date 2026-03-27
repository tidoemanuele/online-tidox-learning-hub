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
const RESEARCH_BASE = '/Users/etido/Documents/learn/docs/research';
const INSIGHTS_FILE = '/Users/etido/Code/tidoemanuele/awesome-emerging/src/data/insights.ts';
const OUTPUT_DIR = join(import.meta.dirname!, '..', 'src', 'content', 'episodes');

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

  // Count existing episodes to determine episode number
  const existingEpisodes = existsSync(OUTPUT_DIR)
    ? readdirSync(OUTPUT_DIR).filter((f: string) => f.endsWith('.json')).length
    : 0;
  const episodeNumber = existingEpisodes + 1;

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

  // 4. Daily research summary
  let summaryMd = '';
  const summaryFile = join(researchDir, `daily-research-${date}.md`);
  if (existsSync(summaryFile)) {
    summaryMd = readFileSync(summaryFile, 'utf-8');
    console.log(`  Research summary: loaded`);
  }

  // --- Validate minimum data ---
  const sourceCount = (githubRepos.length > 0 ? 1 : 0) + (hnStories.length > 0 ? 1 : 0) + (editorialInsights.length > 0 ? 1 : 0);
  if (sourceCount === 0) {
    console.error(`ERROR: No data sources available for ${date}. Need at least GitHub trending, HN stories, or editorial insights.`);
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
      stars: parseTotalStars(repo.total_stars),
      language: repo.language || 'Unknown',
      delta: parseStarDelta(repo.stars_today),
    }));

  // Insights (from editorial layer, fallback to HN titles)
  const insights = editorialInsights.length > 0
    ? editorialInsights.slice(0, 8).map(text => ({
        text,
        tags: extractTagsFromInsight(text),
        source: extractSourceFromInsight(text),
      }))
    : hnStories.slice(0, 6).map(story => ({
        text: `${story.title} (${story.points} pts, ${story.comments} comments)`,
        tags: ['hacker-news'],
        source: `HN ${story.points}pts`,
      }));

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
    { label: 'Sources Scraped', value: String(readdirSync(scrapedDir).filter((f: string) => f.endsWith('.json')).length), unit: 'sites' },
    { label: 'Insights Today', value: String(insights.length), unit: 'stories' },
  ];

  // Subtitle (first 3 insights summarized)
  const subtitle = headlines.map(h => h.text.slice(0, 50)).join(', ');

  // Hero stat
  const heroStat = pickHeroStat(editorialInsights, hnStories);

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
