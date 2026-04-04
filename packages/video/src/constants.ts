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

// Design tokens — dark slides (matches Learning Hub); cream kept for text on navy badges.
export const colors = {
  cream: '#FAFAF5',
  /** Full-frame slide background */
  page: '#0C1018',
  /** Primary text on dark slides */
  onPage: '#E4E1D9',
  /** Captions / secondary on dark slides */
  onPageMuted: '#8E8A82',
  /** Rules, progress track on dark */
  ruleDark: '#343C48',
  navy: '#1B3A5C',
  terracotta: '#D97254',
  nearBlack: '#1A1A1A',
  gray: '#6B6B6B',
  divider: '#D4D4D0',
  white: '#FFFFFF',
  /** Star delta on dark bg */
  positive: '#5CB87A',
} as const;

export const fonts = {
  display: 'Satoshi, Inter, sans-serif',
  body: 'Inter, sans-serif',
  mono: 'JetBrains Mono, Courier New, monospace',
} as const;
