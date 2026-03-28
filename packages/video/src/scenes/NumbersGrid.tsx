import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from 'remotion';
import { colors, fonts } from '../constants';
import type { Stat } from '../types';

interface NumbersGridProps {
  stats: Stat[];
}

function parseValue(val: string): number {
  const cleaned = val.replace(/,/g, '').trim();
  if (cleaned.endsWith('k') || cleaned.endsWith('K')) return parseFloat(cleaned) * 1000;
  if (cleaned.endsWith('m') || cleaned.endsWith('M')) return parseFloat(cleaned) * 1_000_000;
  return parseFloat(cleaned) || 0;
}

function formatCounter(current: number, original: string): string {
  const cleaned = original.replace(/,/g, '').trim();
  if (cleaned.endsWith('k') || cleaned.endsWith('K')) return (current / 1000).toFixed(1) + 'k';
  if (cleaned.endsWith('m') || cleaned.endsWith('M')) return (current / 1_000_000).toFixed(1) + 'M';
  return Math.round(current).toLocaleString();
}

const CounterCell: React.FC<{ stat: Stat; index: number }> = ({ stat, index }) => {
  const frame = useCurrentFrame();

  // Stagger: each cell starts 12 frames (0.4s) after the previous
  const cellStart = 10 + index * 12;
  const cellOpacity = interpolate(frame, [cellStart, cellStart + 6], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Counter rolls from 0 to target over 24 frames (0.8s), with easeOut
  const target = parseValue(stat.value);
  const counterProgress = interpolate(frame, [cellStart + 4, cellStart + 28], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const currentValue = target * counterProgress;
  const displayValue = counterProgress >= 1 ? stat.value : formatCounter(currentValue, stat.value);

  return (
    <div
      style={{
        width: '50%',
        padding: '36px 40px',
        opacity: cellOpacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}
    >
      {/* Top rule */}
      <div style={{ width: '90%', height: 1, backgroundColor: colors.divider, marginBottom: 28 }} />

      {/* Number + unit */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 80,
            fontWeight: 700,
            color: colors.navy,
            lineHeight: 1,
          }}
        >
          {displayValue}
        </span>
        {stat.unit && (
          <span style={{ fontFamily: fonts.mono, fontSize: 24, color: colors.gray }}>
            {stat.unit}
          </span>
        )}
      </div>

      {/* Label */}
      <div style={{ fontFamily: fonts.body, fontSize: 20, color: colors.gray, marginTop: 10 }}>
        {stat.label}
      </div>
    </div>
  );
};

export const NumbersGrid: React.FC<NumbersGridProps> = ({ stats }) => {
  const frame = useCurrentFrame();
  const headerOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.cream,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 140,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontFamily: fonts.body,
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: 8,
          color: colors.gray,
          marginBottom: 60,
          opacity: headerOpacity,
        }}
      >
        BY THE NUMBERS
      </div>

      {/* 2x2 grid */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          width: 1000,
        }}
      >
        {stats.slice(0, 4).map((stat, i) => (
          <CounterCell key={i} stat={stat} index={i} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
