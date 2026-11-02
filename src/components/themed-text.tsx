import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage } from '@/i18n/i18n';

export type ThemedTextProps = TextProps & {
  type?: 'display' | 'title' | 'subtitle' | 'default' | 'defaultBold' | 'small' | 'smallBold';
  themeColor?: ThemeColor;
};

/**
 * Text with the postcard fonts and the app's chosen writing direction.
 * Alignment stays "natural", so it follows `writingDirection` (right for Hebrew, left for English).
 */
export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const { direction } = useLanguage();

  return (
    <Text
      style={[{ color: theme[themeColor ?? 'text'], writingDirection: direction }, styles[type], style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  display: { fontFamily: Fonts.black, fontSize: 40, lineHeight: 46 },
  title: { fontFamily: Fonts.bold, fontSize: 26, lineHeight: 32 },
  subtitle: { fontFamily: Fonts.bold, fontSize: 19, lineHeight: 25 },
  default: { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 23 },
  defaultBold: { fontFamily: Fonts.bold, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18 },
  smallBold: { fontFamily: Fonts.bold, fontSize: 13, lineHeight: 18 },
});
