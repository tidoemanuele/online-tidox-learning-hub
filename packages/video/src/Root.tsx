import React from 'react';
import { Composition } from 'remotion';
import { Episode } from './Episode';
import { FPS, WIDTH, HEIGHT, TOTAL_FRAMES } from './constants';
import type { EpisodeProps } from './types';

const sampleData: EpisodeProps = {
  date: '2026-03-27',
  episodeNumber: 1,
  locale: 'en-US',
  title: 'Intelligence Brief',
  subtitle: 'LiteLLM supply chain attack, last30days-skill goes viral, Meta HyperAgents',
  insights: [],
  trending: [
    { name: 'last30days-skill', stars: '10.2K', language: 'TypeScript', delta: '+2,685/d' },
    { name: 'deer-flow', stars: '48.3K', language: 'Python', delta: '+2,394/d' },
    { name: 'everything-claude-code', stars: '108K', language: 'Markdown', delta: '+1,200/d' },
    { name: 'RuView', stars: '43K', language: 'Rust', delta: '+1,000/d' },
    { name: 'Dexter', stars: '19K', language: 'Python', delta: '+890/d' },
  ],
  numbers: [
    { label: 'Top HN Story', value: '276', unit: 'pts' },
    { label: 'Fastest Repo', value: '2,685', unit: 'stars/day' },
    { label: 'Sources Scraped', value: '14', unit: 'sites' },
    { label: 'Insights Today', value: '6', unit: 'stories' },
  ],
  scenes: {
    masthead: { title: 'INTELLIGENCE BRIEF', subtitle: 'March 27, 2026' },
    headlines: [
      { text: 'LiteLLM supply chain attack compromises 97M monthly downloads', metric: '276 pts', source: 'HN' },
      { text: 'last30days-skill validates the single-purpose skill pattern at +2,685 stars/day', metric: '+2,685/d', source: 'GitHub' },
      { text: "Meta's HyperAgents introduces recursive self-improvement for AI agents", metric: '121 pts', source: 'HN' },
    ],
    takeaway: {
      text: 'The AI supply chain is now a target-rich environment, and the response is measured in hours, not months. Meanwhile, the single-purpose skill pattern validates at scale.',
    },
  },
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Episode"
      component={Episode}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={sampleData}
    />
  );
};
