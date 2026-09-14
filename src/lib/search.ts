/**
 * Incremental search over the episode archive.
 *
 * The unit of search is the insight, not the episode: someone looking for
 * "anthropic evals" wants the paragraph that mentions it, and the episode it
 * ran in. Each record is folded once when the index is fetched, never per
 * keystroke.
 */

export type RecordKind = 'i' | 'r';

export type SearchRecord = {
  /** 'i' for an insight, 'r' for a trending repo. */
  k: RecordKind;
  /** Episode date, `YYYY-MM-DD`. */
  d: string;
  /** Episode number. */
  n: number;
  /** Episode subtitle. */
  s: string;
  /** Position inside the episode, for the deep link. */
  x: number;
  /** Insight text, or the repo's full name. */
  t: string;
  /** Tags for an insight, language for a repo. */
  g: string;
  /** Source label for an insight, stars and delta for a repo. */
  o: string;
  /** Canonical link, when there is one. */
  u: string;
  /** Host of that link, indexed so "github" finds everything it points at. */
  h: string;
};

export type SearchEntry = {
  record: SearchRecord;
  text: string;
  tags: string;
  subtitle: string;
  source: string;
  host: string;
  /** Everything searchable, folded once. */
  hay: string;
};

export type Hit = { record: SearchRecord; score: number; entry: SearchEntry };

const DIACRITICS = /[̀-ͯ]/g;

/** Lowercase and strip accents, so "deepseek" matches "DeepSeek" and "Müller" matches "muller". */
export function fold(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
}

export function buildIndex(records: SearchRecord[]): SearchEntry[] {
  const index: SearchEntry[] = new Array(records.length);
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const text = fold(record.t);
    const tags = fold(record.g ?? '');
    const subtitle = fold(record.s ?? '');
    const source = fold(record.o ?? '');
    const hostName = fold(record.h ?? '');
    index[i] = {
      record,
      text,
      tags,
      subtitle,
      source,
      host: hostName,
      hay: `${text} ${tags} ${subtitle} ${source} ${hostName} ${record.d}`,
    };
  }
  return index;
}

export function tokenize(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

function wordStart(haystack: string, token: string): boolean {
  const at = haystack.indexOf(token);
  if (at < 0) return false;
  if (at === 0) return true;
  return !/[a-z0-9]/.test(haystack[at - 1]);
}

/**
 * Rank one record. Returns -1 when any token is missing, so every word the
 * reader typed has to appear somewhere.
 */
export function score(entry: SearchEntry, tokens: string[]): number {
  let total = 0;
  for (const token of tokens) {
    if (!entry.hay.includes(token)) return -1;

    if (wordStart(entry.tags, token)) {
      total += 90; // a tag is an editorial label, so it is the strongest signal
    } else if (entry.host.includes(token)) {
      total += 85; // "github" should surface everything that links there
    } else if (wordStart(entry.text, token)) {
      total += 70;
    } else if (entry.text.includes(token)) {
      total += 45;
    } else if (wordStart(entry.subtitle, token)) {
      total += 40;
    } else if (wordStart(entry.source, token)) {
      total += 25;
    } else {
      total += 10; // date, or a mid-word hit somewhere
    }
  }
  return total;
}

/** True when only the episode subtitle, source or date matched, not the insight itself. */
export function matchedOutsideText(entry: SearchEntry, query: string): boolean {
  const tokens = tokenize(query);
  if (!tokens.length) return false;
  return tokens.some((token) => !entry.text.includes(token) && !entry.tags.includes(token));
}

/**
 * Best matches first, newest episode breaking ties. `limit` caps rows returned,
 * not scanned. With `kind` set, only insights or only repos come back, which is
 * what makes the archive readable as a repo feed. An empty query with a kind
 * returns everything of that kind, newest first.
 */
export function search(index: SearchEntry[], query: string, limit = Infinity, kind?: RecordKind): Hit[] {
  const tokens = tokenize(query);
  const pool = kind ? index.filter((entry) => entry.record.k === kind) : index;

  if (!tokens.length) {
    if (!kind) return [];
    const all = pool.map((entry) => ({ record: entry.record, score: 0, entry }));
    all.sort((a, b) => b.record.d.localeCompare(a.record.d) || a.record.x - b.record.x);
    return limit === Infinity ? all : all.slice(0, limit);
  }

  const hits: Hit[] = [];
  for (const entry of pool) {
    const value = score(entry, tokens);
    if (value >= 0) hits.push({ record: entry.record, score: value, entry });
  }
  hits.sort((a, b) => b.score - a.score || b.record.d.localeCompare(a.record.d) || a.record.x - b.record.x);
  return limit === Infinity ? hits : hits.slice(0, limit);
}

/** A window of the insight text around the first match, for the result row. */
export function excerpt(text: string, query: string, width = 180): string {
  const tokens = tokenize(query);
  const folded = fold(text);
  let at = -1;
  for (const token of tokens) {
    const found = folded.indexOf(token);
    if (found >= 0 && (at < 0 || found < at)) at = found;
  }
  if (at < 0 || text.length <= width) return text.slice(0, width);
  const start = Math.max(0, at - Math.floor(width / 3));
  const slice = text.slice(start, start + width);
  return `${start > 0 ? '…' : ''}${slice}${start + width < text.length ? '…' : ''}`;
}
