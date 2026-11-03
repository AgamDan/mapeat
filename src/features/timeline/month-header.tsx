import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage } from '@/i18n/i18n';
import { formatMonth } from '@/lib/dates';

/** Timeline section header: the month, e.g. "October 2026", over a thin rule. */
export function MonthHeader({ month }: { month: string }) {
  const theme = useTheme();
  const { language } = useLanguage();

  return (
    <View
      accessibilityRole="header"
      style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.line }]}>
      <ThemedText type="defaultBold" themeColor="accent">
        {formatMonth(month, language)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
    marginBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
