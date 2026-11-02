/**
 * "Mediterranean postcard" design tokens.
 * Light: sand paper, terracotta, sea blue. Dark: the same postcard at night.
 */

export const Colors = {
  light: {
    background: '#F3E6CF',
    backgroundRaised: '#F7EEDD',
    card: '#FFFAF0',
    text: '#2B2118',
    textSecondary: '#7D6A55',
    line: '#D9C6A6',
    chip: '#EAD8B8',
    accent: '#C4572F',
    onAccent: '#FFF8EE',
    sea: '#1F5F8B',
    personA: '#C4572F',
    personB: '#1F5F8B',
  },
  dark: {
    background: '#171A21',
    backgroundRaised: '#1F232C',
    card: '#262B36',
    text: '#F3E9D8',
    textSecondary: '#A89A86',
    line: '#3A3F4B',
    chip: '#2C313C',
    accent: '#E07A55',
    onAccent: '#1B1410',
    sea: '#6FA8D1',
    personA: '#E07A55',
    personB: '#6FA8D1',
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type Palette = { [K in keyof typeof Colors.light]: string };
export type ThemeColor = keyof Palette;

/** Frank Ruhl Libre covers Hebrew and Latin. Each weight is its own family in React Native. */
export const Fonts = {
  regular: 'FrankRuhlLibre_400Regular',
  medium: 'FrankRuhlLibre_500Medium',
  bold: 'FrankRuhlLibre_700Bold',
  black: 'FrankRuhlLibre_900Black',
} as const;

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
