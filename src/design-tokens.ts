/**
 * Design tokens — single source of truth for the Tidox Learning Hub.
 * Consumed by both Tailwind CSS (via global.css) and Remotion components.
 *
 * Light editorial palette: warm cream, terracotta accents, navy headings.
 */

export const colors = {
  cream: '#FAFAF5',
  navy: '#1B3A5C',
  terracotta: '#C45D3E',
  nearBlack: '#1A1A1A',
  gray: '#6B6B6B',
  divider: '#D4D4D0',
  lightBg: '#F0F0EA',
  white: '#FFFFFF',
} as const;

export const fonts = {
  display: "'Satoshi', 'Inter', ui-sans-serif, system-ui, sans-serif",
  body: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",
} as const;

export const spacing = {
  sectionGap: 32,
  contentPadding: 24,
  maxWidth: 960,
} as const;

export const breakpoints = {
  mobile: 768,
} as const;
