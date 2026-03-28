/** Shared constants for the video composition */

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Scene durations in frames
export const DURATIONS = {
  masthead: 3 * FPS,        // 90 frames = 3s
  headlineCard: 6 * FPS,    // 180 frames per card, 3 cards = 540 total
  trendingTicker: 10 * FPS, // 300 frames = 10s
  numbersGrid: 10 * FPS,    // 300 frames = 10s
  takeaway: 8 * FPS,        // 240 frames = 8s
  close: 5 * FPS,           // 150 frames = 5s
} as const;

export const TOTAL_FRAMES =
  DURATIONS.masthead +
  DURATIONS.headlineCard * 3 +
  DURATIONS.trendingTicker +
  DURATIONS.numbersGrid +
  DURATIONS.takeaway +
  DURATIONS.close;

// Design tokens (mirrors src/design-tokens.ts)
export const colors = {
  cream: '#FAFAF5',
  navy: '#1B3A5C',
  terracotta: '#C45D3E',
  nearBlack: '#1A1A1A',
  gray: '#6B6B6B',
  divider: '#D4D4D0',
  white: '#FFFFFF',
} as const;

export const fonts = {
  display: 'Satoshi, Inter, sans-serif',
  body: 'Inter, sans-serif',
  mono: 'JetBrains Mono, Courier New, monospace',
} as const;
