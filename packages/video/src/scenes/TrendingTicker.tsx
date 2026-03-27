import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { colors, fonts, DURATIONS } from '../constants';
import type { TrendingRepo } from '../types';

interface TrendingTickerProps {
  repos: TrendingRepo[];
}

export const TrendingTicker: React.FC<TrendingTickerProps> = ({ repos }) => {
  const frame = useCurrentFrame();
  const totalFrames = DURATIONS.trendingTicker;

  const headerOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  // Scroll the repo list horizontally
  const scrollX = interpolate(frame, [15, totalFrames - 15], [0, -((repos.length - 3) * 420)], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.navy }}>
      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: 120,
          left: 140,
          opacity: headerOpacity,
          fontFamily: fonts.mono,
          fontSize: 14,
          letterSpacing: 3,
          color: colors.terracotta,
        }}
      >
        TRENDING ON GITHUB
      </div>

      {/* Scrolling repo cards */}
      <div
        style={{
          position: 'absolute',
          top: 220,
          left: 140,
          display: 'flex',
          gap: 32,
          transform: `translateX(${scrollX}px)`,
        }}
      >
        {repos.map((repo, i) => {
          const cardOpacity = interpolate(frame, [8 + i * 6, 16 + i * 6], [0, 1], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          });

          return (
            <div
              key={i}
              style={{
                width: 388,
                padding: '32px 28px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                opacity: cardOpacity,
                flexShrink: 0,
              }}
            >
              <div style={{ fontFamily: fonts.body, fontSize: 22, fontWeight: 600, color: colors.cream, marginBottom: 8 }}>
                {repo.name}
              </div>
              <div style={{ fontFamily: fonts.mono, fontSize: 14, color: 'rgba(250,250,245,0.5)', marginBottom: 20 }}>
                {repo.language}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: fonts.mono, fontSize: 18, color: 'rgba(250,250,245,0.7)' }}>
                  {repo.stars}
                </div>
                <div style={{ fontFamily: fonts.mono, fontSize: 20, fontWeight: 600, color: colors.terracotta }}>
                  {repo.delta}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
