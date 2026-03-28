import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { colors, fonts } from '../constants';

export type BeatType = 'intro' | 'number' | 'quote' | 'repo' | 'insight' | 'action' | 'close';

interface BeatVisual {
  type: BeatType;
  highlight?: string;
  number?: string;
  subtext?: string;
  label?: string;
}

interface DialogueBeatProps {
  speaker: 'A' | 'B';
  text: string;
  visual: BeatVisual;
  beatIndex: number;
}

// Color palettes per beat type - visual variety
const PALETTES: Record<BeatType, { bg: string; text: string; accent: string; muted: string }> = {
  intro:   { bg: '#0F1923', text: '#FAFAF5', accent: '#C45D3E', muted: 'rgba(250,250,245,0.4)' },
  number:  { bg: '#1B3A5C', text: '#FAFAF5', accent: '#E8A87C', muted: 'rgba(250,250,245,0.5)' },
  quote:   { bg: '#FAFAF5', text: '#1A1A1A', accent: '#C45D3E', muted: '#6B6B6B' },
  repo:    { bg: '#0D1117', text: '#E6EDF3', accent: '#58A6FF', muted: 'rgba(230,237,243,0.5)' },
  insight: { bg: '#FAFAF5', text: '#1A1A1A', accent: '#1B3A5C', muted: '#6B6B6B' },
  action:  { bg: '#C45D3E', text: '#FAFAF5', accent: '#FAFAF5', muted: 'rgba(250,250,245,0.7)' },
  close:   { bg: '#0F1923', text: '#FAFAF5', accent: '#C45D3E', muted: 'rgba(250,250,245,0.4)' },
};

