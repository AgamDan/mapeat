import { ScrollView, StyleSheet } from 'react-native';

import { ChoiceGroup } from '@/components/choice-group';
import { Spacing, MaxContentWidth } from '@/constants/theme';
import { PeopleEditor } from '@/features/people/people-editor';
import { translate, useLanguage, useT } from '@/i18n/i18n';
import { useSettings, type Appearance, type Language } from '@/settings/settings-provider';

export default function SettingsScreen() {
  const t = useT();
  const { language } = useLanguage();
  const { appearance, setAppearance, setLanguage } = useSettings();

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ChoiceGroup<Language>
        label={t('settings.language')}
        choices={[
          { value: 'he', label: translate('he', 'language.he') },
          { value: 'en', label: translate('en', 'language.en') },
        ]}
        value={language}
        onChange={setLanguage}
      />
      <ChoiceGroup<Appearance>
        label={t('settings.appearance')}
        choices={[
          { value: 'system', label: t('settings.appearance.system') },
          { value: 'light', label: t('settings.appearance.light') },
          { value: 'dark', label: t('settings.appearance.dark') },
        ]}
        value={appearance}
        onChange={setAppearance}
      />
      <PeopleEditor />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
