import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildIndex,
  excerpt,
  search,
  type Hit,
  type RecordKind,
  type SearchEntry,
} from '../lib/search';

const PAGE = 40;

type Tab = { id: '' | RecordKind; label: string };

const TABS: Tab[] = [
  { id: '', label: 'Everything' },
  { id: 'i', label: 'Insights' },
  { id: 'r', label: 'Repos' },
];

type Props = {
  /** Path the query string is written back to. */
  basePath?: string;
  /** Page content to hide while results are showing. */
  hideSelector?: string;
};

/**
 * Search across every episode, as you type.
 *
 * The index is fetched on the first interaction rather than at page load: it
 * covers the whole archive, and most visitors read the page they landed on
 * without searching at all.
 */
export default function ArchiveSearch({
  basePath = '/archive',
  hideSelector = '#episode-list',
}: Props = {}) {
  const [records, setRecords] = useState<SearchEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'' | RecordKind>('');
  const [limit, setLimit] = useState(PAGE);
  const inputRef = useRef<HTMLInputElement>(null);
  const requested = useRef(false);

  const deferredQuery = useDeferredValue(query);

  function load() {
    if (requested.current) return;
    requested.current = true;
    setLoading(true);
    fetch('/search-index.json')
      .then((response) => response.json())
      .then((rows) => setRecords(buildIndex(rows)))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }

  // A query in the URL (?q=github) should run without waiting for a keystroke.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get('q') ?? '';
    const initialKind = params.get('k');
    if (initial) setQuery(initial);
    if (initialKind === 'i' || initialKind === 'r') setKind(initialKind);
    if (initial || initialKind) load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (kind) params.set('k', kind);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `${basePath}?${qs}` : basePath);
    setLimit(PAGE);
  }, [query, kind, basePath]);

  const hits: Hit[] = useMemo(() => {
    if (!records) return [];
    return search(records, deferredQuery, Infinity, kind || undefined);
  }, [records, deferredQuery, kind]);

  const active = Boolean(deferredQuery.trim() || kind);
  const settled = deferredQuery === query;

  // The page's own content is server-rendered next to this island; it would
  // just be noise under a set of results.
  useEffect(() => {
    const content = document.querySelector<HTMLElement>(hideSelector);
    if (content) content.hidden = active;
  }, [active, hideSelector]);

  return (
    <div className="mb-8">
      <label className="sr-only" htmlFor="archive-search">
        Search the archive
      </label>
      <input
        id="archive-search"
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Search every episode — try github, anthropic, rust…"
        onFocus={load}
        onChange={(event) => {
          load();
          setQuery(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setQuery('');
            setKind('');
          }
        }}
        className="w-full px-4 py-3 text-[15px] bg-page border border-divider rounded focus:outline-none focus:border-terracotta transition-colors"
      />

      <div className="flex flex-wrap items-center gap-2 mt-3">
        {TABS.map((tab) => (
          <button
            key={tab.id || 'all'}
            type="button"
            onClick={() => {
              load();
              setKind(tab.id);
            }}
            aria-pressed={kind === tab.id}
            className={`text-[12px] px-3 py-1 rounded-full border transition-colors ${
              kind === tab.id
                ? 'bg-terracotta-fill text-white border-terracotta-fill'
                : 'border-divider text-gray hover:text-near-black'
            }`}
          >
            {tab.label}
          </button>
        ))}

        <span className="text-[12px] font-[family-name:var(--font-mono)] text-gray ml-auto">
          {loading && !records
            ? 'Loading the archive…'
            : active
              ? `${hits.length} ${hits.length === 1 ? 'result' : 'results'}`
              : ''}
        </span>
      </div>

      {active && records && (
        <div className="mt-6 space-y-0">
          {hits.slice(0, limit).map((hit) => (
            <ResultRow key={`${hit.record.k}-${hit.record.d}-${hit.record.x}`} hit={hit} query={deferredQuery} />
          ))}

          {hits.length === 0 && settled && (
            <p className="text-[14px] text-gray py-6">
              Nothing matches. Try a shorter word, or a tag like <code>ai</code> or <code>rust</code>.
            </p>
          )}

          {hits.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((current) => current + PAGE)}
              className="mt-4 text-[13px] text-terracotta hover:underline"
            >
              Show {Math.min(PAGE, hits.length - limit)} more ({hits.length - limit} left)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({ hit, query }: { hit: Hit; query: string }) {
  const { record } = hit;
  const isRepo = record.k === 'r';
  const episodeHref = `/daily/${record.d}${isRepo ? '' : `#insight-${record.x}`}`;

  return (
    <article className="py-4 border-b border-divider">
      <div className="flex items-baseline gap-3 mb-1.5">
        <a
          href={episodeHref}
          className="text-[11px] font-[family-name:var(--font-mono)] text-gray hover:text-terracotta transition-colors"
        >
          {record.d}
        </a>
        <span className="text-[10px] uppercase tracking-[1px] text-terracotta">
          {isRepo ? 'Repo' : 'Insight'}
        </span>
        {isRepo && record.c > 1 && <span className="text-[11px] text-gray">latest</span>}
        {record.h && <span className="text-[11px] text-gray">{record.h}</span>}
      </div>

      {isRepo ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <a
            href={record.u || episodeHref}
            target={record.u ? '_blank' : undefined}
            rel={record.u ? 'noopener noreferrer' : undefined}
            className="text-[15px] font-semibold text-near-black hover:text-terracotta transition-colors"
          >
            {record.t}
          </a>
          {record.g && <span className="text-[12px] text-gray">{record.g}</span>}
          {record.o && <span className="text-[12px] font-[family-name:var(--font-mono)] text-gray">{record.o}</span>}
          {record.c > 1 && (
            <span className="text-[11px] text-gray">
              {record.c} days trending, from {record.f}
            </span>
          )}
        </div>
      ) : (
        <>
          <p className="text-[14px] leading-relaxed text-near-black">{excerpt(record.t, query)}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {record.g
              .split(' ')
              .filter(Boolean)
              .map((tag) => (
                <span key={tag} className="text-[10px] bg-light-bg text-gray px-2 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            {record.u && (
              <a
                href={record.u}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-semibold text-terracotta hover:underline"
              >
                Source ↗
              </a>
            )}
          </div>
        </>
      )}
    </article>
  );
}
