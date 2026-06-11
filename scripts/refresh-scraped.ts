/**
 * Refresh scraped JSON (HN, GitHub trending, Lobsters, Dev.to) without agent-browser.
 * Writes to research/{date}/scraped/ (same layout as research-browser).
 *
 * For past dates, HN is fetched via Algolia date-range search (top stories of that
 * day); GitHub trending / Lobsters / Dev.to have no historical API and are skipped.
 *
 * Each source fails independently — exits 1 only if ALL sources fail.
 *
 * Usage: npx tsx scripts/refresh-scraped.ts 2026-04-03
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HUB_ROOT = join(import.meta.dirname!, '..');
const DATE = process.argv[2] || new Date().toISOString().split('T')[0];
const OUT_DIR = join(HUB_ROOT, 'research', DATE, 'scraped');

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TidoxHub/1';

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

const IS_BACKFILL = DATE !== new Date().toISOString().split('T')[0];

async function fetchHackerNews(): Promise<RawHNStory[]> {
  const u = new URL('https://hn.algolia.com/api/v1/search');
  if (IS_BACKFILL) {
    // Top stories created on that calendar day (UTC), ranked by points
    const start = Math.floor(Date.parse(`${DATE}T00:00:00Z`) / 1000);
    const end = start + 86400;
    u.searchParams.set('tags', 'story');
    u.searchParams.set('numericFilters', `created_at_i>=${start},created_at_i<${end},points>50`);
  } else {
    u.searchParams.set('tags', 'front_page');
  }
  u.searchParams.set('hitsPerPage', '30');
  const res = await fetch(u.toString(), { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HN Algolia: ${res.status}`);
  const data = (await res.json()) as {
    hits: Array<{
      title?: string;
      url?: string;
      points?: number;
      num_comments?: number;
      objectID?: string;
    }>;
  };
  const hits = IS_BACKFILL
    ? [...data.hits].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    : data.hits;
  return hits.map((hit, i) => ({
    rank: i + 1,
    title: hit.title || '',
    url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID || ''}`,
    points: hit.points ?? 0,
    comments: hit.num_comments ?? 0,
  }));
}

async function fetchLobsters(): Promise<RawLobstersStory[]> {
  const res = await fetch('https://lobste.rs/hottest.json', {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Lobsters: ${res.status}`);
  const data = (await res.json()) as Array<{
    title?: string;
    score?: number;
    tags?: string[];
    url?: string;
    comments_url?: string;
  }>;
  return data.slice(0, 25).map((s) => ({
    title: s.title || '',
    score: s.score ?? 0,
    tags: s.tags || [],
    url: s.url || s.comments_url || '',
    comments_url: s.comments_url || '',
  }));
}

async function fetchDevto(): Promise<RawDevtoArticle[]> {
  const res = await fetch('https://dev.to/api/articles?top=1&per_page=25', {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Dev.to: ${res.status}`);
  const data = (await res.json()) as Array<{
    title?: string;
    url?: string;
    positive_reactions_count?: number;
    comments_count?: number;
    tag_list?: string[];
  }>;
  return data.map((a, i) => ({
    rank: i + 1,
    title: a.title || '',
    url: a.url || '',
    reactions: a.positive_reactions_count ?? 0,
    comments: a.comments_count ?? 0,
    tags: a.tag_list || [],
  }));
}

function parseGithubTrendingHtml(html: string): RawGithubRepo[] {
  const chunks = html.split('<article class="Box-row"');
  const repos: RawGithubRepo[] = [];

  for (let i = 1; i < chunks.length && repos.length < 25; i++) {
    const ch = chunks[i];
    const link =
      /<h2 class="h3 lh-condensed">\s*<a[^>]+href="\/([^"]+)"/.exec(ch) ||
      /<h2[^>]*>\s*<a[^>]+href="\/([^"]+)"/.exec(ch);
    if (!link) continue;
    const name = link[1];
    if (!name.includes('/') || name.startsWith('sponsors/') || name.startsWith('apps/')) continue;

    const descM = /<p class="col-9[^"]*">\s*([^<]+)/.exec(ch);
    const langM = /itemprop="programmingLanguage">([^<]+)/.exec(ch);
    const starsTodayM = /(\d[\d,]*)\s+stars?\s+today/i.exec(ch);
    const totalM = /\/stargazers"[^>]*>[\s\S]*?<\/svg>\s*([\d,]+)\s*<\/a>/i.exec(ch);

    repos.push({
      name,
      description: descM ? descM[1].trim().slice(0, 500) : '',
      language: langM ? langM[1].trim() : 'Unknown',
      stars_today: starsTodayM ? `${starsTodayM[1].replace(/,/g, '')} stars today` : '',
      total_stars: totalM ? totalM[1].replace(/,/g, '') : '0',
    });
  }

  return repos;
}

async function fetchGithubTrending(): Promise<RawGithubRepo[]> {
  const res = await fetch('https://github.com/trending?since=daily', {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  if (!res.ok) throw new Error(`GitHub trending: ${res.status}`);
  const html = await res.text();
  return parseGithubTrendingHtml(html);
}

async function main() {
  console.log(`Refreshing scraped JSON → ${OUT_DIR} (${DATE}${IS_BACKFILL ? ', backfill' : ''})`);
  mkdirSync(OUT_DIR, { recursive: true });

  // Live-only sources have no historical API — skip them when backfilling
  const sources: Array<{ file: string; fetch: () => Promise<unknown[]> }> = [
    { file: 'hacker-news.json', fetch: fetchHackerNews },
    ...(IS_BACKFILL
      ? []
      : [
          { file: 'github-trending.json', fetch: fetchGithubTrending },
          { file: 'lobsters.json', fetch: fetchLobsters },
          { file: 'devto.json', fetch: fetchDevto },
        ]),
  ];

  const results = await Promise.allSettled(sources.map((s) => s.fetch()));

  let written = 0;
  results.forEach((result, i) => {
    const { file } = sources[i];
    if (result.status === 'fulfilled' && result.value.length > 0) {
      writeFileSync(join(OUT_DIR, file), JSON.stringify(result.value, null, 2));
      console.log(`  ✓ ${file} (${result.value.length} items)`);
      written++;
    } else {
      const reason = result.status === 'rejected' ? result.reason : 'empty result';
      console.warn(`  ⚠ ${file} failed: ${reason}`);
    }
  });

  if (written === 0) {
    throw new Error('All sources failed — nothing written');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
