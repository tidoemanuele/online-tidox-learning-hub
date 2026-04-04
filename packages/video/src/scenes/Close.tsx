import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { colors, fonts } from '../constants';

interface CloseProps {
  date: string;
}

export const Close: React.FC<CloseProps> = ({ date }) => {
  const frame = useCurrentFrame();

  const ruleOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const titleOpacity = interpolate(frame, [6, 16], [0, 1], { extrapolateRight: 'clamp' });
  const ctaOpacity = interpolate(frame, [14, 24], [0, 1], { extrapolateRight: 'clamp' });
  const hintOpacity = interpolate(frame, [20, 30], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.page,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 80,
      }}
    >
      {/* Top rule */}
      <div
        style={{
          width: 700,
          height: 1,
          backgroundColor: colors.ruleDark,
          marginBottom: 60,
          opacity: ruleOpacity,
        }}
      />

      {/* Title echo */}
      <div
        style={{
          fontFamily: "'Georgia', 'Source Serif 4', serif",
          fontSize: 28,
          fontWeight: 300,
          letterSpacing: 10,
          color: colors.onPage,
          marginBottom: 40,
          opacity: titleOpacity,
        }}
      >
        INTELLIGENCE BRIEF
      </div>

      {/* CTA */}
      <div
        style={{
          fontFamily: fonts.body,
          fontSize: 24,
          color: colors.onPageMuted,
          marginBottom: 20,
          opacity: ctaOpacity,
        }}
      >
        Full briefing available
      </div>

      {/* Podcast hint */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          opacity: hintOpacity,
        }}
      >
        <span style={{ fontFamily: fonts.mono, fontSize: 18, color: colors.terracotta }}>
          ◉
        </span>
        <span style={{ fontFamily: fonts.body, fontSize: 18, letterSpacing: 2, color: colors.onPageMuted }}>
          ~19 min audio brief
        </span>
      </div>

      {/* Bottom rule */}
      <div
        style={{
          width: 700,
          height: 1,
          backgroundColor: colors.ruleDark,
          marginTop: 60,
          opacity: ruleOpacity,
        }}
      />

      {/* Date stamp */}
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 14,
          color: colors.onPageMuted,
          marginTop: 40,
          opacity: hintOpacity,
        }}
      >
        {date}
      </div>
    </AbsoluteFill>
  );
};
