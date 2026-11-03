/**
 * Design tokens.
 * Light: fresh near-white with tomato red and teal. Dark: calm warm charcoal with clay and slate blue.
 * Fonts: Rubik for titles and numbers, Heebo for text (both cover Hebrew and Latin).
 */

export const Colors = {
  light: {
    background: '#FBFBF6',
    backgroundRaised: '#F2F1E6',
    card: '#FFFFFF',
    text: '#20241F',
    textSecondary: '#5C6B58',
    line: '#E1E2D2',
    chip: '#EAE9DA',
    accent: '#C23D16',
    onAccent: '#FFFFFF',
    sea: '#1C7A8C',
    personA: '#C23D16',
    personB: '#1C7A8C',
  },
  dark: {
    background: '#1C1C1A',
    backgroundRaised: '#232320',
    card: '#282826',
    text: '#E8E4DC',
    textSecondary: '#A8A49C',
    line: '#333330',
    chip: '#30302D',
    accent: '#C98462',
    onAccent: '#1C1C1A',
    sea: '#6FA3AE',
    personA: '#C98462',
    personB: '#6FA3AE',
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type Palette = { [K in keyof typeof Colors.light]: string };
export type ThemeColor = keyof Palette;

/** Each weight is its own family in React Native — don't combine these with `fontWeight`. */
export const Fonts = {
  regular: 'Heebo_400Regular',
  medium: 'Heebo_500Medium',
  semibold: 'Heebo_600SemiBold',
  bold: 'Heebo_700Bold',
  /** Titles. */
  display: 'Rubik_700Bold',
  /** Big numbers (ratings, stats) and stamps. */
  displayHeavy: 'Rubik_800ExtraBold',
} as const;

/** Extra points added to font sizes for Hebrew, whose letters read smaller at the same size. */
export const HebrewSizeBoost = 1;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 4,
  card: 14,
  sheet: 24,
  pill: 999,
} as const;

export const MaxContentWidth = 800;
