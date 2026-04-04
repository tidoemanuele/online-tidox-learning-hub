import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { colors, fonts } from '../constants';

interface MastheadProps {
  title: string;
  subtitle: string;
  episodeNumber: number;
}

export const Masthead: React.FC<MastheadProps> = ({ title, subtitle, episodeNumber }) => {
  const frame = useCurrentFrame();

  const ruleOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const titleOpacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  const subtitleOpacity = interpolate(frame, [6, 18], [0, 1], { extrapolateRight: 'clamp' });
  const editionOpacity = interpolate(frame, [12, 22], [0, 1], { extrapolateRight: 'clamp' });

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
          marginBottom: 56,
          opacity: ruleOpacity,
        }}
      />

      {/* Title — large serif */}
      <div
        style={{
          fontFamily: "'Georgia', 'Source Serif 4', serif",
          fontSize: 56,
          fontWeight: 300,
          letterSpacing: 8,
          color: colors.onPage,
          opacity: titleOpacity,
        }}
      >
        {title}
      </div>

      {/* Subtitle / date */}
      <div
        style={{
          fontFamily: fonts.body,
          fontSize: 26,
          fontWeight: 400,
          letterSpacing: 6,
          color: colors.onPageMuted,
          marginTop: 36,
          opacity: subtitleOpacity,
        }}
      >
        {subtitle}
      </div>

      {/* Edition label */}
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 16,
          letterSpacing: 4,
          color: colors.onPageMuted,
          marginTop: 56,
          opacity: editionOpacity,
        }}
      >
        DAILY EDITION
      </div>

      {/* Bottom rule */}
      <div
        style={{
          width: 700,
          height: 1,
          backgroundColor: colors.ruleDark,
          marginTop: 56,
          opacity: ruleOpacity,
        }}
      />
    </AbsoluteFill>
  );
};
