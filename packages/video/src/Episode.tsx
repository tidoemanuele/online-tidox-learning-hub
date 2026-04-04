import React from 'react';
import { AbsoluteFill, Audio, Series } from 'remotion';
import { Masthead } from './scenes/Masthead';
import { HeadlineCard } from './scenes/HeadlineCard';
import { TrendingTicker } from './scenes/TrendingTicker';
import { Takeaway } from './scenes/Takeaway';
import { Close } from './scenes/Close';
import { ScreenFrame } from './scenes/ScreenFrame';
import { DURATIONS, TOTAL_FRAMES, colors } from './constants';
import type { EpisodeProps } from './types';

export const Episode: React.FC<EpisodeProps> = (props) => {
  const syncAudioSrc = props.audio?.briefAudioUrl?.trim();

  return (
    <AbsoluteFill style={{ backgroundColor: colors.page }}>
      {syncAudioSrc ? (
        <Audio
          src={syncAudioSrc}
          useWebAudioApi={false}
          volume={1}
        />
      ) : null}
      <Series>
        <Series.Sequence durationInFrames={DURATIONS.masthead}>
          <Masthead
            title={props.scenes.masthead.title}
            subtitle={props.scenes.masthead.subtitle}
            episodeNumber={props.episodeNumber}
          />
        </Series.Sequence>

        {props.scenes.headlines.map((headline, i) => {
          const dur = [DURATIONS.headline1, DURATIONS.headline2, DURATIONS.headline3][i];
          return (
            <Series.Sequence key={i} durationInFrames={dur || DURATIONS.headline1}>
              <HeadlineCard headlines={[headline]} />
            </Series.Sequence>
          );
        })}

        <Series.Sequence durationInFrames={DURATIONS.trendingTicker}>
          <TrendingTicker repos={props.trending} />
        </Series.Sequence>

        <Series.Sequence durationInFrames={DURATIONS.takeaway}>
          <Takeaway text={props.scenes.takeaway.text} />
        </Series.Sequence>

        <Series.Sequence durationInFrames={DURATIONS.close}>
          <Close date={props.date} />
        </Series.Sequence>
      </Series>

      <ScreenFrame date={props.date} totalFrames={TOTAL_FRAMES} />
    </AbsoluteFill>
  );
};
