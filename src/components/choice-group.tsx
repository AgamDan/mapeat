import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Choice<T extends string> = { value: T; label: string };

type ChoiceGroupProps<T extends string> = {
  label: string;
  choices: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** A labeled single-choice row of pill buttons (radio group). */
export function ChoiceGroup<T extends string>({ label, choices, value, onChange }: ChoiceGroupProps<T>) {
  const theme = useTheme();

  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.row}>
        {choices.map((choice) => {
          const selected = choice.value === value;
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(choice.value)}
              style={({ pressed }) => [
                styles.choice,
                selected
                  ? { backgroundColor: theme.accent, borderColor: theme.accent }
                  : { backgroundColor: theme.card, borderColor: theme.line },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="defaultBold" style={{ color: selected ? theme.onAccent : theme.text }}>
                {choice.label}
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
  },
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
