import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { colors, fonts, DURATIONS } from '../constants';

interface TakeawayProps {
  text: string;
}

export const Takeaway: React.FC<TakeawayProps> = ({ text }) => {
  const frame = useCurrentFrame();
  const totalFrames = DURATIONS.takeaway;

  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [totalFrames - 15, totalFrames], [1, 0], { extrapolateLeft: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);

  const accentHeight = interpolate(frame, [0, 20], [0, 200], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.page, justifyContent: 'center', paddingLeft: 140, paddingRight: 200 }}>
      {/* Terracotta accent bar (left) */}
      <div
        style={{
          position: 'absolute',
          left: 100,
          top: '50%',
          width: 6,
          height: accentHeight,
          backgroundColor: colors.terracotta,
          transform: 'translateY(-50%)',
          borderRadius: 3,
        }}
      />

      {/* Label */}
      <div
        style={{
          opacity,
          fontFamily: fonts.mono,
          fontSize: 14,
          letterSpacing: 3,
          color: colors.terracotta,
          marginBottom: 32,
        }}
      >
        TAKEAWAY
      </div>

      {/* Takeaway text */}
      <div
        style={{
          opacity,
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 32,
          lineHeight: 1.4,
          color: colors.onPage,
          maxWidth: 1400,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
