import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useT } from '@/i18n/i18n';

/** Paste a Google/Apple Maps link, find the place in the catalog, add it to the wishlist (M7 stub — built by a sub-agent). */
export default function AddFromLinkScreen() {
  const t = useT();
  return (
    <View style={styles.center}>
      <ThemedText>{t('link.title')}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
});