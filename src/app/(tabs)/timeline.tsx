import { ScrollView, StyleSheet, View } from 'react-native';

import { Postcard } from '@/components/postcard';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useT } from '@/i18n/i18n';

export default function TimelineScreen() {
  const t = useT();

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t('timeline.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Postcard>
          <ThemedText type="subtitle">{t('timeline.emptyTitle')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('timeline.emptyBody')}</ThemedText>
        </Postcard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingTop: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