// Animated word-by-word reveal
const KineticText: React.FC<{ text: string; fontSize: number; color: string; fontFamily: string; fontWeight: number; italic?: boolean; maxWidth?: number }> = ({
  text, fontSize, color, fontFamily, fontWeight, italic, maxWidth,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 12px', maxWidth: maxWidth || 1300, lineHeight: 1.35 }}>
      {words.map((word, i) => {
        const wordDelay = 4 + i * 2; // Each word appears 2 frames after the previous
        const wordOpacity = interpolate(frame, [wordDelay, wordDelay + 4], [0, 1], {
          extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
        });
        const wordY = interpolate(frame, [wordDelay, wordDelay + 6], [12, 0], {
          extrapolateRight: 'clamp', extrapolateLeft: 'clamp',
          easing: Easing.out(Easing.cubic),
        });

        return (
          <span
            key={i}
            style={{
              fontFamily, fontSize, fontWeight, color,
              fontStyle: italic ? 'italic' : 'normal',
              opacity: wordOpacity,
              transform: `translateY(${wordY}px)`,
              display: 'inline-block',
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

// Animated accent line that grows
const GrowingLine: React.FC<{ color: string; vertical?: boolean; length?: number; thickness?: number }> = ({
  color, vertical, length = 120, thickness = 4,
}) => {
  const frame = useCurrentFrame();
  const grow = interpolate(frame, [0, 15], [0, length], {
    extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  });

  return (
    <div style={{
      width: vertical ? thickness : grow,
      height: vertical ? grow : thickness,
      backgroundColor: color,
      borderRadius: thickness / 2,
    }} />
  );
};

// Pulsing dot for speaker indicator
const PulsingDot: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const pulse = Math.sin(frame * 0.15) * 0.3 + 1;

  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%', backgroundColor: color,
      transform: `scale(${pulse})`,
    }} />
  );
};

export const DialogueBeat: React.FC<DialogueBeatProps> = ({ speaker, visual, beatIndex }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const palette = PALETTES[visual.type];
  const enterOpacity = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
  const exitOpacity = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });
  const opacity = Math.min(enterOpacity, exitOpacity);

  // Subtle background parallax
  const bgShift = interpolate(frame, [0, durationInFrames], [0, -20], { extrapolateRight: 'clamp' });

  const accentColor = speaker === 'A' ? palette.accent : colors.terracotta;

  return (
    <AbsoluteFill style={{ backgroundColor: palette.bg, overflow: 'hidden' }}>
      {/* Subtle animated grid/pattern for dark backgrounds */}
      {(visual.type === 'intro' || visual.type === 'close' || visual.type === 'number' || visual.type === 'repo') && (
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: `radial-gradient(circle at 1px 1px, ${palette.text} 1px, transparent 0)`,
          backgroundSize: '40px 40px',
          transform: `translateY(${bgShift}px)`,
        }} />
      )}

      {/* Accent line - different position per beat type */}
      <div style={{
        position: 'absolute',
        ...(visual.type === 'action' ? { left: 0, top: 0, bottom: 0, width: 6 } :
            visual.type === 'number' ? { bottom: 180, left: '50%', transform: 'translateX(-50%)' } :
            visual.type === 'repo' ? { top: 130, left: 120 } :
            { top: 130, left: 120 }),
      }}>
        <GrowingLine
          color={palette.accent}
          vertical={visual.type === 'action'}
          length={visual.type === 'action' ? 400 : visual.type === 'number' ? 200 : 80}
          thickness={visual.type === 'action' ? 6 : 3}
        />
      </div>

      {/* Main content */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: visual.type === 'number' ? '0 120px' : '0 120px',
        paddingTop: 120,
        alignItems: visual.type === 'number' || visual.type === 'intro' || visual.type === 'close' ? 'center' : 'flex-start',
        textAlign: visual.type === 'number' || visual.type === 'intro' || visual.type === 'close' ? 'center' : 'left',
        opacity,
      }}>

        {/* LABEL */}
        {visual.label && (
          <div style={{
            fontFamily: fonts.mono, fontSize: 14, letterSpacing: 5,
            color: palette.accent, marginBottom: 20, textTransform: 'uppercase',
            opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            {visual.label}
          </div>
        )}

        {/* === NUMBER TYPE === */}
        {visual.type === 'number' && (
          <>
            {visual.highlight && (
              <div style={{
                fontFamily: fonts.display, fontSize: 28, fontWeight: 600,
                color: palette.muted, marginBottom: 24, letterSpacing: 1,
              }}>
                {visual.highlight}
              </div>
            )}
            <AnimatedNumber number={visual.number || ''} color={palette.text} />
            {visual.subtext && (
              <div style={{
                fontFamily: fonts.body, fontSize: 20, color: palette.muted,
                marginTop: 16, maxWidth: 800,
              }}>
                {visual.subtext}
              </div>
            )}
          </>
        )}

        {/* === REPO TYPE (GitHub dark theme) === */}
        {visual.type === 'repo' && (
          <>
            {visual.highlight && (
              <div style={{
                fontFamily: fonts.mono, fontSize: 42, fontWeight: 600,
                color: palette.accent, marginBottom: 16,
              }}>
                {visual.highlight}
              </div>
            )}
            {visual.subtext && (
              <KineticText text={visual.subtext} fontSize={22} color={palette.muted}
                fontFamily={fonts.body} fontWeight={400} maxWidth={1100} />
            )}
          </>
        )}

        {/* === QUOTE TYPE === */}
        {visual.type === 'quote' && (
          <>
            <div style={{
              fontFamily: fonts.mono, fontSize: 72, color: palette.accent,
              lineHeight: 0.5, marginBottom: 20, opacity: 0.3,
            }}>"</div>
            {visual.highlight && (
              <KineticText text={visual.highlight} fontSize={40}
                color={palette.text} fontFamily="'Georgia', serif" fontWeight={400}
                italic maxWidth={1200} />
            )}
            {visual.subtext && (
              <div style={{
                fontFamily: fonts.body, fontSize: 18, color: palette.muted,
                marginTop: 24, maxWidth: 1000,
              }}>
                {visual.subtext}
              </div>
            )}
          </>
        )}

        {/* === INSIGHT TYPE === */}
        {visual.type === 'insight' && visual.highlight && (
          <>
            <KineticText text={visual.highlight} fontSize={44}
              color={palette.text} fontFamily={fonts.display} fontWeight={700} />
            {visual.subtext && (
              <div style={{
                fontFamily: fonts.body, fontSize: 20, color: palette.muted,
                marginTop: 24, maxWidth: 1100, lineHeight: 1.5,
                opacity: interpolate(frame, [20, 30], [0, 1], { extrapolateRight: 'clamp' }),
              }}>
                {visual.subtext}
              </div>
            )}
          </>
        )}

        {/* === ACTION TYPE (terracotta bg, white text) === */}
        {visual.type === 'action' && (
          <>
            {visual.highlight && (
              <KineticText text={visual.highlight} fontSize={42}
                color={palette.text} fontFamily={fonts.display} fontWeight={700}
                maxWidth={1200} />
            )}
            {visual.subtext && (
              <div style={{
                fontFamily: fonts.body, fontSize: 22, color: palette.muted,
                marginTop: 20, maxWidth: 1100,
                opacity: interpolate(frame, [20, 30], [0, 1], { extrapolateRight: 'clamp' }),
              }}>
                {visual.subtext}
              </div>
            )}
          </>
        )}

        {/* === INTRO / CLOSE TYPE === */}
        {(visual.type === 'intro' || visual.type === 'close') && (
          <>
            {visual.highlight && (
              <KineticText text={visual.highlight} fontSize={52}
                color={palette.text} fontFamily="'Georgia', serif" fontWeight={300} />
            )}
            {visual.subtext && (
              <div style={{
                fontFamily: fonts.body, fontSize: 20, color: palette.muted,
                marginTop: 20,
                opacity: interpolate(frame, [15, 25], [0, 1], { extrapolateRight: 'clamp' }),
              }}>
                {visual.subtext}
              </div>
            )}
          </>
        )}
      </div>

      {/* Speaker indicator with pulsing dot */}
      <div style={{
        position: 'absolute', bottom: 55, left: 120,
        display: 'flex', alignItems: 'center', gap: 10,
        opacity: opacity * 0.6,
      }}>
        <PulsingDot color={accentColor} />
        <span style={{ fontFamily: fonts.mono, fontSize: 12, color: palette.muted, letterSpacing: 2 }}>
          {speaker === 'A' ? 'ANDREW' : 'ARIA'}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// Dramatic animated number with scale + glow
const AnimatedNumber: React.FC<{ number: string; color: string }> = ({ number, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 15, stiffness: 100, mass: 1.2 } });
  const s = interpolate(scale, [0, 1], [0.5, 1]);
  const glow = interpolate(frame, [0, 15, 30], [0, 0.4, 0.15], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      fontFamily: fonts.mono, fontSize: 130, fontWeight: 700, color,
      transform: `scale(${s})`, lineHeight: 1,
      textShadow: `0 0 60px rgba(255,255,255,${glow})`,
    }}>
      {number}
    </div>
  );
};
