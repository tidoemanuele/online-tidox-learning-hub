/**
 * Shared helpers for episode JSON + Astro daily pages (trending fallback, insight links).
 */

import type { TrendingRepo } from '@tidox/video/src/types';

/** First token after "+N/day," is often a language; ignore prose like "Google Research …". */
const TRENDING_LANG_HINTS = new Set(
  [
    'typescript',
    'javascript',
    'python',
    'rust',
    'go',
    'ruby',
    'php',
    'swift',
    'kotlin',
    'java',
    'shell',
    'html',
    'css',
    'vue',
    'svelte',
    'nim',
    'zig',
    'elixir',
    'haskell',
    'scala',
    'dart',
    'lua',
    'c',
    'cpp',
    'c++',
    'jupyter',
    'notebook',
  ].map((s) => s.toLowerCase())
);

/** When github-trending.json is missing, recover repo rows from topic/HN-style prose. */
export function extractTrendingFallbackFromTexts(texts: string[], limit = 5): TrendingRepo[] {
  const combined = texts.join('\n');
  type Acc = { rawName: string; lang?: string; deltaNum: number };
  const byKey = new Map<string, Acc>();

  const consider = (rawName: string, starsRaw: string, lang?: string) => {
    const deltaNum = parseInt(starsRaw.replace(/,/g, ''), 10) || 0;
    if (!rawName || rawName.length > 100 || deltaNum < 1) return;
    const key = rawName.toLowerCase();
    const prev = byKey.get(key);
    if (!prev || deltaNum > prev.deltaNum) {
      byKey.set(key, { rawName, lang, deltaNum });
    }
  };

  const reParen = /\b([a-zA-Z0-9_.-]+)\s*\(\+([\d,]+)\/day(?:,([^)\n]+))?/g;
  for (const m of combined.matchAll(reParen)) {
    const tail = m[3]?.trim() ?? '';
    const firstTok = tail.split(/[\s,]+/).find(Boolean) ?? '';
    const lang =
      firstTok && TRENDING_LANG_HINTS.has(firstTok.toLowerCase()) ? firstTok : undefined;
    consider(m[1], m[2], lang);
  }

  const reSurge = /\b([a-zA-Z0-9_.-]+)\s+(?:\([^)]+\)\s+)?surged to \+([\d,]+)\s+stars\/day/gi;
  for (const m of combined.matchAll(reSurge)) {
    consider(m[1], m[2]);
  }

  return [...byKey.values()]
    .sort((a, b) => b.deltaNum - a.deltaNum)
    .slice(0, limit)
    .map((r) => {
      const name = r.rawName.includes('/') ? (r.rawName.split('/').pop() || r.rawName) : r.rawName;
      return {
        name,
        fullName: r.rawName.includes('/') ? r.rawName : undefined,
        stars: '—',
        language: r.lang || 'Unknown',
        delta: `+${r.deltaNum.toLocaleString('en-US')}/d`,
      };
    });
}

function hnStyleTitleFromText(text: string): string | null {
  const m = text.match(/\((\d+)\s+pts,\s+(\d+)\s+comments\)\s*$/);
  if (!m || m.index === undefined) return null;
  return text.slice(0, m.index).trim();
}

export type ResolvedInsightLink = {
  href: string;
  label: string;
  /** True when href is the canonical story URL (not a search / discovery URL). */
  isDirect: boolean;
};

/**
 * Prefer explicit `url` from scrapers; otherwise derive HN / PH / Lobsters discovery links from text + tags.
 */
export function resolveInsightLink(insight: {
  text: string;
  tags: string[];
  url?: string;
}): ResolvedInsightLink | null {
  const direct = insight.url?.trim();
  if (direct && /^https?:\/\//i.test(direct)) {
    return { href: direct, label: 'Open source', isDirect: true };
  }

  const tags = new Set(insight.tags);

  if (tags.has('hacker-news') || tags.has('show-hn')) {
    const title = hnStyleTitleFromText(insight.text);
    if (title) {
      return {
        href: `https://hn.algolia.com/?query=${encodeURIComponent(title)}`,
        label: 'Open on Hacker News',
        isDirect: false,
      };
    }
  }

  if (tags.has('product-hunt')) {
    const ph = insight.text.match(/^([^:]+):\s*/);
    if (ph) {
      const name = ph[1].trim();
      return {
        href: `https://www.producthunt.com/search?q=${encodeURIComponent(name)}`,
        label: 'Search Product Hunt',
        isDirect: false,
      };
    }
  }

  if (tags.has('lobsters')) {
    const lob = insight.text.match(/^(.+?)\s+\(\d+\s+pts,\s+Lobsters\)/);
    if (lob) {
      return {
        href: `https://lobste.rs/search?q=${encodeURIComponent(lob[1].trim())}&what=stories&order=newest`,
        label: 'Search Lobsters',
        isDirect: false,
      };
    }
  }

  return null;
}
