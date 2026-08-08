import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MiniSearch from 'minisearch';
import type {
  SearchDoc,
  SearchDocKind,
  SearchEpisodeMeta,
  SearchIndexFile,
} from '../lib/search-index';
import { resolveInsightLink } from '../lib/hub-episode-utils';

const KIND_LABEL: Record<SearchDocKind, string> = {
  insight: 'Insight',
  headline: 'Headline',
  takeaway: 'Takeaway',
  repo: 'Repo',
  subtitle: 'Edition',
};

/** Suggested when the box is empty — real terms, so every one returns hits. */
const EXAMPLE_QUERIES = ['DeepMind', 'Cloudflare', 'open source', 'benchmark'];

const MAX_RESULTS = 60;
const DEBOUNCE_MS = 200;
const MIN_QUERY_LENGTH = 2;

interface SearchResults {
  docs: SearchDoc[];
  /** True when no document matched every word and the search widened to any word. */
  loose: boolean;
}


type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; index: SearchIndexFile }
  | { status: 'error'; message: string };

export const EpisodeSearch: React.FC = () => {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  /**
   * `output: 'static'` means `?q=` is not available at prerender time, and
   * seeding state from it during render would desync hydration. Read it after
   * mount instead, so a shared result link still opens on its query.
   */
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('q') ?? '';
    if (!fromUrl) return;
    setInput(fromUrl);
    setQuery(fromUrl);
  }, []);

  // ponytail: whole index shipped to the client — 665KB raw / 167KB gzipped at
  // 139 episodes, and it grows by roughly 1.2KB gzipped per new episode.
  // Above ~500 episodes, move to a chunked index (Pagefind) or a search endpoint.
  useEffect(() => {
    const controller = new AbortController();

    fetch('/search-index.json', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Index request failed (${res.status})`);
        return res.json() as Promise<SearchIndexFile>;
      })
      .then((index) => setLoad({ status: 'ready', index }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoad({
          status: 'error',
          message: error instanceof Error ? error.message : 'Could not load the search index.',
        });
      });

    return () => controller.abort();
  }, []);

  const engine = useMemo(() => {
    if (load.status !== 'ready') return null;

    const mini = new MiniSearch<SearchDoc>({
      fields: ['text', 'tags', 'source'],
      storeFields: ['kind', 'text', 'date', 'tags', 'source', 'url'],
      searchOptions: {
        // Half-remembered recall: match partial words and tolerate typos.
        prefix: true,
        fuzzy: 0.2,
        boost: { text: 2 },
      },
    });
    mini.addAll(load.index.docs);
    return mini;
  }, [load]);

  const results = useMemo<SearchResults>(() => {
    const trimmed = query.trim();
    if (!engine || trimmed.length < MIN_QUERY_LENGTH) return { docs: [], loose: false };

    // Require every word by default. MiniSearch combines with OR out of the box,
    // which turns "rust browser engine" into 254 hits across 99 episodes instead
    // of the 3 that actually mention all three words.
    const strict = engine.search(trimmed, { combineWith: 'AND' }) as unknown as SearchDoc[];
    if (strict.length > 0) return { docs: strict.slice(0, MAX_RESULTS), loose: false };

    // Nothing matched every word — one of them is probably misremembered.
    // Widen to any word rather than showing an empty page.
    const loose = engine.search(trimmed, { combineWith: 'OR' }) as unknown as SearchDoc[];
    return { docs: loose.slice(0, MAX_RESULTS), loose: loose.length > 0 };
  }, [engine, query]);

  // Debounce so a fast typist does not re-run the search on every keystroke.
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(input), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [input]);

  // Keep the query in the URL: results stay shareable and survive a reload.
  // Skip the first pass — it runs before the read-from-URL effect has applied
  // its state, and would strip `?q=` off a freshly opened shared link.
  const urlWriteArmed = useRef(false);
  useEffect(() => {
    if (!urlWriteArmed.current) {
      urlWriteArmed.current = true;
      return;
    }

    const url = new URL(window.location.href);
    const current = url.searchParams.get('q') ?? '';
    if (current === query) return;

    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
  }, [query]);

  const inputRef = useRef<HTMLInputElement>(null);
  const runExample = useCallback((example: string) => {
    setInput(example);
    setQuery(example);
    inputRef.current?.focus();
  }, []);

  const trimmed = query.trim();
  const episodeMeta = load.status === 'ready' ? load.index.episodes : null;
  const episodeCount = episodeMeta ? Object.keys(episodeMeta).length : 0;

  return (
    <div>
      <label htmlFor="episode-search" className="sr-only">
        Search every episode
      </label>
      <input
        id="episode-search"
        ref={inputRef}
        type="search"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search every episode…"
        autoComplete="off"
        // eslint-disable-next-line jsx-a11y/no-autofocus -- search is this page's only purpose
        autoFocus
        className="w-full bg-light-bg border border-divider rounded-lg px-4 py-3 text-[15px] text-near-black placeholder:text-gray/70 focus:outline-none focus:border-terracotta transition-colors"
      />

      <div className="mt-3 min-h-[1.25rem] text-[12px] font-[family-name:var(--font-mono)] text-gray" role="status" aria-live="polite">
        {load.status === 'loading' && 'Loading the archive…'}
        {load.status === 'error' && (
          <span className="text-terracotta">{load.message} Try reloading the page.</span>
        )}
        {load.status === 'ready' && trimmed.length >= MIN_QUERY_LENGTH && (
          <>
            {results.docs.length === 0
              ? 'No matches'
              : `${results.docs.length}${results.docs.length === MAX_RESULTS ? '+' : ''} ${results.docs.length === 1 ? 'match' : 'matches'}`}
            {` · searched ${episodeCount} episodes`}
          </>
        )}
        {load.status === 'ready' &&
          trimmed.length > 0 &&
          trimmed.length < MIN_QUERY_LENGTH &&
          'Keep typing…'}
        {load.status === 'ready' && trimmed.length === 0 && `${episodeCount} episodes indexed`}
      </div>

      {load.status === 'ready' && trimmed.length === 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-gray">Try:</span>
          {EXAMPLE_QUERIES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => runExample(example)}
              className="text-[12px] px-2.5 py-1 rounded border border-divider text-gray hover:text-heading hover:border-gray transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {load.status === 'ready' && trimmed.length >= MIN_QUERY_LENGTH && results.docs.length === 0 && (
        <p className="mt-6 text-[14px] text-gray leading-relaxed">
          Nothing matched <span className="text-near-black">“{trimmed}”</span>. Try fewer words, or
          a name you are sure appeared — search covers insights, headlines, takeaways and repos.
        </p>
      )}

      {results.loose && (
        <p className="mt-6 text-[13px] text-gray leading-relaxed">
          No episode contained every word. Showing anything that matched{' '}
          <span className="text-near-black">any</span> of them.
        </p>
      )}

      {results.docs.length > 0 && episodeMeta && (
        <ol className="mt-6 list-none p-0 m-0">
          {results.docs.map((doc) => (
            <SearchResultRow key={doc.id} doc={doc} episode={episodeMeta[doc.date]} />
          ))}
        </ol>
      )}
    </div>
  );
};

interface SearchResultRowProps {
  doc: SearchDoc;
  episode?: SearchEpisodeMeta;
}

/** How much leading text must agree before the subtitle counts as an echo. */
const ECHO_PREFIX = 40;

/**
 * The episode subtitle places a result in its day. It earns its line only when
 * it says something the result does not: on a `subtitle` doc it IS the text,
 * and the day's lead story opens the subtitle verbatim.
 */
function episodeContext(doc: SearchDoc, episode?: SearchEpisodeMeta): string | undefined {
  if (!episode || doc.kind === 'subtitle') return undefined;
  const head = doc.text.trim().slice(0, ECHO_PREFIX).toLowerCase();
  if (head && episode.subtitle.trim().toLowerCase().startsWith(head)) return undefined;
  return episode.subtitle;
}

const SearchResultRow: React.FC<SearchResultRowProps> = ({ doc, episode }) => {
  const tags = doc.tags ?? [];
  const link = resolveInsightLink({ text: doc.text, tags, url: doc.url });
  const context = episodeContext(doc, episode);

  return (
    <li className="py-5 border-b border-divider last:border-b-0">
      <div className="flex items-center gap-2 flex-wrap mb-2 text-[11px] font-[family-name:var(--font-mono)]">
        <a
          href={`/daily/${doc.date}`}
          className="text-terracotta hover:underline"
          aria-label={
            episode ? `Episode ${episode.episodeNumber}, ${doc.date}` : `Episode ${doc.date}`
          }
        >
          {doc.date.replace(/-/g, '.')}
        </a>
        {episode && (
          <>
            <span className="text-divider" aria-hidden>
              ·
            </span>
            <span className="text-gray">№&nbsp;{episode.episodeNumber}</span>
          </>
        )}
        <span className="text-divider" aria-hidden>
          ·
        </span>
        <span className="text-gray uppercase tracking-[0.08em]">{KIND_LABEL[doc.kind]}</span>
      </div>

      <p className="text-[15px] leading-relaxed text-near-black [overflow-wrap:anywhere]">{doc.text}</p>

      {context && (
        <p className="mt-1.5 text-[12px] text-gray leading-snug [overflow-wrap:anywhere]">
          In: {context}
        </p>
      )}

      <div className="mt-2.5 flex gap-1.5 flex-wrap items-center">
        {link && (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-semibold text-terracotta hover:underline mr-1"
          >
            {link.label} ↗
          </a>
        )}
        {tags.map((tag) => (
          <span key={tag} className="text-[11px] px-2 py-0.5 rounded bg-light-bg text-gray">
            {tag}
          </span>
        ))}
        {doc.source && (
          <span className="text-[11px] px-2 py-0.5 rounded bg-light-bg text-gray font-[family-name:var(--font-mono)]">
            {doc.source}
          </span>
        )}
      </div>
    </li>
  );
};
