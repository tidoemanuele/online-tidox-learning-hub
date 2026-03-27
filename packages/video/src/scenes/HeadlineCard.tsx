import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fonts, DURATIONS } from '../constants';
import type { Headline } from '../types';

interface HeadlineCardProps {
  headlines: Headline[];
}

const SingleCard: React.FC<{ headline: Headline; index: number; startFrame: number }> = ({
  headline,
  index,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - startFrame;

  const slideIn = spring({
    frame: Math.max(0, localFrame),
    fps,
    config: { damping: 26, stiffness: 170, mass: 1 },
  });

  const translateX = interpolate(slideIn, [0, 1], [200, 0]);
  const opacity = interpolate(localFrame, [0, 8], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.cream,
        justifyContent: 'center',
        paddingLeft: 140,
        paddingRight: 140,
        opacity,
        transform: `translateX(${translateX}px)`,
      }}
    >
      {/* Card index */}
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 22,
          color: colors.gray,
          marginBottom: 40,
        }}
      >
        0{index + 1}
      </div>

      {/* Metric badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 48 }}>
        <div
          style={{
            backgroundColor: colors.navy,
            borderRadius: 6,
            padding: '10px 22px',
            fontFamily: fonts.mono,
            fontSize: 26,
            fontWeight: 600,
            color: colors.cream,
          }}
        >
          {headline.metric}
        </div>
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: 3,
            color: colors.gray,
          }}
        >
          {headline.source.toUpperCase()}
        </div>
      </div>

      {/* Headline text */}
      <div
        style={{
          fontFamily: fonts.body,
          fontSize: 42,
          fontWeight: 400,
          lineHeight: 1.3,
          color: colors.nearBlack,
          maxWidth: 1200,
        }}
      >
        {headline.text}
      </div>

      {/* Bottom divider */}
      <div
        style={{
          width: 1200,
          height: 1,
          backgroundColor: colors.divider,
          marginTop: 60,
        }}
      />
    </AbsoluteFill>
  );
};

export const HeadlineCard: React.FC<HeadlineCardProps> = ({ headlines }) => {
  const frame = useCurrentFrame();
  const cardDuration = DURATIONS.headlineCard;

  // Determine which card is showing
  const cardIndex = Math.min(Math.floor(frame / cardDuration), headlines.length - 1);
  const cardStartFrame = cardIndex * cardDuration;

  return (
    <AbsoluteFill>
      {headlines.map((headline, i) => {
        const isVisible = i === cardIndex;
        if (!isVisible) return null;
        return (
          <SingleCard
            key={i}
            headline={headline}
            index={i}
            startFrame={cardStartFrame}
          />
        );
      })}
    </AbsoluteFill>
  );
};
