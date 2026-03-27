import React, { useMemo } from 'react';
import { Player } from '@remotion/player';
import { Episode } from '@tidox/video/src/Episode';
import { FPS, WIDTH, HEIGHT, TOTAL_FRAMES } from '@tidox/video/src/constants';
import type { EpisodeProps } from '@tidox/video/src/types';

interface VideoPlayerProps {
  episode: EpisodeProps;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ episode }) => {
  const inputProps = useMemo(() => episode, [episode]);

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden' }}>
      <Player
        component={Episode}
        inputProps={inputProps}
        durationInFrames={TOTAL_FRAMES}
        compositionWidth={WIDTH}
        compositionHeight={HEIGHT}
        fps={FPS}
        style={{ width: '100%', aspectRatio: '16/9' }}
        controls
        autoPlay={false}
        clickToPlay
      />
    </div>
  );
};
