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

/* ── Episode headline ─────────────────────────────────────────────────────── */

export const HEADLINE_MAX = 100;
/** Google truncates a title around 60 characters, and the layout appends
 *  daily pages pass bareTitle so nothing is appended. */
export const HEADLINE_TITLE_MAX = 62;
const HEADLINE_MIN = 25;

/** Words that read as a dangling fragment when a clip lands on them. */
const TRAILING_STOPWORDS = new Set(
  ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'onto',
   'or', 'over', 'per', 'than', 'that', 'the', 'to', 'up', 'via', 'with', 'without'],
);

const squash = (text: string) => (text ?? '').replace(/\s+/g, ' ').trim();

/** Everything up to the first sentence break, so a headline is never two thoughts. */
function firstSentence(text: string): string {
  const line = squash(text);
  const end = line.search(/(?<=[a-z0-9)\]"'])\.\s+(?=[A-Z(])/);
  return end === -1 ? line.replace(/\.$/, '') : line.slice(0, end);
}

/** Clip at a clause break when there is one, else at a word break — never mid-word. */
function clip(text: string, max = HEADLINE_MAX): string {
  const line = squash(text);
  if (line.length <= max) return tidy(line);
  const window = line.slice(0, max + 1);
  for (const separator of [', ', ' -- ', ' — ', '; ', ' – ']) {
    const at = window.lastIndexOf(separator);
    if (at > 40) return tidy(window.slice(0, at));
  }
  const space = window.lastIndexOf(' ');
  return tidy(space > 40 ? window.slice(0, space) : line.slice(0, max));
}

/** Drop trailing punctuation, an unbalanced quote, and a dangling stopword. */
function tidy(text: string): string {
  let out = squash(text).replace(/[\s,;:–—-]+$/, '');
  for (const quote of ["'", '"', '“', '‘']) {
    const opens = out.split(quote).length - 1;
    if (opens % 2 === 1 && out.endsWith(quote)) out = out.slice(0, -1).trimEnd();
  }
  const words = out.split(' ');
  while (words.length > 4 && TRAILING_STOPWORDS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  return words.join(' ').replace(/[\s,;:–—-]+$/, '');
}

type HeadlineSource = {
  headline?: string;
  date: string;
  scenes?: { headlines?: { text: string }[] };
  insights?: { text: string }[];
};

/**
 * The real heading for a brief.
 *
 * `episode.title` is the literal constant "Intelligence Brief" on every record,
 * and `episode.subtitle` is three insight texts each cut at 50 characters and
 * joined with commas, so it breaks mid-word. Neither can be a heading. The top
 * insight of the day is written prose and is unique per edition, so derive from
 * that and let the generator override it with an explicit `headline`.
 */
export function episodeHeadline(episode: HeadlineSource): string {
  const explicit = squash(episode.headline ?? '');
  if (explicit) return explicit;

  const candidates = [
    episode.scenes?.headlines?.[0]?.text,
    episode.insights?.[0]?.text,
  ];
  for (const candidate of candidates) {
    const text = clip(firstSentence(squash(candidate ?? '').replace(/^\*\*|\*\*$/g, '')));
    if (text.length >= HEADLINE_MIN) return text;
  }
  return `Intelligence Brief — ${episode.date}`;
}

/** The same headline, cut short enough to survive a SERP title. */
export function episodeTitle(episode: HeadlineSource): string {
  return clip(episodeHeadline(episode), HEADLINE_TITLE_MAX);
}

export const DESCRIPTION_MAX = 155;

/**
 * Meta description for a brief.
 *
 * `episode.subtitle` is three insight texts each cut at exactly 50 characters
 * and joined with commas, so stored records end clauses mid-word
 * ("...security-audit-skil,"). Rebuild from the same source with word-safe
 * clipping instead of shipping that into a SERP snippet.
 */
export function episodeDescription(episode: HeadlineSource & { subtitle?: string }): string {
  const parts = (episode.scenes?.headlines ?? episode.insights ?? [])
    .slice(0, 3)
    .map((item) => clip(firstSentence(squash(item.text ?? '')), 60))
    .filter((part) => part.length >= 15);

  const rebuilt = parts.join(' · ');
  if (rebuilt.length >= 60) return clip(rebuilt, DESCRIPTION_MAX);
  return clip(squash(episode.subtitle ?? ''), DESCRIPTION_MAX) || episodeHeadline(episode);
}
