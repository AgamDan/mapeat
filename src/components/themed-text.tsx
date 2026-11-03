import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts, HebrewSizeBoost, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage } from '@/i18n/i18n';

export type ThemedTextProps = TextProps & {
  type?: 'display' | 'title' | 'subtitle' | 'default' | 'defaultBold' | 'small' | 'smallBold';
  themeColor?: ThemeColor;
};

/**
 * Text with the app fonts and the app's chosen writing direction.
 * Alignment stays "natural", so it follows `writingDirection` (right for Hebrew, left for English).
 * Sizes follow Apple's iPhone text styles; Hebrew is one point larger with a little more line height.
 */
export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const { language, direction } = useLanguage();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'], writingDirection: direction },
        language === 'he' ? hebrewStyles[type] : styles[type],
        style,
      ]}
      {...rest}
    />
  );
}

const scale = {
  // Large Title
  display: { fontFamily: Fonts.display, fontSize: 34, lineHeight: 41 },
  // Title 1
  title: { fontFamily: Fonts.display, fontSize: 28, lineHeight: 34 },
  // Title 3
  subtitle: { fontFamily: Fonts.display, fontSize: 20, lineHeight: 25 },
  // Body
  default: { fontFamily: Fonts.regular, fontSize: 17, lineHeight: 24 },
  // Headline
  defaultBold: { fontFamily: Fonts.semibold, fontSize: 17, lineHeight: 24 },
  // Footnote
  small: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18 },
  smallBold: { fontFamily: Fonts.semibold, fontSize: 13, lineHeight: 18 },
} satisfies Record<NonNullable<ThemedTextProps['type']>, TextStyle & { fontSize: number; lineHeight: number }>;

const styles = StyleSheet.create(scale);

const hebrewStyles = StyleSheet.create(
  Object.fromEntries(
    Object.entries(scale).map(([key, value]) => [
      key,
      { ...value, fontSize: value.fontSize + HebrewSizeBoost, lineHeight: value.lineHeight + HebrewSizeBoost + 2 },
    ]),
  ) as typeof scale,
);