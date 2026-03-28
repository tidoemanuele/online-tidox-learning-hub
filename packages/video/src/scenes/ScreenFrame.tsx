import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { colors, fonts, FPS, DURATIONS } from '../constants';

const SECTIONS = ['masthead', 'headlines', 'trending', 'numbers', 'takeaway', 'close'];

interface ScreenFrameProps {
  date: string;
  totalFrames: number;
}

/**
 * ScreenFrame — persistent visual chrome rendered on every frame.
 *
 * - Top bar: date stamp left, "INTELLIGENCE BRIEF" right, thin rule below
 * - Left accent: 3px vertical terracotta stripe
 * - Bottom progress dots: 6 dots, active one filled navy
 */
export const ScreenFrame: React.FC<ScreenFrameProps> = ({ date, totalFrames }) => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  // Determine active section based on frame
  const mastheadEnd = DURATIONS.masthead;
  const headlinesEnd = mastheadEnd + DURATIONS.headlineCard * 3;
  const trendingEnd = headlinesEnd + DURATIONS.trendingTicker;
  const numbersEnd = trendingEnd + DURATIONS.numbersGrid;
  const takeawayEnd = numbersEnd + DURATIONS.takeaway;

  let activeIndex = 0;
  if (frame >= takeawayEnd) activeIndex = 5;
  else if (frame >= numbersEnd) activeIndex = 4;
  else if (frame >= trendingEnd) activeIndex = 3;
  else if (frame >= headlinesEnd) activeIndex = 2;
  else if (frame >= mastheadEnd) activeIndex = 1;

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
          top: 0,
          left: 0,
          right: 0,
          height: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 60px',
        }}
      >
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 16,
            letterSpacing: 3,
            color: '#9A9A96',
          }}
        >
          {date}
        </span>
        <span
          style={{
            fontFamily: fonts.body,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 6,
            color: '#9A9A96',
          }}
        >
          INTELLIGENCE BRIEF
        </span>
      </div>

      {/* Top rule */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 60,
          right: 60,
          height: 1,
          backgroundColor: colors.divider,
        }}
      />

      {/* Bottom progress dots */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        {SECTIONS.map((_, i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: i === activeIndex ? colors.navy : 'transparent',
              border: `1.5px solid ${i === activeIndex ? colors.navy : '#C4C4C0'}`,
              transition: 'background-color 0.2s',
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
