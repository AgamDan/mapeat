import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoiceGroup } from '@/components/choice-group';
import { Postcard } from '@/components/postcard';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { translate, useLanguage } from '@/i18n/i18n';
import { useSettings, type Language } from '@/settings/settings-provider';

/** First launch: choose Hebrew or English before anything else (confirmed product decision). */
export default function WelcomeScreen() {
  const { setLanguage } = useSettings();
  const { language: deviceLanguage } = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Spacing.six, paddingBottom: insets.bottom + Spacing.five }]}>
      <View style={styles.hero}>
        <ThemedText type="display" themeColor="accent">
          {translate(deviceLanguage, 'appName')}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={[styles.tagline, { writingDirection: 'rtl' }]}>
          {translate('he', 'welcome.tagline')}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={[styles.tagline, { writingDirection: 'ltr' }]}>
          {translate('en', 'welcome.tagline')}
        </ThemedText>
      </View>

      <Postcard stamp="TLV" style={styles.card}>
        <ChoiceGroup<Language>
          label={`${translate('he', 'welcome.choose')} · ${translate('en', 'welcome.choose')}`}
          choices={[
            { value: 'he', label: translate('he', 'language.he') },
            { value: 'en', label: translate('en', 'language.en') },
          ]}
          value={deviceLanguage}
          onChange={setLanguage}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {translate(deviceLanguage, 'welcome.later')}
        </ThemedText>
      </Postcard>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  hero: {
    gap: Spacing.two,
  },
  tagline: {
    fontSize: 18,
  },
  card: {
    gap: Spacing.three,
  },
});
