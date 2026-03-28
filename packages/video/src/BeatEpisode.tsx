import React from 'react';
import { AbsoluteFill, Series } from 'remotion';
import { DialogueBeat, type BeatType } from './scenes/DialogueBeat';
import { ScreenFrame } from './scenes/ScreenFrame';
import { FPS } from './constants';

interface BeatVisual {
  type: BeatType;
  highlight?: string;
  number?: string;
  subtext?: string;
  label?: string;
}

interface BeatEpisodeProps {
  date: string;
  script: [string, string][];
  beats: BeatVisual[];
  lineDurations: number[]; // duration in seconds per line (including pause)
}

export const BeatEpisode: React.FC<BeatEpisodeProps> = ({ date, script, beats, lineDurations }) => {
  const totalFrames = lineDurations.reduce((sum, d) => sum + Math.round(d * FPS), 0);

  return (
    <AbsoluteFill>
      <Series>
        {script.map(([speaker, text], i) => {
          const frames = Math.round((lineDurations[i] || 3) * FPS);
          const visual = beats[i] || { type: 'insight' as BeatType, highlight: text.slice(0, 50) };

          return (
            <Series.Sequence key={i} durationInFrames={frames}>
              <DialogueBeat
                speaker={speaker as 'A' | 'B'}
                text={text}
                visual={visual}
                beatIndex={i}
              />
            </Series.Sequence>
          );
        })}
      </Series>

      <ScreenFrame date={date} totalFrames={totalFrames} />
    </AbsoluteFill>
  );
};
