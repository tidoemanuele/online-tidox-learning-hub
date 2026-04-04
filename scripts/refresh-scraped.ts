/**
 * Refresh hacker-news.json + github-trending.json without agent-browser.
 * Writes to research/{date}/scraped/ (same layout as research-browser).
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

async function fetchHackerNews(): Promise<RawHNStory[]> {
  const u = new URL('https://hn.algolia.com/api/v1/search');
  u.searchParams.set('tags', 'front_page');
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
  return data.hits.map((hit, i) => ({
    rank: i + 1,
    title: hit.title || '',
    url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID || ''}`,
    points: hit.points ?? 0,
    comments: hit.num_comments ?? 0,
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
  console.log(`Refreshing scraped JSON → ${OUT_DIR} (${DATE})`);
  mkdirSync(OUT_DIR, { recursive: true });

  const [hn, gh] = await Promise.all([fetchHackerNews(), fetchGithubTrending()]);

  writeFileSync(join(OUT_DIR, 'hacker-news.json'), JSON.stringify(hn, null, 2));
  writeFileSync(join(OUT_DIR, 'github-trending.json'), JSON.stringify(gh, null, 2));

  console.log(`  ✓ hacker-news.json (${hn.length} stories)`);
  console.log(`  ✓ github-trending.json (${gh.length} repos)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
