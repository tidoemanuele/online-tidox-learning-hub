import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { colors, fonts } from '../constants';

interface ScreenFrameProps {
  date: string;
  totalFrames: number;
}

export const ScreenFrame: React.FC<ScreenFrameProps> = ({ date, totalFrames }) => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  // Progress bar instead of dots (works for any number of beats)
  const progress = frame / totalFrames;

  return (
    <AbsoluteFill style={{ opacity: fadeIn, pointerEvents: 'none' }}>
      {/* Left accent stripe */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 3,
          height: '100%',
          backgroundColor: colors.terracotta,
        }}
      />

      {/* Top bar */}
      <div
        style={{
          position: 'absolute',
          top: 28,
          left: 0,
          right: 0,
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 60px',
        }}
      >
        <span style={{ fontFamily: fonts.mono, fontSize: 18, letterSpacing: 3, color: colors.gray }}>
          {date}
        </span>
        <span style={{ fontFamily: fonts.body, fontSize: 16, fontWeight: 600, letterSpacing: 6, color: colors.gray }}>
          INTELLIGENCE BRIEF
        </span>
      </div>

      {/* Top rule */}
      <div
        style={{
          position: 'absolute',
          top: 96,
          left: 60,
          right: 60,
          height: 1,
          backgroundColor: colors.divider,
        }}
      />

      {/* Bottom progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 60,
          right: 60,
          height: 2,
          backgroundColor: colors.divider,
          borderRadius: 1,
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            backgroundColor: colors.terracotta,
            borderRadius: 1,
            transition: 'width 0.1s linear',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
