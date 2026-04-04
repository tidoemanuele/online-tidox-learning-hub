import React, { useCallback, useState } from 'react';
import type { TrendingRepo } from '@tidox/video/src/types';

function repoUrl(repo: TrendingRepo): string {
  if (repo.fullName?.includes('/')) {
    return `https://github.com/${repo.fullName}`;
  }
  const q = encodeURIComponent(repo.name);
  return `https://github.com/search?q=${q}&type=repositories`;
}

interface TrendingReposListProps {
  repos: TrendingRepo[];
}

export const TrendingReposList: React.FC<TrendingReposListProps> = ({ repos }) => {
  return (
    <ul className="list-none p-0 m-0">
      {repos.map((repo, i) => (
        <TrendingRepoRow key={`${repo.name}-${i}`} repo={repo} />
      ))}
    </ul>
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
