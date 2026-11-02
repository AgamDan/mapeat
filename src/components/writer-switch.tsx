import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { PersonId } from '@/data/people';
import { usePeople } from '@/features/people/use-people';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n/i18n';

type WriterSwitchProps = {
  /** The person typing on this phone. */
  value: PersonId;
  onChange: (value: PersonId) => void;
  disabled?: boolean;
};

/** "Writing as": one pill per person, filled with that person's ink color when chosen. */
export function WriterSwitch({ value, onChange, disabled = false }: WriterSwitchProps) {
  const theme = useTheme();
  const t = useT();
  const { people } = usePeople();
  const label = t('visit.writingAs');

  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.row}>
        {people.map((person) => {
          const selected = person.id === value;
          const ink = theme[person.color];
          return (
            <Pressable
              key={person.id}
              accessibilityRole="radio"
              accessibilityLabel={person.name}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(person.id)}
              style={({ pressed }) => [
                styles.pill,
                selected
                  ? { backgroundColor: ink, borderColor: ink }
                  : { backgroundColor: theme.card, borderColor: theme.line },
                pressed && styles.pressed,
              ]}>
              <View
                style={[styles.dot, { backgroundColor: selected ? theme.onAccent : ink }]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <ThemedText type="defaultBold" style={{ color: selected ? theme.onAccent : ink }}>
                {person.name}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    minHeight: 44,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  pressed: {
    opacity: 0.7,
  },
});
