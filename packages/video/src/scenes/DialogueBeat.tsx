import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
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

export const DialogueBeat: React.FC<DialogueBeatProps> = ({ speaker, visual }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 28, stiffness: 180 } });
  const enterY = interpolate(enter, [0, 1], [30, 0]);
  const enterOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const exitOpacity = interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });
  const opacity = Math.min(enterOpacity, exitOpacity);

  const accentColor = speaker === 'A' ? colors.navy : colors.terracotta;
  const isDark = visual.type === 'intro' || visual.type === 'close';
  const bgColor = isDark ? colors.navy : colors.cream;
  const textColor = isDark ? colors.cream : colors.nearBlack;
  const mutedColor = isDark ? 'rgba(250,250,245,0.5)' : colors.gray;
  const accentOnBg = isDark ? colors.terracotta : accentColor;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 120px',
          paddingTop: 110,
          opacity,
          transform: `translateY(${enterY}px)`,
        }}
      >
        {/* LABEL (always show if present) */}
        {visual.label && (
          <div style={{
            fontFamily: fonts.mono,
            fontSize: 15,
            letterSpacing: 4,
            color: accentOnBg,
            marginBottom: 20,
            textTransform: 'uppercase',
          }}>
            {visual.label}
          </div>
        )}

        {/* ACTION: terracotta left bar */}
        {visual.type === 'action' && (
          <div style={{
            position: 'absolute', left: 85, top: '50%',
            transform: 'translateY(-50%)', width: 5, height: 100,
            backgroundColor: colors.terracotta, borderRadius: 3,
          }} />
        )}

        {/* NUMBER TYPE: big number + highlight as title + subtext */}
        {visual.type === 'number' && (
          <>
            {visual.highlight && (
              <div style={{
                fontFamily: fonts.display, fontSize: 36, fontWeight: 700,
                color: textColor, marginBottom: 16, maxWidth: 1200,
              }}>
                {visual.highlight}
              </div>
            )}
            <div style={{
              fontFamily: fonts.mono, fontSize: 110, fontWeight: 700,
              color: textColor, lineHeight: 1, marginBottom: 12,
            }}>
              <NumberReveal number={visual.number || ''} />
            </div>
            {visual.subtext && (
              <div style={{
                fontFamily: fonts.body, fontSize: 22, color: mutedColor,
                maxWidth: 1000, lineHeight: 1.5,
              }}>
                {visual.subtext}
              </div>
            )}
          </>
        )}

        {/* REPO TYPE: label + repo name in monospace card + subtext */}
        {visual.type === 'repo' && (
          <>
            <div style={{
              fontFamily: fonts.mono, fontSize: 38, fontWeight: 600,
              color: colors.navy, backgroundColor: colors.lightBg,
              padding: '14px 32px', borderRadius: 8,
              display: 'inline-block', marginBottom: 16, alignSelf: 'flex-start',
            }}>
              {visual.highlight}
            </div>
            {visual.subtext && (
              <div style={{
                fontFamily: fonts.body, fontSize: 22, color: mutedColor,
                maxWidth: 1100, lineHeight: 1.5, marginTop: 8,
              }}>
                {visual.subtext}
              </div>
            )}
          </>
        )}

        {/* QUOTE TYPE: italic highlight + subtext */}
        {visual.type === 'quote' && (
          <>
            <div style={{
              fontFamily: "'Georgia', serif", fontSize: 44, fontWeight: 400,
              fontStyle: 'italic', color: textColor, maxWidth: 1300, lineHeight: 1.35,
            }}>
              "{visual.highlight}"
            </div>
            {visual.subtext && (
              <div style={{
                fontFamily: fonts.body, fontSize: 20, color: mutedColor,
                marginTop: 20, maxWidth: 1100,
              }}>
                {visual.subtext}
              </div>
            )}
          </>
        )}

        {/* INSIGHT TYPE: bold highlight + subtext */}
        {visual.type === 'insight' && (
          <>
            <div style={{
              fontFamily: fonts.display, fontSize: 44, fontWeight: 700,
              color: textColor, maxWidth: 1300, lineHeight: 1.3,
            }}>
              {visual.highlight}
            </div>
            {visual.subtext && (
              <div style={{
                fontFamily: fonts.body, fontSize: 22, color: mutedColor,
                marginTop: 20, maxWidth: 1100, lineHeight: 1.5,
              }}>
                {visual.subtext}
              </div>
            )}
          </>
        )}

        {/* ACTION TYPE: highlight + subtext with accent */}
        {visual.type === 'action' && (
          <>
            <div style={{
              fontFamily: fonts.display, fontSize: 40, fontWeight: 700,
              color: textColor, maxWidth: 1300, lineHeight: 1.3,
            }}>
              {visual.highlight}
            </div>
            {visual.subtext && (
              <div style={{
                fontFamily: fonts.body, fontSize: 22, color: mutedColor,
                marginTop: 18, maxWidth: 1100, lineHeight: 1.5,
              }}>
                {visual.subtext}
              </div>
            )}
          </>
        )}

        {/* INTRO / CLOSE TYPE: centered serif */}
        {(visual.type === 'intro' || visual.type === 'close') && (
          <div style={{ textAlign: 'center', alignSelf: 'center' }}>
            <div style={{
              fontFamily: "'Georgia', serif", fontSize: 52, fontWeight: 300,
              letterSpacing: 4, color: textColor, marginBottom: 16,
            }}>
              {visual.highlight}
            </div>
            {visual.subtext && (
              <div style={{
                fontFamily: fonts.body, fontSize: 22, color: mutedColor,
              }}>
                {visual.subtext}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Speaker indicator */}
      <div style={{
        position: 'absolute', bottom: 60, left: 120,
        display: 'flex', alignItems: 'center', gap: 10, opacity: opacity * 0.5,
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%', backgroundColor: accentColor,
        }} />
        <span style={{ fontFamily: fonts.mono, fontSize: 12, color: mutedColor }}>
          {speaker === 'A' ? 'ANDREW' : 'ARIA'}
        </span>
      </div>
    </AbsoluteFill>
  );
};

const NumberReveal: React.FC<{ number: string }> = ({ number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 20, stiffness: 120 } });
  const s = interpolate(scale, [0, 1], [0.85, 1]);
  return <span style={{ transform: `scale(${s})`, display: 'inline-block' }}>{number}</span>;
};
