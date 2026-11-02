import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { renamePerson, type Person } from '@/data/people';
import { usePeople } from '@/features/people/use-people';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage, useT } from '@/i18n/i18n';

/** "Our names": rename the two journal members. Each name saves when its field loses focus. */
export function PeopleEditor() {
  const t = useT();
  const { people } = usePeople();

  return (
    <View style={styles.group}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {t('settings.people')}
      </ThemedText>
      {people.map((person) => (
        // Keyed by the saved name so the field resets if the name changes elsewhere.
        <NameField key={`${person.id}:${person.name}`} person={person} />
      ))}
    </View>
  );
}

function NameField({ person }: { person: Person }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const t = useT();
  const { direction } = useLanguage();
  const [value, setValue] = useState(person.name);

  const commit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setValue(person.name);
      return;
    }
    if (trimmed !== person.name) renamePerson(db, person.id, trimmed).catch(() => setValue(person.name));
  };

  return (
    <View style={[styles.field, { borderColor: theme[person.color], backgroundColor: theme.card }]}>
      <View style={[styles.swatch, { backgroundColor: theme[person.color] }]} />
      <TextInput
        value={value}
        onChangeText={setValue}
        onEndEditing={commit}
        accessibilityLabel={`${t('settings.personName')} ${person.name}`}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={40}
        returnKeyType="done"
        style={[styles.input, { color: theme.text, writingDirection: direction }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 17,
    paddingVertical: Spacing.two,
  },
});
