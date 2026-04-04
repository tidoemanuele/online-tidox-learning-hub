import React, { useMemo } from 'react';
import { Player } from '@remotion/player';
import { Episode } from '@tidox/video/src/Episode';
import { FPS, WIDTH, HEIGHT, TOTAL_FRAMES, colors } from '@tidox/video/src/constants';
import type { EpisodeProps } from '@tidox/video/src/types';

/** Match composition `page` so letterboxing isn’t lighter than the brief */
const PLAYER_CHROME = colors.page;

interface VideoPlayerProps {
  episode: EpisodeProps;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ episode }) => {
  const inputProps = useMemo(() => episode, [episode]);

  return (
    <div
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: PLAYER_CHROME,
      }}
    >
      <Player
        component={Episode}
        inputProps={inputProps}
        durationInFrames={TOTAL_FRAMES}
        compositionWidth={WIDTH}
        compositionHeight={HEIGHT}
        fps={FPS}
        style={{
          width: '100%',
          aspectRatio: '16/9',
          backgroundColor: PLAYER_CHROME,
        }}
        controls
        autoPlay={false}
        clickToPlay
        acknowledgeRemotionLicense
      />
    </div>
  );
};
