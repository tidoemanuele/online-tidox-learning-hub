import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import type { SearchRecord } from '../lib/search';

/**
 * Flat index for the archive search: one row per insight and one per trending
 * repo, across every episode.
 *
 * Repos are their own row type so the archive can be read as a repo feed, and
 * so "github" reaches the 760 repo rows rather than only the insights that
 * happen to spell the word. Link hosts are indexed too, which is what makes
 * "github" also return the 138 insights that link there.
 *
 * Field names are single letters because the row count is in the thousands and
 * the names would otherwise be a large share of the payload.
 */

function host(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export const GET: APIRoute = async () => {
  const episodes = await getCollection('episodes');
  const records: SearchRecord[] = [];

  // A trending repo reappears for as long as it trends — 21 days for the most
  // persistent one — and 760 appearances collapse to 301 repos. Deduping here
  // rather than in the browser keeps the page free of repeats at no runtime
  // cost, and makes the payload smaller instead of larger.
  const repos = new Map<string, SearchRecord>();

  for (const episode of episodes) {
    const { date, episodeNumber, subtitle, insights, trending } = episode.data;

    insights.forEach((insight, position) => {
      records.push({
        k: 'i',
        d: date,
        n: episodeNumber,
        s: subtitle,
        x: position,
        t: insight.text,
        g: (insight.tags ?? []).join(' '),
        o: insight.source ?? '',
        u: insight.url ?? '',
        h: host(insight.url),
        c: 1,
        f: date,
      });
    });

    (trending ?? []).forEach((repo, position) => {
      // Older episodes predate the scraper recording repo URLs. The list is
      // GitHub trending (scripts/refresh-scraped.ts reads github.com/trending
      // and api.github.com), so an owner/repo full name reconstructs the link
      // exactly. A bare name cannot: guessing the owner would invent a link, so
      // those rows stay unlinked and are still reachable under the Repos tab.
      const derived = !repo.url && repo.fullName?.includes('/')
        ? `https://github.com/${repo.fullName}`
        : '';
      const url = repo.url ?? derived;
      const name = repo.fullName || repo.name;
      const previous = repos.get(name);

      // Keep the newest appearance's star count, and remember how long it ran.
      if (!previous || date > previous.d) {
        repos.set(name, {
          k: 'r',
          d: date,
          n: episodeNumber,
          s: subtitle,
          x: position,
          t: name,
          g: repo.language ?? '',
          o: [repo.stars, repo.delta].filter(Boolean).join(' · '),
          u: url || previous?.u || '',
          h: host(url) || 'github.com',
          c: (previous?.c ?? 0) + 1,
          f: previous ? previous.f : date,
        });
      } else {
        repos.set(name, {
          ...previous,
          c: previous.c + 1,
          f: date < previous.f ? date : previous.f,
          u: previous.u || url,
        });
      }
    });
  }

  records.push(...repos.values());
  records.sort((a, b) => b.d.localeCompare(a.d) || a.k.localeCompare(b.k) || a.x - b.x);

  return new Response(JSON.stringify(records), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
