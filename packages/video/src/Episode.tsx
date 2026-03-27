import React from 'react';
import { Series } from 'remotion';
import { Masthead } from './scenes/Masthead';
import { HeadlineCard } from './scenes/HeadlineCard';
import { TrendingTicker } from './scenes/TrendingTicker';
import { NumbersGrid } from './scenes/NumbersGrid';
import { Takeaway } from './scenes/Takeaway';
import { DURATIONS } from './constants';
import type { EpisodeProps } from './types';

export const Episode: React.FC<EpisodeProps> = (props) => {
  return (
    <Series>
      <Series.Sequence durationInFrames={DURATIONS.masthead}>
        <Masthead
          title={props.scenes.masthead.title}
          subtitle={props.scenes.masthead.subtitle}
          episodeNumber={props.episodeNumber}
        />
      </Series.Sequence>

      <Series.Sequence durationInFrames={DURATIONS.headlineCard * props.scenes.headlines.length}>
        <HeadlineCard headlines={props.scenes.headlines} />
      </Series.Sequence>

      <Series.Sequence durationInFrames={DURATIONS.trendingTicker}>
        <TrendingTicker repos={props.trending} />
      </Series.Sequence>

      <Series.Sequence durationInFrames={DURATIONS.numbersGrid}>
        <NumbersGrid stats={props.numbers} />
      </Series.Sequence>

      <Series.Sequence durationInFrames={DURATIONS.takeaway}>
        <Takeaway text={props.scenes.takeaway.text} />
      </Series.Sequence>
    </Series>
  );
};
