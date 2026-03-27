import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { colors, fonts } from '../constants';
import type { Stat } from '../types';

interface NumbersGridProps {
  stats: Stat[];
}

const AnimatedNumber: React.FC<{ value: string; startFrame: number }> = ({ value, startFrame }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  // Parse numeric value (strip commas)
  const numericStr = value.replace(/,/g, '');
  const target = parseInt(numericStr, 10);

  if (isNaN(target)) {
    // Non-numeric, just fade in
    const opacity = interpolate(localFrame, [0, 10], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
    return <span style={{ opacity }}>{value}</span>;
  }

  const progress = interpolate(localFrame, [0, 24], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  const current = Math.round(target * progress);
  const formatted = current.toLocaleString();

  return <>{formatted}</>;
};

export const NumbersGrid: React.FC<NumbersGridProps> = ({ stats }) => {
  const frame = useCurrentFrame();

  const headerOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.cream, justifyContent: 'center', alignItems: 'center' }}>
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
        BY THE NUMBERS
      </div>

      {/* 2x2 Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 40,
          width: 1000,
          marginTop: 40,
        }}
      >
        {stats.slice(0, 4).map((stat, i) => {
          const cellDelay = i * 8;
          const cellOpacity = interpolate(frame, [12 + cellDelay, 22 + cellDelay], [0, 1], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          });
          const cellY = interpolate(frame, [12 + cellDelay, 22 + cellDelay], [15, 0], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          });

          return (
            <div
              key={i}
              style={{
                opacity: cellOpacity,
                transform: `translateY(${cellY}px)`,
                padding: '36px 32px',
                borderLeft: `4px solid ${colors.terracotta}`,
              }}
            >
              <div style={{ fontFamily: fonts.mono, fontSize: 64, fontWeight: 700, color: colors.navy, lineHeight: 1 }}>
                <AnimatedNumber value={stat.value} startFrame={12 + cellDelay} />
              </div>
              <div style={{ fontFamily: fonts.mono, fontSize: 18, color: colors.gray, marginTop: 4 }}>
                {stat.unit}
              </div>
              <div style={{ fontFamily: fonts.body, fontSize: 18, color: colors.gray, marginTop: 12 }}>
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
