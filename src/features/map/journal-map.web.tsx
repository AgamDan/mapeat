import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { JournalMapProps } from '@/features/map/journal-map';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';

export type { JournalMapHandle, JournalMapProps } from '@/features/map/journal-map';

/** Web preview only: `react-native-maps` has no web support, and the app targets iPhone. */
export function JournalMap(_props: JournalMapProps) {
  const theme = useTheme();
  const t = useT();

  return (
    <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: theme.backgroundRaised }]}>
      <ThemedText themeColor="textSecondary">{t('map.webPreview')}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
