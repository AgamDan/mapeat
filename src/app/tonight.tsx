import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useT } from '@/i18n/i18n';

/** "Where tonight?": random pick from wishlist and want-to-go-back places near the map center (M7 stub — built by a sub-agent). */
export default function TonightScreen() {
  const t = useT();
  return (
    <View style={styles.center}>
      <ThemedText>{t('tonight.title')}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
});