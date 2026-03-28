import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fonts, DURATIONS } from '../constants';
import type { Headline } from '../types';

interface HeadlineCardProps {
  headlines: Headline[];
}

const FADE_FRAMES = 6; // ~200ms at 30fps

const SingleCard: React.FC<{ headline: Headline; index: number; localFrame: number; cardDuration: number }> = ({
  headline,
  index,
  localFrame,
  cardDuration,
}) => {
  const { fps } = useVideoConfig();

  // Fade in at start, fade out at end
  const fadeIn = interpolate(localFrame, [0, FADE_FRAMES], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const fadeOut = interpolate(localFrame, [cardDuration - FADE_FRAMES, cardDuration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);

  const textSlide = spring({
    frame: Math.max(0, localFrame),
    fps,
    config: { damping: 26, stiffness: 170, mass: 1 },
  });
  const translateY = interpolate(textSlide, [0, 1], [30, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.cream,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingLeft: 120,
        paddingRight: 120,
        opacity,
      }}
    >
      {/* Card index */}
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 20,
          color: colors.gray,
          marginBottom: 36,
          transform: `translateY(${translateY}px)`,
        }}
      >
        0{index + 1}
      </div>

      {/* Metric badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 48, transform: `translateY(${translateY}px)` }}>
        <div
          style={{
            backgroundColor: colors.navy,
            borderRadius: 6,
            padding: '10px 22px',
            fontFamily: fonts.mono,
            fontSize: 24,
            fontWeight: 600,
            color: colors.cream,
          }}
        >
          {headline.metric}
        </div>
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: 3,
            color: colors.gray,
          }}
        >
          {headline.source.toUpperCase()}
        </div>
      </div>

      {/* Headline text — large serif */}
      <div
        style={{
          fontFamily: "'Georgia', 'Source Serif 4', serif",
          fontSize: 46,
          fontWeight: 400,
          lineHeight: 1.3,
          color: colors.nearBlack,
          maxWidth: 1200,
          transform: `translateY(${translateY}px)`,
        }}
      >
        {headline.text}
      </div>

      {/* Bottom divider */}
      <div
        style={{
          width: 1000,
          height: 1,
          backgroundColor: colors.divider,
          marginTop: 56,
        }}
      />
    </AbsoluteFill>
  );
};

export const HeadlineCard: React.FC<HeadlineCardProps> = ({ headlines }) => {
  const frame = useCurrentFrame();
  const cardDuration = DURATIONS.headlineCard;

  const cardIndex = Math.min(Math.floor(frame / cardDuration), headlines.length - 1);
  const localFrame = frame - cardIndex * cardDuration;

  return (
    <AbsoluteFill>
      {headlines.map((headline, i) => {
        if (i !== cardIndex) return null;
        return (
          <SingleCard
            key={i}
            headline={headline}
            index={i}
            localFrame={localFrame}
            cardDuration={cardDuration}
          />
        );
      })}
    </AbsoluteFill>
  );
};
