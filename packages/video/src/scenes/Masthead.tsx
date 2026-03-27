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

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 15], [20, 0], { extrapolateRight: 'clamp' });

  const subtitleOpacity = interpolate(frame, [10, 25], [0, 1], { extrapolateRight: 'clamp' });
  const badgeOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: 'clamp' });

  const accentWidth = interpolate(frame, [0, 20], [0, 120], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.cream, justifyContent: 'center', alignItems: 'center' }}>
      {/* Terracotta accent bar */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 140,
          width: accentWidth,
          height: 6,
          backgroundColor: colors.terracotta,
          transform: 'translateY(-80px)',
        }}
      />

      {/* Episode badge */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 140,
          transform: 'translateY(-120px)',
          opacity: badgeOpacity,
          fontFamily: fonts.mono,
          fontSize: 18,
          letterSpacing: 2,
          color: colors.gray,
        }}
      >
        EPISODE {String(episodeNumber).padStart(3, '0')}
      </div>

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 140,
          transform: `translateY(${titleY - 30}px)`,
          opacity: titleOpacity,
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 48,
          color: colors.navy,
          letterSpacing: -1,
        }}
      >
        {title}
      </div>

      {/* Subtitle / date */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 140,
          transform: 'translateY(40px)',
          opacity: subtitleOpacity,
          fontFamily: fonts.body,
          fontSize: 24,
          color: colors.gray,
        }}
      >
        {subtitle}
      </div>
    </AbsoluteFill>
  );
};
