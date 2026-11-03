import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useT } from '@/i18n/i18n';

/** Explorer progress: cities and neighborhoods we have eaten in (M7 stub — built by a sub-agent). */
export default function ExplorerScreen() {
  const t = useT();
  return (
    <View style={styles.center}>
      <ThemedText>{t('explorer.title')}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
});