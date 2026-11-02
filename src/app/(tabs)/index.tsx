import { ScrollView, StyleSheet, View } from 'react-native';

import { Postcard } from '@/components/postcard';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useT } from '@/i18n/i18n';

export default function MapScreen() {
  const t = useT();

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t('map.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Postcard stamp="TLV">
          <ThemedText type="subtitle">{t('map.comingTitle')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('map.comingBody')}</ThemedText>
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
    paddingTop: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
