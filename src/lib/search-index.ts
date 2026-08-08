/**
 * Build the client-side search index from the episodes content collection.
 *
 * One document per searchable fragment (insight, headline, takeaway, repo,
 * subtitle) rather than one per episode: a visitor who half-remembers a single
 * sentence should get that sentence back, not a date to hunt through.
 *
 * Per-episode metadata lives in a separate `episodes` lookup keyed by date.
 * Inlining it on every document repeated each ~200-character subtitle across
 * all of that episode's documents and nearly doubled the shipped index.
 */

/** Which part of an episode a result came from. Drives the result label. */
export type SearchDocKind = 'insight' | 'headline' | 'takeaway' | 'repo' | 'subtitle';

export interface SearchDoc {
  /** Stable across builds: `${date}:${kind}:${ordinal}`. */
  id: string;
  kind: SearchDocKind;
  /** The matched, displayed prose. */
  text: string;
  /** Key into `SearchIndexFile.episodes`. */
  date: string;
  /** Omitted when empty, to keep the shipped index small. */
  tags?: string[];
  source?: string;
  /** Canonical link when the scraper had one. */
  url?: string;
}

export interface SearchEpisodeMeta {
  episodeNumber: number;
  subtitle: string;
}

export interface SearchIndexFile {
  episodes: Record<string, SearchEpisodeMeta>;
  docs: SearchDoc[];
}

/** The episode shape this module needs — a structural subset of the Zod schema. */
export interface IndexableEpisode {
  date: string;
  episodeNumber: number;
  subtitle: string;
  insights: Array<{ text: string; tags: string[]; source?: string; url?: string }>;
  trending: Array<{ name: string; fullName?: string; language: string; delta: string }>;
  scenes: {
    headlines: Array<{ text: string; metric: string; source: string }>;
    takeaway: { text: string };
  };
}

/** Scraped placeholders that carry no meaning — never worth indexing. */
const EMPTY_TEXT = new Set(['', '—', '-', 'n/a', 'tbd']);

function isMeaningful(text: string): boolean {
  return !EMPTY_TEXT.has(text.trim().toLowerCase());
}

/**
 * Headlines and takeaways usually restate an insight rather than repeat it
 * exactly — measured at 70% of them, typically the same prose trimmed by a few
 * dozen characters. Exact-match dedupe misses those, and the visitor then sees
 * one story twice under two labels.
 */
function normalizeForDedupe(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Prose kinds long enough for near-duplicate comparison to be meaningful. */
const LONG_FORM: ReadonlySet<SearchDocKind> = new Set([
  'insight',
  'headline',
  'takeaway',
  'subtitle',
]);

/** Shared opening this long means the same story, whatever the tail says. */
const SHARED_PREFIX = 60;

function isNearDuplicate(candidate: string, accepted: string): boolean {
  if (candidate.includes(accepted) || accepted.includes(candidate)) return true;
  if (candidate.length < SHARED_PREFIX || accepted.length < SHARED_PREFIX) return false;
  return candidate.slice(0, SHARED_PREFIX) === accepted.slice(0, SHARED_PREFIX);
}

/**
 * Flatten episodes into search documents, newest first.
 *
 * Within one episode, insights win over headlines and takeaways on duplicate
 * prose, because insights carry tags and a source link.
 */
export function buildSearchIndex(episodes: IndexableEpisode[]): SearchIndexFile {
  const sorted = [...episodes].sort((a, b) => b.date.localeCompare(a.date));
  const meta: Record<string, SearchEpisodeMeta> = {};
  const docs: SearchDoc[] = [];

  for (const ep of sorted) {
    meta[ep.date] = { episodeNumber: ep.episodeNumber, subtitle: ep.subtitle };

    const seen = new Set<string>();
    /** Accepted long-form prose for this episode, for near-duplicate comparison. */
    const acceptedProse: string[] = [];

    const push = (doc: SearchDoc) => {
      if (!isMeaningful(doc.text)) return;

      const key = normalizeForDedupe(doc.text);
      if (seen.has(key)) return;

      // Repo names are short and often appear inside insight prose ("kubernetes"),
      // so they get exact-match dedupe only — never near-duplicate.
      const isProse = LONG_FORM.has(doc.kind);
      if (isProse && acceptedProse.some((prev) => isNearDuplicate(key, prev))) return;

      seen.add(key);
      if (isProse) acceptedProse.push(key);
      if (doc.tags && doc.tags.length === 0) delete doc.tags;
      docs.push(doc);
    };

    // Insights are pushed first so they win every near-duplicate contest: only
    // they carry tags and a source link.
    ep.insights.forEach((insight, i) => {
      push({
        id: `${ep.date}:insight:${i}`,
        kind: 'insight',
        text: insight.text,
        date: ep.date,
        tags: insight.tags,
        source: insight.source,
        url: insight.url,
      });
    });

    push({
      id: `${ep.date}:subtitle:0`,
      kind: 'subtitle',
      text: ep.subtitle,
      date: ep.date,
    });

    ep.scenes.headlines.forEach((headline, i) => {
      push({
        id: `${ep.date}:headline:${i}`,
        kind: 'headline',
        text: headline.text,
        date: ep.date,
        source: isMeaningful(headline.source) ? headline.source : undefined,
      });
    });

    push({
      id: `${ep.date}:takeaway:0`,
      kind: 'takeaway',
      text: ep.scenes.takeaway.text,
      date: ep.date,
    });

    ep.trending.forEach((repo, i) => {
      const label = repo.fullName ?? repo.name;
      push({
        id: `${ep.date}:repo:${i}`,
        kind: 'repo',
        text: label,
        date: ep.date,
        tags: isMeaningful(repo.language) ? [repo.language] : [],
        source: isMeaningful(repo.delta) ? repo.delta : undefined,
        url: repo.fullName?.includes('/') ? `https://github.com/${repo.fullName}` : undefined,
      });
    });
  }

  return { episodes: meta, docs };
}
