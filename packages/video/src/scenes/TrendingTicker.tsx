import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { colors, fonts } from '../constants';
import type { TrendingRepo } from '../types';

interface TrendingTickerProps {
  repos: TrendingRepo[];
}

export const TrendingTicker: React.FC<TrendingTickerProps> = ({ repos }) => {
  const frame = useCurrentFrame();

  const headerOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const ruleOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.cream,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        paddingTop: 140,
        paddingLeft: 120,
        paddingRight: 120,
      }}
    >
      {/* Section header */}
      <div
        style={{
          fontFamily: fonts.body,
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: 8,
          color: colors.gray,
          marginBottom: 36,
          opacity: headerOpacity,
        }}
      >
        TRENDING ON GITHUB
      </div>

      {/* Top rule */}
      <div
        style={{
          width: '100%',
          maxWidth: 1000,
          height: 1,
          backgroundColor: colors.divider,
          marginBottom: 40,
          opacity: ruleOpacity,
        }}
      />

      {/* Repo rows — staggered reveal, 1s apart */}
      {repos.map((repo, i) => {
        // Each row fades in 6 frames (200ms), staggered by 30 frames (1s)
        const rowStart = 10 + i * 30;
        const rowOpacity = interpolate(frame, [rowStart, rowStart + 6], [0, 1], {
          extrapolateRight: 'clamp',
          extrapolateLeft: 'clamp',
        });

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: 1000,
              marginBottom: 36,
              opacity: rowOpacity,
            }}
          >
            {/* Left: repo name */}
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 28,
                fontWeight: 500,
                color: colors.nearBlack,
              }}
            >
              {repo.name}
            </div>

            {/* Right: stars, language badge, delta */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <span style={{ fontFamily: fonts.mono, fontSize: 22, color: colors.nearBlack }}>
                ★ {repo.stars}
              </span>
              <span
                style={{
                  fontFamily: fonts.body,
                  fontSize: 16,
                  fontWeight: 500,
                  color: colors.cream,
                  backgroundColor: colors.navy,
                  borderRadius: 4,
                  padding: '5px 12px',
                }}
              >
                {repo.language}
              </span>
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 22,
                  fontWeight: 600,
                  color: '#2D7D46',
                }}
              >
                {repo.delta}
              </span>
            </div>
          </div>
        );
      })}

      {/* Bottom rule */}
      <div
        style={{
          width: '100%',
          maxWidth: 1000,
          height: 1,
          backgroundColor: colors.divider,
          marginTop: 4,
          opacity: ruleOpacity,
        }}
      />
    </AbsoluteFill>
  );
};
