/** Shared constants for the video composition */

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Scene durations in frames — precisely synced to podcast topic transitions
export const DURATIONS = {
  masthead: 252,        //   8.4s (intro before first topic)
  headline1: 2541,      //  84.7s (LiteLLM supply chain deep dive)
  headline2: 2393,      //  79.8s (last30days-skill + ecosystem)
  headline3: 2390,      //  79.7s (HyperAgents + agent race)
  trendingTicker: 1017, //  33.9s (trending + Stripe + CLI wars)
  takeaway: 1782,       //  59.4s (thesis + action items)
  close: 115,           //   3.8s (closing)
} as const;

// Total: ~350s (~5:50, matches podcast duration)
export const TOTAL_FRAMES =
  DURATIONS.masthead +
  DURATIONS.headline1 +
  DURATIONS.headline2 +
  DURATIONS.headline3 +
  DURATIONS.trendingTicker +
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
