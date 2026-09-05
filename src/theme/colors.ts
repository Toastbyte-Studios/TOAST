/**
 * ColdBoot theme tokens.
 *
 * Palette concept — "gauge-lit gunmetal": cold structural greys with a blue
 * cast, a single amber signal colour standing in for backlit instrument
 * lighting, and a cold teal for confirmed states.
 *
 * Dark mode is the hero scheme. Light mode is tuned for outdoor glare
 * (overcast daylight, high contrast) rather than for warmth.
 */

const LIGHT_COLORS = {
  /** Primary brand colour — replaces TOAST_BROWN. */
  BRAND: '#3E6076',
  BRAND_GRADIENT: ['#5C819A', '#3E6076'],

  /** Foreground / body text. Named DARK for historical reasons: it is the
   *  high-contrast colour against BACKGROUND, and inverts in dark mode. */
  PRIMARY_DARK: '#12181D',
  /** Raised surfaces and inverted text. */
  PRIMARY_LIGHT: '#F4F7F9',

  /** Signal amber — alerts, active tools, primary actions. */
  ACCENT: '#B45309',
  /** Cold teal — confirmed, stocked, in-range. */
  SECONDARY_ACCENT: '#2F6F63',

  BACKGROUND: '#DCE4EA',
  BACKGROUND_GRADIENT: ['#EDF2F5', '#F4F7F9', '#DCE4EA', '#C7D5DE'],

  /** Card and sheet fill, distinct from BACKGROUND. */
  SURFACE: '#F4F7F9',
  /** Hairlines, dividers, input outlines. */
  BORDER: '#A9BCC8',
  /** De-emphasised labels, timestamps, placeholder text. */
  MUTED: '#5A6E7A',

  ERROR: '#C62828',
  SUCCESS: '#2E7D5B',
  SUCCESS_LIGHT: '#D3E7DE',
  ERROR_LIGHT: '#F6DAD8',

  /** @deprecated Use BRAND. Alias kept so existing screens compile. */
  TOAST_BROWN: '#3E6076',
  /** @deprecated Use BRAND_GRADIENT. */
  TOAST_BROWN_GRADIENT: ['#5C819A', '#3E6076'],
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  BRAND: '#7FA3B8',
  BRAND_GRADIENT: ['#3A5262', '#7FA3B8'],

  PRIMARY_DARK: '#E4EBF0',
  PRIMARY_LIGHT: '#12181D',

  ACCENT: '#FFB020',
  SECONDARY_ACCENT: '#5E9B8D',

  BACKGROUND: '#12181D',
  BACKGROUND_GRADIENT: ['#1C262E', '#12181D', '#0C1114', '#1F2B33'],

  SURFACE: '#1A232A',
  BORDER: '#2E3C46',
  MUTED: '#8A9AA6',

  ERROR: '#EF5350',
  SUCCESS: '#4FA97F',
  SUCCESS_LIGHT: '#1E3A30',
  ERROR_LIGHT: '#40232A',

  /** @deprecated Use BRAND. */
  TOAST_BROWN: '#7FA3B8',
  /** @deprecated Use BRAND_GRADIENT. */
  TOAST_BROWN_GRADIENT: ['#3A5262', '#7FA3B8'],
};

export type ThemeColors = typeof LIGHT_COLORS;
// ColorScheme is an alias for ThemeColors, used by useTheme hook for consistency
export type ColorScheme = ThemeColors;

// Default export for backwards compatibility
const COLORS = LIGHT_COLORS;

export default COLORS;
export { LIGHT_COLORS, DARK_COLORS };
