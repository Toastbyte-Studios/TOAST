/**
 * ColdBoot theme tokens.
 *
 * Palette concept — "glacier": the logo's pale-ice ground and graphite
 * bootprint, with steel blue as the brand color. Amber is retained as the
 * single signal color (alerts, active tools) because no blue can carry that
 * role in a survival app; everything structural is cold.
 *
 * Both schemes are drawn from the mark itself:
 *   ice        #DCECF7  light tile, top gradient stop
 *   ice deep   #A9C5DA  light tile, bottom stop / hairlines
 *   ink        #1D1F20  the print in light mode
 *   steel      #2F5875  brand, print shadow
 *   steel pale #8FB6CE  brand in dark mode
 *   slate      #2F4F6B → #1B2F42  dark tile gradient
 */

const LIGHT_COLORS = {
  /** Primary brand color — replaces TOAST_BROWN. */
  BRAND: '#2F5875',
  BRAND_GRADIENT: ['#5980A6', '#2F5875'],

  /** Foreground / body text. Named DARK for historical reasons: it is the
   *  high-contrast color against BACKGROUND, and inverts in dark mode. */
  PRIMARY_DARK: '#1D1F20',
  /** Raised surfaces and inverted text. */
  PRIMARY_LIGHT: '#F7FAFC',

  /** Signal amber — alerts, active tools, primary actions. */
  ACCENT: '#B45309',
  /** Cold teal — confirmed, stocked, in-range. */
  SECONDARY_ACCENT: '#2F6F7A',

  BACKGROUND: '#DCECF7',
  BACKGROUND_GRADIENT: ['#F1F7FB', '#DCECF7', '#C9DEEC', '#A9C5DA'],

  /** Card and sheet fill, distinct from BACKGROUND. */
  SURFACE: '#F7FAFC',
  /** Hairlines, dividers, input outlines. */
  BORDER: '#A9C5DA',
  /** De-emphasised labels, timestamps, placeholder text. */
  MUTED: '#557286',

  ERROR: '#C62828',
  SUCCESS: '#227A66',
  SUCCESS_LIGHT: '#D2E9E2',
  ERROR_LIGHT: '#F6DAD8',

  /** @deprecated Use BRAND. Alias kept so existing screens compile. */
  TOAST_BROWN: '#2F5875',
  /** @deprecated Use BRAND_GRADIENT. */
  TOAST_BROWN_GRADIENT: ['#5980A6', '#2F5875'],
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  BRAND: '#8FB6CE',
  BRAND_GRADIENT: ['#2F4F6B', '#8FB6CE'],

  PRIMARY_DARK: '#DCECF7',
  PRIMARY_LIGHT: '#101B24',

  ACCENT: '#FFB020',
  SECONDARY_ACCENT: '#5E9BA8',

  BACKGROUND: '#101B24',
  BACKGROUND_GRADIENT: ['#1B2F42', '#152532', '#0B131A', '#22394D'],

  SURFACE: '#17232E',
  BORDER: '#2C4256',
  MUTED: '#8CA3B4',

  ERROR: '#EF5350',
  SUCCESS: '#4CA891',
  SUCCESS_LIGHT: '#173029',
  ERROR_LIGHT: '#3E2129',

  /** @deprecated Use BRAND. */
  TOAST_BROWN: '#8FB6CE',
  /** @deprecated Use BRAND_GRADIENT. */
  TOAST_BROWN_GRADIENT: ['#2F4F6B', '#8FB6CE'],
};

export type ThemeColors = typeof LIGHT_COLORS;
// ColorScheme is an alias for ThemeColors, used by useTheme hook for consistency
export type ColorScheme = ThemeColors;

// Default export for backwards compatibility
const COLORS = LIGHT_COLORS;

export default COLORS;
export { LIGHT_COLORS, DARK_COLORS };
