/**
 * Design tokens — TS consumers (e.g. future components).
 * Site styling is driven by src/styles/global.css (@theme dark UI).
 * Remotion video package keeps its own constants for on-screen briefs.
 */

export const colors = {
  page: '#0B0E12',
  cream: '#FAFAF5',
  navy: '#1B3A5C',
  heading: '#E8E6E1',
  terracotta: '#D97254',
  nearBlack: '#D4D1CA',
  gray: '#8F8A82',
  divider: '#2A3139',
  lightBg: '#141920',
  void: '#060708',
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
