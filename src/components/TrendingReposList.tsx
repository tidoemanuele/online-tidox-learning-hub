import React, { useCallback, useMemo, useState } from 'react';
import type { TrendingRepo } from '@tidox/video/src/types';
import { extractTrendingFallbackFromTexts } from '../lib/hub-episode-utils';

function repoUrl(repo: TrendingRepo): string {
  if (repo.fullName?.includes('/')) {
    return `https://github.com/${repo.fullName}`;
  }
  const q = encodeURIComponent(repo.name);
  return `https://github.com/search?q=${q}&type=repositories`;
}

interface TrendingReposListProps {
  repos: TrendingRepo[];
  /** When `repos` is empty, try to recover GitHub-style rows from episode insight prose. */
  insightTextsFallback?: string[];
}

export const TrendingReposList: React.FC<TrendingReposListProps> = ({
  repos,
  insightTextsFallback = [],
}) => {
  const displayRepos = useMemo(() => {
    if (repos.length > 0) return repos;
    if (insightTextsFallback.length === 0) return [];
    return extractTrendingFallbackFromTexts(insightTextsFallback, 8);
  }, [repos, insightTextsFallback]);

  if (displayRepos.length === 0) {
    return (
      <div className="text-[13px] text-gray space-y-3 leading-relaxed">
        <p>
          No trending snapshot for this episode (GitHub trending JSON was not in the research bundle).
          Open live trending on GitHub, or check topic summaries in Today&apos;s Insights for named repos.
        </p>
        <a
          href="https://github.com/trending?since=daily"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-heading hover:text-terracotta transition-colors"
        >
          github.com/trending
          <span aria-hidden>↗</span>
        </a>
      </div>
    );
  }

  const usedFallback = repos.length === 0 && insightTextsFallback.length > 0;

  return (
    <div>
      {usedFallback && (
        <p className="text-[11px] text-gray mb-3 leading-snug">
          Recovered from insight text (no <code className="text-[10px] px-1 rounded bg-light-bg">github-trending.json</code> for this date).
        </p>
      )}
      <ul className="list-none p-0 m-0">
        {displayRepos.map((repo, i) => (
          <TrendingRepoRow key={`${repo.name}-${i}`} repo={repo} />
        ))}
      </ul>
    </div>
  );
};

const TrendingRepoRow: React.FC<{ repo: TrendingRepo }> = ({ repo }) => {
  const url = repoUrl(repo);
  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(() => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }, [url]);

  const label = repo.fullName ?? repo.name;

  return (
    <li className="flex justify-between items-start gap-3 py-2.5 border-b border-divider last:border-b-0 text-[13px]">
      <div className="flex-1 min-w-[40%]">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-heading hover:text-terracotta transition-colors block [overflow-wrap:anywhere] break-words"
        >
          {label}
        </a>
        <p className="text-[11px] text-gray">{repo.language}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
        <button
          type="button"
          onClick={copyLink}
          className="p-1.5 rounded border border-divider text-gray hover:text-cream hover:border-heading/25 transition-colors flex items-center justify-center"
          aria-label={copied ? `Copied ${label} URL` : `Copy GitHub URL for ${label}`}
          title={copied ? 'Copied' : 'Copy link'}
        >
          {copied ? (
            <svg className="w-4 h-4 text-terracotta" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          )}
        </button>
        <span className="font-[family-name:var(--font-mono)] text-[12px] text-terracotta whitespace-nowrap">
          {repo.delta}
        </span>
      </div>
    </li>
  );
};
